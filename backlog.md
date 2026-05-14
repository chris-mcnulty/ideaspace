# Nebula Backlog

This document tracks planned features, incomplete implementations, and technical debt across the Nebula platform.

---

## Priority Legend
- **P0**: Critical/Blocker - Must be addressed immediately
- **P1**: High Priority - Important for next release
- **P2**: Medium Priority - Should be completed soon
- **P3**: Low Priority - Nice to have, can be deferred

---

## OAuth & Authentication

### OAuth Integration Completion (P1)
**Status**: Partially implemented, blocked on external configuration
**Location**: `server/routes/auth-oauth.ts`, `server/services/oauth-client.ts`
**Description**: OAuth 2.1 with Orion identity provider is implemented but cannot authenticate due to application registration mismatch.

**Required Steps**:
1. Register/update Nebula application in Orion identity provider
2. Configure redirect URI to match current Replit domain
3. Test OAuth flow end-to-end
4. Enable OAuth via killswitch setting

**See**: `OAUTH_CONFIGURATION_NOTES.md` for detailed instructions

### Persistent Session Store (P2)
**Location**: `server/routes.ts`
**Description**: Currently using memory-based session store. Should migrate to PostgreSQL-backed sessions for production reliability.

### Token Rotation (P2)
**Description**: Implement refresh token rotation and secure storage for long-lived sessions.

### OAuth Audit Logging (P3)
**Description**: Track OAuth authentication events for security and compliance.

### Multi-Environment OAuth Support (P3)
**Description**: Configure separate OAuth applications for dev/staging/production environments.

### Tenant-to-Organization Mapping (P2)
**Location**: `server/routes/auth-oauth.ts`
**Description**: Implement automatic organization assignment based on `orionTenantId` from Orion claims.

---

## Ideation Module

### Timer Countdown Implementation (P2)
**Location**: `client/src/pages/ParticipantView.tsx`, `client/src/components/ModuleConfiguration.tsx`
**Description**: Timer configuration (`timerEnabled`, `timerDurationMinutes`) is stored in module config but the visible countdown timer UI is not yet implemented.

**Current State**: Configuration options exist as UI placeholders
**Required**: Visual countdown timer component, auto-close ideation when timer expires

### Ideation Phase Controls (P3)
**Description**: Add facilitator controls for:
- Pause/resume ideation
- Anonymous mode toggle (hide author names during session)
- Live word cloud visualization

---

## Marketplace Module

### Marketplace Statistics (P3)
**Location**: `client/src/pages/FacilitatorWorkspace.tsx` (line 1749)
**Description**: Comment indicates "Marketplace stats could be added here in the future"

**Potential Features**:
- Total coins allocated
- Distribution visualization
- Top-funded ideas leaderboard

---

## Results & Analytics

### includeContributions Parameter (P3)
**Location**: `server/routes.ts` (line 2690)
**Description**: TODO comment indicates support for `includeContributions` parameter in results export.

### Enhanced Export Options (P2)
**Description**: Extend CSV/JSON export to include:
- Participant contribution breakdown
- Module-by-module progression data
- Timestamp audit trails

### Real-time Analytics Dashboard (P3)
**Description**: Live facilitator dashboard showing:
- Participation rates per module
- Idea submission velocity
- Voting progress

---

## Priority Matrix Module

### Snap-to-Grid Feature (P3)
**Location**: `client/src/pages/AdminPanel.tsx`
**Description**: Commented-out code for `snapToGrid` and `gridSize` configuration in Priority Matrix module settings.

### Quadrant Labels (P3)
**Description**: Allow facilitators to label each quadrant (e.g., "Quick Wins", "Big Bets", "Fill-Ins", "Time Sinks")

---

## Survey Module

### Question Bank (P3)
**Description**: Pre-built question templates that facilitators can select from.

### Conditional Logic (P3)
**Description**: Allow follow-up questions based on previous answers.

---

## Knowledge Base

### Full-Text Search (P2)
**Description**: Implement search across uploaded documents for AI grounding.

### Document Versioning (P3)
**Description**: Track changes and allow rollback to previous document versions.

---

## AI & LLM Safety

### AI Prompt Injection Hardening (P1) — _IMPLEMENTED 2026-05-14_
**Location**: `server/services/openai.ts` (categorization prompt at lines 57-92, similar patterns elsewhere), `server/services/results.ts` (cohort/personalized prompts), `server/services/promptSafety.ts` (new)
**Description**: User-supplied note content is interpolated directly into LLM prompts (`${notes.map(... note.content ...)}` at line 62) with no delimiters, escaping, or input-length caps. A crafted note could redirect categorization, leak system instructions, or trigger jailbreaks.

**Delivered**:
- New `promptSafety` module: `sanitizeForPrompt`, `wrapUntrusted`, `capAggregate`, `PROMPT_INJECTION_GUARD`
- All 6 prompt builders (`categorizeNotes`, `rewriteCard`, `suggestIdeas`, `generateCohortResults`, `generatePersonalizedResults`, `generatePersonalizedResultsFromCache`) now wrap user content in tagged blocks, sanitize control characters and Unicode bidi overrides, and cap per-field + aggregate length
- System prompts include the trust-boundary guard
- Regression tests in `server/services/promptSafety.test.ts` cover delimiter escape attempts, bidi smuggling, control chars, length caps

### AI Response Timeout & Fallback Handling (P2)
**Location**: `server/services/openai.ts` (line 82 and other `openai.chat.completions.create` callsites)
**Description**: OpenAI calls are made without an explicit `timeout`. If the model stalls, the request blocks until the client gives up, leaving facilitators with a spinning UI and no graceful degradation.

**Required**:
- Pass an explicit timeout (e.g. 30s) to every LLM call
- Use the existing retry loop to fall back to a degraded response (empty categorization, generic summary) after exhausting attempts
- Surface a user-visible "AI temporarily unavailable" state instead of a hang

### AI Cost Attribution & Per-Organization Budget Caps (P2)
**Location**: `server/services/aiUsageLogger.ts`, `server/services/openai.ts`
**Description**: `aiUsageLogger` records usage but there is no enforcement layer that stops calls when an organization exceeds a configured budget. Without caps a single workspace can consume unbounded spend.

**Required**:
- Add monthly token/cost budgets at the organization level (schema + admin UI)
- Middleware that checks remaining budget before issuing LLM calls and returns 429 with a clear message when exceeded
- Admin dashboard view of usage vs. budget per org

---

## Notifications & Communication

### In-App Notifications (P2)
**Description**: Real-time notification center for:
- New participant joins
- Phase changes
- Results availability
- Access request approvals

### Slack/Teams Integration (P3)
**Description**: Send session notifications to external communication platforms.

### SMS Notifications (P3)
**Description**: Option to send session reminders via SMS (requires Twilio integration).

---

## User Experience

### Accessibility Audit (P2)
**Description**: Comprehensive WCAG 2.1 AA compliance review and fixes.

**Focus Areas**:
- Screen reader compatibility for drag-and-drop modules
- Keyboard navigation for all interactive elements
- Color contrast in all themes

### Mobile Responsiveness (P2)
**Description**: Optimize layouts for mobile devices, especially:
- Priority Matrix positioning
- Staircase module interactions
- Stack ranking drag-and-drop

### Offline Support (P3)
**Description**: Allow participants to continue working during brief connectivity drops, syncing when reconnected.

---

## Administration

### Bulk User Import (P2)
**Description**: CSV import for creating multiple users/participants at once.

### Organization Analytics (P2)
**Description**: Dashboard showing:
- Active workspaces per organization
- Total participants
- AI usage metrics
- Session completion rates

### Role Audit Trail (P3)
**Description**: Track who assigned/changed user roles and when.

---

## Security & Hardening

### CSRF Protection & SameSite Cookie Hardening (P1) — _IMPLEMENTED 2026-05-14 (opt-in)_
**Location**: `server/middleware/csrf.ts` (new), `server/index.ts`, `client/src/lib/queryClient.ts`, `client/src/lib/installFetchCsrf.ts` (new), `server/session.ts`
**Description**: State-changing routes rely on session cookies but lack CSRF tokens or strict `SameSite`/`Secure` cookie attributes verified end-to-end. Cross-site requests against authenticated facilitators could trigger destructive actions (delete space, change roles).

**Delivered**:
- Double-submit-cookie middleware with three modes (`CSRF_MODE=off|report|enforce`, default `off`)
- Token cookie: `SameSite=Lax`, `Secure` in production, 30-day max age
- Constant-time comparison; `/api/csrf-token` endpoint for non-cookie clients
- `apiRequest` and `getQueryFn` send `X-CSRF-Token` automatically; a global fetch interceptor (`installFetchCsrf`) catches the ~30 direct `fetch()` callers in the client without per-file edits
- Session secret hardened: production now fails fast if `SESSION_SECRET` is missing or <32 chars (was previously a hardcoded fallback)
- 8 middleware tests covering mode switches, mismatch rejection, allowlist, and safe-method passthrough

**Rollout**: ship with `CSRF_MODE=off`, flip to `report` in staging to confirm no clients are missing the header (logs will show `CSRF token mismatch` warnings), then flip to `enforce` in production.

### Log Redaction & Sensitive Data Hygiene (P1) — _IMPLEMENTED 2026-05-14 (high-risk callsites)_
**Location**: `server/utils/logger.ts` (new), `server/routes.ts` (password reset paths), `server/routes/auth-oauth.ts`, `server/routes/auth-entra.ts`, `server/index.ts` (global error handler)
**Description**: Errors are logged with raw payloads that may include password-reset tokens, OAuth codes, session IDs, and PII (emails). Logs flow to hosting platforms without redaction.

**Delivered**:
- Central `logger` with recursive key-based redaction (passwords, tokens, secrets, cookies, OAuth codes, refresh/access/id tokens, session payloads, etc.)
- Email addresses in string values are masked (`a***@example.com`)
- String values are truncated at 2 KB; recursion is depth-capped
- Wired into the highest-risk paths: password reset endpoints (request/reset), all OAuth/Entra auth flows, and the global Express error handler
- 13 redaction tests cover key matching, recursion, Error serialization, email masking, depth limits

**Follow-up**: ~190 routine `console.error` calls remain in CRUD handlers — migrate gradually; an ESLint rule banning new `console` usage in `server/` is recommended.

### Workspace Code Rotation & Audit Trail (P3)
**Location**: `server/services/workspace-code.ts`
**Description**: Workspace join codes are issued without expiration, rotation, or per-use audit logging. A leaked code grants indefinite access.

**Required**:
- Add `expiresAt` and `revokedAt` columns to workspace codes
- Facilitator UI action to rotate a code (invalidates old, issues new)
- Log each redemption (who, when, IP) for forensic review

---

## Technical Debt

### Sidebar Rail Compatibility (P3)
**Location**: `client/src/components/ui/sidebar.tsx` (line 285)
**Description**: Comment notes "Tailwind v3.4 doesn't support 'in-' selectors. So the rail won't work perfectly."

### Content Moderation Stub (P2)
**Description**: Implement actual content moderation for user-generated ideas (currently stubbed).

### WebSocket Connection Pooling (P2)
**Location**: `server/routes.ts`
**Description**: Optimize WebSocket handling for production scale with connection pooling and reconnection logic.

### Error Boundary Implementation (P2)
**Description**: Add React error boundaries to prevent full-page crashes from component errors.

### Test Coverage (P1)
**Description**: Implement comprehensive test suites:
- Unit tests for storage layer
- Integration tests for API routes
- E2E tests for critical user flows

### Query Parameter Validation with Zod (P1) — _IMPLEMENTED 2026-05-14_
**Location**: `server/utils/queryParams.ts` (new), `server/routes.ts`, `server/routes/auth-oauth.ts`, `server/routes/auth-entra.ts`
**Description**: Query params like `limit`, `page`, `offset`, `coinBudget` are coerced with bare `parseInt()` and minimal bounds checking. Missing or non-numeric values produce `NaN` that silently flows into storage calls.

**Delivered**:
- Shared Zod schemas: `paginationQuerySchema`, `notificationListQuerySchema`, `kbSearchQuerySchema`, plus `optionalUuid`, `optionalDomain`, `boolFromQuery`, and a `parseQuery` helper that responds 400 with field-level details
- Wired into the routes flagged in the audit: KB search, notifications list, galaxy reports pagination, projects org filter
- **Open-redirect fix**: `safeReturnTo` validator rejects absolute URLs, protocol-relative URLs (`//evil.com`), CR/LF injection, and JS scheme tricks. Applied to both the OAuth (`auth-oauth.ts`) and Entra (`auth-entra.ts`) `returnTo` flows — at write time and at use time
- 18 schema/redirect tests cover NaN, overflow, invalid scope, missing default, all redirect bypass patterns

### Storage Layer N+1 Query Audit (P2) — _AUDIT COMPLETE 2026-05-14_
**Audit report**: `docs/storage-query-audit.md` — 12 findings (2 Critical, 5 High, 3 Medium, 2 Low), file:line anchored, with one-sentence fix recommendations. Top issues: per-space DB round-trip in `GET /api/galaxy/reports`, full-table scan in `getOrganizationByDomain`, duplicate facilitator authorization queries.
**Location**: `server/storage.ts` (e.g. `getNotesBySpace`, `getIdeasBySpace`, `getParticipantsBySpace` and their callers)
**Description**: Several storage methods load full collections and filter in JS, and several routes call per-row lookups inside loops. As spaces grow this becomes the dominant latency cost.

**Required**:
- Audit `server/routes.ts` and `server/services/results.ts` for `for`/`map` loops that invoke storage methods
- Push filtering and joins into Drizzle queries (single round-trip per request)
- Add pagination to listing methods that currently return unbounded arrays

### WebSocket Connection Limits & Per-Space Caps (P2)
**Location**: `server/routes.ts` (WebSocket setup around lines 7793-7867)
**Description**: Separate from the existing pooling item, the server has no max-connections-per-space cap, no global connection ceiling, and the heartbeat/stale-sweep interval is hard-coded. A misbehaving client can exhaust sockets for a workspace.

**Required**:
- Configurable global and per-space connection limits (reject with a clear close code when exceeded)
- Environment-driven heartbeat and stale-cleanup intervals
- Metrics endpoint exposing current connection counts per space

---

## Documentation

### API Documentation (P2)
**Description**: Generate OpenAPI/Swagger documentation for all REST endpoints.

### Facilitator Guide (P2)
**Description**: User-facing documentation for facilitators explaining:
- Module configuration options
- Best practices for running sessions
- Troubleshooting common issues

### Developer Onboarding (P3)
**Description**: Technical documentation for new developers covering:
- Architecture decisions
- Code conventions
- Local development setup

---

## Infrastructure

### Database Backup Strategy (P1)
**Description**: Automated backup and point-in-time recovery for production database.

### Rate Limiting (P2)
**Location**: `server/middleware/uploadMiddleware.ts`
**Description**: Extend rate limiting beyond file uploads to all API endpoints.

### CDN for Static Assets (P3)
**Description**: Serve static assets (fonts, images) via CDN for better performance.

### Health Checks (P2)
**Description**: Implement comprehensive health check endpoints for:
- Database connectivity
- External service dependencies
- WebSocket server status

### File Upload Hardening: Quotas, Orphan Cleanup, AV Scanning (P2)
**Location**: `server/services/file-upload.ts` (lines 15-77), `server/middleware/uploadMiddleware.ts`, `uploads/`
**Description**: IP-level rate limiting exists but there are no per-user/per-organization quotas, no cleanup of partial uploads left in `uploads/temp`, and no malware scanning before files become available for AI grounding.

**Required**:
- Per-user and per-organization upload quotas (count and total bytes) tracked in DB
- Scheduled job to remove `uploads/temp` files older than 1 hour
- Integrate ClamAV (or equivalent) scanning in production; quarantine on positive hits
- Reject uploads exceeding allow-listed MIME types after content-sniffing (not just extension)

---

## Recently Completed

### Ideation Legibility Overhaul (Jan 2026)
- High-contrast vibrant StickyNote colors
- Enhanced typography (text-lg font-semibold)
- Optimized grid layout with gap-8 spacing
- IdeasHub session notes improvements

### Email Normalization (Jan 2026)
- All email addresses normalized at write time
- Prevents duplicate records from casing variations

### Facilitator Word Limits (Jan 2026)
- Configurable min/max word count in ideation module
- Client-side validation with real-time feedback

---

## Notes

- This backlog should be reviewed and prioritized regularly
- Items may be promoted or demoted based on user feedback
- Dependencies between items should be noted when scheduling work
- Update this file when completing items or discovering new requirements
