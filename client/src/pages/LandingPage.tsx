import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowRight, Users, Sparkles, TrendingUp, Hash } from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";
import { ThemeToggle } from "@/components/ThemeToggle";
import { UserProfileMenu } from "@/components/UserProfileMenu";
import { useAuth } from "@/hooks/use-auth";
import nebulaBg from "@assets/AdobeStock_245281455_Smaller_1761866686758.jpg";

export default function LandingPage() {
  const { isAuthenticated } = useAuth();
  const [workspaceCode, setWorkspaceCode] = useState("");
  const [, setLocation] = useLocation();
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleCodeEntry = async () => {
    if (!workspaceCode || workspaceCode.length !== 9) {
      setError("Please enter a valid 8-digit workspace code");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const response = await fetch(`/api/spaces/lookup/${workspaceCode}`);
      
      if (response.ok) {
        const { space, organization } = await response.json();
        // Redirect to waiting room using organization slug and space ID (spaces don't have slugs)
        setLocation(`/o/${organization.slug}/s/${space.id}`);
      } else {
        setError("Workspace not found. Please check your code and try again.");
      }
    } catch (err) {
      setError("Unable to connect. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Remove all non-digits and limit to 8 digits
    const digits = e.target.value.replace(/\D/g, "").slice(0, 8);
    
    // Format as nnnn-nnnn
    let formatted = digits;
    if (digits.length > 4) {
      formatted = `${digits.slice(0, 4)}-${digits.slice(4)}`;
    }
    
    setWorkspaceCode(formatted);
    setError("");
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto flex h-16 items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <img 
              src="/logos/synozur-horizontal-color.png" 
              alt="Synozur Alliance" 
              className="h-8"
              data-testid="img-logo"
            />
            <div className="h-6 w-px bg-border/40" data-testid="divider-separator" />
            <span className="text-lg font-semibold bg-gradient-to-r from-primary to-purple-500 bg-clip-text text-transparent" data-testid="text-app-name">
              Nebula
            </span>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            {isAuthenticated ? (
              <UserProfileMenu />
            ) : (
              <Button 
                variant="outline" 
                data-testid="button-admin-login"
                onClick={() => setLocation("/login")}
              >
                Admin Login
              </Button>
            )}
          </div>
        </div>
      </header>

      <main>
        {/* Hero Section with Background Image */}
        <section 
          className="relative overflow-hidden px-6 py-24 md:py-32 lg:py-40"
          style={{
            backgroundImage: `url(${nebulaBg})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat'
          }}
        >
          {/* Dark overlay for readability */}
          <div className="absolute inset-0 bg-gradient-to-br from-black/80 via-black/70 to-purple-900/50" />
          
          <div className="container relative mx-auto z-10">
            <div className="mx-auto max-w-4xl text-center">
              <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl lg:text-7xl">
                <span className="bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                  Collaborative Envisioning Platform
                </span>
              </h1>
              <p className="mt-6 text-lg leading-relaxed text-gray-200 md:text-xl lg:text-2xl">
                Guide cohorts through structured activities to envision the future,
                prioritize initiatives, and generate actionable insights powered by AI.
              </p>

              <div className="mt-8 text-sm text-white italic">
                Nebula's in beta;{" "}
                <a 
                  href="https://www.synozur.com/join" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-primary hover:text-primary/80 underline underline-offset-2 transition-colors"
                  data-testid="link-signup"
                >
                  signup
                </a>{" "}
                for news and updates.
              </div>

              <Card className="mx-auto mt-12 max-w-md shadow-2xl border-purple-500/20">
                <CardHeader className="bg-gradient-to-br from-card to-purple-950/20">
                  <div className="flex items-center justify-center gap-2">
                    <Hash className="h-5 w-5 text-primary" />
                    <h2 className="text-xl font-semibold text-foreground">Enter Workspace Code</h2>
                  </div>
                  <p className="text-sm text-muted-foreground text-center mt-2">
                    Your facilitator will provide an 8-digit code
                  </p>
                </CardHeader>
                <CardContent className="bg-card/95 backdrop-blur">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="workspace-code" className="text-center block">8-Digit Code</Label>
                      <Input
                        id="workspace-code"
                        placeholder="0000-0000"
                        value={workspaceCode}
                        onChange={handleCodeChange}
                        onKeyDown={(e) => e.key === "Enter" && handleCodeEntry()}
                        data-testid="input-workspace-code"
                        className="bg-input/80 text-center text-2xl font-mono tracking-widest"
                        maxLength={9}
                        autoComplete="off"
                      />
                      {error && (
                        <p className="text-sm text-destructive text-center" data-testid="text-error">{error}</p>
                      )}
                    </div>
                    <Button 
                      className="w-full bg-primary hover:bg-primary/90" 
                      disabled={workspaceCode.length !== 9 || isLoading}
                      data-testid="button-join-workspace"
                      onClick={handleCodeEntry}
                    >
                      {isLoading ? "Joining..." : "Join Workspace"}
                      {!isLoading && <ArrowRight className="ml-2 h-4 w-4" />}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <div className="mt-8 text-sm text-gray-300">
                <p>
                  Facilitators and admins:{" "}
                  <button 
                    onClick={() => setLocation("/login")}
                    className="text-primary hover:text-primary/80 underline underline-offset-2 transition-colors"
                    data-testid="link-facilitator-login"
                  >
                    Sign in here
                  </button>
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="container mx-auto px-6 py-16 md:py-24">
          <div className="mx-auto max-w-5xl">
            <h2 className="mb-12 text-center text-2xl font-semibold md:text-3xl">
              Transform How Your Organization Envisions the Future
            </h2>
            <div className="grid gap-8 md:grid-cols-3">
              <div className="text-center group">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-lg bg-gradient-to-br from-primary/20 to-purple-600/10 group-hover:from-primary/30 group-hover:to-purple-600/20 transition-all">
                  <Users className="h-8 w-8 text-primary" />
                </div>
                <h3 className="mt-4 font-semibold text-lg">Real-Time Collaboration</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Live whiteboard with instant synchronization across all participants
                </p>
              </div>
              <div className="text-center group">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-lg bg-gradient-to-br from-primary/20 to-purple-600/10 group-hover:from-primary/30 group-hover:to-purple-600/20 transition-all">
                  <Sparkles className="h-8 w-8 text-primary" />
                </div>
                <h3 className="mt-4 font-semibold text-lg">AI-Powered Insights</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Automatic categorization and personalized recommendations
                </p>
              </div>
              <div className="text-center group">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-lg bg-gradient-to-br from-primary/20 to-purple-600/10 group-hover:from-primary/30 group-hover:to-purple-600/20 transition-all">
                  <TrendingUp className="h-8 w-8 text-primary" />
                </div>
                <h3 className="mt-4 font-semibold text-lg">Structured Prioritization</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Pairwise voting and ranking to reveal cohort consensus
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Call to Action Section */}
        <section className="bg-gradient-to-br from-primary/10 via-purple-600/5 to-background px-6 py-16 md:py-20">
          <div className="container mx-auto text-center">
            <h2 className="text-3xl font-bold md:text-4xl">
              Ready to Transform Your Envisioning Process?
            </h2>
            <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
              Join leading organizations that are using Nebula to accelerate their transformation journey and unlock collective intelligence.
            </p>
            <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:justify-center">
              <Button 
                size="lg" 
                className="bg-primary hover:bg-primary/90 text-lg px-8"
                onClick={() => document.getElementById('workspace-code')?.focus()}
                data-testid="button-start-session"
              >
                Start Your Session
              </Button>
              <Button 
                size="lg" 
                variant="outline" 
                className="text-lg px-8 border-primary/30 hover:border-primary/50"
                onClick={() => window.open('https://www.synozur.com', '_blank')}
                data-testid="button-visit-synozur"
              >
                Visit Synozur.com
              </Button>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t bg-card">
        <div className="container mx-auto px-6 py-12">
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
            <div>
              <img 
                src="/logos/synozur-horizontal-color.png" 
                alt="Synozur" 
                className="h-8 mb-4"
              />
              <p className="text-sm text-muted-foreground">
                Empowering organizations through collaborative envisioning and AI-powered insights.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Platform</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-primary transition-colors">How It Works</a></li>
                <li><a href="#" className="hover:text-primary transition-colors">Features</a></li>
                <li><a href="#" className="hover:text-primary transition-colors">Pricing</a></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Resources</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-primary transition-colors">Documentation</a></li>
                <li><a href="#" className="hover:text-primary transition-colors">Support</a></li>
                <li><a href="#" className="hover:text-primary transition-colors">API</a></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Company</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="https://www.synozur.com/about" target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors">About Synozur</a></li>
                <li><a href="https://www.synozur.com/contact" target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors">Contact</a></li>
                <li><a href="https://www.synozur.com/privacy" target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors">Privacy</a></li>
              </ul>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t text-center text-sm text-muted-foreground">
            <p>© {new Date().getFullYear()} Synozur. All rights reserved. Beta version - features subject to change.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
