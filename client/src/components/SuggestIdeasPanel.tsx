import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Sparkles, Check, X, Edit2, Loader2, RefreshCw } from "lucide-react";

interface AiSuggestion {
  id: string;
  content: string;
  rationale?: string;
  status: "pending" | "editing" | "accepting" | "accepted" | "discarded";
}

interface SuggestIdeasPanelProps {
  spaceId: string;
}

export default function SuggestIdeasPanel({ spaceId }: SuggestIdeasPanelProps) {
  const { toast } = useToast();
  const [suggestions, setSuggestions] = useState<AiSuggestion[]>([]);
  const [editDraft, setEditDraft] = useState<Record<string, string>>({});

  const generateMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/spaces/${spaceId}/suggest-ideas`, { count: 8 });
      return response.json() as Promise<{ suggestions: { content: string; rationale?: string }[] }>;
    },
    onSuccess: (data) => {
      const next: AiSuggestion[] = data.suggestions.map((s, i) => ({
        id: `${Date.now()}-${i}`,
        content: s.content,
        rationale: s.rationale,
        status: "pending",
      }));
      setSuggestions(next);
      if (next.length === 0) {
        toast({
          title: "No new suggestions",
          description: "The AI couldn't find any net-new ideas beyond what's already here.",
        });
      } else {
        toast({ title: `Generated ${next.length} suggestion${next.length === 1 ? "" : "s"}` });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Failed to generate suggestions",
        description: error?.message || "The AI assistant couldn't be reached. Please try again.",
        variant: "destructive",
      });
    },
  });

  const acceptMutation = useMutation({
    mutationFn: async (params: { suggestionId: string; content: string }) => {
      const response = await apiRequest("POST", `/api/spaces/${spaceId}/suggest-ideas/accept`, {
        content: params.content,
      });
      return { suggestionId: params.suggestionId, note: await response.json() };
    },
    onMutate: ({ suggestionId }) => {
      setSuggestions(prev => prev.map(s => s.id === suggestionId ? { ...s, status: "accepting" } : s));
    },
    onSuccess: ({ suggestionId }) => {
      setSuggestions(prev => prev.map(s => s.id === suggestionId ? { ...s, status: "accepted" } : s));
      queryClient.invalidateQueries({ queryKey: [`/api/spaces/${spaceId}/notes`] });
      toast({ title: "Suggestion accepted", description: "Added to the ideation board." });
    },
    onError: (error: any, vars) => {
      setSuggestions(prev => prev.map(s => s.id === vars.suggestionId ? { ...s, status: "pending" } : s));
      toast({
        title: "Failed to accept suggestion",
        description: error?.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleAccept = (s: AiSuggestion) => {
    const content = (s.status === "editing" ? editDraft[s.id] : s.content)?.trim();
    if (!content) return;
    acceptMutation.mutate({ suggestionId: s.id, content });
  };

  const handleEdit = (s: AiSuggestion) => {
    setEditDraft(prev => ({ ...prev, [s.id]: s.content }));
    setSuggestions(prev => prev.map(x => x.id === s.id ? { ...x, status: "editing" } : x));
  };

  const handleDiscard = (s: AiSuggestion) => {
    setSuggestions(prev => prev.map(x => x.id === s.id ? { ...x, status: "discarded" } : x));
  };

  const handleCancelEdit = (s: AiSuggestion) => {
    setSuggestions(prev => prev.map(x => x.id === s.id ? { ...x, status: "pending" } : x));
  };

  const visibleSuggestions = suggestions.filter(s => s.status !== "discarded");
  const isGenerating = generateMutation.isPending;

  return (
    <Card data-testid="card-suggest-ideas">
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" aria-hidden="true" />
            Suggest New Ideas
          </CardTitle>
          <CardDescription>
            AI proposes net-new ideas based on this workspace's purpose, existing notes, and knowledge base.
            Accept, edit, or discard each suggestion — accepted ones are added to the ideation board.
          </CardDescription>
        </div>
        <Button
          onClick={() => generateMutation.mutate()}
          disabled={isGenerating}
          data-testid="button-suggest-ideas-generate"
        >
          {isGenerating ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Thinking...
            </>
          ) : suggestions.length > 0 ? (
            <>
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Regenerate
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" aria-hidden="true" />
              Suggest Ideas
            </>
          )}
        </Button>
      </CardHeader>

      {visibleSuggestions.length > 0 && (
        <CardContent className="space-y-3">
          {visibleSuggestions.map((s) => (
            <div
              key={s.id}
              className="rounded-md border p-3 space-y-2"
              data-testid={`suggestion-${s.id}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0 space-y-2">
                  {s.status === "editing" ? (
                    <Textarea
                      value={editDraft[s.id] ?? s.content}
                      onChange={(e) => setEditDraft(prev => ({ ...prev, [s.id]: e.target.value }))}
                      rows={3}
                      className="text-sm"
                      data-testid={`textarea-suggestion-edit-${s.id}`}
                    />
                  ) : (
                    <p className="text-sm leading-relaxed" data-testid={`text-suggestion-content-${s.id}`}>
                      {s.content}
                    </p>
                  )}
                  {s.rationale && s.status !== "editing" && (
                    <p className="text-xs text-muted-foreground italic">{s.rationale}</p>
                  )}
                  {s.status === "accepted" && (
                    <Badge variant="secondary" className="gap-1">
                      <Check className="h-3 w-3" aria-hidden="true" />
                      Added to board
                    </Badge>
                  )}
                </div>
              </div>

              {s.status !== "accepted" && (
                <div className="flex flex-wrap items-center gap-2 justify-end">
                  {s.status === "editing" ? (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCancelEdit(s)}
                        data-testid={`button-suggestion-cancel-edit-${s.id}`}
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleAccept(s)}
                        disabled={!(editDraft[s.id] ?? "").trim() || acceptMutation.isPending}
                        data-testid={`button-suggestion-save-${s.id}`}
                      >
                        <Check className="h-4 w-4" aria-hidden="true" />
                        Save & accept
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDiscard(s)}
                        disabled={s.status === "accepting"}
                        data-testid={`button-suggestion-discard-${s.id}`}
                      >
                        <X className="h-4 w-4" aria-hidden="true" />
                        Discard
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(s)}
                        disabled={s.status === "accepting"}
                        data-testid={`button-suggestion-edit-${s.id}`}
                      >
                        <Edit2 className="h-4 w-4" aria-hidden="true" />
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleAccept(s)}
                        disabled={s.status === "accepting"}
                        data-testid={`button-suggestion-accept-${s.id}`}
                      >
                        {s.status === "accepting" ? (
                          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                        ) : (
                          <Check className="h-4 w-4" aria-hidden="true" />
                        )}
                        Accept
                      </Button>
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
        </CardContent>
      )}
    </Card>
  );
}
