# Nebula - Multi-Tenant Collaborative Envisioning Platform

## Related Projects
- **Vega**: Business strategy management application.
  - Repository: https://github.com/chris-mcnulty/synozur-vega
  - Features: Multi-tenant, Entra SSO integration.
  - Status: Active project on Replit.

## Backlog
- [x] Knowledge base FTS + results caching - Added `knowledge_base_chunks` table with `tsvector` + GIN index (`shared/schema.ts`), `customType` tsvector helper. New `server/services/kbExtraction.ts` extracts text/markdown/csv/html/json into ~500-word overlapping chunks (PDF/DOCX intentionally out of scope — flagged for follow-up). Storage gained `createKnowledgeBaseChunks` (sets `to_tsvector('english', ...)` server-side), `deleteKnowledgeBaseChunksByDocument`, `getKnowledgeBaseChunksByDocument`, and `searchKnowledgeBaseChunks` (uses `plainto_tsquery` + `ts_rank_cd` + `ts_headline`, scoped via union of system/org/workspace + multi-workspace junction). Upload endpoint extracts+inserts chunks best-effort; new `GET /api/knowledge-base/search` (RBAC-gated by scope). Refactored `server/services/results.ts` cohort grounding to query top-K chunks (instead of dumping every doc title/desc) using a query built from purpose + top-ranked notes. Added `inputs_hash` to `cohort_results` and `personalized_results` plus `server/services/resultsCache.ts` (sha256 over normalized notes/votes/rankings/marketplace/matrix/staircase/survey/modules/kbChunkIds); cache hits short-circuit OpenAI and emit `*-cache-hit` aiUsageLog entries (token savings tracking). KnowledgeBaseManager UI gained debounced search box (results render `ts_headline` snippets with bold matches). `scripts/backfill-kb-chunks.ts` re-extracts existing docs idempotently.
- [x] Database performance pass - Replaced per-row Promise.all loops in dashboard list endpoints (/api/projects, /api/my-organizations, /api/my-projects, /api/my-projects/detailed, /api/my-workspaces) with batched IStorage methods (`getOrganizationsByIds`, `getProjectsByIds`, `getProjectsByOrganizations`, `getSpacesByOrganizations`, `getSpacesByProjects`, `getSpacesByIds`, `getNoteCountsBySpaces`, `getParticipantCountsBySpaces`) backed by `inArray` + `GROUP BY`. Pre-batched per-participant DB fetches in `generateAllPersonalizedResults` (server/services/results.ts) so the AI loop no longer issues per-participant round-trips. Added Drizzle schema indexes via `index()` on hot FK columns (notes/votes/rankings/marketplace_allocations/survey_responses/survey_questions/categories/participants by space, spaces by org/project, projects by org, project_members by user/project, space_facilitators by user/space, ideas/cohort_results/personalized_results by space, document_workspace_access by document/space) deployed via `npm run db:push`. Replaced verbose every-request logger with non-prod slow-handler middleware that logs API requests above `SLOW_HANDLER_MS` (default 200ms). Removed `[DEBUG]` console.log noise from server/routes.ts.
- [x] React error boundaries & graceful failure UI - Added reusable ErrorBoundary class component (branded fallback, retry/reload/home actions, dev-only stack display, telemetry POST that swallows its own errors), wrapped each major route via withBoundary HOC (hoisted to module-level constants for stable identity), added root-level <ErrorBoundary scope="root"> around provider tree, server POST /api/client-errors endpoint (zod-validated, structured log with userId/participantId/route/scope, always returns 204), and reusable QueryErrorState component for localized retry UI on partial query failures.
- [x] AI Suggest New Ideas - Facilitator-only "Suggest New Ideas" panel in the Ideas tab. New `suggestIdeas()` in `server/services/openai.ts` (gpt-5, json_object, retry+Zod, dedup vs existing notes/ideas, logs `suggest_ideas` operation) grounded in workspace purpose + KB FTS chunks. New endpoints `POST /api/spaces/:spaceId/suggest-ideas` and `/accept` (workspace-scoped: global_admin OR matching company_admin OR space facilitator). Accepted suggestions persist as notes with `aiGenerated:true`, broadcast `note_created`. Schema: added `notes.ai_generated boolean` — production deploy must run `npx tsx scripts/add-notes-ai-generated.ts` (idempotent ALTER TABLE IF NOT EXISTS).
- [ ] Import templates from CSV (with categories) and edit their contents in the system
- [x] WCAG 2.1 AA accessibility pass - Added SkipToContent link, LiveAnnouncerProvider (polite + assertive aria-live regions), useRouteFocus hook (retries until #main-content lands), id="main-content" landmarks on all 20+ routed pages, aria-labels on icon-only buttons (StickyNote, UserProfileMenu, ShareLinksDialog, NotificationPanel), live announcements for note arrivals and facilitator phase navigations.
- [x] Mobile-friendly participant modules (≥360px no h-scroll, ≥44px touch targets) - Updated 6 modules: PriorityMatrix (tap-to-place fallback w/ auto-enable on mobile), Staircase (Placed Notes panel w/ up/down step buttons + horizontal-scroll SVG canvas), Survey, Pairwise (DuelCard + header), StackRanking (up/down buttons), Marketplace (responsive allocation cards). Headers truncate org name on small screens; participant page wrappers use px-4 sm:px-6 + py-3 sm:py-4.
- [x] Phase 1: Add Projects table and API (completed) - Schema, storage, and API routes for project CRUD
- [x] Phase 2: UI/Navigation for Projects (completed) - Projects tab in Admin Panel, workspace grouping by project in Dashboard
- [x] Phase 3: Auth/SSO project scoping (completed) - Project membership enforcement in workspace access middleware, SSO/JIT assigns to default project, Project Members UI in Admin Panel
- [x] Show survey results impact in the Results tab - Integrated survey responses, 2x2 matrix positions, and staircase scores into cohort results. Dynamic combined scoring weights all active modules equally. AI prompt includes all module data. UI shows per-idea scores from each module and a dedicated Survey Analysis section.
- [x] Fix 2x2 Priority Matrix and Staircase drag errors - items error out when moved - Fixed: Added spaceId-based routes, coordinate validation 0-100 range, auto-create modules, fixed React infinite loop in PriorityMatrix
- [x] Add Recommendations section to facilitator Results screen and PDF export - Added Recommendations card with Target icon after Key Insights in FacilitatorWorkspace.tsx, PDF export already had recommendations support
- [x] Better format Recommendations with line breaks between numbered sections - Implemented split on double newlines with proper paragraph spacing in both UI and PDF
- [x] Implement robust session handling from Vega to improve session persistence in Nebula - Completed
- [x] Increase font size for 8-digit codes in Facilitator Dashboard (My Workspaces) - Completed
- [x] Increase font size for 8-digit codes in Share Links Dialog - Completed
- [x] Increase font size for 8-digit codes on Home Screen (Landing Page) - Completed
- [x] Public Results sharing without login - Added `/public-results` page with shareable link and QR code via Share Links dialog - Completed
- [x] Organization Switcher in Dashboard - Added Vega-style org switcher dropdown to filter workspaces by organization, shows empty projects with "Create Workspace" button
- [x] My Projects page (/projects) - Dedicated page showing projects grouped by organization with workspace counts and navigation link in user menu
- [x] "Created by me" filter - Toggle filter on both My Workspaces and My Projects pages to show only items you personally created (uses createdBy field on spaces/projects tables)

## Overview
Nebula is a multi-tenant web application for structured collaborative envisioning sessions. It enables facilitators to guide cohorts through real-time ideation, AI-powered categorization, voting, and ranking, culminating in personalized results. The platform aims to provide a robust environment for organizations to conduct effective envisioning workshops.

## User Preferences
- The user wants iterative development.
- The user wants the agent to ask before making major changes.
- The user wants detailed explanations.
- The user wants me to follow the design guidelines in `design_guidelines.md` for comprehensive design system including:
  - Color palette and semantic tokens
  - Typography scales (Inter, JetBrains Mono)
  - Spacing system and component patterns
  - Accessibility requirements (WCAG 2.1 AA)
  - Dark mode support

## System Architecture
Nebula is a multi-tenant web application with an ideas-centric architecture that supports flexible, non-linear module journeys.

### Ideas-Centric Architecture
The platform treats **ideas** as first-class entities independent of any specific module. This enables configurable workspace modules, tracking of module runs for repeatable sessions, and flexible facilitator-defined module sequences.

### UI/UX Decisions
The design system features a dark mode with a primary purple accent, dark blue-black backgrounds, and Avenir Next LT Pro font. Branding includes Synozur logos, gradient text effects, automatic elevation on hover, and organization-specific branding in headers. Navigation includes a sticky header with a theme toggle and user profile menu.

### Technical Implementations
- **Multi-Tenancy**: Supports organization isolation and custom branding.
- **Real-time Collaboration**: Utilizes WebSockets for live updates across various modules.
- **Role-Based Access Control (RBAC)**: Defines Global Admin, Company Admin, Facilitator, and User roles.
- **Authentication**: Supports local authentication (email verification, password reset) and Microsoft Entra ID SSO with JIT user and tenant provisioning. It includes robust handling for public domains and maps corporate email domains to organizations.
- **Session Persistence**: Uses PostgreSQL-backed session store (connect-pg-simple) matching Vega pattern. Sessions survive server reboots and support multi-device SSO logins with 30-day expiry.
- **AI Integration**: Leverages OpenAI API for note categorization, card rewrites, and usage tracking.
- **Voting Mechanisms**: Implements Pairwise Voting and Stack Ranking with real-time leaderboards.
- **Guest Access Control**: Manages workspace access with configurable permissions and notifications.
- **Email Notification System**: SendGrid-powered notifications for session invites, phase changes, results, and reminders.
- **Ideation Module Enhancements**: Includes real-time collaboration features (live idea count, WebSocket notifications), maximum legibility StickyNotes with deterministic colors, configurable facilitator word limits, and a full countdown timer with visual states and automatic phase deactivation.
- **Share Links & QR Codes**: Generation of shareable URLs and client-side QR codes.
- **Unified Category Management**: System for AI and human categorization with facilitator overrides.
- **Knowledge Base System**: Three-tiered document management (System, Organization, Workspace scopes) for AI grounding, supporting multiple file types and RBAC.
- **Marketplace Allocation**: A coin-based voting system with real-time budget display.
- **Export System**: Export of categorized data from voting modules for analytics and client-side PDF generation for results with branding.
- **Consolidated Data Export/Import**: Unified CSV export/import for ideas and categories.
- **Results Generation**: AI-powered cohort summaries and personalized participant results.
- **Facilitator Dashboard**: Central management for accessible workspaces.
- **Admin Panel UI**: CRUD operations for organizations and workspaces.
- **Workspace Template System**: Snapshot-based template architecture.
- **Module Variety**: Includes 2x2 Priority Matrix, Staircase, and Survey modules, all supporting real-time collaboration and facilitator-controlled participant navigation.
- **Collaborative Module Navigation**: Facilitators can direct participants to specific modules via "Bring Participants Here" functionality.
- **Dynamic Facilitator Tab Ordering**: Facilitator workspace tabs dynamically synchronize with `workspace_modules` configuration.

### System Design Choices
- **Frontend**: React, Wouter, TanStack Query, Tailwind CSS, Shadcn UI.
- **Backend**: Express.js, WebSocket (`ws`).
- **Database**: PostgreSQL (Neon) with Drizzle ORM.

### Database Migrations
- **Schema Changes**: Use `npm run db:push` to sync Drizzle schema to database
- **Data Migrations**: Use scripts in `scripts/` folder for data transformations
  - `scripts/migrate-projects.ts` - Creates default projects for orgs and links workspaces (idempotent)
- **Production Deployment**:
  1. Push schema: `npm run db:push`
  2. Run data migrations: `npx tsx scripts/migrate-projects.ts`

## External Dependencies
- **Database**: PostgreSQL (Neon)
- **ORM**: Drizzle ORM
- **AI Services**: OpenAI API
- **Authentication**: `bcrypt`, `passport.js`, `express-session`
- **Email Service**: SendGrid
- **File Upload**: `multer`
- **Routing**: Wouter
- **PDF Generation**: jsPDF, jspdf-autotable
- **QR Code Generation**: qrcode
- **State Management/Data Fetching**: TanStack Query
- **Styling**: Tailwind CSS, Shadcn UI
- **WebSocket**: `ws` library