import { useEffect } from "react";
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";

import LandingPage from "@/pages/LandingPage";
import Login from "@/pages/Login";
import AdminPanel from "@/pages/AdminPanel";
import OrganizationHome from "@/pages/OrganizationHome";
import WaitingRoom from "@/pages/WaitingRoom";
import ParticipantView from "@/pages/ParticipantView";
import FacilitatorWorkspace from "@/pages/FacilitatorWorkspace";
import PairwiseVoting from "@/pages/PairwiseVoting";
import StackRanking from "@/pages/StackRanking";
import JoinPage from "@/pages/JoinPage";

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

function Router() {
  return (
    <Switch>
      <Route path="/" component={LandingPage} />
      <Route path="/join/:code" component={JoinPage} />
      <Route path="/login" component={Login} />
      <Route path="/admin" component={AdminPanel} />
      <Route path="/o/:org" component={OrganizationHome} />
      <Route path="/o/:org/s/:space" component={WaitingRoom} />
      <Route path="/o/:org/s/:space/participate" component={ParticipantView} />
      <Route path="/o/:org/s/:space/vote" component={PairwiseVoting} />
      <Route path="/o/:org/s/:space/rank" component={StackRanking} />
      <Route path="/o/:org/s/:space/facilitate" component={FacilitatorWorkspace} />
      
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
            Aurora Component Library
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Multi-Tenant Envisioning Platform
          </p>
        </div>
      </header>

      <main className="container mx-auto px-6 py-12">
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
          <h2 className="text-xl font-semibold">Aurora Platform Features</h2>
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
  // Enable dark mode by default (matching Synozur design)
  useEffect(() => {
    document.documentElement.classList.add('dark');
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
