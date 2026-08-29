import React, { useState } from "react";
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
  return (
    <div>
      <div className="flex flex-wrap gap-2 justify-center">
        {profile.traits.map((t) => (
          <Badge key={t} variant="outline">{t}</Badge>
        ))}
      </div>
      <p className="mt-3 text-xs text-muted-foreground text-center">Ruling planet · {profile.rulingPlanet}</p>
      {profile.summary && (
        <p className="mt-3 text-sm text-foreground/80 leading-relaxed">
          {profile.summary}
          {profile.careerPaths.length > 0 && ` Career & life path: ${profile.careerPaths.join(", ")}.`}
        </p>
      )}
    </div>
  );
}

export default function NumerologyTool() {
  const [name, setName] = useState("");
  const [dob, setDob] = useState("");
  const [system, setSystem] = useState("pythagorean");
  const [result, setResult] = useState(null);

  const submit = (e) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Enter a full name to compute the expression number.");
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
        <div className="eyebrow">Numerology · as śāstra</div>
        <h3 className="font-serif text-3xl">Numbers as symbols of qualities.</h3>
        <p className="text-sm text-muted-foreground">Not a prediction of your future — a study of number symbolism.</p>
        <div>
          <Label className="eyebrow">Full name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} data-testid="numerology-name" className="mt-2 h-11" />
        </div>
        <div>
          <Label className="eyebrow">Date of birth</Label>
          <Input type="date" value={dob} onChange={(e) => setDob(e.target.value)} data-testid="numerology-dob" className="mt-2 h-11" />
        </div>
        <div>
          <Label className="eyebrow">System</Label>
          <Select value={system} onValueChange={setSystem}>
            <SelectTrigger className="mt-2 h-11" data-testid="numerology-system">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pythagorean">Pythagorean</SelectItem>
              <SelectItem value="chaldean">Chaldean</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button type="submit" data-testid="numerology-submit" className="rounded-full px-8">Compute</Button>
      </form>
      {result && (
        <div className="rounded-lg border border-border p-8 bg-card/50 animate-fade-in-up" data-testid="numerology-result">
          <div className="grid grid-cols-2 gap-6">
            <NumberBadge label="Life path" number={result.life.number} colorClass="text-accent" profile={describeNumber(result.life.number)} />
            <NumberBadge label="Expression" number={result.expr.number} colorClass="text-primary" profile={describeNumber(result.expr.number)} />
          </div>
          <div className="grid md:grid-cols-2 gap-8 mt-8">
            <NumberDetail profile={describeNumber(result.life.number)} />
            <NumberDetail profile={describeNumber(result.expr.number)} />
          </div>
          <p className="mt-8 text-xs text-muted-foreground italic">Not a prediction of your future — a study of number symbolism.</p>
        </div>
      )}
    </div>
  );
}
