# Aurora - Multi-Tenant Collaborative Envisioning Platform

## Overview
Aurora is a sophisticated web application designed to facilitate structured collaborative envisioning sessions for cohorts. Its primary purpose is to enable facilitators to guide participants through various stages, including real-time ideation, AI-powered categorization, pairwise voting, and stack ranking, culminating in personalized results generation. The platform aims to provide a robust, multi-tenant environment for organizations to conduct envisioning workshops effectively.

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
Aurora is built as a multi-tenant web application with a clear separation of concerns between frontend and backend.

### UI/UX Decisions
- **Dark Mode Design System**: Based on Synozur reference, featuring a primary purple (`#810FFB`) accent, very dark blue-black backgrounds (`#0F1115`), and the **Avenir Next LT Pro** custom font.
- **Branding**: Integrates custom Avenir Next LT Pro fonts, Synozur logos (horizontal, vertical, mark in color & white), and a favicon using the Synozur mark. The "Aurora app name" is displayed with purple gradient styling.
- **Participant Ideation View**: Features a white whiteboard canvas with dark header/footer UI elements and colorful sticky notes (yellow/blue/green/pink).
- **Landing Page**: Enhanced with a Synozur Maturity Modeler design, including an AI network background, gradient text hero heading (blue → purple → pink), and purple gradient treatments on feature cards.
- **General Styling**: Gradient text effects for hero sections, automatic elevation on hover/active states, and a consistent Synozur logo | Aurora separator pattern.

### Technical Implementations
- **Multi-Tenancy**: Implemented with a URL structure of `/o/:org/s/:space`, allowing for organization isolation and custom branding support.
- **Real-time Collaboration**: Utilizes WebSocket connections (`/ws`) for live note creation, updates, deletion, and participant presence tracking, broadcasting updates to all connected clients.
- **Role-Based Access Control (RBAC)**: Defines four roles: Global Admin, Company Admin, Facilitator, and User, each with specific permissions and access scopes, managed through a robust authentication and authorization system using `bcrypt`, `passport.js`, and `express-session`.
- **AI Integration**: Leverages OpenAI API (GPT-5) via Replit AI Integrations for note categorization, including production-ready service with Zod validation, retry logic, and real-time WebSocket broadcasts for category updates.
- **Pairwise Voting**: Employs a round-robin algorithm for deterministic pair generation, tracking progress, and displaying results in a leaderboard.
- **Guest Access Control System**: Comprehensive workspace access management with configurable guest permissions (default: disabled). Features include:
  - Per-workspace guest access toggle (`guestAllowed` field, default: false)
  - Access request workflow for restricted workspaces (guest submits request → admin/facilitator approves)
  - SendGrid email notifications to admins when access is requested
  - Admin panel with dedicated Access Requests tab for reviewing and managing requests
  - Automatic participant-to-account linking (guests who later register/login have their participation history preserved)
  - Support for anonymous participation with random name generation (e.g., "Powerful Andromeda")
- **Facilitator Controls**: Provides a comprehensive workspace for facilitators to manage notes (preload, add, edit, delete, merge, bulk select), control session states, and trigger AI categorization.

### Feature Specifications
- **Completed Features**:
    - Database schema for multi-tenant architecture.
    - Backend API routes and WebSocket server.
    - Entry flow pages (Landing, Organization Home, Waiting Room, Participant View).
    - Guest name generation.
    - Comprehensive component library.
    - Hidden spaces functionality.
    - Facilitator Workspace with extensive note management, search, filter, session controls, and participant viewing.
    - Participant Ideation View with sticky note creation and real-time display.
    - Landing page with Synozur Maturity Modeler design.
    - AI Categorization integration using GPT-5.
    - Pairwise Voting Module with DuelCard component and progress tracking.
    - Role-Based Access Control (RBAC) system with 8-digit workspace codes (nnnn-nnnn format) and admin panel.
    - **Guest Access Control System** with access requests, admin approval workflow, SendGrid email notifications, and automatic participant-to-account linking.
- **In Progress**: Facilitator dashboard for assigned workspaces.
- **Pending**: Stack ranking module (Borda count) and results view (cohort/personalized summaries).

### System Design Choices
- **Frontend**: React, Wouter (routing), TanStack Query, Tailwind CSS, Shadcn UI.
- **Backend**: Express.js, WebSocket (`ws`).
- **Database**: PostgreSQL (Neon) with Drizzle ORM.

## External Dependencies
- **Database**: PostgreSQL (via Neon)
- **ORM**: Drizzle ORM
- **AI Services**: OpenAI API (for GPT-5 categorization and summaries)
- **Authentication**: `bcrypt` (for password hashing), `passport.js` (local strategy), `express-session`
- **Email Service**: SendGrid (for access request notifications and transactional emails)
- **Routing**: Wouter
- **State Management/Data Fetching**: TanStack Query
- **Styling**: Tailwind CSS, Shadcn UI
- **WebSocket**: `ws` library
- **Font Hosting**: Custom Avenir Next LT Pro fonts loaded from `/fonts/`