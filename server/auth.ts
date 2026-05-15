import bcrypt from "bcryptjs";
import { createHash, randomBytes } from "crypto";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { storage } from "./storage";
import type { User } from "@shared/schema";
import { logger } from "./utils/logger";

const SALT_ROUNDS = 10;

// Password hashing utilities
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// Passport configuration
export function setupAuth() {
  // Local strategy: authenticate with email/password
  passport.use(
    new LocalStrategy(
      {
        usernameField: "email",
        passwordField: "password",
      },
      async (email, password, done) => {
        try {
          const user = await storage.getUserByEmail(email);
          
          if (!user) {
            return done(null, false, { message: "Invalid email or password" });
          }

          // Check if user has a password (OAuth users may not)
          if (!user.password) {
            return done(null, false, { message: "Invalid email or password" });
          }

          const isValid = await verifyPassword(password, user.password);
          
          if (!isValid) {
            return done(null, false, { message: "Invalid email or password" });
          }

          return done(null, user);
        } catch (error) {
          return done(error);
        }
      }
    )
  );

  // Serialize user to session
  passport.serializeUser((user: Express.User, done) => {
    done(null, (user as User).id);
  });

  // Deserialize user from session
  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await storage.getUser(id);
      done(null, user || null);
    } catch (error) {
      done(error);
    }
  });
}

// Middleware: require authentication
export function requireAuth(req: any, res: any, next: any) {
  if (req.isAuthenticated()) {
    return next();
  }
  return res.status(401).json({ message: "Authentication required" });
}

// Middleware: require specific role
export function requireRole(...allowedRoles: string[]) {
  return (req: any, res: any, next: any) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const user = req.user as User;
    if (!allowedRoles.includes(user.role)) {
      return res.status(403).json({ message: "Insufficient permissions" });
    }

    return next();
  };
}

// Middleware: require global admin
export const requireGlobalAdmin = requireRole("global_admin");

// Middleware: require company admin or global admin
export const requireCompanyAdmin = requireRole("global_admin", "company_admin");

// Middleware: require facilitator, company admin, or global admin
export const requireFacilitator = requireRole("global_admin", "company_admin", "facilitator");

/**
 * Hash a plaintext API key using SHA-256 so we never store the raw secret.
 */
export function hashApiKey(plaintext: string): string {
  return createHash("sha256").update(plaintext).digest("hex");
}

/**
 * Generate a cryptographically random API key in the format nebula_<48 hex chars>.
 * Returns { plaintext, hash } — the plaintext is shown once; only the hash is persisted.
 */
export function generateApiKey(): { plaintext: string; hash: string } {
  const plaintext = "nebula_" + randomBytes(24).toString("hex");
  return { plaintext, hash: hashApiKey(plaintext) };
}

/**
 * Express middleware that authenticates a request using an Organisation API key.
 * Reads the Bearer token from Authorization header, hashes it, looks up the
 * matching active key row, and attaches { organisationId, apiKeyId } to req for
 * downstream use.  Returns 401 on any failure.
 */
export function requireApiKey(req: any, res: any, next: any) {
  const authHeader = req.headers?.authorization as string | undefined;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing or invalid Authorization header" });
  }

  const plaintext = authHeader.slice("Bearer ".length).trim();
  if (!plaintext) {
    return res.status(401).json({ error: "Empty API key" });
  }

  const keyHash = hashApiKey(plaintext);

  storage.getOrganisationApiKeyByHash(keyHash).then(async (keyRow) => {
    if (!keyRow) {
      return res.status(401).json({ error: "Invalid or revoked API key" });
    }
    req.apiOrganisationId = keyRow.organisationId;
    req.apiKeyId = keyRow.id;
    req.apiKeyIsUmbrella = keyRow.isUmbrella;
    // Update lastUsedAt asynchronously (fire-and-forget)
    storage.touchOrganisationApiKey(keyRow.id).catch(() => {});
    next();
  }).catch((err: unknown) => {
    logger.error("requireApiKey DB lookup failed", { error: err });
    res.status(500).json({ error: "Internal server error" });
  });
}
