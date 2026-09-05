import React, { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ArrowLeft, BookOpen, FileText } from "lucide-react";
import OfferingEditor from "@/components/OfferingEditor";
import LessonManager from "@/components/LessonManager";
import LessonComments from "@/components/LessonComments";
import AssessmentBuilder from "@/components/AssessmentBuilder";

/** Card grid of an academic staff member's offerings; clicking one opens a
 * tabbed detail view (Course details / Lessons / Assessment). Staff without
 * the "offerings" capability see everything read-only — no edit or delete. */
export default function OfferingsPanel({ offerings, acharyas, canEditOfferings, canAuthorAssessment, canAnswerDoubts, assessmentsEnabled, assignAcharya, load }) {
  const [selectedId, setSelectedId] = useState(null);
  const selected = offerings.find((o) => o.id === selectedId) || null;

  if (!selected) {
    return (
      <div className="space-y-4">
        {!canEditOfferings && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive" data-testid="offerings-author-disabled">
            Offerings has not been granted to you by admin — you can view offerings below but can't edit or delete them.
          </div>
        )}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {offerings.map((o) => {
            const lessonCount = Array.isArray(o.modules) ? o.modules.length : 0;
            return (
              <button key={o.id} type="button" onClick={() => setSelectedId(o.id)}
                data-testid={`staff-offering-${o.id}`}
                className="group text-left flex flex-col rounded-2xl overflow-hidden border border-border bg-card hover:border-primary/50 transition-colors">
                <div className="relative aspect-[16/10] overflow-hidden bg-muted">
                  {o.image_url ? (
                    <img src={o.image_url} alt="" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-primary/20 via-background to-accent/20 flex items-center justify-center">
                      <span className="font-serif text-5xl italic text-muted-foreground/40">{o.subject?.[0] || "T"}</span>
                    </div>
                  )}
                  <div className="absolute top-3 left-3 flex flex-wrap gap-2">
                    <Badge variant={o.is_published ? "default" : "outline"} className="text-[10px] uppercase tracking-widest">
                      {o.is_published ? "Published" : "Draft"}
                    </Badge>
                    <Badge variant={o.approved_by_acharya ? "default" : "outline"} className="text-[10px] uppercase tracking-widest">
                      {o.approved_by_acharya ? "Ācharya ✓" : "Awaiting sign-off"}
                    </Badge>
                  </div>
                </div>
                <div className="p-4 flex-1 flex flex-col">
                  <div className="text-xs text-muted-foreground">{o.subject} · {o.type?.replace("_", " ")}</div>
                  <div className="font-display font-semibold text-lg leading-snug mt-1 line-clamp-2">{o.title}</div>
                  <div className="mt-auto pt-3 flex items-center gap-1 text-xs text-muted-foreground">
                    <BookOpen className="w-3.5 h-3.5" /> {lessonCount} lesson{lessonCount === 1 ? "" : "s"}
                  </div>
                </div>
              </button>
            );
          })}
          {offerings.length === 0 && <div className="col-span-full text-sm text-muted-foreground py-10 text-center">No offerings yet.</div>}
        </div>
      </div>
    );
  }

  const acharya = acharyas.find((a) => a.id === selected.acharya_id);
  const lessons = Array.isArray(selected.modules) ? selected.modules : [];

  return (
    <div className="space-y-5" data-testid={`staff-offering-detail-${selected.id}`}>
      <button type="button" onClick={() => setSelectedId(null)}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="w-4 h-4" /> All offerings
      </button>

      <div>
        <div className="text-xs text-muted-foreground">{selected.subject} · {selected.type?.replace("_", " ")}</div>
        <h3 className="font-display font-bold text-2xl">{selected.title}</h3>
        {acharya && <div className="text-xs text-primary mt-1">Ācharya: {acharya.name}</div>}
      </div>

      {selected.approval_notes && !selected.approved_by_acharya && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/30 p-3 text-xs">
          <strong>Ācharya requested changes:</strong> {selected.approval_notes}
        </div>
      )}

      <Tabs defaultValue="details">
        <TabsList>
          <TabsTrigger value="details" data-testid="offering-tab-details">Course details</TabsTrigger>
          <TabsTrigger value="lessons" data-testid="offering-tab-lessons">Lessons ({lessons.length})</TabsTrigger>
          <TabsTrigger value="assessment" data-testid="offering-tab-assessment">Assessment</TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="mt-6 space-y-4">
          {canEditOfferings ? (
            <>
              <div className="flex items-center gap-3 flex-wrap">
                <label className="eyebrow">Assigned Ācharya</label>
                <Select value={selected.acharya_id || ""} onValueChange={(v) => assignAcharya(selected.id, v)}>
                  <SelectTrigger className="h-10 w-64" data-testid={`assign-acharya-${selected.id}`}><SelectValue placeholder="Assign an Ācharya…" /></SelectTrigger>
                  <SelectContent>{acharyas.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
                </Select>
                {!selected.acharya_id && <span className="text-xs text-destructive">Not routed — assign an Ācharya to send for review</span>}
              </div>
              <OfferingEditor offering={selected} onSaved={load} />
            </>
          ) : (
            <div className="rounded-xl border border-border bg-background/50 p-5 space-y-2 text-sm" data-testid="offering-details-readonly">
              <p>{selected.description}</p>
              <div className="text-muted-foreground">{selected.duration} · ₹{selected.price_inr} / ${selected.price_usd}</div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="lessons" className="mt-6 space-y-6">
          {canEditOfferings && (
            <>
              <h4 className="font-display font-semibold">Lessons — recorded video & written content</h4>
              <LessonManager offering={selected} onSaved={load} />
            </>
          )}
          {lessons.length === 0 ? (
            <p className="text-sm text-muted-foreground">No lessons yet.</p>
          ) : (
            <div className="space-y-5">
              {lessons.map((l, i) => {
                const lessonId = l.id || String(i);
                return (
                  <div key={lessonId} className="rounded-xl border border-border p-4 bg-background/60" data-testid={`staff-lesson-view-${lessonId}`}>
                    <div className="font-semibold text-sm mb-3">{i + 1}. {l.title || "Untitled lesson"}</div>
                    {l.video_url && (
                      l.video_provider === "bunny"
                        ? <iframe src={l.video_url} title={l.title || "Lecture video"} loading="lazy"
                            className="w-full max-w-md aspect-video rounded-lg border border-border"
                            allow="accelerometer; gyroscope; encrypted-media; picture-in-picture;" allowFullScreen />
                        : <video src={l.video_url} controls className="w-full max-w-md rounded-lg border border-border" />
                    )}
                    {l.notes_url && (
                      <a href={l.notes_url} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-primary underline mt-2">
                        <FileText className="w-3.5 h-3.5" /> Lecture notes
                      </a>
                    )}
                    <LessonComments offeringId={selected.id} lessonId={lessonId} canAnswer={canAnswerDoubts} />
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="assessment" className="mt-6">
          <AssessmentBuilder offeringId={selected.id} canAuthorQuiz={canAuthorAssessment} enabled={assessmentsEnabled} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
