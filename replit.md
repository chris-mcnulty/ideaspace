# Nebula - Multi-Tenant Collaborative Envisioning Platform

## Overview
Nebula is a multi-tenant web application designed for structured collaborative envisioning sessions. It empowers facilitators to guide cohorts through real-time ideation, AI-powered categorization, voting, and ranking, culminating in personalized results. The platform's core purpose is to provide organizations with a robust environment for conducting effective envisioning workshops, fostering innovation, and streamlining strategic planning.

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