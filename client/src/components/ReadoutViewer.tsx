import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Download, Mail, User, Users } from "lucide-react";

interface ReadoutViewerProps {
  cohortSummary: string;
  personalSummary?: string;
  recommendations: Array<{ title: string; description: string }>;
  userProfile?: {
    name: string;
    role: string;
    company: string;
  };
  onDownload?: () => void;
  onEmailMe?: () => void;
}

export default function ReadoutViewer({
  cohortSummary,
  personalSummary,
  recommendations,
  userProfile,
  onDownload,
  onEmailMe,
}: ReadoutViewerProps) {
  return (
    <div className="space-y-6 p-6">
      <Tabs defaultValue={personalSummary ? "personal" : "cohort"} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="cohort" data-testid="tab-cohort">
            <Users className="mr-2 h-4 w-4" />
            Cohort Results
          </TabsTrigger>
          <TabsTrigger value="personal" disabled={!personalSummary} data-testid="tab-personal">
            <User className="mr-2 h-4 w-4" />
            My Results
          </TabsTrigger>
        </TabsList>

        <TabsContent value="cohort" className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <h2 className="text-2xl font-semibold">Cohort Summary</h2>
            </CardHeader>
            <CardContent className="prose prose-sm max-w-none dark:prose-invert">
              <p className="text-base leading-relaxed">{cohortSummary}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <h3 className="text-lg font-semibold">Recommended Next Steps</h3>
            </CardHeader>
            <CardContent className="space-y-4">
              {recommendations.map((rec, index) => (
                <div key={index} className="rounded-lg border p-4">
                  <div className="mb-2 flex items-start justify-between">
                    <h4 className="font-medium">{rec.title}</h4>
                    <Badge variant="outline" className="ml-2">
                      {index + 1}
                    </Badge>
                  </div>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {rec.description}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>

          <div className="flex gap-3">
            <Button onClick={onDownload} data-testid="button-download">
              <Download className="mr-2 h-4 w-4" />
              Download PDF
            </Button>
          </div>
        </TabsContent>

        {personalSummary && (
          <TabsContent value="personal" className="mt-6 space-y-6">
            {userProfile && (
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-lg font-bold text-primary-foreground">
                      {userProfile.name.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-semibold">{userProfile.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {userProfile.role} at {userProfile.company}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <h2 className="text-2xl font-semibold">Your Personalized Summary</h2>
              </CardHeader>
              <CardContent className="prose prose-sm max-w-none dark:prose-invert">
                <p className="text-base leading-relaxed">{personalSummary}</p>
              </CardContent>
            </Card>

            <div className="flex gap-3">
              <Button onClick={onDownload} data-testid="button-download-personal">
                <Download className="mr-2 h-4 w-4" />
                Download PDF
              </Button>
              <Button variant="outline" onClick={onEmailMe} data-testid="button-email">
                <Mail className="mr-2 h-4 w-4" />
                Email Me
              </Button>
            </div>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
