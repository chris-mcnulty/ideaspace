import { z } from "zod";

/**
 * Shared Zod schemas for HTTP query-parameter parsing. Replaces ad-hoc
 * parseInt/typeof checks with explicit validation that returns 400 on bad
 * input rather than silently producing NaN downstream.
 */

const intFromQuery = (opts: { min?: number; max?: number; default: number }) =>
  z
    .union([z.string(), z.number(), z.undefined()])
    .transform((v) => (v === undefined || v === "" ? undefined : Number(v)))
    .refine(
      (n) => n === undefined || (Number.isFinite(n) && Number.isInteger(n)),
      { message: "must be an integer" },
    )
    .refine(
      (n) =>
        n === undefined ||
        ((opts.min === undefined || n >= opts.min) &&
          (opts.max === undefined || n <= opts.max)),
      { message: `must be in range [${opts.min ?? "-∞"}, ${opts.max ?? "∞"}]` },
    )
    .transform((n): number => (n === undefined ? opts.default : n));

/** Pagination: page (1-based), limit (default 20, max 100). */
export const paginationQuerySchema = z.object({
  page: intFromQuery({ min: 1, max: 1_000_000, default: 1 }),
  limit: intFromQuery({ min: 1, max: 100, default: 20 }),
});
export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

/** Notifications listing: only limit, narrower max. */
export const notificationListQuerySchema = z.object({
  limit: intFromQuery({ min: 1, max: 100, default: 30 }),
});

/** Knowledge base search query. */
export const kbSearchQuerySchema = z.object({
  q: z
    .union([z.string(), z.undefined()])
    .transform((s) => (s ?? "").trim().slice(0, 500)),
  scope: z.enum(["system", "organization", "workspace"]).default("system"),
  scopeId: z.string().uuid().optional(),
  limit: intFromQuery({ min: 1, max: 20, default: 8 }),
});

/** Boolean-from-query helper for routes that previously did `=== 'true'`. */
export const boolFromQuery = z
  .union([z.string(), z.boolean(), z.undefined()])
  .transform((v) => {
    if (v === undefined) return false;
    if (typeof v === "boolean") return v;
    return v === "true" || v === "1";
  });

/** Optional UUID — used for ?organizationId=, ?projectId=, etc. */
export const optionalUuid = z
  .union([z.string(), z.undefined()])
  .transform((s) => (s && s.length > 0 ? s : undefined))
  .pipe(z.string().uuid().optional());

/** Optional domain string — used for galaxy reports. */
export const optionalDomain = z
  .union([z.string(), z.undefined()])
  .transform((s) => (s ?? "").trim().toLowerCase())
  .refine((s) => s.length === 0 || /^[a-z0-9.-]{1,253}$/.test(s), {
    message: "invalid domain",
  })
  .transform((s) => (s.length === 0 ? undefined : s));

/**
 * Validate a `returnTo` query parameter to prevent open-redirect attacks.
 * Only relative paths under `/` are allowed; absolute URLs, protocol-relative
 * URLs, and paths containing CR/LF (header smuggling) are rejected.
 *
 * Returns a safe path string or the provided fallback.
 */
export function safeReturnTo(
  value: unknown,
  fallback: string = "/",
): string {
  if (typeof value !== "string") return fallback;
  const v = value.trim();
  if (v.length === 0 || v.length > 2048) return fallback;
  // Disallow CR/LF (header injection) and tabs.
  if (/[\r\n\t]/.test(v)) return fallback;
  // Must start with a single "/" but not "//" (protocol-relative URL) and
  // must not contain a backslash (Windows-style trick) or scheme.
  if (!v.startsWith("/")) return fallback;
  if (v.startsWith("//") || v.startsWith("/\\")) return fallback;
  if (/^\/[a-zA-Z][a-zA-Z0-9+.-]*:/.test(v)) return fallback;
  return v;
}

/**
 * Helper that parses `req.query` with a schema and either returns the parsed
 * value or sends a 400 with details. Returns null if it already sent a
 * response so the caller can `return` immediately.
 */
import type { Request, Response } from "express";
export function parseQuery<T extends z.ZodTypeAny>(
  schema: T,
  req: Request,
  res: Response,
): z.infer<T> | null {
  const result = schema.safeParse(req.query);
  if (!result.success) {
    res.status(400).json({
      error: "Invalid query parameters",
      details: result.error.issues.map((i) => ({
        path: i.path.join("."),
        message: i.message,
      })),
    });
    return null;
  }
  return result.data;
}
