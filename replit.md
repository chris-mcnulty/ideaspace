# Aurora - Multi-Tenant Collaborative Envisioning Platform

## Project Overview
Aurora is a sophisticated web application that enables facilitators to guide cohorts through structured collaborative envisioning sessions. The platform supports real-time whiteboarding, AI-powered categorization, pairwise voting, stack ranking, and personalized results generation.

## Current Progress

### Completed
- ✅ Database schema for multi-tenant architecture (organizations, spaces, participants, notes, votes, rankings)
- ✅ Backend API routes for CRUD operations
- ✅ WebSocket server for real-time collaboration (/ws endpoint with spaceId parameter)
- ✅ Entry flow pages: Landing → Organization Home → Waiting Room → Participant View
- ✅ Guest name generation system with randomized astronomical names
- ✅ Comprehensive component library (14 reusable components)
- ✅ Hidden spaces functionality for facilitator-only content
- ✅ **Dark Mode Design System** based on Synozur reference:
  - Primary purple (`274 95% 52%` - #810FFB) throughout
  - Dark backgrounds (`240 8% 6%` - very dark blue-black)
  - **Avenir Next LT Pro** custom font (Regular 400, Bold 700) loaded from `/fonts/`
  - Gradient text effects for hero sections
  - Automatic elevation on hover/active states
  - Dark mode enabled by default
- ✅ **Branding Assets** integrated:
  - Custom Avenir Next LT Pro fonts (Regular & Bold)
  - Synozur logos (horizontal, vertical, mark - color & white versions)
  - Favicon using Synozur mark
  - All assets stored in `client/public/` for production deployment
  - **Aurora app name** displayed in all headers with purple gradient styling
  - Synozur logo | Aurora separator pattern throughout platform
- ✅ **Facilitator Workspace** (/o/:org/s/:space/facilitate) with:
  - Note preloading, add, edit, delete operations
  - Bulk selection and deletion
  - Note merging functionality
  - Search and filter capabilities
  - Session controls (start, pause, close)
  - Participant viewing with online/offline status
  - Real-time WebSocket integration for live updates
- ✅ **Participant Ideation View** (/o/:org/s/:space/participate) with:
  - White whiteboard canvas (rgb 255,255,255) with dark header/footer UI
  - Sticky note creation form with color selection
  - Real-time note display in responsive grid layout
  - WebSocket connection status indicator
  - Seamless integration with waiting room join flow (participantId in sessionStorage)
  - Colorful sticky notes (yellow/blue/green/pink) on white workspace

- ✅ **Landing Page** enhanced with Synozur Maturity Modeler design:
  - AI network background image with dark overlay
  - Gradient text hero heading (blue → purple → pink)
  - Beta version disclaimer messaging
  - Purple gradient treatments on feature cards with hover effects
  - Call-to-action section with dual CTAs
  - Comprehensive footer with navigation and copyright

- ✅ **AI Categorization Integration** (GPT-5 via Replit AI Integrations):
  - Production-ready OpenAI service with Zod validation and retry logic
  - POST `/api/spaces/:spaceId/categorize` endpoint with comprehensive error handling
  - GPT-5 analyzes notes and generates 3-7 thematic categories
  - Automatic "Uncategorized" fallback for missing assignments
  - Real-time WebSocket broadcasts (`categories_updated` event)
  - Facilitator UI with "AI Categorize" button and loading states
  - Category-grouped note display with colored badges
  - Sparkles icon indicators for AI-generated categories
  - Promise.allSettled for graceful partial failure handling
  - Successfully tested: 7 notes categorized into 5 themes

- ✅ **Pairwise Voting Module**:
  - Round-robin algorithm for deterministic pair generation (all unique combinations)
  - GET `/api/spaces/:spaceId/participants/:participantId/next-pair` endpoint
  - POST `/api/votes` with WebSocket broadcasts for real-time updates
  - DuelCard component with side-by-side note comparison
  - Participant voting page (/vote) with keyboard shortcuts (press 1 or 2)
  - Progress tracking (completedPairs / totalPairs with percentage)
  - Completion screen with checkmark when all pairs voted
  - Facilitator workspace voting tab with:
    - Statistics cards (total votes, possible pairs, active voters)
    - Per-participant progress bars with completion badges
    - Leaderboard of most preferred ideas by win count
  - Successfully tested: 21/21 votes on 7 notes (21 unique pairs)

- ✅ **Role-Based Access Control (RBAC) System**:
  - Database schema: users table with roles (global_admin, company_admin, facilitator, user)
  - Authentication: bcrypt password hashing, passport.js local strategy, express-session
  - Authorization middleware: requireAuth, requireRole, requireGlobalAdmin, requireCompanyAdmin, requireFacilitator
  - 4-digit workspace codes for entry (replaces organization search on landing page)
  - Public registration creates standard "user" accounts only
  - Admin-protected `/api/admin/users` endpoint for creating elevated roles with scoping rules
  - Company admins restricted to their organization for all operations
  - Global admins have unrestricted access across all organizations
  - Landing page redesigned for 4-digit code entry (no company search)
  - Login page (/login) for administrators and facilitators
  - Admin panel UI (/admin) displaying organizations with grouped workspaces
  - Workspace management: view, open, edit, archive actions by role
  - Backend APIs: list organizations/users/workspaces with role-based filtering
  - Company/facilitator association management endpoints

### In Progress
- Facilitator dashboard to view all assigned workspaces
- Guest access enforcement based on per-workspace settings

### Pending
- Stack ranking module with Borda count
- Results view with cohort and personalized summaries

### Backlog (Future Features)
- **Drag-and-drop for sticky notes**: Use @dnd-kit to enable note repositioning on whiteboard
- **Organization-level branding customization**: Allow individual organizations to override the default Synozur design with their own:
  - Custom color palette (primary, accent, backgrounds)
  - Custom font selection
  - Organization logo upload and management (horizontal, vertical, white versions)
  - Favicon customization per organization
  - Example: Synozur (default dark purple theme) vs Microsoft (custom branding)
  - Storage: Upload logos to database or object storage with organization association

## Architecture

### Multi-Tenancy
- URL structure: `/o/:org/s/:space`
- Organization isolation with custom branding support
- Per-org spaces with visibility controls (public/hidden)

### User Roles & Permissions
1. **Global Admin**: Platform super-admin with unrestricted access to all organizations, users, and workspaces
2. **Company Admin**: Organization-scoped admin who can manage users, facilitators, and workspaces within their assigned organization(s)
3. **Facilitator**: Workspace-scoped user who can facilitate sessions, manage notes, trigger AI categorization, and control session flow
4. **User**: Standard participant who joins workspaces via 4-digit codes, creates notes, votes, and ranks ideas

### Database Schema
- **organizations**: Multi-tenant isolation with branding settings
- **users**: Authentication and role-based access control (email, password hash, role, organizationId)
- **companyAdmins**: Association table linking users to organizations as admins
- **spaceFacilitators**: Association table linking users to specific workspaces as facilitators
- **spaces**: Envisioning sessions with 4-digit codes, guest settings, and visibility flags
- **participants**: Session attendees (registered users or anonymous guests with generated names)
- **notes**: Ideas/contributions from participants with optional AI-generated categories
- **votes**: Pairwise voting decisions
- **rankings**: Stack-ranked preferences

### Tech Stack
- **Frontend**: React, Wouter (routing), TanStack Query, Tailwind CSS, Shadcn UI
- **Backend**: Express.js, WebSocket (ws)
- **Database**: PostgreSQL (Neon), Drizzle ORM
- **AI**: OpenAI API (for categorization and summaries)
- **Design**: Dark mode with purple highlights, Montserrat font (Avenir Next LT Pro fallback), gradient text effects
- **Reference**: Synozur Maturity Modeler design system

## Key Features

### Guest User System
- Random name generation from astronomical terms (Powerful Andromeda, Radiant Sirius, etc.)
- Anonymous participation without registration
- Optional registration for profile data capture

### Real-Time Collaboration
- WebSocket connections per space
- Live note creation/updates/deletion
- Participant presence tracking
- Broadcast updates to all connected clients

### Facilitator Controls
- Preload notes (bulk import)
- Add/edit/delete/merge notes at any phase
- Session state management (draft/open/closed)
- Phase progression control
- AI categorization triggers

## API Endpoints

### Authentication
- `POST /api/auth/register` - Public registration (creates user role only)
- `POST /api/auth/login` - Login with email/password
- `POST /api/auth/logout` - Logout current session
- `GET /api/auth/me` - Get current authenticated user

### Admin Panel
- `POST /api/admin/users` - Create users with elevated roles (company admin+)
- `GET /api/admin/users` - List users with role-based filtering
- `GET /api/admin/organizations` - List all organizations (global admin)
- `GET /api/admin/organizations/:orgId/spaces` - List workspaces by org (company admin+)
- `POST /api/admin/company-admins` - Associate user as company admin (global admin)
- `DELETE /api/admin/company-admins/:id` - Remove company admin association (global admin)
- `POST /api/admin/space-facilitators` - Assign facilitator to workspace (company admin+)
- `DELETE /api/admin/space-facilitators/:id` - Remove facilitator assignment (company admin+)

### Organizations
- `GET /api/organizations/:slug` - Get org by slug
- `POST /api/organizations` - Create organization (global admin)

### Spaces
- `GET /api/spaces/lookup/:code` - Lookup workspace by 4-digit code (public)
- `GET /api/organizations/:orgId/spaces` - List spaces
- `GET /api/spaces/:id` - Get space details
- `POST /api/spaces` - Create space (facilitator+)
- `PATCH /api/spaces/:id` - Update space (facilitator+)
- `DELETE /api/spaces/:id` - Delete space (company admin+)

### Participants
- `GET /api/spaces/:spaceId/participants` - List participants
- `POST /api/participants` - Join space (guest or registered)
- `PATCH /api/participants/:id` - Update participant

### Notes
- `GET /api/spaces/:spaceId/notes` - List notes
- `POST /api/notes` - Create note (broadcasts via WebSocket)
- `PATCH /api/notes/:id` - Update note (broadcasts)
- `DELETE /api/notes/:id` - Delete note (broadcasts)
- `POST /api/notes/bulk-delete` - Delete multiple notes (facilitator+)
- `POST /api/spaces/:spaceId/categorize` - AI categorize all notes using GPT-5 (facilitator+)

### Voting
- `GET /api/spaces/:spaceId/votes` - List all votes
- `POST /api/votes` - Record pairwise vote (broadcasts via WebSocket)
- `GET /api/spaces/:spaceId/participants/:participantId/next-pair` - Get next pair to vote on

### Votes & Rankings
- `GET /api/spaces/:spaceId/votes` - List votes
- `POST /api/votes` - Record vote
- `GET /api/spaces/:spaceId/rankings` - List rankings
- `POST /api/rankings/bulk` - Submit rankings

## Environment Setup

### Required Secrets
- `DATABASE_URL`: PostgreSQL connection string
- `SESSION_SECRET`: Secret key for express-session cookie signing
- `AI_INTEGRATIONS_OPENAI_API_KEY`: GPT-5 access via Replit AI Integrations (auto-configured)
- `AI_INTEGRATIONS_OPENAI_BASE_URL`: Replit AI Integrations endpoint (auto-configured)

### Development Commands
- `npm run dev`: Start development server
- `npm run db:push`: Sync database schema
- `npx tsx server/seed.ts`: Seed sample data

## Sample Data
The seed script creates:
- Acme Corporation (slug: "acme")
- 3 spaces (including 1 hidden)
- 4 participants (2 registered, 2 guests)
- 5 sample notes

## Design Guidelines
See `design_guidelines.md` for comprehensive design system including:
- Color palette and semantic tokens
- Typography scales (Inter, JetBrains Mono)
- Spacing system and component patterns
- Accessibility requirements (WCAG 2.1 AA)
- Dark mode support

## Component Library
Located in `client/src/components/`:
- BrandHeader, StickyNote, Zone, DuelCard, RankListItem
- TimerBar, ParticipantList, CategoryPill, StatusBadge, SpaceCard
- WaitingRoom, FacilitatorWorkspace, FacilitatorConsole
- ResultsTabs, ReadoutViewer

## Next Steps
1. Build stack ranking with Borda count for final prioritization
2. Create results view with AI-generated cohort summaries
3. Add personalized results generation for participants
4. Implement drag-and-drop note repositioning (optional enhancement)
5. Performance optimization for large note sets (pagination, caching)
