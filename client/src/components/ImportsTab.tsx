import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Loader2, Upload, FileWarning, CheckCircle2, Download } from "lucide-react";
import {
  TEMPLATE_CSV_HEADERS,
  USER_CSV_HEADERS,
  IDEA_CSV_HEADERS,
  type CsvImportType,
  type CsvPreviewResponse,
} from "@shared/csvImport";

const TEMPLATES_SAMPLE = `${TEMPLATE_CSV_HEADERS.join(",")}
"Q1 Strategy","Quarterly planning template","Increase ARR by 20%|Goals
Hire 3 engineers|Hiring
Launch v2","Goals|#3366cc
Hiring|#cc6633"
`;
const USERS_SAMPLE = `${USER_CSV_HEADERS.join(",")}
alice@acme.com,Alice Anderson,facilitator,acme
bob@acme.com,Bob Brown,user,acme
`;
const IDEAS_SAMPLE = `${IDEA_CSV_HEADERS.join(",")}
1234-5678,"Improve onboarding flow",UX
1234-5678,"Add SSO support",Engineering
`;

const SAMPLES: Record<CsvImportType, string> = {
  templates: TEMPLATES_SAMPLE,
  users: USERS_SAMPLE,
  ideas: IDEAS_SAMPLE,
};

const HEADER_DESC: Record<CsvImportType, string> = {
  templates: "Headers: " + TEMPLATE_CSV_HEADERS.join(", ") + ". One row per template. The 'ideas' and 'categories' cells are newline-separated lists; each idea is 'text' or 'text|category'; each category is 'name' or 'name|#hexcolor'.",
  users: "Headers: " + USER_CSV_HEADERS.join(", ") + ". organization is required for non-global_admin roles and accepts a slug or name.",
  ideas: "Headers: " + IDEA_CSV_HEADERS.join(", ") + ". workspaceCode must be in nnnn-nnnn format. text is the idea content. category is optional and will be created if it doesn't exist.",
};

export function ImportsTab() {
  const { toast } = useToast();
  const [type, setType] = useState<CsvImportType>("templates");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<CsvPreviewResponse<any> | null>(null);
  const [sendInvites, setSendInvites] = useState(true);

  const previewMutation = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("Choose a CSV file first");
      const fd = new FormData();
      fd.append("type", type);
      fd.append("file", file);
      const res = await fetch("/api/admin/imports/preview", { method: "POST", body: fd, credentials: "include" });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Preview failed: ${res.status}`);
      }
      return (await res.json()) as CsvPreviewResponse<any>;
    },
    onSuccess: (data) => {
      setPreview(data);
      toast({ title: "Preview ready", description: `${data.validRows.length} valid / ${data.errors.length} errors` });
    },
    onError: (err: any) => {
      setPreview(null);
      toast({ title: "Preview failed", description: err?.message ?? "Unknown error", variant: "destructive" });
    },
  });

  const confirmMutation = useMutation({
    mutationFn: async () => {
      if (!preview || preview.validRows.length === 0) throw new Error("Nothing to import");
      const url =
        type === "templates" ? "/api/admin/imports/templates/confirm"
          : type === "users" ? "/api/admin/imports/users/confirm"
          : "/api/admin/imports/ideas/confirm";
      const body: Record<string, unknown> = { rows: preview.validRows };
      if (type === "users") body.sendInvites = sendInvites;
      const res = await apiRequest("POST", url, body);
      return res.json();
    },
    onSuccess: (data: any) => {
      const summary =
        type === "templates" ? `Imported ${data.templates?.length ?? 0} templates`
          : type === "users" ? `Created ${data.created ?? 0} users (invites: ${data.invites?.sent ?? 0} sent, ${data.invites?.failed ?? 0} failed)`
          : `Imported ${data.notes ?? 0} ideas across ${data.spaces ?? 0} workspace(s)`;
      toast({ title: "Import successful", description: summary });
      setPreview(null);
      setFile(null);
      if (type === "templates") {
        queryClient.invalidateQueries({ queryKey: ["/api/templates"] });
        queryClient.invalidateQueries({ queryKey: ["/api/templates/spaces"] });
      } else if (type === "users") {
        queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      }
    },
    onError: (err: any) => {
      let msg = err?.message ?? "Unknown error";
      try {
        const parsed = JSON.parse(msg.replace(/^\d+:\s*/, ""));
        if (parsed?.failures?.length) {
          msg = parsed.failures.map((f: any) => `Row ${f.row}: ${f.message}`).join("\n");
        } else if (parsed?.duplicates?.length) {
          msg = "Already registered: " + parsed.duplicates.map((d: any) => d.email).join(", ");
        } else if (parsed?.error) {
          msg = typeof parsed.error === "string" ? parsed.error : JSON.stringify(parsed.error);
        }
      } catch {
        // not JSON
      }
      toast({ title: "Import failed", description: msg, variant: "destructive" });
    },
  });

  const downloadErrors = async () => {
    if (!file) return;
    const fd = new FormData();
    fd.append("type", type);
    fd.append("file", file);
    const res = await fetch("/api/admin/imports/preview?format=errors-csv", { method: "POST", body: fd, credentials: "include" });
    if (!res.ok) {
      toast({ title: "Could not download error report", variant: "destructive" });
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `import-errors-${type}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadSample = () => {
    const blob = new Blob([SAMPLES[type]], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sample-${type}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card data-testid="card-imports">
      <CardHeader>
        <CardTitle>CSV Import</CardTitle>
        <CardDescription>
          Bulk import workspace templates, users, or ideas from a CSV file. All rows are validated; on confirm, the import runs in a single database transaction (all-or-nothing).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Tabs value={type} onValueChange={(v) => { setType(v as CsvImportType); setPreview(null); setFile(null); }}>
          <TabsList>
            <TabsTrigger value="templates" data-testid="tab-import-templates">Templates</TabsTrigger>
            <TabsTrigger value="users" data-testid="tab-import-users">Users</TabsTrigger>
            <TabsTrigger value="ideas" data-testid="tab-import-ideas">Ideas</TabsTrigger>
          </TabsList>
          <TabsContent value={type} className="mt-4 space-y-4">
            <Alert>
              <AlertTitle className="text-sm font-medium">CSV format</AlertTitle>
              <AlertDescription className="text-xs">{HEADER_DESC[type]}</AlertDescription>
            </Alert>

            <div className="flex flex-wrap items-end gap-3">
              <div className="flex-1 min-w-[260px]">
                <Label htmlFor="csv-file">CSV file</Label>
                <Input
                  id="csv-file"
                  type="file"
                  accept=".csv,text/csv"
                  onChange={(e) => { setFile(e.target.files?.[0] ?? null); setPreview(null); }}
                  data-testid="input-csv-file"
                />
              </div>
              <Button
                variant="outline"
                onClick={downloadSample}
                data-testid="button-download-sample"
              >
                <Download className="h-4 w-4 mr-2" /> Sample
              </Button>
              <Button
                onClick={() => previewMutation.mutate()}
                disabled={!file || previewMutation.isPending}
                data-testid="button-preview"
              >
                {previewMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                Preview
              </Button>
            </div>

            {type === "users" && (
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="send-invites"
                  checked={sendInvites}
                  onChange={(e) => setSendInvites(e.target.checked)}
                  data-testid="checkbox-send-invites"
                />
                <Label htmlFor="send-invites" className="text-sm">Send SendGrid invitation emails after import</Label>
              </div>
            )}

            {preview && (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary" data-testid="badge-total-rows">Total: {preview.totalRows}</Badge>
                  <Badge variant="default" data-testid="badge-valid-rows">Valid: {preview.validRows.length}</Badge>
                  <Badge variant="destructive" data-testid="badge-error-count">Errors: {preview.errors.length}</Badge>
                </div>

                {preview.errors.length > 0 && (
                  <Alert variant="destructive">
                    <FileWarning className="h-4 w-4" />
                    <AlertTitle className="text-sm">Validation errors</AlertTitle>
                    <AlertDescription className="text-xs">
                      <div className="max-h-48 overflow-y-auto mt-2 space-y-1" data-testid="list-errors">
                        {preview.errors.slice(0, 25).map((err, i) => (
                          <div key={i} data-testid={`text-error-${i}`}>
                            Row {err.row}{err.field ? ` · ${err.field}` : ""}: {err.message}
                          </div>
                        ))}
                        {preview.errors.length > 25 && (
                          <div className="text-muted-foreground">... and {preview.errors.length - 25} more</div>
                        )}
                      </div>
                      <Button variant="outline" size="sm" className="mt-3" onClick={downloadErrors} data-testid="button-download-errors">
                        <Download className="h-4 w-4 mr-2" /> Download error report
                      </Button>
                    </AlertDescription>
                  </Alert>
                )}

                {preview.validRows.length > 0 && (
                  <Alert>
                    <CheckCircle2 className="h-4 w-4" />
                    <AlertTitle className="text-sm">Ready to import</AlertTitle>
                    <AlertDescription className="text-xs">
                      {preview.validRows.length} row(s) will be committed in a single transaction. If any database error occurs, no rows will be saved.
                    </AlertDescription>
                  </Alert>
                )}

                <Button
                  onClick={() => confirmMutation.mutate()}
                  disabled={preview.validRows.length === 0 || confirmMutation.isPending}
                  data-testid="button-confirm-import"
                >
                  {confirmMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Confirm import ({preview.validRows.length} row{preview.validRows.length === 1 ? "" : "s"})
                </Button>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
