---
name: Signal facilitator auth gap
description: assertFacilitatorForSpace did not check projectMembers, causing 403 for project-member facilitators
---

## Rule
`assertFacilitatorForSpace` (server/routes.ts) must check four paths:
1. global_admin
2. company_admin same org (or via companyAdmins table)
3. spaceFacilitators table
4. **projectMembers** — if `space.projectId` exists, call `storage.isProjectMember(space.projectId, user.id)`

**Why:** Users with role `facilitator` who are added to a workspace via ProjectShareDialog land in the `projectMembers` table, NOT `spaceFacilitators`. Without the fourth check they get 403 on every facilitator-only route (Signal deck PUT, activity CRUD, starship, etc.) even though `requireFacilitator` middleware passes.

**How to apply:** Any time you touch `assertFacilitatorForSpace` or add a new route that calls `requireSpaceFacilitator`, ensure all four paths are present.

## Moderation versus participation

Facilitator moderation must use workspace-scoped authorization before applying participant lifecycle, guest-access, or participant-session restrictions. Project-level facilitator access and explicit organization-admin associations must receive the same moderation rights as direct workspace assignments.

**Why:** On 2026-10-04, note deletion still rejected project-member facilitators after an earlier fix because participant middleware ran first. Production had project-member facilitators without direct workspace assignments in draft, closed, and archived workspaces. Checking facilitator authorization later could not override an earlier rejection.

**How to apply:** Keep participant restrictions intact for participant requests, but do not route an already-authorized moderator through them. Regression coverage must include project-based facilitators in inactive workspaces with guests disabled and no participant session, not just directly assigned facilitators.
