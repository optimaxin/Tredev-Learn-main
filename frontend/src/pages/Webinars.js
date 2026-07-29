import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api, { formatApiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Clock, Zap, CheckCircle2, X, Calendar, Video } from "lucide-react";
import { toast } from "sonner";

function Countdown({ startsInSeconds }) {
  const [r, setR] = useState(startsInSeconds);
  useEffect(() => {
    setR(startsInSeconds);
    const t = setInterval(() => setR((x) => Math.max(0, x - 1)), 1000);
    return () => clearInterval(t);
  }, [startsInSeconds]);
  if (r <= 0) return <span className="chip bg-secondary text-white">Live now</span>;
  const d = Math.floor(r / 86400), h = Math.floor((r % 86400) / 3600),
        m = Math.floor((r % 3600) / 60), s = r % 60;
  return (
    <div className="flex gap-2">
      {[["Days", d], ["Hrs", h], ["Min", m], ["Sec", s]].map(([l, n], i) => (
        <div key={i} className="text-center bg-muted rounded-lg px-3 py-2 min-w-14">
          <div className="font-display font-bold text-2xl text-primary tabular">{String(n).padStart(2, "0")}</div>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{l}</div>
        </div>
      ))}
    </div>
  );
}

export default function Webinars() {
  const [webinars, setWebinars] = useState([]);
  const [confirm, setConfirm] = useState(null); // { payment_id, webinar, join_url }
  const [registering, setRegistering] = useState(null);
  const [registered, setRegistered] = useState(new Set());
  const { user } = useAuth();
  const nav = useNavigate();
  const load = () => api.get("/webinars").then((r) => setWebinars(r.data));
  const loadRegs = () => user
    ? api.get("/webinars/my-registrations").then((r) => setRegistered(new Set(r.data))).catch(()=>{})
    : setRegistered(new Set());
  useEffect(() => { load(); }, []);
  useEffect(() => { loadRegs(); /* eslint-disable-next-line */ }, [user?.id]);

  const register = async (w) => {
    if (!user) return nav("/login", { state: { from: "/webinars" } });
    setRegistering(w.id);
    try {
      const { data } = await api.post(`/webinars/${w.id}/register`);
      setConfirm(data);
      setRegistered((s) => new Set(s).add(w.id));
      load();
    } catch (e) { toast.error(formatApiError(e)); }
    setRegistering(null);
  };

  return (
    <div className="site-container py-16">
      <div className="chip bg-secondary/15 text-secondary border border-secondary/30 mb-4">
        <Zap className="w-3 h-3" /> LIVE & INTERACTIVE
      </div>
      <h1 className="font-display text-5xl md:text-6xl font-bold tracking-tight">
        Upcoming <span className="text-gradient-cosmic">Webinars</span>
      </h1>
      <p className="mt-4 text-lg text-muted-foreground max-w-2xl">
        Single-evening intensives. Low-commitment entry into serious study. Featured Ācharyas from the parampara.
      </p>

      <div className="mt-14 space-y-6">
        {webinars.map((w) => (
          <div key={w.id} className="rounded-2xl border border-border overflow-hidden glass card-elevated grid md:grid-cols-[280px_1fr_auto] gap-0" data-testid={`webinar-full-${w.id}`}>
            <div className="relative aspect-video md:aspect-auto md:h-full overflow-hidden">
              <img src={w.cover_image} alt="" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
            </div>
            <div className="p-6 md:p-8">
              <div className="flex items-center gap-2 flex-wrap mb-3">
                <span className="chip bg-primary/15 text-primary border border-primary/30">{new Date(w.starts_at).toLocaleString(undefined, { weekday: "long", day: "numeric", month: "short" })}</span>
                <span className="chip bg-muted">{new Date(w.starts_at).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}</span>
                {w.seats_remaining < 30 && <span className="chip bg-destructive text-destructive-foreground">Only {w.seats_remaining} seats left</span>}
              </div>
              <h2 className="font-display text-2xl md:text-3xl font-bold leading-tight">{w.title}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{w.description}</p>
              <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {w.duration_min} min</span>
                <span>with <strong className="text-foreground">{w.mentor_name}</strong></span>
              </div>
              <div className="mt-5">
                <Countdown startsInSeconds={w.starts_in_seconds} />
              </div>
            </div>
            <div className="p-6 md:p-8 flex flex-col justify-center md:border-l border-border md:min-w-[220px] text-center">
              <div className="font-display font-bold text-4xl text-gradient-hot tabular">₹{w.price_inr}</div>
              {w.orig_price_inr > w.price_inr && <div className="text-sm text-muted-foreground line-through tabular">₹{w.orig_price_inr}</div>}
              {registered.has(w.id) ? (
                <Button disabled data-testid={`webinar-full-registered-${w.id}`}
                  className="mt-5 rounded-full h-11 px-8 bg-primary text-primary-foreground border-0 disabled:opacity-100">
                  <CheckCircle2 className="w-4 h-4 mr-2" /> Registered
                </Button>
              ) : (
                <Button onClick={()=>register(w)} disabled={registering===w.id} data-testid={`webinar-full-register-${w.id}`}
                  className="mt-5 rounded-full bg-gradient-hot text-white border-0 btn-glow h-11 px-8">
                  {registering===w.id ? "Processing…" : "Register now"}
                </Button>
              )}
              <div className="mt-3 text-[10px] text-muted-foreground">Recording emailed after · lifetime access</div>
            </div>
          </div>
        ))}
        {webinars.length === 0 && <div className="text-center py-16 text-muted-foreground">No upcoming webinars.</div>}
      </div>

      {/* Registration confirmation */}
      {confirm && (
        <div className="fixed inset-0 z-[200] flex items-start justify-center p-4 overflow-y-auto bg-black/50 backdrop-blur-sm" onClick={()=>setConfirm(null)}>
          <div className="relative w-full max-w-md my-8 rounded-2xl bg-card border border-border p-8 text-center shadow-2xl" onClick={(e)=>e.stopPropagation()} data-testid="webinar-confirm">
            <button onClick={()=>setConfirm(null)} className="absolute top-4 right-4 text-muted-foreground hover:text-foreground" aria-label="Close"><X className="w-5 h-5" /></button>
            <div className="w-14 h-14 rounded-full bg-primary/15 text-primary grid place-items-center mx-auto"><CheckCircle2 className="w-8 h-8" /></div>
            <h3 className="font-display font-bold text-2xl mt-4">You're registered!</h3>
            <p className="text-sm text-muted-foreground mt-1">A confirmation has been recorded. Recording emailed after · lifetime access.</p>

            <div className="mt-6 text-left rounded-xl border border-border bg-background/60 p-5 space-y-3">
              <div className="font-display font-semibold text-lg">{confirm.webinar?.title}</div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="w-4 h-4" /> {confirm.webinar?.starts_at ? new Date(confirm.webinar.starts_at).toLocaleString() : "TBA"} · {confirm.webinar?.duration_min} min
              </div>
              {confirm.webinar?.mentor_name && <div className="text-sm text-muted-foreground">with <strong className="text-foreground">{confirm.webinar.mentor_name}</strong></div>}
              <div className="flex items-center justify-between border-t border-border pt-3 text-sm">
                <span className="text-muted-foreground">Payment ID</span>
                <span className="font-mono text-primary">{confirm.payment_id}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Amount</span>
                <span className="tabular">{confirm.webinar?.price_inr ? `₹${confirm.webinar.price_inr}` : "Free"}</span>
              </div>
              <p className="text-[10px] text-muted-foreground">{confirm.note}</p>
            </div>

            {confirm.join_url ? (
              <a href={confirm.join_url} target="_blank" rel="noreferrer" className="mt-5 inline-flex items-center gap-2 rounded-full bg-gradient-hot text-white h-11 px-8 font-medium" data-testid="webinar-join-link">
                <Video className="w-4 h-4" /> Join link
              </a>
            ) : (
              <Button onClick={()=>setConfirm(null)} className="mt-5 rounded-full h-11 px-8">Done</Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
