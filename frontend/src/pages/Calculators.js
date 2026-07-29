import React, { useEffect, useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import api, { formatApiError } from "@/lib/api";
import { toast } from "sonner";
import ShlokaPlayer from "@/components/ShlokaPlayer";
import { Moon, Sun, Star, Sparkle } from "lucide-react";
function InfoCard({ label, value }) {
  return (
    <div className="border-b border-border py-3 flex items-baseline justify-between">
      <span className="overline">{label}</span>
      <span className="font-serif text-lg text-foreground">{value}</span>
    </div>
  );
}

function Panchang() {
  const [d, setD] = useState(new Date().toISOString().slice(0, 10));
  const [result, setResult] = useState(null);
  const load = async () => {
    try { const { data } = await api.get(`/calculators/panchang?d=${d}`); setResult(data); }
    catch (e) { toast.error(formatApiError(e)); }
  };
  useEffect(() => { load(); }, [d]);
  return (
    <div className="grid md:grid-cols-2 gap-10">
      <div>
        <div className="overline mb-3">Panchang · Five limbs of the day</div>
        <h3 className="font-serif text-3xl mb-4">A study object.</h3>
        <p className="text-sm text-muted-foreground mb-6">Learn to read a Panchang. The tradition does not predict — it observes.</p>
        <Label className="overline">Date</Label>
        <Input type="date" value={d} onChange={(e)=>setD(e.target.value)} className="mt-2 h-11 max-w-xs" data-testid="panchang-date" />
      </div>
      {result && (
        <div className="rounded-lg border border-border p-8 bg-card/50" data-testid="panchang-result">
          <div className="text-primary overline mb-4">{result.date}</div>
          <InfoCard label="Tithi" value={`${result.paksha} · ${result.tithi}`} />
          <InfoCard label="Nakshatra" value={result.nakshatra} />
          <InfoCard label="Yoga" value={result.yoga} />
          <InfoCard label="Karana" value={result.karana} />
          <InfoCard label="Vara" value={result.vara} />
          <div className="grid grid-cols-3 gap-4 mt-6">
            <div><div className="overline">Sunrise</div><div className="tabular text-lg mt-1"><Sun className="w-3 h-3 inline mr-1"/>{result.sunrise}</div></div>
            <div><div className="overline">Sunset</div><div className="tabular text-lg mt-1">{result.sunset}</div></div>
            <div><div className="overline">Moonrise</div><div className="tabular text-lg mt-1"><Moon className="w-3 h-3 inline mr-1"/>{result.moonrise}</div></div>
          </div>
          <p className="mt-6 text-xs text-muted-foreground italic">{result.note}</p>
        </div>
      )}
    </div>
  );
}

function Numerology() {
  const [name, setName] = useState("");
  const [dob, setDob] = useState("");
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault(); setBusy(true);
    try { const { data } = await api.post("/calculators/numerology", { name, dob }); setResult(data); }
    catch (e) { toast.error(formatApiError(e)); }
    setBusy(false);
  };
  return (
    <div className="grid md:grid-cols-2 gap-10">
      <form onSubmit={submit} className="space-y-4">
        <div className="overline">Numerology · as śāstra</div>
        <h3 className="font-serif text-3xl">Numbers as symbols of qualities.</h3>
        <p className="text-sm text-muted-foreground">Not a prediction of your future — a study of number symbolism.</p>
        <div><Label className="overline">Full name</Label>
          <Input value={name} onChange={(e)=>setName(e.target.value)} required data-testid="numerology-name" className="mt-2 h-11" /></div>
        <div><Label className="overline">Date of birth</Label>
          <Input type="date" value={dob} onChange={(e)=>setDob(e.target.value)} data-testid="numerology-dob" className="mt-2 h-11" /></div>
        <Button disabled={busy} type="submit" data-testid="numerology-submit" className="rounded-full px-8">Compute</Button>
      </form>
      {result && (
        <div className="rounded-lg border border-border p-8 bg-card/50" data-testid="numerology-result">
          <div className="grid grid-cols-2 gap-6">
            <div className="text-center">
              <div className="overline">Destiny number</div>
              <div className="font-serif text-7xl text-primary mt-3 tabular">{result.destiny_number ?? "—"}</div>
            </div>
            <div className="text-center">
              <div className="overline">Life path</div>
              <div className="font-serif text-7xl text-accent mt-3 tabular">{result.life_path_number ?? "—"}</div>
            </div>
          </div>
          <p className="mt-8 text-xs text-muted-foreground italic">{result.note}</p>
        </div>
      )}
    </div>
  );
}

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
        <div className="overline">Kundli · birth chart</div>
        <h3 className="font-serif text-3xl">Your chart as a study object.</h3>
        <p className="text-sm text-muted-foreground">Learn to read it. We do not tell fortunes.</p>
        <div><Label className="overline">Name</Label><Input value={f.name} onChange={set("name")} required data-testid="kundli-name" className="mt-2 h-11" /></div>
        <div className="grid grid-cols-2 gap-4">
          <div><Label className="overline">DOB</Label><Input type="date" value={f.dob} onChange={set("dob")} required data-testid="kundli-dob" className="mt-2 h-11" /></div>
          <div><Label className="overline">Time</Label><Input type="time" value={f.tob} onChange={set("tob")} required data-testid="kundli-tob" className="mt-2 h-11" /></div>
        </div>
        <div><Label className="overline">Place of birth</Label><Input value={f.pob} onChange={set("pob")} required data-testid="kundli-pob" className="mt-2 h-11" /></div>
        <Button type="submit" data-testid="kundli-submit" className="rounded-full px-8">Generate chart</Button>
      </form>
      {result && (
        <div className="rounded-lg border border-border p-8 bg-card/50" data-testid="kundli-result">
          <div className="grid grid-cols-3 gap-3 mb-6 text-center">
            <div><div className="overline">Ascendant</div><div className="font-serif text-xl mt-1">{result.ascendant}</div></div>
            <div><div className="overline">Moon sign</div><div className="font-serif text-xl mt-1">{result.moon_sign}</div></div>
            <div><div className="overline">Sun sign</div><div className="font-serif text-xl mt-1">{result.sun_sign}</div></div>
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

function Transliteration() {
  const [txt, setTxt] = useState("om namaḥ śivāya");
  const [result, setResult] = useState(null);
  const submit = async () => {
    try { const { data } = await api.get(`/calculators/transliterate?text=${encodeURIComponent(txt)}`); setResult(data); }
    catch (e) { toast.error(formatApiError(e)); }
  };
  useEffect(() => { submit(); /* eslint-disable-next-line */ }, []);
  return (
    <div className="grid md:grid-cols-2 gap-10">
      <div>
        <div className="overline mb-3">Transliteration · IAST → Devanagari</div>
        <h3 className="font-serif text-3xl mb-4">A study tool.</h3>
        <Input value={txt} onChange={(e)=>setTxt(e.target.value)} data-testid="translit-input" className="h-12 font-serif italic" />
        <Button onClick={submit} data-testid="translit-submit" className="mt-4 rounded-full px-6">Transliterate</Button>
      </div>
      {result && (
        <div className="rounded-lg border border-border p-8 bg-card/50">
          <div className="overline mb-2">Devanagari</div>
          <div className="font-devanagari text-4xl leading-relaxed" data-testid="translit-result">{result.devanagari}</div>
        </div>
      )}
    </div>
  );
}

function Tarot() {
  const [q, setQ] = useState("");
  const [result, setResult] = useState(null);
  const submit = async (e) => {
    e?.preventDefault();
    try { const { data } = await api.post("/calculators/tarot", { question: q }); setResult(data); }
    catch (e) { toast.error(formatApiError(e)); }
  };
  return (
    <div className="grid md:grid-cols-[1fr_1.4fr] gap-10">
      <form onSubmit={submit}>
        <div className="overline mb-3">Tarot · reflective reading</div>
        <h3 className="font-serif text-3xl">A mirror, not a prophecy.</h3>
        <p className="text-sm text-muted-foreground mt-2 mb-6">Focus on your question. Three cards will be drawn — Past, Present, Future.</p>
        <Label className="overline">Your question</Label>
        <Input value={q} onChange={(e)=>setQ(e.target.value)} required data-testid="tarot-question" className="mt-2 h-11 font-serif italic" placeholder="What do I need to see today?" />
        <Button type="submit" data-testid="tarot-submit" className="mt-4 rounded-full px-6 bg-gradient-hot text-white border-0">Draw the spread</Button>
      </form>
      {result && (
        <div className="grid grid-cols-3 gap-3" data-testid="tarot-result">
          {result.spread.map((c, i) => (
            <div key={i} className="rounded-lg border border-border bg-gradient-cosmic p-5 text-white text-center relative overflow-hidden aspect-[3/5] flex flex-col justify-between">
              <div>
                <div className="text-[10px] uppercase tracking-widest opacity-80">{c.position}</div>
                <div className="font-serif text-lg mt-2 leading-tight">{c.name}</div>
                {c.reversed && <div className="text-[10px] mt-1 opacity-70 italic">reversed</div>}
              </div>
              <div className="text-4xl opacity-30">✦</div>
              <p className="text-xs opacity-90 leading-snug">{c.meaning}</p>
            </div>
          ))}
          <p className="col-span-3 text-xs text-muted-foreground italic mt-2">{result.note}</p>
        </div>
      )}
    </div>
  );
}

function RamShalaka() {
  const [q, setQ] = useState("");
  const [result, setResult] = useState(null);
  const submit = async (e) => {
    e?.preventDefault();
    try { const { data } = await api.post("/calculators/ram-shalaka", { question: q }); setResult(data); }
    catch (e) { toast.error(formatApiError(e)); }
  };
  return (
    <div className="grid md:grid-cols-2 gap-10">
      <form onSubmit={submit}>
        <div className="overline mb-3">Rāma Śalākā prashna</div>
        <h3 className="font-serif text-3xl">Ask Śrī Rāma.</h3>
        <p className="text-sm text-muted-foreground mt-2 mb-6">A reflective divination from the tradition. Not a promise — a mirror.</p>
        <Label className="overline">Your question</Label>
        <Input value={q} onChange={(e)=>setQ(e.target.value)} required data-testid="shalaka-question" className="mt-2 h-11 font-serif italic" />
        <Button type="submit" data-testid="shalaka-submit" className="mt-4 rounded-full px-6 bg-gradient-hot text-white border-0">Consult</Button>
      </form>
      {result && (
        <div className="rounded-lg border border-border p-8 bg-card/60 relative overflow-hidden" data-testid="shalaka-result">
          <div className="text-6xl mb-3 opacity-30">🏹</div>
          <blockquote className="font-serif italic text-lg leading-relaxed border-l-2 border-accent pl-4">"{result.answer}"</blockquote>
          <p className="mt-4 text-xs text-muted-foreground italic">{result.note}</p>
        </div>
      )}
    </div>
  );
}

function ShlokaOfDay() {
  const [v, setV] = useState(null);
  useEffect(() => { api.get("/shloka-of-day").then((r)=>setV(r.data)); }, []);
  if (!v || !v.id) return <div className="text-muted-foreground">Loading…</div>;
  return <ShlokaPlayer verse={v} />;
}

export default function Calculators() {
  return (
    <div className="site-container py-16">
      <div className="overline mb-3">Free study tools</div>
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
        <TabsContent value="panchang"><Panchang /></TabsContent>
        <TabsContent value="numerology"><Numerology /></TabsContent>
        <TabsContent value="kundli"><Kundli /></TabsContent>
        <TabsContent value="tarot"><Tarot /></TabsContent>
        <TabsContent value="shalaka"><RamShalaka /></TabsContent>
        <TabsContent value="shloka"><ShlokaOfDay /></TabsContent>
        <TabsContent value="translit"><Transliteration /></TabsContent>
      </Tabs>
    </div>
  );
}
