import { Card, CardHeader, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, LogIn } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [, setLocation] = useLocation();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (response.ok) {
        const user = await response.json();
        
        // Redirect based on role
        if (user.role === "global_admin" || user.role === "company_admin") {
          setLocation("/admin");
        } else if (user.role === "facilitator") {
          setLocation("/dashboard");
        } else {
          // Regular users shouldn't use login, they join via codes
          setError("Standard users should join workspaces using a 4-digit code from the home page.");
          return;
        }
      } else {
        const data = await response.json();
        setError(data.error || "Invalid email or password");
      }
    } catch (err) {
      setError("Unable to connect. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto flex h-16 items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <img 
              src="/logos/synozur-horizontal-color.png" 
              alt="Synozur Alliance" 
              className="h-8"
              data-testid="img-logo"
            />
            <div className="h-6 w-px bg-border/40" />
            <span className="text-lg font-semibold bg-gradient-to-r from-primary to-purple-500 bg-clip-text text-transparent">
              Aurora
            </span>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button 
              variant="ghost" 
              data-testid="button-back-home"
              onClick={() => setLocation("/")}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Home
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <Card className="w-full max-w-md shadow-lg">
          <CardHeader className="space-y-1">
            <div className="flex items-center justify-center gap-2 mb-2">
              <LogIn className="h-6 w-6 text-primary" />
            </div>
            <h1 className="text-2xl font-semibold text-center">Sign In</h1>
            <p className="text-sm text-muted-foreground text-center">
              For administrators and facilitators only
            </p>
          </CardHeader>
          <form onSubmit={handleLogin}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="name@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  data-testid="input-email"
                  autoComplete="email"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  data-testid="input-password"
                  autoComplete="current-password"
                />
              </div>
              {error && (
                <div className="text-sm text-destructive text-center bg-destructive/10 p-3 rounded-md" data-testid="text-error">
                  {error}
                </div>
              )}
            </CardContent>
            <CardFooter className="flex flex-col gap-3">
              <Button 
                type="submit" 
                className="w-full"
                disabled={isLoading || !email || !password}
                data-testid="button-sign-in"
              >
                {isLoading ? "Signing in..." : "Sign In"}
              </Button>
              <p className="text-xs text-center text-muted-foreground">
                Joining a workspace?{" "}
                <button 
                  type="button"
                  onClick={() => setLocation("/")}
                  className="text-primary hover:underline"
                  data-testid="link-join-workspace"
                >
                  Use a 4-digit code instead
                </button>
              </p>
            </CardFooter>
          </form>
        </Card>
      </main>

      <footer className="border-t py-6">
        <div className="container mx-auto px-6 text-center text-sm text-muted-foreground">
          <p>© {new Date().getFullYear()} Synozur. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
