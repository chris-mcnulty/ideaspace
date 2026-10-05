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
  deleteNotes: vi.fn(),
  getCompanyAdminsByUser: vi.fn(),
  getSignalDeck: vi.fn(),
  getSignalActivities: vi.fn(),
  reorderSignalActivities: vi.fn(),
  createSignalActivity: vi.fn(),
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
  storage.deleteNotes.mockResolvedValue(true);
  storage.getCompanyAdminsByUser.mockResolvedValue([]);
});

describe("note deletion resolves access from the note", () => {
  const remove = () => request(app).delete(`/api/notes/${NOTE_ID}`);

  it.each(["draft", "open", "closed", "archived", "processing", "starship"])(
    "allows super-admin single deletion in %s and returns an empty 204 response",
    async status => {
      Object.assign(space, { status, guestAllowed: false });
      currentUser = { id: "super-admin", role: "global_admin" };
      participantId = undefined;
      const response = await remove();
      expect(response.status).toBe(204);
      expect(response.text).toBe("");
      expect(storage.deleteNote).toHaveBeenCalledWith(NOTE_ID);
    },
  );

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

  it.each(["draft", "closed", "archived", "processing", "open", "starship"])(
    "lets a project-member facilitator delete in %s without guest or participant access",
    async status => {
      Object.assign(space, { status, projectId: "project", guestAllowed: false });
      currentUser = { id: "project-facilitator", role: "facilitator" };
      participantId = undefined;
      storage.isProjectMember.mockResolvedValue(true);
      expect((await remove()).status).toBe(204);
      expect(storage.isProjectMember).toHaveBeenCalledWith("project", "project-facilitator");
      expect(storage.deleteNote).toHaveBeenCalledWith(NOTE_ID);
    },
  );

  it("allows a company admin with an organization association to delete in a closed workspace", async () => {
    Object.assign(space, { status: "closed", guestAllowed: false });
    currentUser = { id: "org-admin", role: "company_admin", organizationId: "other-org" };
    participantId = undefined;
    storage.getCompanyAdminsByUser.mockResolvedValue([{ organizationId: "org" }]);
    expect((await remove()).status).toBe(204);
    expect(storage.deleteNote).toHaveBeenCalledWith(NOTE_ID);
  });

  it("rejects a facilitator outside the workspace project even when participation is inactive", async () => {
    Object.assign(space, { status: "draft", projectId: "project", guestAllowed: false });
    currentUser = { id: "outsider", role: "facilitator" };
    participantId = undefined;
    storage.isProjectMember.mockResolvedValue(false);
    expect((await remove()).status).toBe(403);
    expect(storage.deleteNote).not.toHaveBeenCalled();
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

describe("bulk note deletion", () => {
  const secondNoteId = "66666666-6666-6666-6666-666666666666";
  const remove = (ids: unknown = [NOTE_ID, secondNoteId]) =>
    request(app).post("/api/notes/bulk-delete").send({ ids });

  beforeEach(() => {
    currentUser = { id: "super-admin", role: "global_admin" };
    participantId = undefined;
    space.guestAllowed = false;
    storage.getNote.mockImplementation(async id => ({
      id, spaceId: SPACE_ID, participantId: PARTICIPANT_ID,
    }));
  });

  it.each(["draft", "open", "closed", "archived", "processing", "starship"])(
    "allows super-admin bulk deletion in %s with an empty 204 response",
    async status => {
      space.status = status;
      const response = await remove();
      expect(response.status).toBe(204);
      expect(response.text).toBe("");
      expect(storage.deleteNotes).toHaveBeenCalledWith([NOTE_ID, secondNoteId]);
    },
  );

  it("deduplicates the selected notes", async () => {
    expect((await remove([NOTE_ID, NOTE_ID])).status).toBe(204);
    expect(storage.deleteNotes).toHaveBeenCalledWith([NOTE_ID]);
  });

  it("does not partially delete when a selected note is missing", async () => {
    storage.getNote.mockResolvedValueOnce({ id: NOTE_ID, spaceId: SPACE_ID }).mockResolvedValueOnce(undefined);
    expect((await remove()).status).toBe(404);
    expect(storage.deleteNotes).not.toHaveBeenCalled();
  });

  it("rejects a batch spanning multiple workspaces", async () => {
    storage.getNote.mockResolvedValueOnce({ id: NOTE_ID, spaceId: SPACE_ID })
      .mockResolvedValueOnce({ id: secondNoteId, spaceId: "other-workspace" });
    expect((await remove()).status).toBe(400);
    expect(storage.deleteNotes).not.toHaveBeenCalled();
  });

  it("allows project-member facilitators to moderate a closed workspace", async () => {
    Object.assign(space, { status: "closed", projectId: "project" });
    currentUser = { id: "facilitator", role: "facilitator" };
    storage.isProjectMember.mockResolvedValue(true);
    expect((await remove()).status).toBe(204);
    expect(storage.deleteNotes).toHaveBeenCalledOnce();
  });

  it("rejects unrelated facilitators", async () => {
    currentUser = { id: "outsider", role: "facilitator" };
    expect((await remove()).status).toBe(403);
    expect(storage.deleteNotes).not.toHaveBeenCalled();
  });

  it.each([{ ids: [] }, { ids: [NOTE_ID, null] }, { ids: [123] }, { ids: [""] }])("rejects invalid IDs %j", async ({ ids }) => {
    expect((await remove(ids)).status).toBe(400);
    expect(storage.deleteNotes).not.toHaveBeenCalled();
  });
});

describe("Signal guest session access", () => {
  beforeEach(() => {
    storage.getSignalDeck.mockResolvedValue({
      id: "deck", spaceId: SPACE_ID, activeActivityId: NOTE_ID, responsesOpen: true,
    });
    storage.getSignalActivities.mockResolvedValue([{ id: NOTE_ID, deckId: "deck", status: "live" }]);
  });

  it("loads the live question for a fresh anonymous visitor when guests are allowed", async () => {
    participantId = undefined;
    const response = await request(app).get(`/api/spaces/${SPACE_ID}/signal`);
    expect(response.status).toBe(200);
    expect(response.body.deck).toMatchObject({ activeActivityId: NOTE_ID, responsesOpen: true });
  });

  it("returns an explicit access error for an existing session from another workspace", async () => {
    participantSpaceId = "different-workspace";
    const response = await request(app).get(`/api/spaces/${SPACE_ID}/signal`);
    expect(response.status).toBe(403);
    expect(response.body.code).toBe("NO_ACCESS");
    expect(storage.getSignalDeck).not.toHaveBeenCalled();
  });

  it("loads the live question again once the session belongs to this workspace", async () => {
    const response = await request(app).get(`/api/spaces/${SPACE_ID}/signal`);
    expect(response.status).toBe(200);
    expect(response.body.deck.responsesOpen).toBe(true);
  });
});

describe("Signal interactive reordering", () => {
  const ids = [NOTE_ID, MATRIX_ID, STAIRCASE_ID];
  const reorder = (activityIds: unknown = ids) =>
    request(app).post(`/api/spaces/${SPACE_ID}/signal/activities/reorder`).send({ activityIds });

  beforeEach(() => {
    currentUser = { id: "admin", role: "global_admin" };
    participantId = undefined;
    space.status = "closed";
    space.guestAllowed = false;
    storage.getSignalDeck.mockResolvedValue({ id: "deck", spaceId: SPACE_ID, activeActivityId: MATRIX_ID });
    storage.reorderSignalActivities.mockImplementation(async (_deckId, orderedIds) =>
      orderedIds.map((id: string, orderIndex: number) => ({ id, orderIndex })));
  });

  it("saves a super-admin order independently of participant restrictions", async () => {
    const response = await reorder([...ids].reverse());
    expect(response.status).toBe(200);
    expect(storage.reorderSignalActivities).toHaveBeenCalledWith("deck", [...ids].reverse());
    expect(response.body.map((activity: any) => activity.id)).toEqual([...ids].reverse());
  });

  it("allows project-member facilitators", async () => {
    space.projectId = "project";
    currentUser = { id: "facilitator", role: "facilitator" };
    storage.isProjectMember.mockResolvedValue(true);
    expect((await reorder()).status).toBe(200);
  });

  it("rejects unrelated facilitators before changing order", async () => {
    currentUser = { id: "outsider", role: "facilitator" };
    expect((await reorder()).status).toBe(403);
    expect(storage.reorderSignalActivities).not.toHaveBeenCalled();
  });

  it("rejects participant-only requests", async () => {
    currentUser = undefined;
    participantId = PARTICIPANT_ID;
    expect((await reorder()).status).toBe(401);
    expect(storage.reorderSignalActivities).not.toHaveBeenCalled();
  });

  it.each([{ ids: [NOTE_ID, NOTE_ID] }, { ids: ["invalid"] }, { ids: null }])(
    "rejects malformed or duplicate IDs %j",
    async ({ ids }) => {
      expect((await reorder(ids)).status).toBe(400);
      expect(storage.reorderSignalActivities).not.toHaveBeenCalled();
    },
  );

  it("reports a stale or cross-deck list without claiming success", async () => {
    storage.reorderSignalActivities.mockResolvedValue(undefined);
    expect((await reorder()).status).toBe(409);
  });

  it("does not create a deck if none exists", async () => {
    storage.getSignalDeck.mockResolvedValue(undefined);
    expect((await reorder()).status).toBe(404);
    expect(storage.reorderSignalActivities).not.toHaveBeenCalled();
  });

  it("appends new interactives after the greatest remaining order index", async () => {
    storage.getSignalActivities.mockResolvedValue([{ id: NOTE_ID, orderIndex: 0 }, { id: MATRIX_ID, orderIndex: 4 }]);
    storage.createSignalActivity.mockImplementation(async data => ({ id: STAIRCASE_ID, ...data }));
    const response = await request(app).post(`/api/spaces/${SPACE_ID}/signal/activities`)
      .send({ type: "word_cloud", prompt: "New question" });
    expect(response.status).toBe(201);
    expect(response.body.orderIndex).toBe(5);
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