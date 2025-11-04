import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Note, SurveyQuestion, SurveyResponse, Participant } from "@shared/schema";
import { cn } from "@/lib/utils";

interface SurveyViewProps {
  spaceId: string;
  participantId: string;
}

interface ResponseState {
  [noteId: string]: {
    [questionId: string]: number;
  };
}

export function SurveyView({ spaceId, participantId }: SurveyViewProps) {
  const { toast } = useToast();
  const [responses, setResponses] = useState<ResponseState>({});
  const [currentNoteIndex, setCurrentNoteIndex] = useState(0);

  // Fetch notes
  const { data: notes = [] } = useQuery<Note[]>({
    queryKey: ["/api/spaces", spaceId, "notes"],
  });

  // Fetch survey questions
  const { data: questions = [] } = useQuery<SurveyQuestion[]>({
    queryKey: ["/api/spaces", spaceId, "survey-questions"],
  });

  // Fetch existing responses
  const { data: existingResponses = [] } = useQuery<SurveyResponse[]>({
    queryKey: ["/api/spaces", spaceId, "participants", participantId, "survey-responses"],
  });

  // Load existing responses into state
  useEffect(() => {
    if (existingResponses.length > 0) {
      const responseMap: ResponseState = {};
      existingResponses.forEach(response => {
        if (!responseMap[response.noteId]) {
          responseMap[response.noteId] = {};
        }
        responseMap[response.noteId][response.questionId] = response.score;
      });
      setResponses(responseMap);
    }
  }, [existingResponses]);

  // Submit response mutation
  const submitResponseMutation = useMutation({
    mutationFn: async ({ noteId, questionId, score }: { noteId: string; questionId: string; score: number }) => {
      return apiRequest("/api/survey-responses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          spaceId,
          questionId,
          noteId,
          score,
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/spaces", spaceId, "participants", participantId, "survey-responses"],
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to submit response. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleRatingChange = (noteId: string, questionId: string, score: number) => {
    // Update local state
    setResponses(prev => ({
      ...prev,
      [noteId]: {
        ...prev[noteId],
        [questionId]: score,
      },
    }));

    // Submit to backend
    submitResponseMutation.mutate({ noteId, questionId, score });
  };

  const currentNote = notes[currentNoteIndex];
  const totalCompleted = notes.filter(note => {
    const noteResponses = responses[note.id];
    return noteResponses && questions.every(q => noteResponses[q.id] !== undefined);
  }).length;

  if (questions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Survey</CardTitle>
          <CardDescription>
            The facilitator hasn't added any survey questions yet.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (notes.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Survey</CardTitle>
          <CardDescription>
            No ideas have been submitted yet. Please wait for the ideation phase to complete.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (!currentNote) {
    return null;
  }

  const currentNoteResponses = responses[currentNote.id] || {};
  const isCurrentNoteComplete = questions.every(q => currentNoteResponses[q.id] !== undefined);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Progress Header */}
      <Card>
        <CardHeader>
          <CardTitle>Survey Progress</CardTitle>
          <CardDescription>
            Rate each idea on a scale of 1-5 for each question
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>Ideas Completed</span>
              <span className="font-medium">{totalCompleted} / {notes.length}</span>
            </div>
            <div className="w-full bg-muted rounded-full h-2">
              <div
                className="bg-primary h-2 rounded-full transition-all"
                style={{ width: `${(totalCompleted / notes.length) * 100}%` }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Current Idea Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>
              Idea {currentNoteIndex + 1} of {notes.length}
            </CardTitle>
            {isCurrentNoteComplete && (
              <span className="text-sm text-green-600 dark:text-green-400 font-medium">
                ✓ Complete
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Idea Content */}
          <div className="p-4 bg-muted rounded-lg">
            <p className="text-base">{currentNote.content}</p>
          </div>

          {/* Questions */}
          <div className="space-y-6">
            {questions.map((question, qIndex) => (
              <div key={question.id} className="space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <p className="text-sm font-medium flex-1">
                    {qIndex + 1}. {question.questionText}
                  </p>
                  {currentNoteResponses[question.id] && (
                    <span className="text-sm text-muted-foreground">
                      Score: {currentNoteResponses[question.id]}
                    </span>
                  )}
                </div>
                
                {/* Rating Scale */}
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((score) => (
                    <Button
                      key={score}
                      variant={currentNoteResponses[question.id] === score ? "default" : "outline"}
                      size="lg"
                      onClick={() => handleRatingChange(currentNote.id, question.id, score)}
                      className="flex-1 h-12 text-lg font-semibold"
                      data-testid={`button-rate-${question.id}-${score}`}
                    >
                      {score}
                    </Button>
                  ))}
                </div>
                
                <div className="flex justify-between text-xs text-muted-foreground px-1">
                  <span>Lowest</span>
                  <span>Highest</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={() => setCurrentNoteIndex(prev => Math.max(0, prev - 1))}
          disabled={currentNoteIndex === 0}
          data-testid="button-previous-idea"
        >
          Previous Idea
        </Button>
        
        <span className="text-sm text-muted-foreground">
          {currentNoteIndex + 1} / {notes.length}
        </span>

        <Button
          variant="outline"
          onClick={() => setCurrentNoteIndex(prev => Math.min(notes.length - 1, prev + 1))}
          disabled={currentNoteIndex === notes.length - 1}
          data-testid="button-next-idea"
        >
          Next Idea
        </Button>
      </div>

      {/* Completion Message */}
      {totalCompleted === notes.length && (
        <Card className="border-green-500 bg-green-50 dark:bg-green-950">
          <CardContent className="pt-6">
            <p className="text-center text-green-700 dark:text-green-300 font-medium">
              ✓ Survey Complete! You've rated all ideas. Thank you for your participation.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
