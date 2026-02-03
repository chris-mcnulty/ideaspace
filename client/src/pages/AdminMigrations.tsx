import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, CheckCircle, AlertTriangle, Database, ArrowLeft } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { Link } from "wouter";

interface MigrationStatus {
  totalOrganizations: number;
  orgsWithDefaultProject: number;
  orgsNeedingDefaultProject: number;
  totalWorkspaces: number;
  workspacesWithProject: number;
  workspacesNeedingProject: number;
  migrationNeeded: boolean;
}

interface MigrationResult {
  success: boolean;
  message: string;
  results: {
    organizationsChecked: number;
    projectsCreated: number;
    workspacesLinked: number;
    errors: string[];
  };
}

export default function AdminMigrations() {
  const [lastResult, setLastResult] = useState<MigrationResult | null>(null);

  const { data: status, isLoading: statusLoading, refetch: refetchStatus } = useQuery<MigrationStatus>({
    queryKey: ["/api/admin/migrations/projects/status"],
  });

  const runMigration = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/admin/migrations/projects");
      return response.json() as Promise<MigrationResult>;
    },
    onSuccess: (data) => {
      setLastResult(data);
      refetchStatus();
    },
  });

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-lg mx-auto space-y-4">
        <div className="flex items-center gap-2 mb-6">
          <Link href="/admin">
            <Button variant="ghost" size="icon" data-testid="button-back">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <h1 className="text-xl font-semibold">Database Migrations</h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Projects Migration
            </CardTitle>
            <CardDescription>
              Creates default projects for organizations and links workspaces
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {statusLoading ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Checking status...
              </div>
            ) : status ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>Organizations:</div>
                  <div className="font-medium">{status.totalOrganizations}</div>
                  
                  <div>With default project:</div>
                  <div className="font-medium">{status.orgsWithDefaultProject}</div>
                  
                  <div>Needing project:</div>
                  <div>
                    {status.orgsNeedingDefaultProject > 0 ? (
                      <Badge variant="destructive">{status.orgsNeedingDefaultProject}</Badge>
                    ) : (
                      <Badge variant="secondary">0</Badge>
                    )}
                  </div>
                  
                  <div className="col-span-2 border-t pt-2 mt-2" />
                  
                  <div>Total workspaces:</div>
                  <div className="font-medium">{status.totalWorkspaces}</div>
                  
                  <div>With project:</div>
                  <div className="font-medium">{status.workspacesWithProject}</div>
                  
                  <div>Needing project:</div>
                  <div>
                    {status.workspacesNeedingProject > 0 ? (
                      <Badge variant="destructive">{status.workspacesNeedingProject}</Badge>
                    ) : (
                      <Badge variant="secondary">0</Badge>
                    )}
                  </div>
                </div>

                {status.migrationNeeded ? (
                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Migration Required</AlertTitle>
                    <AlertDescription>
                      Some organizations or workspaces need to be migrated.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <Alert>
                    <CheckCircle className="h-4 w-4" />
                    <AlertTitle>Up to Date</AlertTitle>
                    <AlertDescription>
                      All data is properly migrated.
                    </AlertDescription>
                  </Alert>
                )}

                <Button
                  onClick={() => runMigration.mutate()}
                  disabled={runMigration.isPending}
                  className="w-full"
                  size="lg"
                  data-testid="button-run-migration"
                >
                  {runMigration.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Running Migration...
                    </>
                  ) : (
                    "Run Migration"
                  )}
                </Button>
              </div>
            ) : (
              <div className="text-destructive">Failed to load status</div>
            )}

            {lastResult && (
              <Alert className={lastResult.success ? "" : "border-destructive"}>
                {lastResult.success ? (
                  <CheckCircle className="h-4 w-4" />
                ) : (
                  <AlertTriangle className="h-4 w-4" />
                )}
                <AlertTitle>{lastResult.success ? "Migration Complete" : "Migration Failed"}</AlertTitle>
                <AlertDescription>
                  <div className="mt-2 text-sm space-y-1">
                    <div>Projects created: {lastResult.results.projectsCreated}</div>
                    <div>Workspaces linked: {lastResult.results.workspacesLinked}</div>
                    {lastResult.results.errors.length > 0 && (
                      <div className="text-destructive mt-2">
                        Errors: {lastResult.results.errors.join(", ")}
                      </div>
                    )}
                  </div>
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
