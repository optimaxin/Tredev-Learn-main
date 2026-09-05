import React, { useEffect, useState } from "react";
import api, { formatApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { QuestionEditor } from "@/components/QuizManager";

export default function AssessmentBuilder({ offeringId, canAuthorQuiz = true, enabled = true }) {
  const [quiz, setQuiz] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const { data } = await api.get(`/quizzes?context=course&offering_id=${offeringId}`).catch(() => ({ data: [] }));
    setQuiz((Array.isArray(data) ? data : [])[0] || null);
  };
  useEffect(() => { if (enabled) load(); }, [offeringId, enabled]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!enabled) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive" data-testid="assessment-feature-disabled">
        Access not granted by admin — Assessments have been turned off. Ask an admin to enable the "Assessments" feature toggle.
      </div>
    );
  }

  const startNew = () => setQuiz({ title: "Course assessment", context: "course", offering_id: offeringId, unlock_rule: "on_course_complete", questions: [] });

  const save = async () => {
    if (!quiz.title) return toast.error("Title is required.");
    setSaving(true);
    try {
      if (quiz.id) {
        await api.patch(`/quizzes/${quiz.id}`, quiz);
        toast.success("Assessment updated — live on the course.");
      } else {
        const { data } = await api.post("/quizzes", { ...quiz, context: "course", offering_id: offeringId });
        setQuiz(data);
        toast.success("Assessment created and published on the course.");
      }
      load();
    } catch (e) { toast.error(formatApiError(e)); }
    setSaving(false);
  };

  if (!canAuthorQuiz) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive" data-testid="assessment-author-disabled">
        Assessment access has not been granted to you by admin — you can't view, create, edit, or delete assessments for this course.
      </div>
    );
  }

  if (!quiz) {
    return (
      <div className="space-y-3" data-testid="assessment-empty">
        <p className="text-sm text-muted-foreground">No assessment yet for this course.</p>
        <Button size="sm" variant="outline" onClick={startNew} className="rounded-full">Add assessment</Button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border p-5 bg-background/60 space-y-4" data-testid="assessment-builder">
      <div className="flex items-center gap-3 flex-wrap">
        <h4 className="font-display font-semibold">Course assessment</h4>
        {quiz.status && <Badge variant="default" className="text-[10px] uppercase tracking-widest">{quiz.status.replace("_"," ")}</Badge>}
      </div>
      <div>
        <label className="eyebrow">Title</label>
        <Input value={quiz.title} onChange={(e) => setQuiz({ ...quiz, title: e.target.value })} className="mt-2 h-11" />
      </div>
      <QuestionEditor questions={quiz.questions} onChange={(questions) => setQuiz({ ...quiz, questions })} />
      <div className="flex gap-2 flex-wrap">
        <Button size="sm" onClick={save} disabled={saving} className="rounded-full bg-gradient-hot text-white border-0">
          {saving ? "Saving…" : "Save assessment"}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">Changes go live on the course immediately — no Ācharya review required.</p>
    </div>
  );
}
