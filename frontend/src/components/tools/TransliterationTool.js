import React, { useEffect, useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Copy, X } from "lucide-react";
import { toast } from "sonner";
import { ROMAN_SCHEMES, toDevanagari, toRoman } from "@/lib/tools/transliteration";

function copy(text) {
  if (!text) return;
  navigator.clipboard?.writeText(text);
  toast.success("Copied to clipboard");
}

export default function TransliterationTool() {
  const [deva, setDeva] = useState("श्री गणेशाय नमः");
  const [roman, setRoman] = useState("");
  const [scheme, setScheme] = useState("iast");

  useEffect(() => {
    setRoman(toRoman(deva, scheme));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scheme]);

  const onDevaChange = (e) => {
    const val = e.target.value;
    setDeva(val);
    setRoman(toRoman(val, scheme));
  };

  const onRomanChange = (e) => {
    const val = e.target.value;
    setRoman(val);
    setDeva(toDevanagari(val, scheme));
  };

  const clearAll = () => {
    setDeva("");
    setRoman("");
  };

  return (
    <div>
      <div className="eyebrow mb-3">Transliteration · Devanagari ⇄ Roman</div>
      <h3 className="font-serif text-3xl mb-2">A study tool, both directions.</h3>
      <p className="text-sm text-muted-foreground mb-6 max-w-2xl">
        Type in either box — the other updates as you go. Choose a romanization scheme below.
      </p>

      <div className="flex items-center gap-4 mb-6">
        <Label className="eyebrow">Roman scheme</Label>
        <Select value={scheme} onValueChange={setScheme}>
          <SelectTrigger className="h-9 w-48" data-testid="translit-scheme">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ROMAN_SCHEMES.map((s) => (
              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={clearAll} className="rounded-full ml-auto" data-testid="translit-clear">
          <X className="w-3 h-3 mr-1" /> Clear
        </Button>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="rounded-lg border border-border bg-card/50 p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="eyebrow">Devanagari</span>
            <Button variant="ghost" size="sm" onClick={() => copy(deva)} data-testid="translit-copy-deva">
              <Copy className="w-3 h-3" />
            </Button>
          </div>
          <Textarea
            value={deva}
            onChange={onDevaChange}
            className="min-h-[220px] font-devanagari text-2xl leading-relaxed"
            data-testid="translit-devanagari-input"
            placeholder="देवनागरी में टाइप करें…"
          />
        </div>
        <div className="rounded-lg border border-border bg-card/50 p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="eyebrow">Romanized ({ROMAN_SCHEMES.find((s) => s.value === scheme)?.label})</span>
            <Button variant="ghost" size="sm" onClick={() => copy(roman)} data-testid="translit-copy-roman">
              <Copy className="w-3 h-3" />
            </Button>
          </div>
          <Textarea
            value={roman}
            onChange={onRomanChange}
            className="min-h-[220px] font-serif italic text-lg leading-relaxed"
            data-testid="translit-roman-input"
            placeholder="Type romanized Sanskrit…"
          />
        </div>
      </div>
    </div>
  );
}
