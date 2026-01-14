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
