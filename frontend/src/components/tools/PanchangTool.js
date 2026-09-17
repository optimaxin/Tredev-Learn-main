import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Sun, Moon, MapPin } from "lucide-react";
import { toast } from "sonner";
import api, { formatApiError } from "@/lib/api";
import { CITY_PRESETS, PANCHANG_LABELS_HI, translatePanchangToHindi } from "@/lib/tools/panchang";

const LABELS_EN = {
  vara: "Vara", tithi: "Tithi", nakshatra: "Nakshatra", yoga: "Yoga", karana: "Karana",
  sunrise: "Sunrise", sunset: "Sunset", moonrise: "Moonrise", moonset: "Moonset",
  rahuKalam: "Rahu Kalam", abhijitMuhurta: "Abhijit Muhurta",
};

function InfoCard({ label, value, hi }) {
  return (
    <div className="border-b border-border py-3 flex items-baseline justify-between gap-4 flex-wrap">
      <span className={hi ? "eyebrow-hi" : "eyebrow"}>{label}</span>
      <span className="font-serif text-lg text-foreground text-right">{value}</span>
    </div>
  );
}

export default function PanchangTool() {
  const { t, i18n } = useTranslation();
  const [d, setD] = useState(new Date().toLocaleDateString("en-CA"));
  const [city, setCity] = useState(CITY_PRESETS[0].name);
  const [coords, setCoords] = useState({ lat: CITY_PRESETS[0].lat, lon: CITY_PRESETS[0].lon });

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      toast.error(t("tools.panchang.geoUnavailable"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCity("");
        setCoords({ lat: pos.coords.latitude, lon: pos.coords.longitude });
        toast.success(t("tools.panchang.geoSuccess"));
      },
      () => toast.error(t("tools.panchang.geoError"))
    );
  };

  const onCityChange = (name) => {
    setCity(name);
    const preset = CITY_PRESETS.find((c) => c.name === name);
    if (preset) setCoords({ lat: preset.lat, lon: preset.lon });
  };

  const [result, setResult] = useState(null);
  const [lang, setLang] = useState(i18n.resolvedLanguage === "hi" ? "hi" : "en");
  const hi = lang === "hi";
  const labels = hi ? PANCHANG_LABELS_HI : LABELS_EN;
  const display = result && hi ? translatePanchangToHindi(result) : result;
  const labelClass = hi ? "eyebrow-hi" : "eyebrow";

  useEffect(() => {
    let cancelled = false;
    api
      .get("/calculators/panchang", { params: { d, lat: coords.lat, lon: coords.lon } })
      .then(({ data }) => {
        if (cancelled) return;
        setResult({ ...data, rahuKalam: data.rahu_kalam, abhijitMuhurta: data.abhijit_muhurta });
      })
      .catch((e) => !cancelled && toast.error(formatApiError(e)));
    return () => { cancelled = true; };
  }, [d, coords]);

  return (
    <div className="grid md:grid-cols-2 gap-10">
      <div>
        <div className="eyebrow mb-3 flex items-center justify-between gap-4">
          <span>{t("tools.panchang.heading")}</span>
          <label className="flex items-center gap-2 normal-case tracking-normal font-normal text-foreground/80" data-testid="panchang-lang-toggle">
            <span className={lang === "en" ? "text-primary" : ""}>English</span>
            <Switch
              checked={lang === "hi"}
              onCheckedChange={(checked) => setLang(checked ? "hi" : "en")}
              data-testid="panchang-lang-switch"
            />
            <span className={lang === "hi" ? "text-primary font-devanagari" : "font-devanagari"}>हिंदी</span>
          </label>
        </div>
        <h3 className="font-serif text-3xl mb-4">{t("tools.panchang.title")}</h3>
        <p className="text-sm text-muted-foreground mb-6">{t("tools.panchang.subtext")}</p>

        <Label className="eyebrow">{t("tools.panchang.date")}</Label>
        <Input type="date" value={d} onChange={(e) => setD(e.target.value)} className="mt-2 h-11 max-w-xs" data-testid="panchang-date" />

        <div className="mt-6">
          <Label className="eyebrow">{t("tools.panchang.location")}</Label>
          <div className="flex flex-wrap items-center gap-3 mt-2">
            <Select value={city} onValueChange={onCityChange}>
              <SelectTrigger className="h-11 w-full min-w-0 sm:w-auto sm:max-w-xs" data-testid="panchang-city">
                <SelectValue placeholder={t("tools.panchang.chooseCity")} />
              </SelectTrigger>
              <SelectContent>
                {CITY_PRESETS.map((c) => (
                  <SelectItem key={c.name} value={c.name}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button type="button" variant="outline" onClick={useMyLocation} className="rounded-full" data-testid="panchang-geolocate">
              <MapPin className="w-3 h-3 mr-1" /> {t("tools.panchang.useMyLocation")}
            </Button>
          </div>
          {!city && (
            <p className="text-xs text-muted-foreground mt-2 tabular">{coords.lat.toFixed(3)}°, {coords.lon.toFixed(3)}°</p>
          )}
        </div>
      </div>

      {display && (
        <div className={`rounded-lg border border-border p-5 sm:p-8 bg-card/50 animate-fade-in-up ${lang === "hi" ? "font-devanagari" : ""}`} data-testid="panchang-result">
          <div className={`text-primary ${hi ? "eyebrow-hi" : "eyebrow"} mb-4 font-sans`}>{display.date}</div>
          <InfoCard label={labels.vara} value={display.vara} hi={hi} />
          <InfoCard label={labels.tithi} value={`${display.paksha} · ${display.tithi}`} hi={hi} />
          <InfoCard label={labels.nakshatra} value={display.nakshatra} hi={hi} />
          <InfoCard label={labels.yoga} value={display.yoga} hi={hi} />
          <InfoCard label={labels.karana} value={display.karana} hi={hi} />
          <div className="grid grid-cols-2 gap-4 mt-6">
            <div><div className={labelClass}>{labels.sunrise}</div><div className="tabular text-lg mt-1"><Sun className="w-3 h-3 inline mr-1" />{display.sunrise}</div></div>
            <div><div className={labelClass}>{labels.sunset}</div><div className="tabular text-lg mt-1">{display.sunset}</div></div>
            <div><div className={labelClass}>{labels.moonrise}</div><div className="tabular text-lg mt-1"><Moon className="w-3 h-3 inline mr-1" />{display.moonrise}</div></div>
            <div><div className={labelClass}>{labels.moonset}</div><div className="tabular text-lg mt-1">{display.moonset}</div></div>
          </div>
          <div className="grid grid-cols-2 gap-4 mt-6">
            <div><div className={`${labelClass} text-destructive`}>{labels.rahuKalam}</div><div className="tabular text-sm mt-1">{display.rahuKalam || "—"}</div></div>
            <div><div className={`${labelClass} text-primary`}>{labels.abhijitMuhurta}</div><div className="tabular text-sm mt-1">{display.abhijitMuhurta || "—"}</div></div>
          </div>
          <p className="mt-6 text-xs text-muted-foreground italic">{display.note}</p>
        </div>
      )}
    </div>
  );
}
