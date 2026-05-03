import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpDown, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Note, SurveyQuestion, Participant } from "@shared/schema";

interface SurveyAggregates {
  perNote: Array<{ noteId: string; sum: number; count: number }>;
  perNoteQuestion: Array<{ noteId: string; questionId: string; sum: number; count: number }>;
}

interface SurveyResultsGridProps {
  spaceId: string;
}

interface IdeaWithScores extends Note {
  averageScore: number;
  questionScores: { [questionId: string]: number };
  responseCount: number;
}

type SortField = "content" | "averageScore" | string; // string for questionId

export function SurveyResultsGrid({ spaceId }: SurveyResultsGridProps) {
  const [sortField, setSortField] = useState<SortField>("averageScore");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  // Fetch notes
  const { data: notes = [] } = useQuery<Note[]>({
    queryKey: ["/api/spaces", spaceId, "notes"],
  });

  // Fetch survey questions
  const { data: questions = [] } = useQuery<SurveyQuestion[]>({
    queryKey: ["/api/spaces", spaceId, "survey-questions"],
  });

  // Fetch survey aggregates (SQL-side SUM/COUNT) instead of materializing
  // every raw response in the client.
  const { data: aggregates } = useQuery<SurveyAggregates>({
    queryKey: ["/api/spaces", spaceId, "survey-aggregates"],
  });

  // Fetch participants
  const { data: participants = [] } = useQuery<Participant[]>({
    queryKey: ["/api/spaces", spaceId, "participants"],
  });

  // Calculate scores for each idea from aggregates.
  const ideasWithScores = useMemo<IdeaWithScores[]>(() => {
    const perNoteQuestion = aggregates?.perNoteQuestion ?? [];
    const validQuestionIds = new Set(questions.map(q => q.id));

    // Index per-note-question aggregates and accumulate per-note totals
    // restricted to current questions (matches server-side filtering).
    const noteQ = new Map<string, Map<string, { sum: number; count: number }>>();
    const noteTotals = new Map<string, { sum: number; count: number }>();
    for (const a of perNoteQuestion) {
      if (a.count <= 0 || !validQuestionIds.has(a.questionId)) continue;
      let qMap = noteQ.get(a.noteId);
      if (!qMap) {
        qMap = new Map();
        noteQ.set(a.noteId, qMap);
      }
      qMap.set(a.questionId, { sum: a.sum, count: a.count });
      const tot = noteTotals.get(a.noteId) ?? { sum: 0, count: 0 };
      tot.sum += a.sum;
      tot.count += a.count;
      noteTotals.set(a.noteId, tot);
    }

    return notes.map(note => {
      const qMap = noteQ.get(note.id);
      const questionScores: { [questionId: string]: number } = {};
      questions.forEach(question => {
        const entry = qMap?.get(question.id);
        questionScores[question.id] = entry && entry.count > 0 ? entry.sum / entry.count : 0;
      });
      // Preserve legacy semantics: average each question's mean across the
      // *current* question set (unanswered questions count as 0), so the
      // overall idea score isn't biased toward questions with more responses.
      const allScores = Object.values(questionScores);
      const averageScore = allScores.length > 0
        ? allScores.reduce((acc, s) => acc + s, 0) / allScores.length
        : 0;
      const tot = noteTotals.get(note.id);
      return {
        ...note,
        averageScore,
        questionScores,
        responseCount: tot?.count ?? 0,
      };
    });
  }, [notes, questions, aggregates]);

  // Sort ideas
  const sortedIdeas = useMemo(() => {
    const sorted = [...ideasWithScores];
    sorted.sort((a, b) => {
      let aValue: number | string;
      let bValue: number | string;

      if (sortField === "content") {
        aValue = a.content;
        bValue = b.content;
      } else if (sortField === "averageScore") {
        aValue = a.averageScore;
        bValue = b.averageScore;
      } else {
        // Sorting by a specific question
        aValue = a.questionScores[sortField] || 0;
        bValue = b.questionScores[sortField] || 0;
      }

      if (typeof aValue === "string" && typeof bValue === "string") {
        return sortDirection === "asc"
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }

      return sortDirection === "asc"
        ? (aValue as number) - (bValue as number)
        : (bValue as number) - (aValue as number);
    });
    return sorted;
  }, [ideasWithScores, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  const exportToCSV = () => {
    // Create CSV header
    const headers = ["Idea", "Average Score", ...questions.map(q => q.questionText)];
    const csvContent = [
      headers.join(","),
      ...sortedIdeas.map(idea => {
        const row = [
          `"${idea.content.replace(/"/g, '""')}"`,
          idea.averageScore.toFixed(2),
          ...questions.map(q => (idea.questionScores[q.id] || 0).toFixed(2)),
        ];
        return row.join(",");
      }),
    ].join("\n");

    // Download
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `survey-results-${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    window.URL.revokeObjectURL(url);
  };

  const totalResponses = ideasWithScores.reduce((s, i) => s + i.responseCount, 0);
  const participantCount = participants.length;
  const expectedResponses = notes.length * questions.length * participantCount;
  const completionRate = expectedResponses > 0
    ? ((totalResponses / expectedResponses) * 100).toFixed(1)
    : "0";

  if (questions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Survey Results</CardTitle>
          <CardDescription>
            No survey questions have been added yet.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Survey Results</CardTitle>
              <CardDescription>
                Aggregated ratings from all participants
              </CardDescription>
            </div>
            <Button
              variant="outline"
              onClick={exportToCSV}
              data-testid="button-export-survey-results"
            >
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Total Ideas</p>
              <p className="text-2xl font-bold">{notes.length}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Questions</p>
              <p className="text-2xl font-bold">{questions.length}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Participants</p>
              <p className="text-2xl font-bold">{participantCount}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Completion</p>
              <p className="text-2xl font-bold">{completionRate}%</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[400px]">
                    <Button
                      variant="ghost"
                      onClick={() => handleSort("content")}
                      className="font-semibold"
                      data-testid="button-sort-idea"
                    >
                      Idea
                      <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                  </TableHead>
                  <TableHead className="text-center">
                    <Button
                      variant="ghost"
                      onClick={() => handleSort("averageScore")}
                      className="font-semibold"
                      data-testid="button-sort-average"
                    >
                      Avg Score
                      <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                  </TableHead>
                  {questions.map((question, index) => (
                    <TableHead key={question.id} className="text-center min-w-[120px]">
                      <Button
                        variant="ghost"
                        onClick={() => handleSort(question.id)}
                        className="font-semibold text-xs whitespace-normal h-auto py-2"
                        data-testid={`button-sort-question-${index}`}
                      >
                        Q{index + 1}
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                      </Button>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedIdeas.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={questions.length + 2} className="text-center text-muted-foreground py-8">
                      No ideas to display
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedIdeas.map((idea, index) => (
                    <TableRow key={idea.id} data-testid={`survey-result-row-${index}`}>
                      <TableCell className="font-medium">
                        <div className="max-w-[400px] truncate" title={idea.content}>
                          {idea.content}
                        </div>
                      </TableCell>
                      <TableCell className="text-center font-semibold">
                        {idea.averageScore > 0 ? idea.averageScore.toFixed(2) : "-"}
                      </TableCell>
                      {questions.map(question => (
                        <TableCell key={question.id} className="text-center">
                          {idea.questionScores[question.id] > 0
                            ? idea.questionScores[question.id].toFixed(2)
                            : "-"}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Question Legend */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Question Reference</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {questions.map((question, index) => (
              <div key={question.id} className="text-sm">
                <span className="font-medium">Q{index + 1}:</span>{" "}
                <span className="text-muted-foreground">{question.questionText}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
