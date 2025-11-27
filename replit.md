# Nebula - Multi-Tenant Collaborative Envisioning Platform

## Overview
Nebula is a multi-tenant web application designed for structured collaborative envisioning sessions. It enables facilitators to guide cohorts through real-time ideation, AI-powered categorization, pairwise voting, and stack ranking, culminating in personalized results. The platform aims to provide a robust environment for organizations to conduct effective envisioning workshops, offering a comprehensive solution for effective envisioning workshops.

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

### Ideas-Centric Architecture (Nov 2025)
The platform has been refactored to treat **ideas** as first-class entities independent of any specific module:
- **Ideas Table**: Core entity storing all ideas (participant-generated, facilitator-entered, preloaded, or imported)
- **Workspace Modules**: Configurable modules per workspace with enable/disable, ordering, and JSONB config
- **Module Runs**: Track individual executions of modules for repeatable sessions
- **Flexible Journeys**: Facilitators can create custom module sequences (e.g., preload ideas → 2x2 grid → marketplace → results)
- **Smart Results**: Only display data from actually-used modules

### UI/UX Decisions
The design system features a dark mode with a primary purple accent, dark blue-black backgrounds, and a custom font (Avenir Next LT Pro). Branding includes Synozur logos and a favicon. The UI incorporates gradient text effects, automatic elevation on hover states, and organization-specific branding in headers. Navigation includes a consistent sticky header with a theme toggle and user profile menu.

### Technical Implementations
- **Multi-Tenancy**: Supports organization isolation and custom branding.
- **Real-time Collaboration**: Utilizes WebSockets for live updates.
- **Role-Based Access Control (RBAC)**: Defines Global Admin, Company Admin, Facilitator, and User roles.
- **Authentication**: Includes both local authentication (email verification, secure password reset) and OAuth 2.1 SSO integration with Orion identity provider.
- **OAuth Integration**: Full OAuth 2.1 PKCE-enabled Single Sign-On with configurable killswitch:
  - System-wide and organization-level settings table for configuration
  - OAuth can be enabled/disabled via `oauth_enabled` setting in systemSettings table
  - Defaults to enabled if Orion credentials (ORION_CLIENT_ID, ORION_CLIENT_SECRET, ORION_ISSUER_URL) are configured
  - Supports both local and federated authentication simultaneously
  - User schema supports both auth providers with seamless migration from local to OAuth
  - Role mapping from Orion to Nebula roles (nebula.global_admin → global_admin, etc.)
- **AI Integration**: Leverages OpenAI API for note categorization, card rewrites, and AI usage tracking.
- **Voting Mechanisms**: Implements Pairwise Voting (round-robin) and Stack Ranking (Borda Count) with real-time leaderboards.
- **Guest Access Control**: Manages workspace access with configurable permissions, access requests, and email notifications.
- **Email Notification System** (Nov 2025): Comprehensive SendGrid-powered email notifications via Replit connector integration:
  - **Session Invites**: Single and bulk invitation emails with session details and join links
  - **Phase Change Notifications**: Automated alerts when facilitators move sessions between phases
  - **Results Ready Notifications**: Notify participants when personalized/cohort results are available
  - **Workspace Reminders**: Deadline approaching, incomplete submission, and session starting alerts
  - **API Endpoints**: `/api/spaces/:spaceId/notifications/invite`, `/invite-bulk`, `/phase-change`, `/results-ready`
  - **Branded Templates**: All emails use Nebula/Synozur branding with purple gradient headers
- **Facilitator Controls**: Tools for managing notes (CRUD, merge, bulk select, AI rewrites), session states, and AI categorization.
- **Share Links & QR Codes**: Facilitators can generate shareable URLs and client-side QR codes.
- **Workspace Access Controls**: Enforces status-based and guest permission-based access restrictions.
- **Unified Category Management**: A single system for AI and human categorization, allowing facilitator overrides and real-time updates.
- **Knowledge Base System**: A three-tiered document management system (System, Organization, Workspace scopes) for grounding AI, supporting multiple file types, secure storage, and RBAC.
- **Marketplace Allocation**: A coin-based voting system with real-time budget display.
- **Export System**: Facilitators and admins can export categorized data from all voting modules for GenAI analytics.
- **Consolidated Data Export/Import**: Unified CSV export/import for ideas and categories.
- **Results Generation**: AI-powered generation of cohort summaries and personalized participant results.
- **Branded PDF Export**: Client-side PDF generation for cohort and personalized results with organization branding.
- **Facilitator Dashboard**: Central dashboard for managing accessible workspaces.
- **Admin Panel UI**: Comprehensive CRUD operations for organizations and workspaces.
- **Workspace Template System**: Snapshot-based template architecture for system and organization-scoped templates.
- **2x2 Priority Matrix Module**: Collaborative drag-and-drop grid for positioning ideas along configurable axes (e.g., Impact vs. Effort), with real-time WebSocket updates for multi-user collaboration and facilitator-controlled participant navigation.
- **Staircase Module**: Diagonal rating grid (0-10 scale) for visual assessment of ideas with drag-and-drop positioning, SVG-based visualization, configurable labels, real-time WebSocket synchronization, optional score distribution histogram, and facilitator-controlled participant navigation.
- **Survey Module**: Customizable 1-5 scale rating system for evaluating ideas across multiple questions.
- **Collaborative Module Navigation**: Facilitators can send participants to specific modules (Priority Matrix, Staircase, Survey, Voting, Ranking, Marketplace, Ideation, Results) via "Bring Participants Here" buttons with real-time WebSocket broadcasts and toast notifications.
- **Dynamic Facilitator Tab Ordering** (Nov 2025): Map-based tab rendering system that synchronizes facilitator workspace tabs with workspace_modules configuration. Tab sequence: Modules → Ideas Hub → Knowledge Base → Participants → [Enabled modules sorted by orderIndex] → Results. Implementation uses helper render functions (renderModulesTab, renderIdeasTab, etc.) mapped via tabContentByValue Record to ensure tab triggers and content stay perfectly aligned. Module type mapping: pairwise-voting→voting, stack-ranking→ranking, priority-matrix→priority-matrix, staircase→staircase, survey→survey, marketplace→marketplace. Adding new module types requires updates to both facilitatorTabs builder (FacilitatorWorkspace.tsx lines 457-514) and tabContentByValue map (lines 1992-2004).

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

## Test Accounts (Development Environment)

### Password for all test accounts: `TestPass123!`

### Organizations and Users

#### Cascadia Oceanic
- **Organization**: Cascadia Oceanic (ID: bdc84450-e2a4-4a5d-8771-ef538ee412aa)
- **Workspace**: Cascadia Vision 2030 (Code: `12345678`)
- **Admin**: admin@cascadia.test / TestPass123!
- **Facilitator**: facilitator@cascadia.test / TestPass123!

#### Contoso
- **Organization**: Contoso (ID: a4208ed6-d134-463a-b9e3-a51b574accbb)
- **Workspace**: Contoso Innovation Lab (Code: `87654321`)
- **Admin**: admin@contoso.test / TestPass123!
- **Facilitator**: facilitator@contoso.test / TestPass123!

#### Fabrikam
- **Organization**: Fabrikam (ID: 288e53de-94a1-4c92-960b-1de7591cbe27)
- **Workspace**: Fabrikam Future Factory (Code: `11223344`)
- **Admin**: admin@fabrikam.test / TestPass123!
- **Facilitator**: facilitator@fabrikam.test / TestPass123!

#### Global Admin
- **Email**: admin@nebula.test
- **Password**: TestPass123!
- **Role**: Global Admin (no organization)

### Test Data Setup
- Each workspace has 5 preloaded test ideas
- Modules enabled: Ideation, Priority Matrix, Pairwise Voting, Marketplace
- All workspaces are in 'ideation' status
- Guest access is enabled for all test workspaces