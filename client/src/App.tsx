import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/ThemeProvider";
import { SkipToContent } from "@/components/SkipToContent";
import { LiveAnnouncerProvider } from "@/components/LiveAnnouncer";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useRouteFocus } from "@/hooks/useRouteFocus";
import { ComponentType } from "react";
import type { RouteComponentProps } from "wouter";
import NotFound from "@/pages/not-found";

import LandingPage from "@/pages/LandingPage";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import ForgotPassword from "@/pages/ForgotPassword";
import ResetPassword from "@/pages/ResetPassword";
import VerifyEmail from "@/pages/VerifyEmail";
import AdminPanel from "@/pages/AdminPanel";
import AdminMigrations from "@/pages/AdminMigrations";
import FacilitatorDashboard from "@/pages/FacilitatorDashboard";
import OrganizationHome from "@/pages/OrganizationHome";
import WaitingRoom from "@/pages/WaitingRoom";
import ParticipantView from "@/pages/ParticipantView";
import FacilitatorWorkspace from "@/pages/FacilitatorWorkspace";
import PairwiseVoting from "@/pages/PairwiseVoting";
import StackRanking from "@/pages/StackRanking";
import Marketplace from "@/pages/Marketplace";
import Survey from "@/pages/Survey";
import JoinPage from "@/pages/JoinPage";
import Results from "@/pages/Results";
import PublicResults from "@/pages/PublicResults";
import PriorityMatrixParticipant from "@/pages/PriorityMatrixParticipant";
import StaircaseParticipant from "@/pages/StaircaseParticipant";
import MyProjects from "@/pages/MyProjects";

import LandingPageExample from "@/components/examples/LandingPage";
import OrganizationHomeExample from "@/components/examples/OrganizationHome";
import FacilitatorWorkspaceExample from "@/components/examples/FacilitatorWorkspace";
import BrandHeaderExample from "@/components/examples/BrandHeader";
import StickyNoteExample from "@/components/examples/StickyNote";
import ZoneExample from "@/components/examples/Zone";
import DuelCardExample from "@/components/examples/DuelCard";
import RankListExample from "@/components/examples/RankList";
import TimerBarExample from "@/components/examples/TimerBar";
import ParticipantListExample from "@/components/examples/ParticipantList";
import CategoryPillExample from "@/components/examples/CategoryPill";
import StatusBadgeExample from "@/components/examples/StatusBadge";
import SpaceCardExample from "@/components/examples/SpaceCard";
import WaitingRoomExample from "@/components/examples/WaitingRoom";
import FacilitatorConsoleExample from "@/components/examples/FacilitatorConsole";
import ResultsTabsExample from "@/components/examples/ResultsTabs";
import ReadoutViewerExample from "@/components/examples/ReadoutViewer";

// Wouter's <Route component={...}> expects ComponentType<RouteComponentProps<any>>,
// so the boundary HOC must return that exact shape. We accept any inbound
// component (page components have varying prop signatures, including no props)
// and forward the route props through unchanged.
function withBoundary(
  Component: ComponentType<RouteComponentProps<any>> | ComponentType<Record<string, never>>,
  scope: string,
): ComponentType<RouteComponentProps<any>> {
  const Inner = Component as ComponentType<RouteComponentProps<any>>;
  const Wrapped: ComponentType<RouteComponentProps<any>> = (props) => (
    <ErrorBoundary scope={scope}>
      <Inner {...props} />
    </ErrorBoundary>
  );
  Wrapped.displayName = `WithBoundary(${scope})`;
  return Wrapped;
}

const AdminPanelBoundary = withBoundary(AdminPanel, "admin-panel");
const AdminMigrationsBoundary = withBoundary(AdminMigrations, "admin-migrations");
const FacilitatorDashboardBoundary = withBoundary(FacilitatorDashboard, "facilitator-dashboard");
const MyProjectsBoundary = withBoundary(MyProjects, "my-projects");
const OrganizationHomeBoundary = withBoundary(OrganizationHome, "organization-home");
const WaitingRoomBoundary = withBoundary(WaitingRoom, "waiting-room");
const ParticipantViewBoundary = withBoundary(ParticipantView, "participant-view");
const PairwiseVotingBoundary = withBoundary(PairwiseVoting, "pairwise-voting");
const StackRankingBoundary = withBoundary(StackRanking, "stack-ranking");
const MarketplaceBoundary = withBoundary(Marketplace, "marketplace");
const SurveyBoundary = withBoundary(Survey, "survey");
const PriorityMatrixBoundary = withBoundary(PriorityMatrixParticipant, "priority-matrix");
const StaircaseBoundary = withBoundary(StaircaseParticipant, "staircase");
const ResultsBoundary = withBoundary(Results, "results");
const PublicResultsBoundary = withBoundary(PublicResults, "public-results");
const FacilitatorWorkspaceBoundary = withBoundary(FacilitatorWorkspace, "facilitator-workspace");

function Router() {
  useRouteFocus("main-content");
  return (
    <Switch>
      <Route path="/" component={LandingPage} />
      <Route path="/join/:code" component={JoinPage} />
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      <Route path="/forgot-password" component={ForgotPassword} />
      <Route path="/reset-password" component={ResetPassword} />
      <Route path="/verify-email" component={VerifyEmail} />
      <Route path="/admin" component={AdminPanelBoundary} />
      <Route path="/admin/migrations" component={AdminMigrationsBoundary} />
      <Route path="/dashboard" component={FacilitatorDashboardBoundary} />
      <Route path="/projects" component={MyProjectsBoundary} />
      <Route path="/o/:org" component={OrganizationHomeBoundary} />
      <Route path="/o/:org/s/:space" component={WaitingRoomBoundary} />
      <Route path="/o/:org/s/:space/participate" component={ParticipantViewBoundary} />
      <Route path="/o/:org/s/:space/vote" component={PairwiseVotingBoundary} />
      <Route path="/o/:org/s/:space/rank" component={StackRankingBoundary} />
      <Route path="/o/:org/s/:space/marketplace" component={MarketplaceBoundary} />
      <Route path="/o/:org/s/:space/survey" component={SurveyBoundary} />
      <Route path="/o/:org/s/:space/priority-matrix" component={PriorityMatrixBoundary} />
      <Route path="/o/:org/s/:space/staircase" component={StaircaseBoundary} />
      <Route path="/o/:org/s/:space/results" component={ResultsBoundary} />
      <Route path="/o/:org/s/:space/public-results" component={PublicResultsBoundary} />
      <Route path="/o/:org/s/:space/facilitate" component={FacilitatorWorkspaceBoundary} />
      
      <Route path="/showcase" component={ComponentShowcase} />
      <Route path="/examples/landing" component={LandingPageExample} />
      <Route path="/examples/organization-home" component={OrganizationHomeExample} />
      <Route path="/facilitator-workspace" component={FacilitatorWorkspaceExample} />
      <Route path="/brand-header" component={BrandHeaderExample} />
      <Route path="/sticky-note" component={StickyNoteExample} />
      <Route path="/zone" component={ZoneExample} />
      <Route path="/duel-card" component={DuelCardExample} />
      <Route path="/rank-list" component={RankListExample} />
      <Route path="/timer-bar" component={TimerBarExample} />
      <Route path="/participant-list" component={ParticipantListExample} />
      <Route path="/category-pill" component={CategoryPillExample} />
      <Route path="/status-badge" component={StatusBadgeExample} />
      <Route path="/space-card" component={SpaceCardExample} />
      <Route path="/waiting-room" component={WaitingRoomExample} />
      <Route path="/facilitator-console" component={FacilitatorConsoleExample} />
      <Route path="/results-tabs" component={ResultsTabsExample} />
      <Route path="/readout-viewer" component={ReadoutViewerExample} />
      <Route component={NotFound} />
    </Switch>
  );
}

function ComponentShowcase() {
  const components = [
    { name: "Landing Page", path: "/" },
    { name: "Organization Home", path: "/organization-home" },
    { name: "Waiting Room", path: "/waiting-room" },
    { name: "Facilitator Workspace", path: "/facilitator-workspace" },
    { name: "Facilitator Console", path: "/facilitator-console" },
    { name: "Results Tabs", path: "/results-tabs" },
    { name: "Readout Viewer", path: "/readout-viewer" },
    { name: "Brand Header", path: "/brand-header" },
    { name: "Sticky Note", path: "/sticky-note" },
    { name: "Zone", path: "/zone" },
    { name: "Duel Card", path: "/duel-card" },
    { name: "Rank List", path: "/rank-list" },
    { name: "Timer Bar", path: "/timer-bar" },
    { name: "Participant List", path: "/participant-list" },
    { name: "Category Pill", path: "/category-pill" },
    { name: "Status Badge", path: "/status-badge" },
    { name: "Space Card", path: "/space-card" },
  ];

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur">
        <div className="container mx-auto px-6 py-4">
          <h1 className="text-2xl font-semibold tracking-tight">
            Nebula Component Library
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Multi-Tenant Envisioning Platform
          </p>
        </div>
      </header>

      <main id="main-content" tabIndex={-1} className="container mx-auto px-6 py-12 focus:outline-none">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {components.map((component) => (
            <a
              key={component.path}
              href={component.path}
              className="group rounded-lg border p-6 transition-all hover-elevate"
              data-testid={`link-${component.path.slice(1)}`}
            >
              <h2 className="text-lg font-semibold">{component.name}</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                View component →
              </p>
            </a>
          ))}
        </div>

        <div className="mt-12 rounded-lg border p-8 text-center">
          <h2 className="text-xl font-semibold">Nebula Platform Features</h2>
          <div className="mt-6 grid gap-6 text-left sm:grid-cols-2">
            <div>
              <h3 className="font-semibold">Multi-Tenant Architecture</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Organization isolation with custom branding
              </p>
            </div>
            <div>
              <h3 className="font-semibold">Real-Time Collaboration</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Live whiteboard with WebSocket sync
              </p>
            </div>
            <div>
              <h3 className="font-semibold">AI-Powered Categorization</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Automatic note classification using OpenAI
              </p>
            </div>
            <div>
              <h3 className="font-semibold">Pairwise Voting & Ranking</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Structured decision-making workflows
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary scope="root">
      <QueryClientProvider client={queryClient}>
        <ThemeProvider defaultTheme="dark" storageKey="aurora-theme">
          <TooltipProvider>
            <LiveAnnouncerProvider>
              <SkipToContent targetId="main-content" />
              <Toaster />
              <Router />
            </LiveAnnouncerProvider>
          </TooltipProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
