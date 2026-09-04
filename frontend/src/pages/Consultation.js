import React, { useState } from "react";
import api, { formatApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { CheckCircle2 } from "lucide-react";

export default function Consultation() {
  const [f, setF] = useState({ name: "", email: "", phone: "", interest: "", consent: false });
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    if (!f.consent) return toast.error("Please consent to be contacted.");
    setBusy(true);
    try {
      const { data } = await api.post("/consultations", f);
      setResult(data);
      toast.success("Request received.");
    } catch (err) { toast.error(formatApiError(err)); }
    setBusy(false);
  };

  return (
    <div className="site-container py-16">
      <div className="grid lg:grid-cols-[1.05fr_1fr] gap-16 items-start">
        <div>
          <div className="chip bg-primary/15 text-primary border border-primary/30 mb-4">Free pathway consultation</div>
          <h1 className="text-5xl md:text-6xl font-serif tracking-tight leading-tight">A human,<br/>not a paywall.</h1>
          <p className="mt-6 text-lg text-foreground/80 leading-relaxed max-w-lg">
            Not sure where to begin — Sanskrit, the Gītā, meditation, jyotiṣa? Rather than lose you to that hesitation,
            we'll have someone from our academic staff <strong>reach out personally</strong>, understand your interest, and
            recommend a starting pathway.
          </p>
          <ul className="mt-8 space-y-3 text-sm text-foreground/70">
            <li className="flex gap-3"><CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5"/> Honest pathway advice, not a hard pitch.</li>
            <li className="flex gap-3"><CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5"/> Auto-assigned to the staff member with the lightest backlog.</li>
            <li className="flex gap-3"><CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5"/> Contact details used to help — not to spam. Consented under DPDP.</li>
            <li className="flex gap-3"><CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5"/> Expected callback within 24 hours (queued fallback if we're at capacity).</li>
          </ul>
        </div>

        {result ? (
          <div className="rounded-lg border border-border p-10 bg-card/60" data-testid="consultation-success">
            <div className="w-14 h-14 rounded-full bg-primary/20 flex items-center justify-center mb-6">
              <CheckCircle2 className="w-6 h-6 text-primary" />
            </div>
            <h3 className="font-serif text-3xl">Thank you.</h3>
            <p className="mt-4 text-foreground/80 leading-relaxed">
              Your request has been auto-assigned. Expected callback: <strong>{result.expected_callback}</strong>.
            </p>
            <p className="mt-2 text-xs text-muted-foreground">Status: <span className="tabular">{result.status}</span> · Ref: {result.id}</p>
          </div>
        ) : (
          <form onSubmit={submit} className="rounded-lg border border-border p-8 md:p-10 bg-card/60 space-y-5" data-testid="consultation-form">
            <div>
              <Label className="eyebrow">Your name</Label>
              <Input value={f.name} onChange={set("name")} required data-testid="consult-name" className="mt-2 h-12" />
            </div>
            <div>
              <Label className="eyebrow">Email</Label>
              <Input type="email" value={f.email} onChange={set("email")} required data-testid="consult-email" className="mt-2 h-12" />
            </div>
            <div>
              <Label className="eyebrow">Phone (with country code)</Label>
              <Input value={f.phone} onChange={set("phone")} required data-testid="consult-phone" className="mt-2 h-12" placeholder="+91 …" />
            </div>
            <div>
              <Label className="eyebrow">What are you drawn to?</Label>
              <Textarea value={f.interest} onChange={set("interest")} required data-testid="consult-interest"
                className="mt-2 min-h-[100px] font-serif italic" placeholder="I've always wanted to understand the Bhagavad Gītā, but…" />
            </div>
            <label className="flex items-start gap-3 cursor-pointer">
              <Checkbox checked={f.consent} onCheckedChange={(v)=>setF({...f, consent: !!v})} data-testid="consult-consent" className="mt-1" />
              <span className="text-sm text-muted-foreground leading-relaxed">
                I consent to be contacted by phone or email regarding my pathway. My details will not be sold or used for spam.
              </span>
            </label>
            <Button disabled={busy} type="submit" data-testid="consult-submit" className="w-full h-12 rounded-full">
              {busy ? "Sending…" : "Request my pathway"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
