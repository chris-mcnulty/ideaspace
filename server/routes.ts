import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import passport from "passport";
import { storage } from "./storage";
import { insertOrganizationSchema, insertSpaceSchema, createSpaceApiSchema, insertParticipantSchema, insertNoteSchema, insertVoteSchema, insertRankingSchema, insertUserSchema, type User } from "@shared/schema";
import { z } from "zod";
import { categorizeNotes } from "./services/openai";
import { getNextPair, calculateProgress } from "./services/pairwise";
import { hashPassword, requireAuth, requireRole, requireGlobalAdmin, requireCompanyAdmin, requireFacilitator } from "./auth";
import { generateWorkspaceCode, isValidWorkspaceCode } from "./services/workspace-code";

export async function registerRoutes(app: Express): Promise<Server> {
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
      req.logIn(user, (err) => {
        if (err) {
          return res.status(500).json({ error: "Login failed" });
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

  // Organizations
  app.get("/api/organizations/:slug", async (req, res) => {
    try {
      const org = await storage.getOrganizationBySlug(req.params.slug);
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
      const space = await storage.getSpace(req.params.id);
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

  // Protected: Facilitators can trigger AI categorization
  app.post("/api/spaces/:spaceId/categorize", requireFacilitator, async (req, res) => {
    try {
      const { spaceId } = req.params;
      
      // Fetch all notes for this space
      const notes = await storage.getNotesBySpace(spaceId);
      if (notes.length === 0) {
        return res.status(400).json({ error: "No notes to categorize" });
      }

      // Call GPT-5 to categorize notes
      let result;
      try {
        result = await categorizeNotes(notes.map(n => ({ id: n.id, content: n.content })));
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

      res.status(201).json(rankings);
    } catch (error) {
      res.status(500).json({ error: "Failed to create rankings" });
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
