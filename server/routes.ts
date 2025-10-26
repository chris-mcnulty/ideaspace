import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import passport from "passport";
import multer from "multer";
import { storage } from "./storage";
import { insertOrganizationSchema, insertSpaceSchema, createSpaceApiSchema, insertParticipantSchema, insertNoteSchema, insertVoteSchema, insertRankingSchema, insertUserSchema, insertKnowledgeBaseDocumentSchema, type User } from "@shared/schema";
import { z } from "zod";
import { categorizeNotes, rewriteCard } from "./services/openai";
import { getNextPair, calculateProgress } from "./services/pairwise";
import { validateRanking, calculateBordaScores, calculateRankingProgress, hasParticipantCompleted } from "./services/stack-ranking";
import { validateAllocation, calculateMarketplaceScores, calculateAllocationProgress, hasParticipantCompleted as hasParticipantCompletedAllocation, getParticipantRemainingBudget, DEFAULT_COIN_BUDGET } from "./services/marketplace";
import { hashPassword, requireAuth, requireRole, requireGlobalAdmin, requireCompanyAdmin, requireFacilitator } from "./auth";
import { generateWorkspaceCode, isValidWorkspaceCode } from "./services/workspace-code";
import { sendAccessRequestEmail } from "./services/email";
import { fileUploadService } from "./services/file-upload";

// Extend express-session types to include participantId
declare module "express-session" {
  interface SessionData {
    participantId?: string;
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Configure multer for file uploads (max 10MB)
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB
    },
    fileFilter: (req, file, cb) => {
      // Allow common document types
      const allowedMimes = [
        'application/pdf',
        'text/plain',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      ];
      
      if (allowedMimes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error('Invalid file type. Only PDF, TXT, DOC, DOCX, XLS, XLSX are allowed.'));
      }
    },
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
      });
      
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
      res.status(201).json(userWithoutPassword);
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

  app.post("/api/auth/login", (req, res, next) => {
    passport.authenticate("local", (err: any, user: User | false, info: any) => {
      if (err) {
        return res.status(500).json({ error: "Authentication error" });
      }
      if (!user) {
        return res.status(401).json({ error: info?.message || "Invalid credentials" });
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
        const { password, ...userWithoutPassword } = user;
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

  // Admin Panel APIs
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
      res.status(201).json(org);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to create organization" });
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
      // Check if identifier looks like a workspace code (nnnn-nnnn format: 9 chars, single hyphen at position 4)
      // vs a UUID (36 chars with hyphens) or serial integer
      let space;
      const isWorkspaceCode = /^\d{4}-\d{4}$/.test(identifier);
      
      if (isWorkspaceCode) {
        // Lookup by code (e.g., "1234-6133")
        space = await storage.getSpaceByCode(identifier);
      } else {
        // Lookup by ID (UUID or serial integer)
        space = await storage.getSpace(identifier);
      }
      
      if (!space) {
        return res.status(404).json({ error: "Space not found" });
      }
      res.json(space);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch space" });
    }
  });

  // Protected: Require facilitator or above to create spaces
  app.post("/api/spaces", requireFacilitator, async (req, res) => {
    try {
      const data = createSpaceApiSchema.parse(req.body);
      
      // Auto-generate code if not provided
      const code = data.code || await generateWorkspaceCode();
      
      const space = await storage.createSpace({
        ...data,
        code,
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
      const data = insertSpaceSchema.partial().parse(req.body);
      const space = await storage.updateSpace(req.params.id, data);
      if (!space) {
        return res.status(404).json({ error: "Space not found" });
      }
      res.json(space);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to update space" });
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
    } catch (error) {
      res.status(500).json({ error: "Failed to delete space" });
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

      // If approved, create or update user and add them as facilitator or participant
      if (data.status === "approved") {
        // Check if user with this email already exists
        let user = await storage.getUserByEmail(request.email);
        
        if (!user) {
          // Create a new user account (they'll need to set password on first login)
          // For now, we'll just add them to the workspace as a participant
          // They can register later to claim the account
          // Note: This is a placeholder - full implementation would involve invitation emails
        }
        
        // TODO: Add user as participant or facilitator to the workspace
        // This will be implemented in a later task
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
        scope: z.enum(['system', 'organization', 'workspace']),
        organizationId: z.string().optional(),
        spaceId: z.string().optional(),
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
        const facilitators = await storage.getSpaceFacilitatorsBySpace(data.spaceId);
        hasPermission = facilitators.some(f => f.userId === currentUser.id);
      }

      if (!hasPermission) {
        return res.status(403).json({ error: "Insufficient permissions to create template from this workspace" });
      }

      const template = await storage.createWorkspaceTemplateFromSpace(
        data.spaceId,
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

  // Get template details (notes and documents)
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

  // Participants
  app.get("/api/spaces/:spaceId/participants", async (req, res) => {
    try {
      const participants = await storage.getParticipantsBySpace(req.params.spaceId);
      res.json(participants);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch participants" });
    }
  });

  app.post("/api/participants", async (req, res) => {
    try {
      const data = insertParticipantSchema.parse(req.body);
      
      // Verify that the space exists
      const space = await storage.getSpace(data.spaceId);
      if (!space) {
        return res.status(404).json({ error: "Space not found" });
      }
      
      const participant = await storage.createParticipant(data);
      
      // Store participant ID in session for authentication
      if (req.session) {
        req.session.participantId = participant.id;
      }
      
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
      const notes = await storage.getNotesBySpace(req.params.spaceId);
      res.json(notes);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch notes" });
    }
  });

  app.post("/api/notes", async (req, res) => {
    try {
      const data = insertNoteSchema.parse(req.body);
      
      // Security: Verify participantId ownership
      // Facilitators/admins can create notes on behalf of participants (preloading)
      // Participants can only create notes as themselves (use session participantId)
      const user = req.user as User | undefined;
      const isFacilitatorOrAdmin = user && ["facilitator", "company_admin", "global_admin"].includes(user.role);
      
      if (!isFacilitatorOrAdmin) {
        // For participants, override participantId with session value to prevent forgery
        const sessionParticipantId = req.session?.participantId;
        if (!sessionParticipantId) {
          return res.status(401).json({ error: "No participant session found. Please rejoin the workspace." });
        }
        data.participantId = sessionParticipantId;
      }
      
      const note = await storage.createNote(data);
      
      // Broadcast to WebSocket clients
      broadcast({ type: "note_created", data: note });
      
      res.status(201).json(note);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to create note" });
    }
  });

  app.patch("/api/notes/:id", async (req, res) => {
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
      const note = await storage.updateNote(req.params.id, data);
      if (!note) {
        return res.status(404).json({ error: "Note not found" });
      }
      
      // Broadcast to WebSocket clients
      broadcast({ type: "note_updated", data: note });
      
      res.json(note);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to update note" });
    }
  });

  app.delete("/api/notes/:id", async (req, res) => {
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
      
      // Broadcast to WebSocket clients
      broadcast({ type: "note_deleted", data: { id: req.params.id } });
      
      res.status(204).send();
    } catch (error) {
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
      
      const deleted = await storage.deleteNotes(ids);
      if (!deleted) {
        return res.status(404).json({ error: "Notes not found" });
      }
      
      // Broadcast to WebSocket clients
      broadcast({ type: "notes_deleted", data: { ids } });
      
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete notes" });
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
      const { spaceId } = req.params;
      
      // Get space for context
      const space = await storage.getSpace(spaceId);
      if (!space) {
        return res.status(404).json({ error: "Space not found" });
      }
      
      // Fetch all notes for this space
      const notes = await storage.getNotesBySpace(spaceId);
      if (notes.length === 0) {
        return res.status(400).json({ error: "No notes to categorize" });
      }

      // Call GPT-5 to categorize notes with usage tracking context
      let result;
      try {
        const user = req.user as User;
        result = await categorizeNotes(
          notes.map(n => ({ id: n.id, content: n.content })),
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
      
      // Verify all notes were categorized
      const noteIds = new Set(notes.map(n => n.id));
      const categorizedIds = new Set(result.categories.map(c => c.noteId));
      
      if (categorizedIds.size !== noteIds.size) {
        console.warn(`Warning: ${noteIds.size} notes but only ${categorizedIds.size} categorized`);
      }
      
      // Update notes with AI-generated categories
      const updateResults = await Promise.allSettled(
        result.categories.map(({ noteId, category }) => 
          storage.updateNote(noteId, { category, isAiCategory: true })
        )
      );
      
      const failedUpdates = updateResults.filter(r => r.status === 'rejected');
      if (failedUpdates.length > 0) {
        console.error(`${failedUpdates.length} note updates failed`);
      }
      
      // Broadcast category updates to all connected clients
      broadcast({ 
        type: "categories_updated", 
        data: { 
          spaceId, 
          categories: result.categories,
          summary: result.summary,
          totalNotes: notes.length,
          categorizedNotes: result.categories.length
        } 
      });
      
      res.json({ 
        success: true, 
        categoriesApplied: result.categories.length,
        totalNotes: notes.length,
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

  // Votes
  app.get("/api/spaces/:spaceId/votes", async (req, res) => {
    try {
      const votes = await storage.getVotesBySpace(req.params.spaceId);
      res.json(votes);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch votes" });
    }
  });

  app.post("/api/votes", async (req, res) => {
    try {
      const data = insertVoteSchema.parse(req.body);
      const vote = await storage.createVote(data);
      
      // Broadcast vote update to all connected clients
      broadcast({
        type: "vote_recorded",
        data: {
          spaceId: vote.spaceId,
          participantId: vote.participantId,
        }
      });
      
      res.status(201).json(vote);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to create vote" });
    }
  });

  // Get next pair of notes for participant to vote on
  app.get("/api/spaces/:spaceId/participants/:participantId/next-pair", async (req, res) => {
    try {
      const { spaceId, participantId } = req.params;
      
      // Get all notes and participant's existing votes
      const notes = await storage.getNotesBySpace(spaceId);
      const existingVotes = await storage.getVotesByParticipant(participantId);
      
      // Calculate next pair and progress
      const nextPair = getNextPair(notes, existingVotes);
      const progress = calculateProgress(notes, existingVotes);
      
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

  app.post("/api/rankings/bulk", async (req, res) => {
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
      
      // Broadcast ranking update to all connected clients
      broadcast({
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
      const { spaceId } = req.params;
      
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
      const { spaceId } = req.params;
      
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
  app.post("/api/marketplace-allocations/bulk", async (req, res) => {
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
      
      // Broadcast allocation update to all connected clients
      broadcast({
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
      const { spaceId } = req.params;
      
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
      const { spaceId } = req.params;
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
      const { participantId: requestedParticipantId } = req.params;
      
      // SECURITY: Verify session participant matches requested participant to prevent IDOR
      const sessionParticipantId = req.session?.participantId;
      if (!sessionParticipantId) {
        return res.status(401).json({ error: "No participant session found. Please rejoin the workspace." });
      }
      
      if (sessionParticipantId !== requestedParticipantId) {
        return res.status(403).json({ error: "Cannot access another participant's budget" });
      }
      
      // SECURITY: Use server-side budget only
      const budget = DEFAULT_COIN_BUDGET;
      
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

  const httpServer = createServer(app);

  // WebSocket server for real-time updates
  const wss = new WebSocketServer({ server: httpServer, path: "/ws" });

  const clients = new Map<string, Set<WebSocket>>();

  wss.on("connection", (ws, req) => {
    const url = new URL(req.url!, `http://${req.headers.host}`);
    const spaceId = url.searchParams.get("spaceId");

    if (!spaceId) {
      ws.close(1008, "Missing spaceId");
      return;
    }

    // Add client to the space's client set
    if (!clients.has(spaceId)) {
      clients.set(spaceId, new Set());
    }
    clients.get(spaceId)!.add(ws);

    ws.on("close", () => {
      const spaceClients = clients.get(spaceId);
      if (spaceClients) {
        spaceClients.delete(ws);
        if (spaceClients.size === 0) {
          clients.delete(spaceId);
        }
      }
    });

    ws.on("message", (data) => {
      try {
        const message = JSON.parse(data.toString());
        
        // Broadcast presence updates
        if (message.type === "presence") {
          broadcastToSpace(spaceId, message);
        }
      } catch (error) {
        console.error("WebSocket message error:", error);
      }
    });
  });

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

  return httpServer;
}
