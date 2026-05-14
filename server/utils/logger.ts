/**
 * Central logger with key-based redaction for sensitive data.
 *
 * Threat model: error logs frequently contain raw request bodies, OAuth
 * tokens, password-reset tokens, session IDs, and PII. Logging platforms
 * (Replit, Datadog, etc.) cache these indefinitely and may surface them in
 * search. Redact at write time so a leaked log line is not a credential.
 *
 * Usage:
 *   import { logger } from "@/server/utils/logger";
 *   logger.error("Password reset failed", { email, error });
 *
 * The second argument is recursively walked; any key matching the redaction
 * list is replaced with "[REDACTED]". Long random-looking strings in
 * unknown-key positions are also collapsed.
 */

const REDACT_KEY_PATTERNS: RegExp[] = [
  /password/i,
  /passwd/i,
  /secret/i,
  /token/i,
  /authorization/i,
  /^auth$/i,
  /cookie/i,
  /session(?!Id$)/i, // sessionId is OK to log; session payloads are not
  /api[_-]?key/i,
  /bearer/i,
  /credential/i,
  /^code$/i, // OAuth authorization codes
  /^code_verifier$/i,
  /refresh[_-]?token/i,
  /access[_-]?token/i,
  /id[_-]?token/i,
  /private[_-]?key/i,
  /reset[_-]?token/i,
  /verification[_-]?token/i,
  /otp/i,
];

// Email addresses are PII; replace with a stable hash-like fingerprint.
const EMAIL_RE = /([A-Za-z0-9._%+-]+)@([A-Za-z0-9.-]+\.[A-Za-z]{2,})/g;

const MAX_DEPTH = 6;
const MAX_STRING_LEN = 2000;

function shouldRedactKey(key: string): boolean {
  return REDACT_KEY_PATTERNS.some((p) => p.test(key));
}

function redactString(s: string): string {
  if (s.length > MAX_STRING_LEN) {
    s = s.slice(0, MAX_STRING_LEN) + `…[truncated ${s.length - MAX_STRING_LEN} chars]`;
  }
  return s.replace(EMAIL_RE, (_match, local, domain) => {
    const safeLocal = local.length <= 2 ? local : local[0] + "***";
    return `${safeLocal}@${domain}`;
  });
}

/**
 * Recursively walk a value and redact sensitive keys. Errors are converted to
 * `{ name, message, stack }` shape so they serialize cleanly.
 */
export function redact(value: unknown, depth = 0): unknown {
  if (value == null) return value;
  if (depth > MAX_DEPTH) return "[redact: max depth]";

  if (value instanceof Error) {
    return {
      name: value.name,
      message: redactString(value.message),
      stack: value.stack ? redactString(value.stack) : undefined,
    };
  }

  if (typeof value === "string") {
    return redactString(value);
  }

  if (typeof value !== "object") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((v) => redact(v, depth + 1));
  }

  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value)) {
    if (shouldRedactKey(k)) {
      out[k] = "[REDACTED]";
    } else {
      out[k] = redact(v, depth + 1);
    }
  }
  return out;
}

type LogLevel = "debug" | "info" | "warn" | "error";

function emit(level: LogLevel, message: string, meta?: unknown): void {
  const payload = meta === undefined ? "" : " " + JSON.stringify(redact(meta));
  // Prefix lets log aggregators filter by level even though we go through
  // console for now.
  const prefix = `[${level}]`;
  switch (level) {
    case "error":
      console.error(prefix, message + payload);
      break;
    case "warn":
      console.warn(prefix, message + payload);
      break;
    case "debug":
      if (process.env.NODE_ENV !== "production") {
        console.log(prefix, message + payload);
      }
      break;
    default:
      console.log(prefix, message + payload);
  }
}

export const logger = {
  debug: (msg: string, meta?: unknown) => emit("debug", msg, meta),
  info: (msg: string, meta?: unknown) => emit("info", msg, meta),
  warn: (msg: string, meta?: unknown) => emit("warn", msg, meta),
  error: (msg: string, meta?: unknown) => emit("error", msg, meta),
};
