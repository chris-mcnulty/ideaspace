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
- **Authentication**: Includes email verification, secure password reset.
- **AI Integration**: Leverages OpenAI API for note categorization, card rewrites, and AI usage tracking.
- **Voting Mechanisms**: Implements Pairwise Voting (round-robin) and Stack Ranking (Borda Count) with real-time leaderboards.
- **Guest Access Control**: Manages workspace access with configurable permissions, access requests, and email notifications.
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
- **2x2 Priority Matrix Module**: Collaborative drag-and-drop grid for positioning ideas along configurable axes (e.g., Impact vs. Effort), with real-time WebSocket updates for multi-user collaboration.
- **Survey Module**: Customizable 1-5 scale rating system for evaluating ideas across multiple questions.

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