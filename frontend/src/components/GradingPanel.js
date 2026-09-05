import React, { useEffect, useState } from "react";
import api, { formatApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { CheckCircle2 } from "lucide-react";

export default function GradingPanel() {
  const [pending, setPending] = useState([]); // [{quiz, attempt}]
  const [scores, setScores] = useState({}); // attemptId -> {qid: points}
  const [feedback, setFeedback] = useState({}); // attemptId -> {qid: note}

  const load = async () => {
    const { data: quizzes } = await api.get("/quizzes").catch(() => ({ data: [] }));
    const perQuiz = await Promise.all(
      (Array.isArray(quizzes) ? quizzes : []).map((q) =>
        api.get(`/quizzes/${q.id}/attempts?status=submitted`)
          .then((r) => (Array.isArray(r.data) ? r.data : []).map((attempt) => ({ quiz: q, attempt })))
          .catch(() => [])
      )
    );
    setPending(perQuiz.flat());
  };
  useEffect(() => { load(); }, []);

  const grade = async (quiz, attempt) => {
    try {
      await api.post(`/attempts/${attempt.id}/grade`, {
        manual_scores: scores[attempt.id] || {},
        feedback: feedback[attempt.id] || {},
      });
      toast.success("Graded.");
      load();
    } catch (e) { toast.error(formatApiError(e)); }
  };

  return (
    <div className="space-y-4" data-testid="grading-panel">
      {pending.length === 0 && <div className="text-sm text-muted-foreground">No submissions awaiting grading.</div>}
      {pending.map(({ quiz, attempt }) => {
        const paragraphs = (quiz.questions || []).filter((q) => q.type === "paragraph");
        return (
          <div key={attempt.id} className="rounded-2xl border border-border p-6 bg-card space-y-4" data-testid={`attempt-${attempt.id}`}>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="font-display font-semibold text-lg">{quiz.title}</div>
              <Badge variant="outline" className="text-[10px] uppercase tracking-widest">{attempt.user_name || attempt.user_id}</Badge>
            </div>
            {paragraphs.map((q) => {
              const qIdx = (quiz.questions || []).findIndex((x) => x.id === q.id);
              return (
              <div key={q.id} className="border-t border-border pt-3 space-y-2">
                <div className="text-sm font-medium">{q.prompt} <span className="text-xs text-muted-foreground">({q.points} pts)</span></div>
                <p className="font-editorial text-sm bg-background/60 rounded-lg p-3 whitespace-pre-line">{attempt.answers?.[qIdx] || "(no answer)"}</p>
                <div className="flex items-center gap-3">
                  <Input type="number" min={0} max={q.points} placeholder="Points"
                    value={scores[attempt.id]?.[q.id] ?? ""}
                    onChange={(e) => setScores({ ...scores, [attempt.id]: { ...scores[attempt.id], [q.id]: parseInt(e.target.value || 0) } })}
                    className="h-9 w-24" data-testid={`grade-points-${attempt.id}-${q.id}`} />
                  <Textarea placeholder="Feedback…" value={feedback[attempt.id]?.[q.id] || ""}
                    onChange={(e) => setFeedback({ ...feedback, [attempt.id]: { ...feedback[attempt.id], [q.id]: e.target.value } })}
                    className="flex-1 min-h-[50px]" data-testid={`grade-feedback-${attempt.id}-${q.id}`} />
                </div>
              </div>
              );
            })}
            <Button size="sm" onClick={() => grade(quiz, attempt)} className="rounded-full bg-gradient-hot text-white border-0" data-testid={`grade-submit-${attempt.id}`}>
              <CheckCircle2 className="w-4 h-4 mr-1" /> Submit grade
            </Button>
          </div>
        );
      })}
    </div>
  );
}
