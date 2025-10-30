import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, UserCircle, Sparkles, LogIn } from "lucide-react";
import StatusBadge from "./StatusBadge";
import { generateGuestName } from "@/lib/guestNames";
import { useState } from "react";
import { useLocation } from "wouter";

interface WaitingRoomProps {
  orgName: string;
  spaceName: string;
  spacePurpose: string;
  status: "draft" | "open" | "closed";
  onJoinAnonymous?: (guestName: string) => void;
  onRegister?: (data: any) => void;
  workspaceUrl?: string;
}

export default function WaitingRoom({
  orgName,
  spaceName,
  spacePurpose,
  status,
  onJoinAnonymous,
  onRegister,
  workspaceUrl,
}: WaitingRoomProps) {
  const [, navigate] = useLocation();
  const [guestName, setGuestName] = useState(generateGuestName());
  
  const regenerateGuestName = () => {
    setGuestName(generateGuestName());
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <Card className="w-full max-w-2xl">
        <CardHeader className="space-y-4 text-center">
          <div className="mx-auto">
            <StatusBadge status={status} />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">{orgName}</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight">{spaceName}</h1>
            <p className="mt-3 text-base leading-relaxed text-muted-foreground">
              {spacePurpose}
            </p>
          </div>
        </CardHeader>

        <CardContent>
          {status === "draft" && (
            <div className="py-8 text-center">
              <Loader2 className="mx-auto h-8 w-8 animate-spin text-muted-foreground" />
              <p className="mt-4 text-sm text-muted-foreground">
                Session not yet started. Please wait for the facilitator.
              </p>
            </div>
          )}

          {status === "closed" && (
            <div className="py-8 text-center">
              <p className="text-sm text-muted-foreground">
                This session has ended. Contact your facilitator for access.
              </p>
            </div>
          )}

          {status === "open" && (
            <Tabs defaultValue="anonymous" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="anonymous" data-testid="tab-anonymous">Guest</TabsTrigger>
                <TabsTrigger value="login" data-testid="tab-login">Login</TabsTrigger>
                <TabsTrigger value="register" data-testid="tab-register">Register</TabsTrigger>
              </TabsList>

              <TabsContent value="anonymous" className="space-y-4 mt-6">
                <div className="rounded-lg border p-6 text-center">
                  <UserCircle className="mx-auto h-12 w-12 text-muted-foreground" />
                  <p className="mt-4 text-sm text-muted-foreground">
                    Join with a random alias to participate anonymously
                  </p>
                  <div className="mt-6 rounded-lg bg-accent/50 p-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Your Guest Name
                    </p>
                    <p className="mt-2 text-2xl font-semibold" data-testid="text-guest-name">
                      {guestName}
                    </p>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mt-3"
                      onClick={regenerateGuestName}
                      data-testid="button-regenerate-name"
                    >
                      <Sparkles className="mr-2 h-4 w-4" />
                      Generate New Name
                    </Button>
                  </div>
                  <Button
                    className="mt-6"
                    onClick={() => onJoinAnonymous?.(guestName)}
                    data-testid="button-join-anonymous"
                  >
                    Join as {guestName}
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="login" className="space-y-4 mt-6">
                <div className="rounded-lg border p-6 text-center">
                  <LogIn className="mx-auto h-12 w-12 text-muted-foreground" />
                  <p className="mt-4 text-sm text-muted-foreground">
                    Already have an account? Sign in to join this workspace
                  </p>
                  <Button
                    className="mt-6"
                    onClick={() => {
                      // Store the return URL in session storage
                      sessionStorage.setItem("loginReturnUrl", workspaceUrl || window.location.pathname);
                      navigate("/login");
                    }}
                    data-testid="button-go-to-login"
                  >
                    <LogIn className="mr-2 h-4 w-4" />
                    Go to Login
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="register" className="mt-6">
                <form className="space-y-6" onSubmit={(e) => {
                  e.preventDefault();
                  const formData = new FormData(e.currentTarget);
                  onRegister?.(Object.fromEntries(formData));
                }}>
                  <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="name">Name *</Label>
                      <Input id="name" name="name" required data-testid="input-name" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email *</Label>
                      <Input id="email" name="email" type="email" required data-testid="input-email" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="company">Company</Label>
                      <Input id="company" name="company" data-testid="input-company" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="job_title">Job Title</Label>
                      <Input id="job_title" name="job_title" data-testid="input-job-title" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="industry">Industry</Label>
                      <Select name="industry">
                        <SelectTrigger id="industry" data-testid="select-industry">
                          <SelectValue placeholder="Select industry" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="technology">Technology</SelectItem>
                          <SelectItem value="healthcare">Healthcare</SelectItem>
                          <SelectItem value="finance">Finance</SelectItem>
                          <SelectItem value="education">Education</SelectItem>
                          <SelectItem value="retail">Retail</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="country">Country</Label>
                      <Select name="country">
                        <SelectTrigger id="country" data-testid="select-country">
                          <SelectValue placeholder="Select country" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="us">United States</SelectItem>
                          <SelectItem value="uk">United Kingdom</SelectItem>
                          <SelectItem value="ca">Canada</SelectItem>
                          <SelectItem value="de">Germany</SelectItem>
                          <SelectItem value="fr">France</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <Button type="submit" className="w-full" data-testid="button-register">
                    Register & Join
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
