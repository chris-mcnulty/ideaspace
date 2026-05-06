// Integration tests for the Galaxy API endpoints.
//
// Boots the real Express app via `registerRoutes` and exercises the
// production code paths end-to-end against a real (test) database.
//
// Covers:
//   - requireApiKey middleware: missing/empty/invalid/revoked/valid key
//   - GET /api/galaxy/workspaces: org scoping, template exclusion, ?domain= filter
//   - GET /api/galaxy/reports: paginated list, ?domain= filter, org isolation
//   - GET /api/galaxy/reports/:spaceId: full report, org isolation (403 cross-org)
//
// Run: npx tsx --test server/__tests__/galaxy.test.ts

import { test, before, after, describe } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import passport from "passport";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";

process.env.NODE_ENV = process.env.NODE_ENV || "test";

import { registerRoutes } from "../routes";
import { sessionMiddleware } from "../session";
import { setupAuth, hashPassword, generateApiKey, hashApiKey } from "../auth";
import { storage } from "../storage";
import { db, pool } from "../db";
import {
  organizations,
  projects,
  users,
  spaces,
  organisationApiKeys,
  cohortResults,
  type InsertOrganization,
  type InsertProject,
  type InsertUser,
  type InsertSpace,
  type InsertCohortResult,
} from "@shared/schema";
import { inArray, eq } from "drizzle-orm";

// ─── Server bootstrap ──────────────────────────────────────────────────────

let server: Server;
let baseUrl = "";

// ─── Fixture state ─────────────────────────────────────────────────────────

const suffix = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;

// Org A
let orgAId = "";
let orgAProjectId = "";
let orgAAdminId = "";
let orgAKey = ""; // plaintext API key for org A
let orgAKeyId = ""; // DB row id for the key (for revocation tests)
let orgASpaceId = ""; // a normal (open) workspace
let orgAClosedSpaceId = ""; // a closed workspace with a cohort result
let orgATemplateSpaceId = ""; // a template workspace (must be excluded)

// Org B
let orgBId = "";
let orgBProjectId = "";
let orgBAdminId = "";
let orgBKey = ""; // plaintext API key for org B
let orgBSpaceId = ""; // a normal (open) workspace owned by org B

// A second key for org A that we will revoke during tests
let revokedOrgAKeyId = "";
let revokedOrgAKeyPlaintext = "";

// Cleanup tracking
const cleanupOrgIds: string[] = [];
const cleanupUserIds: string[] = [];
const cleanupProjectIds: string[] = [];
const cleanupSpaceIds: string[] = [];
const cleanupKeyIds: string[] = [];
const cleanupCohortResultIds: string[] = [];

function randomCode(): string {
  const n = String(Math.floor(10000000 + Math.random() * 89999999));
  return `${n.slice(0, 4)}-${n.slice(4)}`;
}

// ─── Setup ─────────────────────────────────────────────────────────────────

before(async () => {
  const app = express();
  app.set("trust proxy", true);
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));
  app.use(sessionMiddleware);
  app.use(passport.initialize());
  app.use(passport.session());
  setupAuth();

  server = await registerRoutes(app);
  await new Promise<void>((resolve) =>
    server.listen(0, "127.0.0.1", () => resolve()),
  );
  const addr = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${addr.port}`;

  // ── Org A ──────────────────────────────────────────────────────────────

  const orgAInsert: InsertOrganization = {
    name: `Galaxy Test Org A ${suffix}`,
    slug: `galaxy-org-a-${suffix}`,
    domain: `orga-${suffix}.example.com`,
  };
  const orgA = await storage.createOrganization(orgAInsert);
  orgAId = orgA.id;
  cleanupOrgIds.push(orgAId);

  const projAInsert: InsertProject = {
    organizationId: orgAId,
    name: `Proj A ${suffix}`,
    slug: `proj-a-${suffix}`,
    isDefault: false,
  };
  const projA = await storage.createProject(projAInsert);
  orgAProjectId = projA.id;
  cleanupProjectIds.push(orgAProjectId);

  const adminAInsert: InsertUser = {
    email: `admin-a-${suffix}@example.com`,
    username: `admin-a-${suffix}@example.com`,
    password: await hashPassword("AdminA!1234"),
    organizationId: orgAId,
    role: "company_admin",
    displayName: "Admin A",
    emailVerified: true,
    authProvider: "local",
  };
  const adminA = await storage.createUser(adminAInsert);
  orgAAdminId = adminA.id;
  cleanupUserIds.push(orgAAdminId);

  // Active API key for org A
  const keyA = generateApiKey();
  orgAKey = keyA.plaintext;
  const createdKeyA = await storage.createOrganisationApiKey({
    organisationId: orgAId,
    keyHash: keyA.hash,
    label: `Test Key A ${suffix}`,
  });
  orgAKeyId = createdKeyA.id;
  cleanupKeyIds.push(orgAKeyId);

  // A second key for org A that we will revoke mid-test
  const revokedKey = generateApiKey();
  revokedOrgAKeyPlaintext = revokedKey.plaintext;
  const createdRevokedKey = await storage.createOrganisationApiKey({
    organisationId: orgAId,
    keyHash: revokedKey.hash,
    label: `Revoked Key A ${suffix}`,
  });
  revokedOrgAKeyId = createdRevokedKey.id;
  cleanupKeyIds.push(revokedOrgAKeyId);
  // Revoke it immediately so it's invalid for all tests
  await storage.revokeOrganisationApiKey(revokedOrgAKeyId);

  // Open workspace for org A
  const spaceAInsert: InsertSpace = {
    organizationId: orgAId,
    projectId: orgAProjectId,
    name: `Open Space A ${suffix}`,
    purpose: "galaxy test open workspace",
    code: randomCode(),
    status: "open",
    guestAllowed: true,
    createdBy: orgAAdminId,
    isTemplate: false,
  };
  const spaceA = await storage.createSpace(spaceAInsert);
  orgASpaceId = spaceA.id;
  cleanupSpaceIds.push(orgASpaceId);

  // Closed workspace for org A (will have a cohort result)
  const closedSpaceAInsert: InsertSpace = {
    organizationId: orgAId,
    projectId: orgAProjectId,
    name: `Closed Space A ${suffix}`,
    purpose: "galaxy test closed workspace",
    code: randomCode(),
    status: "closed",
    guestAllowed: false,
    createdBy: orgAAdminId,
    isTemplate: false,
  };
  const closedSpaceA = await storage.createSpace(closedSpaceAInsert);
  orgAClosedSpaceId = closedSpaceA.id;
  cleanupSpaceIds.push(orgAClosedSpaceId);

  // Template workspace for org A (must NOT appear in /api/galaxy/workspaces)
  const templateSpaceAInsert: InsertSpace = {
    organizationId: orgAId,
    projectId: orgAProjectId,
    name: `Template Space A ${suffix}`,
    purpose: "galaxy test template workspace",
    code: randomCode(),
    status: "open",
    guestAllowed: false,
    createdBy: orgAAdminId,
    isTemplate: true,
  };
  const templateSpaceA = await storage.createSpace(templateSpaceAInsert);
  orgATemplateSpaceId = templateSpaceA.id;
  cleanupSpaceIds.push(orgATemplateSpaceId);

  // Add cohort result for the closed workspace so it appears in /reports
  const cohortInsert: InsertCohortResult = {
    spaceId: orgAClosedSpaceId,
    generatedBy: orgAAdminId,
    summary: `Test cohort summary for ${suffix}`,
    insights: "Test insights",
    keyThemes: ["theme 1", "theme 2"],
    topIdeas: null,
    recommendations: "Test recommendations",
    metadata: null,
    inputsHash: null,
  };
  const cohortResult = await storage.createCohortResult(cohortInsert);
  cleanupCohortResultIds.push(cohortResult.id);

  // ── Org B ──────────────────────────────────────────────────────────────

  const orgBInsert: InsertOrganization = {
    name: `Galaxy Test Org B ${suffix}`,
    slug: `galaxy-org-b-${suffix}`,
    domain: `orgb-${suffix}.example.com`,
  };
  const orgB = await storage.createOrganization(orgBInsert);
  orgBId = orgB.id;
  cleanupOrgIds.push(orgBId);

  const projBInsert: InsertProject = {
    organizationId: orgBId,
    name: `Proj B ${suffix}`,
    slug: `proj-b-${suffix}`,
    isDefault: false,
  };
  const projB = await storage.createProject(projBInsert);
  orgBProjectId = projB.id;
  cleanupProjectIds.push(orgBProjectId);

  const adminBInsert: InsertUser = {
    email: `admin-b-${suffix}@example.com`,
    username: `admin-b-${suffix}@example.com`,
    password: await hashPassword("AdminB!1234"),
    organizationId: orgBId,
    role: "company_admin",
    displayName: "Admin B",
    emailVerified: true,
    authProvider: "local",
  };
  const adminB = await storage.createUser(adminBInsert);
  orgBAdminId = adminB.id;
  cleanupUserIds.push(orgBAdminId);

  // API key for org B
  const keyB = generateApiKey();
  orgBKey = keyB.plaintext;
  const createdKeyB = await storage.createOrganisationApiKey({
    organisationId: orgBId,
    keyHash: keyB.hash,
    label: `Test Key B ${suffix}`,
  });
  cleanupKeyIds.push(createdKeyB.id);

  // Workspace for org B
  const spaceBInsert: InsertSpace = {
    organizationId: orgBId,
    projectId: orgBProjectId,
    name: `Open Space B ${suffix}`,
    purpose: "galaxy test org b workspace",
    code: randomCode(),
    status: "open",
    guestAllowed: true,
    createdBy: orgBAdminId,
    isTemplate: false,
  };
  const spaceB = await storage.createSpace(spaceBInsert);
  orgBSpaceId = spaceB.id;
  cleanupSpaceIds.push(spaceB.id);
});

// ─── Teardown ──────────────────────────────────────────────────────────────

after(async () => {
  try {
    // Cohort results first (FK → spaces)
    if (cleanupCohortResultIds.length) {
      await db
        .delete(cohortResults)
        .where(inArray(cohortResults.id, cleanupCohortResultIds));
    }
    // API keys (FK → organisations)
    if (cleanupKeyIds.length) {
      await db
        .delete(organisationApiKeys)
        .where(inArray(organisationApiKeys.id, cleanupKeyIds));
    }
    // Spaces
    if (cleanupSpaceIds.length) {
      await db.delete(spaces).where(inArray(spaces.id, cleanupSpaceIds));
    }
    // Projects (FK → organizations)
    if (cleanupProjectIds.length) {
      await db
        .delete(projects)
        .where(inArray(projects.id, cleanupProjectIds));
    }
    // Users
    if (cleanupUserIds.length) {
      await db.delete(users).where(inArray(users.id, cleanupUserIds));
    }
    // Organisations
    if (cleanupOrgIds.length) {
      await db
        .delete(organizations)
        .where(inArray(organizations.id, cleanupOrgIds));
    }
  } catch (e) {
    console.error("[galaxy.test] cleanup error:", e);
  }
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await pool.end().catch(() => {});
});

// ─── Helper ────────────────────────────────────────────────────────────────

async function galaxyGet(
  path: string,
  key: string | null,
  query?: Record<string, string>,
): Promise<Response> {
  const url = new URL(`${baseUrl}${path}`);
  if (query) {
    for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
  }
  const headers: Record<string, string> = {};
  if (key !== null) {
    headers["Authorization"] = `Bearer ${key}`;
  }
  return fetch(url.toString(), { headers });
}

// ─── requireApiKey middleware ──────────────────────────────────────────────

describe("requireApiKey middleware", () => {
  test("returns 401 when Authorization header is missing", async () => {
    const res = await galaxyGet("/api/galaxy/workspaces", null);
    assert.equal(res.status, 401);
    const body = await res.json();
    assert.ok(body.error, "error field should be present");
  });

  test("returns 401 when Authorization header has no Bearer prefix", async () => {
    const url = `${baseUrl}/api/galaxy/workspaces`;
    const res = await fetch(url, {
      headers: { Authorization: "Basic some-token" },
    });
    assert.equal(res.status, 401);
  });

  test("returns 401 when the API key does not match any stored hash", async () => {
    // A well-formed key that was never inserted
    const bogusKey = "nebula_" + "aa".repeat(24);
    const res = await galaxyGet("/api/galaxy/workspaces", bogusKey);
    assert.equal(res.status, 401);
    const body = await res.json();
    assert.ok(body.error, "error field should be present");
  });

  test("returns 401 when the key matches a revoked row", async () => {
    const res = await galaxyGet(
      "/api/galaxy/workspaces",
      revokedOrgAKeyPlaintext,
    );
    assert.equal(res.status, 401);
  });

  test("returns 200 with a valid, active API key", async () => {
    const res = await galaxyGet("/api/galaxy/workspaces", orgAKey);
    assert.equal(res.status, 200);
  });
});

// ─── GET /api/galaxy/workspaces ────────────────────────────────────────────

describe("GET /api/galaxy/workspaces", () => {
  test("returns only non-template workspaces for the key's org", async () => {
    const res = await galaxyGet("/api/galaxy/workspaces", orgAKey);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(Array.isArray(body.data), "data must be an array");

    const ids = body.data.map((w: any) => w.id);

    // Non-template workspaces should be present
    assert.ok(ids.includes(orgASpaceId), "open space must be in list");
    assert.ok(
      ids.includes(orgAClosedSpaceId),
      "closed space must be in list",
    );

    // Template workspace must be excluded
    assert.ok(
      !ids.includes(orgATemplateSpaceId),
      "template space must NOT appear",
    );
  });

  test("does not include workspaces from a different organisation", async () => {
    // Org A key must not return org B's workspace
    const resA = await galaxyGet("/api/galaxy/workspaces", orgAKey);
    assert.equal(resA.status, 200);
    const bodyA = await resA.json();
    const idsA: string[] = bodyA.data.map((w: any) => w.id);
    assert.ok(
      !idsA.includes(orgBSpaceId),
      "org A key must not return org B workspace",
    );

    // Org B key must not return any of org A's workspaces
    const resB = await galaxyGet("/api/galaxy/workspaces", orgBKey);
    assert.equal(resB.status, 200);
    const bodyB = await resB.json();
    const idsB: string[] = bodyB.data.map((w: any) => w.id);
    assert.ok(!idsB.includes(orgASpaceId), "org B must not see org A space");
    assert.ok(
      !idsB.includes(orgAClosedSpaceId),
      "org B must not see org A closed space",
    );
  });

  test("?domain= matching the org domain returns workspaces normally", async () => {
    const orgADomain = `orga-${suffix}.example.com`;
    const res = await galaxyGet("/api/galaxy/workspaces", orgAKey, {
      domain: orgADomain,
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(Array.isArray(body.data));
    const ids: string[] = body.data.map((w: any) => w.id);
    assert.ok(ids.includes(orgASpaceId), "matching domain should return spaces");
  });

  test("?domain= not matching the org returns empty data array", async () => {
    const res = await galaxyGet("/api/galaxy/workspaces", orgAKey, {
      domain: "unrelated-domain-that-does-not-exist.com",
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(Array.isArray(body.data));
    assert.equal(body.data.length, 0, "non-matching domain must return []");
  });

  test("?domain= with invalid value (includes slash) returns 400", async () => {
    const res = await galaxyGet("/api/galaxy/workspaces", orgAKey, {
      domain: "bad/domain",
    });
    assert.equal(res.status, 400);
  });

  test("response items include expected fields (id, name, code, status, url)", async () => {
    const res = await galaxyGet("/api/galaxy/workspaces", orgAKey);
    assert.equal(res.status, 200);
    const body = await res.json();
    for (const w of body.data) {
      assert.ok(w.id, "item must have id");
      assert.ok(w.name, "item must have name");
      assert.ok(w.code, "item must have code");
      assert.ok(w.status, "item must have status");
      assert.ok(w.url, "item must have url");
    }
  });
});

// ─── GET /api/galaxy/reports ───────────────────────────────────────────────

describe("GET /api/galaxy/reports", () => {
  test("returns only closed workspaces that have a cohort result", async () => {
    const res = await galaxyGet("/api/galaxy/reports", orgAKey);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(Array.isArray(body.data));
    assert.ok(typeof body.total === "number");
    assert.ok(typeof body.page === "number");
    assert.ok(typeof body.limit === "number");

    const ids: string[] = body.data.map((r: any) => r.spaceId);

    // The closed space with a cohort result must appear
    assert.ok(
      ids.includes(orgAClosedSpaceId),
      "closed space with cohort result must appear",
    );

    // The open space (no cohort result) must NOT appear
    assert.ok(
      !ids.includes(orgASpaceId),
      "open space without cohort result must not appear",
    );
  });

  test("does not return reports from a different organisation", async () => {
    const res = await galaxyGet("/api/galaxy/reports", orgBKey);
    assert.equal(res.status, 200);
    const body = await res.json();
    const ids: string[] = body.data.map((r: any) => r.spaceId);
    assert.ok(
      !ids.includes(orgAClosedSpaceId),
      "org B must not see org A closed space report",
    );
  });

  test("?domain= matching the org returns results", async () => {
    const orgADomain = `orga-${suffix}.example.com`;
    const res = await galaxyGet("/api/galaxy/reports", orgAKey, {
      domain: orgADomain,
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(Array.isArray(body.data));
    const ids: string[] = body.data.map((r: any) => r.spaceId);
    assert.ok(
      ids.includes(orgAClosedSpaceId),
      "matching domain should return reports",
    );
  });

  test("?domain= not matching the org returns empty list", async () => {
    const res = await galaxyGet("/api/galaxy/reports", orgAKey, {
      domain: "totally-different-domain.io",
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.data.length, 0, "non-matching domain must return []");
    assert.equal(body.total, 0);
  });

  test("?domain= with invalid value returns 400", async () => {
    const res = await galaxyGet("/api/galaxy/reports", orgAKey, {
      domain: "has@at-sign",
    });
    assert.equal(res.status, 400);
  });

  test("pagination parameters are respected", async () => {
    const res = await galaxyGet("/api/galaxy/reports", orgAKey, {
      page: "1",
      limit: "5",
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.page, 1);
    assert.equal(body.limit, 5);
    assert.ok(body.data.length <= 5, "should not exceed limit");
  });

  test("report items include summarySnippet field", async () => {
    const res = await galaxyGet("/api/galaxy/reports", orgAKey);
    assert.equal(res.status, 200);
    const body = await res.json();
    const report = body.data.find((r: any) => r.spaceId === orgAClosedSpaceId);
    assert.ok(report, "closed space report must exist");
    assert.ok(typeof report.summarySnippet === "string", "summarySnippet must be a string");
    assert.ok(report.name, "report must include workspace name");
    assert.ok(report.code, "report must include workspace code");
  });
});

// ─── GET /api/galaxy/reports/:spaceId ─────────────────────────────────────

describe("GET /api/galaxy/reports/:spaceId", () => {
  test("returns 200 with full report data for a valid closed space", async () => {
    const res = await galaxyGet(
      `/api/galaxy/reports/${orgAClosedSpaceId}`,
      orgAKey,
    );
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.spaceId, orgAClosedSpaceId);
    assert.ok(typeof body.summary === "string", "summary must be a string");
    assert.ok(typeof body.name === "string", "name must be a string");
    assert.ok(typeof body.code === "string", "code must be a string");
    assert.ok(typeof body.status === "string", "status must be a string");
    assert.ok(Array.isArray(body.categoryBreakdown), "categoryBreakdown must be an array");
    assert.ok(typeof body.uncategorisedNoteCount === "number");
  });

  test("returns 404 for an unknown spaceId", async () => {
    const fakeId = "00000000-0000-0000-0000-000000000000";
    const res = await galaxyGet(`/api/galaxy/reports/${fakeId}`, orgAKey);
    assert.equal(res.status, 404);
  });

  test("returns 404 for a template workspace", async () => {
    // Template spaces are excluded from the Galaxy feed
    const res = await galaxyGet(
      `/api/galaxy/reports/${orgATemplateSpaceId}`,
      orgAKey,
    );
    assert.equal(res.status, 404);
  });

  test("returns 403 when key from org A requests a workspace belonging to org B", async () => {
    // orgBSpaceId is created during fixture setup — always present, no skip path
    assert.ok(orgBSpaceId, "fixture org B space ID must be set");

    // Org A key must not be able to read a workspace owned by org B
    const res = await galaxyGet(
      `/api/galaxy/reports/${orgBSpaceId}`,
      orgAKey,
    );
    assert.equal(
      res.status,
      403,
      "org A key must not be able to read org B workspace reports",
    );
  });

  test("returns 404 for a space that exists but has no cohort result", async () => {
    // orgASpaceId is an open workspace with no cohort result
    const res = await galaxyGet(
      `/api/galaxy/reports/${orgASpaceId}`,
      orgAKey,
    );
    // Open workspace with no cohort result → 404 "No cohort result found"
    assert.equal(res.status, 404);
  });
});
