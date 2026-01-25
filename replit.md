# Nebula - Multi-Tenant Collaborative Envisioning Platform

## Related Projects
- **Vega**: Business strategy management application.
  - Repository: https://github.com/chris-mcnulty/synozur-vega
  - Features: Multi-tenant, Entra SSO integration.
  - Status: Active project on Replit.

## Backlog
- [ ] Implement robust session handling from Vega to improve session persistence in Nebula.
- [ ] Increase font size for 8-digit codes in Facilitator Dashboard (My Workspaces) - Completed
- [ ] Increase font size for 8-digit codes in Share Links Dialog - Completed
- [ ] Increase font size for 8-digit codes on Home Screen (Landing Page) - Completed

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