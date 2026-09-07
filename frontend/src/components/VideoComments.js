import React, { useEffect, useState } from "react";
import api, { formatApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { MessageCircle } from "lucide-react";

/** Plain comment thread under a lesson's video — any enrolled learner can
 * post and read, no staff Q&A gating (see LessonComments for that). */
export default function VideoComments({ offeringId, lessonId }) {
  const [items, setItems] = useState([]);
  const [text, setText] = useState("");
  const [posting, setPosting] = useState(false);

  const load = () => {
    api.get("/lesson-comments", { params: { offering_id: offeringId, lesson_id: lessonId } })
      .then(({ data }) => setItems(Array.isArray(data) ? data : []))
      .catch(() => {});
  };
  useEffect(() => { load(); }, [offeringId, lessonId]); // eslint-disable-line react-hooks/exhaustive-deps

  const post = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    setPosting(true);
    try {
      await api.post("/lesson-comments", { offering_id: offeringId, lesson_id: lessonId, body: text.trim() });
      setText("");
      load();
    } catch (err) { toast.error(formatApiError(err)); }
    setPosting(false);
  };

  return (
    <div className="mt-3 border-t border-border pt-3 space-y-3" data-testid={`video-comments-${lessonId}`}>
      <div className="flex items-center gap-2 text-sm font-semibold">
        <MessageCircle className="w-4 h-4" /> Comments
      </div>
      {items.length === 0 && <p className="text-xs text-muted-foreground">No comments yet — be the first.</p>}
      {items.map((c) => (
        <div key={c.id} className="rounded-lg bg-muted/50 p-3 text-sm">
          <span className="font-semibold">{c.author_name || "Learner"}:</span> {c.body}
        </div>
      ))}
      <form onSubmit={post} className="flex items-start gap-2">
        <Textarea value={text} onChange={(e) => setText(e.target.value)}
          placeholder="Add a comment…" className="min-h-[44px] text-sm" data-testid={`video-comment-input-${lessonId}`} />
        <Button type="submit" size="sm" disabled={posting} data-testid={`video-comment-submit-${lessonId}`}>Post</Button>
      </form>
    </div>
  );
}
