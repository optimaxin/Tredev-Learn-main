import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import api, { formatApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Video, Radio, ChevronRight, HelpCircle, CheckCircle2, ScrollText, Award, Send, Zap } from "lucide-react";

/** Sample-style mini certificate card that a learner sees for each earned credential. */
function CertificatePreview({ c }) {
  return (
    <div className="relative rounded-2xl p-1 bg-gradient-to-br from-amber-500 via-orange-500 to-fuchsia-600 shadow-xl" data-testid={`cert-preview-${c.code}`}>
      <div className="relative rounded-[14px] p-6 md:p-8 overflow-hidden"
           style={{ background: "linear-gradient(135deg, #fdf7e8 0%, #f6ecd0 50%, #f0dfae 100%)" }}>
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none opacity-[0.06]">
          <span className="text-[14rem] leading-none font-devanagari text-amber-900">ॐ</span>
        </div>
        <div className="absolute inset-4 border-2 border-amber-800/40 rounded-lg pointer-events-none" />
        <div className="absolute inset-6 border border-amber-800/25 rounded pointer-events-none" />
        <div className="relative text-center text-amber-950">
          <div className="text-[10px] tracking-[0.3em] uppercase text-amber-800/70">Tredev Learn</div>
          <div className="font-devanagari text-lg mt-1 text-amber-900">प्रमाणपत्रम्</div>
          <div className="mt-4 text-[10px] tracking-widest uppercase text-amber-800/70">This is to certify that</div>
          <div className="font-display font-bold text-2xl md:text-3xl mt-1 text-amber-950 leading-tight">
            {c.user_name}
          </div>
          <div className="mt-3 text-[10px] tracking-widest uppercase text-amber-800/70">has completed</div>
          <div className="font-display italic text-lg text-amber-900 mt-1 leading-tight">{c.offering_title}</div>

          <div className="flex items-center justify-center gap-3 my-5">
            <div className="h-px flex-1 bg-gradient-to-r from-transparent to-amber-800/40" />
            <span className="font-devanagari text-lg text-amber-800">॥</span>
            <div className="h-px flex-1 bg-gradient-to-l from-transparent to-amber-800/40" />
          </div>

          {/* Seal + signature */}
          <div className="flex items-center justify-center gap-6">
            <div className="text-center">
              <div className="font-editorial italic text-lg text-amber-950" style={{ fontFamily: '"Cormorant Garamond", serif' }}>
                {(c.acharya_name || "").split(" ").slice(-1)[0] || "V. Shastri"}
              </div>
              <div className="border-t border-amber-800/60 pt-1 mt-1 max-w-[150px] mx-auto">
                <div className="font-serif text-xs text-amber-900 font-semibold">{c.acharya_name || "Ācharya"}</div>
                <div className="text-[9px] tracking-widest uppercase text-amber-800/70">Signed for accuracy</div>
              </div>
            </div>
            <div className="relative w-16 h-16 shrink-0">
              <div className="absolute inset-0 rounded-full bg-gradient-to-br from-amber-600 to-red-700 flex items-center justify-center shadow-lg">
                <div className="w-[86%] h-[86%] rounded-full border-2 border-amber-100/70 flex items-center justify-center">
                  <div className="font-devanagari text-lg text-amber-50 leading-none">ॐ</div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 flex items-center justify-between text-[9px] tracking-widest uppercase text-amber-800/80 border-t border-amber-800/25 pt-3">
            <div>{new Date(c.issued_at).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" })}</div>
            <Link to={`/verify/${c.code}`} className="underline decoration-amber-800/40 hover:text-amber-900">Verify</Link>
            <div className="font-mono">{c.code}</div>
          </div>
          {c.revoked && <div className="mt-3 text-xs text-red-700 font-semibold">REVOKED</div>}
        </div>
      </div>
    </div>
  );
}

export default function LearnerDashboard() {
  const { user } = useAuth();
  const [enrollments, setEnrollments] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [certs, setCerts] = useState([]);
  const [doubts, setDoubts] = useState([]);
  const [events, setEvents] = useState([]);
  const [doubtOfferingId, setDoubtOfferingId] = useState("");
  const [doubtText, setDoubtText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    const [e, s, c, d, w, reg] = await Promise.all([
      api.get("/enrollments/mine"),
      api.get("/live-sessions/mine-learner").catch(()=>({data:[]})),
      api.get("/certificates/mine").catch(()=>({data:[]})),
      api.get("/doubts/mine").catch(()=>({data:[]})),
      api.get("/webinars").catch(()=>({data:[]})),
      api.get("/webinars/my-registrations").catch(()=>({data:[]})),
    ]);
    setEnrollments(e.data);
    setSessions(s.data);
    setCerts(c.data);
    setDoubts(d.data);
    const regSet = new Set(reg.data);
    setEvents(w.data.filter((x) => regSet.has(x.id)));
  };
  useEffect(() => { if (user) load(); }, [user?.id]);

  const join = async (id) => {
    try {
      const { data } = await api.post(`/live-sessions/${id}/join`);
      toast.info("MOCKED PlugNmeet — opening placeholder room.");
      window.open(data.join_url, "_blank");
    } catch { toast.error("Could not join"); }
  };

  const askDoubt = async (e) => {
    e.preventDefault();
    if (!doubtOfferingId) return toast.error("Please choose a course.");
    if (!doubtText.trim()) return toast.error("Please describe your doubt.");
    setSubmitting(true);
    try {
      await api.post("/doubts", { offering_id: doubtOfferingId, question: doubtText });
      toast.success("Your question has been sent to the Tredev Learn team.");
      setDoubtText("");
      load();
    } catch (err) { toast.error(formatApiError(err)); }
    setSubmitting(false);
  };

  return (
    <div className="site-container py-16">
      <div className="chip bg-primary/15 text-primary border border-primary/30 mb-3">LEARNER PORTAL</div>
      <h1 className="text-5xl font-display font-bold tracking-tight">Welcome, {user?.name}.</h1>

      <Tabs defaultValue="courses" className="mt-10">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="courses" data-testid="learner-tab-courses">My study</TabsTrigger>
          <TabsTrigger value="live" data-testid="learner-tab-live">Live sessions</TabsTrigger>
          <TabsTrigger value="events" data-testid="learner-tab-events">Events ({events.length})</TabsTrigger>
          <TabsTrigger value="doubts" data-testid="learner-tab-doubts">Ask a doubt</TabsTrigger>
          <TabsTrigger value="certs" data-testid="learner-tab-certs">Certificates</TabsTrigger>
        </TabsList>

        {/* MY STUDY */}
        <TabsContent value="courses" className="mt-8">
          {enrollments.length === 0 && (
            <div className="text-muted-foreground text-sm">
              You have not enrolled in anything yet. <Link to="/courses" className="text-primary link-underline">Browse the catalogue</Link>.
            </div>
          )}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {enrollments.map((e) => (
              <Link key={e.id} to={`/courses/${e.offering_id}`} data-testid={`enrollment-${e.id}`}
                className="rounded-2xl border border-border p-6 card-elevated bg-card">
                <Badge variant="outline" className="text-[10px] uppercase tracking-widest">{e.offering?.type?.replace("_"," ")}</Badge>
                <div className="font-display font-bold text-xl mt-3 leading-tight">{e.offering?.title}</div>
                <div className="text-xs text-muted-foreground mt-2">Enrolled {new Date(e.enrolled_at).toLocaleDateString()}</div>
                {(() => {
                  const total = (e.offering?.modules || []).length;
                  const done = (e.completed_lessons || []).length;
                  const pct = total ? Math.round((done / total) * 100) : (e.progress || 0);
                  return (
                    <div className="mt-4">
                      <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-1">
                        <span>{total ? `${done}/${total} lessons` : "Progress"}</span>
                        <span className="tabular">{pct}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div className="h-full bg-gradient-hot transition-all duration-500" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })()}
                <div className="mt-5 text-sm text-primary flex items-center">Continue <ChevronRight className="w-4 h-4 ml-1"/></div>
              </Link>
            ))}
          </div>
        </TabsContent>

        {/* LIVE */}
        <TabsContent value="live" className="mt-8">
          <div className="space-y-3">
            {sessions.map((s) => (
              <div key={s.id} className="rounded-xl border border-border p-5 bg-card flex items-center gap-4" data-testid={`session-${s.id}`}>
                <div className="w-12 h-12 rounded-full bg-primary/15 flex items-center justify-center text-primary">
                  {s.mode === "broadcast" ? <Radio className="w-5 h-5" /> : <Video className="w-5 h-5" />}
                </div>
                <div className="flex-1">
                  <div className="font-display font-semibold text-lg">{s.title}</div>
                  <div className="text-xs text-muted-foreground tabular">
                    {new Date(s.starts_at).toLocaleString()} · {s.duration_min} min · {s.mode}
                  </div>
                </div>
                {s.can_join ? (
                  <Button onClick={() => join(s.id)} data-testid={`join-${s.id}`} className="rounded-full px-6 bg-gradient-hot text-white border-0 animate-glow">
                    Join now
                  </Button>
                ) : (
                  <Badge variant="outline" className="text-[10px] uppercase tracking-widest">Opens 5 min before</Badge>
                )}
              </div>
            ))}
            {sessions.length === 0 && <div className="text-muted-foreground text-sm">No upcoming sessions.</div>}
          </div>
        </TabsContent>

        {/* EVENTS — registered webinars/events */}
        <TabsContent value="events" className="mt-8">
          <p className="text-sm text-muted-foreground mb-5">Webinars and events you've registered for.</p>
          <div className="space-y-3">
            {events.map((w) => (
              <div key={w.id} className="rounded-xl border border-border p-5 bg-card flex items-center gap-4 flex-wrap" data-testid={`learner-event-${w.id}`}>
                {w.cover_image
                  ? <img src={w.cover_image} alt="" className="w-16 h-16 rounded-lg object-cover shrink-0" />
                  : <div className="w-12 h-12 rounded-full bg-primary/15 grid place-items-center text-primary shrink-0"><Zap className="w-5 h-5" /></div>}
                <div className="flex-1 min-w-[220px]">
                  <div className="font-display font-semibold text-lg">{w.title}</div>
                  <div className="text-xs text-muted-foreground tabular">
                    {new Date(w.starts_at).toLocaleString()} · {w.duration_min} min{w.mentor_name ? ` · with ${w.mentor_name}` : ""}
                  </div>
                  <Badge variant="outline" className="text-[10px] uppercase tracking-widest text-primary border-primary/40 mt-2">Registered</Badge>
                </div>
                {w.join_url
                  ? <a href={w.join_url} target="_blank" rel="noreferrer" className="rounded-full bg-gradient-hot text-white h-10 px-6 inline-flex items-center gap-2 text-sm font-medium" data-testid={`event-join-${w.id}`}><Video className="w-4 h-4" /> Join link</a>
                  : <Badge variant="outline" className="text-[10px] uppercase tracking-widest">Link nearer the date</Badge>}
              </div>
            ))}
            {events.length === 0 && <div className="text-muted-foreground text-sm">You haven't registered for any events yet. <Link to="/webinars" className="text-primary link-underline">Browse webinars</Link>.</div>}
          </div>
        </TabsContent>

        {/* ASK A DOUBT */}
        <TabsContent value="doubts" className="mt-8">
          <div className="grid lg:grid-cols-[1fr_1.4fr] gap-8">
            {/* Ask form */}
            <form onSubmit={askDoubt} className="rounded-2xl border border-border p-6 bg-card space-y-4" data-testid="doubt-form">
              <div className="flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-primary" />
                <h3 className="font-display font-bold text-xl">Ask a doubt</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Someone from the Tredev Learn team will respond — usually within 24 hours.
              </p>
              <div>
                <label className="overline">Course</label>
                <Select value={doubtOfferingId} onValueChange={setDoubtOfferingId}>
                  <SelectTrigger data-testid="doubt-course" className="mt-2 h-11"><SelectValue placeholder="Which course is this about?" /></SelectTrigger>
                  <SelectContent>
                    {enrollments.map((e) => (
                      <SelectItem key={e.offering_id} value={e.offering_id}>{e.offering?.title}</SelectItem>
                    ))}
                    {enrollments.length === 0 && <div className="p-3 text-xs text-muted-foreground">Enroll in a course first to ask a doubt.</div>}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="overline">Your question</label>
                <Textarea value={doubtText} onChange={(e)=>setDoubtText(e.target.value)}
                  className="mt-2 min-h-[130px] font-editorial italic"
                  placeholder="e.g. In BG 2.47, is 'phala' translated as 'fruit' or 'result'? Which commentary do we follow?"
                  data-testid="doubt-text" />
              </div>
              <Button type="submit" disabled={submitting} data-testid="doubt-submit"
                className="w-full rounded-full h-11 bg-gradient-hot text-white border-0">
                {submitting ? "Sending…" : (<><Send className="w-4 h-4 mr-2" /> Send my question</>)}
              </Button>
            </form>

            {/* My doubts thread */}
            <div>
              <h3 className="font-display font-bold text-xl mb-4">Your questions</h3>
              <div className="space-y-3">
                {doubts.map((d) => (
                  <div key={d.id} className="rounded-2xl border border-border p-5 bg-card" data-testid={`my-doubt-${d.id}`}>
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant={d.status === "answered" ? "default" : "outline"} className="text-[10px] uppercase tracking-widest">
                        {d.status}
                      </Badge>
                      {d.offering_title && <span className="text-xs text-muted-foreground">{d.offering_title}</span>}
                      <span className="text-xs text-muted-foreground ml-auto tabular">{new Date(d.created_at).toLocaleDateString()}</span>
                    </div>
                    <div className="font-editorial italic text-lg">"{d.question}"</div>
                    {d.answer ? (
                      <div className="mt-4 border-l-2 border-primary pl-4">
                        <div className="text-xs text-primary uppercase tracking-widest mb-1">Answer</div>
                        <p className="text-sm text-foreground/90 leading-relaxed">{d.answer}</p>
                        <div className="text-[10px] text-muted-foreground mt-2">
                          — Tredev Learn team · {d.answered_at ? new Date(d.answered_at).toLocaleDateString() : ""}
                        </div>
                      </div>
                    ) : (
                      <div className="mt-3 text-xs text-muted-foreground italic">Awaiting a response…</div>
                    )}
                  </div>
                ))}
                {doubts.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-border p-8 text-center text-muted-foreground text-sm">
                    You haven't asked any doubts yet.
                  </div>
                )}
              </div>
            </div>
          </div>
        </TabsContent>

        {/* CERTIFICATES */}
        <TabsContent value="certs" className="mt-8">
          {certs.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-16 text-center">
              <Award className="w-10 h-10 text-muted-foreground mx-auto mb-4" />
              <div className="text-muted-foreground">Complete a course to earn your first credential.</div>
              <Link to="/courses" className="text-primary link-underline text-sm mt-3 inline-block">Browse courses →</Link>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-8" data-testid="learner-certs">
              {certs.map((c) => (
                <CertificatePreview key={c.id} c={c} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
