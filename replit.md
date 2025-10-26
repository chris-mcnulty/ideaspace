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
  - Logos integrated in landing page, org home, and headers
- ✅ **Facilitator Workspace** (/o/:org/s/:space/facilitate) with:
  - Note preloading, add, edit, delete operations
  - Bulk selection and deletion
  - Note merging functionality
  - Search and filter capabilities
  - Session controls (start, pause, close)
  - Participant viewing with online/offline status
  - Real-time WebSocket integration for live updates

### In Progress
- Participant ideation view with collaborative whiteboard

### Pending
- AI categorization integration (OpenAI)
- Pairwise voting module
- Stack ranking module with Borda count
- Results view with cohort and personalized summaries

### Backlog (Future Features)
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

### User Roles
1. **Publisher (Synozur)**: Platform administrator
2. **Org Admin**: Organization management
3. **Facilitator**: Session control, full CRUD on notes
4. **Participant**: Join sessions, create notes, vote, rank

### Database Schema
- **organizations**: Multi-tenant isolation
- **spaces**: Envisioning sessions within organizations
- **participants**: Session attendees (registered or guest)
- **notes**: Ideas/contributions from participants
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

### Organizations
- `GET /api/organizations/:slug` - Get org by slug
- `POST /api/organizations` - Create organization

### Spaces
- `GET /api/organizations/:orgId/spaces` - List spaces
- `GET /api/spaces/:id` - Get space details
- `POST /api/spaces` - Create space
- `PATCH /api/spaces/:id` - Update space
- `DELETE /api/spaces/:id` - Delete space

### Participants
- `GET /api/spaces/:spaceId/participants` - List participants
- `POST /api/participants` - Join space (guest or registered)
- `PATCH /api/participants/:id` - Update participant

### Notes
- `GET /api/spaces/:spaceId/notes` - List notes
- `POST /api/notes` - Create note (broadcasts via WebSocket)
- `PATCH /api/notes/:id` - Update note (broadcasts)
- `DELETE /api/notes/:id` - Delete note (broadcasts)
- `POST /api/notes/bulk-delete` - Delete multiple notes

### Votes & Rankings
- `GET /api/spaces/:spaceId/votes` - List votes
- `POST /api/votes` - Record vote
- `GET /api/spaces/:spaceId/rankings` - List rankings
- `POST /api/rankings/bulk` - Submit rankings

## Environment Setup

### Required Secrets
- `DATABASE_URL`: PostgreSQL connection string
- `OPENAI_API_KEY`: For AI categorization (pending implementation)

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
1. Complete facilitator workspace with WebSocket integration
2. Build participant ideation view
3. Integrate OpenAI for AI categorization
4. Implement voting and ranking modules
5. Build results generation with AI summaries
