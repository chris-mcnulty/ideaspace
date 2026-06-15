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
