import { Card, CardHeader, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";

export default function VerifyEmail() {
  const [isLoading, setIsLoading] = useState(true);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [, setLocation] = useLocation();

  // Get token from URL
  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get('token') || '';

  useEffect(() => {
    const verifyEmail = async () => {
      if (!token) {
        setIsLoading(false);
        setError("No verification token provided");
        return;
      }

      try {
        const response = await fetch("/api/auth/verify-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });

        const data = await response.json();

        if (response.ok) {
          setSuccess(true);
          setError("");
          
          // Redirect to login after 3 seconds
          setTimeout(() => {
            setLocation("/login");
          }, 3000);
        } else {
          setSuccess(false);
          setError(data.error || "Failed to verify email");
        }
      } catch (err) {
        setSuccess(false);
        setError("Unable to connect. Please try again.");
      } finally {
        setIsLoading(false);
      }
    };

    verifyEmail();
  }, [token, setLocation]);

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
          <ThemeToggle />
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <Card className="w-full max-w-md shadow-lg">
          <CardHeader className="space-y-1">
            <div className="flex items-center justify-center gap-2 mb-2">
              {isLoading && <Loader2 className="h-8 w-8 text-primary animate-spin" />}
              {!isLoading && success && <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />}
              {!isLoading && !success && <XCircle className="h-8 w-8 text-destructive" />}
            </div>
            <h1 className="text-2xl font-semibold text-center">
              {isLoading && "Verifying Email"}
              {!isLoading && success && "Email Verified!"}
              {!isLoading && !success && "Verification Failed"}
            </h1>
          </CardHeader>

          <CardContent className="space-y-4">
            {isLoading && (
              <p className="text-sm text-muted-foreground text-center">
                Please wait while we verify your email address...
              </p>
            )}

            {!isLoading && success && (
              <div className="space-y-3">
                <div className="text-sm text-green-600 dark:text-green-400 text-center bg-green-600/10 p-3 rounded-md" data-testid="text-success">
                  Your email has been successfully verified! You can now log in to your account.
                </div>
                <p className="text-xs text-muted-foreground text-center">
                  Redirecting to login page in 3 seconds...
                </p>
              </div>
            )}

            {!isLoading && !success && (
              <div className="text-sm text-destructive text-center bg-destructive/10 p-3 rounded-md" data-testid="text-error">
                {error}
              </div>
            )}
          </CardContent>

          {!isLoading && (
            <CardFooter className="flex flex-col gap-2">
              <Button 
                className="w-full"
                onClick={() => setLocation(success ? "/login" : "/")}
                data-testid="button-continue"
              >
                {success ? "Go to Login" : "Go to Home"}
              </Button>
              {!success && (
                <p className="text-xs text-center text-muted-foreground">
                  Need a new verification link?{" "}
                  <button 
                    type="button"
                    onClick={() => setLocation("/login")}
                    className="text-primary hover:underline"
                    data-testid="link-login"
                  >
                    Try logging in
                  </button>
                </p>
              )}
            </CardFooter>
          )}
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
