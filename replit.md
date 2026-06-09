# Nebula - Multi-Tenant Collaborative Envisioning Platform

## Overview
Nebula is a multi-tenant web application designed for structured collaborative envisioning sessions. It empowers facilitators to guide cohorts through real-time ideation, AI-powered categorization, voting, and ranking, culminating in personalized results. The platform's core purpose is to provide organizations with a robust environment for conducting effective envisioning workshops, fostering innovation, and streamlining strategic planning.

## User Preferences
- The user wants iterative development.
- The user wants the agent to ask before making major changes.
- The user wants detailed explanations.
- **When a newly merged pull request is detected in Git, always inspect and integrate it**: read every changed file, verify schema integrity (no orphaned columns, insert schemas, select types), verify the database layer (storage interface, migrations), fix any integration gaps (missing imports, un-migrated patterns, leftover stubs), and confirm the app builds cleanly.
- The user wants me to follow the design guidelines in `design_guidelines.md` for comprehensive design system including:
  - Color palette and semantic tokens
  - Typography scales (Inter, JetBrains Mono)
  - Spacing system and component patterns
  - Accessibility requirements (WCAG 2.1 AA)
  - Dark mode support

## System Architecture
Nebula is a multi-tenant web application built around an ideas-centric architecture, supporting flexible, non-linear module journeys and real-time collaboration.

### Ideas-Centric Architecture
The platform treats **ideas** as first-class entities, independent of any specific module. This design allows for configurable workspace modules, repeatable session tracking, and flexible facilitator-defined module sequences.

### UI/UX Decisions
The design system features a dark mode with a primary purple accent, dark blue-black backgrounds, and Avenir Next LT Pro font. Branding includes Synozur logos, gradient text effects, automatic elevation on hover, and organization-specific branding in headers. Navigation incorporates a sticky header with a theme toggle and user profile menu, adhering to WCAG 2.1 AA accessibility standards and mobile responsiveness (≥360px no h-scroll, ≥44px touch targets).

### Technical Implementations
- **Multi-Tenancy**: Supports organization isolation, custom branding, and project scoping.
- **Real-time Collaboration**: Utilizes WebSockets for live updates across various modules, including ideation, voting, and module navigation.
- **Role-Based Access Control (RBAC)**: Defines Global Admin, Company Admin, Facilitator, and User roles with granular permissions.
- **Authentication**: Supports local authentication (email verification, password reset) and Microsoft Entra ID SSO with JIT user and tenant provisioning, including robust handling for public domains and corporate email domain mapping.
- **Session Persistence**: Uses a PostgreSQL-backed session store for robust session management.
- **AI Integration**: Leverages OpenAI API for note categorization, card rewrites, idea suggestions, and grounding cohort results with knowledge base chunks.
- **Voting Mechanisms**: Implements Pairwise Voting, Stack Ranking, Priority Matrix, Staircase, and Marketplace Allocation with real-time feedback.
- **Signal (Live Interaction)**: A Mentimeter-style live module. A facilitator builds a *deck* of activities (v1: word cloud, multiple choice, numeric/scale) and advances through them live; participants respond from their phones at `/signal` while a dedicated full-screen **presenter** view (`/signal/present`) aggregates results in real time (word cloud via d3-cloud, charts via recharts). Real-time sync over WebSockets; responses are anonymous. Works in a journey or standalone. The presenter view and aggregated results are facilitator-only; the heavy charting libraries load lazily. Idea-integration hooks: multiple-choice options can be seeded from workspace ideas (optionally by category), and a word cloud's words can be pushed back into the workspace as ideas (deduped, frequency preserved) to drive further ideation.
- **Starship Envisioning**: A drag-and-drop board (modeled on the Priority Matrix) implementing a starship metaphor. The ship travels left to right; participants can both generate new ideas inline and place them into three zones — *Propulsion* (rockets/warp drives, upper-left), *Destinations* (planets ahead, upper-right), and *Black Holes* (forces dragging you down, bottom). Zone labels are facilitator-editable. The zone a note lands in is mirrored onto the idea's category (auto-creating the three zone categories) so the grouping flows into downstream modules and results. Works as a configurable module within a journey or as a standalone one-off space, with real-time collaboration over WebSockets.
- **Guest Access Control**: Manages workspace access with configurable permissions and notifications.
- **Email Notification System**: SendGrid-powered notifications for various platform interactions.
- **Knowledge Base System**: A three-tiered document management system (System, Organization, Workspace scopes) for AI grounding, supporting various file types (text, markdown, CSV, HTML, JSON) and RBAC.
- **Export System**: Supports client-side PDF generation for results with branding and consolidated CSV export for ideas and categories.
- **Results Generation**: AI-powered cohort summaries and personalized participant results, integrating data from all active modules.
- **Facilitator & Admin Tools**: Comprehensive dashboards for workspace management, user administration, project management, and CSV import/export functionalities.
- **Workspace Template System**: Snapshot-based architecture for creating and managing workspace templates.
- **Public Results Sharing**: Allows sharing of results via public links and QR codes without requiring login.

### System Design Choices
- **Frontend**: React, Wouter, TanStack Query, Tailwind CSS, Shadcn UI.
- **Backend**: Express.js, WebSocket (`ws`).
- **Database**: PostgreSQL (Neon) with Drizzle ORM.

## Accessibility Regression Testing

An automated WCAG 2.1 AA regression scan lives in `tests/a11y.spec.ts` and runs via Playwright + `@axe-core/playwright`.

### Test plan

- **Public routes scanned**: `/`, `/login`, `/register`, `/forgot-password`.
- **Authenticated routes scanned** (signed in as the seeded `company_admin` test user): `/admin`, `/dashboard`, `/projects`.
- `/admin/migrations` is intentionally **not** scanned: its underlying APIs require `global_admin`, so the seeded `company_admin` would only exercise an unauthorized fallback state. Add it once a global-admin seed exists.
- For each route, axe-core is invoked with the `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa` rule tags. The test fails only when a violation has an `impact` of `serious` or `critical`, keeping the signal aligned with the WCAG 2.1 AA baseline established in Task #3. Minor / moderate findings are not currently reported — extend the `scan()` helper if you want to log them.
- A small sanity test confirms axe-core itself loads and analyzes the landing page.

### Running locally

1. Ensure the app is running (`npm run dev`) — Playwright's `webServer` block will reuse it if it is already up.
2. Seed the test admin once: `npx tsx scripts/create-test-admin.ts` (creates `testadmin@e2e.test` / `TestAdmin123!`).
3. Install browsers (first run only): `npx playwright install chromium`.
4. Execute the scan: `npx playwright test tests/a11y.spec.ts`.

Override credentials with the `A11Y_TEST_EMAIL` / `A11Y_TEST_PASSWORD` env vars; override the target URL with `PLAYWRIGHT_BASE_URL`. Set `PLAYWRIGHT_NO_SERVER=1` to skip the bundled `webServer` when running against a separately-managed instance.

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

## Synozur Traffic Ingest Worker
Nebula pushes workspace pageview/session data to the Synozur parent-site traffic registry.

**Required Replit Secrets** (both must be set; missing → worker no-ops with a single startup warning):

| Secret | Value |
|---|---|
| `SYNOZUR_TRAFFIC_BASE_URL` | `https://www.synozur.com` (no trailing slash) |
| `SYNOZUR_TRAFFIC_API_KEY` | `tp_…` key from Synozur Admin → Traffic Properties → property slug `nebula` |

**Optional:**
- `SYNOZUR_TRAFFIC_FLUSH_INTERVAL_MS` — flush cadence in ms (default `30000`)

**How it works** (`server/services/trafficWorker.ts`):
- In-process buffer (max 10 000 rows); drops oldest on overflow with a WARN log.
- Timer worker flushes up to 2 000 rows every 30 s to `POST /api/traffic/ingest`.
- Retry: 429 → 30 s back-off; 5xx/network → exponential (1 s→…→60 s, max 10 attempts); 401 → pause until restart.
- sessionKey: `neb_<workspaceCode>_<sha256(participantId).slice(0,16)>` — deterministic, no PII.
- Only workspace page-loads are tracked (path `/workspace/<code>`); admin/API/facilitator routes are not enqueued.
- Graceful shutdown: SIGTERM/SIGINT calls `flushNow()` with a 5 s timeout before `process.exit`.