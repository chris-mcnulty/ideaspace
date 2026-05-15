# Storage Layer N+1 & Unbounded Read Audit

_Generated: 2026-05-14. Tracks the backlog item "Storage Layer N+1 Query Audit (P2)"._

This audit catalogs the highest-impact N+1 query patterns and unbounded list reads in `server/storage.ts` and its callers. Findings are anchored to file:line and ranked by impact on the hot path. Each entry includes a one-sentence recommended fix; implementation is **not** part of this PR.

## Summary

- **2 Critical**: Cohort report listing performs a per-space DB round-trip; default-project lookup runs twice per migration check.
- **5 High**: Unbounded organization scan, duplicate facilitator authorization checks, per-space module fetches, unbounded notes load on the pairwise voting hot path, unbounded admin user list.
- **3 Medium**: Per-participant marketplace allocation lookups, unbounded spaces fetch in migration endpoints, app-side category grouping.
- **2 Low**: Application-side sorting that could use SQL `ORDER BY`/`LIMIT`, redundant collection sweeps for cohort latest-row selection.

## Severity legend

| Severity | Heuristic |
|---|---|
| Critical | Loops over collections that can grow into the thousands in production usage. |
| High | Loops over 50–1000 items, **or** runs on an authentication / hot user-facing path. |
| Medium | Loops over <50 items but is invoked frequently or by admins where one bad org can be slow. |
| Low | Cold paths or trivially capped collections; flagged for hygiene. |

---

## Critical

### C1. Per-space query in `GET /api/galaxy/reports`

- **Location**: `server/routes.ts:8164-8177`
- **Pattern**:
  ```ts
  for (const space of eligibleSpaces) {
    const cohortResultRows = await storage.getCohortResultsBySpace(space.id);
    if (cohortResultRows.length === 0) continue;
    const latest = cohortResultRows.sort(...)[0];
    ...
  }
  ```
- **Impact**: One round-trip per workspace per request. Orgs with hundreds of workspaces incur hundreds of sequential queries; an external caller can trivially DoS the endpoint.
- **Fix**: Add `storage.getLatestCohortResultsForSpaces(spaceIds: string[])` that issues a single `SELECT DISTINCT ON (space_id) ...` (or grouped `MAX(created_at)`); group results by `spaceId` in JS.

### C2. Double loop in admin migration check

- **Location**: `server/routes.ts:1009-1040` (`POST /api/admin/migrations/projects/migrate` and the matching `.../status` endpoint)
- **Pattern**: Two consecutive `for (const org of orgs)` loops, each calling `storage.getDefaultProject(org.id)` and `storage.getAllSpaces()` independently.
- **Impact**: For each org, two round-trips; for each migration check, the workspace table is loaded twice in full.
- **Fix**: Replace with a single batched `storage.getDefaultProjectsForOrganizations(orgIds)` returning a `Map<orgId, Project|undefined>`, and load workspaces filtered by `inArray(spaces.organizationId, orgIds)` exactly once.

---

## High

### H1. App-side filtering on full organizations table

- **Location**: `server/storage.ts:625-630`, `getOrganizationByDomain`
- **Pattern**:
  ```ts
  const allOrgs = await db.select().from(organizations);
  return allOrgs.find(org => org.allowedDomains?.includes(normalizedDomain));
  ```
- **Impact**: Every JIT-provisioning call (Entra SSO login) loads every organization. Grows linearly with tenant count.
- **Fix**: Use the Postgres array-overlap operator: `WHERE allowed_domains && ARRAY[$1]` (Drizzle `sql` template). Add a GIN index on `allowed_domains` if not already present.

### H2. Duplicate facilitator authorization queries

- **Location**: `server/routes.ts:139` (workspace auth helper) and `server/routes.ts:257` (`requireFacilitator` middleware)
- **Pattern**: `getSpaceFacilitatorsBySpace(spaceId)` is called once in the workspace authorization helper and again by `requireFacilitator` later in the same request.
- **Impact**: Two identical DB round-trips per facilitator-only endpoint hit.
- **Fix**: Cache the result on `req.locals` (e.g. `req.spaceFacilitators`) inside the workspace helper; have `requireFacilitator` read from there or fall back to a fresh query.

### H3. Sequential facilitator + participant fetches for notifications

- **Location**: `server/routes.ts:2063-2074` (and ~2 duplicate sites at 2178+)
- **Pattern**: `getSpaceFacilitatorsBySpace(spaceId)` followed by `getParticipantsBySpace(spaceId)` to assemble a notification recipient set.
- **Impact**: Two sequential round-trips on every phase change; latency adds up under bursty notification volume.
- **Fix**: Add `storage.getSpaceRecipients(spaceId)` returning facilitators + participants in a single query (UNION ALL or two parallel `Promise.all`).

### H4. Unbounded module config fetch path

- **Location**: `server/routes.ts:2111` (and similar callsites that look up the ideation module)
- **Pattern**: `getWorkspaceModules(spaceId)` returns all enabled modules for a workspace; the route then loads module-specific config (priority matrix, staircase, etc.) with a separate query each.
- **Impact**: 1 + N queries for the configuration of every module shown on a workspace page.
- **Fix**: Add `getWorkspaceModulesWithConfig(spaceId)` that left-joins each per-module config table and returns a tagged union. Where a join would balloon column counts, use `Promise.all` with parallel reads keyed by `inArray(spaceId)`.

### H5. Unbounded notes read on every pairwise vote

- **Location**: `server/routes.ts:5797-5798` (pairwise pair selection)
- **Pattern**: `storage.getNotesBySpace(spaceId)` followed by `storage.getVotesByParticipant(...)`, then `getNextPair` in JS.
- **Impact**: For workspaces with >500 notes the per-vote latency is dominated by full-table scan + sort. Voting throughput drops sharply.
- **Fix**: Add a paginated/visible-notes API to `getNotesBySpace`, or precompute the candidate pool once at session start and cache it for the duration of the pairwise round.

---

## Medium

### M1. Repeat marketplace allocation lookups for the same participant

- **Location**: `server/routes.ts:6095, 6164, 6198`
- **Pattern**: `getMarketplaceAllocationsByParticipant(participantId)` called in three handlers that frequently fire in sequence (allocation summary, remaining budget, history).
- **Fix**: Add `getMarketplaceAllocationsByParticipants(participantIds: string[])` returning a map; reuse a single fetch per request via `req.locals`.

### M2. Unbounded admin users list

- **Location**: `server/routes.ts:~1100` (`GET /api/admin/users` global-admin branch)
- **Pattern**: `getAllUsers()` returns the entire table.
- **Fix**: Wrap the call in pagination (default `limit=50`, `max=200`) with stable sort; mirror the `paginationQuerySchema` introduced in `server/utils/queryParams.ts`.

### M3. Unbounded spaces fetch in migration endpoints

- **Location**: `server/routes.ts:1028 + 1058`
- **Pattern**: `getAllSpaces()` followed by JS `.filter()` for `isTemplate`/`projectId`.
- **Fix**: Add `getSpacesByOrganizations(orgIds, { excludeTemplates: true, projectId? })` with the filters pushed to SQL; keep result counts cheap.

---

## Low

### L1. App-side sort to pick a single latest row

- **Location**: `server/routes.ts:8167` (and `8213` for personalized variant)
- **Pattern**: `cohortResultRows.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0]`
- **Fix**: Push `ORDER BY created_at DESC LIMIT 1` into the storage call (e.g. `getLatestCohortResultBySpace(spaceId)`); remove the JS sort entirely.

### L2. App-side category grouping after full notes load

- **Location**: `server/routes.ts:8217-8231`
- **Pattern**: Loops categories × notes to build per-category counts.
- **Fix**: For counts only, run `SELECT manual_category_id, COUNT(*) FROM notes WHERE space_id=$1 GROUP BY manual_category_id`. Keep the in-memory grouping when the full note text is also needed.

---

## Recommended next steps

1. **Tackle C1 + H1 first** — both are external-facing and trivially exploitable for slow responses.
2. Add a `req.locals` typed helper (`req.locals.spaceFacilitators`, `req.locals.workspace`) to centralize per-request memoization (resolves H2, M1).
3. Introduce one or two batch helpers in `storage.ts` (`getLatestCohortResultsForSpaces`, `getDefaultProjectsForOrganizations`, `getSpaceRecipients`) and migrate the call sites listed above.
4. Once those land, re-run this audit; the L-tier items are cheap to clean up in the same pass.

## Out of scope for this audit

- Index design (separate review): notes indexes by `space_id`, allocations by `(space_id, participant_id)`, sessions by `expire`.
- Connection-pool sizing — see backlog "DB Connection Pool Tuning" follow-up.
- Read-replica routing for analytics queries.
