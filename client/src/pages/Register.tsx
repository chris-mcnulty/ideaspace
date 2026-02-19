import { Card, CardHeader, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, UserPlus, Eye, EyeOff, CheckCircle2 } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { SynozurAppSwitcher } from "@/components/SynozurAppSwitcher";

export default function Register() {
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [registrationSuccess, setRegistrationSuccess] = useState(false);
  const [, setLocation] = useLocation();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          email, 
          username, 
          password,
          displayName: displayName || undefined,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setRegistrationSuccess(true);
      } else {
        setError(data.error || "Registration failed. Please try again.");
      }
    } catch (err) {
      setError("Unable to connect. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  if (registrationSuccess) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="container mx-auto flex h-16 items-center justify-between px-6">
            <div className="flex items-center gap-3">
              <SynozurAppSwitcher currentApp="nebula" variant="light" />
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
            <ThemeToggle />
          </div>
        </header>

        <main className="flex-1 flex items-center justify-center px-6 py-12">
          <Card className="w-full max-w-md shadow-lg">
            <CardHeader className="space-y-1">
              <div className="flex items-center justify-center gap-2 mb-2">
                <CheckCircle2 className="h-8 w-8 text-primary" />
              </div>
              <h1 className="text-2xl font-semibold text-center">Registration Successful!</h1>
            </CardHeader>
            <CardContent className="text-center space-y-4">
              <p className="text-muted-foreground">
                We've sent a verification email to <strong>{email}</strong>
              </p>
              <p className="text-sm text-muted-foreground">
                Please check your inbox and click the verification link to activate your account.
              </p>
              <div className="bg-primary/10 p-4 rounded-lg text-sm">
                <p className="font-medium mb-1">Next steps:</p>
                <ol className="text-left list-decimal list-inside space-y-1 text-muted-foreground">
                  <li>Check your email inbox (and spam folder)</li>
                  <li>Click the verification link</li>
                  <li>Sign in to your account</li>
                </ol>
              </div>
            </CardContent>
            <CardFooter>
              <Button 
                onClick={() => setLocation("/login")}
                className="w-full"
                data-testid="button-go-to-login"
              >
                Go to Sign In
              </Button>
            </CardFooter>
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

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto flex h-16 items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <SynozurAppSwitcher currentApp="nebula" variant="light" />
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
              <UserPlus className="h-6 w-6 text-primary" />
            </div>
            <h1 className="text-2xl font-semibold text-center">Create Account</h1>
            <p className="text-sm text-muted-foreground text-center">
              Sign up for an Aurora account
            </p>
          </CardHeader>
          <form onSubmit={handleRegister}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
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
                <Label htmlFor="username">Username *</Label>
                <Input
                  id="username"
                  type="text"
                  placeholder="johndoe"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  minLength={3}
                  data-testid="input-username"
                  autoComplete="username"
                />
                <p className="text-xs text-muted-foreground">At least 3 characters</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="displayName">Display Name (Optional)</Label>
                <Input
                  id="displayName"
                  type="text"
                  placeholder="John Doe"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  data-testid="input-display-name"
                  autoComplete="name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password *</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="At least 8 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={8}
                    data-testid="input-password"
                    autoComplete="new-password"
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
                <p className="text-xs text-muted-foreground">At least 8 characters</p>
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
                disabled={isLoading || !email || !username || !password || password.length < 8 || username.length < 3}
                data-testid="button-register"
              >
                {isLoading ? "Creating account..." : "Create Account"}
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                Already have an account?{" "}
                <button 
                  type="button"
                  onClick={() => setLocation("/login")}
                  className="text-primary hover:underline"
                  data-testid="link-login"
                >
                  Sign in here
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
