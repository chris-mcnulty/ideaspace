// Real-server integration test for the presence subsystem.
//
// Boots the actual Express app via `registerRoutes`, which attaches the real
// WebSocketServer and the real GET /api/spaces/:spaceId/presence handler.
// The tests exercise the production code paths end-to-end so a future change
// that re-introduces PII into `presence_changed` (or weakens auth on the GET
// endpoint) is caught here.
//
// Run: npx tsx --test server/__tests__/presence.test.ts

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import passport from "passport";
import { WebSocket } from "ws";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";

process.env.NODE_ENV = process.env.NODE_ENV || "test";

import { registerRoutes } from "../routes";
import { sessionMiddleware } from "../session";
import { setupAuth, hashPassword } from "../auth";
import { storage } from "../storage";
import { db, pool } from "../db";
import {
  organizations,
  projects,
  users,
  spaces,
  spaceFacilitators,
  projectMembers,
  type InsertOrganization,
  type InsertProject,
  type InsertUser,
  type InsertSpace,
} from "@shared/schema";
import { inArray } from "drizzle-orm";

let server: Server;
let baseUrl = "";
let wsBaseUrl = "";

const suffix = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
const orgSlug = `test-org-${suffix}`;
const adminEmail = `admin-${suffix}@example.com`;
const adminPassword = "AdminPass!1234";
const userEmail = `user-${suffix}@example.com`;
const userPassword = "UserPass!1234";

let orgId = "";
let projectId = "";
let adminId = "";
let regularUserId = "";
let spaceId = "";

const createdSpaceIds: string[] = [];
const createdProjectIds: string[] = [];
const createdUserIds: string[] = [];
const createdOrgIds: string[] = [];

function randomCode(): string {
  const n = String(Math.floor(10000000 + Math.random() * 89999999));
  return `${n.slice(0, 4)}-${n.slice(4)}`;
}

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
  wsBaseUrl = `ws://127.0.0.1:${addr.port}/ws`;

  // Fixtures: org + project + admin + regular user + space.
  const orgInsert: InsertOrganization = {
    name: `Test Org ${suffix}`,
    slug: orgSlug,
  };
  const org = await storage.createOrganization(orgInsert);
  orgId = org.id;
  createdOrgIds.push(orgId);

  const projectInsert: InsertProject = {
    organizationId: orgId,
    name: `Test Project ${suffix}`,
    slug: `proj-${suffix}`,
    isDefault: false,
  };
  const project = await storage.createProject(projectInsert);
  projectId = project.id;
  createdProjectIds.push(projectId);

  const adminInsert: InsertUser = {
    email: adminEmail,
    username: adminEmail,
    password: await hashPassword(adminPassword),
    organizationId: orgId,
    role: "global_admin",
    displayName: "Admin Tester",
    emailVerified: true,
    authProvider: "local",
  };
  const admin = await storage.createUser(adminInsert);
  adminId = admin.id;
  createdUserIds.push(adminId);

  const regularInsert: InsertUser = {
    email: userEmail,
    username: userEmail,
    password: await hashPassword(userPassword),
    organizationId: orgId,
    role: "user",
    displayName: "Regular Tester",
    emailVerified: true,
    authProvider: "local",
  };
  const regular = await storage.createUser(regularInsert);
  regularUserId = regular.id;
  createdUserIds.push(regularUserId);

  const spaceInsert: InsertSpace = {
    organizationId: orgId,
    projectId,
    name: `Presence Space ${suffix}`,
    purpose: "presence regression test",
    code: randomCode(),
    status: "open",
    guestAllowed: true,
    createdBy: adminId,
  };
  const space = await storage.createSpace(spaceInsert);
  spaceId = space.id;
  createdSpaceIds.push(spaceId);
});

after(async () => {
  try {
    if (createdSpaceIds.length) {
      await db
        .delete(spaceFacilitators)
        .where(inArray(spaceFacilitators.spaceId, createdSpaceIds));
      await db.delete(spaces).where(inArray(spaces.id, createdSpaceIds));
    }
    if (createdProjectIds.length) {
      await db
        .delete(projectMembers)
        .where(inArray(projectMembers.projectId, createdProjectIds));
      await db.delete(projects).where(inArray(projects.id, createdProjectIds));
    }
    if (createdUserIds.length) {
      await db.delete(users).where(inArray(users.id, createdUserIds));
    }
    if (createdOrgIds.length) {
      await db
        .delete(organizations)
        .where(inArray(organizations.id, createdOrgIds));
    }
  } catch (e) {
    console.error("cleanup error", e);
  }
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await pool.end().catch(() => {});
});

async function login(email: string, password: string): Promise<string> {
  const res = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (res.status !== 200) {
    throw new Error(
      `Login failed for ${email}: ${res.status} ${await res.text()}`,
    );
  }
  // undici exposes individual Set-Cookie values via getSetCookie(); fall back
  // to a regex-based split that's safe against `Expires=Wed, 01 Jan ...`.
  const anyHeaders = res.headers as unknown as {
    getSetCookie?: () => string[];
  };
  let cookies: string[];
  if (typeof anyHeaders.getSetCookie === "function") {
    cookies = anyHeaders.getSetCookie();
  } else {
    const raw = res.headers.get("set-cookie") || "";
    cookies = raw.split(/,(?=\s*[^=;,\s]+=)/);
  }
  if (!cookies.length) throw new Error("No set-cookie header on login response");
  return cookies.map((c) => c.split(";")[0].trim()).join("; ");
}

function waitForOpen(ws: WebSocket): Promise<void> {
  return new Promise((resolve, reject) => {
    const onErr = (err: Error) => {
      ws.off("open", onOpen);
      reject(err);
    };
    const onOpen = () => {
      ws.off("error", onErr);
      resolve();
    };
    ws.once("open", onOpen);
    ws.once("error", onErr);
  });
}

function collectMessages(ws: WebSocket): any[] {
  const seen: any[] = [];
  ws.on("message", (data) => {
    try {
      seen.push(JSON.parse(data.toString()));
    } catch {
      /* ignore */
    }
  });
  return seen;
}

async function waitFor<T>(
  fn: () => T | undefined,
  timeoutMs = 3000,
  pollMs = 25,
): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const v = fn();
    if (v !== undefined) return v;
    await new Promise((r) => setTimeout(r, pollMs));
  }
  throw new Error("waitFor timed out");
}

test("presence_changed broadcast contains only spaceId and count (no PII)", async () => {
  // Anonymous space-only subscribers — the most permissive prod path. Even
  // here, the broadcast shape must never carry PII.
  // Attach the message handler BEFORE the upgrade completes so we don't miss
  // the count=1 broadcast — we only assert against count=2 below, but having
  // both events available lets the test verify shape on every received frame.
  const wsA = new WebSocket(`${wsBaseUrl}?spaceId=${spaceId}`);
  const seenA = collectMessages(wsA);
  await waitForOpen(wsA);

  const wsB = new WebSocket(`${wsBaseUrl}?spaceId=${spaceId}`);
  const seenB = collectMessages(wsB);
  await waitForOpen(wsB);

  // Wait until both clients have observed presence_changed with count=2.
  const finalA = await waitFor(() =>
    seenA.find(
      (m) => m?.type === "presence_changed" && m?.data?.count === 2,
    ),
  );
  const finalB = await waitFor(() =>
    seenB.find(
      (m) => m?.type === "presence_changed" && m?.data?.count === 2,
    ),
  );

  for (const final of [finalA, finalB]) {
    assert.equal(final.type, "presence_changed");
    assert.equal(typeof final.data, "object");
    assert.deepEqual(Object.keys(final.data).sort(), ["count", "spaceId"]);
    assert.equal(final.data.spaceId, spaceId);
    assert.equal(final.data.count, 2);
    for (const forbidden of [
      "userIds",
      "userId",
      "users",
      "emails",
      "email",
      "displayNames",
      "displayName",
      "names",
      "participants",
    ]) {
      assert.equal(
        forbidden in final.data,
        false,
        `presence_changed payload must not include "${forbidden}"`,
      );
    }
  }

  // Every presence_changed observed by either client must obey the shape.
  for (const seen of [seenA, seenB]) {
    for (const msg of seen) {
      if (msg?.type !== "presence_changed") continue;
      assert.deepEqual(
        Object.keys(msg.data).sort(),
        ["count", "spaceId"],
        "presence_changed.data should only ever expose {count, spaceId}",
      );
    }
  }

  wsA.close();
  wsB.close();
  // Give server a moment to clean up before next test.
  await new Promise((r) => setTimeout(r, 75));
});

test("GET /api/spaces/:spaceId/presence: 401/403 unauth, userIds for authorized", async () => {
  const adminCookie = await login(adminEmail, adminPassword);
  const userCookie = await login(userEmail, userPassword);

  // Connect an authenticated admin WS so the roster contains the admin's userId.
  const wsAdmin = new WebSocket(
    `${wsBaseUrl}?spaceId=${spaceId}&userId=${adminId}`,
    { headers: { Cookie: adminCookie } },
  );
  await waitForOpen(wsAdmin);
  // Plus an anonymous participant socket for count.
  const wsAnon = new WebSocket(`${wsBaseUrl}?spaceId=${spaceId}`);
  await waitForOpen(wsAnon);

  // Allow the server's presence broadcast/registration to settle.
  await new Promise((r) => setTimeout(r, 100));

  const url = `${baseUrl}/api/spaces/${spaceId}/presence`;

  // Unauthenticated -> 401 (workspace allows guests so middleware passes,
  // route enforces auth and rejects).
  let res = await fetch(url);
  assert.equal(res.status, 401, "unauthenticated must be 401");
  let body: any = await res.json().catch(() => ({}));
  assert.ok(!("userIds" in body), "401 body must not leak userIds");

  // Authenticated regular user (not admin/facilitator/project member) -> 403,
  // no userIds in body.
  res = await fetch(url, { headers: { Cookie: userCookie } });
  assert.equal(res.status, 403, "non-authorized user must be 403");
  body = await res.json().catch(() => ({}));
  assert.ok(!("userIds" in body), "403 body must not leak userIds");

  // Authorized admin -> 200, returns count + userIds (admin's id present).
  res = await fetch(url, { headers: { Cookie: adminCookie } });
  assert.equal(res.status, 200, "admin must be 200");
  body = await res.json();
  assert.equal(typeof body.count, "number");
  assert.ok(body.count >= 2, `expected count>=2, got ${body.count}`);
  assert.ok(Array.isArray(body.userIds), "userIds must be an array");
  assert.ok(
    body.userIds.includes(adminId),
    "admin userId must be in roster",
  );

  wsAdmin.close();
  wsAnon.close();
  await new Promise((r) => setTimeout(r, 75));
});
