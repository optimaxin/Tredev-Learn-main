import React, { useEffect, useState, useRef } from "react";
import { useParams } from "react-router-dom";
import api, { formatApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { ClipboardList } from "lucide-react";

export default function QuizAttempt() {
  const { quizId } = useParams();
  const [quiz, setQuiz] = useState(null);
  const [answers, setAnswers] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const startedAtRef = useRef(null);

  useEffect(() => {
    api.get(`/quizzes/${quizId}`).then(({ data }) => {
      setQuiz(data);
      setAnswers((data.questions || []).map((q) => (q.type === "paragraph" ? "" : (q.multiple ? [] : null))));
      startedAtRef.current = new Date();
    }).catch((e) => toast.error(formatApiError(e)));
    api.get(`/quizzes/${quizId}/my-attempt`).then(({ data }) => setResult(data)).catch(() => {});
  }, [quizId]);

  const setAnswer = (qi, value) => {
    setAnswers((prev) => prev.map((a, i) => (i === qi ? value : a)));
  };

  const toggleOption = (qi, oi) => {
    setAnswers((prev) => prev.map((a, i) => {
      if (i !== qi) return a;
      const set = a.includes(oi) ? a.filter((x) => x !== oi) : [...a, oi];
      return set;
    }));
  };

  const submit = async () => {
    setSubmitting(true);
    try {
      const startedAt = startedAtRef.current || new Date();
      const time_taken_seconds = Math.round((Date.now() - startedAt.getTime()) / 1000);
      const { data } = await api.post("/quizzes/attempts", {
        quiz_id: quizId, answers, started_at: startedAt.toISOString(), time_taken_seconds,
      });
      setResult(data);
      toast.success("Attempt submitted.");
    } catch (e) { toast.error(formatApiError(e)); }
    setSubmitting(false);
  };

  if (!quiz) return <div className="p-20 text-center text-muted-foreground">Loading…</div>;

  return (
    <div className="site-container py-16 max-w-3xl">
      <div className="eyebrow mb-3">Assessment</div>
      <h1 className="text-4xl font-serif tracking-tight mb-10" data-testid="quiz-title">{quiz.title}</h1>

      {result ? (
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-8 flex items-start gap-4" data-testid="quiz-result">
          <ClipboardList className="w-6 h-6 text-primary shrink-0" />
          <div>
            <div className="font-display font-semibold text-lg">
              {result.status === "graded" ? `Score: ${result.score}/${result.total_score}` : "Submitted — pending staff review"}
            </div>
            {result.status !== "graded" && (
              <p className="mt-1 text-sm text-muted-foreground">Your descriptive answers will be graded by the academic team.</p>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-8">
          {(quiz.questions || []).map((q, qi) => (
            <div key={q.id || qi} className="rounded-xl border border-border bg-card p-6" data-testid={`quiz-question-${qi}`}>
              <div className="font-serif text-lg mb-4">{qi + 1}. {q.prompt}</div>
              {q.image_url && (
                <img src={q.image_url} alt={`Question ${qi + 1}`} className="mb-4 max-w-full max-h-80 rounded-lg border border-border object-contain" />
              )}
              {q.type === "paragraph" ? (
                <Textarea value={answers[qi] || ""} onChange={(e) => setAnswer(qi, e.target.value)}
                  placeholder="Your answer" data-testid={`quiz-answer-${qi}`} />
              ) : q.multiple ? (
                <div className="space-y-2">
                  {(q.options || []).map((opt, oi) => (
                    <label key={oi} className="flex items-center gap-2 text-sm cursor-pointer">
                      <Checkbox checked={(answers[qi] || []).includes(oi)} onCheckedChange={() => toggleOption(qi, oi)}
                        data-testid={`quiz-option-${qi}-${oi}`} />
                      {opt}
                    </label>
                  ))}
                </div>
              ) : (
                <RadioGroup value={answers[qi] != null ? String(answers[qi]) : ""} onValueChange={(v) => setAnswer(qi, Number(v))}>
                  {(q.options || []).map((opt, oi) => (
                    <label key={oi} className="flex items-center gap-2 text-sm cursor-pointer">
                      <RadioGroupItem value={String(oi)} data-testid={`quiz-option-${qi}-${oi}`} />
                      {opt}
                    </label>
                  ))}
                </RadioGroup>
              )}
            </div>
          ))}
          <Button size="lg" onClick={submit} disabled={submitting} className="rounded-full px-8 h-12" data-testid="quiz-submit">
            {submitting ? "Submitting…" : "Submit"}
          </Button>
        </div>
      )}
    </div>
  );
}
