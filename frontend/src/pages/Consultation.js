import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import api, { formatApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { CheckCircle2 } from "lucide-react";

export default function Consultation() {
  const { t } = useTranslation();
  const [f, setF] = useState({ name: "", email: "", phone: "", interest: "", consent: false });
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    if (!f.consent) return toast.error(t("consultationPage.consentRequired"));
    setBusy(true);
    try {
      const { data } = await api.post("/consultations", f);
      setResult(data);
      toast.success(t("consultationPage.received"));
    } catch (err) { toast.error(formatApiError(err)); }
    setBusy(false);
  };

  return (
    <div className="site-container py-16">
      <div className="grid lg:grid-cols-[1.05fr_1fr] gap-16 items-start">
        <div>
          <div className="chip bg-primary/15 text-primary border border-primary/30 mb-4">{t("consultationPage.badge")}</div>
          <h1 className="text-5xl md:text-6xl font-serif tracking-tight leading-tight">{t("consultationPage.titlePlain")}<br/>{t("consultationPage.titleRest")}</h1>
          <p className="mt-6 text-lg text-foreground/80 leading-relaxed max-w-lg">
            {t("consultationPage.subtextPre")} <strong>{t("consultationPage.subtextStrong")}</strong>{t("consultationPage.subtextPost")}
          </p>
          <ul className="mt-8 space-y-3 text-sm text-foreground/70">
            <li className="flex gap-3"><CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5"/> {t("consultationPage.bullet1")}</li>
            <li className="flex gap-3"><CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5"/> {t("consultationPage.bullet2")}</li>
            <li className="flex gap-3"><CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5"/> {t("consultationPage.bullet3")}</li>
            <li className="flex gap-3"><CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5"/> {t("consultationPage.bullet4")}</li>
          </ul>
        </div>

        {result ? (
          <div className="rounded-lg border border-border p-10 bg-card/60" data-testid="consultation-success">
            <div className="w-14 h-14 rounded-full bg-primary/20 flex items-center justify-center mb-6">
              <CheckCircle2 className="w-6 h-6 text-primary" />
            </div>
            <h3 className="font-serif text-3xl">{t("consultationPage.thankYou")}</h3>
            <p className="mt-4 text-foreground/80 leading-relaxed">
              {t("consultationPage.autoAssigned")} <strong>{result.expected_callback}</strong>.
            </p>
            <p className="mt-2 text-xs text-muted-foreground">{t("consultationPage.status")}: <span className="tabular">{result.status}</span> · {t("consultationPage.ref")}: {result.id}</p>
          </div>
        ) : (
          <form onSubmit={submit} className="rounded-lg border border-border p-8 md:p-10 bg-card/60 space-y-5" data-testid="consultation-form">
            <div>
              <Label className="eyebrow">{t("consultationPage.yourName")}</Label>
              <Input value={f.name} onChange={set("name")} required data-testid="consult-name" className="mt-2 h-12" />
            </div>
            <div>
              <Label className="eyebrow">{t("consultationPage.email")}</Label>
              <Input type="email" value={f.email} onChange={set("email")} required data-testid="consult-email" className="mt-2 h-12" />
            </div>
            <div>
              <Label className="eyebrow">{t("consultationPage.phone")}</Label>
              <Input value={f.phone} onChange={set("phone")} required data-testid="consult-phone" className="mt-2 h-12" placeholder="+91 …" />
            </div>
            <div>
              <Label className="eyebrow">{t("consultationPage.interestLabel")}</Label>
              <Textarea value={f.interest} onChange={set("interest")} required data-testid="consult-interest"
                className="mt-2 min-h-[100px] font-serif italic" placeholder={t("consultationPage.interestPlaceholder")} />
            </div>
            <label className="flex items-start gap-3 cursor-pointer">
              <Checkbox checked={f.consent} onCheckedChange={(v)=>setF({...f, consent: !!v})} data-testid="consult-consent" className="mt-1" />
              <span className="text-sm text-muted-foreground leading-relaxed">
                {t("consultationPage.consentText")}
              </span>
            </label>
            <Button disabled={busy} type="submit" data-testid="consult-submit" className="w-full h-12 rounded-full">
              {busy ? t("consultationPage.sending") : t("consultationPage.submit")}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
