# Nebula - Multi-Tenant Collaborative Envisioning Platform

## Overview
Nebula is a web application facilitating structured collaborative envisioning sessions for cohorts. It enables facilitators to guide participants through real-time ideation, AI-powered categorization, pairwise voting, and stack ranking, culminating in personalized results. The platform provides a multi-tenant environment for organizations to conduct envisioning workshops.

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
The design system features a dark mode with a primary purple accent, dark blue-black backgrounds, and the Avenir Next LT Pro custom font. Branding includes Synozur logos and a favicon. The participant ideation view uses a white canvas with colorful sticky notes, while the landing page incorporates an AI network background and gradient text. General styling uses gradient text effects and automatic elevation on hover states.

**Navigation**: Consistent sticky header across pages with Synozur logo (links to home), Nebula branding, theme toggle, and user profile menu. The UserProfileMenu provides access to Dashboard, Admin Panel (for admins/facilitators), and logout. Direct navigation to `/dashboard` is available from anywhere.

**Organization Branding**: All participant-facing screens (ParticipantView, PairwiseVoting, StackRanking, Marketplace) and the facilitator workspace display the organization logo and name in the header. Headers show: [Org Logo] | [Org Name] | Nebula, with fallback to Synozur default logo when no custom logo is configured.

### Technical Implementations
- **Multi-Tenancy**: Supports organization isolation and custom branding via `/o/:org/s/:space` URL structure.
- **Real-time Collaboration**: Utilizes WebSockets for live updates of notes and participant presence.
- **Role-Based Access Control (RBAC)**: Defines Global Admin, Company Admin, Facilitator, and User roles with specific permissions, managed via `bcrypt`, `passport.js`, and `express-session`.
- **Authentication Enhancements**: Includes email verification with SendGrid, secure password reset flows, and password visibility toggles.
- **AI Integration**: Leverages OpenAI API (GPT-5) for production-ready note categorization with Zod validation and real-time WebSocket broadcasts, card rewrites (generating AI variations), and comprehensive AI usage tracking with cost monitoring and analytics.
- **Pairwise Voting**: Implements a round-robin algorithm for deterministic pair generation and leaderboard display.
- **Stack Ranking (Borda Count)**: Features a drag-and-drop interface for ranking, Borda count algorithm for scoring, real-time leaderboard, and facilitator progress tracking.
- **Guest Access Control System**: Manages workspace access with configurable guest permissions, access request workflow, SendGrid email notifications, and automatic participant-to-account linking.
- **Facilitator Controls**: Provides tools for managing notes (preload, add, edit with dialog, delete, merge, bulk select, AI-powered rewrites), controlling session states, and triggering AI categorization.
- **Share Links & QR Codes**: Facilitators can generate shareable URLs and QR codes for direct navigation to any workspace section (Waiting Room, Ideation, Pairwise Voting, Stack Ranking, Marketplace Allocation, Results). URLs automatically adapt to the current server environment using `window.location.origin`, ensuring production-ready links. QR codes are generated client-side using the `qrcode` package at 300x300px resolution and can be downloaded as PNG files with descriptive filenames (format: `Nebula_{spaceCode}_{sectionName}_QR.png`). Includes copy-to-clipboard functionality with toast notifications for enhanced UX.
- **Unified Category Management**: A single category system where both AI and humans use the same infrastructure. Facilitators can create categories manually or let AI generate them. Human decisions always take precedence - once a facilitator manually assigns a category (via dropdown on note cards), the `isManualOverride` flag is set, preventing AI from ever re-categorizing that note. AI categorization only processes uncategorized notes, matches to existing categories (case-insensitive), or creates new categories as needed. All categories use the same FK relationship (`manualCategoryId`) ensuring referential integrity. WebSocket broadcasts ensure real-time updates across clients.
- **Participant Editing Permissions**: Allows participants to edit and delete their own cards when the workspace is "open".
- **Knowledge Base System**: A three-tiered document management system (System, Organization, Workspace scopes) for grounding AI categorization, supporting PDF/TXT/DOC/DOCX/XLS/XLSX files with secure local storage and RBAC. Documents can be shared across workspaces using the `multi_workspace` scope with `document_workspace_access` junction table. When a workspace is marked as a template, its documents are automatically converted to multi_workspace scope, allowing workspaces created from that template to reference the same documents (not copies), preventing duplication and ensuring consistency.
- **Marketplace Allocation Module**: A coin-based voting system where participants distribute a finite budget among ideas, with real-time budget display, secure submission API, and export functionality.
- **Export System**: Facilitators and admins can export categorized snapshots of all voting modules (Pairwise, Stack Ranking, Marketplace Allocation) into text files optimized for GenAI analytics.
- **Consolidated Data Export/Import**: Single unified CSV export/import system replacing 4 separate buttons. Exports ideas with categories in combined format (Idea, Category, Participant, Created At) where category is repeated for each idea. Import automatically creates missing categories and accepts flexible CSV formats - only "Idea" field is required, "Category" is optional, and "Participant"/"Created At" fields are optional/ignored (all imported ideas are assigned to "CSV Import" participant with current timestamp). Accessible via "Export/Import Data" button in facilitator workspace with tabbed dialog interface (Export/Import tabs).
- **Results Generation System**: An AI-powered system using GPT-4o and knowledge base integration to generate cohort summaries and personalized participant results with alignment scores and recommendations.
- **Branded PDF Export**: Client-side PDF generation using jsPDF for cohort and personalized results with organization branding (logo, primary color, name). PDFs use Avenir Next LT Pro fonts (matching web application typography) loaded dynamically from `/fonts/` directory. Includes cohort summaries with key themes, top ideas table, insights, and recommendations, as well as personalized results with alignment scores, top contributions, and participant-specific insights.
- **Facilitator Dashboard**: A central dashboard displaying all accessible workspaces with quick actions and RBAC for viewing permissions.
- **Admin Panel UI**: Complete admin interface with full CRUD operations:
  - Create organizations and workspaces via dialog forms
  - **Workspace Template System**: Snapshot-based template architecture where workspaces can be saved as frozen templates with two scopes:
    - **System Templates** (global admins only): Available to all organizations for deploying standardized workspace configurations
    - **Organization Templates** (global/company admins): Scoped to specific organizations for internal reuse
    - **Snapshot Behavior**: When "Save as Template" is clicked, the system creates a **frozen snapshot copy** of the workspace with a timestamp in the name. The original workspace remains fully editable and unchanged. Future modifications to the original do NOT affect the template snapshot.
    - Templates tab displays all template snapshots grouped by scope with metadata (notes count, categories, workspace code)
    - Save as template creates a separate frozen copy via "Save as Template" button with scope selection dialog
    - Template snapshots are hidden and archived to prevent accidental modification
    - Create Workspace dialog shows filtered templates (system + org-specific) with scope indicators
    - Template cloning copies notes (with category mappings) and categories to new workspaces with "Template" participant attribution. Knowledge base documents are **referenced** (not copied) using multi_workspace scope, ensuring all workspaces created from a template share the same documents
    - RBAC enforced at storage layer with proper cache scoping per organization to prevent cross-tenant data exposure
  - Edit organizations (name, slug, logo, color) and workspaces (name, purpose, guest access)
  - Delete organizations (with workspace validation) and workspaces
  - Archive/unarchive workspaces (toggle hidden status)
  - Configure guest access via checkbox in create/edit workspace dialogs
  - Users tab for global admins to view all platform users with role badges and verification status

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

**See**: Full specification in previous agent context or request detailed spec