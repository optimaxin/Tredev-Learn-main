import React, { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sun, Moon, MapPin } from "lucide-react";
import { toast } from "sonner";
import { computePanchang, CITY_PRESETS } from "@/lib/tools/panchang";

function InfoCard({ label, value }) {
  return (
    <div className="border-b border-border py-3 flex items-baseline justify-between">
      <span className="eyebrow">{label}</span>
      <span className="font-serif text-lg text-foreground">{value}</span>
    </div>
  );
}

export default function PanchangTool() {
  const [d, setD] = useState(new Date().toLocaleDateString("en-CA"));
  const [city, setCity] = useState(CITY_PRESETS[0].name);
  const [coords, setCoords] = useState({ lat: CITY_PRESETS[0].lat, lon: CITY_PRESETS[0].lon });

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation is not available in this browser");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCity("");
        setCoords({ lat: pos.coords.latitude, lon: pos.coords.longitude });
        toast.success("Using your current location");
      },
      () => toast.error("Could not get your location — pick a city instead")
    );
  };

  const onCityChange = (name) => {
    setCity(name);
    const preset = CITY_PRESETS.find((c) => c.name === name);
    if (preset) setCoords({ lat: preset.lat, lon: preset.lon });
  };

  const result = useMemo(() => {
    try {
      return computePanchang(new Date(`${d}T12:00:00Z`), coords.lat, coords.lon);
    } catch {
      return null;
    }
  }, [d, coords]);

  return (
    <div className="grid md:grid-cols-2 gap-10">
      <div>
        <div className="eyebrow mb-3">Panchang · Five limbs of the day</div>
        <h3 className="font-serif text-3xl mb-4">A study object.</h3>
        <p className="text-sm text-muted-foreground mb-6">Learn to read a Panchang. The tradition does not predict — it observes.</p>

        <Label className="eyebrow">Date</Label>
        <Input type="date" value={d} onChange={(e) => setD(e.target.value)} className="mt-2 h-11 max-w-xs" data-testid="panchang-date" />

        <div className="mt-6">
          <Label className="eyebrow">Location</Label>
          <div className="flex items-center gap-3 mt-2">
            <Select value={city} onValueChange={onCityChange}>
              <SelectTrigger className="h-11 max-w-xs" data-testid="panchang-city">
                <SelectValue placeholder="Choose a city" />
              </SelectTrigger>
              <SelectContent>
                {CITY_PRESETS.map((c) => (
                  <SelectItem key={c.name} value={c.name}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button type="button" variant="outline" onClick={useMyLocation} className="rounded-full" data-testid="panchang-geolocate">
              <MapPin className="w-3 h-3 mr-1" /> Use my location
            </Button>
          </div>
          {!city && (
            <p className="text-xs text-muted-foreground mt-2 tabular">{coords.lat.toFixed(3)}°, {coords.lon.toFixed(3)}°</p>
          )}
        </div>
      </div>

      {result && (
        <div className="rounded-lg border border-border p-8 bg-card/50 animate-fade-in-up" data-testid="panchang-result">
          <div className="text-primary eyebrow mb-4">{result.date}</div>
          <InfoCard label="Vara" value={result.vara} />
          <InfoCard label="Tithi" value={`${result.paksha} · ${result.tithi}`} />
          <InfoCard label="Nakshatra" value={result.nakshatra} />
          <InfoCard label="Yoga" value={result.yoga} />
          <InfoCard label="Karana" value={result.karana} />
          <div className="grid grid-cols-2 gap-4 mt-6">
            <div><div className="eyebrow">Sunrise</div><div className="tabular text-lg mt-1"><Sun className="w-3 h-3 inline mr-1" />{result.sunrise}</div></div>
            <div><div className="eyebrow">Sunset</div><div className="tabular text-lg mt-1">{result.sunset}</div></div>
            <div><div className="eyebrow">Moonrise</div><div className="tabular text-lg mt-1"><Moon className="w-3 h-3 inline mr-1" />{result.moonrise}</div></div>
            <div><div className="eyebrow">Moonset</div><div className="tabular text-lg mt-1">{result.moonset}</div></div>
          </div>
          <div className="grid grid-cols-2 gap-4 mt-6">
            <div><div className="eyebrow text-destructive">Rahu Kalam</div><div className="tabular text-sm mt-1">{result.rahuKalam || "—"}</div></div>
            <div><div className="eyebrow text-primary">Abhijit Muhurta</div><div className="tabular text-sm mt-1">{result.abhijitMuhurta || "—"}</div></div>
          </div>
          <p className="mt-6 text-xs text-muted-foreground italic">{result.note}</p>
        </div>
      )}
    </div>
  );
}
