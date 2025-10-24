import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, UserCircle } from "lucide-react";
import StatusBadge from "./StatusBadge";

interface WaitingRoomProps {
  orgName: string;
  spaceName: string;
  spacePurpose: string;
  status: "draft" | "open" | "closed";
  onJoinAnonymous?: () => void;
  onRegister?: (data: any) => void;
}

export default function WaitingRoom({
  orgName,
  spaceName,
  spacePurpose,
  status,
  onJoinAnonymous,
  onRegister,
}: WaitingRoomProps) {
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
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="anonymous" data-testid="tab-anonymous">Join Anonymously</TabsTrigger>
                <TabsTrigger value="register" data-testid="tab-register">Register</TabsTrigger>
              </TabsList>

              <TabsContent value="anonymous" className="space-y-4 mt-6">
                <div className="rounded-lg border p-6 text-center">
                  <UserCircle className="mx-auto h-12 w-12 text-muted-foreground" />
                  <p className="mt-4 text-sm text-muted-foreground">
                    Join with a random alias to participate anonymously
                  </p>
                  <Button
                    className="mt-6"
                    onClick={onJoinAnonymous}
                    data-testid="button-join-anonymous"
                  >
                    Generate Alias & Join
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
