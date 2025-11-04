import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Trash2, GripVertical, Edit2, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { SurveyQuestion } from "@shared/schema";

interface SurveyQuestionsManagerProps {
  spaceId: string;
}

export function SurveyQuestionsManager({ spaceId }: SurveyQuestionsManagerProps) {
  const { toast } = useToast();
  const [newQuestionText, setNewQuestionText] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");

  // Fetch survey questions
  const { data: questions = [], isLoading } = useQuery<SurveyQuestion[]>({
    queryKey: ["/api/spaces", spaceId, "survey-questions"],
  });

  // Create question mutation
  const createQuestionMutation = useMutation({
    mutationFn: async (questionText: string) => {
      return apiRequest(`/api/spaces/${spaceId}/survey-questions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionText,
          sortOrder: questions.length,
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/spaces", spaceId, "survey-questions"] });
      setNewQuestionText("");
      toast({
        title: "Question Added",
        description: "Survey question has been created successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create survey question.",
        variant: "destructive",
      });
    },
  });

  // Update question mutation
  const updateQuestionMutation = useMutation({
    mutationFn: async ({ id, questionText }: { id: string; questionText: string }) => {
      return apiRequest(`/api/survey-questions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionText }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/spaces", spaceId, "survey-questions"] });
      setEditingId(null);
      setEditText("");
      toast({
        title: "Question Updated",
        description: "Survey question has been updated successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update survey question.",
        variant: "destructive",
      });
    },
  });

  // Delete question mutation
  const deleteQuestionMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest(`/api/survey-questions/${id}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/spaces", spaceId, "survey-questions"] });
      toast({
        title: "Question Deleted",
        description: "Survey question has been removed successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete survey question.",
        variant: "destructive",
      });
    },
  });

  const handleCreate = () => {
    if (newQuestionText.trim()) {
      createQuestionMutation.mutate(newQuestionText.trim());
    }
  };

  const handleUpdate = (id: string) => {
    if (editText.trim()) {
      updateQuestionMutation.mutate({ id, questionText: editText.trim() });
    }
  };

  const handleDelete = (id: string) => {
    if (window.confirm("Are you sure you want to delete this question? All participant responses to this question will be lost.")) {
      deleteQuestionMutation.mutate(id);
    }
  };

  const startEdit = (question: SurveyQuestion) => {
    setEditingId(question.id);
    setEditText(question.questionText);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditText("");
  };

  // Default questions for reference
  const defaultQuestions = [
    "How critical is this for your organization? (5 = most critical)",
    "How easy would this be to implement? (5 = simplest)",
    "How much influence do you have to make this happen? (5 = I'm the final decider)",
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Survey Questions</CardTitle>
        <CardDescription>
          Create custom questions for participants to rate each idea on a 1-5 scale.
          These ratings help provide additional context but don't affect final rankings.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Suggested Questions */}
        {questions.length === 0 && (
          <div className="p-4 bg-muted rounded-lg space-y-2">
            <p className="text-sm font-medium">Suggested Questions:</p>
            <ul className="text-sm text-muted-foreground space-y-1 pl-4">
              {defaultQuestions.map((q, i) => (
                <li key={i} className="list-disc">{q}</li>
              ))}
            </ul>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                defaultQuestions.forEach((q, i) => {
                  apiRequest(`/api/spaces/${spaceId}/survey-questions`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ questionText: q, sortOrder: i }),
                  }).then(() => {
                    queryClient.invalidateQueries({ queryKey: ["/api/spaces", spaceId, "survey-questions"] });
                  });
                });
                toast({
                  title: "Default Questions Added",
                  description: "Default survey questions have been created.",
                });
              }}
              data-testid="button-add-default-questions"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add All Default Questions
            </Button>
          </div>
        )}

        {/* Question List */}
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading questions...</p>
        ) : (
          <div className="space-y-2">
            {questions.map((question, index) => (
              <div
                key={question.id}
                className="flex items-start gap-2 p-3 bg-card border rounded-lg hover-elevate"
                data-testid={`survey-question-${question.id}`}
              >
                <div className="flex items-center gap-2 pt-2">
                  <GripVertical className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-muted-foreground">
                    Q{index + 1}
                  </span>
                </div>

                {editingId === question.id ? (
                  <div className="flex-1 flex items-center gap-2">
                    <Input
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleUpdate(question.id);
                        if (e.key === "Escape") cancelEdit();
                      }}
                      className="flex-1"
                      autoFocus
                      data-testid={`input-edit-question-${question.id}`}
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleUpdate(question.id)}
                      data-testid={`button-save-question-${question.id}`}
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={cancelEdit}
                      data-testid={`button-cancel-edit-${question.id}`}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <>
                    <p className="flex-1 text-sm pt-2">{question.questionText}</p>
                    <div className="flex gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => startEdit(question)}
                        data-testid={`button-edit-question-${question.id}`}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleDelete(question.id)}
                        disabled={deleteQuestionMutation.isPending}
                        data-testid={`button-delete-question-${question.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Add New Question */}
        <div className="flex gap-2 pt-2">
          <Input
            value={newQuestionText}
            onChange={(e) => setNewQuestionText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreate();
            }}
            placeholder="Enter a new survey question..."
            className="flex-1"
            data-testid="input-new-question"
          />
          <Button
            onClick={handleCreate}
            disabled={!newQuestionText.trim() || createQuestionMutation.isPending}
            data-testid="button-create-question"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Question
          </Button>
        </div>

        <p className="text-xs text-muted-foreground mt-4">
          Participants will rate each idea on a 1-5 scale for every question.
          All scores will be averaged to provide an overall score.
        </p>
      </CardContent>
    </Card>
  );
}
