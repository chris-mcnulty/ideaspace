import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import type { IncomingMessage, ServerResponse } from "http";
import type { RequestHandler } from "express";
import { pool } from "./db";

const PgStore = connectPgSimple(session);

// Resolve the session secret with a fail-fast policy in production. The
// previous default ("nebula-session-secret-change-in-production") would let an
// unconfigured deploy boot with a known-public secret, allowing trivial
// session forgery. Refuse to start in production if the env var is missing.
function resolveSessionSecret(): string {
  const envSecret = process.env.SESSION_SECRET?.trim();
  if (envSecret && envSecret.length >= 32) return envSecret;

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "SESSION_SECRET is required in production and must be at least 32 chars",
    );
  }

  console.warn(
    "[session] SESSION_SECRET is missing or weak; using a development-only fallback. Set SESSION_SECRET in production.",
  );
  return "nebula-dev-session-secret-not-for-production-use-32chars";
}

export const sessionMiddleware: RequestHandler = session({
  store: new PgStore({
    pool: pool,
    tableName: "session",
    createTableIfMissing: true,
  }),
  secret: resolveSessionSecret(),
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: "lax",
    maxAge: 30 * 24 * 60 * 60 * 1000,
  },
});

type SessionRunner = (
  req: IncomingMessage,
  res: ServerResponse,
  next: (err?: unknown) => void
) => void;

/**
 * Resolve the authenticated user id for a raw HTTP/WS upgrade request by
 * running the same express-session middleware used by the HTTP app.
 * Returns null when no valid session exists.
 */
export function getUserIdFromUpgradeRequest(
  req: IncomingMessage
): Promise<string | null> {
  return new Promise((resolve) => {
    // The same middleware handler can be invoked on a bare IncomingMessage —
    // it only reads cookies and writes session into the request object.
    const runSession = sessionMiddleware as unknown as SessionRunner;
    const stubRes = {
      getHeader: () => undefined,
      setHeader: () => {},
      end: () => {},
      on: () => {},
      once: () => {},
      emit: () => false,
    } as unknown as ServerResponse;

    runSession(req, stubRes, () => {
      const session = (req as IncomingMessage & {
        session?: { passport?: { user?: string } };
      }).session;
      const userId = session?.passport?.user;
      resolve(typeof userId === "string" ? userId : null);
    });
  });
}
