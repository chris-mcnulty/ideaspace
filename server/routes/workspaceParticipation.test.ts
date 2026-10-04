import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";
import type { Server } from "http";

// Exercise the real middleware and handlers without a database or external APIs.
const storage = vi.hoisted(() => ({
  getSpace: vi.fn(),
  getSpaceByCode: vi.fn(),
  getParticipant: vi.fn(),
  getSpaceFacilitatorsBySpace: vi.fn(),
  isProjectMember: vi.fn(),
  getWorkspaceModules: vi.fn(),
  updateSpace: vi.fn(),
  getPriorityMatrix: vi.fn(),
  createPriorityMatrix: vi.fn(),
  upsertPriorityMatrixPosition: vi.fn(),
  getStaircaseModule: vi.fn(),
  createStaircaseModule: vi.fn(),
  upsertStaircasePosition: vi.fn(),
  recordPulseActivity: vi.fn(),
  getNote: vi.fn(),
  deleteNote: vi.fn(),
  getCompanyAdminsByUser: vi.fn(),
}));
vi.mock("../storage", () => ({ storage }));
vi.mock("../db", () => ({ db: {}, pool: {} }));
vi.mock("../session", () => ({ getUserIdFromUpgradeRequest: vi.fn() }));
vi.mock("../services/openai", () => ({
  openai: {},
  categorizeNotes: vi.fn(),
  rewriteCard: vi.fn(),
  suggestIdeas: vi.fn(),
}));
vi.mock("./auth-oauth", () => ({ default: express.Router() }));
vi.mock("./auth-entra", () => ({ default: express.Router() }));

const { registerRoutes } = await import("../routes");
const SPACE_ID = "11111111-1111-1111-1111-111111111111";
const PARTICIPANT_ID = "22222222-2222-2222-2222-222222222222";
const NOTE_ID = "33333333-3333-3333-3333-333333333333";
const MATRIX_ID = "44444444-4444-4444-4444-444444444444";
const STAIRCASE_ID = "55555555-5555-5555-5555-555555555555";

const app = express();
let server: Server;
let space: any;
let participantId: string | undefined;
let participantSpaceId: string;
let currentUser: any;
app.use(express.json());
app.use((req, _res, next) => {
  req.session = { participantId } as any;
  req.user = currentUser;
  req.isAuthenticated = (() => Boolean(currentUser)) as typeof req.isAuthenticated;
  next();
});

beforeAll(async () => {
  server = await registerRoutes(app);
});
afterAll(() => {
  server.close();
});
beforeEach(() => {
  vi.resetAllMocks();
  space = { id: SPACE_ID, status: "open", guestAllowed: true, organizationId: "org" };
  participantId = PARTICIPANT_ID;
  participantSpaceId = SPACE_ID;
  currentUser = undefined;
  storage.getSpace.mockImplementation(async () => space);
  storage.getSpaceByCode.mockImplementation(async () => space);
  storage.getParticipant.mockImplementation(async () => ({
    id: PARTICIPANT_ID, spaceId: participantSpaceId, isGuest: true,
  }));
  storage.getSpaceFacilitatorsBySpace.mockResolvedValue([]);
  storage.getWorkspaceModules.mockResolvedValue([]);
  storage.updateSpace.mockImplementation(async (_id, updates) => Object.assign(space, updates));
  storage.getPriorityMatrix.mockResolvedValue({ id: MATRIX_ID, spaceId: SPACE_ID });
  storage.getStaircaseModule.mockResolvedValue({
    id: STAIRCASE_ID, spaceId: SPACE_ID, minScore: 0, maxScore: 10,
  });
  storage.upsertPriorityMatrixPosition.mockImplementation(async data => ({ id: "position", ...data }));
  storage.upsertStaircasePosition.mockImplementation(async data => ({ id: "position", ...data }));
  storage.recordPulseActivity.mockResolvedValue(undefined);
  storage.getNote.mockResolvedValue({ id: NOTE_ID, spaceId: SPACE_ID, participantId: PARTICIPANT_ID });
  storage.deleteNote.mockResolvedValue(true);
  storage.getCompanyAdminsByUser.mockResolvedValue([]);
});

describe("note deletion resolves access from the note", () => {
  const remove = () => request(app).delete(`/api/notes/${NOTE_ID}`);

  it.each(["open", "ideation-live", "signal", "starship", "priority-matrix", "staircase"])(
    "lets the owner delete without a workspace ID during %s",
    async status => {
      space.status = status;
      expect((await remove()).status).toBe(204);
      expect(storage.deleteNote).toHaveBeenCalledWith(NOTE_ID);
    },
  );

  it("allows the assigned facilitator to delete another participant's note in a closed workspace", async () => {
    space.status = "closed";
    currentUser = { id: "facilitator", role: "facilitator" };
    participantId = undefined;
    storage.getSpaceFacilitatorsBySpace.mockResolvedValue([{ userId: "facilitator" }]);
    expect((await remove()).status).toBe(204);
    expect(storage.deleteNote).toHaveBeenCalledOnce();
  });

  it.each(["closed", "draft", "archived", "processing"])("rejects owner deletion in %s", async status => {
    space.status = status;
    expect((await remove()).status).toBe(403);
    expect(storage.deleteNote).not.toHaveBeenCalled();
  });

  it("rejects deletion of another participant's note", async () => {
    storage.getNote.mockResolvedValue({ id: NOTE_ID, spaceId: SPACE_ID, participantId: "other-participant" });
    expect((await remove()).status).toBe(403);
    expect(storage.deleteNote).not.toHaveBeenCalled();
  });

  it("rejects a participant session from another workspace", async () => {
    participantSpaceId = "other-workspace";
    expect((await remove()).status).toBe(403);
    expect(storage.deleteNote).not.toHaveBeenCalled();
  });

  it("rejects unrelated facilitators even when guest access is enabled", async () => {
    currentUser = { id: "outsider", role: "facilitator" };
    participantId = undefined;
    expect((await remove()).status).toBe(403);
    expect(storage.deleteNote).not.toHaveBeenCalled();
  });

  it("does not trust a workspace ID supplied in the request body", async () => {
    participantSpaceId = "other-workspace";
    const response = await request(app).delete(`/api/notes/${NOTE_ID}`).send({ spaceId: "other-workspace" });
    expect(response.status).toBe(403);
    expect(storage.getSpace).toHaveBeenCalledWith(SPACE_ID);
    expect(storage.deleteNote).not.toHaveBeenCalled();
  });

  it("returns 404 for a missing note", async () => {
    storage.getNote.mockResolvedValue(undefined);
    expect((await remove()).status).toBe(404);
    expect(storage.deleteNote).not.toHaveBeenCalled();
  });
});

for (const activity of [
  {
    phase: "priority-matrix",
    place: () => request(app).put(`/api/spaces/${SPACE_ID}/priority-matrix/positions`)
      .send({ noteId: NOTE_ID, xCoord: 25, yCoord: 75, participantId: "spoofed" }),
    upsert: storage.upsertPriorityMatrixPosition,
    create: storage.createPriorityMatrix,
  },
  {
    phase: "staircase",
    place: () => request(app).post(`/api/spaces/${SPACE_ID}/staircase-positions`)
      .send({ noteId: NOTE_ID, score: 7, participantId: "spoofed" }),
    upsert: storage.upsertStaircasePosition,
    create: storage.createStaircaseModule,
  },
]) {
  describe(`${activity.phase} participant placement`, () => {
    it("accepts Open and a facilitator-activated phase, then rejects closure", async () => {
      expect((await activity.place()).status).toBe(200);
      currentUser = { id: "admin", role: "global_admin" };
      const navigation = await request(app)
        .post(`/api/spaces/${SPACE_ID}/navigate-participants`)
        .send({ phase: activity.phase });
      expect(navigation.status).toBe(200);
      expect(space.status).toBe(activity.phase);
      currentUser = undefined;
      const placed = await activity.place();
      expect(placed.status).toBe(200);
      expect(placed.body.participantId).toBe(PARTICIPANT_ID);
      if (activity.phase === "priority-matrix") {
        expect(placed.body).toMatchObject({ xCoord: 0.25, yCoord: 0.75 });
      }
      space.status = "closed";
      expect((await activity.place()).status).toBe(403);
      expect(activity.upsert).toHaveBeenCalledTimes(2);
    });

    it.each(["closed", "draft", "processing", "archived", "unknown", ""])(
      "rejects %s before creating configuration or saving a placement",
      async status => {
        space.status = status;
        storage.getPriorityMatrix.mockResolvedValue(undefined);
        storage.getStaircaseModule.mockResolvedValue(undefined);
        const response = await activity.place();
        expect(response.status).toBe(403);
        expect(response.body.code).toBe(
          status === "closed" ? "WORKSPACE_CLOSED" : "WORKSPACE_NOT_OPEN",
        );
        expect(activity.create).not.toHaveBeenCalled();
        expect(activity.upsert).not.toHaveBeenCalled();
      },
    );

    it("requires a participant session even when a participant ID is sent in the body", async () => {
      space.status = activity.phase;
      participantId = undefined;
      const response = await activity.place();
      expect(response.status).toBe(401);
      expect(response.body.error).toBe("No participant session found");
      expect(activity.upsert).not.toHaveBeenCalled();
    });

    it("rejects a participant session from a different workspace", async () => {
      space.status = activity.phase;
      participantSpaceId = "other-workspace";
      const response = await activity.place();
      expect(response.status).toBe(403);
      expect(response.body.code).toBe("NO_ACCESS");
      expect(activity.upsert).not.toHaveBeenCalled();
    });

    it("rejects a session whose participant no longer exists", async () => {
      space.status = activity.phase;
      storage.getParticipant.mockResolvedValue(undefined);
      expect((await activity.place()).status).toBe(403);
      expect(activity.upsert).not.toHaveBeenCalled();
    });

    it("preserves administrator placement without a participant session", async () => {
      space.status = "closed";
      currentUser = { id: "admin", role: "global_admin" };
      participantId = undefined;
      expect((await activity.place()).status).toBe(200);
      expect(activity.upsert).toHaveBeenCalledOnce();
    });
  });
}