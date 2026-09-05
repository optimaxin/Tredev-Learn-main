import React, { useEffect, useState } from "react";
import api, { formatApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { MessageCircle } from "lucide-react";

/** Q&A thread scoped to one lecture (reuses the /doubts endpoints with a lesson_id). */
export default function LessonComments({ offeringId, lessonId, canAnswer }) {
  const [items, setItems] = useState([]);
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);
  const [replyText, setReplyText] = useState("");

  const load = () => {
    api.get("/doubts", { params: { offering_id: offeringId, lesson_id: lessonId } })
      .then(({ data }) => setItems(Array.isArray(data) ? data : []))
      .catch(() => {});
  };
  useEffect(() => { load(); }, [offeringId, lessonId]); // eslint-disable-line react-hooks/exhaustive-deps

  const ask = async (e) => {
    e.preventDefault();
    if (!question.trim()) return;
    setAsking(true);
    try {
      await api.post("/doubts", { offering_id: offeringId, lesson_id: lessonId, question: question.trim() });
      setQuestion("");
      load();
    } catch (e) { toast.error(formatApiError(e)); }
    setAsking(false);
  };

  const submitReply = async (id) => {
    if (!replyText.trim()) return;
    try {
      await api.post(`/doubts/${id}/answer`, { answer: replyText.trim() });
      setReplyingTo(null);
      setReplyText("");
      load();
    } catch (e) { toast.error(formatApiError(e)); }
  };

  return (
    <div className="mt-3 border-t border-border pt-3 space-y-3" data-testid={`lesson-comments-${lessonId}`}>
      <div className="flex items-center gap-2 text-sm font-semibold">
        <MessageCircle className="w-4 h-4" /> Questions on this lecture
      </div>
      {items.length === 0 && <p className="text-xs text-muted-foreground">No questions yet.</p>}
      {items.map((d) => (
        <div key={d.id} className="rounded-lg bg-muted/50 p-3 text-sm space-y-1.5">
          <div><span className="font-semibold">{d.asked_by_name || "Learner"}:</span> {d.question}</div>
          {d.answer ? (
            <div className="text-primary"><span className="font-semibold">{d.answered_by_name || "Staff"}:</span> {d.answer}</div>
          ) : canAnswer ? (
            replyingTo === d.id ? (
              <div className="flex items-start gap-2">
                <Textarea value={replyText} onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Write a reply…" className="min-h-[44px] text-sm" />
                <Button size="sm" onClick={() => submitReply(d.id)}>Send</Button>
              </div>
            ) : (
              <button type="button" className="text-xs text-primary underline"
                onClick={() => { setReplyingTo(d.id); setReplyText(""); }}>
                Reply
              </button>
            )
          ) : (
            <div className="text-xs text-muted-foreground">Awaiting staff reply…</div>
          )}
        </div>
      ))}
      <form onSubmit={ask} className="flex items-start gap-2">
        <Textarea value={question} onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask a question about this lecture…" className="min-h-[44px] text-sm" />
        <Button type="submit" size="sm" disabled={asking}>Ask</Button>
      </form>
    </div>
  );
}
