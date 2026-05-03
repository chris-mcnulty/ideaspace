import express, { type Request, Response, NextFunction } from "express";
import passport from "passport";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { setupAuth } from "./auth";
import { ensureUploadDirs } from "./middleware/uploadMiddleware";
import { pool } from "./db";
import { sessionMiddleware } from "./session";
import { runStartupMigrations } from "./migrations";

const app = express();

// Trust entire proxy chain (required for secure cookies behind Replit's reverse proxy)
app.set('trust proxy', true);

declare module 'http' {
  interface IncomingMessage {
    rawBody: unknown
  }
}
app.use(express.json({
  verify: (req, _res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: false }));

// Session configuration imported from ./session so the same middleware can be
// reused for WebSocket upgrade authentication.
app.use(sessionMiddleware);

// Initialize passport and session support
app.use(passport.initialize());
app.use(passport.session());

// Setup passport authentication strategies
setupAuth();

// Slow-handler timing middleware: in non-production, log API requests that
// take longer than SLOW_HANDLER_MS (default 200ms) so performance regressions
// are visible during development without flooding logs in production.
const SLOW_HANDLER_MS = parseInt(process.env.SLOW_HANDLER_MS || "200", 10);
app.use((req, res, next) => {
  if (process.env.NODE_ENV === "production") {
    return next();
  }
  const start = Date.now();
  const path = req.path;

  res.on("finish", () => {
    if (!path.startsWith("/api")) return;
    const duration = Date.now() - start;
    if (duration >= SLOW_HANDLER_MS) {
      log(`SLOW ${req.method} ${path} ${res.statusCode} in ${duration}ms`);
    }
  });

  next();
});

(async () => {
  // Ensure upload directories exist before starting
  try {
    await ensureUploadDirs();
    console.log('Upload directories initialized');
  } catch (error) {
    console.error('Failed to create upload directories:', error);
    process.exit(1);
  }
  
  // Run startup DB migrations (idempotent) before serving traffic
  try {
    await runStartupMigrations();
  } catch (error) {
    console.error("Failed to run startup migrations:", error);
  }

  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
})();
