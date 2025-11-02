# Nebula - Multi-Tenant Collaborative Envisioning Platform

## Overview
Nebula is a multi-tenant web application designed for structured collaborative envisioning sessions. It enables facilitators to guide cohorts through real-time ideation, AI-powered categorization, pairwise voting, and stack ranking, culminating in personalized results. The platform aims to provide a robust environment for organizations to conduct effective envisioning workshops.

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
Nebula is a multi-tenant web application with a clear separation of concerns between frontend and backend.

### UI/UX Decisions
The design system features a dark mode with a primary purple accent, dark blue-black backgrounds, and a custom font (Avenir Next LT Pro). Branding includes Synozur logos and a favicon. The UI incorporates gradient text effects, automatic elevation on hover states, and organization-specific branding in headers. Navigation includes a consistent sticky header with a theme toggle and user profile menu.

### Technical Implementations
- **Multi-Tenancy**: Supports organization isolation and custom branding.
- **Real-time Collaboration**: Utilizes WebSockets for live updates.
- **Role-Based Access Control (RBAC)**: Defines Global Admin, Company Admin, Facilitator, and User roles.
- **Authentication**: Includes email verification, secure password reset, and `bcrypt`, `passport.js`, `express-session`.
- **AI Integration**: Leverages OpenAI API (GPT-5) for note categorization, card rewrites, and AI usage tracking.
- **Voting Mechanisms**: Implements Pairwise Voting (round-robin) and Stack Ranking (Borda Count) with real-time leaderboards.
- **Guest Access Control**: Manages workspace access with configurable permissions, access requests, and email notifications.
- **Facilitator Controls**: Tools for managing notes (CRUD, merge, bulk select, AI rewrites), session states, and AI categorization.
- **Share Links & QR Codes**: Facilitators can generate shareable URLs and client-side QR codes for various workspace sections.
- **Workspace Access Controls**: Enforces status-based and guest permission-based access restrictions with structured error codes.
- **Unified Category Management**: A single system for AI and human categorization, allowing facilitator overrides and real-time updates.
- **Knowledge Base System**: A three-tiered document management system (System, Organization, Workspace scopes) for grounding AI, supporting multiple file types, secure storage, and RBAC. Documents can be shared across workspaces.
- **Marketplace Allocation**: A coin-based voting system with real-time budget display.
- **Export System**: Facilitators and admins can export categorized data from all voting modules for GenAI analytics.
- **Consolidated Data Export/Import**: Unified CSV export/import for ideas and categories.
- **Results Generation**: AI-powered generation of cohort summaries and personalized participant results using GPT-4o.
- **Branded PDF Export**: Client-side PDF generation for cohort and personalized results with organization branding.
- **Facilitator Dashboard**: Central dashboard for managing accessible workspaces.
- **Admin Panel UI**: Comprehensive CRUD operations for organizations and workspaces.
- **Workspace Template System**: Snapshot-based template architecture for system and organization-scoped templates, allowing efficient workspace creation from frozen copies.

### System Design Choices
- **Frontend**: React, Wouter, TanStack Query, Tailwind CSS, Shadcn UI.
- **Backend**: Express.js, WebSocket (`ws`).
- **Database**: PostgreSQL (Neon) with Drizzle ORM.

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

## Feature Backlog

### Vocabulary/Terminology Customization System
**Priority**: Medium-High | **Effort**: ~3-4 weeks

A centralized vocabulary management system allowing global admins to define default terminology and organizations to override terms throughout the UX (e.g., "Project" instead of "Workspace", "Suggestion" instead of "Idea").

**Core Features**:
- Global admin defines default terminology for all platform objects
- Company admins can override terms for their organization
- Predefined vocabulary templates for different industries (Healthcare, Education, Corporate Innovation)
- Objects to support: Workspace, Idea/Note, Whiteboard, Pairwise Voting, Stack Ranking, Marketplace
- Context provider for consistent term usage throughout app

**Technical Requirements**:
- New tables: `vocabulary_terms`, `organization_vocabulary`, `vocabulary_templates`
- API endpoints for term management and template application
- Frontend VocabularyContext with `getTerm(key, plural?)` helper
- Replace hardcoded strings across all UX surfaces
- RBAC: Global admins manage defaults, Company admins customize for org

**Business Value**:
- Customization for different industries and use cases
- Brand consistency with organizational vocabulary
- Same platform serves multiple markets with appropriate language

**Implementation Notes**:
- Full specification available from previous agent context
- Requires comprehensive UI string audit and replacement
- Consider i18n integration for future internationalization

### Automatic Workspace Closure System
**Priority**: Medium | **Effort**: ~1-2 weeks

A scheduled closure system that automatically closes workspaces after a configurable time period to ensure sessions have defined endpoints and prevent indefinite open states.

**Core Features**:
- Prompt for auto-close date when opening a workspace (defaults to 7 days from opening)
- Option to skip auto-close (must be explicitly selected, not default)
- Extend auto-close date while workspace is open
- Manual close option available anytime (overrides scheduled closure)
- When reopening a previously closed workspace, prompt for new auto-close date
- Background job/scheduler to automatically close workspaces when scheduled time is reached

**Technical Requirements**:
- New field: `spaces.autoCloseAt` (timestamp, nullable)
- Update workspace open/reopen flow to include auto-close date picker dialog
- Implement background scheduler (cron job or similar) to check and close workspaces
- API endpoint to update `autoCloseAt` date (extend functionality)
- UI in facilitator workspace to view/modify scheduled closure time
- Notification system (optional) to alert facilitators before auto-close

**Business Value**:
- Prevents abandoned open workspaces consuming resources
- Creates urgency for participant engagement
- Facilitates session planning and time management
- Reduces facilitator overhead by automating closure
- Clear session boundaries for async envisioning workshops

**User Flow**:
1. Facilitator clicks "Open Workspace" → Dialog appears
2. Dialog shows: "Schedule automatic closure" with date/time picker (default: 7 days)
3. Checkbox: "Skip automatic closure" (unchecked by default)
4. On save, workspace opens with `status='open'` and `autoCloseAt` set
5. While open, facilitator can extend date via Results tab or workspace settings
6. Background job runs hourly, closes workspaces where `NOW() > autoCloseAt`
7. If manually closed early, `autoCloseAt` is cleared
8. On reopen, repeat step 1-4 with new scheduling prompt