import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import type { IncomingMessage, ServerResponse } from "http";
import type { RequestHandler } from "express";
import { pool } from "./db";

const PgStore = connectPgSimple(session);

export const sessionMiddleware: RequestHandler = session({
  store: new PgStore({
    pool: pool,
    tableName: "session",
    createTableIfMissing: true,
  }),
  secret: process.env.SESSION_SECRET || "nebula-session-secret-change-in-production",
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
