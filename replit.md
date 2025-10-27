# Aurora - Multi-Tenant Collaborative Envisioning Platform

## Overview
Aurora is a web application facilitating structured collaborative envisioning sessions for cohorts. It enables facilitators to guide participants through real-time ideation, AI-powered categorization, pairwise voting, and stack ranking, culminating in personalized results. The platform provides a multi-tenant environment for organizations to conduct envisioning workshops.

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
Aurora is a multi-tenant web application with a clear separation of concerns between frontend and backend.

### UI/UX Decisions
The design system features a dark mode with a primary purple accent, dark blue-black backgrounds, and the Avenir Next LT Pro custom font. Branding includes Synozur logos and a favicon. The participant ideation view uses a white canvas with colorful sticky notes, while the landing page incorporates an AI network background and gradient text. General styling uses gradient text effects and automatic elevation on hover states.

### Technical Implementations
- **Multi-Tenancy**: Supports organization isolation and custom branding via `/o/:org/s/:space` URL structure.
- **Real-time Collaboration**: Utilizes WebSockets for live updates of notes and participant presence.
- **Role-Based Access Control (RBAC)**: Defines Global Admin, Company Admin, Facilitator, and User roles with specific permissions, managed via `bcrypt`, `passport.js`, and `express-session`.
- **Authentication Enhancements**: Includes email verification with SendGrid, secure password reset flows, and password visibility toggles.
- **AI Integration**: Leverages OpenAI API (GPT-5) for production-ready note categorization with Zod validation and real-time WebSocket broadcasts, card rewrites (generating AI variations), and comprehensive AI usage tracking with cost monitoring and analytics.
- **Pairwise Voting**: Implements a round-robin algorithm for deterministic pair generation and leaderboard display.
- **Stack Ranking (Borda Count)**: Features a drag-and-drop interface for ranking, Borda count algorithm for scoring, real-time leaderboard, and facilitator progress tracking.
- **Guest Access Control System**: Manages workspace access with configurable guest permissions, access request workflow, SendGrid email notifications, and automatic participant-to-account linking.
- **Facilitator Controls**: Provides tools for managing notes (preload, add, edit, delete, merge, bulk select, AI rewrites), controlling session states, and triggering AI categorization.
- **Participant Editing Permissions**: Allows participants to edit and delete their own cards when the workspace is "open".
- **Knowledge Base System**: A three-tiered document management system (System, Organization, Workspace scopes) for grounding AI categorization, supporting PDF/TXT/DOC/DOCX/XLS/XLSX files with secure local storage and RBAC.
- **Marketplace Allocation Module**: A coin-based voting system where participants distribute a finite budget among ideas, with real-time budget display, secure submission API, and export functionality.
- **Export System**: Facilitators and admins can export categorized snapshots of all voting modules (Pairwise, Stack Ranking, Marketplace Allocation) into text files optimized for GenAI analytics.
- **Results Generation System**: An AI-powered system using GPT-4o and knowledge base integration to generate cohort summaries and personalized participant results with alignment scores and recommendations.
- **Facilitator Dashboard**: A central dashboard displaying all accessible workspaces with quick actions and RBAC for viewing permissions.
- **Admin Panel UI**: Complete admin interface with functional create dialogs for organizations and workspaces, Users tab for global admins to view all platform users with role badges and verification status.

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
- **State Management/Data Fetching**: TanStack Query
- **Styling**: Tailwind CSS, Shadcn UI
- **WebSocket**: `ws` library