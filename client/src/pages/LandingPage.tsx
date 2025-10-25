import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Building2, ArrowRight, Users, Sparkles, TrendingUp } from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";

export default function LandingPage() {
  const [orgSearch, setOrgSearch] = useState("");
  const [, setLocation] = useLocation();
  const [error, setError] = useState("");

  const handleSearch = async () => {
    if (!orgSearch) return;

    try {
      const slug = orgSearch.toLowerCase().replace(/\s+/g, "-");
      const response = await fetch(`/api/organizations/${slug}`);
      
      if (response.ok) {
        const org = await response.json();
        setLocation(`/o/${org.slug}`);
      } else {
        setError("Organization not found. Please check the name and try again.");
      }
    } catch (err) {
      setError("Unable to search organizations. Please try again.");
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto flex h-16 items-center justify-between px-6">
          <div className="flex items-center gap-2">
            <Building2 className="h-6 w-6 text-primary" />
            <span className="text-lg font-semibold">Synozur Aurora</span>
          </div>
          <Button variant="outline" data-testid="button-publisher-login">
            Publisher Login
          </Button>
        </div>
      </header>

      <main>
        {/* Hero Section with Gradient */}
        <section className="relative overflow-hidden bg-gradient-to-br from-background via-primary/5 to-secondary/5 px-6 py-16 md:py-24 lg:py-32">
          <div className="container mx-auto">
            <div className="mx-auto max-w-4xl text-center">
              <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
                Collaborative Envisioning Platform
              </h1>
              <p className="mt-6 text-lg leading-relaxed text-muted-foreground md:text-xl">
                Guide cohorts through structured activities to envision the future,
                prioritize initiatives, and generate actionable insights powered by AI.
              </p>

              <Card className="mx-auto mt-12 max-w-md shadow-lg">
                <CardHeader>
                  <h2 className="text-xl font-semibold">Find Your Organization</h2>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="org-search">Organization Name or Code</Label>
                      <Input
                        id="org-search"
                        placeholder="Enter organization name..."
                        value={orgSearch}
                        onChange={(e) => {
                          setOrgSearch(e.target.value);
                          setError("");
                        }}
                        onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                        data-testid="input-org-search"
                      />
                      {error && (
                        <p className="text-sm text-destructive">{error}</p>
                      )}
                    </div>
                    <Button 
                      className="w-full" 
                      disabled={!orgSearch}
                      data-testid="button-find-org"
                      onClick={handleSearch}
                    >
                      Continue
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
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
              <div className="text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                  <Users className="h-6 w-6 text-primary" />
                </div>
                <h3 className="mt-4 font-semibold">Real-Time Collaboration</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Live whiteboard with instant synchronization across all participants
                </p>
              </div>
              <div className="text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                  <Sparkles className="h-6 w-6 text-primary" />
                </div>
                <h3 className="mt-4 font-semibold">AI-Powered Insights</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Automatic categorization and personalized recommendations
                </p>
              </div>
              <div className="text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                  <TrendingUp className="h-6 w-6 text-primary" />
                </div>
                <h3 className="mt-4 font-semibold">Structured Prioritization</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Pairwise voting and ranking to reveal cohort consensus
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
