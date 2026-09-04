import React, { useEffect, useState } from "react";
import api, { formatApiError } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Trophy } from "lucide-react";

const fmtTime = (s) => {
  if (s == null) return "—";
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}m ${sec}s`;
};

export default function LeaderboardPanel() {
  const [quizzes, setQuizzes] = useState([]);
  const [quizId, setQuizId] = useState("");
  const [rows, setRows] = useState([]);
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    api.get("/quizzes").then(({ data }) => setQuizzes(data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!quizId) { setRows([]); return; }
    api.get(`/quizzes/${quizId}/leaderboard`)
      .then(({ data }) => setRows(data))
      .catch((e) => { toast.error(formatApiError(e)); setRows([]); });
  }, [quizId]);

  const quiz = quizzes.find((q) => q.id === quizId);

  return (
    <div className="space-y-6" data-testid="leaderboard-panel">
      <div className="flex items-center gap-3">
        <Trophy className="w-5 h-5 text-primary" />
        <Select value={quizId} onValueChange={(v) => { setQuizId(v); setExpanded(null); }}>
          <SelectTrigger className="h-10 w-72" data-testid="leaderboard-quiz-select"><SelectValue placeholder="Pick a quiz to view results…" /></SelectTrigger>
          <SelectContent>{quizzes.map((q) => <SelectItem key={q.id} value={q.id}>{q.title}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      {quizId && rows.length === 0 && (
        <div className="text-sm text-muted-foreground">No submissions yet for this quiz.</div>
      )}

      {quizId && rows.length > 0 && (
        <div className="rounded-lg border border-border bg-card/60 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Rank</TableHead>
                <TableHead>Student</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Time taken</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <React.Fragment key={r.attempt_id}>
                  <TableRow data-testid={`leaderboard-row-${r.attempt_id}`}>
                    <TableCell className="font-mono">
                      {r.rank <= 3 ? <Badge className="bg-gradient-hot text-white border-0">#{r.rank}</Badge> : `#${r.rank}`}
                    </TableCell>
                    <TableCell className="font-serif">{r.user_name}</TableCell>
                    <TableCell>{r.total_score}</TableCell>
                    <TableCell className="tabular">{fmtTime(r.time_taken_seconds)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {r.submitted_at ? new Date(r.submitted_at).toLocaleString() : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={r.status === "graded" ? "default" : "outline"} className="text-[10px] uppercase tracking-widest">{r.status}</Badge>
                    </TableCell>
                    <TableCell>
                      <button type="button" className="text-xs text-primary link-underline"
                        onClick={() => setExpanded(expanded === r.attempt_id ? null : r.attempt_id)}
                        data-testid={`leaderboard-breakdown-${r.attempt_id}`}>
                        {expanded === r.attempt_id ? "Hide" : "View"} breakdown
                      </button>
                    </TableCell>
                  </TableRow>
                  {expanded === r.attempt_id && quiz && (
                    <TableRow>
                      <TableCell colSpan={7} className="bg-background/60">
                        <div className="space-y-3 py-2">
                          {(quiz.questions || []).map((q, qi) => (
                            <div key={q.id || qi} className="text-sm border-b border-border last:border-0 pb-2">
                              <div className="font-medium">{qi + 1}. {q.prompt}</div>
                              <div className="text-muted-foreground mt-1">
                                Response: {
                                  q.type === "paragraph"
                                    ? (r.answers?.[qi] || "(no answer)")
                                    : Array.isArray(r.answers?.[qi])
                                      ? (r.answers[qi].map((oi) => q.options?.[oi]).join(", ") || "(no answer)")
                                      : (r.answers?.[qi] != null ? q.options?.[r.answers[qi]] : "(no answer)")
                                }
                              </div>
                              {q.type === "paragraph" && r.manual_scores?.[q.id] != null && (
                                <div className="text-xs text-primary mt-1">Awarded {r.manual_scores[q.id]}/{q.points} pts{r.feedback?.[q.id] ? ` — ${r.feedback[q.id]}` : ""}</div>
                              )}
                            </div>
                          ))}
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
