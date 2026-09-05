import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { lifePathNumber, expressionNumber, describeNumber } from "@/lib/tools/numerology";

function NumberBadge({ label, number, colorClass, profile }) {
  return (
    <div className="text-center">
      <div className="eyebrow">{label}</div>
      <div className={`font-serif text-7xl mt-3 tabular ${colorClass}`}>{number ?? "—"}</div>
      <div className="font-serif text-lg mt-1">{profile.title}</div>
    </div>
  );
}

function NumberDetail({ profile }) {
  const { t } = useTranslation();
  return (
    <div>
      <div className="flex flex-wrap gap-2 justify-center">
        {profile.traits.map((tr) => (
          <Badge key={tr} variant="outline">{tr}</Badge>
        ))}
      </div>
      <p className="mt-3 text-xs text-muted-foreground text-center">{t("tools.numerology.rulingPlanet")} · {profile.rulingPlanet}</p>
      {profile.summary && (
        <p className="mt-3 text-sm text-foreground/80 leading-relaxed">
          {profile.summary}
          {profile.careerPaths.length > 0 && ` ${t("tools.numerology.careerPaths")}: ${profile.careerPaths.join(", ")}.`}
        </p>
      )}
    </div>
  );
}

export default function NumerologyTool() {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [dob, setDob] = useState("");
  const [system, setSystem] = useState("pythagorean");
  const [result, setResult] = useState(null);

  const submit = (e) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error(t("tools.numerology.needName"));
      return;
    }
    setResult({
      life: lifePathNumber(dob),
      expr: expressionNumber(name, system),
    });
  };

  return (
    <div className="grid md:grid-cols-2 gap-10">
      <form onSubmit={submit} className="space-y-4">
        <div className="eyebrow">{t("tools.numerology.heading")}</div>
        <h3 className="font-serif text-3xl">{t("tools.numerology.title")}</h3>
        <p className="text-sm text-muted-foreground">{t("tools.numerology.subtext")}</p>
        <div>
          <Label className="eyebrow">{t("tools.numerology.fullName")}</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} data-testid="numerology-name" className="mt-2 h-11" />
        </div>
        <div>
          <Label className="eyebrow">{t("tools.numerology.dob")}</Label>
          <Input type="date" value={dob} onChange={(e) => setDob(e.target.value)} data-testid="numerology-dob" className="mt-2 h-11" />
        </div>
        <div>
          <Label className="eyebrow">{t("tools.numerology.system")}</Label>
          <Select value={system} onValueChange={setSystem}>
            <SelectTrigger className="mt-2 h-11" data-testid="numerology-system">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pythagorean">{t("tools.numerology.pythagorean")}</SelectItem>
              <SelectItem value="chaldean">{t("tools.numerology.chaldean")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button type="submit" data-testid="numerology-submit" className="rounded-full px-8">{t("tools.numerology.compute")}</Button>
      </form>
      {result && (
        <div className="rounded-lg border border-border p-8 bg-card/50 animate-fade-in-up" data-testid="numerology-result">
          <div className="grid grid-cols-2 gap-6">
            <NumberBadge label={t("tools.numerology.lifePath")} number={result.life.number} colorClass="text-accent" profile={describeNumber(result.life.number)} />
            <NumberBadge label={t("tools.numerology.expression")} number={result.expr.number} colorClass="text-primary" profile={describeNumber(result.expr.number)} />
          </div>
          <div className="grid md:grid-cols-2 gap-8 mt-8">
            <NumberDetail profile={describeNumber(result.life.number)} />
            <NumberDetail profile={describeNumber(result.expr.number)} />
          </div>
          <p className="mt-8 text-xs text-muted-foreground italic">{t("tools.numerology.subtext")}</p>
        </div>
      )}
    </div>
  );
}
