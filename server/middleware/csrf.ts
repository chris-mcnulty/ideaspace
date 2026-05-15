import type { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import { logger } from "../utils/logger";

/**
 * Double-submit-cookie CSRF protection.
 *
 * Operating modes (controlled by CSRF_MODE):
 *   - "off"     — middleware is a no-op. Default until clients are migrated.
 *   - "report"  — sets/refreshes the cookie, logs violations, but does not block requests.
 *                Use this in staging to surface clients that still need updating.
 *   - "enforce" — sets the cookie and rejects mutating requests with a missing/mismatched token.
 *
 * The token cookie is intentionally NOT HttpOnly so the client can read it
 * and echo it back in the X-CSRF-Token header on mutating requests. Cookie
 * is SameSite=Lax + Secure (in production) so it cannot be read by other
 * origins.
 *
 * Routes can opt out with `req.skipCsrf = true` (set by an earlier
 * middleware) — intended for webhooks and 3rd-party-call paths only.
 */

export const CSRF_COOKIE = "csrf-token";
export const CSRF_HEADER = "x-csrf-token";

type CsrfMode = "off" | "report" | "enforce";

function readMode(): CsrfMode {
  const raw = (process.env.CSRF_MODE || "off").toLowerCase();
  if (raw === "report" || raw === "enforce") return raw;
  return "off";
}

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

// Allowlist of paths that legitimately cannot send CSRF tokens (webhooks,
// third-party callbacks). Keep this list minimal.
const CSRF_PATH_ALLOWLIST: RegExp[] = [
  /^\/auth\/callback$/,        // OAuth provider callback (GET/redirect)
  /^\/auth\/entra\/callback$/, // Entra callback (GET/redirect)
];

function isAllowlisted(req: Request): boolean {
  if ((req as Request & { skipCsrf?: boolean }).skipCsrf) return true;
  return CSRF_PATH_ALLOWLIST.some((re) => re.test(req.path));
}

function generateToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

/**
 * Constant-time string compare. Throws on length mismatch — caller should
 * length-check first.
 */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch {
    return false;
  }
}

function readCookie(req: Request, name: string): string | undefined {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return undefined;
  for (const part of cookieHeader.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k === name) {
      // Malformed percent-encoding from an attacker-controlled cookie would
      // throw URIError and could crash the request. Treat decode failures as
      // a missing cookie.
      try {
        return decodeURIComponent(rest.join("="));
      } catch {
        return undefined;
      }
    }
  }
  return undefined;
}

function setTokenCookie(res: Response, token: string): void {
  const isProd = process.env.NODE_ENV === "production";
  const attrs = [
    `${CSRF_COOKIE}=${encodeURIComponent(token)}`,
    "Path=/",
    "SameSite=Lax",
    `Max-Age=${30 * 24 * 60 * 60}`,
    isProd ? "Secure" : "",
  ].filter(Boolean);
  // Append rather than overwrite so we don't clobber session cookies.
  const existing = res.getHeader("Set-Cookie");
  const value = attrs.join("; ");
  if (Array.isArray(existing)) {
    res.setHeader("Set-Cookie", [...existing, value]);
  } else if (typeof existing === "string") {
    res.setHeader("Set-Cookie", [existing, value]);
  } else {
    res.setHeader("Set-Cookie", value);
  }
}

export function csrfMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const mode = readMode();

  // Always ensure a token cookie exists so clients can read it eagerly. This
  // is cheap and lets the client populate the header even before mode flips
  // to "enforce".
  let token = readCookie(req, CSRF_COOKIE);
  if (!token || token.length < 32) {
    token = generateToken();
    setTokenCookie(res, token);
  }

  if (mode === "off") return next();
  if (SAFE_METHODS.has(req.method)) return next();
  if (isAllowlisted(req)) return next();

  const provided =
    (req.headers[CSRF_HEADER] as string | undefined) ||
    (req.headers[CSRF_HEADER.toUpperCase()] as string | undefined);

  const ok = !!provided && safeEqual(provided, token);

  if (!ok) {
    logger.warn("CSRF token mismatch", {
      method: req.method,
      path: req.path,
      hasHeader: !!provided,
      mode,
    });
    if (mode === "enforce") {
      res.status(403).json({ error: "Invalid or missing CSRF token" });
      return;
    }
  }

  next();
}

/**
 * Endpoint that returns the current CSRF token. Useful for clients that
 * cannot read cookies directly (e.g. cross-subdomain SPAs, mobile clients).
 * In a normal SPA flow the cookie is read directly and this endpoint is
 * unused.
 */
export function csrfTokenHandler(req: Request, res: Response): void {
  let token = readCookie(req, CSRF_COOKIE);
  if (!token || token.length < 32) {
    token = generateToken();
    setTokenCookie(res, token);
  }
  res.json({ csrfToken: token });
}
