import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation();
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
        <div className="eyebrow">{t("tools.kundli.heading")}</div>
        <h3 className="font-serif text-3xl">{t("tools.kundli.title")}</h3>
        <p className="text-sm text-muted-foreground">{t("tools.kundli.subtext")}</p>
        <div><Label className="eyebrow">{t("tools.kundli.name")}</Label><Input value={f.name} onChange={set("name")} required data-testid="kundli-name" className="mt-2 h-11" /></div>
        <div className="grid grid-cols-2 gap-4">
          <div><Label className="eyebrow">{t("tools.kundli.dob")}</Label><Input type="date" value={f.dob} onChange={set("dob")} required data-testid="kundli-dob" className="mt-2 h-11" /></div>
          <div><Label className="eyebrow">{t("tools.kundli.time")}</Label><Input type="time" value={f.tob} onChange={set("tob")} required data-testid="kundli-tob" className="mt-2 h-11" /></div>
        </div>
        <div><Label className="eyebrow">{t("tools.kundli.pob")}</Label><Input value={f.pob} onChange={set("pob")} required data-testid="kundli-pob" className="mt-2 h-11" /></div>
        <Button type="submit" data-testid="kundli-submit" className="rounded-full px-8">{t("tools.kundli.generate")}</Button>
      </form>
      {result && (
        <div className="rounded-lg border border-border p-8 bg-card/50" data-testid="kundli-result">
          <div className="grid grid-cols-3 gap-3 mb-6 text-center">
            <div><div className="eyebrow">{t("tools.kundli.ascendant")}</div><div className="font-serif text-xl mt-1">{result.ascendant}</div></div>
            <div><div className="eyebrow">{t("tools.kundli.moonSign")}</div><div className="font-serif text-xl mt-1">{result.moon_sign}</div></div>
            <div><div className="eyebrow">{t("tools.kundli.sunSign")}</div><div className="font-serif text-xl mt-1">{result.sun_sign}</div></div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {result.houses.map((h) => (
              <div key={h.house} className="border border-border rounded p-3 text-xs h-24 flex flex-col">
                <div className="tabular text-[10px] text-muted-foreground">{t("tools.kundli.house")} {h.house}</div>
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
  const { t } = useTranslation();
  const [v, setV] = useState(null);
  useEffect(() => { fetchDailyVerse().then(setV).catch(() => {}); }, []);
  if (!v || !v.devanagari) return <div className="text-muted-foreground">{t("common.loading")}</div>;
  return <ShlokaPlayer verse={v} />;
}

const VALID_TABS = ["panchang", "numerology", "kundli", "tarot", "shalaka", "shloka", "translit"];

export default function Calculators() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const requestedTab = searchParams.get("tab");
  const initialTab = VALID_TABS.includes(requestedTab) ? requestedTab : "panchang";

  return (
    <div className="site-container py-16">
      <div className="rounded-xl bg-background/85 backdrop-blur-sm border border-border/50 p-6 md:p-8 mb-10 inline-block max-w-3xl">
        <div className="eyebrow mb-3">{t("tools.calculatorsPage.heading")}</div>
        <h1 className="text-5xl md:text-6xl font-serif tracking-tight mb-4">{t("tools.calculatorsPage.titlePlain")}<br/><em className="text-primary not-italic">{t("tools.calculatorsPage.titleEm")}</em></h1>
        <p className="text-foreground/70 max-w-2xl leading-relaxed">
          {t("tools.calculatorsPage.subtext")}
        </p>
      </div>
      <Tabs defaultValue={initialTab}>
        <TabsList className="mb-8 flex-nowrap overflow-x-auto justify-start max-w-full sm:flex-wrap sm:overflow-visible h-auto bg-background/85 backdrop-blur-sm">
          <TabsTrigger value="panchang" data-testid="tab-panchang">{t("tools.calculatorsPage.tabPanchang")}</TabsTrigger>
          <TabsTrigger value="numerology" data-testid="tab-numerology">{t("tools.calculatorsPage.tabNumerology")}</TabsTrigger>
          <TabsTrigger value="kundli" data-testid="tab-kundli">{t("tools.calculatorsPage.tabKundli")}</TabsTrigger>
          <TabsTrigger value="tarot" data-testid="tab-tarot">{t("tools.calculatorsPage.tabTarot")}</TabsTrigger>
          <TabsTrigger value="shalaka" data-testid="tab-shalaka">{t("tools.calculatorsPage.tabShalaka")}</TabsTrigger>
          <TabsTrigger value="shloka" data-testid="tab-shloka">{t("tools.calculatorsPage.tabShloka")}</TabsTrigger>
          <TabsTrigger value="translit" data-testid="tab-translit">{t("tools.calculatorsPage.tabTranslit")}</TabsTrigger>
        </TabsList>
        <div className="rounded-xl bg-background/85 backdrop-blur-sm border border-border/50 p-6 md:p-8">
          <TabsContent value="panchang"><PanchangTool /></TabsContent>
          <TabsContent value="numerology"><NumerologyTool /></TabsContent>
          <TabsContent value="kundli"><Kundli /></TabsContent>
          <TabsContent value="tarot"><TarotTool /></TabsContent>
          <TabsContent value="shalaka"><RamShalakaTool /></TabsContent>
          <TabsContent value="shloka"><ShlokaOfDay /></TabsContent>
          <TabsContent value="translit"><TransliterationTool /></TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
