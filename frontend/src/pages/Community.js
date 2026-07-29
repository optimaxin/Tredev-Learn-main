import React, { useEffect, useState } from "react";
import api, { formatApiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export default function Community() {
  const { user } = useAuth();
  const [posts, setPosts] = useState([]);
  const [body, setBody] = useState("");

  const load = async () => { const { data } = await api.get("/community/posts"); setPosts(data); };
  useEffect(() => { load(); }, []);

  const submit = async (e) => {
    e.preventDefault();
    if (!user) return toast.error("Please sign in to post.");
    if (!body.trim()) return;
    try { await api.post("/community/posts", { body }); setBody(""); load(); toast.success("Posted."); }
    catch (err) { toast.error(formatApiError(err)); }
  };

  return (
    <div className="max-w-3xl mx-auto py-16 px-6">
      <div className="overline mb-3">Community · moderated</div>
      <h1 className="text-5xl font-serif tracking-tight">A room worth being in.</h1>
      <p className="mt-4 text-muted-foreground max-w-xl">
        Disagreement about interpretation is welcome; contempt for a tradition or a person is not. No caste-based gatekeeping, no communal politics, no unqualified prediction or medical advice.
      </p>

      {user && (
        <form onSubmit={submit} className="mt-10 rounded-lg border border-border bg-card/60 p-5" data-testid="community-form">
          <Textarea value={body} onChange={(e)=>setBody(e.target.value)} data-testid="community-body"
            placeholder="Share a reflection, ask a question, or anchor a discussion to a verse…" className="min-h-[100px] font-serif" />
          <Button type="submit" data-testid="community-submit" className="mt-3 rounded-full">Post</Button>
        </form>
      )}

      <div className="mt-10 space-y-4">
        {posts.map((p) => (
          <article key={p.id} className="rounded-lg border border-border bg-card/40 p-6" data-testid={`post-${p.id}`}>
            <div className="flex items-baseline gap-3 mb-2">
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-sm font-medium text-primary">
                {p.author_name?.[0] || "T"}
              </div>
              <div className="font-serif text-lg">{p.author_name}</div>
              <div className="text-xs text-muted-foreground ml-auto tabular">{new Date(p.created_at).toLocaleDateString()}</div>
            </div>
            <p className="text-foreground/85 leading-relaxed">{p.body}</p>
          </article>
        ))}
      </div>
    </div>
  );
}
