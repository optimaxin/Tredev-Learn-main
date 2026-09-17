import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeftRight, Copy, X } from "lucide-react";
import { toast } from "sonner";
import { SCRIPT_OPTIONS, transliterate } from "@/lib/tools/transliteration";

function copy(text, t) {
  if (!text) return;
  navigator.clipboard?.writeText(text);
  toast.success(t("tools.translit.copied"));
}

export default function TransliterationTool() {
  const { t } = useTranslation();
  const [leftScheme, setLeftScheme] = useState("devanagari");
  const [rightScheme, setRightScheme] = useState("itrans");
  const [leftText, setLeftText] = useState("श्री गणेशाय नमः");
  const [rightText, setRightText] = useState(() => transliterate("श्री गणेशाय नमः", "devanagari", "itrans"));

  const leftOption = SCRIPT_OPTIONS.find((s) => s.value === leftScheme);
  const rightOption = SCRIPT_OPTIONS.find((s) => s.value === rightScheme);

  const onLeftSchemeChange = (val) => {
    setLeftScheme(val);
    setRightText(transliterate(leftText, val, rightScheme));
  };

  const onRightSchemeChange = (val) => {
    setRightScheme(val);
    setRightText(transliterate(leftText, leftScheme, val));
  };

  const onLeftTextChange = (e) => {
    const val = e.target.value;
    setLeftText(val);
    setRightText(transliterate(val, leftScheme, rightScheme));
  };

  const onRightTextChange = (e) => {
    const val = e.target.value;
    setRightText(val);
    setLeftText(transliterate(val, rightScheme, leftScheme));
  };

  const swap = () => {
    setLeftScheme(rightScheme);
    setRightScheme(leftScheme);
    setLeftText(rightText);
    setRightText(leftText);
  };

  const clearAll = () => {
    setLeftText("");
    setRightText("");
  };

  const boxStyle = (option) =>
    option?.value === "devanagari" ? "font-devanagari text-2xl leading-relaxed" : "font-serif italic text-lg leading-relaxed";

  return (
    <div>
      <div className="eyebrow mb-3">{t("tools.translit.heading")}</div>
      <h3 className="font-serif text-3xl mb-2">{t("tools.translit.title")}</h3>
      <p className="text-sm text-muted-foreground mb-6 max-w-2xl">
        {t("tools.translit.subtext")}
      </p>

      <div className="flex justify-end mb-2">
        <Button variant="outline" size="sm" onClick={clearAll} className="rounded-full" data-testid="translit-clear">
          <X className="w-3 h-3 mr-1" /> {t("tools.translit.clear")}
        </Button>
      </div>

      <div className="grid md:grid-cols-[1fr_auto_1fr] gap-6 items-start">
        <div className="rounded-lg border border-border bg-card/50 p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between mb-2 gap-2">
            <Select value={leftScheme} onValueChange={onLeftSchemeChange}>
              <SelectTrigger className="h-9 w-full sm:w-56" data-testid="translit-scheme-left">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SCRIPT_OPTIONS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="ghost" size="sm" onClick={() => copy(leftText, t)} data-testid="translit-copy-left">
              <Copy className="w-3 h-3 mr-1" /> {t("tools.translit.copy")}
            </Button>
          </div>
          {leftOption && (
            <p className="text-xs text-muted-foreground mb-2">
              {leftOption.hint} <span className="italic">{t("tools.translit.example")}: "{leftOption.example}"</span>
            </p>
          )}
          <Textarea
            value={leftText}
            onChange={onLeftTextChange}
            className={`min-h-[160px] sm:min-h-[220px] ${boxStyle(leftOption)}`}
            data-testid="translit-box-left"
            placeholder={t("tools.translit.typeHere")}
          />
        </div>

        <Button
          variant="outline"
          size="icon"
          onClick={swap}
          className="rounded-full mx-auto md:mt-9 md:mx-0"
          data-testid="translit-swap"
          aria-label={t("tools.translit.swapScripts")}
        >
          <ArrowLeftRight className="w-4 h-4 rotate-90 md:rotate-0" />
        </Button>

        <div className="rounded-lg border border-border bg-card/50 p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between mb-2 gap-2">
            <Select value={rightScheme} onValueChange={onRightSchemeChange}>
              <SelectTrigger className="h-9 w-full sm:w-56" data-testid="translit-scheme-right">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SCRIPT_OPTIONS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="ghost" size="sm" onClick={() => copy(rightText, t)} data-testid="translit-copy-right">
              <Copy className="w-3 h-3 mr-1" /> {t("tools.translit.copy")}
            </Button>
          </div>
          {rightOption && (
            <p className="text-xs text-muted-foreground mb-2">
              {rightOption.hint} <span className="italic">{t("tools.translit.example")}: "{rightOption.example}"</span>
            </p>
          )}
          <Textarea
            value={rightText}
            onChange={onRightTextChange}
            className={`min-h-[160px] sm:min-h-[220px] ${boxStyle(rightOption)}`}
            data-testid="translit-box-right"
            placeholder={t("tools.translit.typeHere")}
          />
        </div>
      </div>
    </div>
  );
}
