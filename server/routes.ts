import type { Express, Request as ExpressRequest, Response as ExpressResponse, NextFunction } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import passport from "passport";
import multer from "multer";
import { storage } from "./storage";
import { getUserIdFromUpgradeRequest } from "./session";
import oauthRoutes from "./routes/auth-oauth";
import entraRoutes from "./routes/auth-entra";
import { db } from "./db";
import { insertOrganizationSchema, insertSpaceSchema, createSpaceApiSchema, insertParticipantSchema, insertCategorySchema, insertNoteSchema, insertVoteSchema, insertRankingSchema, insertUserSchema, insertKnowledgeBaseDocumentSchema, type User, type Space, type InsertSpace, organizations, users, companyAdmins as companyAdminsTable, knowledgeBaseDocuments, workspaceTemplates, workspaceTemplateNotes, aiUsageLog, insertIdeaSchema, insertWorkspaceModuleSchema, insertWorkspaceModuleRunSchema, insertPriorityMatrixSchema, insertPriorityMatrixPositionSchema, insertStaircaseModuleSchema, insertStaircasePositionSchema, projectMembers, categories, notes, participants, projects, spaces } from "@shared/schema";
import { CSV_IMPORT_TYPES, csvConfirmTemplatesBodySchema, csvConfirmUsersBodySchema, csvConfirmIdeasBodySchema, type CsvImportType, type TemplateCsvRow, type UserCsvRow, type IdeaCsvRow } from "@shared/csvImport";
import { buildCsvPreview, buildErrorReportCsv } from "./services/csvImport";
import { uploadImage, validateImageFile, cleanupTempFile } from "./middleware/uploadMiddleware";
import { processUploadedImage } from "./utils/contentUtils";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { categorizeNotes, rewriteCard, suggestIdeas } from "./services/openai";
import { getNextPair, calculateProgress } from "./services/pairwise";
import { validateRanking, calculateBordaScores, calculateRankingProgress, hasParticipantCompleted } from "./services/stack-ranking";
import { validateAllocation, calculateMarketplaceScores, calculateAllocationProgress, hasParticipantCompleted as hasParticipantCompletedAllocation, getParticipantRemainingBudget, DEFAULT_COIN_BUDGET } from "./services/marketplace";
import { generatePairwiseExport, generateStackRankingExport, generateMarketplaceExport } from "./services/export";
import { generateCohortResults, generatePersonalizedResults, generateAllPersonalizedResults, getCurrentCohortInputsHash, getCurrentPersonalizedInputsHash } from "./services/results";
import { hashPassword, requireAuth, requireRole, requireGlobalAdmin, requireCompanyAdmin, requireFacilitator } from "./auth";
import { generateWorkspaceCode, isValidWorkspaceCode } from "./services/workspace-code";
import { sendAccessRequestEmail, sendEmailVerification, sendPasswordReset, sendSessionInviteEmail, sendPhaseChangeNotificationEmail, sendResultsAvailableEmail, sendBulkNotifications, type SessionInviteEmailData, type PhaseChangeEmailData, type ResultsReadyEmailData } from "./services/email";
import { createImportJob, getImportJob, markJobRunning, recordJobSuccess, recordJobFailure, finishJob } from "./services/importJobs";
import { randomBytes } from "crypto";
import { fileUploadService } from "./services/file-upload";
import { extractAndChunk } from "./services/kbExtraction";
import { getPresenceForSpace, buildPresenceChangedMessage, type PresenceWsMeta } from "./presence";
import { registerPulseRoute } from "./routes/pulse";

// Extend express-session types to include participantId
declare module "express-session" {
  interface SessionData {
    participantId?: string;
  }
}

// Helper function to resolve workspace identifier (code or UUID) to UUID
async function resolveWorkspaceIdentifier(identifier: string): Promise<string | null> {
  // Match 8-digit codes with or without hyphen: nnnnnnnn or nnnn-nnnn
  const isWorkspaceCode = /^\d{8}$/.test(identifier) || /^\d{4}-\d{4}$/.test(identifier);
  
  if (isWorkspaceCode) {
    const space = await storage.getSpaceByCode(identifier);
    return space?.id || null;
  }
  
  // Already a UUID or other ID format
  return identifier;
}

// Helper function to check if workspace status indicates it's open for participation
// Uses prefix matching to handle variants like "ideation-live", "vote-round1", etc.
function isWorkspaceOpenForParticipation(status: string): boolean {
  if (!status) return false;
  
  const normalized = status.toLowerCase().trim();
  
  // Exact lifecycle statuses
  if (normalized === 'open') return true;
  
  // Closed/draft/archived are not open
  if (['closed', 'draft', 'processing', 'archived'].includes(normalized)) return false;
  
  // Check active session phase prefixes
  const activePhrasePrefixes = [
    'ideation', 'ideate', 
    'voting', 'vote', 
    'ranking', 'rank', 
    'marketplace', 'market',
    'survey', 
    'priority-matrix', 'priority', 
    'staircase',
    'results'
  ];
  
  return activePhrasePrefixes.some(prefix => normalized.startsWith(prefix));
}

// Middleware factory to check workspace access based on status and guest permissions
function createWorkspaceAccessMiddleware(options: {
  allowClosed?: boolean;  // Allow access even if workspace is closed (for results with resultsPublicAfterClose)
  requireOpen?: boolean;  // Require workspace to be open
}) {
  return async (req: ExpressRequest, res: ExpressResponse, next: NextFunction) => {
    try {
      const rawSpaceId = req.params.spaceId || req.params.space || (req.body as any)?.spaceId;
      if (!rawSpaceId) {
        return res.status(400).json({ error: "Workspace ID required" });
      }

      // Resolve workspace code to UUID if needed
      const spaceId = await resolveWorkspaceIdentifier(rawSpaceId);
      if (!spaceId) {
        return res.status(404).json({ error: "Workspace not found" });
      }

      // Store resolved UUID back so route handlers get the real ID
      if (req.params.spaceId) req.params.spaceId = spaceId;
      if (req.params.space) req.params.space = spaceId;

      const space = await storage.getSpace(spaceId);
      if (!space) {
        return res.status(404).json({ error: "Workspace not found" });
      }

      // Check if user is authenticated (admin/facilitator/project member)
      const currentUser = req.user as User | undefined;
      let isAdmin = false;
      let isFacilitator = false;
      let isProjectMember = false;

      if (currentUser) {
        if (currentUser.role === 'global_admin') {
          isAdmin = true;
        } else if (currentUser.role === 'company_admin' && currentUser.organizationId === space.organizationId) {
          isAdmin = true;
        } else {
          const facilitators = await storage.getSpaceFacilitatorsBySpace(spaceId);
          isFacilitator = facilitators.some(f => f.userId === currentUser.id);
          
          // Check project membership for non-admin/non-facilitator authenticated users
          if (!isFacilitator && space.projectId) {
            isProjectMember = await storage.isProjectMember(space.projectId, currentUser.id);
          }
        }
      }

      // Admins and facilitators bypass all restrictions
      if (isAdmin || isFacilitator) {
        return next();
      }
      
      // Authenticated users who are project members get access (but still subject to status checks below)
      // Non-project members will fall through to guest access checks

      // Check workspace status
      if (space.status === 'closed') {
        // If workspace is closed, check if results are allowed to be public
        if (options.allowClosed && space.resultsPublicAfterClose) {
          // Allow access to results even when closed
          return next();
        }
        // Otherwise block access
        return res.status(403).json({ 
          error: "This workspace is closed",
          code: "WORKSPACE_CLOSED"
        });
      }

      // Check if workspace is open for participation using robust prefix matching
      if (options.requireOpen && !isWorkspaceOpenForParticipation(space.status)) {
        return res.status(403).json({ 
          error: "This workspace is not currently open for participation",
          code: "WORKSPACE_NOT_OPEN"
        });
      }

      // Check guest access
      const participantId = req.session?.participantId;
      if (!participantId) {
        // No participant session - check if authenticated user is project member
        if (isProjectMember) {
          // Project members can access without participant session
          return next();
        }
        
        // Not a project member - check if guest access is allowed
        if (!space.guestAllowed) {
          return res.status(403).json({ 
            error: "Guest access is not allowed for this workspace",
            code: "GUEST_ACCESS_DISABLED"
          });
        }
      } else {
        // Has participant session - verify they're in this workspace
        const participant = await storage.getParticipant(participantId);
        if (!participant || participant.spaceId !== spaceId) {
          // Check if authenticated user is project member (fallback)
          if (isProjectMember) {
            return next();
          }
          return res.status(403).json({ 
            error: "You do not have access to this workspace",
            code: "NO_ACCESS"
          });
        }

        // Check if guest user trying to access workspace where guests aren't allowed
        if (participant.isGuest && !space.guestAllowed && !isProjectMember) {
          return res.status(403).json({ 
            error: "Guest access has been disabled for this workspace",
            code: "GUEST_ACCESS_REVOKED"
          });
        }
      }

      next();
    } catch (error) {
      console.error("Workspace access check failed:", error);
      res.status(500).json({ error: "Failed to verify workspace access" });
    }
  };
}

// Helper: verifies the authenticated user is allowed to facilitate the given
// space. A user qualifies if they are global_admin, the matching company_admin
// for the owning org, or have an explicit space_facilitators row for the space.
// Returns true on success and writes a 401/403/404 response and returns false
// otherwise. Centralizes the workspace-scoped facilitator check used by AI/
// mutating endpoints so we don't rely on requireFacilitator alone (which only
// checks role and would let a facilitator from another org call into any
// workspace by guessing its id).
async function assertFacilitatorForSpace(
  req: ExpressRequest,
  res: ExpressResponse,
  space: Space
): Promise<boolean> {
  const user = req.user as User | undefined;
  if (!user) {
    res.status(401).json({ error: "Authentication required" });
    return false;
  }
  if (user.role === 'global_admin') return true;
  // Company-admin access: the user.organizationId shortcut OR an explicit
  // company_admins association row for the owning org. This matches the
  // pattern used elsewhere in routes.ts (see getCompanyAdminsByUser usages).
  if (space.organizationId) {
    if (user.role === 'company_admin' && user.organizationId === space.organizationId) {
      return true;
    }
    const companyAdmins = await storage.getCompanyAdminsByUser(user.id);
    if (companyAdmins.some(ca => ca.organizationId === space.organizationId)) {
      return true;
    }
  }
  const facilitators = await storage.getSpaceFacilitatorsBySpace(space.id);
  if (facilitators.some(f => f.userId === user.id)) return true;
  res.status(403).json({ error: "Not authorized for this workspace" });
  return false;
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Register OAuth routes
  app.use(oauthRoutes);
  
  // Register Microsoft Entra ID SSO routes
  app.use(entraRoutes);
  
  // Configure multer for file uploads (max 10MB)
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB
    },
    fileFilter: (req, file, cb) => {
      // Allow common document types and CSV
      const allowedMimes = [
        'application/pdf',
        'text/plain',
        'text/csv',
        'application/csv',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      ];
      
      if (allowedMimes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error('Invalid file type. Only PDF, TXT, CSV, DOC, DOCX, XLS, XLSX are allowed.'));
      }
    },
  });

  // Helper function to resolve workspace identifier (code or UUID) to UUID
  async function resolveWorkspaceId(identifier: string): Promise<string | null> {
    return resolveWorkspaceIdentifier(identifier);
  }

  // Simple in-memory token-bucket rate limiter for the public client-error
  // telemetry endpoint. Keyed by client IP; window resets every 60s.
  const clientErrorRateLimiter = new Map<string, { count: number; windowStart: number }>();
  const CLIENT_ERROR_WINDOW_MS = 60_000;
  const CLIENT_ERROR_MAX_PER_WINDOW = 30;

  // Client-side error telemetry endpoint. Public so unauthenticated users can
  // also report errors (e.g. on the landing page). Protected against abuse by
  // payload-size validation (Zod max lengths) AND a per-IP rate limit.
  app.post("/api/client-errors", async (req, res) => {
    // Use Express' trusted req.ip (resolved via the `trust proxy` setting)
    // rather than raw x-forwarded-for to prevent header-spoofed rate-limit bypass.
    const ip = req.ip || req.socket.remoteAddress || "unknown";

    // Rate limit check
    const now = Date.now();
    const bucket = clientErrorRateLimiter.get(ip);
    if (!bucket || now - bucket.windowStart > CLIENT_ERROR_WINDOW_MS) {
      clientErrorRateLimiter.set(ip, { count: 1, windowStart: now });
    } else {
      bucket.count += 1;
      if (bucket.count > CLIENT_ERROR_MAX_PER_WINDOW) {
        return res.status(429).json({ error: "Too many error reports" });
      }
    }

    // Best-effort cleanup so the map doesn't grow unbounded
    if (clientErrorRateLimiter.size > 5000) {
      for (const [key, value] of Array.from(clientErrorRateLimiter.entries())) {
        if (now - value.windowStart > CLIENT_ERROR_WINDOW_MS) {
          clientErrorRateLimiter.delete(key);
        }
      }
    }

    try {
      const schema = z.object({
        scope: z.string().max(100).optional(),
        message: z.string().max(2000),
        stack: z.string().max(10000).optional().nullable(),
        componentStack: z.string().max(10000).optional().nullable(),
        route: z.string().max(500).optional().nullable(),
        userAgent: z.string().max(500).optional().nullable(),
      });
      const data = schema.parse(req.body ?? {});
      const user = req.user as User | undefined;
      const userId = user?.id ?? null;
      const participantId = req.session?.participantId ?? null;

      // Structured log line via the same console transport used by the rest
      // of the server. Sensitive PII is not included beyond the user/participant id.
      console.error("[client-error]", JSON.stringify({
        scope: data.scope ?? "unknown",
        route: data.route ?? null,
        userId,
        participantId,
        message: data.message,
        userAgent: data.userAgent ?? null,
        ip,
        at: new Date().toISOString(),
      }));

      // Persist a lightweight record for later analysis. Failures here never
      // impact the response — telemetry must never break the client.
      try {
        await storage.createClientError({
          scope: data.scope ?? null,
          message: data.message,
          stack: data.stack ?? null,
          componentStack: data.componentStack ?? null,
          route: data.route ?? null,
          userAgent: data.userAgent ?? null,
          userId,
          participantId,
          ipAddress: ip,
        });
      } catch (persistError) {
        console.error("Failed to persist client error record:", persistError);
      }

      res.status(204).send();
    } catch (error) {
      // Never let telemetry failures impact the client; log and 204
      console.error("Failed to record client error:", error);
      res.status(204).send();
    }
  });

  // Workspace code lookup (public endpoint for entry flow)
  app.get("/api/spaces/lookup/:code", async (req, res) => {
    try {
      const code = req.params.code;
      
      if (!isValidWorkspaceCode(code)) {
        return res.status(400).json({ error: "Invalid workspace code format" });
      }
      
      const space = await storage.getSpaceByCode(code);
      if (!space) {
        return res.status(404).json({ error: "Workspace not found" });
      }
      
      // Get organization details
      const org = await storage.getOrganization(space.organizationId);
      
      res.json({
        space,
        organization: org,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to lookup workspace" });
    }
  });

  // Authentication endpoints
  // Public registration - always creates standard users
  app.post("/api/auth/register", async (req, res) => {
    try {
      // Only accept email, username, password, displayName from public registration
      const publicSchema = z.object({
        email: z.string().email(),
        username: z.string().min(3),
        password: z.string().min(8),
        displayName: z.string().optional(),
      });
      
      const data = publicSchema.parse(req.body);
      
      // Check if user already exists
      const existingUser = await storage.getUserByEmail(data.email);
      if (existingUser) {
        return res.status(400).json({ error: "User with this email already exists" });
      }
      
      // Hash password before storing
      const hashedPassword = await hashPassword(data.password);
      
      // Always create as standard user (no role elevation via public endpoint)
      const user = await storage.createUser({
        ...data,
        password: hashedPassword,
        role: "user", // Force standard user role
        organizationId: null,
        emailVerified: false, // Start as unverified
      });
      
      // Generate email verification token
      const verificationToken = randomBytes(32).toString('hex');
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24); // Token expires in 24 hours
      
      await storage.createEmailVerificationToken({
        userId: user.id,
        token: verificationToken,
        expiresAt,
      });
      
      // Send verification email
      try {
        const baseUrl = req.get('origin') || 'http://localhost:5000';
        const verificationUrl = `${baseUrl}/verify-email?token=${verificationToken}`;
        
        await sendEmailVerification(user.email, {
          username: user.displayName || user.username,
          verificationUrl,
        });
      } catch (emailError) {
        console.error("Failed to send verification email:", emailError);
        // Don't fail registration if email fails
      }
      
      // Link any orphaned guest participants with this email
      try {
        const orphanedParticipants = await storage.findOrphanedParticipantsByEmail(data.email);
        for (const participant of orphanedParticipants) {
          await storage.linkParticipantToUser(participant.id, user.id);
        }
      } catch (linkError) {
        console.error("Failed to link orphaned participants:", linkError);
        // Don't fail registration if linking fails
      }
      
      // Remove password from response
      const { password, ...userWithoutPassword } = user;
      res.status(201).json({ 
        ...userWithoutPassword,
        message: "Registration successful! Please check your email to verify your account."
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to register user" });
    }
  });

  // Protected: Admin endpoint for creating users with elevated roles
  app.post("/api/admin/users", requireCompanyAdmin, async (req, res) => {
    try {
      const data = insertUserSchema.parse(req.body);
      const currentUser = req.user as User;
      
      // Check if user already exists
      const existingUser = await storage.getUserByEmail(data.email);
      if (existingUser) {
        return res.status(400).json({ error: "User with this email already exists" });
      }
      
      // Authorization checks based on current user role
      if (currentUser.role === "company_admin") {
        // Company admins can only create users/facilitators within their organization
        if (data.role === "global_admin" || data.role === "company_admin") {
          return res.status(403).json({ error: "Company admins cannot create admin users" });
        }
        if (data.organizationId !== currentUser.organizationId) {
          return res.status(403).json({ error: "Company admins can only create users in their own organization" });
        }
      }
      // Global admins can create any user type (no restrictions)
      
      // Hash password before storing
      const hashedPassword = await hashPassword(data.password);
      const user = await storage.createUser({
        ...data,
        password: hashedPassword,
      });
      
      // Assign user to organization's default project (if organization exists)
      if (user.organizationId) {
        try {
          const orgProjects = await storage.getProjectsByOrganization(user.organizationId);
          const defaultProject = orgProjects.find(p => p.isDefault) || orgProjects[0];
          if (defaultProject) {
            const memberRole = data.role === 'company_admin' ? 'admin' : 'member';
            await storage.addProjectMember(defaultProject.id, user.id, memberRole);
          }
        } catch (projError) {
          console.error("Failed to add user to default project:", projError);
          // Don't fail user creation if project assignment fails
        }
      }
      
      // Remove password from response
      const { password, ...userWithoutPassword } = user;
      res.status(201).json(userWithoutPassword);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to create user" });
    }
  });

  // Protected: Update user (company/global admin only)
  app.patch("/api/admin/users/:id", requireCompanyAdmin, async (req, res) => {
    try {
      const currentUser = req.user as User;
      const targetUserId = req.params.id;
      
      // Get the target user first
      const targetUser = await storage.getUser(targetUserId);
      if (!targetUser) {
        return res.status(404).json({ error: "User not found" });
      }
      
      // Authorization checks
      if (currentUser.role === "company_admin") {
        // Company admins can only update users in their organization
        if (targetUser.organizationId !== currentUser.organizationId) {
          return res.status(403).json({ error: "Cannot update users from other organizations" });
        }
        // Company admins cannot elevate users to admin roles
        if (req.body.role && (req.body.role === "global_admin" || req.body.role === "company_admin")) {
          return res.status(403).json({ error: "Company admins cannot assign admin roles" });
        }
      }
      
      // Parse and validate update data (password not allowed here - use reset-password endpoint)
      const updateSchema = insertUserSchema.partial().omit({ password: true });
      const data = updateSchema.parse(req.body);
      
      const updatedUser = await storage.updateUser(targetUserId, data);
      if (!updatedUser) {
        return res.status(404).json({ error: "Failed to update user" });
      }
      
      // Remove password from response
      const { password, ...userWithoutPassword } = updatedUser;
      res.json(userWithoutPassword);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to update user" });
    }
  });

  // Protected: Delete user (company/global admin only)
  app.delete("/api/admin/users/:id", requireCompanyAdmin, async (req, res) => {
    try {
      const currentUser = req.user as User;
      const targetUserId = req.params.id;
      
      // Prevent self-deletion
      if (currentUser.id === targetUserId) {
        return res.status(400).json({ error: "Cannot delete your own account" });
      }
      
      // Get the target user first
      const targetUser = await storage.getUser(targetUserId);
      if (!targetUser) {
        return res.status(404).json({ error: "User not found" });
      }
      
      // Authorization checks
      if (currentUser.role === "company_admin") {
        // Company admins can only delete users in their organization
        if (targetUser.organizationId !== currentUser.organizationId) {
          return res.status(403).json({ error: "Cannot delete users from other organizations" });
        }
        // Company admins cannot delete admin users
        if (targetUser.role === "global_admin" || targetUser.role === "company_admin") {
          return res.status(403).json({ error: "Company admins cannot delete admin users" });
        }
      }
      
      const deleted = await storage.deleteUser(targetUserId);
      if (!deleted) {
        return res.status(404).json({ error: "Failed to delete user" });
      }
      
      res.status(204).send();
    } catch (error) {
      console.error("Failed to delete user:", error);
      res.status(500).json({ error: "Failed to delete user" });
    }
  });

  // Protected: Admin reset user password (company/global admin only)
  app.post("/api/admin/users/:id/reset-password", requireCompanyAdmin, async (req, res) => {
    try {
      const currentUser = req.user as User;
      const targetUserId = req.params.id;
      
      // Get the target user first
      const targetUser = await storage.getUser(targetUserId);
      if (!targetUser) {
        return res.status(404).json({ error: "User not found" });
      }
      
      // Authorization checks
      if (currentUser.role === "company_admin") {
        // Company admins can only reset passwords for users in their organization
        if (targetUser.organizationId !== currentUser.organizationId) {
          return res.status(403).json({ error: "Cannot reset password for users from other organizations" });
        }
        // Company admins cannot reset passwords for admin users
        if (targetUser.role === "global_admin" || targetUser.role === "company_admin") {
          return res.status(403).json({ error: "Company admins cannot reset admin passwords" });
        }
      }
      
      // Validate new password
      const { newPassword } = z.object({ 
        newPassword: z.string().min(8, "Password must be at least 8 characters") 
      }).parse(req.body);
      
      // Hash the new password
      const hashedPassword = await hashPassword(newPassword);
      
      // Update user password
      const updatedUser = await storage.updateUser(targetUserId, { password: hashedPassword });
      if (!updatedUser) {
        return res.status(404).json({ error: "Failed to reset password" });
      }
      
      res.json({ message: "Password reset successfully" });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      console.error("Failed to reset password:", error);
      res.status(500).json({ error: "Failed to reset password" });
    }
  });

  app.post("/api/auth/login", (req, res, next) => {
    passport.authenticate("local", (err: any, user: User | false, info: any) => {
      if (err) {
        return res.status(500).json({ error: "Authentication error" });
      }
      if (!user) {
        return res.status(401).json({ error: info?.message || "Invalid credentials" });
      }
      
      // Check if email is verified (only for standard users, admins bypass this check)
      if (user.role === "user" && !user.emailVerified) {
        return res.status(403).json({ 
          error: "Email not verified",
          message: "Please verify your email address before logging in. Check your inbox for the verification link.",
          emailVerified: false
        });
      }
      
      req.logIn(user, async (err) => {
        if (err) {
          return res.status(500).json({ error: "Login failed" });
        }
        
        // Link any orphaned guest participants with this email
        try {
          const orphanedParticipants = await storage.findOrphanedParticipantsByEmail(user.email);
          for (const participant of orphanedParticipants) {
            await storage.linkParticipantToUser(participant.id, user.id);
          }
        } catch (linkError) {
          console.error("Failed to link orphaned participants:", linkError);
          // Don't fail login if linking fails
        }
        
        // Remove password from response
        const { password, ...userWithoutPassword} = user;
        res.json(userWithoutPassword);
      });
    })(req, res, next);
  });

  app.post("/api/auth/logout", (req, res) => {
    req.logout((err) => {
      if (err) {
        return res.status(500).json({ error: "Logout failed" });
      }
      res.json({ message: "Logged out successfully" });
    });
  });

  app.get("/api/auth/me", (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    const user = req.user as User;
    const { password, ...userWithoutPassword } = user;
    res.json(userWithoutPassword);
  });

  // Email Verification Endpoints
  app.post("/api/auth/verify-email", async (req, res) => {
    try {
      const { token } = z.object({ token: z.string() }).parse(req.body);
      
      // Find the verification token
      const verificationToken = await storage.getEmailVerificationToken(token);
      if (!verificationToken) {
        return res.status(400).json({ error: "Invalid or expired verification token" });
      }
      
      // Check if token is expired
      if (new Date() > verificationToken.expiresAt) {
        await storage.deleteEmailVerificationToken(token);
        return res.status(400).json({ error: "Verification token has expired. Please request a new one." });
      }
      
      // Update user to verified
      await storage.updateUser(verificationToken.userId, { emailVerified: true });
      
      // Delete the used token
      await storage.deleteEmailVerificationToken(token);
      
      res.json({ message: "Email verified successfully! You can now log in." });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid request data" });
      }
      console.error("Email verification error:", error);
      res.status(500).json({ error: "Failed to verify email" });
    }
  });

  app.post("/api/auth/resend-verification", async (req, res) => {
    try {
      const { email } = z.object({ email: z.string().email() }).parse(req.body);
      
      // Find user by email
      const user = await storage.getUserByEmail(email);
      if (!user) {
        // Don't reveal if email exists or not
        return res.json({ message: "If that email is registered, a verification link has been sent." });
      }
      
      // Check if already verified
      if (user.emailVerified) {
        return res.status(400).json({ error: "Email is already verified" });
      }
      
      // Generate new verification token
      const verificationToken = randomBytes(32).toString('hex');
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24);
      
      await storage.createEmailVerificationToken({
        userId: user.id,
        token: verificationToken,
        expiresAt,
      });
      
      // Send verification email
      try {
        const baseUrl = req.get('origin') || 'http://localhost:5000';
        const verificationUrl = `${baseUrl}/verify-email?token=${verificationToken}`;
        
        await sendEmailVerification(user.email, {
          username: user.displayName || user.username,
          verificationUrl,
        });
      } catch (emailError) {
        console.error("Failed to send verification email:", emailError);
        return res.status(500).json({ error: "Failed to send verification email" });
      }
      
      res.json({ message: "Verification email sent. Please check your inbox." });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid email address" });
      }
      console.error("Resend verification error:", error);
      res.status(500).json({ error: "Failed to resend verification email" });
    }
  });

  // Password Reset Endpoints
  app.post("/api/auth/request-password-reset", async (req, res) => {
    try {
      const { email } = z.object({ email: z.string().email() }).parse(req.body);
      
      // Find user by email
      const user = await storage.getUserByEmail(email);
      if (!user) {
        // Don't reveal if email exists or not (security best practice)
        return res.json({ message: "If that email is registered, a password reset link has been sent." });
      }
      
      // Generate password reset token
      const resetToken = randomBytes(32).toString('hex');
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 1); // Token expires in 1 hour
      
      await storage.createPasswordResetToken({
        userId: user.id,
        token: resetToken,
        expiresAt,
        used: false,
      });
      
      // Send password reset email
      try {
        const baseUrl = req.get('origin') || 'http://localhost:5000';
        const resetUrl = `${baseUrl}/reset-password?token=${resetToken}`;
        
        await sendPasswordReset(user.email, {
          username: user.displayName || user.username,
          resetUrl,
        });
      } catch (emailError) {
        console.error("Failed to send password reset email:", emailError);
        return res.status(500).json({ error: "Failed to send password reset email" });
      }
      
      res.json({ message: "Password reset link sent. Please check your email." });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid email address" });
      }
      console.error("Password reset request error:", error);
      res.status(500).json({ error: "Failed to process password reset request" });
    }
  });

  app.post("/api/auth/verify-reset-token", async (req, res) => {
    try {
      const { token } = z.object({ token: z.string() }).parse(req.body);
      
      // Find the reset token
      const resetToken = await storage.getPasswordResetToken(token);
      if (!resetToken || resetToken.used) {
        return res.status(400).json({ error: "Invalid or already used reset token" });
      }
      
      // Check if token is expired
      if (new Date() > resetToken.expiresAt) {
        return res.status(400).json({ error: "Reset token has expired. Please request a new one." });
      }
      
      res.json({ valid: true, message: "Token is valid" });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid request data" });
      }
      res.status(500).json({ error: "Failed to verify reset token" });
    }
  });

  app.post("/api/auth/reset-password", async (req, res) => {
    try {
      const { token, newPassword } = z.object({ 
        token: z.string(),
        newPassword: z.string().min(8),
      }).parse(req.body);
      
      // Find the reset token
      const resetToken = await storage.getPasswordResetToken(token);
      if (!resetToken || resetToken.used) {
        return res.status(400).json({ error: "Invalid or already used reset token" });
      }
      
      // Check if token is expired
      if (new Date() > resetToken.expiresAt) {
        return res.status(400).json({ error: "Reset token has expired. Please request a new one." });
      }
      
      // Hash the new password
      const hashedPassword = await hashPassword(newPassword);
      
      // Update user's password and mark email as verified (covers both
      // forgot-password resets and admin-imported users completing setup).
      await storage.updateUser(resetToken.userId, { password: hashedPassword, emailVerified: true });

      // Mark token as used
      await storage.markPasswordResetTokenAsUsed(token);
      
      res.json({ message: "Password reset successful! You can now log in with your new password." });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid request data. Password must be at least 8 characters." });
      }
      console.error("Password reset error:", error);
      res.status(500).json({ error: "Failed to reset password" });
    }
  });

  // Admin Panel APIs
  // System Settings (global admin only)
  app.get("/api/admin/system-settings", requireGlobalAdmin, async (req, res) => {
    try {
      const settings = await storage.getAllSystemSettings(null);
      res.json(settings);
    } catch (error) {
      console.error("Failed to fetch system settings:", error);
      res.status(500).json({ error: "Failed to fetch system settings" });
    }
  });

  app.get("/api/admin/system-settings/:key", requireGlobalAdmin, async (req, res) => {
    try {
      const { key } = req.params;
      const setting = await storage.getSystemSetting(key, null);
      if (!setting) {
        return res.status(404).json({ error: "Setting not found" });
      }
      res.json(setting);
    } catch (error) {
      console.error("Failed to fetch system setting:", error);
      res.status(500).json({ error: "Failed to fetch system setting" });
    }
  });

  app.put("/api/admin/system-settings/:key", requireGlobalAdmin, async (req, res) => {
    try {
      const { key } = req.params;
      const data = z.object({
        value: z.any(),
        description: z.string().optional(),
      }).parse(req.body);

      const currentUser = req.user as User;
      const setting = await storage.setSystemSetting({
        key,
        value: data.value,
        description: data.description,
        organizationId: null,
        updatedBy: currentUser.id,
      });

      res.json(setting);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      console.error("Failed to update system setting:", error);
      res.status(500).json({ error: "Failed to update system setting" });
    }
  });

  // Run projects migration (global admin only)
  // Creates default projects for orgs and links orphaned workspaces
  app.post("/api/admin/migrations/projects", requireGlobalAdmin, async (req, res) => {
    try {
      const results = {
        organizationsChecked: 0,
        projectsCreated: 0,
        workspacesLinked: 0,
        errors: [] as string[],
      };

      // Step 1: Create default projects for orgs without one
      const allOrgs = await storage.getAllOrganizations();
      results.organizationsChecked = allOrgs.length;

      for (const org of allOrgs) {
        const existingDefault = await storage.getDefaultProject(org.id);
        if (!existingDefault) {
          try {
            await storage.createProject({
              organizationId: org.id,
              name: "Default Project",
              slug: "default",
              description: "Default project for workspaces",
              isDefault: true,
            });
            results.projectsCreated++;
          } catch (err) {
            results.errors.push(`Failed to create project for org ${org.name}: ${err}`);
          }
        }
      }

      // Step 2: Link orphaned workspaces to default projects
      const allSpaces = await storage.getAllSpaces();
      for (const space of allSpaces) {
        if (!space.projectId && space.organizationId) {
          const defaultProject = await storage.getDefaultProject(space.organizationId);
          if (defaultProject) {
            try {
              await storage.updateSpace(space.id, { projectId: defaultProject.id });
              results.workspacesLinked++;
            } catch (err) {
              results.errors.push(`Failed to link workspace ${space.name}: ${err}`);
            }
          }
        }
      }

      res.json({
        success: true,
        message: "Migration completed",
        results,
      });
    } catch (error) {
      console.error("Migration failed:", error);
      res.status(500).json({ error: "Migration failed", details: String(error) });
    }
  });

  // Get migration status (global admin only)
  app.get("/api/admin/migrations/projects/status", requireGlobalAdmin, async (req, res) => {
    try {
      const allOrgs = await storage.getAllOrganizations();
      const allSpaces = await storage.getAllSpaces();
      
      let orgsWithDefaultProject = 0;
      for (const org of allOrgs) {
        const defaultProject = await storage.getDefaultProject(org.id);
        if (defaultProject) orgsWithDefaultProject++;
      }

      const spacesWithProject = allSpaces.filter(s => s.projectId !== null).length;
      const spacesNeedingProject = allSpaces.filter(s => s.projectId === null && s.organizationId !== null).length;

      res.json({
        totalOrganizations: allOrgs.length,
        orgsWithDefaultProject,
        orgsNeedingDefaultProject: allOrgs.length - orgsWithDefaultProject,
        totalWorkspaces: allSpaces.length,
        workspacesWithProject: spacesWithProject,
        workspacesNeedingProject: spacesNeedingProject,
        migrationNeeded: (allOrgs.length - orgsWithDefaultProject) > 0 || spacesNeedingProject > 0,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to check migration status" });
    }
  });

  // List all organizations (global admin only)
  app.get("/api/admin/organizations", requireGlobalAdmin, async (req, res) => {
    try {
      const organizations = await storage.getAllOrganizations();
      res.json(organizations);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch organizations" });
    }
  });

  // List users (company admins see only their org, global admins see all)
  app.get("/api/admin/users", requireCompanyAdmin, async (req, res) => {
    try {
      const currentUser = req.user as User;
      let users: User[];

      if (currentUser.role === "global_admin") {
        users = await storage.getAllUsers();
      } else if (currentUser.role === "company_admin" && currentUser.organizationId) {
        users = await storage.getUsersByOrganization(currentUser.organizationId);
      } else {
        return res.status(403).json({ error: "Insufficient permissions" });
      }

      // Remove passwords from response
      const usersWithoutPasswords = users.map(({ password, ...user }) => user);
      res.json(usersWithoutPasswords);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  // List workspaces by organization (with auth checks)
  app.get("/api/admin/organizations/:orgId/spaces", requireCompanyAdmin, async (req, res) => {
    try {
      const currentUser = req.user as User;
      const { orgId } = req.params;

      // Company admins can only view their own organization's workspaces
      if (currentUser.role === "company_admin" && currentUser.organizationId !== orgId) {
        return res.status(403).json({ error: "Cannot access other organization's workspaces" });
      }

      const spaces = await storage.getSpacesByOrganization(orgId);
      res.json(spaces);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch workspaces" });
    }
  });

  // Associate user as company admin
  app.post("/api/admin/company-admins", requireGlobalAdmin, async (req, res) => {
    try {
      const data = z.object({
        userId: z.string(),
        organizationId: z.string(),
      }).parse(req.body);

      const companyAdmin = await storage.createCompanyAdmin(data);
      res.status(201).json(companyAdmin);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to create company admin association" });
    }
  });

  // Remove company admin association
  app.delete("/api/admin/company-admins/:id", requireGlobalAdmin, async (req, res) => {
    try {
      const deleted = await storage.deleteCompanyAdmin(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Company admin association not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete company admin association" });
    }
  });

  // Associate user as space facilitator
  app.post("/api/admin/space-facilitators", requireCompanyAdmin, async (req, res) => {
    try {
      const currentUser = req.user as User;
      const data = z.object({
        userId: z.string(),
        spaceId: z.string(),
      }).parse(req.body);

      // Verify space exists and belongs to accessible organization
      const space = await storage.getSpace(data.spaceId);
      if (!space) {
        return res.status(404).json({ error: "Space not found" });
      }

      // Company admins can only assign facilitators in their own organization
      if (currentUser.role === "company_admin" && space.organizationId !== currentUser.organizationId) {
        return res.status(403).json({ error: "Cannot assign facilitators to other organization's workspaces" });
      }

      const spaceFacilitator = await storage.createSpaceFacilitator(data);
      res.status(201).json(spaceFacilitator);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to create space facilitator association" });
    }
  });

  // Remove space facilitator association
  app.delete("/api/admin/space-facilitators/:id", requireCompanyAdmin, async (req, res) => {
    try {
      const currentUser = req.user as User;
      
      // Fetch the facilitator association to check organization ownership
      const facilitator = await storage.getSpaceFacilitator(req.params.id);
      if (!facilitator) {
        return res.status(404).json({ error: "Space facilitator association not found" });
      }

      // Get the space to verify organization
      const space = await storage.getSpace(facilitator.spaceId);
      if (!space) {
        return res.status(404).json({ error: "Associated space not found" });
      }

      // Company admins can only remove facilitators from their own organization
      if (currentUser.role === "company_admin" && space.organizationId !== currentUser.organizationId) {
        return res.status(403).json({ error: "Cannot remove facilitators from other organization's workspaces" });
      }
      
      const deleted = await storage.deleteSpaceFacilitator(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Failed to delete facilitator association" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete space facilitator association" });
    }
  });

  // Organizations
  app.get("/api/organizations/:slugOrId", async (req, res) => {
    try {
      const param = req.params.slugOrId;
      // Try to fetch by slug first, then by ID
      let org = await storage.getOrganizationBySlug(param);
      if (!org) {
        org = await storage.getOrganization(param);
      }
      if (!org) {
        return res.status(404).json({ error: "Organization not found" });
      }
      res.json(org);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch organization" });
    }
  });

  // Protected: Only global admins can create organizations
  app.post("/api/organizations", requireGlobalAdmin, async (req, res) => {
    try {
      const data = insertOrganizationSchema.parse(req.body);
      const org = await storage.createOrganization(data);
      
      // Automatically create a default project for the new organization
      await storage.createProject({
        organizationId: org.id,
        name: 'Default Project',
        slug: 'default',
        description: 'Default project for workspaces',
        isDefault: true,
      });
      
      res.status(201).json(org);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to create organization" });
    }
  });

  // Protected: Only global admins can update organizations (full access)
  app.patch("/api/organizations/:id", requireGlobalAdmin, async (req, res) => {
    try {
      const data = insertOrganizationSchema.partial().parse(req.body);
      const org = await storage.updateOrganization(req.params.id, data);
      if (!org) {
        return res.status(404).json({ error: "Organization not found" });
      }
      res.json(org);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to update organization" });
    }
  });

  // Company admins can toggle SSO for their own organization
  app.patch("/api/organizations/:id/sso", requireCompanyAdmin, async (req, res) => {
    try {
      const currentUser = req.user as User;
      const { id: orgId } = req.params;
      
      // Company admins can only update their own organization
      if (currentUser.role === "company_admin" && currentUser.organizationId !== orgId) {
        return res.status(403).json({ error: "Cannot update other organization's SSO settings" });
      }
      
      const { ssoEnabled } = req.body;
      if (typeof ssoEnabled !== "boolean") {
        return res.status(400).json({ error: "ssoEnabled must be a boolean" });
      }
      
      const org = await storage.updateOrganization(orgId, { ssoEnabled });
      if (!org) {
        return res.status(404).json({ error: "Organization not found" });
      }
      
      res.json({ ssoEnabled: org.ssoEnabled });
    } catch (error) {
      console.error("Error updating SSO settings:", error);
      res.status(500).json({ error: "Failed to update SSO settings" });
    }
  });

  // Link Entra Tenant ID to organization (for admins who signed in via SSO)
  app.post("/api/organizations/:id/link-entra-tenant", requireCompanyAdmin, async (req, res) => {
    try {
      const currentUser = req.user as User;
      const { id: orgId } = req.params;
      
      // Company admins can only link their own organization
      if (currentUser.role === "company_admin" && currentUser.organizationId !== orgId) {
        return res.status(403).json({ error: "Cannot link Entra tenant for other organizations" });
      }
      
      // User must have signed in via SSO and have an Entra tenant ID
      if (!currentUser.entraTenantId) {
        return res.status(400).json({ 
          error: "You must sign in with Microsoft SSO to link your Entra tenant" 
        });
      }
      
      // Get the organization
      const org = await storage.getOrganization(orgId);
      if (!org) {
        return res.status(404).json({ error: "Organization not found" });
      }
      
      // Check if SSO is enabled for this org
      if (!org.ssoEnabled) {
        return res.status(400).json({ 
          error: "SSO is not enabled for this organization" 
        });
      }
      
      // Check if self-service account creation is enabled (inviteOnly = false)
      if (org.inviteOnly) {
        return res.status(400).json({ 
          error: "Self-service account creation is not enabled for this organization" 
        });
      }
      
      // Check if already linked
      if (org.entraTenantId) {
        return res.status(400).json({ 
          error: "This organization is already linked to an Entra tenant" 
        });
      }
      
      // Link the Entra tenant
      const updatedOrg = await storage.updateOrganization(orgId, { 
        entraTenantId: currentUser.entraTenantId,
        ssoProvider: 'entra',
      });
      
      console.info(`[Entra] Linked tenant ${currentUser.entraTenantId} to org ${org.name}`);
      
      res.json({ 
        success: true, 
        entraTenantId: updatedOrg?.entraTenantId,
        message: "Entra tenant linked successfully" 
      });
    } catch (error) {
      console.error("Error linking Entra tenant:", error);
      res.status(500).json({ error: "Failed to link Entra tenant" });
    }
  });

  // Protected: Only global admins can delete organizations
  app.delete("/api/organizations/:id", requireGlobalAdmin, async (req, res) => {
    try {
      // Check if organization has any workspaces
      const spaces = await storage.getSpacesByOrganization(req.params.id);
      if (spaces.length > 0) {
        return res.status(400).json({ 
          error: "Cannot delete organization with existing workspaces. Please delete all workspaces first." 
        });
      }
      
      // Verify organization exists
      const org = await storage.getOrganization(req.params.id);
      if (!org) {
        return res.status(404).json({ error: "Organization not found" });
      }
      
      // Delete all associated data first to avoid foreign key constraints
      await Promise.all([
        // Nullify organizationId for users in this organization (since it's nullable)
        db.update(users).set({ organizationId: null }).where(eq(users.organizationId, req.params.id)),
        // Delete company admin associations
        db.delete(companyAdmins).where(eq(companyAdmins.organizationId, req.params.id)),
        // Delete knowledge base documents scoped to this organization
        db.delete(knowledgeBaseDocuments).where(eq(knowledgeBaseDocuments.organizationId, req.params.id)),
        // Delete workspace templates scoped to this organization
        db.delete(workspaceTemplates).where(eq(workspaceTemplates.organizationId, req.params.id)),
        // Delete AI usage logs for this organization
        db.delete(aiUsageLog).where(eq(aiUsageLog.organizationId, req.params.id)),
      ]);
      
      // Finally, delete the organization itself
      await db.delete(organizations).where(eq(organizations.id, req.params.id));
      
      res.status(204).send();
    } catch (error) {
      console.error("Failed to delete organization:", error);
      res.status(500).json({ error: "Failed to delete organization" });
    }
  });

  // Projects
  
  // Get all projects for the authenticated user (across all their organizations)
  app.get("/api/projects", requireAuth, async (req, res) => {
    try {
      const user = req.user as User;
      const orgId = req.query.organizationId as string | undefined;
      
      if (orgId) {
        // Filter by specific org
        const projects = await storage.getProjectsByOrganization(orgId);
        return res.json(projects);
      }
      
      // Get all projects for all organizations the user has access to
      let organizations: Organization[];
      if (user.role === "admin") {
        organizations = await storage.getAllOrganizations();
      } else {
        const userOrgs = await storage.getUserOrganizations(user.id);
        organizations = userOrgs.map(uo => uo.organization).filter(Boolean) as Organization[];
      }
      
      const allProjects = await storage.getProjectsByOrganizations(
        organizations.map(o => o.id)
      );

      res.json(allProjects);
    } catch (error) {
      console.error("Failed to fetch projects:", error);
      res.status(500).json({ error: "Failed to fetch projects" });
    }
  });
  
  app.get("/api/organizations/:orgId/projects", requireAuth, async (req, res) => {
    try {
      const projects = await storage.getProjectsByOrganization(req.params.orgId);
      res.json(projects);
    } catch (error) {
      console.error("Failed to fetch projects:", error);
      res.status(500).json({ error: "Failed to fetch projects" });
    }
  });

  app.get("/api/projects/:id", requireAuth, async (req, res) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }
      res.json(project);
    } catch (error) {
      console.error("Failed to fetch project:", error);
      res.status(500).json({ error: "Failed to fetch project" });
    }
  });

  app.post("/api/organizations/:orgId/projects", requireCompanyAdmin, async (req, res) => {
    try {
      const { name, description } = req.body;
      if (!name) {
        return res.status(400).json({ error: "Project name is required" });
      }
      
      // Generate slug from name
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      
      // Check if slug already exists for this org
      const existing = await storage.getProjectBySlug(req.params.orgId, slug);
      if (existing) {
        return res.status(400).json({ error: "A project with this name already exists" });
      }
      
      const project = await storage.createProject({
        organizationId: req.params.orgId,
        name,
        slug,
        description: description || null,
        isDefault: false,
        createdBy: req.user!.id,
      });
      res.status(201).json(project);
    } catch (error) {
      console.error("Failed to create project:", error);
      res.status(500).json({ error: "Failed to create project" });
    }
  });

  app.patch("/api/projects/:id", requireCompanyAdmin, async (req, res) => {
    try {
      const { name, description } = req.body;
      const updates: Record<string, any> = {};
      
      if (name !== undefined) {
        updates.name = name;
        updates.slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      }
      if (description !== undefined) {
        updates.description = description;
      }
      
      const project = await storage.updateProject(req.params.id, updates);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }
      res.json(project);
    } catch (error) {
      console.error("Failed to update project:", error);
      res.status(500).json({ error: "Failed to update project" });
    }
  });

  app.delete("/api/projects/:id", requireCompanyAdmin, async (req, res) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }
      
      // Don't allow deleting the default project
      if (project.isDefault) {
        return res.status(400).json({ error: "Cannot delete the default project" });
      }
      
      // Check if project has workspaces
      const workspaces = await storage.getSpacesByProject(req.params.id);
      if (workspaces.length > 0) {
        return res.status(400).json({ error: "Cannot delete project with existing workspaces" });
      }
      
      await storage.deleteProject(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Failed to delete project:", error);
      res.status(500).json({ error: "Failed to delete project" });
    }
  });

  app.get("/api/projects/:projectId/spaces", requireAuth, async (req, res) => {
    try {
      const spaces = await storage.getSpacesByProject(req.params.projectId);
      res.json(spaces);
    } catch (error) {
      console.error("Failed to fetch project spaces:", error);
      res.status(500).json({ error: "Failed to fetch project spaces" });
    }
  });

  // Project Members
  app.get("/api/projects/:projectId/members", requireAuth, async (req, res) => {
    try {
      const members = await storage.getProjectMembers(req.params.projectId);
      res.json(members);
    } catch (error) {
      console.error("Failed to fetch project members:", error);
      res.status(500).json({ error: "Failed to fetch project members" });
    }
  });

  app.post("/api/projects/:projectId/members", requireCompanyAdmin, async (req, res) => {
    try {
      const { userId, role = "member" } = req.body;
      if (!userId) {
        return res.status(400).json({ error: "userId is required" });
      }
      
      // Verify project exists
      const project = await storage.getProject(req.params.projectId);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }
      
      // Verify user exists and belongs to the same org
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      if (user.organizationId !== project.organizationId) {
        return res.status(400).json({ error: "User must belong to the same organization as the project" });
      }
      
      const member = await storage.addProjectMember(req.params.projectId, userId, role);
      res.status(201).json(member);
    } catch (error) {
      console.error("Failed to add project member:", error);
      res.status(500).json({ error: "Failed to add project member" });
    }
  });

  app.delete("/api/projects/:projectId/members/:userId", requireCompanyAdmin, async (req, res) => {
    try {
      const success = await storage.removeProjectMember(req.params.projectId, req.params.userId);
      if (!success) {
        return res.status(404).json({ error: "Member not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Failed to remove project member:", error);
      res.status(500).json({ error: "Failed to remove project member" });
    }
  });

  app.patch("/api/projects/:projectId/members/:userId", requireCompanyAdmin, async (req, res) => {
    try {
      const { role } = req.body;
      if (!role || !["admin", "member"].includes(role)) {
        return res.status(400).json({ error: "Valid role (admin or member) is required" });
      }
      
      const member = await storage.updateProjectMemberRole(req.params.projectId, req.params.userId, role);
      if (!member) {
        return res.status(404).json({ error: "Member not found" });
      }
      res.json(member);
    } catch (error) {
      console.error("Failed to update project member role:", error);
      res.status(500).json({ error: "Failed to update project member role" });
    }
  });

  // Get organizations accessible to current user
  app.get("/api/my-organizations", requireAuth, async (req, res) => {
    try {
      const user = req.user as User;
      let organizations: any[] = [];

      // Global admins see all organizations
      if (user.role === "global_admin") {
        organizations = await storage.getAllOrganizations();
      }
      // Company admins see their organization
      else if (user.role === "company_admin" && user.organizationId) {
        const org = await storage.getOrganization(user.organizationId);
        if (org) organizations = [org];
      }
      // Facilitators see orgs where they have workspace assignments
      else if (user.role === "facilitator") {
        const assignments = await storage.getSpaceFacilitatorsByUser(user.id);
        const assignedSpaceIds = assignments.map((a) => a.spaceId);
        const assignedSpaces = await storage.getSpacesByIds(assignedSpaceIds);
        const orgIds = Array.from(
          new Set(assignedSpaces.map(s => s.organizationId).filter(Boolean) as string[])
        );
        organizations = await storage.getOrganizationsByIds(orgIds);
      }
      // Regular users see their primary organization
      else if (user.organizationId) {
        const org = await storage.getOrganization(user.organizationId);
        if (org) organizations = [org];
      }

      // Enrich with project counts (batched to avoid N+1)
      const orgIdList = organizations.map(o => o.id);
      const [allProjects, allSpaces] = await Promise.all([
        storage.getProjectsByOrganizations(orgIdList),
        storage.getSpacesByOrganizations(orgIdList),
      ]);
      const projectCounts = new Map<string, number>();
      const spaceCounts = new Map<string, number>();
      for (const p of allProjects) {
        projectCounts.set(p.organizationId, (projectCounts.get(p.organizationId) || 0) + 1);
      }
      for (const s of allSpaces) {
        if (s.organizationId) {
          spaceCounts.set(s.organizationId, (spaceCounts.get(s.organizationId) || 0) + 1);
        }
      }
      const enriched = organizations.map(org => ({
        ...org,
        projectCount: projectCounts.get(org.id) || 0,
        workspaceCount: spaceCounts.get(org.id) || 0,
      }));

      res.json(enriched);
    } catch (error) {
      console.error("Failed to fetch user organizations:", error);
      res.status(500).json({ error: "Failed to fetch organizations" });
    }
  });

  // Get projects for current user (filtered by membership for non-admins)
  app.get("/api/my-projects", requireAuth, async (req, res) => {
    try {
      const user = req.user as User;
      
      // Admins see all projects in their organizations
      if (user.role === "admin" || user.role === "global_admin" || user.role === "company_admin") {
        const orgId = user.organizationId;
        if (orgId) {
          const projects = await storage.getProjectsByOrganization(orgId);
          return res.json(projects);
        }
        // Global admin gets all
        const allOrgs = await storage.getAllOrganizations();
        const allProjects = await storage.getProjectsByOrganizations(
          allOrgs.map(o => o.id)
        );
        return res.json(allProjects);
      }
      
      // Regular users see only projects they're members of
      const memberships = await storage.getProjectMembersByUser(user.id);
      const projects = memberships.map(m => m.project);
      res.json(projects);
    } catch (error) {
      console.error("Failed to fetch user projects:", error);
      res.status(500).json({ error: "Failed to fetch user projects" });
    }
  });

  // Get detailed projects for current user (with organization and workspace counts)
  app.get("/api/my-projects/detailed", requireAuth, async (req, res) => {
    try {
      const user = req.user as User;
      let projects: any[] = [];
      
      // Admins see all projects in their organizations
      if (user.role === "admin" || user.role === "global_admin" || user.role === "company_admin") {
        const orgId = user.organizationId;
        if (orgId) {
          projects = await storage.getProjectsByOrganization(orgId);
        } else if (user.role === "global_admin") {
          // Global admin gets all (batched)
          const allOrgs = await storage.getAllOrganizations();
          projects = await storage.getProjectsByOrganizations(allOrgs.map(o => o.id));
        }
      } else {
        // Regular users see only projects they're members of
        const memberships = await storage.getProjectMembersByUser(user.id);
        projects = memberships.map(m => m.project);
      }

      // Batch fetch related orgs and spaces to avoid N+1
      const projectIds = projects.map(p => p.id);
      const orgIds = Array.from(new Set(projects.map(p => p.organizationId).filter(Boolean) as string[]));
      const [orgs, allSpaces] = await Promise.all([
        storage.getOrganizationsByIds(orgIds),
        storage.getSpacesByProjects(projectIds),
      ]);
      const orgMap = new Map(orgs.map(o => [o.id, o]));
      const spacesByProject = new Map<string, typeof allSpaces>();
      for (const s of allSpaces) {
        if (!s.projectId) continue;
        const list = spacesByProject.get(s.projectId);
        if (list) list.push(s);
        else spacesByProject.set(s.projectId, [s]);
      }

      const enriched = projects.map((project) => {
        const org = orgMap.get(project.organizationId);
        const projSpaces = spacesByProject.get(project.id) || [];
        return {
          ...project,
          organization: org ? { id: org.id, name: org.name, slug: org.slug } : null,
          workspaceCount: projSpaces.length,
          workspaces: projSpaces.map(s => ({
            id: s.id,
            name: s.name,
            code: s.code,
            status: s.status,
          })),
        };
      });

      res.json(enriched);
    } catch (error) {
      console.error("Failed to fetch detailed user projects:", error);
      res.status(500).json({ error: "Failed to fetch user projects" });
    }
  });

  // Spaces
  app.get("/api/organizations/:orgId/spaces", async (req, res) => {
    try {
      const spaces = await storage.getSpacesByOrganization(req.params.orgId);
      res.json(spaces);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch spaces" });
    }
  });

  app.get("/api/spaces/:id", async (req, res) => {
    try {
      const identifier = req.params.id;
      // Check if identifier looks like a workspace code (8 digits with or without hyphen)
      // vs a UUID (36 chars with hyphens) or serial integer
      let space;
      const isWorkspaceCode = /^\d{8}$/.test(identifier) || /^\d{4}-\d{4}$/.test(identifier);

      if (isWorkspaceCode) {
        space = await storage.getSpaceByCode(identifier);
      } else {
        space = await storage.getSpace(identifier);
      }

      if (!space) {
        return res.status(404).json({ error: "Space not found" });
      }
      res.json(space);
    } catch (error) {
      console.error(`[ERROR] GET /api/spaces/:id failed:`, error);
      res.status(500).json({ error: "Failed to fetch space" });
    }
  });

  // Get workspaces for current user (facilitator dashboard)
  app.get("/api/my-workspaces", requireAuth, async (req, res) => {
    try {
      const currentUser = req.user as User;
      let spaces: any[] = [];

      // Global admins can see all workspaces
      if (currentUser.role === "global_admin") {
        spaces = await storage.getAllSpaces();
      } 
      // Company admins can see all workspaces in their organization
      else if (currentUser.role === "company_admin" && currentUser.organizationId) {
        spaces = await storage.getSpacesByOrganization(currentUser.organizationId);
      } 
      // Facilitators can only see workspaces they're assigned to
      else if (currentUser.role === "facilitator") {
        const facilitatorAssignments = await storage.getSpaceFacilitatorsByUser(currentUser.id);
        const assignedSpaceIds = facilitatorAssignments.map((a) => a.spaceId);
        spaces = await storage.getSpacesByIds(assignedSpaceIds);
      }
      // Regular users don't have access to any workspaces as facilitators
      else {
        spaces = [];
      }

      // Enrich each workspace with stats and project info using batched queries
      const spaceIds = spaces.map((s) => s.id);
      const orgIds = Array.from(new Set(spaces.map((s) => s.organizationId).filter((id): id is string => Boolean(id))));
      const projectIds = Array.from(new Set(spaces.map((s) => s.projectId).filter((id): id is string => Boolean(id))));

      const [participantCounts, noteCounts, orgs, projectsList] = await Promise.all([
        storage.getParticipantCountsBySpaces(spaceIds),
        storage.getNoteCountsBySpaces(spaceIds),
        storage.getOrganizationsByIds(orgIds),
        storage.getProjectsByIds(projectIds),
      ]);

      const orgMap = new Map(orgs.map(o => [o.id, o]));
      const projectMap = new Map(projectsList.map(p => [p.id, p]));

      const enrichedSpaces = spaces.map((space: any) => ({
        ...space,
        organization: orgMap.get(space.organizationId) || null,
        project: space.projectId ? projectMap.get(space.projectId) || null : null,
        stats: {
          participantCount: participantCounts.get(space.id) || 0,
          noteCount: noteCounts.get(space.id) || 0,
        },
      }));

      res.json(enrichedSpaces);
    } catch (error) {
      console.error("Failed to fetch user workspaces:", error);
      res.status(500).json({ error: "Failed to fetch workspaces" });
    }
  });

  // Protected: Require facilitator or above to create spaces
  app.post("/api/spaces", requireFacilitator, async (req, res) => {
    try {
      const data = createSpaceApiSchema.parse(req.body);
      
      // Extract templateId from data (it's not part of insertSpaceSchema)
      // Normalize empty strings to undefined for safety
      const { templateId: rawTemplateId, ...spaceData } = data;
      const templateId = rawTemplateId && rawTemplateId.trim() !== "" ? rawTemplateId : undefined;

      // If templateId is provided, clone from template workspace
      if (templateId) {
        try {
          // Auto-assign to default project if organizationId is provided but no projectId
          let projectId = spaceData.projectId;
          if (!projectId && spaceData.organizationId) {
            const defaultProject = await storage.getDefaultProject(spaceData.organizationId);
            if (defaultProject) {
              projectId = defaultProject.id;
            }
          }
          
          // Check if this is a workspace template (new system with isTemplate flag)
          const templateWorkspace = await storage.getSpace(templateId);
          if (templateWorkspace && templateWorkspace.isTemplate) {
            // Use new simplified template system
            const newWorkspace = await storage.cloneWorkspaceFromTemplate(templateId, {
              ...spaceData,
              projectId,
              code: data.code || await generateWorkspaceCode(),
              createdBy: req.user!.id,
            });
            return res.status(201).json(newWorkspace);
          } else {
            // Fall back to old template system
            const code = data.code || await generateWorkspaceCode();
            const space = await storage.createSpace({
              ...spaceData,
              projectId,
              code,
              createdBy: req.user!.id,
            });
            await storage.cloneTemplateIntoWorkspace(templateId, space.id, "Template");
            return res.status(201).json(space);
          }
        } catch (templateError) {
          console.error("Failed to clone template data:", templateError);
          return res.status(500).json({ error: "Failed to clone from template" });
        }
      }

      // No template - create blank workspace
      const code = data.code || await generateWorkspaceCode();
      
      // Auto-assign to default project if organizationId is provided but no projectId
      let projectId = spaceData.projectId;
      if (!projectId && spaceData.organizationId) {
        const defaultProject = await storage.getDefaultProject(spaceData.organizationId);
        if (defaultProject) {
          projectId = defaultProject.id;
        }
      }
      
      const space = await storage.createSpace({
        ...spaceData,
        projectId,
        code,
        createdBy: req.user!.id,
      });
      
      res.status(201).json(space);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to create space" });
    }
  });

  // Protected: Require facilitator or above to update spaces
  app.patch("/api/spaces/:id", requireFacilitator, async (req, res) => {
    try {
      // Resolve workspace code to UUID
      const rawId = req.params.id;
      const spaceId = await resolveWorkspaceId(rawId);
      if (!spaceId) {
        return res.status(404).json({ error: "Space not found" });
      }

      // Coerce date strings to Date objects before validation
      const body = { ...req.body };
      const dateFields = ['ideationStartsAt', 'ideationEndsAt', 'votingStartsAt', 'votingEndsAt', 'rankingStartsAt', 'rankingEndsAt'];
      for (const field of dateFields) {
        if (body[field] && typeof body[field] === 'string') {
          body[field] = new Date(body[field]);
        }
      }
      const data = insertSpaceSchema.partial().parse(body);
      const space = await storage.updateSpace(spaceId, data);
      if (!space) {
        return res.status(404).json({ error: "Space not found" });
      }
      
      // Broadcast phase change if status was updated
      if (data.status) {
        let phase = "ideation"; // default phase
        
        // Map status to phase for participant navigation
        if (data.status === "open") {
          phase = "ideation"; // Active ideation phase
        }
        
        // Broadcast using workspace code (how participants connect)
        broadcastToSpace(rawId, {
          type: "phase_change",
          data: {
            spaceId: rawId,
            status: data.status,
            phase: phase,
          }
        });
        if (rawId !== spaceId) {
          broadcastToSpace(spaceId, {
            type: "phase_change",
            data: {
              spaceId: spaceId,
              status: data.status,
              phase: phase,
            }
          });
        }

        // Persist in-app notifications for all linked workspace users
        try {
          const org = await storage.getOrganization(space.organizationId);
          const link = `/o/${org?.slug || space.organizationId}/s/${space.code || spaceId}`;
          const recipients = new Set<string>();
          const sf = await storage.getSpaceFacilitatorsBySpace(spaceId);
          sf.forEach(f => recipients.add(f.userId));
          const ps = await storage.getParticipantsBySpace(spaceId);
          ps.forEach(p => { if (p.userId) recipients.add(p.userId); });
          await Promise.all(Array.from(recipients).map(uid => notifyUser({
            userId: uid,
            type: "phase_changed",
            title: `${space.name}: phase is now ${phase}`,
            body: `Workspace status updated to "${data.status}".`,
            link,
            spaceId,
          })));
        } catch (e) { console.error("[notify phase_changed]", e); }
      }
      
      res.json(space);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to update space" });
    }
  });

  // Protected: Navigate all participants to a specific phase
  app.post("/api/spaces/:id/navigate-participants", requireFacilitator, async (req, res) => {
    try {
      const { phase } = req.body as { phase: "vote" | "rank" | "marketplace" | "ideate" | "results" | "priority-matrix" | "staircase" | "survey" };
      
      if (!phase || !["vote", "rank", "marketplace", "ideate", "results", "priority-matrix", "staircase", "survey"].includes(phase)) {
        return res.status(400).json({ error: "Invalid phase. Must be one of: vote, rank, marketplace, ideate, results, priority-matrix, staircase, survey" });
      }
      
      // Resolve workspace code to UUID
      const rawId = req.params.id;
      const spaceId = await resolveWorkspaceId(rawId);
      if (!spaceId) {
        return res.status(404).json({ error: "Workspace not found" });
      }

      // Automatically enable the phase by setting time windows
      // This allows the phase to be "active" according to isPhaseActive checks
      const now = new Date();
      const farFuture = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000); // 1 year from now
      
      const updates: any = {};
      
      // Get workspace modules to check for timer configuration
      const wModules = await storage.getWorkspaceModules(spaceId);
      const ideationModule = wModules.find(m => m.moduleType === 'ideation');
      const ideationConfig = ideationModule?.config as { timerEnabled?: boolean; timerDurationMinutes?: number } | undefined;
      
      switch (phase) {
        case "ideate":
          updates.ideationStartsAt = now;
          // If timer is enabled, set end time based on configured duration
          if (ideationConfig?.timerEnabled && ideationConfig?.timerDurationMinutes) {
            const timerEndTime = new Date(now.getTime() + ideationConfig.timerDurationMinutes * 60 * 1000);
            updates.ideationEndsAt = timerEndTime;
          } else {
            updates.ideationEndsAt = farFuture;
          }
          break;
        case "vote":
          updates.votingStartsAt = now;
          updates.votingEndsAt = farFuture;
          break;
        case "rank":
          updates.rankingStartsAt = now;
          updates.rankingEndsAt = farFuture;
          break;
        case "marketplace":
          updates.marketplaceStartsAt = now;
          updates.marketplaceEndsAt = farFuture;
          break;
        case "survey":
          updates.surveyStartsAt = now;
          updates.surveyEndsAt = farFuture;
          break;
        case "priority-matrix":
        case "staircase":
        case "results":
          // These modules don't need time window updates
          // Just broadcast the navigation
          break;
      }
      
      // Update workspace to enable the phase (if needed)
      if (Object.keys(updates).length > 0) {
        await storage.updateSpace(spaceId, updates);
      }
      
      // Broadcast navigation command to participants in this workspace
      // Use rawId (workspace code) since participants connect with the code from their URL
      broadcastToSpace(rawId, {
        type: "navigate_to_phase",
        data: {
          spaceId: rawId,
          phase: phase,
        }
      });
      // Also broadcast using the resolved UUID in case some clients connected with that
      if (rawId !== spaceId) {
        broadcastToSpace(spaceId, {
          type: "navigate_to_phase",
          data: {
            spaceId: spaceId,
            phase: phase,
          }
        });
      }

      // Persist in-app notifications for facilitators + linked participants
      try {
        const space = await storage.getSpace(spaceId);
        if (space) {
          const org = await storage.getOrganization(space.organizationId);
          const link = `/o/${org?.slug || space.organizationId}/s/${space.code || spaceId}`;
          const recipients = new Set<string>();
          const sf = await storage.getSpaceFacilitatorsBySpace(spaceId);
          sf.forEach(f => recipients.add(f.userId));
          const ps = await storage.getParticipantsBySpace(spaceId);
          ps.forEach(p => { if (p.userId) recipients.add(p.userId); });
          await Promise.all(Array.from(recipients).map(uid => notifyUser({
            userId: uid,
            type: "phase_changed",
            title: `${space.name}: ${phase} phase active`,
            body: `Facilitator advanced participants to the ${phase} phase.`,
            link,
            spaceId,
          })));
        }
      } catch (e) { console.error("[notify navigate phase_changed]", e); }
      
      res.json({ success: true, phase });
    } catch (error) {
      res.status(500).json({ error: "Failed to navigate participants" });
    }
  });

  // Protected: Get workspace dependencies (for delete confirmation)
  app.get("/api/spaces/:id/dependencies", requireCompanyAdmin, async (req, res) => {
    try {
      const dependencies = await storage.getSpaceDependencies(req.params.id);
      res.json(dependencies);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch workspace dependencies" });
    }
  });

  // Protected: Require company admin or above to delete spaces
  app.delete("/api/spaces/:id", requireCompanyAdmin, async (req, res) => {
    try {
      const deleted = await storage.deleteSpace(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Space not found" });
      }
      res.status(204).send();
    } catch (error: any) {
      console.error(`[deleteSpace] Error deleting space ${req.params.id}:`, error.message, error.code, error.detail);
      // Check if it's a foreign key constraint error
      if (error.code === '23503' || error.message?.includes('foreign key')) {
        return res.status(400).json({ 
          error: "Cannot delete workspace with existing data. Please archive it instead or delete all associated data first.",
          detail: error.detail || error.message
        });
      }
      res.status(500).json({ error: "Failed to delete space", detail: error.message });
    }
  });

  // Access Requests
  // Submit an access request (public endpoint for guests)
  app.post("/api/access-requests", async (req, res) => {
    try {
      const data = z.object({
        spaceId: z.string(),
        email: z.string().email(),
        name: z.string(),
        message: z.string().optional(),
      }).parse(req.body);

      // Check if space exists
      const space = await storage.getSpace(data.spaceId);
      if (!space) {
        return res.status(404).json({ error: "Workspace not found" });
      }

      // Check if there's already a pending request for this email/space
      const existing = await storage.checkExistingAccessRequest(data.spaceId, data.email);
      if (existing) {
        return res.status(400).json({ 
          error: "You already have a pending access request for this workspace" 
        });
      }

      // Check if user with this email already has access
      const existingUser = await storage.getUserByEmail(data.email);
      if (existingUser) {
        // Check if user has permissions for this space
        const org = await storage.getOrganization(space.organizationId);
        if (org && existingUser.organizationId === org.id) {
          return res.status(400).json({ 
            error: "You already have access to this workspace. Please log in." 
          });
        }
        
        // Check if user is a facilitator of this space
        const facilitators = await storage.getSpaceFacilitatorsBySpace(data.spaceId);
        if (facilitators.some(f => f.userId === existingUser.id)) {
          return res.status(400).json({ 
            error: "You already have access to this workspace. Please log in." 
          });
        }
      }

      // Create access request
      const accessRequest = await storage.createAccessRequest({
        spaceId: data.spaceId,
        email: data.email,
        displayName: data.name,
        message: data.message || null,
        status: "pending",
        userId: null,
        resolvedBy: null,
      });

      // Get organization info for email
      const org = await storage.getOrganization(space.organizationId);

      // Notify facilitators and company admins
      const facilitators = await storage.getSpaceFacilitatorsBySpace(data.spaceId);
      const companyAdmins = org ? await storage.getCompanyAdminsByOrganization(org.id) : [];
      
      // Get unique user IDs to notify
      const userIdsToNotify = new Set([
        ...facilitators.map(f => f.userId),
        ...companyAdmins.map(ca => ca.userId),
      ]);

      // Send email notifications
      const baseUrl = req.get('origin') || 'http://localhost:5000';
      const grantAccessUrl = `${baseUrl}/admin?tab=access-requests&spaceId=${data.spaceId}`;

      for (const userId of Array.from(userIdsToNotify)) {
        try {
          const user = await storage.getUser(userId);
          if (user && user.email) {
            await sendAccessRequestEmail(
              user.email,
              user.displayName || user.username,
              {
                workspaceName: space.name,
                requesterName: data.name,
                requesterEmail: data.email,
                message: data.message,
                grantAccessUrl,
                organizationName: org?.name || "Organization",
              }
            );
          }
        } catch (emailError) {
          console.error(`Failed to send email to user ${userId}:`, emailError);
        }
        // Persist in-app notification regardless of email outcome
        await notifyUser({
          userId,
          type: "access_request_submitted",
          title: `Access request: ${space.name}`,
          body: `${data.name} (${data.email}) is requesting access.`,
          link: `/admin?tab=access-requests&spaceId=${data.spaceId}`,
          spaceId: data.spaceId,
        });
      }

      res.status(201).json(accessRequest);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      console.error("Access request error:", error);
      res.status(500).json({ error: "Failed to submit access request" });
    }
  });

  // List access requests for a space (facilitators and admins only)
  app.get("/api/spaces/:spaceId/access-requests", requireAuth, async (req, res) => {
    try {
      const { spaceId } = req.params;
      const currentUser = req.user as User;
      
      // Check authorization
      const space = await storage.getSpace(spaceId);
      if (!space) {
        return res.status(404).json({ error: "Workspace not found" });
      }

      // Check if user has permission to view access requests
      let hasPermission = false;
      
      if (currentUser.role === "global_admin") {
        hasPermission = true;
      } else if (currentUser.role === "company_admin" && currentUser.organizationId === space.organizationId) {
        hasPermission = true;
      } else if (currentUser.role === "facilitator" || currentUser.role === "user") {
        // Check if user is facilitator of this space
        const facilitators = await storage.getSpaceFacilitatorsBySpace(spaceId);
        hasPermission = facilitators.some(f => f.userId === currentUser.id);
      }

      if (!hasPermission) {
        return res.status(403).json({ error: "Insufficient permissions" });
      }

      const requests = await storage.getAccessRequestsBySpace(spaceId);
      res.json(requests);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch access requests" });
    }
  });

  // Approve or deny an access request (facilitators and admins only)
  app.patch("/api/access-requests/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const data = z.object({
        status: z.enum(["approved", "denied"]),
      }).parse(req.body);

      const currentUser = req.user as User;
      const request = await storage.getAccessRequest(id);
      
      if (!request) {
        return res.status(404).json({ error: "Access request not found" });
      }

      if (request.status !== "pending") {
        return res.status(400).json({ error: "Access request already resolved" });
      }

      // Check authorization
      const space = await storage.getSpace(request.spaceId);
      if (!space) {
        return res.status(404).json({ error: "Workspace not found" });
      }

      let hasPermission = false;
      
      if (currentUser.role === "global_admin") {
        hasPermission = true;
      } else if (currentUser.role === "company_admin" && currentUser.organizationId === space.organizationId) {
        hasPermission = true;
      } else if (currentUser.role === "facilitator" || currentUser.role === "user") {
        const facilitators = await storage.getSpaceFacilitatorsBySpace(request.spaceId);
        hasPermission = facilitators.some(f => f.userId === currentUser.id);
      }

      if (!hasPermission) {
        return res.status(403).json({ error: "Insufficient permissions" });
      }

      // Update request status
      const updated = await storage.updateAccessRequest(id, {
        status: data.status,
        resolvedBy: currentUser.id,
      });

      // Notify the requester (if they have a user account)
      try {
        const requesterUser = await storage.getUserByEmail(request.email);
        if (requesterUser) {
          const org = await storage.getOrganization(space.organizationId);
          const link = `/o/${org?.slug || space.organizationId}/s/${space.code || space.id}`;
          if (data.status === "approved") {
            await notifyUser({
              userId: requesterUser.id,
              type: "access_request_approved",
              title: `Access granted: ${space.name}`,
              body: `Your request to join ${space.name} was approved.`,
              link,
              spaceId: space.id,
            });
          } else {
            await notifyUser({
              userId: requesterUser.id,
              type: "access_request_denied",
              title: `Access declined: ${space.name}`,
              body: `Your request to join ${space.name} was declined.`,
              link: null,
              spaceId: space.id,
            });
          }
        }
      } catch (e) { console.error("[notify access_request_resolution]", e); }

      // If approved, add user as participant to the workspace
      if (data.status === "approved") {
        // Storage methods now handle email normalization automatically
        const existingUser = await storage.getUserByEmail(request.email);
        const participantByEmail = await storage.getParticipantBySpaceAndEmail(request.spaceId, request.email);
        
        if (participantByEmail) {
          // Participant record exists - check if we need to link to user account
          if (existingUser && !participantByEmail.userId) {
            await storage.linkParticipantToUser(participantByEmail.id, existingUser.id);
          }
        } else if (existingUser) {
          // Get or create participant linked to existing user. Uses partial unique
          // index on (space_id, user_id) to safely handle concurrent invites.
          await storage.getOrCreateParticipantByUserId(request.spaceId, existingUser.id, {
            displayName: request.displayName,
            email: request.email,
            isGuest: false,
          });
        } else {
          // No existing user - create guest participant and send invitation
          await storage.createParticipant({
            spaceId: request.spaceId,
            displayName: request.displayName,
            email: request.email,
            userId: null,
            isGuest: true,
          });
          
          // Send invitation email to the new participant (if workspace has required fields)
          if (space.organizationId && space.code) {
            try {
              const org = await storage.getOrganization(space.organizationId);
              const baseUrl = process.env.REPLIT_DEV_DOMAIN 
                ? `https://${process.env.REPLIT_DEV_DOMAIN}`
                : 'http://localhost:5000';
              const joinUrl = `${baseUrl}/join/${space.code}`;
              
              await sendSessionInviteEmail(request.email, {
                inviteeName: request.displayName,
                workspaceName: space.name,
                workspaceCode: space.code,
                organizationName: org?.name || 'Nebula',
                joinUrl,
                role: 'participant',
              });
            } catch (emailError) {
              console.error('Failed to send invitation email after approval:', emailError);
            }
          }
        }
      }

      res.json(updated);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      console.error("Failed to update access request:", error);
      res.status(500).json({ error: "Failed to update access request" });
    }
  });

  // Knowledge Base Documents
  // Upload a document
  app.post("/api/knowledge-base/documents", requireAuth, upload.single('file'), async (req, res) => {
    try {
      const currentUser = req.user as User;
      const file = req.file;
      
      if (!file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const data = z.object({
        title: z.string().min(1),
        description: z.string().optional(),
        scope: z.enum(['system', 'organization', 'workspace', 'multi_workspace']),
        organizationId: z.string().optional(),
        spaceId: z.string().optional(),
        spaceIds: z.array(z.string()).optional(), // For multi_workspace scope
        tags: z.array(z.string()).optional(),
      }).parse(JSON.parse(req.body.metadata || '{}'));

      // Validate scope-specific permissions
      if (data.scope === 'system' && currentUser.role !== 'global_admin') {
        return res.status(403).json({ error: "Only global admins can upload system-level documents" });
      }

      if (data.scope === 'organization') {
        if (!data.organizationId) {
          return res.status(400).json({ error: "Organization ID required for organization scope" });
        }
        
        // Check if user is global admin or company admin of this org
        if (currentUser.role !== 'global_admin') {
          if (currentUser.role !== 'company_admin' || currentUser.organizationId !== data.organizationId) {
            const companyAdmins = await storage.getCompanyAdminsByUser(currentUser.id);
            const hasPermission = companyAdmins.some(ca => ca.organizationId === data.organizationId);
            if (!hasPermission) {
              return res.status(403).json({ error: "Insufficient permissions for this organization" });
            }
          }
        }
      }

      if (data.scope === 'workspace') {
        if (!data.spaceId) {
          return res.status(400).json({ error: "Workspace ID required for workspace scope" });
        }

        const space = await storage.getSpace(data.spaceId);
        if (!space) {
          return res.status(404).json({ error: "Workspace not found" });
        }

        // Check if user is global admin, company admin of org, or facilitator of space
        let hasPermission = false;
        if (currentUser.role === 'global_admin') {
          hasPermission = true;
        } else if (currentUser.role === 'company_admin' && currentUser.organizationId === space.organizationId) {
          hasPermission = true;
        } else {
          const facilitators = await storage.getSpaceFacilitatorsBySpace(data.spaceId);
          hasPermission = facilitators.some(f => f.userId === currentUser.id);
        }

        if (!hasPermission) {
          return res.status(403).json({ error: "Insufficient permissions for this workspace" });
        }
      }

      if (data.scope === 'multi_workspace') {
        if (!data.spaceIds || data.spaceIds.length === 0) {
          return res.status(400).json({ error: "At least one workspace ID required for multi-workspace scope" });
        }
        
        if (!data.organizationId) {
          return res.status(400).json({ error: "Organization ID required for multi-workspace scope" });
        }

        // Check if user is global admin or company admin of the organization
        if (currentUser.role !== 'global_admin') {
          if (currentUser.role !== 'company_admin' || currentUser.organizationId !== data.organizationId) {
            const companyAdmins = await storage.getCompanyAdminsByUser(currentUser.id);
            const hasPermission = companyAdmins.some(ca => ca.organizationId === data.organizationId);
            if (!hasPermission) {
              return res.status(403).json({ error: "Insufficient permissions for this organization" });
            }
          }
        }

        // Verify all selected workspaces belong to the specified organization
        for (const spaceId of data.spaceIds) {
          const space = await storage.getSpace(spaceId);
          if (!space) {
            return res.status(404).json({ error: `Workspace ${spaceId} not found` });
          }
          if (space.organizationId !== data.organizationId) {
            return res.status(400).json({ error: `Workspace ${spaceId} does not belong to the specified organization` });
          }
        }
      }

      // Save file to local storage
      const uploadedFile = await fileUploadService.saveFile(
        file.buffer,
        file.originalname,
        file.mimetype
      );

      // Create document record
      const document = await storage.createKnowledgeBaseDocument({
        title: data.title,
        description: data.description || null,
        filename: uploadedFile.originalName,
        filePath: uploadedFile.filePath,
        fileSize: uploadedFile.size,
        mimeType: uploadedFile.mimeType,
        scope: data.scope,
        organizationId: data.organizationId || null,
        spaceId: data.spaceId || null,
        tags: data.tags || null,
        uploadedBy: currentUser.id,
      });

      // For multi_workspace scope, create junction table entries
      if (data.scope === 'multi_workspace' && data.spaceIds) {
        for (const spaceId of data.spaceIds) {
          await storage.createDocumentWorkspaceAccess({
            documentId: document.id,
            spaceId,
          });
        }
      }

      // Best-effort: extract text and persist FTS chunks. Don't fail the
      // upload if extraction errors — the document is still usable for
      // download even without searchable content.
      try {
        const extracted = await extractAndChunk(uploadedFile.filePath, uploadedFile.mimeType);
        if (extracted.supported && extracted.chunks.length > 0) {
          await storage.createKnowledgeBaseChunks(
            extracted.chunks.map((content, chunkIndex) => ({
              documentId: document.id,
              chunkIndex,
              content,
            })),
          );
        } else if (!extracted.supported) {
          console.info(`[kb-upload] No text extraction for ${uploadedFile.mimeType} doc ${document.id}; FTS will skip it.`);
        }
      } catch (extractErr) {
        console.warn(`[kb-upload] Chunk extraction failed for doc ${document.id}:`, extractErr);
      }

      res.status(201).json(document);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      console.error("Failed to upload document:", error);
      res.status(500).json({ error: "Failed to upload document" });
    }
  });

  // List documents by scope
  app.get("/api/knowledge-base/documents", requireAuth, async (req, res) => {
    try {
      const currentUser = req.user as User;
      const { scope, scopeId, spaceId } = req.query;

      // If requesting documents for a specific workspace
      if (spaceId && typeof spaceId === 'string') {
        const space = await storage.getSpace(spaceId);
        if (!space) {
          return res.status(404).json({ error: "Workspace not found" });
        }

        // Get all applicable documents (system + organization + workspace)
        const documents = await storage.getKnowledgeBaseDocumentsForSpace(spaceId, space.organizationId);
        return res.json(documents);
      }

      // Otherwise, get documents by specific scope
      if (!scope || typeof scope !== 'string') {
        return res.status(400).json({ error: "Scope parameter required" });
      }

      // Validate permissions for requested scope
      if (scope === 'system' && currentUser.role !== 'global_admin') {
        return res.status(403).json({ error: "Only global admins can view system documents" });
      }

      if (scope === 'organization') {
        const orgId = typeof scopeId === 'string' ? scopeId : undefined;
        if (!orgId) {
          return res.status(400).json({ error: "Organization ID required" });
        }

        // Check permissions
        if (currentUser.role !== 'global_admin') {
          if (currentUser.role !== 'company_admin' || currentUser.organizationId !== orgId) {
            const companyAdmins = await storage.getCompanyAdminsByUser(currentUser.id);
            const hasPermission = companyAdmins.some(ca => ca.organizationId === orgId);
            if (!hasPermission) {
              return res.status(403).json({ error: "Insufficient permissions" });
            }
          }
        }
      }

      if (scope === 'workspace') {
        const workspaceId = typeof scopeId === 'string' ? scopeId : undefined;
        if (!workspaceId) {
          return res.status(400).json({ error: "Workspace ID required" });
        }

        const space = await storage.getSpace(workspaceId);
        if (!space) {
          return res.status(404).json({ error: "Workspace not found" });
        }

        // Check permissions
        let hasPermission = false;
        if (currentUser.role === 'global_admin') {
          hasPermission = true;
        } else if (currentUser.role === 'company_admin' && currentUser.organizationId === space.organizationId) {
          hasPermission = true;
        } else {
          const facilitators = await storage.getSpaceFacilitatorsBySpace(workspaceId);
          hasPermission = facilitators.some(f => f.userId === currentUser.id);
        }

        if (!hasPermission) {
          return res.status(403).json({ error: "Insufficient permissions" });
        }

        // Use getKnowledgeBaseDocumentsForSpace to include multi_workspace documents
        const documents = await storage.getKnowledgeBaseDocumentsForSpace(workspaceId, space.organizationId);
        return res.json(documents);
      }

      const documents = await storage.getKnowledgeBaseDocumentsByScope(
        scope,
        typeof scopeId === 'string' ? scopeId : undefined
      );
      res.json(documents);
    } catch (error) {
      console.error("Failed to fetch documents:", error);
      res.status(500).json({ error: "Failed to fetch documents" });
    }
  });

  // Full-text search across knowledge base chunks (scoped by viewer's role).
  app.get("/api/knowledge-base/search", requireAuth, async (req, res) => {
    try {
      const currentUser = req.user as User;
      const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
      const scope = typeof req.query.scope === 'string' ? req.query.scope : 'system';
      const scopeId = typeof req.query.scopeId === 'string' ? req.query.scopeId : undefined;
      const limitRaw = typeof req.query.limit === 'string' ? parseInt(req.query.limit, 10) : 8;
      const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(20, limitRaw)) : 8;

      if (!q) {
        return res.json({ query: '', results: [] });
      }

      // Scope-based permission + parameter assembly
      const params: { query: string; spaceId?: string; organizationId?: string; includeSystem?: boolean; limit: number } = {
        query: q,
        limit,
        includeSystem: true,
      };

      if (scope === 'system') {
        if (currentUser.role !== 'global_admin') {
          return res.status(403).json({ error: 'Only global admins can search system documents' });
        }
        // System-only: do not surface org/workspace docs.
        // (no extra filters needed)
      } else if (scope === 'organization') {
        if (!scopeId) return res.status(400).json({ error: 'scopeId required for organization scope' });
        if (currentUser.role !== 'global_admin') {
          if (currentUser.role !== 'company_admin' || currentUser.organizationId !== scopeId) {
            const cas = await storage.getCompanyAdminsByUser(currentUser.id);
            if (!cas.some((ca) => ca.organizationId === scopeId)) {
              return res.status(403).json({ error: 'Insufficient permissions' });
            }
          }
        }
        params.organizationId = scopeId;
      } else if (scope === 'workspace') {
        if (!scopeId) return res.status(400).json({ error: 'scopeId required for workspace scope' });
        const space = await storage.getSpace(scopeId);
        if (!space) return res.status(404).json({ error: 'Workspace not found' });
        let ok = false;
        if (currentUser.role === 'global_admin') ok = true;
        else if (currentUser.role === 'company_admin' && currentUser.organizationId === space.organizationId) ok = true;
        else {
          const facs = await storage.getSpaceFacilitatorsBySpace(scopeId);
          ok = facs.some((f) => f.userId === currentUser.id);
        }
        if (!ok) return res.status(403).json({ error: 'Insufficient permissions' });
        params.spaceId = scopeId;
        params.organizationId = space.organizationId ?? undefined;
      } else {
        return res.status(400).json({ error: 'Invalid scope' });
      }

      const results = await storage.searchKnowledgeBaseChunks(params);
      // Escape snippet HTML before reintroducing controlled <b> tags.
      const escapeHtml = (s: string) => s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
      const safeResults = results.map((r) => ({
        ...r,
        snippet: escapeHtml(r.snippet)
          .replace(/__KB_HL_START__/g, '<b>')
          .replace(/__KB_HL_END__/g, '</b>'),
      }));
      res.json({ query: q, results: safeResults });
    } catch (error) {
      console.error('Failed to search knowledge base:', error);
      res.status(500).json({ error: 'Failed to search knowledge base' });
    }
  });

  // Delete a document
  app.delete("/api/knowledge-base/documents/:id", requireAuth, async (req, res) => {
    try {
      const currentUser = req.user as User;
      const { id } = req.params;

      const document = await storage.getKnowledgeBaseDocument(id);
      if (!document) {
        return res.status(404).json({ error: "Document not found" });
      }

      // Check permissions based on scope
      let hasPermission = false;

      if (document.scope === 'system') {
        hasPermission = currentUser.role === 'global_admin';
      } else if (document.scope === 'organization' && document.organizationId) {
        if (currentUser.role === 'global_admin') {
          hasPermission = true;
        } else if (currentUser.role === 'company_admin' && currentUser.organizationId === document.organizationId) {
          hasPermission = true;
        } else {
          const companyAdmins = await storage.getCompanyAdminsByUser(currentUser.id);
          hasPermission = companyAdmins.some(ca => ca.organizationId === document.organizationId);
        }
      } else if (document.scope === 'workspace' && document.spaceId) {
        const space = await storage.getSpace(document.spaceId);
        if (space) {
          if (currentUser.role === 'global_admin') {
            hasPermission = true;
          } else if (currentUser.role === 'company_admin' && currentUser.organizationId === space.organizationId) {
            hasPermission = true;
          } else {
            const facilitators = await storage.getSpaceFacilitatorsBySpace(document.spaceId);
            hasPermission = facilitators.some(f => f.userId === currentUser.id);
          }
        }
      }

      // Also allow the uploader to delete their own document
      if (document.uploadedBy === currentUser.id) {
        hasPermission = true;
      }

      if (!hasPermission) {
        return res.status(403).json({ error: "Insufficient permissions to delete this document" });
      }

      // Delete file from filesystem
      await fileUploadService.deleteFile(document.filePath);

      // Delete document record
      await storage.deleteKnowledgeBaseDocument(id);

      res.json({ success: true });
    } catch (error) {
      console.error("Failed to delete document:", error);
      res.status(500).json({ error: "Failed to delete document" });
    }
  });

  // Workspace Templates
  // Create template from existing workspace
  app.post("/api/templates", requireAuth, async (req, res) => {
    try {
      const currentUser = req.user as User;
      const data = z.object({
        spaceId: z.string().min(1, "Workspace ID is required"),
        name: z.string().min(1, "Template name is required").trim(),
        type: z.string().min(1, "Template type is required").trim(),
        description: z.string().trim().optional(),
      }).parse(req.body);

      // Handle both workspace codes (nnnn-nnnn) and UUIDs/IDs
      const isWorkspaceCode = /^\d{4}-\d{4}$/.test(data.spaceId);
      const space = isWorkspaceCode 
        ? await storage.getSpaceByCode(data.spaceId)
        : await storage.getSpace(data.spaceId);
      
      if (!space) {
        return res.status(404).json({ error: "Workspace not found" });
      }

      // Check permissions: must be global admin, company admin of the org, or facilitator of the workspace
      let hasPermission = false;
      if (currentUser.role === 'global_admin') {
        hasPermission = true;
      } else if (currentUser.role === 'company_admin' && currentUser.organizationId === space.organizationId) {
        hasPermission = true;
      } else {
        const facilitators = await storage.getSpaceFacilitatorsBySpace(space.id);
        hasPermission = facilitators.some(f => f.userId === currentUser.id);
      }

      if (!hasPermission) {
        return res.status(403).json({ error: "Insufficient permissions to create template from this workspace" });
      }

      const template = await storage.createWorkspaceTemplateFromSpace(
        space.id,
        data.name,
        data.type,
        data.description,
        currentUser.id
      );

      res.status(201).json(template);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      console.error("Failed to create template:", error);
      res.status(500).json({ error: "Failed to create template" });
    }
  });

  // List templates
  app.get("/api/templates", requireAuth, async (req, res) => {
    try {
      const currentUser = req.user as User;
      const { organizationId } = req.query;

      let templates;
      
      // Global admins can see all templates or filter by organization
      if (currentUser.role === 'global_admin') {
        if (organizationId && typeof organizationId === 'string') {
          templates = await storage.getWorkspaceTemplates(organizationId);
        } else {
          templates = await storage.getWorkspaceTemplates();
        }
      } 
      // Company admins can only see templates for their organization
      else if (currentUser.role === 'company_admin') {
        if (!currentUser.organizationId) {
          return res.status(403).json({ error: "No organization associated with user" });
        }
        // Ignore organizationId query param if provided by company admin - always use their org
        templates = await storage.getWorkspaceTemplates(currentUser.organizationId);
      }
      // Other roles (facilitator, user) can see templates for their organization
      else {
        if (!currentUser.organizationId) {
          return res.status(403).json({ error: "No organization associated with user" });
        }
        templates = await storage.getWorkspaceTemplates(currentUser.organizationId);
      }

      res.json(templates);
    } catch (error) {
      console.error("Failed to fetch templates:", error);
      res.status(500).json({ error: "Failed to fetch templates" });
    }
  });

  // Delete template
  app.delete("/api/templates/:id", requireAuth, async (req, res) => {
    try {
      const currentUser = req.user as User;
      const { id } = req.params;

      const template = await storage.getWorkspaceTemplate(id);
      if (!template) {
        return res.status(404).json({ error: "Template not found" });
      }

      // Check permissions
      let hasPermission = false;
      if (currentUser.role === 'global_admin') {
        hasPermission = true;
      } else if (template.organizationId && currentUser.organizationId === template.organizationId) {
        if (currentUser.role === 'company_admin') {
          hasPermission = true;
        } else if (template.createdBy === currentUser.id) {
          // Allow creator to delete their own template
          hasPermission = true;
        }
      }

      if (!hasPermission) {
        return res.status(403).json({ error: "Insufficient permissions to delete this template" });
      }

      await storage.deleteWorkspaceTemplate(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to delete template:", error);
      res.status(500).json({ error: "Failed to delete template" });
    }
  });

  // ============================================================
  // Unified CSV Import (Admin) — templates, users, ideas
  // ============================================================
  type DbValidationError = { rowIndex: number; row: number; field?: string; message: string };
  type ImportRow = TemplateCsvRow | UserCsvRow | IdeaCsvRow;

  async function validateImportAgainstDb(
    type: CsvImportType,
    rows: ImportRow[],
    sourceRows: number[],
    user: User,
  ): Promise<DbValidationError[]> {
    const errors: DbValidationError[] = [];
    if (rows.length === 0) return errors;
    const rowOf = (i: number) => sourceRows[i] ?? (i + 2);

    if (type === "users") {
      const allOrgs = await storage.getAllOrganizations();
      const orgKey = (s: string) => s.toLowerCase();
      const bySlug = new Map(allOrgs.map((o) => [orgKey(o.slug), o]));
      const byName = new Map(allOrgs.map((o) => [orgKey(o.name), o]));
      // Within-CSV duplicate-email detection: catch repeats before they hit
      // the unique constraint on users.email at confirm-time.
      const seenEmail = new Map<string, number>();
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i] as UserCsvRow;
        const sourceRow = rowOf(i);
        const emailKey = r.email.toLowerCase();
        const firstAt = seenEmail.get(emailKey);
        if (firstAt !== undefined) {
          errors.push({ rowIndex: i, row: sourceRow, field: "email", message: `Duplicate email in CSV (first appears at row ${firstAt}): ${r.email}` });
          continue;
        }
        seenEmail.set(emailKey, sourceRow);
        let orgId: string | null = null;
        if (r.organization) {
          const found = bySlug.get(orgKey(r.organization)) ?? byName.get(orgKey(r.organization));
          if (!found) {
            errors.push({ rowIndex: i, row: sourceRow, field: "organization", message: `Unknown organization: ${r.organization}` });
            continue;
          }
          orgId = found.id;
        }
        if (r.role !== "global_admin" && !orgId) {
          errors.push({ rowIndex: i, row: sourceRow, field: "organization", message: "organization is required unless role is global_admin" });
          continue;
        }
        if (user.role === "company_admin") {
          if (r.role === "global_admin" || r.role === "company_admin") {
            errors.push({ rowIndex: i, row: sourceRow, field: "role", message: "Company admins cannot create admin users" });
            continue;
          }
          if (orgId !== user.organizationId) {
            errors.push({ rowIndex: i, row: sourceRow, field: "organization", message: "Company admins can only create users in their own organization" });
            continue;
          }
        }
        const existing = await storage.getUserByEmail(r.email);
        if (existing) {
          errors.push({ rowIndex: i, row: sourceRow, field: "email", message: `Email already registered: ${r.email}` });
        }
      }
    } else if (type === "ideas") {
      const codeCache = new Map<string, Space | undefined>();
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i] as IdeaCsvRow;
        const sourceRow = rowOf(i);
        let space = codeCache.get(r.workspaceCode);
        if (space === undefined) {
          space = await storage.getSpaceByCode(r.workspaceCode);
          codeCache.set(r.workspaceCode, space);
        }
        if (!space) {
          errors.push({ rowIndex: i, row: sourceRow, field: "workspaceCode", message: `Workspace not found: ${r.workspaceCode}` });
          continue;
        }
        if (user.role === "company_admin" && space.organizationId !== user.organizationId) {
          errors.push({ rowIndex: i, row: sourceRow, field: "workspaceCode", message: `No access to workspace ${r.workspaceCode}` });
        }
      }
    } else if (type === "templates") {
      const targetOrgId = user.organizationId;
      const existing = await storage.getAllTemplates();
      const existingNames = new Set(
        existing
          .filter((s) => targetOrgId ? s.organizationId === targetOrgId : s.templateScope === "system")
          .map((s) => s.name.toLowerCase()),
      );
      // Within-CSV duplicate-name detection so a unique-name collision is
      // surfaced at preview time instead of failing mid-transaction.
      const seenName = new Map<string, number>();
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i] as TemplateCsvRow;
        const key = r.name.toLowerCase();
        const firstAt = seenName.get(key);
        if (firstAt !== undefined) {
          errors.push({ rowIndex: i, row: rowOf(i), field: "name", message: `Duplicate template name in CSV (first appears at row ${firstAt}): ${r.name}` });
          continue;
        }
        seenName.set(key, rowOf(i));
        if (existingNames.has(key)) {
          errors.push({ rowIndex: i, row: rowOf(i), field: "name", message: `Template name already exists: ${r.name}` });
        }
      }
    }
    return errors;
  }

  // Status for background import jobs (e.g. invitation-email sending after a
  // user import). Scoped to the admin who started the job; global admins can
  // view any job for ops/debugging.
  app.get("/api/admin/imports/jobs/:id", requireCompanyAdmin, async (req, res) => {
    const currentUser = req.user as User;
    const job = getImportJob(req.params.id);
    if (!job) return res.status(404).json({ error: "Job not found" });
    if (job.ownerUserId !== currentUser.id && currentUser.role !== "global_admin") {
      return res.status(403).json({ error: "Forbidden" });
    }
    res.json({
      id: job.id,
      kind: job.kind,
      status: job.status,
      total: job.total,
      processed: job.processed,
      succeeded: job.succeeded,
      failed: job.failed,
      failures: job.failures,
      startedAt: job.startedAt,
      finishedAt: job.finishedAt ?? null,
    });
  });

  app.post("/api/admin/imports/preview", requireCompanyAdmin, upload.single("file"), async (req, res) => {
    try {
      const type = String(req.body?.type ?? "") as CsvImportType;
      if (!CSV_IMPORT_TYPES.includes(type)) {
        return res.status(400).json({ error: `type must be one of: ${CSV_IMPORT_TYPES.join(", ")}` });
      }
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }
      const csvText = req.file.buffer.toString("utf-8");
      const defaultWorkspaceCode = typeof req.body?.defaultWorkspaceCode === "string" && req.body.defaultWorkspaceCode.trim()
        ? req.body.defaultWorkspaceCode.trim()
        : undefined;
      const preview = buildCsvPreview<ImportRow>(type, csvText, { defaultWorkspaceCode });

      // Augment with DB-aware checks so the preview surfaces referential and
      // tenant-authorization failures before the user clicks Confirm.
      const currentUser = req.user as User;
      const dbErrors = await validateImportAgainstDb(type, preview.validRows, preview.sourceRows, currentUser);
      if (dbErrors.length > 0) {
        const validIdsToDrop = new Set(dbErrors.map((e) => e.rowIndex));
        const filteredRows: ImportRow[] = [];
        const filteredSourceRows: number[] = [];
        preview.validRows.forEach((r, i) => {
          if (!validIdsToDrop.has(i)) {
            filteredRows.push(r);
            filteredSourceRows.push(preview.sourceRows[i]);
          }
        });
        preview.validRows = filteredRows;
        preview.sourceRows = filteredSourceRows;
        preview.errors.push(...dbErrors.map((e) => ({ row: e.row, field: e.field, message: e.message })));
        // Recompute invalidCount as distinct invalid rows, not total issue count
        preview.invalidCount = new Set(preview.errors.map((e) => e.row)).size;
      }

      const wantsCsv = String(req.query?.format ?? "") === "errors-csv";
      if (wantsCsv) {
        res.setHeader("Content-Type", "text/csv");
        res.setHeader("Content-Disposition", `attachment; filename="import-errors-${type}.csv"`);
        return res.send(buildErrorReportCsv(preview));
      }
      res.json(preview);
    } catch (error) {
      console.error("CSV preview failed:", error);
      res.status(500).json({ error: "Failed to parse CSV" });
    }
  });

  // Confirm: Templates — creates template *spaces* (isTemplate=true) so they
  // appear in the existing template picker (/api/templates/spaces).
  app.post("/api/admin/imports/templates/confirm", requireCompanyAdmin, async (req, res) => {
    try {
      const currentUser = req.user as User;
      const body = csvConfirmTemplatesBodySchema.parse(req.body);

      // Permission/scope rules:
      // - company_admin: always organization-scope (their own org)
      // - global_admin: respects ?scope=organization|system; defaults to
      //   "organization" if they have an organization, else "system"
      const requestedScope = String(req.query?.scope ?? "");
      let templateScope: "system" | "organization";
      if (currentUser.role === "global_admin") {
        if (requestedScope === "system" || requestedScope === "organization") {
          templateScope = requestedScope;
        } else {
          templateScope = currentUser.organizationId ? "organization" : "system";
        }
      } else {
        templateScope = "organization";
      }
      const targetOrgId = templateScope === "system" ? null : (currentUser.organizationId ?? null);
      if (templateScope === "organization" && !targetOrgId) {
        return res.status(403).json({ error: "Cannot create organization template without an organization" });
      }

      const created = await db.transaction(async (tx) => {
        const out: { id: string; name: string; noteCount: number; categoryCount: number; code: string }[] = [];
        for (const row of body.rows) {
          let code = await generateWorkspaceCode();
          const [collision] = await tx.select().from(spaces).where(eq(spaces.code, code)).limit(1);
          if (collision) code = await generateWorkspaceCode();

          // Imported templates use explicit defaults for all configuration
          // fields the cloneWorkspaceFromTemplate path reads, so cloned
          // workspaces are fully functional. The CSV schema deliberately
          // captures only name/description/ideas/categories per the task
          // spec; remaining fields fall back to safe shared defaults that
          // mirror the schema-level defaults in `spaces`.
          const spaceValues: InsertSpace = {
            organizationId: targetOrgId,
            code,
            name: row.name,
            purpose: row.description ?? `Template: ${row.name}`,
            hidden: true,
            status: "archived",
            isTemplate: true,
            templateScope,
            createdBy: currentUser.id,
            sessionMode: "live",
            pairwiseScope: "all",
            marketplaceCoinBudget: 100,
            guestAllowed: false,
          };
          const [tplSpace] = await tx.insert(spaces).values(spaceValues).returning();

          const [tplParticipant] = await tx.insert(participants).values({
            spaceId: tplSpace.id,
            displayName: "Template",
            isGuest: true,
            isOnline: false,
          }).returning();

          const catByName = new Map<string, { id: string }>();
          for (const cat of row.categories) {
            const key = cat.name.toLowerCase();
            if (catByName.has(key)) continue;
            const color = cat.color
              ?? `#${Math.floor(Math.random() * 16777215).toString(16).padStart(6, "0")}`;
            const [created] = await tx.insert(categories).values({
              spaceId: tplSpace.id,
              name: cat.name,
              color,
            }).returning();
            catByName.set(key, created);
          }
          // Auto-create categories referenced by ideas but not declared explicitly
          for (const idea of row.ideas) {
            if (!idea.category) continue;
            const key = idea.category.toLowerCase();
            if (catByName.has(key)) continue;
            const [created] = await tx.insert(categories).values({
              spaceId: tplSpace.id,
              name: idea.category,
              color: `#${Math.floor(Math.random() * 16777215).toString(16).padStart(6, "0")}`,
            }).returning();
            catByName.set(key, created);
          }

          for (const idea of row.ideas) {
            const catId = idea.category
              ? (catByName.get(idea.category.toLowerCase())?.id ?? null)
              : null;
            await tx.insert(notes).values({
              spaceId: tplSpace.id,
              participantId: tplParticipant.id,
              content: idea.text,
              manualCategoryId: catId,
              isManualOverride: catId !== null,
            });
          }
          out.push({
            id: tplSpace.id,
            name: row.name,
            noteCount: row.ideas.length,
            categoryCount: catByName.size,
            code,
          });
        }
        return out;
      });

      res.status(201).json({ success: true, templates: created });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      console.error("Templates import failed:", error);
      res.status(500).json({ error: "Failed to import templates" });
    }
  });

  // Confirm: Users
  app.post("/api/admin/imports/users/confirm", requireCompanyAdmin, async (req, res) => {
    try {
      const currentUser = req.user as User;
      const body = csvConfirmUsersBodySchema.parse(req.body);

      // Resolve organizations (slug or name) to IDs and validate permissions
      const allOrgs = await storage.getAllOrganizations();
      const bySlug = new Map(allOrgs.map((o) => [o.slug.toLowerCase(), o]));
      const byName = new Map(allOrgs.map((o) => [o.name.toLowerCase(), o]));

      type ResolvedRow = (typeof body.rows)[number] & { organizationId: string | null; sourceRow: number };
      const resolvedRows: ResolvedRow[] = [];
      const failures: { row: number; message: string }[] = [];

      // Use the original CSV row numbers from the preview when the client
      // sends them; otherwise fall back to a 1-based offset. This keeps
      // confirm-time errors aligned with the user's CSV.
      const clientSourceRows = Array.isArray((req.body as { sourceRows?: unknown }).sourceRows)
        ? ((req.body as { sourceRows?: unknown[] }).sourceRows as unknown[]).map((v) => Number(v))
        : null;

      // Defensive: catch within-payload duplicate emails so a uniqueness
      // violation never reaches the transaction as a generic 500.
      const seenEmail = new Map<string, number>();

      body.rows.forEach((row, idx) => {
        const sourceRow = clientSourceRows && Number.isFinite(clientSourceRows[idx])
          ? clientSourceRows[idx]
          : idx + 2;
        const emailKey = row.email.toLowerCase();
        const firstAt = seenEmail.get(emailKey);
        if (firstAt !== undefined) {
          failures.push({ row: sourceRow, message: `Duplicate email in payload (first appears at row ${firstAt}): ${row.email}` });
          return;
        }
        seenEmail.set(emailKey, sourceRow);
        let organizationId: string | null = null;
        if (row.organization) {
          const key = row.organization.toLowerCase();
          const org = bySlug.get(key) ?? byName.get(key);
          if (!org) {
            failures.push({ row: sourceRow, message: `Unknown organization: ${row.organization}` });
            return;
          }
          organizationId = org.id;
        }
        if (row.role !== "global_admin" && !organizationId) {
          failures.push({ row: sourceRow, message: "organization is required unless role is global_admin" });
          return;
        }
        if (currentUser.role === "company_admin") {
          if (row.role === "global_admin" || row.role === "company_admin") {
            failures.push({ row: sourceRow, message: "Company admins cannot create admin users" });
            return;
          }
          if (organizationId !== currentUser.organizationId) {
            failures.push({ row: sourceRow, message: "Company admins can only create users in their own organization" });
            return;
          }
        }
        resolvedRows.push({ ...row, organizationId, sourceRow });
      });

      if (failures.length > 0) {
        return res.status(400).json({ error: "Row-level authorization failures", failures });
      }

      // Pre-check email uniqueness up-front for clearer errors
      const dupes: { row: number; email: string }[] = [];
      for (let i = 0; i < resolvedRows.length; i++) {
        const existing = await storage.getUserByEmail(resolvedRows[i].email);
        if (existing) dupes.push({ row: resolvedRows[i].sourceRow, email: resolvedRows[i].email });
      }
      if (dupes.length > 0) {
        return res.status(409).json({ error: "Some emails are already registered", duplicates: dupes });
      }

      // Pre-hash random passwords outside the transaction (bcrypt is slow and
      // we don't want to hold a tx open during it).
      const prepped = await Promise.all(resolvedRows.map(async (row) => {
        const tempPassword = randomBytes(16).toString("hex");
        const hashed = await hashPassword(tempPassword);
        const username = row.email; // Username collisions guarded by DB unique constraint
        return { row, hashed, username };
      }));

      const created = await db.transaction(async (tx) => {
        const out: { id: string; email: string; organizationId: string | null }[] = [];
        for (const { row, hashed, username } of prepped) {
          const [user] = await tx.insert(users).values({
            email: row.email,
            username,
            password: hashed,
            displayName: row.displayName,
            role: row.role,
            organizationId: row.organizationId,
            authProvider: "local",
            emailVerified: false,
          }).returning();

          // Mirror /api/admin/users behavior: assign to default project
          if (user.organizationId) {
            const orgProjects = await tx.select().from(projects).where(eq(projects.organizationId, user.organizationId));
            const def = orgProjects.find((p) => p.isDefault) ?? orgProjects[0];
            if (def) {
              await tx.insert(projectMembers).values({
                projectId: def.id,
                userId: user.id,
                role: row.role === "company_admin" ? "admin" : "member",
              }).onConflictDoNothing();
            }
            // company_admin role requires a row in the company_admins
            // association table — without it, downstream authz checks
            // (org-scoped permissions, notifications) skip the user.
            if (row.role === "company_admin") {
              await tx.insert(companyAdminsTable).values({
                userId: user.id,
                organizationId: user.organizationId,
              });
            }
          }
          out.push({ id: user.id, email: user.email, organizationId: user.organizationId });
        }
        return out;
      });

      // After commit, queue invite-email work to a lightweight background
      // job so the HTTP request returns immediately even for large imports
      // (SendGrid sends are network-bound and used to hold the request long
      // enough to hit a load-balancer timeout, surfacing as a "failed" toast
      // even though every user was created). Progress is observable via
      // GET /api/admin/imports/jobs/:id.
      let jobId: string | null = null;
      let queuedInvites = 0;
      if (body.sendInvites && created.length > 0) {
        queuedInvites = created.length;
        const protocol = req.protocol;
        const host = req.get("host") ?? "";
        const baseUrl = `${protocol}://${host}`;
        const job = createImportJob("user-invites", queuedInvites, currentUser.id);
        jobId = job.id;

        const facilitatorName = currentUser.displayName ?? currentUser.email;
        const inviteWork = created.map((user, i) => ({ user, row: resolvedRows[i] }));

        setImmediate(() => {
          void (async () => {
            markJobRunning(job.id);
            for (const { user, row } of inviteWork) {
              try {
                const token = randomBytes(32).toString("hex");
                const expiresAt = new Date();
                expiresAt.setDate(expiresAt.getDate() + 7);
                await storage.createPasswordResetToken({
                  userId: user.id,
                  token,
                  expiresAt,
                  used: false,
                });
                const orgName = row.organizationId
                  ? (allOrgs.find((o) => o.id === row.organizationId)?.name ?? "Your Organization")
                  : "Nebula";
                await sendSessionInviteEmail(user.email, {
                  inviteeName: row.displayName,
                  role: row.role === "facilitator" || row.role === "company_admin" || row.role === "global_admin" ? "facilitator" : "participant",
                  organizationName: orgName,
                  workspaceName: "Nebula Account",
                  workspaceCode: "----",
                  joinUrl: `${baseUrl}/reset-password?token=${token}`,
                  facilitatorName,
                  personalMessage: "An admin has created a Nebula account for you. Click the link to set your password and sign in. The link is valid for 7 days.",
                });
                recordJobSuccess(job.id);
              } catch (emailErr) {
                console.error(`Failed to send invite to ${user.email}:`, emailErr);
                recordJobFailure(job.id, user.email, emailErr instanceof Error ? emailErr.message : "send failed");
              }
            }
            finishJob(job.id);
          })();
        });
      }

      res.status(201).json({ success: true, created: created.length, queuedInvites, jobId });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      console.error("Users import failed:", error);
      res.status(500).json({ error: "Failed to import users" });
    }
  });

  // Confirm: Ideas
  app.post("/api/admin/imports/ideas/confirm", requireCompanyAdmin, async (req, res) => {
    try {
      const currentUser = req.user as User;
      const body = csvConfirmIdeasBodySchema.parse(req.body);

      // Group rows by workspace code, resolve to spaces, and verify access
      const codeGroups = new Map<string, typeof body.rows>();
      for (const row of body.rows) {
        const key = row.workspaceCode;
        if (!codeGroups.has(key)) codeGroups.set(key, []);
        codeGroups.get(key)!.push(row);
      }

      type Resolved = { space: Space; rows: typeof body.rows };
      const resolved: Resolved[] = [];
      for (const [code, rows] of Array.from(codeGroups.entries())) {
        const space = await storage.getSpaceByCode(code);
        if (!space) {
          return res.status(404).json({ error: `Workspace not found for code: ${code}` });
        }
        if (currentUser.role === "company_admin" && space.organizationId !== currentUser.organizationId) {
          return res.status(403).json({ error: `No access to workspace ${code}` });
        }
        resolved.push({ space, rows });
      }

      const totals = { notes: 0, categories: 0, spaces: resolved.length };
      const broadcastBuckets: { spaceId: string; notes: typeof notes.$inferSelect[] }[] = [];

      await db.transaction(async (tx) => {
        for (const { space, rows } of resolved) {
          // Reuse or create a "CSV Import" participant per workspace.
          const existing = await tx.select().from(participants)
            .where(eq(participants.spaceId, space.id));
          let importer = existing.find((p) => p.displayName === "CSV Import");
          if (!importer) {
            const [created] = await tx.insert(participants).values({
              spaceId: space.id,
              displayName: "CSV Import",
              isGuest: true,
              isOnline: false,
            }).returning();
            importer = created;
          }

          const cats = await tx.select().from(categories).where(eq(categories.spaceId, space.id));
          const catByName = new Map(cats.map((c) => [c.name.toLowerCase(), c]));
          const newNotes: (typeof notes.$inferSelect)[] = [];

          for (const row of rows) {
            let categoryId: string | null = null;
            if (row.category) {
              const key = row.category.toLowerCase();
              let existingCat = catByName.get(key);
              if (!existingCat) {
                const [cat] = await tx.insert(categories).values({
                  spaceId: space.id,
                  name: row.category,
                  color: `#${Math.floor(Math.random() * 16777215).toString(16).padStart(6, "0")}`,
                }).returning();
                catByName.set(key, cat);
                existingCat = cat;
                totals.categories++;
              }
              categoryId = existingCat.id;
            }
            const [note] = await tx.insert(notes).values({
              spaceId: space.id,
              participantId: importer.id,
              content: row.text,
              manualCategoryId: categoryId,
              isManualOverride: categoryId !== null,
            }).returning();
            newNotes.push(note);
            totals.notes++;
          }
          broadcastBuckets.push({ spaceId: space.id, notes: newNotes });
        }
      });

      // Broadcast after commit so live participants see the new ideas.
      // Small workspaces still receive per-note `note_created` events so
      // participant views can animate each card; large workspaces are
      // batched into a single `notes_bulk_imported` event (carrying the new
      // notes inline) to avoid flooding every connected client with N
      // messages per workspace, which previously slowed the request and
      // hammered the WS layer for big imports.
      const PER_NOTE_BROADCAST_LIMIT = 50;
      for (const bucket of broadcastBuckets) {
        if (bucket.notes.length === 0) continue;
        for (const note of bucket.notes) {
          void storage.recordPulseActivity(bucket.spaceId, "ideation", note.participantId);
        }
        if (bucket.notes.length <= PER_NOTE_BROADCAST_LIMIT) {
          for (const note of bucket.notes) {
            broadcastToSpace(bucket.spaceId, { type: "note_created", data: note });
          }
        }
        broadcastToSpace(bucket.spaceId, {
          type: "notes_bulk_imported",
          data: {
            count: bucket.notes.length,
            batched: bucket.notes.length > PER_NOTE_BROADCAST_LIMIT,
          },
        });
      }

      res.status(201).json({ success: true, ...totals });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      console.error("Ideas import failed:", error);
      res.status(500).json({ error: "Failed to import ideas" });
    }
  });

  // Simplified Template System (using isTemplate flag on spaces table)
  // IMPORTANT: This route must come BEFORE /api/templates/:id to avoid route conflict
  // Get workspace templates (system + org templates)
  app.get("/api/templates/spaces", requireAuth, async (req, res) => {
    try {
      const currentUser = req.user as User;
      
      let templates: Space[];
      
      if (currentUser.role === 'global_admin') {
        // Global admins see ALL templates (system + all organization templates)
        templates = await storage.getAllTemplates();
      } else {
        // Other users see system templates + their organization's templates
        templates = await storage.getTemplates(currentUser.organizationId || undefined);
      }
      
      res.json(templates);
    } catch (error) {
      console.error("Failed to fetch workspace templates:", error);
      res.status(500).json({ error: "Failed to fetch templates" });
    }
  });

  // Get template details (notes and documents) - OLD SYSTEM
  app.get("/api/templates/:id", requireAuth, async (req, res) => {
    try {
      const currentUser = req.user as User;
      const { id } = req.params;

      const template = await storage.getWorkspaceTemplate(id);
      if (!template) {
        return res.status(404).json({ error: "Template not found" });
      }

      // Check permissions
      let hasPermission = false;
      if (currentUser.role === 'global_admin') {
        hasPermission = true;
      } else if (template.organizationId && currentUser.organizationId === template.organizationId) {
        hasPermission = true;
      } else if (!template.organizationId) {
        // System templates are accessible to all
        hasPermission = true;
      }

      if (!hasPermission) {
        return res.status(403).json({ error: "Insufficient permissions to view this template" });
      }

      const [notes, documents] = await Promise.all([
        storage.getWorkspaceTemplateNotes(id),
        storage.getWorkspaceTemplateDocuments(id),
      ]);

      res.json({
        ...template,
        notes,
        documents,
      });
    } catch (error) {
      console.error("Failed to fetch template details:", error);
      res.status(500).json({ error: "Failed to fetch template details" });
    }
  });

  // Create a template snapshot from a workspace
  app.post("/api/workspaces/:id/mark-as-template", requireAuth, async (req, res) => {
    try {
      const currentUser = req.user as User;
      const { id } = req.params;
      const { templateScope } = req.body;

      // Resolve workspace ID (supports both UUID and workspace code)
      const workspaceId = await resolveWorkspaceId(id);
      if (!workspaceId) {
        return res.status(404).json({ error: "Workspace not found" });
      }

      // Validate templateScope
      if (templateScope !== 'system' && templateScope !== 'organization') {
        return res.status(400).json({ error: "Invalid template scope. Must be 'system' or 'organization'" });
      }

      // Only global admins can create system templates
      if (templateScope === 'system' && currentUser.role !== 'global_admin') {
        return res.status(403).json({ error: "Only global admins can create system templates" });
      }

      // Verify workspace exists and user has permission
      const workspace = await storage.getSpace(workspaceId);
      if (!workspace) {
        return res.status(404).json({ error: "Workspace not found" });
      }

      // Check permissions for organization templates
      if (templateScope === 'organization') {
        if (currentUser.role !== 'global_admin' && currentUser.role !== 'company_admin') {
          return res.status(403).json({ error: "Insufficient permissions to create organization templates" });
        }
        if (currentUser.role === 'company_admin' && workspace.organizationId !== currentUser.organizationId) {
          return res.status(403).json({ error: "Cannot create template for another organization" });
        }
      }

      // Create a frozen snapshot copy as the template (not the original workspace)
      const templateSnapshot = await storage.createTemplateSnapshot(workspaceId, templateScope);
      res.json(templateSnapshot);
    } catch (error) {
      console.error("Failed to create template snapshot:", error);
      res.status(500).json({ error: "Failed to create template snapshot" });
    }
  });

  // Unmark a workspace as a template
  app.post("/api/workspaces/:id/unmark-as-template", requireAuth, async (req, res) => {
    try {
      const currentUser = req.user as User;
      const { id } = req.params;

      // Resolve workspace ID (supports both UUID and workspace code)
      const workspaceId = await resolveWorkspaceId(id);
      if (!workspaceId) {
        return res.status(404).json({ error: "Workspace not found" });
      }

      const workspace = await storage.getSpace(workspaceId);
      if (!workspace) {
        return res.status(404).json({ error: "Workspace not found" });
      }

      // Only global admins can unmark system templates
      if (workspace.templateScope === 'system' && currentUser.role !== 'global_admin') {
        return res.status(403).json({ error: "Only global admins can unmark system templates" });
      }

      // Check permissions for organization templates
      if (workspace.templateScope === 'organization') {
        if (currentUser.role !== 'global_admin' && currentUser.role !== 'company_admin') {
          return res.status(403).json({ error: "Insufficient permissions to unmark organization templates" });
        }
        if (currentUser.role === 'company_admin' && workspace.organizationId !== currentUser.organizationId) {
          return res.status(403).json({ error: "Cannot unmark template for another organization" });
        }
      }

      const updatedWorkspace = await storage.unmarkWorkspaceAsTemplate(workspaceId);
      res.json(updatedWorkspace);
    } catch (error) {
      console.error("Failed to unmark workspace as template:", error);
      res.status(500).json({ error: "Failed to unmark workspace as template" });
    }
  });

  // Participants
  app.get("/api/spaces/:spaceId/participants", async (req, res) => {
    try {
      const spaceId = await resolveWorkspaceId(req.params.spaceId);
      if (!spaceId) {
        return res.status(404).json({ error: "Workspace not found" });
      }
      const participants = await storage.getParticipantsBySpace(spaceId);
      res.json(participants);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch participants" });
    }
  });

  app.post("/api/participants", async (req, res) => {
    try {
      const data = insertParticipantSchema.parse(req.body);
      
      // Resolve workspace code to UUID if needed
      const spaceId = await resolveWorkspaceId(data.spaceId);
      if (!spaceId) {
        return res.status(404).json({ error: "Space not found" });
      }
      
      // Verify that the space exists
      const space = await storage.getSpace(spaceId);
      if (!space) {
        return res.status(404).json({ error: "Space not found" });
      }
      
      const participant = await storage.createParticipant({
        ...data,
        spaceId, // Use resolved UUID
      });
      
      // Store participant ID in session for authentication
      if (req.session) {
        req.session.participantId = participant.id;
      }

      // Broadcast to both raw and resolved keys (clients may connect by code)
      const joinPayload = {
        type: "participant_joined",
        data: { spaceId, participantId: participant.id, displayName: participant.displayName },
      };
      broadcastToSpace(spaceId, joinPayload);
      if (data.spaceId !== spaceId) broadcastToSpace(data.spaceId, joinPayload);
      try {
        const facilitators = await storage.getSpaceFacilitatorsBySpace(spaceId);
        const org = await storage.getOrganization(space.organizationId);
        const link = `/o/${org?.slug || space.organizationId}/s/${space.code || spaceId}`;
        await Promise.all(facilitators.map(f => notifyUser({
          userId: f.userId,
          type: "participant_joined",
          title: `${participant.displayName} joined ${space.name}`,
          body: null,
          link,
          spaceId,
        })));
      } catch (e) { console.error("[notify participant_joined]", e); }
      
      res.status(201).json(participant);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to create participant" });
    }
  });

  app.patch("/api/participants/:id", async (req, res) => {
    try {
      const data = insertParticipantSchema.partial().parse(req.body);
      const participant = await storage.updateParticipant(req.params.id, data);
      if (!participant) {
        return res.status(404).json({ error: "Participant not found" });
      }
      res.json(participant);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to update participant" });
    }
  });

  // Notes
  app.get("/api/spaces/:spaceId/notes", async (req, res) => {
    try {
      const spaceId = await resolveWorkspaceId(req.params.spaceId);
      if (!spaceId) {
        return res.status(404).json({ error: "Workspace not found" });
      }
      const notes = await storage.getNotesBySpace(spaceId);
      res.json(notes);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch notes" });
    }
  });

  app.post("/api/notes", createWorkspaceAccessMiddleware({ requireOpen: true }), async (req, res) => {
    try {
      const data = insertNoteSchema.parse(req.body);
      
      // Security: Verify participantId ownership
      // Facilitators/admins can create notes on behalf of participants (preloading)
      // Participants can only create notes as themselves (use session participantId)
      const user = req.user as User | undefined;
      const isFacilitatorOrAdmin = user && ["facilitator", "company_admin", "global_admin"].includes(user.role);
      
      // Resolve workspace code to UUID if needed
      const resolvedSpaceId = await resolveWorkspaceId(data.spaceId);
      if (!resolvedSpaceId) {
        return res.status(404).json({ error: "Workspace not found" });
      }
      data.spaceId = resolvedSpaceId;
      
      if (!isFacilitatorOrAdmin) {
        // For participants, override participantId with session value to prevent forgery
        const sessionParticipantId = req.session?.participantId;
        if (!sessionParticipantId) {
          return res.status(401).json({ error: "No participant session found. Please rejoin the workspace." });
        }
        data.participantId = sessionParticipantId;
        
        // For participants, verify ideation phase is active
        const space = await storage.getSpace(resolvedSpaceId);
        if (!space) {
          return res.status(404).json({ error: "Workspace not found" });
        }
        
        // Check if ideation phase is active by status OR time window
        const statusBasedActive = ['ideation', 'ideate'].includes(space.status.toLowerCase());
        const timeWindowActive = space.ideationStartsAt && space.ideationEndsAt && 
          new Date() >= new Date(space.ideationStartsAt) && 
          new Date() <= new Date(space.ideationEndsAt);
        
        if (!statusBasedActive && !timeWindowActive) {
          return res.status(403).json({ error: "Ideation phase is not currently active. New ideas cannot be added at this time." });
        }
      }
      
      const note = await storage.createNote(data);
      void storage.recordPulseActivity(note.spaceId, "ideation", note.participantId);

      // Broadcast to WebSocket clients in this workspace only
      broadcastToSpace(note.spaceId, { type: "note_created", data: note });
      
      res.status(201).json(note);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to create note" });
    }
  });

  app.patch("/api/notes/:id", createWorkspaceAccessMiddleware({ requireOpen: true }), async (req, res) => {
    try {
      // First, get the note to check permissions
      const existingNote = await storage.getNote(req.params.id);
      if (!existingNote) {
        return res.status(404).json({ error: "Note not found" });
      }

      // Get the space to check if it's open
      const space = await storage.getSpace(existingNote.spaceId);
      if (!space) {
        return res.status(404).json({ error: "Space not found" });
      }

      // Check permissions: 
      // 1. User is facilitator/admin (can always edit)
      // 2. OR space is "open" AND participant owns the note
      const user = req.user as User | undefined;
      const isFacilitatorOrAdmin = user && ["facilitator", "company_admin", "global_admin"].includes(user.role);
      
      // For participant edits, use session-verified participantId (not client-supplied)
      const sessionParticipantId = req.session?.participantId;
      const isOwner = existingNote.participantId === sessionParticipantId;
      const canParticipantEdit = sessionParticipantId && isOwner && space.status === "open";

      if (!isFacilitatorOrAdmin && !canParticipantEdit) {
        return res.status(403).json({ error: "You can only edit your own notes when the session is open" });
      }

      const data = insertNoteSchema.partial().parse(req.body);
      
      // If manualCategoryId is being updated, set isManualOverride flag
      if ('manualCategoryId' in data) {
        data.isManualOverride = true;
      }
      
      const note = await storage.updateNote(req.params.id, data);
      if (!note) {
        return res.status(404).json({ error: "Note not found" });
      }
      
      // Broadcast to WebSocket clients in this workspace only
      broadcastToSpace(note.spaceId, { type: "note_updated", data: note });
      
      res.json(note);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to update note" });
    }
  });

  app.delete("/api/notes/:id", createWorkspaceAccessMiddleware({ requireOpen: true }), async (req, res) => {
    try {
      // First, get the note to check permissions
      const existingNote = await storage.getNote(req.params.id);
      if (!existingNote) {
        return res.status(404).json({ error: "Note not found" });
      }

      // Get the space to check if it's open
      const space = await storage.getSpace(existingNote.spaceId);
      if (!space) {
        return res.status(404).json({ error: "Space not found" });
      }

      // Check permissions: 
      // 1. User is facilitator/admin (can always delete)
      // 2. OR space is "open" AND participant owns the note
      const user = req.user as User | undefined;
      const isFacilitatorOrAdmin = user && ["facilitator", "company_admin", "global_admin"].includes(user.role);
      
      // For participant deletes, use session-verified participantId (not client-supplied)
      const sessionParticipantId = req.session?.participantId;
      const isOwner = existingNote.participantId === sessionParticipantId;
      const canParticipantDelete = sessionParticipantId && isOwner && space.status === "open";

      if (!isFacilitatorOrAdmin && !canParticipantDelete) {
        return res.status(403).json({ error: "You can only delete your own notes when the session is open" });
      }

      const deleted = await storage.deleteNote(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Note not found" });
      }
      
      // Broadcast to WebSocket clients in this workspace only
      broadcastToSpace(existingNote.spaceId, { type: "note_deleted", data: { id: req.params.id } });
      
      res.status(204).send();
    } catch (error) {
      console.error("Failed to delete note:", error);
      res.status(500).json({ error: "Failed to delete note" });
    }
  });

  // Protected: Facilitators can bulk delete notes
  app.post("/api/notes/bulk-delete", requireFacilitator, async (req, res) => {
    try {
      const { ids } = req.body as { ids: string[] };
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: "Invalid note IDs" });
      }
      
      // Get first note to determine workspace for broadcast
      const firstNote = await storage.getNote(ids[0]);
      const spaceId = firstNote?.spaceId;
      
      const deleted = await storage.deleteNotes(ids);
      if (!deleted) {
        return res.status(404).json({ error: "Notes not found" });
      }
      
      // Broadcast to WebSocket clients in this workspace only
      if (spaceId) {
        broadcastToSpace(spaceId, { type: "notes_deleted", data: { ids } });
      }
      
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete notes" });
    }
  });

  // Protected: Facilitators can bulk categorize notes
  app.post("/api/notes/bulk-categorize", requireFacilitator, async (req, res) => {
    try {
      const { ids, categoryId } = req.body as { ids: string[]; categoryId: string | null };
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: "Invalid note IDs" });
      }

      // Resolve target workspace via the first note and ensure the caller is
      // authorized to facilitate it. All notes in a single bulk request must
      // belong to the same workspace; cross-workspace ids are rejected.
      const firstNote = await storage.getNote(ids[0]);
      if (!firstNote) {
        return res.status(404).json({ error: "Notes not found" });
      }
      const targetSpace = await storage.getSpace(firstNote.spaceId);
      if (!targetSpace) {
        return res.status(404).json({ error: "Workspace not found" });
      }
      if (!(await assertFacilitatorForSpace(req, res, targetSpace))) return;

      // Pre-validate every note belongs to the same workspace BEFORE mutating
      // anything, so a mixed-workspace payload cannot partially update earlier
      // notes before the request is rejected.
      const fetched = await Promise.all(ids.map(noteId => storage.getNote(noteId)));
      for (const note of fetched) {
        if (note && note.spaceId !== targetSpace.id) {
          return res.status(400).json({ error: "All notes must belong to the same workspace" });
        }
      }

      // Update each note with the category
      let updated = 0;
      let spaceId: string | null = null;

      for (const note of fetched) {
        if (note) {
          spaceId = note.spaceId;
          await storage.updateNote(note.id, { manualCategoryId: categoryId });
          updated++;
        }
      }
      
      // Broadcast to WebSocket clients
      if (spaceId) {
        broadcastToSpace(spaceId, { type: "notes_updated", data: { ids, categoryId } });
      }
      
      res.json({ updated, categoryId });
    } catch (error) {
      console.error("Failed to bulk categorize notes:", error);
      res.status(500).json({ error: "Failed to categorize notes" });
    }
  });

  // Protected: Facilitators can bulk import notes (one per line)
  app.post("/api/spaces/:spaceId/notes/bulk-import", requireFacilitator, async (req, res) => {
    try {
      const spaceId = await resolveWorkspaceId(req.params.spaceId);
      if (!spaceId) {
        return res.status(404).json({ error: "Workspace not found" });
      }

      const importSpace = await storage.getSpace(spaceId);
      if (!importSpace) {
        return res.status(404).json({ error: "Workspace not found" });
      }
      if (!(await assertFacilitatorForSpace(req, res, importSpace))) return;

      const { notes: noteContents } = req.body as { notes: string[] };
      if (!Array.isArray(noteContents) || noteContents.length === 0) {
        return res.status(400).json({ error: "No notes provided" });
      }
      
      // Limit to prevent abuse
      if (noteContents.length > 500) {
        return res.status(400).json({ error: "Maximum 500 notes can be imported at once" });
      }
      
      const userId = (req.user as any)?.id;
      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }
      
      // Get or create participant record for this facilitator in this workspace.
      // Uses partial unique index on (space_id, user_id) WHERE user_id IS NOT NULL
      // to prevent duplicate rows from concurrent requests.
      const participant = await storage.getOrCreateParticipantByUserId(spaceId, userId, {
        displayName: (req.user as any)?.displayName || (req.user as any)?.email || 'Facilitator',
      });
      
      const createdNotes = [];
      for (const content of noteContents) {
        const trimmedContent = content.trim();
        if (trimmedContent.length === 0) continue;
        if (trimmedContent.length > 1000) continue; // Skip overly long notes
        
        const note = await storage.createNote({
          spaceId,
          content: trimmedContent,
          participantId: participant.id,
        });
        void storage.recordPulseActivity(spaceId, "ideation", participant.id);
        createdNotes.push(note);
      }
      
      // Broadcast to WebSocket clients
      if (createdNotes.length > 0) {
        broadcastToSpace(spaceId, { type: "notes_bulk_imported", data: { count: createdNotes.length } });
      }
      
      res.status(201).json({ 
        imported: createdNotes.length,
        skipped: noteContents.length - createdNotes.length
      });
    } catch (error) {
      console.error("Failed to bulk import notes:", error);
      res.status(500).json({ error: "Failed to import notes" });
    }
  });

  // Get all categories for a workspace
  app.get("/api/spaces/:spaceId/categories", async (req, res) => {
    try {
      const spaceId = await resolveWorkspaceId(req.params.spaceId);
      if (!spaceId) {
        return res.status(404).json({ error: "Workspace not found" });
      }
      const categories = await storage.getCategoriesBySpace(spaceId);
      res.json(categories);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch categories" });
    }
  });

  // Protected: Facilitators can create categories
  app.post("/api/spaces/:spaceId/categories", requireFacilitator, async (req, res) => {
    try {
      const data = insertCategorySchema.parse({
        ...req.body,
        spaceId: req.params.spaceId,
      });
      const category = await storage.createCategory(data);
      
      // Broadcast to WebSocket clients in this workspace only
      broadcastToSpace(category.spaceId, { type: "category_created", data: category });
      
      res.status(201).json(category);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to create category" });
    }
  });

  // Protected: Facilitators can update categories
  app.patch("/api/categories/:id", requireFacilitator, async (req, res) => {
    try {
      const data = insertCategorySchema.partial().parse(req.body);
      const category = await storage.updateCategory(req.params.id, data);
      if (!category) {
        return res.status(404).json({ error: "Category not found" });
      }
      
      // Broadcast to WebSocket clients in this workspace only
      broadcastToSpace(category.spaceId, { type: "category_updated", data: category });
      
      res.json(category);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to update category" });
    }
  });

  // Protected: Facilitators can delete categories
  app.delete("/api/categories/:id", requireFacilitator, async (req, res) => {
    try {
      // Get category first to determine workspace for broadcast
      const category = await storage.getCategory(req.params.id);
      const spaceId = category?.spaceId;
      
      const deleted = await storage.deleteCategory(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Category not found" });
      }
      
      // Broadcast to WebSocket clients in this workspace only
      if (spaceId) {
        broadcastToSpace(spaceId, { type: "category_deleted", data: { id: req.params.id } });
      }
      
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete category" });
    }
  });

  // Protected: Facilitators and admins can generate AI-powered rewrites of a note
  app.post("/api/notes/:id/rewrite", requireFacilitator, async (req, res) => {
    try {
      const { id } = req.params;
      const { count = 3 } = req.body as { count?: number };

      // Validate count
      if (count < 1 || count > 3) {
        return res.status(400).json({ error: "Count must be between 1 and 3" });
      }

      // Fetch the note
      const note = await storage.getNote(id);
      if (!note) {
        return res.status(404).json({ error: "Note not found" });
      }

      // Get space for context
      const space = await storage.getSpace(note.spaceId);
      if (!space) {
        return res.status(404).json({ error: "Space not found" });
      }

      // Workspace-scoped authorization so a facilitator from another org can't
      // rewrite notes in a workspace they don't own.
      if (!(await assertFacilitatorForSpace(req, res, space))) return;

      // Generate AI rewrites with usage tracking context
      let result;
      try {
        const user = req.user as User;
        result = await rewriteCard(note.content, note.category, count, {
          organizationId: space.organizationId,
          spaceId: space.id,
          userId: user?.id,
        });
      } catch (rewriteError) {
        const errorMessage = rewriteError instanceof Error 
          ? rewriteError.message 
          : 'Unknown error during rewrite';
        console.error("AI rewrite failed:", errorMessage);
        return res.status(500).json({ 
          error: "AI rewrite failed", 
          details: errorMessage 
        });
      }

      res.json({
        original: {
          id: note.id,
          content: note.content,
          category: note.category
        },
        variations: result.variations
      });
    } catch (error) {
      console.error("Rewrite endpoint error:", error);
      res.status(500).json({ error: "Failed to rewrite note" });
    }
  });

  // Protected: Facilitators can trigger AI categorization
  app.post("/api/spaces/:spaceId/categorize", requireFacilitator, async (req, res) => {
    try {
      const spaceId = await resolveWorkspaceId(req.params.spaceId);
      if (!spaceId) {
        return res.status(404).json({ error: "Workspace not found" });
      }

      // Get space for context
      const space = await storage.getSpace(spaceId);
      if (!space) {
        return res.status(404).json({ error: "Space not found" });
      }

      // Workspace-scoped authorization so only admins of the owning org or an
      // explicit space facilitator can trigger AI categorization here.
      if (!(await assertFacilitatorForSpace(req, res, space))) return;

      // Fetch all notes for this space
      const allNotes = await storage.getNotesBySpace(spaceId);
      
      // Filter to only uncategorized notes (no manual category assigned and not manually overridden)
      const uncategorizedNotes = allNotes.filter(
        note => note.manualCategoryId === null && note.isManualOverride === false
      );
      
      if (uncategorizedNotes.length === 0) {
        return res.status(400).json({ 
          error: "No uncategorized notes to process",
          message: "All notes have already been categorized or manually assigned"
        });
      }

      // Call GPT-5 to categorize notes with usage tracking context
      let result;
      try {
        const user = req.user as User;
        result = await categorizeNotes(
          uncategorizedNotes.map(n => ({ id: n.id, content: n.content })),
          {
            organizationId: space.organizationId,
            spaceId: space.id,
            userId: user?.id,
          }
        );
      } catch (categorizationError) {
        const errorMessage = categorizationError instanceof Error 
          ? categorizationError.message 
          : 'Unknown error during categorization';
        console.error("AI categorization failed:", errorMessage);
        return res.status(500).json({ 
          error: "AI categorization failed", 
          details: errorMessage 
        });
      }
      
      // Get existing categories for this workspace
      const existingCategories = await storage.getCategoriesBySpace(spaceId);
      const categoryMap = new Map<string, string>(); // name -> id
      existingCategories.forEach(cat => {
        categoryMap.set(cat.name.toLowerCase(), cat.id);
      });
      
      // Map of unique AI-suggested category names
      const uniqueAiCategories = new Set(result.categories.map(c => c.category));
      const newCategoriesToCreate: string[] = [];
      
      // Identify which categories need to be created
      uniqueAiCategories.forEach(categoryName => {
        if (!categoryMap.has(categoryName.toLowerCase())) {
          newCategoriesToCreate.push(categoryName);
        }
      });
      
      // Create new categories
      const categoryColors = ['#8B5CF6', '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#EC4899', '#6366F1'];
      for (let i = 0; i < newCategoriesToCreate.length; i++) {
        const categoryName = newCategoriesToCreate[i];
        const color = categoryColors[i % categoryColors.length];
        
        const newCategory = await storage.createCategory({
          spaceId,
          name: categoryName,
          color,
        });
        
        categoryMap.set(categoryName.toLowerCase(), newCategory.id);
      }
      
      // Update notes with manualCategoryId (FK reference)
      const updateResults = await Promise.allSettled(
        result.categories.map(({ noteId, category: categoryName }) => {
          const categoryId = categoryMap.get(categoryName.toLowerCase());
          if (!categoryId) {
            console.error(`Category ID not found for ${categoryName}`);
            return Promise.reject(new Error(`Category ID not found for ${categoryName}`));
          }
          
          return storage.updateNote(noteId, { 
            manualCategoryId: categoryId,
            // Do NOT set isManualOverride - AI categorization doesn't trigger override flag
          });
        })
      );
      
      const failedUpdates = updateResults.filter(r => r.status === 'rejected');
      if (failedUpdates.length > 0) {
        console.error(`${failedUpdates.length} note updates failed`);
      }
      
      // Broadcast category updates to clients in this workspace only
      broadcastToSpace(spaceId, { 
        type: "categories_updated", 
        data: { 
          spaceId, 
          summary: result.summary,
          totalNotes: allNotes.length,
          categorizedNotes: result.categories.length,
          newCategoriesCreated: newCategoriesToCreate.length
        } 
      });

      // Notify the facilitator who triggered AI categorization
      try {
        const triggerUser = req.user as User | undefined;
        if (triggerUser?.id) {
          const org = await storage.getOrganization(space.organizationId);
          const link = `/o/${org?.slug || space.organizationId}/s/${space.code || spaceId}`;
          await notifyUser({
            userId: triggerUser.id,
            type: "ai_generation_completed",
            title: `AI categorization complete: ${space.name}`,
            body: `${result.categories.length} notes categorized into ${new Set(result.categories.map(c => c.category)).size} categories.`,
            link,
            spaceId,
          });
        }
      } catch (e) { console.error("[notify ai_generation_completed]", e); }
      
      res.json({ 
        success: true, 
        categoriesApplied: result.categories.length,
        totalNotes: allNotes.length,
        uncategorizedNotes: uncategorizedNotes.length,
        newCategoriesCreated: newCategoriesToCreate.length,
        summary: result.summary 
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error("Categorization endpoint error:", errorMessage);
      res.status(500).json({ 
        error: "Failed to categorize notes",
        details: errorMessage
      });
    }
  });

  // ============================================
  // AI "Suggest New Ideas" assistant
  // ============================================

  // Generate net-new idea suggestions for a workspace, grounded in its
  // purpose, existing ideas, and KB. Facilitators only — does NOT persist
  // anything; the client decides which suggestions to accept.
  app.post("/api/spaces/:spaceId/suggest-ideas", requireFacilitator, async (req, res) => {
    try {
      const spaceId = await resolveWorkspaceId(req.params.spaceId);
      if (!spaceId) {
        return res.status(404).json({ error: "Workspace not found" });
      }

      const space = await storage.getSpace(spaceId);
      if (!space) {
        return res.status(404).json({ error: "Workspace not found" });
      }

      // Workspace-scoped authorization via the shared helper.
      if (!(await assertFacilitatorForSpace(req, res, space))) return;

      const requestedCount = typeof req.body?.count === 'number' ? req.body.count : 8;

      // Build the existing-ideas list from BOTH session notes (participant
      // contributions) and the Ideas Hub. We dedupe by lowercase content.
      const [allNotes, allIdeas] = await Promise.all([
        storage.getNotesBySpace(spaceId),
        storage.getIdeasBySpace(spaceId),
      ]);
      const existingSet = new Map<string, string>();
      for (const n of allNotes) {
        const key = n.content.trim().toLowerCase();
        if (key && !existingSet.has(key)) existingSet.set(key, n.content.trim());
      }
      for (const i of allIdeas) {
        const key = i.content.trim().toLowerCase();
        if (key && !existingSet.has(key)) existingSet.set(key, i.content.trim());
      }
      const existingIdeas = Array.from(existingSet.values());

      // Pull KB chunks relevant to the workspace purpose + a sample of
      // existing ideas, so suggestions stay grounded in the org's context.
      let knowledgeBaseSnippets: string[] = [];
      try {
        const querySeed = [space.purpose, ...existingIdeas.slice(0, 10)].filter(Boolean).join(' ');
        if (querySeed.trim().length > 0) {
          const hits = await storage.searchKnowledgeBaseChunks({
            query: querySeed,
            spaceId,
            organizationId: space.organizationId ?? undefined,
            includeSystem: true,
            limit: 6,
          });
          knowledgeBaseSnippets = hits.map(h => h.content);
        }
      } catch (kbErr) {
        // KB grounding is best-effort — log and continue without it.
        console.warn("[suggest-ideas] KB lookup failed:", kbErr instanceof Error ? kbErr.message : kbErr);
      }

      const user = req.user as User;
      const result = await suggestIdeas(
        {
          workspaceName: space.name,
          workspacePurpose: space.purpose,
          existingIdeas,
          knowledgeBaseSnippets,
          count: requestedCount,
        },
        {
          organizationId: space.organizationId ?? undefined,
          spaceId: space.id,
          userId: user?.id,
        },
      );

      res.json(result);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error("[suggest-ideas] failed:", errorMessage);
      res.status(500).json({ error: "Failed to suggest ideas", details: errorMessage });
    }
  });

  // Persist an accepted AI suggestion as a note (with aiGenerated=true) and
  // broadcast it so participant boards update in real time.
  app.post("/api/spaces/:spaceId/suggest-ideas/accept", requireFacilitator, async (req, res) => {
    try {
      const spaceId = await resolveWorkspaceId(req.params.spaceId);
      if (!spaceId) {
        return res.status(404).json({ error: "Workspace not found" });
      }

      const acceptSpace = await storage.getSpace(spaceId);
      if (!acceptSpace) {
        return res.status(404).json({ error: "Workspace not found" });
      }

      if (!(await assertFacilitatorForSpace(req, res, acceptSpace))) return;

      const acceptSchema = z.object({
        content: z.string().min(1).max(2000),
        manualCategoryId: z.string().nullable().optional(),
      });
      const parsed = acceptSchema.parse(req.body);

      const user = req.user as User;
      if (!user?.id) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      // Reuse the facilitator's participant record (matches bulk-import
      // pattern) so accepted suggestions are attributed to the facilitator.
      // Uses partial unique index on (space_id, user_id) WHERE user_id IS NOT NULL
      // to prevent duplicate rows from concurrent accept-suggestion clicks.
      const participant = await storage.getOrCreateParticipantByUserId(spaceId, user.id, {
        displayName: user.displayName || user.email || 'Facilitator',
      });

      const note = await storage.createNote({
        spaceId,
        participantId: participant.id,
        content: parsed.content.trim(),
        manualCategoryId: parsed.manualCategoryId ?? null,
        isManualOverride: !!parsed.manualCategoryId,
        aiGenerated: true,
      });
      void storage.recordPulseActivity(spaceId, "ideation", participant.id);

      broadcastToSpace(spaceId, { type: "note_created", data: note });

      res.status(201).json(note);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error("[suggest-ideas/accept] failed:", errorMessage);
      res.status(500).json({ error: "Failed to accept suggestion", details: errorMessage });
    }
  });

  // ============================================
  // Pulse endpoint: facilitator-scoped analytics dashboard. Implementation
  // (and its authorization rule) lives in `./routes/pulse.ts` so it can be
  // unit-tested in isolation.
  registerPulseRoute(app);

  // ============================================
  // Ideas Management API Routes
  // ============================================
  
  // Get all ideas for a workspace
  // Query params: showOnIdeationBoard=true to filter only ideas visible on ideation board
  app.get("/api/spaces/:spaceId/ideas", async (req, res) => {
    try {
      const spaceId = await resolveWorkspaceId(req.params.spaceId);
      if (!spaceId) {
        return res.status(404).json({ error: "Workspace not found" });
      }
      
      let ideas = await storage.getIdeasBySpace(spaceId);
      
      // Filter by showOnIdeationBoard if query param is set
      if (req.query.showOnIdeationBoard === 'true') {
        ideas = ideas.filter(idea => idea.showOnIdeationBoard);
      }
      
      res.json(ideas);
    } catch (error) {
      console.error("Failed to fetch ideas:", error);
      res.status(500).json({ error: "Failed to fetch ideas" });
    }
  });
  
  // Create a new idea (legacy route without spaceId in URL)
  app.post("/api/ideas", requireFacilitator, async (req, res) => {
    try {
      const ideaData = insertIdeaSchema.parse(req.body);
      const user = req.user as User;
      
      // Set createdByUserId to current user
      ideaData.createdByUserId = user.id;
      
      const idea = await storage.createIdea(ideaData);
      
      // Broadcast to WebSocket clients
      broadcastToSpace(idea.spaceId, { 
        type: "idea_created", 
        data: idea 
      });
      
      res.status(201).json(idea);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      console.error("Failed to create idea:", error);
      res.status(500).json({ error: "Failed to create idea" });
    }
  });

  // Create a new idea (spaceId in URL - used by IdeasHub)
  app.post("/api/spaces/:spaceId/ideas", requireFacilitator, async (req, res) => {
    try {
      const spaceId = await resolveWorkspaceId(req.params.spaceId);
      if (!spaceId) {
        return res.status(404).json({ error: "Workspace not found" });
      }
      const user = req.user as User;
      
      const ideaData = insertIdeaSchema.parse({
        ...req.body,
        spaceId,
        createdByUserId: user.id
      });
      
      const idea = await storage.createIdea(ideaData);
      
      // Broadcast to WebSocket clients
      broadcastToSpace(idea.spaceId, { 
        type: "idea_created", 
        data: idea 
      });
      
      res.status(201).json(idea);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      console.error("Failed to create idea:", error);
      res.status(500).json({ error: "Failed to create idea" });
    }
  });
  
  // Update an idea
  app.patch("/api/ideas/:id", requireFacilitator, async (req, res) => {
    try {
      const updated = await storage.updateIdea(req.params.id, req.body);
      if (!updated) {
        return res.status(404).json({ error: "Idea not found" });
      }
      
      // Broadcast to WebSocket clients
      broadcastToSpace(updated.spaceId, { 
        type: "idea_updated", 
        data: updated 
      });
      
      res.json(updated);
    } catch (error) {
      console.error("Failed to update idea:", error);
      res.status(500).json({ error: "Failed to update idea" });
    }
  });
  
  // Delete an idea
  app.delete("/api/ideas/:id", requireFacilitator, async (req, res) => {
    try {
      const idea = await storage.getIdea(req.params.id);
      if (!idea) {
        return res.status(404).json({ error: "Idea not found" });
      }
      
      const deleted = await storage.deleteIdea(req.params.id);
      if (!deleted) {
        return res.status(500).json({ error: "Failed to delete idea" });
      }
      
      // Broadcast to WebSocket clients
      broadcastToSpace(idea.spaceId, { 
        type: "idea_deleted", 
        data: { id: req.params.id } 
      });
      
      res.status(204).send();
    } catch (error) {
      console.error("Failed to delete idea:", error);
      res.status(500).json({ error: "Failed to delete idea" });
    }
  });
  
  // Push idea as seed note (creates a note from the idea for voting/display)
  app.post("/api/ideas/:id/push-as-seed", requireFacilitator, async (req, res) => {
    try {
      const ideaId = req.params.id;
      const idea = await storage.getIdea(ideaId);
      
      if (!idea) {
        return res.status(404).json({ error: "Idea not found" });
      }
      
      // Check if a seed note already exists for this idea
      const existingNotes = await storage.getNotesBySpace(idea.spaceId);
      const existingSeed = existingNotes.find(n => n.sourceIdeaId === ideaId);
      
      if (existingSeed) {
        return res.status(400).json({ error: "Seed note already exists for this idea" });
      }
      
      // Get or create a system/facilitator participant
      const participants = await storage.getParticipantsBySpace(idea.spaceId);
      let facilitatorParticipant = participants.find(p => p.displayName === "Facilitator");
      
      if (!facilitatorParticipant) {
        // Create facilitator participant
        facilitatorParticipant = await storage.createParticipant({
          spaceId: idea.spaceId,
          userId: null,
          displayName: "Facilitator",
          isGuest: false,
          isOnline: true,
          profileData: { role: "facilitator" },
        });
      }
      
      // Create seed note from idea
      const seedNote = await storage.createNote({
        spaceId: idea.spaceId,
        participantId: facilitatorParticipant.id,
        content: idea.content,
        manualCategoryId: idea.manualCategoryId || null,
        isSeed: true,
        sourceIdeaId: ideaId,
        visibleInRanking: true,
        visibleInMarketplace: true,
      });
      void storage.recordPulseActivity(idea.spaceId, "ideation", facilitatorParticipant.id);
      
      // Update the idea to mark as pushed
      await storage.updateIdea(ideaId, { showOnIdeationBoard: true });
      
      // Broadcast updates
      broadcastToSpace(idea.spaceId, { 
        type: "note_created", 
        data: seedNote 
      });
      broadcastToSpace(idea.spaceId, { 
        type: "idea_updated", 
        data: { ...idea, showOnIdeationBoard: true }
      });
      
      res.status(201).json(seedNote);
    } catch (error) {
      console.error("Failed to push idea as seed:", error);
      res.status(500).json({ error: "Failed to push idea as seed" });
    }
  });
  
  // Bulk push ideas as seed notes
  app.post("/api/ideas/bulk-push-as-seed", requireFacilitator, async (req, res) => {
    try {
      const { spaceId, ideaIds } = req.body as { spaceId: string; ideaIds: string[] };
      
      if (!spaceId || !Array.isArray(ideaIds) || ideaIds.length === 0) {
        return res.status(400).json({ error: "Invalid request: spaceId and ideaIds required" });
      }
      
      // Get existing notes to check for duplicates
      const existingNotes = await storage.getNotesBySpace(spaceId);
      const existingSeedIdeaIds = new Set(existingNotes.filter(n => n.sourceIdeaId).map(n => n.sourceIdeaId));
      
      // Get or create facilitator participant
      const participants = await storage.getParticipantsBySpace(spaceId);
      let facilitatorParticipant = participants.find(p => p.displayName === "Facilitator");
      
      if (!facilitatorParticipant) {
        facilitatorParticipant = await storage.createParticipant({
          spaceId,
          userId: null,
          displayName: "Facilitator",
          isGuest: false,
          isOnline: true,
          profileData: { role: "facilitator" },
        });
      }
      
      const createdNotes: any[] = [];
      
      for (const ideaId of ideaIds) {
        // Skip if seed already exists
        if (existingSeedIdeaIds.has(ideaId)) {
          continue;
        }
        
        const idea = await storage.getIdea(ideaId);
        if (!idea || idea.spaceId !== spaceId) {
          continue;
        }
        
        // Create seed note from idea
        const seedNote = await storage.createNote({
          spaceId: idea.spaceId,
          participantId: facilitatorParticipant.id,
          content: idea.content,
          manualCategoryId: idea.manualCategoryId || null,
          isSeed: true,
          sourceIdeaId: ideaId,
          visibleInRanking: true,
          visibleInMarketplace: true,
        });
        void storage.recordPulseActivity(idea.spaceId, "ideation", facilitatorParticipant.id);
        
        // Update the idea to mark as pushed
        await storage.updateIdea(ideaId, { showOnIdeationBoard: true });
        
        createdNotes.push(seedNote);
        
        // Broadcast updates
        broadcastToSpace(spaceId, { 
          type: "note_created", 
          data: seedNote 
        });
      }
      
      res.json({ count: createdNotes.length, notes: createdNotes });
    } catch (error) {
      console.error("Failed to bulk push ideas as seeds:", error);
      res.status(500).json({ error: "Failed to bulk push ideas as seeds" });
    }
  });
  
  // Remove seed idea (deletes the corresponding note)
  app.delete("/api/ideas/:id/remove-seed", requireFacilitator, async (req, res) => {
    try {
      const ideaId = req.params.id;
      const idea = await storage.getIdea(ideaId);
      
      if (!idea) {
        return res.status(404).json({ error: "Idea not found" });
      }
      
      // Find and delete the seed note
      const notes = await storage.getNotesBySpace(idea.spaceId);
      const seedNote = notes.find(n => n.sourceIdeaId === ideaId);
      
      if (seedNote) {
        await storage.deleteNote(seedNote.id);
        broadcastToSpace(idea.spaceId, { 
          type: "note_deleted", 
          data: { id: seedNote.id }
        });
      }
      
      // Update the idea
      await storage.updateIdea(ideaId, { showOnIdeationBoard: false });
      
      broadcastToSpace(idea.spaceId, { 
        type: "idea_updated", 
        data: { ...idea, showOnIdeationBoard: false }
      });
      
      res.status(200).json({ success: true });
    } catch (error) {
      console.error("Failed to remove seed:", error);
      res.status(500).json({ error: "Failed to remove seed" });
    }
  });
  
  // Bulk import ideas (CSV/JSON)
  app.post("/api/spaces/:spaceId/ideas/import", requireFacilitator, async (req, res) => {
    try {
      const spaceId = await resolveWorkspaceId(req.params.spaceId);
      if (!spaceId) {
        return res.status(404).json({ error: "Workspace not found" });
      }
      
      const { ideas, format = 'json' } = req.body as { 
        ideas: Array<{ content: string; category?: string; source?: string }>;
        format?: 'json' | 'csv';
      };
      
      if (!Array.isArray(ideas)) {
        return res.status(400).json({ error: "Ideas must be an array" });
      }
      
      const user = req.user as User;
      const createdIdeas = [];
      
      // Get existing categories to map names to IDs
      const existingCategories = await storage.getCategoriesBySpace(spaceId);
      const categoryNameToId = new Map(existingCategories.map(c => [c.name.toLowerCase(), c.id]));
      
      for (const ideaData of ideas) {
        const ideaContent = ideaData.content?.trim();
        if (!ideaContent) continue;
        
        // Look up or create category by name
        let categoryId: string | null = null;
        const categoryName = ideaData.category?.trim();
        
        if (categoryName && categoryName.toLowerCase() !== 'uncategorized') {
          // Check if category exists
          categoryId = categoryNameToId.get(categoryName.toLowerCase()) || null;
          
          // Create category if it doesn't exist
          if (!categoryId) {
            const newCategory = await storage.createCategory({
              spaceId,
              name: categoryName,
              color: '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6, '0')
            });
            categoryId = newCategory.id;
            categoryNameToId.set(categoryName.toLowerCase(), categoryId);
          }
        }
        
        const idea = await storage.createIdea({
          spaceId,
          content: ideaContent,
          contentType: 'text',
          manualCategoryId: categoryId,
          sourceType: ideaData.source || 'imported',
          createdByUserId: user.id
        });
        createdIdeas.push(idea);
      }
      
      // Broadcast bulk import
      broadcastToSpace(spaceId, { 
        type: "ideas_imported", 
        data: { count: createdIdeas.length } 
      });
      
      res.json({ 
        success: true, 
        imported: createdIdeas.length,
        ideas: createdIdeas 
      });
    } catch (error) {
      console.error("Failed to import ideas:", error);
      res.status(500).json({ error: "Failed to import ideas" });
    }
  });
  
  // Promote session notes to ideas
  app.post("/api/spaces/:spaceId/ideas/from-notes", requireFacilitator, async (req, res) => {
    try {
      const spaceId = await resolveWorkspaceId(req.params.spaceId);
      if (!spaceId) {
        return res.status(404).json({ error: "Workspace not found" });
      }
      
      const { noteIds } = req.body as { noteIds: string[] };
      
      if (!Array.isArray(noteIds) || noteIds.length === 0) {
        return res.status(400).json({ error: "Note IDs must be a non-empty array" });
      }
      
      const user = req.user as User;
      const promotedIdeas = [];
      
      for (const noteId of noteIds) {
        // Fetch the note
        const note = await storage.getNote(noteId);
        if (!note || note.spaceId !== spaceId) {
          continue; // Skip notes that don't exist or belong to other spaces
        }
        
        // Create idea from note
        const idea = await storage.createIdea({
          spaceId,
          content: note.content,
          contentType: 'text',
          manualCategoryId: null,
          sourceType: 'participant_submitted',
          createdByUserId: user.id
        });
        promotedIdeas.push(idea);
      }
      
      // Broadcast promotion
      broadcastToSpace(spaceId, { 
        type: "notes_promoted", 
        data: { count: promotedIdeas.length } 
      });
      
      res.json({ 
        success: true, 
        count: promotedIdeas.length,
        ideas: promotedIdeas 
      });
    } catch (error) {
      console.error("Failed to promote notes to ideas:", error);
      res.status(500).json({ error: "Failed to promote notes to ideas" });
    }
  });
  
  // Upload image for an idea
  app.post("/api/ideas/upload-image", 
    requireFacilitator, 
    uploadImage.single('image'),
    async (req, res) => {
      try {
        if (!req.file) {
          return res.status(400).json({ error: "No file uploaded" });
        }
        
        const { spaceId } = req.body;
        if (!spaceId) {
          await cleanupTempFile(req.file.path);
          return res.status(400).json({ error: "Workspace ID required" });
        }
        
        // Validate file
        const isValid = await validateImageFile(req.file.path);
        if (!isValid) {
          await cleanupTempFile(req.file.path);
          return res.status(400).json({ error: "Invalid or malicious file detected" });
        }
        
        // Process and save image
        const imageData = await processUploadedImage(req.file.path, req.file.originalname);
        
        // Clean up temp file
        await cleanupTempFile(req.file.path);
        
        const user = req.user as User;
        
        // Create idea with image
        const idea = await storage.createIdea({
          spaceId,
          content: req.file.originalname,
          contentType: 'image',
          assetUrl: imageData.mainUrl,
          assetMetadata: {
            ...imageData.metadata,
            thumbnailUrl: imageData.thumbnailUrl
          },
          sourceType: 'facilitator',
          createdByUserId: user.id
        });
        
        res.json(idea);
      } catch (error) {
        // Clean up on error
        if (req.file) {
          await cleanupTempFile(req.file.path);
        }
        console.error("Failed to upload image:", error);
        res.status(500).json({ error: "Failed to upload image" });
      }
    }
  );
  
  // ============================================
  // Module Configuration API Routes
  // ============================================
  
  // Get workspace modules configuration
  app.get("/api/spaces/:spaceId/modules", async (req, res) => {
    try {
      const spaceId = await resolveWorkspaceId(req.params.spaceId);
      if (!spaceId) {
        return res.status(404).json({ error: "Workspace not found" });
      }
      
      const modules = await storage.getWorkspaceModules(spaceId);
      res.json(modules);
    } catch (error) {
      console.error("Failed to fetch modules:", error);
      res.status(500).json({ error: "Failed to fetch modules configuration" });
    }
  });
  
  // Create or update workspace module configuration
  app.post("/api/workspace-modules", requireFacilitator, async (req, res) => {
    try {
      const moduleData = insertWorkspaceModuleSchema.parse(req.body);
      const module = await storage.createWorkspaceModule(moduleData);
      
      // Broadcast module configuration change
      broadcastToSpace(module.spaceId, { 
        type: "module_configured", 
        data: module 
      });
      
      res.json(module);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      console.error("Failed to configure module:", error);
      res.status(500).json({ error: "Failed to configure module" });
    }
  });
  
  // Update module order/settings
  app.patch("/api/workspace-modules/:id", requireFacilitator, async (req, res) => {
    try {
      const { enabled, orderIndex, config } = req.body;
      
      const updated = await storage.updateWorkspaceModule(req.params.id, {
        enabled,
        orderIndex,
        config
      });
      
      if (!updated) {
        return res.status(404).json({ error: "Module not found" });
      }
      
      // Broadcast module update
      broadcastToSpace(updated.spaceId, { 
        type: "module_updated", 
        data: updated 
      });
      
      res.json(updated);
    } catch (error) {
      console.error("Failed to update module:", error);
      res.status(500).json({ error: "Failed to update module configuration" });
    }
  });
  
  // Start a module run (for repeatable sessions)
  app.post("/api/module-runs", requireFacilitator, async (req, res) => {
    try {
      const runData = insertWorkspaceModuleRunSchema.parse(req.body);
      const run = await storage.createModuleRun(runData);
      
      // Broadcast run started
      broadcastToSpace(run.spaceId, { 
        type: "module_run_started", 
        data: run 
      });
      
      res.status(201).json(run);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      console.error("Failed to start module run:", error);
      res.status(500).json({ error: "Failed to start module run" });
    }
  });
  
  // Complete a module run
  app.patch("/api/module-runs/:id/complete", requireFacilitator, async (req, res) => {
    try {
      const completed = await storage.completeModuleRun(req.params.id);
      if (!completed) {
        return res.status(404).json({ error: "Module run not found" });
      }
      
      // Broadcast run completed
      broadcastToSpace(completed.spaceId, { 
        type: "module_run_completed", 
        data: completed 
      });
      
      res.json(completed);
    } catch (error) {
      console.error("Failed to complete module run:", error);
      res.status(500).json({ error: "Failed to complete module run" });
    }
  });
  
  // ============================================
  // 2x2 Priority Matrix API Routes
  // ============================================
  
  // Get priority matrix configuration
  app.get("/api/spaces/:spaceId/priority-matrix", async (req, res) => {
    try {
      const spaceId = await resolveWorkspaceId(req.params.spaceId);
      if (!spaceId) {
        return res.status(404).json({ error: "Workspace not found" });
      }
      
      const matrix = await storage.getPriorityMatrix(spaceId);
      if (!matrix) {
        // Return default configuration if none exists
        return res.json({
          xAxisLabel: "Impact",
          yAxisLabel: "Effort",
          xMin: "Low",
          xMax: "High",
          yMin: "Low",
          yMax: "High",
          snapToGrid: false,
          gridSize: 4
        });
      }
      
      res.json(matrix);
    } catch (error) {
      console.error("Failed to fetch priority matrix:", error);
      res.status(500).json({ error: "Failed to fetch priority matrix configuration" });
    }
  });
  
  // Create or update priority matrix configuration
  app.post("/api/priority-matrices", requireFacilitator, async (req, res) => {
    try {
      const matrixData = insertPriorityMatrixSchema.parse(req.body);
      const matrix = await storage.createPriorityMatrix(matrixData);
      
      // Broadcast configuration
      broadcastToSpace(matrix.spaceId, { 
        type: "priority_matrix_configured", 
        data: matrix 
      });
      
      res.status(201).json(matrix);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      console.error("Failed to create priority matrix:", error);
      res.status(500).json({ error: "Failed to create priority matrix" });
    }
  });
  
  // Get all idea positions in the matrix (by matrixId)
  app.get("/api/priority-matrices/:matrixId/positions", async (req, res) => {
    try {
      const positions = await storage.getPriorityMatrixPositions(req.params.matrixId);
      res.json(positions);
    } catch (error) {
      console.error("Failed to fetch positions:", error);
      res.status(500).json({ error: "Failed to fetch matrix positions" });
    }
  });
  
  // Get all idea positions by spaceId (client-friendly route)
  app.get("/api/spaces/:spaceId/priority-matrix/positions", createWorkspaceAccessMiddleware({}), async (req, res) => {
    try {
      const spaceId = await resolveWorkspaceId(req.params.spaceId);
      if (!spaceId) {
        return res.status(404).json({ error: "Workspace not found" });
      }
      
      const matrix = await storage.getPriorityMatrix(spaceId);
      if (!matrix) {
        return res.json([]);
      }
      
      const positions = await storage.getPriorityMatrixPositions(matrix.id);
      // Convert from 0-1 (database) to 0-100 (client percentages)
      const clientPositions = positions.map(pos => ({
        ...pos,
        xCoord: pos.xCoord * 100,
        yCoord: pos.yCoord * 100
      }));
      res.json(clientPositions);
    } catch (error) {
      console.error("Failed to fetch priority matrix positions:", error);
      res.status(500).json({ error: "Failed to fetch matrix positions" });
    }
  });
  
  // Update idea position by spaceId (PUT for client compatibility)
  app.put("/api/spaces/:spaceId/priority-matrix/positions", createWorkspaceAccessMiddleware({ requireOpen: false }), async (req, res) => {
    try {
      const spaceId = await resolveWorkspaceId(req.params.spaceId);
      if (!spaceId) {
        return res.status(404).json({ error: "Workspace not found" });
      }
      
      // Get or create matrix for this workspace
      let matrix = await storage.getPriorityMatrix(spaceId);
      if (!matrix) {
        // Auto-create with default configuration
        matrix = await storage.createPriorityMatrix({
          spaceId,
          xAxisLabel: "Impact",
          yAxisLabel: "Effort",
          xMin: "Low",
          xMax: "High",
          yMin: "Low",
          yMax: "High",
          snapToGrid: false,
          gridSize: 4
        });
      }
      
      const { noteId, ideaId, xCoord, yCoord } = req.body;
      const resolvedNoteId = noteId || ideaId;
      
      if (!resolvedNoteId) {
        return res.status(400).json({ error: "noteId is required" });
      }
      
      // Validate coordinates are within bounds (client sends 0-100 percentages)
      if (xCoord < 0 || xCoord > 100 || yCoord < 0 || yCoord > 100) {
        return res.status(400).json({ error: "Coordinates must be between 0 and 100" });
      }
      
      // Normalize coordinates from 0-100 to 0-1 for database storage
      const normalizedX = xCoord / 100;
      const normalizedY = yCoord / 100;
      
      // Check user role - facilitators can always update, participants need open workspace
      const user = req.user as User | undefined;
      const isFacilitator = user && ["facilitator", "company_admin", "global_admin"].includes(user.role);
      
      const positionData: any = {
        matrixId: matrix.id,
        noteId: resolvedNoteId,
        xCoord: normalizedX,
        yCoord: normalizedY
      };
      
      if (!isFacilitator) {
        // For participants, require open workspace and participant session
        const space = await storage.getSpace(spaceId);
        if (space && space.status !== 'open') {
          return res.status(403).json({ 
            error: "This workspace is not currently open for participation",
            code: "WORKSPACE_NOT_OPEN"
          });
        }
        
        const participantId = req.session?.participantId;
        if (!participantId) {
          return res.status(401).json({ error: "No participant session found" });
        }
        positionData.participantId = participantId;
      }
      
      const position = await storage.upsertPriorityMatrixPosition(positionData);
      void storage.recordPulseActivity(spaceId, "priority-matrix", position.participantId ?? null);

      // Broadcast position update for real-time collaboration
      broadcastToSpace(spaceId, { 
        type: "matrix_position_updated", 
        data: position 
      });
      
      res.json(position);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      console.error("Failed to update priority matrix position:", error);
      res.status(500).json({ error: "Failed to update matrix position" });
    }
  });
  
  // Update note position (upsert) - legacy route
  app.post("/api/priority-matrix-positions", createWorkspaceAccessMiddleware({ requireOpen: true }), async (req, res) => {
    try {
      const positionData = insertPriorityMatrixPositionSchema.parse(req.body);
      
      // Validate coordinates are within bounds
      if (positionData.xCoord < 0 || positionData.xCoord > 1 || 
          positionData.yCoord < 0 || positionData.yCoord > 1) {
        return res.status(400).json({ error: "Coordinates must be between 0 and 1" });
      }
      
      // Use session participant if not facilitator
      const user = req.user as User | undefined;
      if (!user || !["facilitator", "company_admin", "global_admin"].includes(user.role)) {
        const participantId = req.session?.participantId;
        if (!participantId) {
          return res.status(401).json({ error: "No participant session found" });
        }
        positionData.participantId = participantId;
      }
      
      const position = await storage.upsertPriorityMatrixPosition(positionData);
      
      // Broadcast position update for real-time collaboration
      if (position.matrixId) {
        const matrix = await storage.getPriorityMatrix(position.matrixId);
        if (matrix) {
          void storage.recordPulseActivity(matrix.spaceId, "priority-matrix", position.participantId ?? null);
          broadcastToSpace(matrix.spaceId, { 
            type: "matrix_position_updated", 
            data: position 
          });
        }
      }
      
      res.json(position);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      console.error("Failed to update position:", error);
      res.status(500).json({ error: "Failed to update matrix position" });
    }
  });

  // ============================================
  // Staircase Module API Routes
  // ============================================
  
  // Get staircase configuration
  app.get("/api/spaces/:spaceId/staircase", createWorkspaceAccessMiddleware({}), async (req, res) => {
    try {
      const spaceId = await resolveWorkspaceId(req.params.spaceId);
      if (!spaceId) {
        return res.status(404).json({ error: "Workspace not found" });
      }
      
      const staircase = await storage.getStaircaseModule(spaceId);
      if (!staircase) {
        // Return default configuration if none exists
        return res.json({
          minScore: 0,
          maxScore: 10,
          stepCount: 11,
          allowDecimals: false,
          minLabel: "Lowest",
          maxLabel: "Highest",
          showDistribution: true
        });
      }
      
      res.json(staircase);
    } catch (error) {
      console.error("Failed to fetch staircase config:", error);
      res.status(500).json({ error: "Failed to fetch staircase configuration" });
    }
  });
  
  // Create or update staircase configuration
  app.put("/api/spaces/:spaceId/staircase", requireFacilitator, async (req, res) => {
    try {
      const spaceId = await resolveWorkspaceId(req.params.spaceId);
      if (!spaceId) {
        return res.status(404).json({ error: "Workspace not found" });
      }
      
      const staircaseData = insertStaircaseModuleSchema.parse({
        ...req.body,
        spaceId
      });
      
      // Check if staircase already exists
      const existing = await storage.getStaircaseModule(spaceId);
      
      let staircase;
      if (existing) {
        staircase = await storage.updateStaircaseModule(existing.id, staircaseData);
      } else {
        staircase = await storage.createStaircaseModule(staircaseData);
      }
      
      res.json(staircase);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      console.error("Failed to update staircase config:", error);
      res.status(500).json({ error: "Failed to update staircase configuration" });
    }
  });
  
  // Get all staircase positions
  app.get("/api/spaces/:spaceId/staircase-positions", createWorkspaceAccessMiddleware({}), async (req, res) => {
    try {
      const spaceId = await resolveWorkspaceId(req.params.spaceId);
      if (!spaceId) {
        return res.status(404).json({ error: "Workspace not found" });
      }
      
      const staircase = await storage.getStaircaseModule(spaceId);
      if (!staircase) {
        return res.json([]);
      }
      
      const positions = await storage.getStaircasePositions(staircase.id);
      res.json(positions);
    } catch (error) {
      console.error("Failed to fetch staircase positions:", error);
      res.status(500).json({ error: "Failed to fetch staircase positions" });
    }
  });
  
  // Update note position on staircase (upsert)
  app.post("/api/spaces/:spaceId/staircase-positions", createWorkspaceAccessMiddleware({ requireOpen: false }), async (req, res) => {
    try {
      const spaceId = await resolveWorkspaceId(req.params.spaceId);
      if (!spaceId) {
        return res.status(404).json({ error: "Workspace not found" });
      }
      
      // Get or create staircase for this workspace (auto-create with defaults if not exists)
      let staircase = await storage.getStaircaseModule(spaceId);
      if (!staircase) {
        // Auto-create with default configuration
        staircase = await storage.createStaircaseModule({
          spaceId,
          minScore: 0,
          maxScore: 10,
          stepCount: 11,
          allowDecimals: false,
          minLabel: "Lowest",
          maxLabel: "Highest",
          showDistribution: true
        });
      }
      
      const positionData = insertStaircasePositionSchema.parse({
        ...req.body,
        staircaseId: staircase.id
      });
      
      // Validate score is within configured bounds
      if (positionData.score < staircase.minScore || positionData.score > staircase.maxScore) {
        return res.status(400).json({ 
          error: `Score must be between ${staircase.minScore} and ${staircase.maxScore}` 
        });
      }
      
      // Check user role - facilitators can always update, participants need open workspace
      const user = req.user as User | undefined;
      const isFacilitator = user && ["facilitator", "company_admin", "global_admin"].includes(user.role);
      
      if (!isFacilitator) {
        // For participants, require open workspace and participant session
        const space = await storage.getSpace(spaceId);
        if (space && space.status !== 'open') {
          return res.status(403).json({ 
            error: "This workspace is not currently open for participation",
            code: "WORKSPACE_NOT_OPEN"
          });
        }
        
        const participantId = req.session?.participantId;
        if (!participantId) {
          return res.status(401).json({ error: "No participant session found" });
        }
        positionData.participantId = participantId;
      }
      
      const position = await storage.upsertStaircasePosition(positionData);
      void storage.recordPulseActivity(spaceId, "staircase", position.participantId ?? null);

      // Broadcast position update for real-time collaboration
      broadcastToSpace(spaceId, { 
        type: "staircase_position_updated", 
        data: position 
      });
      
      res.json(position);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      console.error("Failed to update staircase position:", error);
      res.status(500).json({ error: "Failed to update staircase position" });
    }
  });
  
  // Lock staircase position for dragging
  app.patch("/api/spaces/:spaceId/staircase-positions/:id/lock", createWorkspaceAccessMiddleware({ requireOpen: true }), async (req, res) => {
    try {
      const spaceId = await resolveWorkspaceId(req.params.spaceId);
      if (!spaceId) {
        return res.status(404).json({ error: "Workspace not found" });
      }
      
      const { id } = req.params;
      const participantId = req.session?.participantId || req.body.participantId;
      
      if (!participantId) {
        return res.status(401).json({ error: "No participant session found" });
      }
      
      const success = await storage.lockStaircasePosition(id, participantId);
      
      if (success) {
        // Broadcast lock update
        broadcastToSpace(spaceId, {
          type: "staircase_position_locked",
          data: { positionId: id, lockedBy: participantId }
        });
      }
      
      res.json({ success });
    } catch (error) {
      console.error("Failed to lock position:", error);
      res.status(500).json({ error: "Failed to lock position" });
    }
  });
  
  // Unlock staircase position
  app.patch("/api/spaces/:spaceId/staircase-positions/:id/unlock", createWorkspaceAccessMiddleware({ requireOpen: true }), async (req, res) => {
    try {
      const spaceId = await resolveWorkspaceId(req.params.spaceId);
      if (!spaceId) {
        return res.status(404).json({ error: "Workspace not found" });
      }
      
      const { id } = req.params;
      
      const success = await storage.unlockStaircasePosition(id);
      
      if (success) {
        // Broadcast unlock update
        broadcastToSpace(spaceId, {
          type: "staircase_position_unlocked",
          data: { positionId: id }
        });
      }
      
      res.json({ success });
    } catch (error) {
      console.error("Failed to unlock position:", error);
      res.status(500).json({ error: "Failed to unlock position" });
    }
  });

  // Votes
  app.get("/api/spaces/:spaceId/votes", async (req, res) => {
    try {
      const spaceId = await resolveWorkspaceId(req.params.spaceId);
      if (!spaceId) {
        return res.status(404).json({ error: "Workspace not found" });
      }
      const votes = await storage.getVotesBySpace(spaceId);
      res.json(votes);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch votes" });
    }
  });

  app.post("/api/votes", createWorkspaceAccessMiddleware({ requireOpen: true }), async (req, res) => {
    try {
      const data = insertVoteSchema.parse(req.body);
      const vote = await storage.createVote(data);
      
      void storage.recordPulseActivity(vote.spaceId, "pairwise-voting", vote.participantId);

      // Broadcast vote update to clients in this workspace only
      broadcastToSpace(vote.spaceId, {
        type: "vote_recorded",
        data: {
          spaceId: vote.spaceId,
          participantId: vote.participantId,
        }
      });
      
      // Return the next pair directly to avoid a separate API call
      // This eliminates one round-trip per vote for much faster UX
      try {
        const space = await storage.getSpace(vote.spaceId);
        const notes = await storage.getNotesBySpace(vote.spaceId);
        const existingVotes = await storage.getVotesByParticipant(vote.participantId);
        
        const pairwiseScope = (space?.pairwiseScope || "all") as "all" | "within_categories";
        const nextPair = getNextPair(notes, existingVotes, pairwiseScope, vote.participantId);
        const progress = calculateProgress(notes, existingVotes, pairwiseScope);
        
        res.status(201).json({
          ...vote,
          nextPair: nextPair,
          progress,
          message: !nextPair ? (progress.isComplete ? "All pairs voted" : "Not enough notes to vote") : undefined,
        });
      } catch (nextPairError) {
        // If getting next pair fails, still return the vote successfully
        console.error("Failed to get next pair after vote:", nextPairError);
        res.status(201).json(vote);
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to create vote" });
    }
  });

  // Get next pair of notes for participant to vote on
  app.get("/api/spaces/:spaceId/participants/:participantId/next-pair", createWorkspaceAccessMiddleware({ requireOpen: true }), async (req, res) => {
    try {
      const { spaceId, participantId } = req.params;
      
      // Get space to check pairwise scope setting
      const space = await storage.getSpace(spaceId);
      if (!space) {
        return res.status(404).json({ error: "Space not found" });
      }
      
      // Get all notes and participant's existing votes
      const notes = await storage.getNotesBySpace(spaceId);
      const existingVotes = await storage.getVotesByParticipant(participantId);
      
      // Calculate next pair and progress using the workspace's pairwise scope
      const pairwiseScope = (space.pairwiseScope || "all") as "all" | "within_categories";
      const nextPair = getNextPair(notes, existingVotes, pairwiseScope, participantId);
      const progress = calculateProgress(notes, existingVotes, pairwiseScope);
      
      if (!nextPair) {
        return res.json({
          pair: null,
          progress,
          message: progress.isComplete ? "All pairs voted" : "Not enough notes to vote"
        });
      }
      
      res.json({
        pair: nextPair,
        progress
      });
    } catch (error) {
      console.error("Error fetching next pair:", error);
      res.status(500).json({ error: "Failed to fetch next pair" });
    }
  });

  // Rankings
  app.get("/api/spaces/:spaceId/rankings", async (req, res) => {
    try {
      const rankings = await storage.getRankingsBySpace(req.params.spaceId);
      res.json(rankings);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch rankings" });
    }
  });

  app.post("/api/rankings", async (req, res) => {
    try {
      const data = insertRankingSchema.parse(req.body);
      const ranking = await storage.createRanking(data);
      res.status(201).json(ranking);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to create ranking" });
    }
  });

  app.post("/api/rankings/bulk", createWorkspaceAccessMiddleware({ requireOpen: true }), async (req, res) => {
    try {
      const { participantId, spaceId, rankings: rankingData } = req.body as {
        participantId: string;
        spaceId: string;
        rankings: Array<{ noteId: string; rank: number }>;
      };

      // Get all notes in the space for validation
      const notes = await storage.getNotesBySpace(spaceId);
      const noteIds = notes.map(n => n.id);
      
      // Validate the ranking
      const validation = validateRanking(noteIds, rankingData);
      if (!validation.valid) {
        return res.status(400).json({ error: validation.error });
      }

      // Delete existing rankings for this participant in this space
      await storage.deleteRankingsByParticipant(participantId, spaceId);

      // Create new rankings
      const rankings = await Promise.all(
        rankingData.map(r =>
          storage.createRanking({
            participantId,
            spaceId,
            noteId: r.noteId,
            rank: r.rank,
          })
        )
      );
      
      void storage.recordPulseActivity(spaceId, "stack-ranking", participantId);

      // Broadcast ranking update to clients in this workspace only
      broadcastToSpace(spaceId, {
        type: "ranking_submitted",
        data: {
          spaceId,
          participantId,
        }
      });

      res.status(201).json(rankings);
    } catch (error) {
      console.error("Failed to create rankings:", error);
      res.status(500).json({ error: "Failed to create rankings" });
    }
  });
  
  // Get participant's rankings
  app.get("/api/spaces/:spaceId/participants/:participantId/rankings", async (req, res) => {
    try {
      const { participantId } = req.params;
      const rankings = await storage.getRankingsByParticipant(participantId);
      res.json(rankings);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch rankings" });
    }
  });
  
  // Get Borda count leaderboard for a space
  app.get("/api/spaces/:spaceId/leaderboard", async (req, res) => {
    try {
      const spaceId = await resolveWorkspaceId(req.params.spaceId);
      if (!spaceId) {
        return res.status(404).json({ error: "Workspace not found" });
      }
      
      const notes = await storage.getNotesBySpace(spaceId);
      const rankings = await storage.getRankingsBySpace(spaceId);
      
      const bordaScores = calculateBordaScores(notes, rankings);
      
      res.json({
        leaderboard: bordaScores,
        totalNotes: notes.length,
        totalRankings: rankings.length,
      });
    } catch (error) {
      console.error("Failed to fetch leaderboard:", error);
      res.status(500).json({ error: "Failed to fetch leaderboard" });
    }
  });
  
  // Get ranking progress for a space
  app.get("/api/spaces/:spaceId/ranking-progress", async (req, res) => {
    try {
      const spaceId = await resolveWorkspaceId(req.params.spaceId);
      if (!spaceId) {
        return res.status(404).json({ error: "Workspace not found" });
      }
      
      const participants = await storage.getParticipantsBySpace(spaceId);
      const rankings = await storage.getRankingsBySpace(spaceId);
      const notes = await storage.getNotesBySpace(spaceId);
      
      const participantIds = participants.map(p => p.id);
      const progress = calculateRankingProgress(participantIds, rankings, notes.length);
      
      res.json(progress);
    } catch (error) {
      console.error("Failed to fetch ranking progress:", error);
      res.status(500).json({ error: "Failed to fetch ranking progress" });
    }
  });
  
  // Check if participant has completed ranking
  app.get("/api/spaces/:spaceId/participants/:participantId/ranking-status", async (req, res) => {
    try {
      const { spaceId, participantId } = req.params;
      
      const notes = await storage.getNotesBySpace(spaceId);
      const rankings = await storage.getRankingsBySpace(spaceId);
      
      const isComplete = hasParticipantCompleted(participantId, rankings, notes.length);
      
      res.json({ isComplete });
    } catch (error) {
      console.error("Failed to fetch ranking status:", error);
      res.status(500).json({ error: "Failed to fetch ranking status" });
    }
  });

  // Marketplace Allocations
  // Submit bulk marketplace allocations
  app.post("/api/marketplace-allocations/bulk", createWorkspaceAccessMiddleware({ requireOpen: true }), async (req, res) => {
    try {
      const { spaceId, allocations: allocationData } = req.body as {
        spaceId: string;
        allocations: Array<{ noteId: string; coins: number }>;
      };

      // SECURITY: Use session-verified participantId to prevent impersonation
      const participantId = req.session?.participantId;
      if (!participantId) {
        return res.status(401).json({ error: "No participant session found. Please rejoin the workspace." });
      }

      // Verify participant belongs to this space
      const participant = await storage.getParticipant(participantId);
      if (!participant || participant.spaceId !== spaceId) {
        return res.status(403).json({ error: "Participant does not belong to this workspace" });
      }

      // SECURITY: Use server-side budget only - never trust client-supplied budget
      const budget = DEFAULT_COIN_BUDGET;
      
      // Validate the allocation
      const validation = validateAllocation(allocationData, budget);
      if (!validation.valid) {
        return res.status(400).json({ error: validation.error });
      }

      // Delete existing allocations for this participant in this space
      await storage.deleteMarketplaceAllocationsByParticipant(participantId, spaceId);

      // Create new allocations (only for non-zero amounts)
      const allocations = await Promise.all(
        allocationData
          .filter(a => a.coins > 0)
          .map(a =>
            storage.createMarketplaceAllocation({
              participantId,
              spaceId,
              noteId: a.noteId,
              coinsAllocated: a.coins,
            })
          )
      );
      
      void storage.recordPulseActivity(spaceId, "marketplace", participantId);

      // Broadcast allocation update to clients in this workspace only
      broadcastToSpace(spaceId, {
        type: "marketplace_allocation_submitted",
        data: {
          spaceId,
          participantId,
        }
      });

      res.status(201).json(allocations);
    } catch (error) {
      console.error("Failed to create marketplace allocations:", error);
      res.status(500).json({ error: "Failed to create marketplace allocations" });
    }
  });
  
  // Get participant's current allocations
  app.get("/api/spaces/:spaceId/participants/:participantId/marketplace-allocations", async (req, res) => {
    try {
      const { participantId: requestedParticipantId, spaceId } = req.params;
      
      // SECURITY: Verify session participant matches requested participant to prevent IDOR
      const sessionParticipantId = req.session?.participantId;
      if (!sessionParticipantId) {
        return res.status(401).json({ error: "No participant session found. Please rejoin the workspace." });
      }
      
      if (sessionParticipantId !== requestedParticipantId) {
        return res.status(403).json({ error: "Cannot access another participant's allocations" });
      }
      
      const allocations = await storage.getMarketplaceAllocationsByParticipant(sessionParticipantId);
      res.json(allocations);
    } catch (error) {
      console.error("Failed to fetch marketplace allocations:", error);
      res.status(500).json({ error: "Failed to fetch marketplace allocations" });
    }
  });

  // Get marketplace leaderboard
  app.get("/api/spaces/:spaceId/marketplace-leaderboard", async (req, res) => {
    try {
      const spaceId = await resolveWorkspaceId(req.params.spaceId);
      if (!spaceId) {
        return res.status(404).json({ error: "Workspace not found" });
      }
      
      const notes = await storage.getNotesBySpace(spaceId);
      const allocations = await storage.getMarketplaceAllocationsBySpace(spaceId);
      
      const leaderboard = calculateMarketplaceScores(notes, allocations);
      
      res.json(leaderboard);
    } catch (error) {
      console.error("Failed to fetch marketplace leaderboard:", error);
      res.status(500).json({ error: "Failed to fetch marketplace leaderboard" });
    }
  });

  // Get marketplace allocation progress
  app.get("/api/spaces/:spaceId/marketplace-progress", async (req, res) => {
    try {
      const spaceId = await resolveWorkspaceId(req.params.spaceId);
      if (!spaceId) {
        return res.status(404).json({ error: "Workspace not found" });
      }
      const { coinBudget } = req.query;
      
      const participants = await storage.getParticipantsBySpace(spaceId);
      const allocations = await storage.getMarketplaceAllocationsBySpace(spaceId);
      
      const participantIds = participants.map(p => p.id);
      const budget = coinBudget ? parseInt(coinBudget as string) : DEFAULT_COIN_BUDGET;
      const progress = calculateAllocationProgress(participantIds, allocations, budget);
      
      res.json(progress);
    } catch (error) {
      console.error("Failed to fetch marketplace progress:", error);
      res.status(500).json({ error: "Failed to fetch marketplace progress" });
    }
  });
  
  // Check if participant has completed allocation
  app.get("/api/spaces/:spaceId/participants/:participantId/marketplace-status", async (req, res) => {
    try {
      const { participantId: requestedParticipantId } = req.params;
      
      // SECURITY: Verify session participant matches requested participant to prevent IDOR
      const sessionParticipantId = req.session?.participantId;
      if (!sessionParticipantId) {
        return res.status(401).json({ error: "No participant session found. Please rejoin the workspace." });
      }
      
      if (sessionParticipantId !== requestedParticipantId) {
        return res.status(403).json({ error: "Cannot access another participant's status" });
      }
      
      const allocations = await storage.getMarketplaceAllocationsByParticipant(sessionParticipantId);
      const isComplete = hasParticipantCompletedAllocation(sessionParticipantId, allocations);
      
      res.json({ isComplete });
    } catch (error) {
      console.error("Failed to fetch marketplace status:", error);
      res.status(500).json({ error: "Failed to fetch marketplace status" });
    }
  });

  // Get participant's remaining budget
  app.get("/api/spaces/:spaceId/participants/:participantId/marketplace-budget", async (req, res) => {
    try {
      const { participantId: requestedParticipantId, spaceId } = req.params;
      
      // SECURITY: Verify session participant matches requested participant to prevent IDOR
      const sessionParticipantId = req.session?.participantId;
      if (!sessionParticipantId) {
        return res.status(401).json({ error: "No participant session found. Please rejoin the workspace." });
      }
      
      if (sessionParticipantId !== requestedParticipantId) {
        return res.status(403).json({ error: "Cannot access another participant's budget" });
      }
      
      // Get workspace to fetch configured coin budget
      const space = await storage.getSpace(spaceId);
      if (!space) {
        return res.status(404).json({ error: "Workspace not found" });
      }
      
      // SECURITY: Use server-side budget from workspace configuration
      const budget = space.marketplaceCoinBudget || DEFAULT_COIN_BUDGET;
      
      const allocations = await storage.getMarketplaceAllocationsByParticipant(sessionParticipantId);
      const remainingBudget = getParticipantRemainingBudget(sessionParticipantId, allocations, budget);
      
      res.json({ 
        totalBudget: budget,
        remainingBudget,
        allocatedBudget: budget - remainingBudget
      });
    } catch (error) {
      console.error("Failed to fetch marketplace budget:", error);
      res.status(500).json({ error: "Failed to fetch marketplace budget" });
    }
  });

  // Survey Questions (Facilitator only)
  // Get all survey questions for a workspace
  app.get("/api/spaces/:spaceId/survey-questions", async (req, res) => {
    try {
      const spaceId = await resolveWorkspaceId(req.params.spaceId);
      if (!spaceId) {
        return res.status(404).json({ error: "Workspace not found" });
      }
      
      const questions = await storage.getSurveyQuestionsBySpace(spaceId);
      res.json(questions);
    } catch (error) {
      console.error("Failed to fetch survey questions:", error);
      res.status(500).json({ error: "Failed to fetch survey questions" });
    }
  });

  // Create a survey question
  app.post("/api/spaces/:spaceId/survey-questions", requireFacilitator, async (req, res) => {
    try {
      const spaceId = await resolveWorkspaceId(req.params.spaceId);
      if (!spaceId) {
        return res.status(404).json({ error: "Workspace not found" });
      }
      
      const { questionText, sortOrder } = req.body;
      
      if (!questionText || typeof questionText !== 'string' || questionText.trim().length === 0) {
        return res.status(400).json({ error: "Question text is required" });
      }
      
      const question = await storage.createSurveyQuestion({
        spaceId,
        questionText: questionText.trim(),
        sortOrder: sortOrder || 0,
      });
      
      // Broadcast to WebSocket clients in this workspace only
      broadcastToSpace(spaceId, { type: "survey_question_created", data: question });
      
      res.status(201).json(question);
    } catch (error) {
      console.error("Failed to create survey question:", error);
      res.status(500).json({ error: "Failed to create survey question" });
    }
  });

  // Update a survey question
  app.patch("/api/survey-questions/:id", requireFacilitator, async (req, res) => {
    try {
      const { questionText, sortOrder } = req.body;
      
      const updates: any = {};
      if (questionText !== undefined) {
        if (typeof questionText !== 'string' || questionText.trim().length === 0) {
          return res.status(400).json({ error: "Question text cannot be empty" });
        }
        updates.questionText = questionText.trim();
      }
      if (sortOrder !== undefined) {
        updates.sortOrder = sortOrder;
      }
      
      const question = await storage.updateSurveyQuestion(req.params.id, updates);
      if (!question) {
        return res.status(404).json({ error: "Survey question not found" });
      }
      
      // Broadcast to WebSocket clients in this workspace only
      broadcastToSpace(question.spaceId, { type: "survey_question_updated", data: question });
      
      res.json(question);
    } catch (error) {
      console.error("Failed to update survey question:", error);
      res.status(500).json({ error: "Failed to update survey question" });
    }
  });

  // Delete a survey question
  app.delete("/api/survey-questions/:id", requireFacilitator, async (req, res) => {
    try {
      // Get question first to determine workspace for broadcast
      const question = await storage.getSurveyQuestion(req.params.id);
      const spaceId = question?.spaceId;
      
      const deleted = await storage.deleteSurveyQuestion(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Survey question not found" });
      }
      
      // Broadcast to WebSocket clients in this workspace only
      if (spaceId) {
        broadcastToSpace(spaceId, { type: "survey_question_deleted", data: { id: req.params.id } });
      }
      
      res.status(204).send();
    } catch (error) {
      console.error("Failed to delete survey question:", error);
      res.status(500).json({ error: "Failed to delete survey question" });
    }
  });

  // Survey Responses
  // Get all survey responses for a workspace (for results grid)
  app.get("/api/spaces/:spaceId/survey-responses", async (req, res) => {
    try {
      const spaceId = await resolveWorkspaceId(req.params.spaceId);
      if (!spaceId) {
        return res.status(404).json({ error: "Workspace not found" });
      }
      
      const responses = await storage.getSurveyResponsesBySpace(spaceId);
      res.json(responses);
    } catch (error) {
      console.error("Failed to fetch survey responses:", error);
      res.status(500).json({ error: "Failed to fetch survey responses" });
    }
  });

  // Get participant's survey responses
  app.get("/api/spaces/:spaceId/participants/:participantId/survey-responses", async (req, res) => {
    try {
      const { participantId: requestedParticipantId, spaceId } = req.params;
      
      // SECURITY: Verify session participant matches requested participant to prevent IDOR
      const sessionParticipantId = req.session?.participantId;
      if (!sessionParticipantId) {
        return res.status(401).json({ error: "No participant session found. Please rejoin the workspace." });
      }
      
      if (sessionParticipantId !== requestedParticipantId) {
        return res.status(403).json({ error: "Cannot access another participant's responses" });
      }
      
      const responses = await storage.getSurveyResponsesByParticipant(sessionParticipantId, spaceId);
      res.json(responses);
    } catch (error) {
      console.error("Failed to fetch survey responses:", error);
      res.status(500).json({ error: "Failed to fetch survey responses" });
    }
  });

  // Submit survey response (create or update)
  app.post("/api/survey-responses", createWorkspaceAccessMiddleware({ requireOpen: true }), async (req, res) => {
    try {
      const { spaceId, questionId, noteId, score } = req.body;
      
      // Validate score is 1-5
      if (!score || score < 1 || score > 5) {
        return res.status(400).json({ error: "Score must be between 1 and 5" });
      }
      
      const participantId = req.session?.participantId;
      if (!participantId) {
        return res.status(401).json({ error: "No participant session found. Please rejoin the workspace." });
      }
      
      // Check if response already exists
      const existingResponses = await storage.getSurveyResponsesByParticipant(participantId, spaceId);
      const existingResponse = existingResponses.find(r => r.questionId === questionId && r.noteId === noteId);
      
      let response;
      if (existingResponse) {
        // Update existing response
        response = await storage.updateSurveyResponse(existingResponse.id, { score });
      } else {
        // Create new response
        response = await storage.createSurveyResponse({
          spaceId,
          participantId,
          questionId,
          noteId,
          score,
        });
      }
      
      void storage.recordPulseActivity(spaceId, "survey", participantId);

      // Broadcast to WebSocket clients in this workspace only
      broadcastToSpace(spaceId, {
        type: "survey_response_submitted",
        data: {
          spaceId,
          participantId,
        }
      });
      
      res.status(201).json(response);
    } catch (error) {
      console.error("Failed to submit survey response:", error);
      res.status(500).json({ error: "Failed to submit survey response" });
    }
  });

  // Export Endpoints (Facilitator/Admin only)
  // Export pairwise voting results
  app.get("/api/spaces/:spaceId/export/pairwise", requireAuth, async (req, res) => {
    try {
      const { spaceId } = req.params;
      
      // Check if user is facilitator or admin for this space
      const space = await storage.getSpace(spaceId);
      if (!space) {
        return res.status(404).json({ error: "Workspace not found" });
      }

      // Verify user is facilitator or admin
      const user = req.user as User;
      const isFacilitator = await storage.getSpaceFacilitatorsByUser(user.id);
      const hasFacilitatorAccess = isFacilitator.some(f => f.spaceId === spaceId);
      
      // Check organization access for company admins
      let hasAccess = false;
      if (user.role === 'global_admin') {
        hasAccess = true;
      } else if (user.role === 'company_admin') {
        // Company admins can only access spaces in their organization
        const companyAdmins = await storage.getCompanyAdminsByUser(user.id);
        hasAccess = companyAdmins.some(ca => ca.organizationId === space.organizationId);
      } else if (hasFacilitatorAccess) {
        hasAccess = true;
      }

      if (!hasAccess) {
        return res.status(403).json({ error: "Access denied. Facilitator or admin access required." });
      }

      // Get notes and votes
      const notes = await storage.getNotesBySpace(spaceId);
      const votes = await storage.getVotesBySpace(spaceId);

      // Calculate win/loss stats
      const voteStats = new Map<string, { wins: number; losses: number; winRate: number }>();
      
      notes.forEach(note => {
        voteStats.set(note.id, { wins: 0, losses: 0, winRate: 0 });
      });

      votes.forEach(vote => {
        const winnerStats = voteStats.get(vote.winnerNoteId);
        const loserStats = voteStats.get(vote.loserNoteId);
        if (winnerStats) winnerStats.wins++;
        if (loserStats) loserStats.losses++;
      });

      // Calculate win rates
      voteStats.forEach((stats, noteId) => {
        const totalVotes = stats.wins + stats.losses;
        stats.winRate = totalVotes > 0 ? stats.wins / totalVotes : 0;
      });

      const exportText = generatePairwiseExport(notes, voteStats);
      
      // Set headers for file download
      res.setHeader('Content-Type', 'text/plain');
      res.setHeader('Content-Disposition', `attachment; filename="pairwise-voting-${spaceId}-${Date.now()}.txt"`);
      res.send(exportText);
    } catch (error) {
      console.error("Failed to export pairwise voting:", error);
      res.status(500).json({ error: "Failed to export pairwise voting data" });
    }
  });

  // Export stack ranking results
  app.get("/api/spaces/:spaceId/export/ranking", requireAuth, async (req, res) => {
    try {
      const { spaceId } = req.params;
      
      // Check if user is facilitator or admin for this space
      const space = await storage.getSpace(spaceId);
      if (!space) {
        return res.status(404).json({ error: "Workspace not found" });
      }

      // Verify user is facilitator or admin
      const user = req.user as User;
      const isFacilitator = await storage.getSpaceFacilitatorsByUser(user.id);
      const hasFacilitatorAccess = isFacilitator.some(f => f.spaceId === spaceId);
      
      // Check organization access for company admins
      let hasAccess = false;
      if (user.role === 'global_admin') {
        hasAccess = true;
      } else if (user.role === 'company_admin') {
        // Company admins can only access spaces in their organization
        const companyAdmins = await storage.getCompanyAdminsByUser(user.id);
        hasAccess = companyAdmins.some(ca => ca.organizationId === space.organizationId);
      } else if (hasFacilitatorAccess) {
        hasAccess = true;
      }

      if (!hasAccess) {
        return res.status(403).json({ error: "Access denied. Facilitator or admin access required." });
      }

      // Get notes and rankings
      const notes = await storage.getNotesBySpace(spaceId);
      const rankings = await storage.getRankingsBySpace(spaceId);

      // Calculate Borda scores
      const leaderboard = calculateBordaScores(notes, rankings);

      const exportText = generateStackRankingExport(leaderboard);
      
      // Set headers for file download
      res.setHeader('Content-Type', 'text/plain');
      res.setHeader('Content-Disposition', `attachment; filename="stack-ranking-${spaceId}-${Date.now()}.txt"`);
      res.send(exportText);
    } catch (error) {
      console.error("Failed to export stack ranking:", error);
      res.status(500).json({ error: "Failed to export stack ranking data" });
    }
  });

  // Export marketplace allocation results
  app.get("/api/spaces/:spaceId/export/marketplace", requireAuth, async (req, res) => {
    try {
      const { spaceId } = req.params;
      
      // Check if user is facilitator or admin for this space
      const space = await storage.getSpace(spaceId);
      if (!space) {
        return res.status(404).json({ error: "Workspace not found" });
      }

      // Verify user is facilitator or admin
      const user = req.user as User;
      const isFacilitator = await storage.getSpaceFacilitatorsByUser(user.id);
      const hasFacilitatorAccess = isFacilitator.some(f => f.spaceId === spaceId);
      
      // Check organization access for company admins
      let hasAccess = false;
      if (user.role === 'global_admin') {
        hasAccess = true;
      } else if (user.role === 'company_admin') {
        // Company admins can only access spaces in their organization
        const companyAdmins = await storage.getCompanyAdminsByUser(user.id);
        hasAccess = companyAdmins.some(ca => ca.organizationId === space.organizationId);
      } else if (hasFacilitatorAccess) {
        hasAccess = true;
      }

      if (!hasAccess) {
        return res.status(403).json({ error: "Access denied. Facilitator or admin access required." });
      }

      // Get notes and allocations
      const notes = await storage.getNotesBySpace(spaceId);
      const allocations = await storage.getMarketplaceAllocationsBySpace(spaceId);

      // Calculate marketplace scores
      const leaderboard = calculateMarketplaceScores(notes, allocations);

      const exportText = generateMarketplaceExport(leaderboard);
      
      // Set headers for file download
      res.setHeader('Content-Type', 'text/plain');
      res.setHeader('Content-Disposition', `attachment; filename="marketplace-allocation-${spaceId}-${Date.now()}.txt"`);
      res.send(exportText);
    } catch (error) {
      console.error("Failed to export marketplace allocation:", error);
      res.status(500).json({ error: "Failed to export marketplace allocation data" });
    }
  });

  // Export ideas and categories as combined CSV
  app.get("/api/spaces/:spaceId/export/data-csv", requireAuth, async (req, res) => {
    try {
      const { spaceId } = req.params;
      
      // Check if user is facilitator or admin for this space
      const space = await storage.getSpace(spaceId);
      if (!space) {
        return res.status(404).json({ error: "Workspace not found" });
      }

      // Verify user is facilitator or admin
      const user = req.user as User;
      const isFacilitator = await storage.getSpaceFacilitatorsByUser(user.id);
      const hasFacilitatorAccess = isFacilitator.some(f => f.spaceId === spaceId);
      
      // Check organization access for company admins
      let hasAccess = false;
      if (user.role === 'global_admin') {
        hasAccess = true;
      } else if (user.role === 'company_admin') {
        const companyAdmins = await storage.getCompanyAdminsByUser(user.id);
        hasAccess = companyAdmins.some(ca => ca.organizationId === space.organizationId);
      } else if (hasFacilitatorAccess) {
        hasAccess = true;
      }

      if (!hasAccess) {
        return res.status(403).json({ error: "Access denied. Facilitator or admin access required." });
      }

      // Get notes, categories, and participants
      const notes = await storage.getNotesBySpace(spaceId);
      const categories = await storage.getCategoriesBySpace(spaceId);
      const participants = await storage.getParticipantsBySpace(spaceId);

      // Create category lookup map
      const categoryMap = new Map(categories.map(c => [c.id, c.name]));
      const participantMap = new Map(participants.map(p => [p.id, p.displayName]));

      // Generate CSV with category repeated for each idea
      let csv = 'Idea,Category,Participant,Created At\n';
      
      for (const note of notes) {
        const content = note.content.replace(/"/g, '""'); // Escape quotes
        const categoryName = note.manualCategoryId ? categoryMap.get(note.manualCategoryId) || 'Uncategorized' : 'Uncategorized';
        const participantName = participantMap.get(note.participantId) || 'Unknown';
        const createdAt = new Date(note.createdAt).toISOString();
        
        csv += `"${content}","${categoryName}","${participantName}","${createdAt}"\n`;
      }
      
      // Set headers for file download
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="workspace-data-${spaceId}-${Date.now()}.csv"`);
      res.send(csv);
    } catch (error) {
      console.error("Failed to export data CSV:", error);
      res.status(500).json({ error: "Failed to export workspace data" });
    }
  });

  // Export categories as CSV
  app.get("/api/spaces/:spaceId/export/categories-csv", requireAuth, async (req, res) => {
    try {
      const { spaceId } = req.params;
      
      // Check if user is facilitator or admin for this space
      const space = await storage.getSpace(spaceId);
      if (!space) {
        return res.status(404).json({ error: "Workspace not found" });
      }

      // Verify user is facilitator or admin
      const user = req.user as User;
      const isFacilitator = await storage.getSpaceFacilitatorsByUser(user.id);
      const hasFacilitatorAccess = isFacilitator.some(f => f.spaceId === spaceId);
      
      // Check organization access for company admins
      let hasAccess = false;
      if (user.role === 'global_admin') {
        hasAccess = true;
      } else if (user.role === 'company_admin') {
        const companyAdmins = await storage.getCompanyAdminsByUser(user.id);
        hasAccess = companyAdmins.some(ca => ca.organizationId === space.organizationId);
      } else if (hasFacilitatorAccess) {
        hasAccess = true;
      }

      if (!hasAccess) {
        return res.status(403).json({ error: "Access denied. Facilitator or admin access required." });
      }

      // Get categories
      const categories = await storage.getCategoriesBySpace(spaceId);

      // Generate CSV
      let csv = 'Name,Color,Created At\n';
      
      for (const category of categories) {
        const name = category.name.replace(/"/g, '""'); // Escape quotes
        const color = category.color;
        const createdAt = new Date(category.createdAt).toISOString();
        
        csv += `"${name}","${color}","${createdAt}"\n`;
      }
      
      // Set headers for file download
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="categories-${spaceId}-${Date.now()}.csv"`);
      res.send(csv);
    } catch (error) {
      console.error("Failed to export categories CSV:", error);
      res.status(500).json({ error: "Failed to export categories" });
    }
  });

  // Import ideas and categories from combined CSV
  app.post("/api/spaces/:spaceId/import/data-csv", requireAuth, upload.single('file'), async (req, res) => {
    try {
      const { spaceId } = req.params;
      
      // Check if user is facilitator or admin for this space
      const space = await storage.getSpace(spaceId);
      if (!space) {
        return res.status(404).json({ error: "Workspace not found" });
      }

      // Verify user is facilitator or admin
      const user = req.user as User;
      const isFacilitator = await storage.getSpaceFacilitatorsByUser(user.id);
      const hasFacilitatorAccess = isFacilitator.some(f => f.spaceId === spaceId);
      
      // Check organization access for company admins
      let hasAccess = false;
      if (user.role === 'global_admin') {
        hasAccess = true;
      } else if (user.role === 'company_admin') {
        const companyAdmins = await storage.getCompanyAdminsByUser(user.id);
        hasAccess = companyAdmins.some(ca => ca.organizationId === space.organizationId);
      } else if (hasFacilitatorAccess) {
        hasAccess = true;
      }

      if (!hasAccess) {
        return res.status(403).json({ error: "Access denied. Facilitator or admin access required." });
      }

      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      // Parse CSV
      const csvContent = req.file.buffer.toString('utf-8');
      const lines = csvContent.split('\n').filter(line => line.trim());
      
      if (lines.length < 2) {
        return res.status(400).json({ error: "CSV file is empty or has no data rows" });
      }

      // Detect format from header row
      // Supported formats:
      // 1. Idea,Category[,Participant,Created At] - standard format
      // 2. Title,Description,Category - AI recommendations format (Category optional)
      const headerLine = lines[0].toLowerCase();
      const isAiRecommendationsFormat = headerLine.includes('title') && headerLine.includes('description');
      
      const dataLines = lines.slice(1);
      
      // Get existing categories to map names to IDs
      const existingCategories = await storage.getCategoriesBySpace(spaceId);
      const categoryNameToId = new Map(existingCategories.map(c => [c.name.toLowerCase(), c.id]));
      
      // Create a default participant for imported ideas
      let importParticipant = await storage.getParticipantsBySpace(spaceId).then(participants => 
        participants.find(p => p.displayName === 'CSV Import')
      );
      
      if (!importParticipant) {
        importParticipant = await storage.createParticipant({
          spaceId,
          displayName: 'CSV Import',
          isGuest: true,
          isOnline: false,
        });
      }

      let importedCount = 0;
      const errors: string[] = [];

      for (let i = 0; i < dataLines.length; i++) {
        try {
          // Simple CSV parsing (handles quoted fields)
          const line = dataLines[i];
          const fields: string[] = [];
          let current = '';
          let inQuotes = false;
          
          for (let j = 0; j < line.length; j++) {
            const char = line[j];
            if (char === '"') {
              if (inQuotes && line[j + 1] === '"') {
                current += '"';
                j++; // Skip next quote
              } else {
                inQuotes = !inQuotes;
              }
            } else if (char === ',' && !inQuotes) {
              fields.push(current);
              current = '';
            } else {
              current += char;
            }
          }
          fields.push(current); // Add last field

          if (fields.length < 1 || !fields[0].trim()) {
            continue; // Skip empty rows
          }

          let content: string;
          let categoryName: string;
          
          if (isAiRecommendationsFormat) {
            // Format: Title,Description,Category (Category optional)
            const title = fields[0].trim();
            const description = fields[1]?.trim() || '';
            categoryName = fields[2]?.trim() || '';
            
            // Combine title and description for content
            content = description ? `**${title}**\n\n${description}` : title;
          } else {
            // Format: Idea,Category[,Participant,Created At]
            content = fields[0].trim();
            categoryName = fields[1]?.trim() || '';
          }
          
          // Find or create category
          let categoryId = null;
          if (categoryName && categoryName.toLowerCase() !== 'uncategorized') {
            const categoryKey = categoryName.toLowerCase();
            if (categoryNameToId.has(categoryKey)) {
              categoryId = categoryNameToId.get(categoryKey)!;
            } else {
              // Create new category
              const newCategory = await storage.createCategory({
                spaceId,
                name: categoryName,
                color: `#${Math.floor(Math.random()*16777215).toString(16).padStart(6, '0')}`, // Random color
              });
              categoryId = newCategory.id;
              categoryNameToId.set(categoryKey, categoryId);
            }
          }

          // Create note
          await storage.createNote({
            spaceId,
            participantId: importParticipant.id,
            content,
            category: null,
            isAiCategory: false,
            manualCategoryId: categoryId,
            isManualOverride: categoryId !== null,
          });
          void storage.recordPulseActivity(spaceId, "ideation", importParticipant.id);

          importedCount++;
        } catch (error) {
          errors.push(`Row ${i + 2}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      res.json({
        success: true,
        imported: importedCount,
        errors: errors.length > 0 ? errors : undefined,
      });
    } catch (error) {
      console.error("Failed to import ideas CSV:", error);
      res.status(500).json({ error: "Failed to import ideas" });
    }
  });

  // Import categories from CSV
  app.post("/api/spaces/:spaceId/import/categories-csv", requireAuth, upload.single('file'), async (req, res) => {
    try {
      const { spaceId } = req.params;
      
      // Check if user is facilitator or admin for this space
      const space = await storage.getSpace(spaceId);
      if (!space) {
        return res.status(404).json({ error: "Workspace not found" });
      }

      // Verify user is facilitator or admin
      const user = req.user as User;
      const isFacilitator = await storage.getSpaceFacilitatorsByUser(user.id);
      const hasFacilitatorAccess = isFacilitator.some(f => f.spaceId === spaceId);
      
      // Check organization access for company admins
      let hasAccess = false;
      if (user.role === 'global_admin') {
        hasAccess = true;
      } else if (user.role === 'company_admin') {
        const companyAdmins = await storage.getCompanyAdminsByUser(user.id);
        hasAccess = companyAdmins.some(ca => ca.organizationId === space.organizationId);
      } else if (hasFacilitatorAccess) {
        hasAccess = true;
      }

      if (!hasAccess) {
        return res.status(403).json({ error: "Access denied. Facilitator or admin access required." });
      }

      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      // Parse CSV
      const csvContent = req.file.buffer.toString('utf-8');
      const lines = csvContent.split('\n').filter(line => line.trim());
      
      if (lines.length < 2) {
        return res.status(400).json({ error: "CSV file is empty or has no data rows" });
      }

      // Skip header row
      const dataLines = lines.slice(1);
      
      // Get existing categories to avoid duplicates
      const existingCategories = await storage.getCategoriesBySpace(spaceId);
      const existingCategoryNames = new Set(existingCategories.map(c => c.name.toLowerCase()));

      let importedCount = 0;
      let skippedCount = 0;
      const errors: string[] = [];

      for (let i = 0; i < dataLines.length; i++) {
        try {
          // Simple CSV parsing (handles quoted fields)
          const line = dataLines[i];
          const fields: string[] = [];
          let current = '';
          let inQuotes = false;
          
          for (let j = 0; j < line.length; j++) {
            const char = line[j];
            if (char === '"') {
              if (inQuotes && line[j + 1] === '"') {
                current += '"';
                j++; // Skip next quote
              } else {
                inQuotes = !inQuotes;
              }
            } else if (char === ',' && !inQuotes) {
              fields.push(current);
              current = '';
            } else {
              current += char;
            }
          }
          fields.push(current); // Add last field

          if (fields.length < 1 || !fields[0].trim()) {
            continue; // Skip empty rows
          }

          const name = fields[0].trim();
          const color = fields[1]?.trim() || `#${Math.floor(Math.random()*16777215).toString(16).padStart(6, '0')}`;
          
          // Skip if category already exists
          if (existingCategoryNames.has(name.toLowerCase())) {
            skippedCount++;
            continue;
          }

          // Create category
          await storage.createCategory({
            spaceId,
            name,
            color,
          });

          importedCount++;
          existingCategoryNames.add(name.toLowerCase());
        } catch (error) {
          errors.push(`Row ${i + 2}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      res.json({
        success: true,
        imported: importedCount,
        skipped: skippedCount,
        errors: errors.length > 0 ? errors : undefined,
      });
    } catch (error) {
      console.error("Failed to import categories CSV:", error);
      res.status(500).json({ error: "Failed to import categories" });
    }
  });

  // AI Usage Statistics
  // Get overall AI usage (global admin only)
  app.get("/api/ai-usage/overall", requireGlobalAdmin, async (req, res) => {
    try {
      const { startDate, endDate } = req.query;
      
      const usageLogs = await storage.getAiUsageLogs({
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
      });

      // Calculate aggregated statistics
      const stats = {
        totalCalls: usageLogs.length,
        totalTokens: usageLogs.reduce((sum, log) => sum + (log.totalTokens || 0), 0),
        totalCostCents: usageLogs.reduce((sum, log) => sum + (log.estimatedCostCents || 0), 0),
        byOperation: {} as Record<string, { count: number; tokens: number; costCents: number }>,
        byOrganization: {} as Record<string, { count: number; tokens: number; costCents: number }>,
      };

      // Group by operation
      usageLogs.forEach(log => {
        if (!stats.byOperation[log.operation]) {
          stats.byOperation[log.operation] = { count: 0, tokens: 0, costCents: 0 };
        }
        stats.byOperation[log.operation].count++;
        stats.byOperation[log.operation].tokens += log.totalTokens || 0;
        stats.byOperation[log.operation].costCents += log.estimatedCostCents || 0;

        // Group by organization
        if (log.organizationId) {
          if (!stats.byOrganization[log.organizationId]) {
            stats.byOrganization[log.organizationId] = { count: 0, tokens: 0, costCents: 0 };
          }
          stats.byOrganization[log.organizationId].count++;
          stats.byOrganization[log.organizationId].tokens += log.totalTokens || 0;
          stats.byOrganization[log.organizationId].costCents += log.estimatedCostCents || 0;
        }
      });

      res.json(stats);
    } catch (error) {
      console.error("Failed to fetch overall AI usage:", error);
      res.status(500).json({ error: "Failed to fetch AI usage statistics" });
    }
  });

  // Get organization-level AI usage (company admins for their org)
  app.get("/api/ai-usage/organization/:organizationId", requireAuth, async (req, res) => {
    try {
      const { organizationId } = req.params;
      const { startDate, endDate } = req.query;
      const currentUser = req.user as User;

      // Check permissions: global admin or company admin for this org
      if (currentUser.role !== 'global_admin') {
        if (currentUser.role !== 'company_admin' || currentUser.organizationId !== organizationId) {
          const companyAdmins = await storage.getCompanyAdminsByUser(currentUser.id);
          const hasPermission = companyAdmins.some(ca => ca.organizationId === organizationId);
          if (!hasPermission) {
            return res.status(403).json({ error: "Insufficient permissions" });
          }
        }
      }

      const usageLogs = await storage.getAiUsageLogs({
        organizationId,
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
      });

      // Calculate aggregated statistics
      const stats = {
        organizationId,
        totalCalls: usageLogs.length,
        totalTokens: usageLogs.reduce((sum, log) => sum + (log.totalTokens || 0), 0),
        totalCostCents: usageLogs.reduce((sum, log) => sum + (log.estimatedCostCents || 0), 0),
        byOperation: {} as Record<string, { count: number; tokens: number; costCents: number }>,
        byWorkspace: {} as Record<string, { count: number; tokens: number; costCents: number }>,
      };

      // Group by operation and workspace
      usageLogs.forEach(log => {
        if (!stats.byOperation[log.operation]) {
          stats.byOperation[log.operation] = { count: 0, tokens: 0, costCents: 0 };
        }
        stats.byOperation[log.operation].count++;
        stats.byOperation[log.operation].tokens += log.totalTokens || 0;
        stats.byOperation[log.operation].costCents += log.estimatedCostCents || 0;

        if (log.spaceId) {
          if (!stats.byWorkspace[log.spaceId]) {
            stats.byWorkspace[log.spaceId] = { count: 0, tokens: 0, costCents: 0 };
          }
          stats.byWorkspace[log.spaceId].count++;
          stats.byWorkspace[log.spaceId].tokens += log.totalTokens || 0;
          stats.byWorkspace[log.spaceId].costCents += log.estimatedCostCents || 0;
        }
      });

      res.json(stats);
    } catch (error) {
      console.error("Failed to fetch organization AI usage:", error);
      res.status(500).json({ error: "Failed to fetch AI usage statistics" });
    }
  });

  // Get workspace-level AI usage (facilitators for their workspace)
  app.get("/api/ai-usage/workspace/:spaceId", requireAuth, async (req, res) => {
    try {
      const { spaceId } = req.params;
      const { startDate, endDate } = req.query;
      const currentUser = req.user as User;

      // Get workspace to verify permissions
      const space = await storage.getSpace(spaceId);
      if (!space) {
        return res.status(404).json({ error: "Workspace not found" });
      }

      // Check permissions
      let hasPermission = false;
      if (currentUser.role === 'global_admin') {
        hasPermission = true;
      } else if (currentUser.role === 'company_admin' && currentUser.organizationId === space.organizationId) {
        hasPermission = true;
      } else {
        const facilitators = await storage.getSpaceFacilitatorsBySpace(spaceId);
        hasPermission = facilitators.some(f => f.userId === currentUser.id);
      }

      if (!hasPermission) {
        return res.status(403).json({ error: "Insufficient permissions" });
      }

      const usageLogs = await storage.getAiUsageLogs({
        spaceId,
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
      });

      // Calculate aggregated statistics
      const stats = {
        spaceId,
        spaceName: space.name,
        totalCalls: usageLogs.length,
        totalTokens: usageLogs.reduce((sum, log) => sum + (log.totalTokens || 0), 0),
        totalCostCents: usageLogs.reduce((sum, log) => sum + (log.estimatedCostCents || 0), 0),
        byOperation: {} as Record<string, { count: number; tokens: number; costCents: number }>,
        recentLogs: usageLogs.slice(0, 10).map(log => ({
          id: log.id,
          operation: log.operation,
          modelName: log.modelName,
          totalTokens: log.totalTokens,
          estimatedCostCents: log.estimatedCostCents,
          metadata: log.metadata,
          createdAt: log.createdAt,
        })),
      };

      // Group by operation
      usageLogs.forEach(log => {
        if (!stats.byOperation[log.operation]) {
          stats.byOperation[log.operation] = { count: 0, tokens: 0, costCents: 0 };
        }
        stats.byOperation[log.operation].count++;
        stats.byOperation[log.operation].tokens += log.totalTokens || 0;
        stats.byOperation[log.operation].costCents += log.estimatedCostCents || 0;
      });

      res.json(stats);
    } catch (error) {
      console.error("Failed to fetch workspace AI usage:", error);
      res.status(500).json({ error: "Failed to fetch AI usage statistics" });
    }
  });

  // Results Endpoints
  // Generate cohort results (Facilitator/Admin only)
  app.post("/api/spaces/:spaceId/results/cohort", requireAuth, async (req, res) => {
    try {
      const spaceId = await resolveWorkspaceId(req.params.spaceId);
      if (!spaceId) return res.status(404).json({ error: "Workspace not found" });
      const currentUser = req.user as User;

      // Check if user is facilitator or admin for this space
      const space = await storage.getSpace(spaceId);
      if (!space) {
        return res.status(404).json({ error: "Workspace not found" });
      }

      // Verify permissions
      let hasPermission = false;
      if (currentUser.role === 'global_admin') {
        hasPermission = true;
      } else if (currentUser.role === 'company_admin' && currentUser.organizationId === space.organizationId) {
        hasPermission = true;
      } else {
        const facilitators = await storage.getSpaceFacilitatorsBySpace(spaceId);
        hasPermission = facilitators.some(f => f.userId === currentUser.id);
      }

      if (!hasPermission) {
        return res.status(403).json({ error: "Insufficient permissions. Facilitator or admin access required." });
      }

      // Generate cohort results
      const cohortResult = await generateCohortResults(spaceId, currentUser.id);

      // Notify linked participants + facilitators that results are ready
      try {
        const org = await storage.getOrganization(space.organizationId);
        const link = `/o/${org?.slug || space.organizationId}/s/${space.code || spaceId}/results`;
        const recipients = new Set<string>();
        const ps = await storage.getParticipantsBySpace(spaceId);
        ps.forEach(p => { if (p.userId) recipients.add(p.userId); });
        const sf = await storage.getSpaceFacilitatorsBySpace(spaceId);
        sf.forEach(f => recipients.add(f.userId));
        await Promise.all(Array.from(recipients).map(uid => notifyUser({
          userId: uid,
          type: "results_ready",
          title: `Results ready: ${space.name}`,
          body: "Cohort results have been generated. Tap to view.",
          link,
          spaceId,
        })));
      } catch (e) { console.error("[notify results_ready]", e); }

      res.json(cohortResult);
    } catch (error: any) {
      console.error("Failed to generate cohort results:", error);
      res.status(500).json({ error: error.message || "Failed to generate cohort results" });
    }
  });

  // Get cohort results for a workspace
  app.get("/api/spaces/:spaceId/results/cohort", requireAuth, async (req, res) => {
    try {
      const spaceId = await resolveWorkspaceId(req.params.spaceId);
      if (!spaceId) {
        return res.status(404).json({ error: "Workspace not found" });
      }

      const cohortResults = await storage.getCohortResultsBySpace(spaceId);

      // Validate persisted hash against current workspace state so callers
      // never see stale rows after notes/votes/KB docs change. Legacy rows
      // with a null inputsHash are also treated as stale (forcing
      // regeneration) so we never serve pre-FTS-cache results unchecked.
      if (cohortResults.length > 0) {
        const stored = cohortResults[0];
        const currentHash = await getCurrentCohortInputsHash(spaceId);
        if (currentHash && (!stored.inputsHash || currentHash !== stored.inputsHash)) {
          return res.status(404).json({ error: "Cohort results are stale; regenerate to refresh.", stale: true });
        }
        return res.json(stored);
      }
      res.status(404).json({ error: "No cohort results found for this workspace" });
    } catch (error) {
      console.error("Failed to fetch cohort results:", error);
      res.status(500).json({ error: "Failed to fetch cohort results" });
    }
  });

  // Public endpoint - Get cohort results without authentication (for sharing)
  app.get("/api/spaces/:spaceId/public-results", async (req, res) => {
    try {
      const spaceId = await resolveWorkspaceId(req.params.spaceId);
      if (!spaceId) {
        return res.status(404).json({ error: "Workspace not found" });
      }

      const cohortResults = await storage.getCohortResultsBySpace(spaceId);

      // Return the most recent cohort result if available
      if (cohortResults.length > 0) {
        const result = cohortResults[0];
        const currentHash = await getCurrentCohortInputsHash(spaceId);
        if (currentHash && (!result.inputsHash || currentHash !== result.inputsHash)) {
          return res.status(404).json({ error: "Results are stale; please check back shortly.", stale: true });
        }
        const metadata = result.metadata as { totalNotes?: number; totalVotes?: number } | null;
        
        // Get participant count from the space
        const participants = await storage.getParticipantsBySpace(spaceId);
        
        // Return a sanitized version without sensitive data
        res.json({
          id: result.id,
          spaceId: result.spaceId,
          summary: result.summary,
          keyThemes: result.keyThemes || [],
          topIdeas: result.topIdeas || [],
          insights: typeof result.insights === 'string' ? result.insights.split('\n').filter(Boolean) : [],
          recommendations: typeof result.recommendations === 'string' ? result.recommendations.split('\n').filter(Boolean) : [],
          participantCount: participants.length,
          totalVotes: metadata?.totalVotes || 0,
          generatedAt: result.createdAt,
        });
      } else {
        res.status(404).json({ error: "No results available for this workspace" });
      }
    } catch (error) {
      console.error("Failed to fetch public results:", error);
      res.status(500).json({ error: "Failed to fetch results" });
    }
  });

  // Generate personalized results for a participant
  app.post("/api/spaces/:spaceId/results/personalized", createWorkspaceAccessMiddleware({ allowClosed: true }), async (req, res) => {
    try {
      const { spaceId } = req.params;
      const sessionParticipantId = req.session?.participantId;

      if (!sessionParticipantId) {
        return res.status(401).json({ error: "No participant session found. Please rejoin the workspace." });
      }

      // Get the most recent cohort result. Refuse to generate personalized
      // results when the latest cohort row is stale relative to the
      // workspace's current inputs, so we never seed personalized cache
      // entries from outdated cohort grounding.
      const cohortResults = await storage.getCohortResultsBySpace(spaceId);
      const cohortResultId = cohortResults.length > 0 ? cohortResults[0].id : undefined;
      if (cohortResults.length > 0) {
        const stored = cohortResults[0];
        const currentHash = await getCurrentCohortInputsHash(spaceId);
        if (currentHash && (!stored.inputsHash || currentHash !== stored.inputsHash)) {
          return res.status(409).json({
            error: "Cohort results are stale; regenerate cohort results before personalizing.",
            stale: true,
          });
        }
      }

      // Generate personalized results
      const personalResult = await generatePersonalizedResults(
        spaceId,
        sessionParticipantId,
        cohortResultId
      );

      res.json(personalResult);
    } catch (error: any) {
      console.error("Failed to generate personalized results:", error);
      res.status(500).json({ error: error.message || "Failed to generate personalized results" });
    }
  });

  // Get personalized results for a participant
  app.get("/api/spaces/:spaceId/results/personalized", createWorkspaceAccessMiddleware({ allowClosed: true }), async (req, res) => {
    try {
      const { spaceId } = req.params;
      const sessionParticipantId = req.session?.participantId;

      if (!sessionParticipantId) {
        return res.status(401).json({ error: "No participant session found. Please rejoin the workspace." });
      }

      const personalResults = await storage.getPersonalizedResultsByParticipant(sessionParticipantId);

      // Return the most recent personalized result for this workspace
      const workspaceResults = personalResults.filter(r => r.spaceId === spaceId);
      if (workspaceResults.length > 0) {
        const stored = workspaceResults[0];
        const currentHash = await getCurrentPersonalizedInputsHash(spaceId, sessionParticipantId);
        if (currentHash && (!stored.inputsHash || currentHash !== stored.inputsHash)) {
          return res.status(404).json({ error: "Personalized results are stale; regenerate to refresh.", stale: true });
        }
        return res.json(stored);
      }
      res.status(404).json({ error: "No personalized results found" });
    } catch (error) {
      console.error("Failed to fetch personalized results:", error);
      res.status(500).json({ error: "Failed to fetch personalized results" });
    }
  });

  // Generate personalized results for all participants (Facilitator/Admin only)
  app.post("/api/spaces/:spaceId/results/generate-all", requireAuth, async (req, res) => {
    try {
      const spaceId = await resolveWorkspaceId(req.params.spaceId);
      if (!spaceId) return res.status(404).json({ error: "Workspace not found" });
      const currentUser = req.user as User;

      // Check if user is facilitator or admin for this space
      const space = await storage.getSpace(spaceId);
      if (!space) {
        return res.status(404).json({ error: "Workspace not found" });
      }

      // Verify permissions
      let hasPermission = false;
      if (currentUser.role === 'global_admin') {
        hasPermission = true;
      } else if (currentUser.role === 'company_admin' && currentUser.organizationId === space.organizationId) {
        hasPermission = true;
      } else {
        const facilitators = await storage.getSpaceFacilitatorsBySpace(spaceId);
        hasPermission = facilitators.some(f => f.userId === currentUser.id);
      }

      if (!hasPermission) {
        return res.status(403).json({ error: "Insufficient permissions. Facilitator or admin access required." });
      }

      // Get the most recent cohort result
      const cohortResults = await storage.getCohortResultsBySpace(spaceId);
      if (cohortResults.length === 0) {
        return res.status(400).json({ error: "Please generate cohort results first" });
      }

      // Generate personalized results for all participants
      const results = await generateAllPersonalizedResults(spaceId, cohortResults[0].id);

      res.json({ 
        generated: results.length,
        results 
      });
    } catch (error: any) {
      console.error("Failed to generate all personalized results:", error);
      res.status(500).json({ error: error.message || "Failed to generate personalized results" });
    }
  });

  // ============================================================
  // Email Notification Endpoints
  // ============================================================

  // Send session invite to a participant
  app.post("/api/spaces/:spaceId/notifications/invite", requireFacilitator, async (req, res) => {
    try {
      const { spaceId } = req.params;
      const { email, name, role, personalMessage, sessionDate, sessionTime } = req.body as {
        email: string;
        name: string;
        role?: 'participant' | 'facilitator';
        personalMessage?: string;
        sessionDate?: string;
        sessionTime?: string;
      };

      if (!email || !name) {
        return res.status(400).json({ error: "Email and name are required" });
      }

      const space = await storage.getSpace(spaceId);
      if (!space) {
        return res.status(404).json({ error: "Workspace not found" });
      }

      const organization = space.organizationId ? await storage.getOrganization(space.organizationId) : null;
      const currentUser = req.user as User;

      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const joinUrl = `${baseUrl}/o/${organization?.slug || 'org'}/s/${space.code}`;

      await sendSessionInviteEmail(email, {
        inviteeName: name,
        role: role || 'participant',
        organizationName: organization?.name || 'Organization',
        workspaceName: space.name,
        workspaceCode: space.code,
        facilitatorName: currentUser.username,
        joinUrl,
        personalMessage,
        sessionDate,
        sessionTime,
      });

      res.json({ success: true, message: `Invitation sent to ${email}` });
    } catch (error: any) {
      console.error("Failed to send invitation:", error);
      res.status(500).json({ error: error.message || "Failed to send invitation" });
    }
  });

  // Send bulk invites to multiple participants
  app.post("/api/spaces/:spaceId/notifications/invite-bulk", requireFacilitator, async (req, res) => {
    try {
      const { spaceId } = req.params;
      const { recipients, personalMessage, sessionDate, sessionTime } = req.body as {
        recipients: Array<{ email: string; name: string; role?: 'participant' | 'facilitator' }>;
        personalMessage?: string;
        sessionDate?: string;
        sessionTime?: string;
      };

      if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
        return res.status(400).json({ error: "Recipients array is required" });
      }

      const space = await storage.getSpace(spaceId);
      if (!space) {
        return res.status(404).json({ error: "Workspace not found" });
      }

      const organization = space.organizationId ? await storage.getOrganization(space.organizationId) : null;
      const currentUser = req.user as User;

      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const joinUrl = `${baseUrl}/o/${organization?.slug || 'org'}/s/${space.code}`;

      let sent = 0;
      let failed = 0;
      const errors: string[] = [];

      for (const recipient of recipients) {
        try {
          await sendSessionInviteEmail(recipient.email, {
            inviteeName: recipient.name,
            role: recipient.role || 'participant',
            organizationName: organization?.name || 'Organization',
            workspaceName: space.name,
            workspaceCode: space.code,
            facilitatorName: currentUser.username,
            joinUrl,
            personalMessage,
            sessionDate,
            sessionTime,
          });
          sent++;
        } catch (error: any) {
          failed++;
          errors.push(`${recipient.email}: ${error.message}`);
        }
      }

      res.json({ success: true, sent, failed, errors: errors.length > 0 ? errors : undefined });
    } catch (error: any) {
      console.error("Failed to send bulk invitations:", error);
      res.status(500).json({ error: error.message || "Failed to send invitations" });
    }
  });

  // Send phase change notification to all participants with email
  app.post("/api/spaces/:spaceId/notifications/phase-change", requireFacilitator, async (req, res) => {
    try {
      const { spaceId } = req.params;
      const { previousPhase, newPhase, phaseDescription, deadline } = req.body as {
        previousPhase?: string;
        newPhase: string;
        phaseDescription?: string;
        deadline?: string;
      };

      if (!newPhase) {
        return res.status(400).json({ error: "newPhase is required" });
      }

      const space = await storage.getSpace(spaceId);
      if (!space) {
        return res.status(404).json({ error: "Workspace not found" });
      }

      const organization = space.organizationId ? await storage.getOrganization(space.organizationId) : null;
      const participants = await storage.getParticipantsBySpace(spaceId);

      // Filter participants who have email addresses
      const emailableParticipants = participants.filter(p => p.email);
      
      if (emailableParticipants.length === 0) {
        return res.json({ success: true, sent: 0, message: "No participants with email addresses" });
      }

      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const actionUrl = `${baseUrl}/o/${organization?.slug || 'org'}/s/${space.code}`;

      const phaseDescriptions: Record<string, string> = {
        'ideation': 'Share your ideas and contribute to the collective vision.',
        'voting': 'Compare ideas pairwise and vote for your preferences.',
        'ranking': 'Rank the ideas in order of priority.',
        'marketplace': 'Allocate your coins to the ideas you value most.',
        'survey': 'Rate the ideas on the survey questions.',
        'priority-matrix': 'Position ideas on the priority matrix.',
        'staircase': 'Rate ideas on the staircase scale.',
        'results': 'View the results and insights from the session.',
      };

      const description = phaseDescription || phaseDescriptions[newPhase.toLowerCase()] || `The session has moved to the ${newPhase} phase.`;

      const results = await sendBulkNotifications('phase_change', 
        emailableParticipants.map(p => ({ email: p.email!, name: p.displayName })),
        {
          organizationName: organization?.name || 'Organization',
          workspaceName: space.name,
          workspaceCode: space.code,
          previousPhase,
          newPhase,
          phaseDescription: description,
          actionUrl,
          deadline,
        }
      );

      res.json({ success: true, ...results });
    } catch (error: any) {
      console.error("Failed to send phase change notifications:", error);
      res.status(500).json({ error: error.message || "Failed to send notifications" });
    }
  });

  // Send results available notification to all participants
  app.post("/api/spaces/:spaceId/notifications/results-ready", requireFacilitator, async (req, res) => {
    try {
      const { spaceId } = req.params;

      const space = await storage.getSpace(spaceId);
      if (!space) {
        return res.status(404).json({ error: "Workspace not found" });
      }

      const organization = space.organizationId ? await storage.getOrganization(space.organizationId) : null;
      const participants = await storage.getParticipantsBySpace(spaceId);

      // Filter participants who have email addresses
      const emailableParticipants = participants.filter(p => p.email);
      
      if (emailableParticipants.length === 0) {
        return res.json({ success: true, sent: 0, message: "No participants with email addresses" });
      }

      // Check what results are available
      const cohortResults = await storage.getCohortResultsBySpace(spaceId);
      const cohortResultsAvailable = cohortResults.length > 0;

      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const resultsUrl = `${baseUrl}/o/${organization?.slug || 'org'}/s/${space.code}/results`;

      const results = await sendBulkNotifications('results_ready',
        emailableParticipants.map(p => ({ email: p.email!, name: p.displayName })),
        {
          organizationName: organization?.name || 'Organization',
          workspaceName: space.name,
          workspaceCode: space.code,
          hasPersonalizedResults: true,
          cohortResultsAvailable,
          resultsUrl,
        }
      );

      res.json({ success: true, ...results });
    } catch (error: any) {
      console.error("Failed to send results notifications:", error);
      res.status(500).json({ error: error.message || "Failed to send notifications" });
    }
  });

  // ============================================
  // In-app Notifications API
  // ============================================
  app.get("/api/notifications", requireAuth, async (req, res) => {
    try {
      const user = req.user as User;
      const limit = Math.min(parseInt(String(req.query.limit || "30"), 10) || 30, 100);
      const items = await storage.getNotificationsByUser(user.id, limit);
      const unreadCount = await storage.getUnreadNotificationCount(user.id);
      res.json({ items, unreadCount });
    } catch (e) {
      console.error("Failed to fetch notifications:", e);
      res.status(500).json({ error: "Failed to fetch notifications" });
    }
  });

  app.post("/api/notifications/:id/read", requireAuth, async (req, res) => {
    try {
      const user = req.user as User;
      const updated = await storage.markNotificationRead(req.params.id, user.id);
      if (!updated) return res.status(404).json({ error: "Notification not found" });
      res.json(updated);
    } catch (e) {
      res.status(500).json({ error: "Failed to mark notification read" });
    }
  });

  app.post("/api/notifications/mark-all-read", requireAuth, async (req, res) => {
    try {
      const user = req.user as User;
      const count = await storage.markAllNotificationsRead(user.id);
      res.json({ count });
    } catch (e) {
      res.status(500).json({ error: "Failed to mark all notifications read" });
    }
  });

  const httpServer = createServer(app);

  // WebSocket server for real-time updates
  const wss = new WebSocketServer({ server: httpServer, path: "/ws" });

  // Guarded debug logger — set WS_DEBUG=1 (server) to surface verbose tracing.
  const WS_DEBUG = process.env.WS_DEBUG === "1" || process.env.WS_DEBUG === "true";
  const wsDebug = (...args: unknown[]) => {
    if (WS_DEBUG) console.log("[ws]", ...args);
  };

  const clients = new Map<string, Set<WebSocket>>();
  const userClients = new Map<string, Set<WebSocket>>();
  // Per-socket metadata so we can build presence rosters and reap stale sockets.
  type WsMeta = PresenceWsMeta;
  const wsMeta = new WeakMap<WebSocket, WsMeta>();

  wss.on("connection", async (ws, req) => {
    const url = new URL(req.url!, `http://${req.headers.host}`);
    const rawSpaceParam = url.searchParams.get("spaceId");
    const requestedUserId = url.searchParams.get("userId");

    if (!rawSpaceParam && !requestedUserId) {
      ws.close(1008, "Missing spaceId or userId");
      return;
    }

    // Clients may connect with either the workspace UUID or the 8-digit code
    // (the URL slug). Server broadcasts use the canonical UUID, so resolve
    // here and register the socket under BOTH keys when they differ. This
    // ensures real-time events reach every subscriber regardless of which
    // identifier they connected with.
    let spaceId: string | null = rawSpaceParam;
    let spaceIdAlias: string | null = null;
    if (rawSpaceParam) {
      try {
        const resolved = await resolveWorkspaceIdentifier(rawSpaceParam);
        if (resolved && resolved !== rawSpaceParam) {
          spaceId = resolved;
          spaceIdAlias = rawSpaceParam;
        }
      } catch (e) {
        // Fall through with the raw param; the socket will still receive
        // any broadcast that targets the same string the client supplied.
      }
    }

    // Authenticate userId-scoped channels against the express session.
    // Anonymous space-only subscriptions remain allowed (participant flows).
    let userId: string | null = null;
    if (requestedUserId) {
      try {
        const sessionUserId = await getUserIdFromUpgradeRequest(req);
        if (sessionUserId && sessionUserId === requestedUserId) {
          userId = sessionUserId;
        } else {
          ws.close(1008, "Unauthorized userId channel");
          return;
        }
      } catch (e) {
        console.error("[WS auth] Failed to verify session:", e);
        ws.close(1011, "Session verification failed");
        return;
      }
    }

    wsMeta.set(ws, { spaceId, userId, isAlive: true });

    if (spaceId) {
      if (!clients.has(spaceId)) clients.set(spaceId, new Set());
      clients.get(spaceId)!.add(ws);
    }
    if (spaceIdAlias) {
      if (!clients.has(spaceIdAlias)) clients.set(spaceIdAlias, new Set());
      clients.get(spaceIdAlias)!.add(ws);
    }

    if (userId) {
      if (!userClients.has(userId)) userClients.set(userId, new Set());
      userClients.get(userId)!.add(ws);
    }

    // Heartbeat: clients reply to server pings automatically (browsers
    // auto-pong ping frames at the protocol layer); we mark the socket alive
    // when the pong arrives. Sockets without a pong between sweeps get
    // terminated.
    ws.on("pong", () => {
      const meta = wsMeta.get(ws);
      if (meta) meta.isAlive = true;
    });

    if (spaceId) broadcastPresence(spaceId);

    ws.on("close", () => {
      if (spaceId) {
        const spaceClients = clients.get(spaceId);
        if (spaceClients) {
          spaceClients.delete(ws);
          if (spaceClients.size === 0) clients.delete(spaceId);
        }
        broadcastPresence(spaceId);
      }
      if (spaceIdAlias) {
        const aliasClients = clients.get(spaceIdAlias);
        if (aliasClients) {
          aliasClients.delete(ws);
          if (aliasClients.size === 0) clients.delete(spaceIdAlias);
        }
      }
      if (userId) {
        const uc = userClients.get(userId);
        if (uc) {
          uc.delete(ws);
          if (uc.size === 0) userClients.delete(userId);
        }
      }
      wsMeta.delete(ws);
      wsDebug("close", { spaceId, userId });
    });

    ws.on("message", (data) => {
      try {
        const message = JSON.parse(data.toString());

        // Broadcast presence updates
        if (message.type === "presence" && spaceId) {
          broadcastToSpace(spaceId, message);
        }
      } catch (error) {
        console.error("WebSocket message error:", error);
      }
    });

    wsDebug("connect", { spaceId, userId });
  });

  // Sweep stale sockets every 30s. Any socket that didn't pong since the
  // previous sweep is terminated and cleaned up via its close handler.
  const HEARTBEAT_MS = 30_000;
  // unref so the heartbeat alone never keeps the process alive — the HTTP
  // listener owns process lifetime, and tests/embedders can shut down
  // cleanly without manually clearing this interval.
  const heartbeatInterval = setInterval(() => {
    wss.clients.forEach((ws) => {
      const meta = wsMeta.get(ws);
      if (!meta) return;
      if (!meta.isAlive) {
        wsDebug("terminating stale socket", { spaceId: meta.spaceId, userId: meta.userId });
        try { ws.terminate(); } catch { /* ignore */ }
        return;
      }
      meta.isAlive = false;
      try { ws.ping(); } catch { /* ignore */ }
    });
  }, HEARTBEAT_MS);
  heartbeatInterval.unref?.();
  wss.on("close", () => clearInterval(heartbeatInterval));

  function broadcast(message: any) {
    const payload = JSON.stringify(message);
    clients.forEach((spaceClients) => {
      spaceClients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(payload);
        }
      });
    });
  }

  function broadcastToSpace(spaceId: string, message: any) {
    const payload = JSON.stringify(message);
    const spaceClients = clients.get(spaceId);
    if (spaceClients) {
      spaceClients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(payload);
        }
      });
    }
  }

  // Presence: count currently-connected sockets per workspace and emit a
  // `presence_changed` event whenever it changes. Facilitators can also poll
  // via GET /api/spaces/:spaceId/presence.
  function broadcastPresence(spaceId: string) {
    // Only broadcast count over the wire — userIds are PII and only returned
    // to authorized callers via the GET endpoint below.
    const { count } = getPresenceForSpace(spaceId, clients, wsMeta);
    broadcastToSpace(spaceId, buildPresenceChangedMessage(spaceId, count));
  }
  app.get(
    "/api/spaces/:spaceId/presence",
    createWorkspaceAccessMiddleware({}),
    async (req, res) => {
      try {
        // Middleware has already resolved/validated the workspace ID.
        // userIds are PII and are only returned to authenticated callers
        // who are admins, facilitators, or project members on this
        // workspace. Guests/anonymous participants only receive the count.
        const spaceId = req.params.spaceId;
        const { count, userIds } = getPresenceForSpace(spaceId, clients, wsMeta);
        const currentUser = req.user as User | undefined;
        if (!currentUser) {
          return res.status(401).json({ error: "Authentication required" });
        }
        let authorized = false;
        if (currentUser.role === "global_admin") {
          authorized = true;
        } else {
          const space = await storage.getSpace(spaceId);
          if (
            space &&
            currentUser.role === "company_admin" &&
            currentUser.organizationId === space.organizationId
          ) {
            authorized = true;
          } else if (space) {
            const facilitators = await storage.getSpaceFacilitatorsBySpace(spaceId);
            if (facilitators.some((f) => f.userId === currentUser.id)) {
              authorized = true;
            } else if (space.projectId) {
              authorized = await storage.isProjectMember(space.projectId, currentUser.id);
            }
          }
        }
        if (!authorized) {
          return res.status(403).json({ error: "Not authorized to view presence roster" });
        }
        res.json({ count, userIds });
      } catch (e) {
        res.status(500).json({ error: "Failed to fetch presence" });
      }
    },
  );

  function broadcastToUser(userId: string, message: any) {
    const payload = JSON.stringify(message);
    const uc = userClients.get(userId);
    if (uc) {
      uc.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(payload);
        }
      });
    }
  }

  // Helper: persist a notification and push to that user's WS connections
  async function notifyUser(params: {
    userId: string;
    type: string;
    title: string;
    body?: string | null;
    link?: string | null;
    spaceId?: string | null;
  }) {
    try {
      const created = await storage.createNotification({
        userId: params.userId,
        type: params.type,
        title: params.title,
        body: params.body ?? null,
        link: params.link ?? null,
        spaceId: params.spaceId ?? null,
      });
      broadcastToUser(params.userId, { type: "notification", data: created });
    } catch (err) {
      console.error("[notify] Failed to create/dispatch notification:", err);
    }
  }

  return httpServer;
}
