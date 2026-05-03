import { describe, it, expect, beforeEach, vi } from "vitest";
import express from "express";
import request from "supertest";

// ---------------------------------------------------------------------------
// Mock the storage module BEFORE importing the route under test so the route's
// `import { storage } from "../storage"` picks up our stubs. We only stub the
// methods the Pulse handler touches.
// ---------------------------------------------------------------------------
const storageMock = {
  getSpaceByCode: vi.fn(),
  getSpace: vi.fn(),
  getSpaceFacilitatorsBySpace: vi.fn(),
  getParticipantsBySpace: vi.fn().mockResolvedValue([]),
  getWorkspaceModules: vi.fn().mockResolvedValue([]),
  getPriorityMatrix: vi.fn().mockResolvedValue(null),
  getStaircaseModule: vi.fn().mockResolvedValue(null),
  getPulseActivityBuckets: vi.fn().mockResolvedValue([]),
  getPulseAggregates: vi.fn().mockResolvedValue({
    noteCount: 0,
    voteCount: 0,
    distinctNoteParticipants: [],
    distinctVoteParticipants: [],
    distinctRankingParticipants: [],
    distinctMarketplaceParticipants: [],
    distinctSurveyParticipants: [],
    distinctMatrixParticipants: [],
    distinctStaircaseParticipants: [],
    noteCountsByParticipant: [],
    voteCountsByParticipant: [],
    recentNoteTimestamps: [],
  }),
};

vi.mock("../storage", () => ({ storage: storageMock }));

// Import after the mock is registered.
const { registerPulseRoute } = await import("./pulse");

const SPACE_ID = "11111111-1111-1111-1111-111111111111";
const ORG_A = "org-a";
const ORG_B = "org-b";

const SPACE = {
  id: SPACE_ID,
  organizationId: ORG_A,
  name: "Test Workspace",
};

type FakeUser = { id: string; role: string; organizationId: string | null };

// Build an Express app that mounts the real pulse handler. A tiny middleware
// stands in for passport: when `currentUser` is set on the test app context,
// it marks the request as authenticated; otherwise the real `requireAuth`
// middleware will respond with 401.
function buildApp(getUser: () => FakeUser | null) {
  const app = express();
  app.use((req, _res, next) => {
    const u = getUser();
    (req as any).user = u || undefined;
    (req as any).isAuthenticated = () => !!u;
    next();
  });
  registerPulseRoute(app);
  return app;
}

describe("GET /api/spaces/:spaceId/pulse — authorization", () => {
  let currentUser: FakeUser | null = null;
  const app = buildApp(() => currentUser);

  beforeEach(() => {
    currentUser = null;
    storageMock.getSpace.mockReset().mockResolvedValue(SPACE);
    storageMock.getSpaceByCode.mockReset().mockResolvedValue(undefined);
    storageMock.getSpaceFacilitatorsBySpace.mockReset().mockResolvedValue([]);
  });

  it("returns 401 when the request is unauthenticated", async () => {
    currentUser = null;
    const res = await request(app).get(`/api/spaces/${SPACE_ID}/pulse`);
    expect(res.status).toBe(401);
    // requireAuth never reaches storage.
    expect(storageMock.getSpace).not.toHaveBeenCalled();
  });

  it("returns 200 for a global_admin (regardless of org)", async () => {
    currentUser = { id: "u-global", role: "global_admin", organizationId: ORG_B };
    const res = await request(app).get(`/api/spaces/${SPACE_ID}/pulse`);
    expect(res.status).toBe(200);
    // Global admin shortcut: facilitator list MUST NOT be consulted.
    expect(storageMock.getSpaceFacilitatorsBySpace).not.toHaveBeenCalled();
    expect(res.body).toHaveProperty("participants");
    expect(res.body).toHaveProperty("totals");
  });

  it("returns 200 for a company_admin whose organizationId matches the workspace's org", async () => {
    currentUser = { id: "u-ca-a", role: "company_admin", organizationId: ORG_A };
    const res = await request(app).get(`/api/spaces/${SPACE_ID}/pulse`);
    expect(res.status).toBe(200);
    // Org-matched company_admin shortcut: facilitator list MUST NOT be consulted.
    expect(storageMock.getSpaceFacilitatorsBySpace).not.toHaveBeenCalled();
  });

  it("returns 403 for a company_admin from a different org with no facilitator membership", async () => {
    currentUser = { id: "u-ca-b", role: "company_admin", organizationId: ORG_B };
    storageMock.getSpaceFacilitatorsBySpace.mockResolvedValue([]);
    const res = await request(app).get(`/api/spaces/${SPACE_ID}/pulse`);
    expect(res.status).toBe(403);
    // Falls through to facilitator check because org didn't match.
    expect(storageMock.getSpaceFacilitatorsBySpace).toHaveBeenCalledWith(SPACE_ID);
  });

  it("returns 200 for a regular 'user' who is listed in space_facilitators for the workspace", async () => {
    currentUser = { id: "u-fac", role: "user", organizationId: ORG_A };
    storageMock.getSpaceFacilitatorsBySpace.mockResolvedValue([
      { id: "sf-1", spaceId: SPACE_ID, userId: "u-fac" },
    ]);
    const res = await request(app).get(`/api/spaces/${SPACE_ID}/pulse`);
    expect(res.status).toBe(200);
  });

  it("returns 403 for a regular 'user' who is NOT a space facilitator", async () => {
    currentUser = { id: "u-other", role: "user", organizationId: ORG_A };
    storageMock.getSpaceFacilitatorsBySpace.mockResolvedValue([
      { id: "sf-1", spaceId: SPACE_ID, userId: "someone-else" },
    ]);
    const res = await request(app).get(`/api/spaces/${SPACE_ID}/pulse`);
    expect(res.status).toBe(403);
  });

  it("returns 404 for an unknown spaceId", async () => {
    currentUser = { id: "u-global", role: "global_admin", organizationId: null };
    storageMock.getSpace.mockResolvedValue(undefined);
    const res = await request(app).get(`/api/spaces/${SPACE_ID}/pulse`);
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "Workspace not found" });
  });

  it("returns 404 when an 8-digit workspace code does not resolve to a space", async () => {
    currentUser = { id: "u-global", role: "global_admin", organizationId: null };
    storageMock.getSpaceByCode.mockResolvedValue(undefined);
    const res = await request(app).get(`/api/spaces/12345678/pulse`);
    expect(res.status).toBe(404);
    // resolveWorkspaceId routed via getSpaceByCode for the 8-digit code.
    expect(storageMock.getSpaceByCode).toHaveBeenCalledWith("12345678");
  });
});
