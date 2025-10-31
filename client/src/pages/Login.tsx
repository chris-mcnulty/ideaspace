import { Card, CardHeader, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, LogIn, Eye, EyeOff } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [emailNotVerified, setEmailNotVerified] = useState(false);
  const [, setLocation] = useLocation();

  useEffect(() => {
    document.title = "Nebula - Sign In | The Synozur Alliance";
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setEmailNotVerified(false);
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
          setError("Standard users should join workspaces using an 8-digit code from the home page.");
          return;
        }
      } else {
        const data = await response.json();
        
        // Check if email verification is required
        if (response.status === 403 && data.emailVerified === false) {
          setEmailNotVerified(true);
          setError(data.message || "Please verify your email address before logging in.");
        } else {
          setError(data.error || "Invalid email or password");
        }
      }
    } catch (err) {
      setError("Unable to connect. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendVerification = async () => {
    setIsLoading(true);
    setError("");

    try {
      const response = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (response.ok) {
        setError(""); 
        setEmailNotVerified(false);
        alert(data.message || "Verification email sent! Please check your inbox.");
      } else {
        setError(data.error || "Failed to resend verification email");
      }
    } catch (err) {
      setError("Unable to resend verification email. Please try again.");
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
              Nebula
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
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    data-testid="input-password"
                    autoComplete="current-password"
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                    data-testid="button-toggle-password"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    )}
                  </Button>
                </div>
              </div>
              {error && (
                <div className="text-sm text-destructive text-center bg-destructive/10 p-3 rounded-md space-y-2" data-testid="text-error">
                  <p>{error}</p>
                  {emailNotVerified && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleResendVerification}
                      disabled={isLoading}
                      data-testid="button-resend-verification"
                      className="w-full"
                    >
                      Resend Verification Email
                    </Button>
                  )}
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
              <div className="flex flex-col items-center gap-2 text-xs text-muted-foreground">
                <button 
                  type="button"
                  onClick={() => setLocation("/forgot-password")}
                  className="text-primary hover:underline"
                  data-testid="link-forgot-password"
                >
                  Forgot your password?
                </button>
                <p>
                  Don't have an account?{" "}
                  <button 
                    type="button"
                    onClick={() => setLocation("/register")}
                    className="text-primary hover:underline"
                    data-testid="link-register"
                  >
                    Sign up here
                  </button>
                </p>
                <p>
                  Joining a workspace?{" "}
                  <button 
                    type="button"
                    onClick={() => setLocation("/")}
                    className="text-primary hover:underline"
                    data-testid="link-join-workspace"
                  >
                    Use an 8-digit code instead
                  </button>
                </p>
              </div>
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
