import React, { useEffect, useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import api, { formatApiError } from "@/lib/api";
import { toast } from "sonner";
import ShlokaPlayer from "@/components/ShlokaPlayer";
import { fetchDailyVerse } from "@/lib/dailyVerse";
import PanchangTool from "@/components/tools/PanchangTool";
import NumerologyTool from "@/components/tools/NumerologyTool";
import TarotTool from "@/components/tools/TarotTool";
import RamShalakaTool from "@/components/tools/RamShalakaTool";
import TransliterationTool from "@/components/tools/TransliterationTool";

function Kundli() {
  const [f, setF] = useState({ name: "", dob: "", tob: "", pob: "" });
  const [result, setResult] = useState(null);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = async (e) => {
    e.preventDefault();
    try { const { data } = await api.post("/calculators/kundli", f); setResult(data); }
    catch (e) { toast.error(formatApiError(e)); }
  };
  return (
    <div className="grid md:grid-cols-2 gap-10">
      <form onSubmit={submit} className="space-y-4">
        <div className="eyebrow">Kundli · birth chart</div>
        <h3 className="font-serif text-3xl">Your chart as a study object.</h3>
        <p className="text-sm text-muted-foreground">Learn to read it. We do not tell fortunes.</p>
        <div><Label className="eyebrow">Name</Label><Input value={f.name} onChange={set("name")} required data-testid="kundli-name" className="mt-2 h-11" /></div>
        <div className="grid grid-cols-2 gap-4">
          <div><Label className="eyebrow">DOB</Label><Input type="date" value={f.dob} onChange={set("dob")} required data-testid="kundli-dob" className="mt-2 h-11" /></div>
          <div><Label className="eyebrow">Time</Label><Input type="time" value={f.tob} onChange={set("tob")} required data-testid="kundli-tob" className="mt-2 h-11" /></div>
        </div>
        <div><Label className="eyebrow">Place of birth</Label><Input value={f.pob} onChange={set("pob")} required data-testid="kundli-pob" className="mt-2 h-11" /></div>
        <Button type="submit" data-testid="kundli-submit" className="rounded-full px-8">Generate chart</Button>
      </form>
      {result && (
        <div className="rounded-lg border border-border p-8 bg-card/50" data-testid="kundli-result">
          <div className="grid grid-cols-3 gap-3 mb-6 text-center">
            <div><div className="eyebrow">Ascendant</div><div className="font-serif text-xl mt-1">{result.ascendant}</div></div>
            <div><div className="eyebrow">Moon sign</div><div className="font-serif text-xl mt-1">{result.moon_sign}</div></div>
            <div><div className="eyebrow">Sun sign</div><div className="font-serif text-xl mt-1">{result.sun_sign}</div></div>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {result.houses.map((h) => (
              <div key={h.house} className="border border-border rounded p-3 text-xs h-24 flex flex-col">
                <div className="tabular text-[10px] text-muted-foreground">House {h.house}</div>
                <div className="font-serif text-sm">{h.sign}</div>
                <div className="mt-auto text-[10px] text-primary">{h.planets.join(", ") || "—"}</div>
              </div>
            ))}
          </div>
          <p className="mt-6 text-xs text-muted-foreground italic">{result.note}</p>
        </div>
      )}
    </div>
  );
}

function ShlokaOfDay() {
  const [v, setV] = useState(null);
  useEffect(() => { fetchDailyVerse().then(setV).catch(() => {}); }, []);
  if (!v || !v.devanagari) return <div className="text-muted-foreground">Loading…</div>;
  return <ShlokaPlayer verse={v} />;
}

export default function Calculators() {
  return (
    <div className="site-container py-16">
      <div className="eyebrow mb-3">Free study tools</div>
      <h1 className="text-5xl md:text-6xl font-serif tracking-tight mb-4">Calculators compute.<br/><em className="text-primary not-italic">They do not foretell.</em></h1>
      <p className="text-foreground/70 max-w-2xl leading-relaxed mb-10">
        High-intent, ungated tools. A chart is a study object — learn to read it. The interpretation is the paid course; the computation is the free hook.
      </p>
      <Tabs defaultValue="panchang">
        <TabsList className="mb-8 flex-wrap h-auto">
          <TabsTrigger value="panchang" data-testid="tab-panchang">Panchang</TabsTrigger>
          <TabsTrigger value="numerology" data-testid="tab-numerology">Numerology</TabsTrigger>
          <TabsTrigger value="kundli" data-testid="tab-kundli">Kundli</TabsTrigger>
          <TabsTrigger value="tarot" data-testid="tab-tarot">Tarot</TabsTrigger>
          <TabsTrigger value="shalaka" data-testid="tab-shalaka">Rāma Śalākā</TabsTrigger>
          <TabsTrigger value="shloka" data-testid="tab-shloka">Shloka of the day</TabsTrigger>
          <TabsTrigger value="translit" data-testid="tab-translit">Transliteration</TabsTrigger>
        </TabsList>
        <TabsContent value="panchang"><PanchangTool /></TabsContent>
        <TabsContent value="numerology"><NumerologyTool /></TabsContent>
        <TabsContent value="kundli"><Kundli /></TabsContent>
        <TabsContent value="tarot"><TarotTool /></TabsContent>
        <TabsContent value="shalaka"><RamShalakaTool /></TabsContent>
        <TabsContent value="shloka"><ShlokaOfDay /></TabsContent>
        <TabsContent value="translit"><TransliterationTool /></TabsContent>
      </Tabs>
    </div>
  );
}
