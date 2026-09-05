import React, { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Flower2, Link2, ImageDown } from "lucide-react";
import { toast } from "sonner";
import { toBlob } from "html-to-image";
import { GRID_SIZE, buildFlatGrid, traverseFromCell, toHindiReference } from "@/lib/tools/ramShalaka";

const FLAT_GRID = buildFlatGrid();
const RAM_IMG = "/assets/shreeram.png";

const HOW_IT_WORKS_KEYS = ["step1", "step2", "step3", "step4", "step5"];

const LABELS = {
  hi: {
    selected: "~ चयनित ~",
    chaupai: "चौपाई",
    reference: "संदर्भ",
    answer: "श्री राम का उत्तर",
    guidance: "श्री राम के जीवन से मार्गदर्शन",
    reset: "एक और प्रश्न पूछें",
    shareLink: "लिंक साझा करें",
    shareImage: "छवि साझा करें",
    preparingImage: "छवि तैयार हो रही है…",
  },
  en: {
    selected: "~ Selected ~",
    chaupai: "Chaupai",
    reference: "Reference",
    answer: "Answer from Shri Ram",
    guidance: "Guidance from Shri Ram's Life",
    reset: "Ask Another Question",
    shareLink: "Share link",
    shareImage: "Share as image",
    preparingImage: "Preparing image…",
  },
};

function shareLink(result, t) {
  const url = `${window.location.origin}${window.location.pathname}?tab=shalaka&letter=${result.cellIndex}`;
  const shareText = "Rāma Śalākā Prashnāvalī";
  if (navigator.share) {
    navigator.share({ title: shareText, url }).catch(() => {});
    return;
  }
  const waUrl = `https://wa.me/?text=${encodeURIComponent(`${shareText} ${url}`)}`;
  const opened = window.open(waUrl, "_blank", "noopener,noreferrer");
  if (!opened) {
    navigator.clipboard?.writeText(url);
    toast.success(t("tools.shalaka.linkCopied"));
  }
}

/** Wait for every <img> inside the card (the Shri Ram picture) to finish loading, so
 * html-to-image never captures it mid-fetch as blank/broken. */
async function waitForImages(node) {
  await Promise.all(
    Array.from(node.querySelectorAll("img")).map((img) =>
      img.complete ? Promise.resolve() : new Promise((resolve) => {
        img.addEventListener("load", resolve, { once: true });
        img.addEventListener("error", resolve, { once: true });
      })
    )
  );
}

async function shareImage(node) {
  await waitForImages(node);
  const bg = getComputedStyle(node).backgroundColor;
  const blob = await toBlob(node, { skipFonts: true, pixelRatio: 2, backgroundColor: bg });
  if (!blob) throw new Error("Failed to render image");
  const file = new File([blob], "ram-shalaka-result.png", { type: "image/png" });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: "Rāma Śalākā Prashnāvalī" });
      return;
    } catch (err) {
      if (err.name === "AbortError") return; // user dismissed the share sheet
      // else: e.g. NotAllowedError if user-activation expired while the image rendered — fall back to download
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "ram-shalaka-result.png";
  a.click();
  URL.revokeObjectURL(url);
}

export default function RamShalakaTool() {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const [result, setResult] = useState(null);
  const [hover, setHover] = useState(null);
  const [lang, setLang] = useState("hi");
  const [preparingImage, setPreparingImage] = useState(false);
  const cardRef = useRef(null);
  const labels = LABELS[lang];

  useEffect(() => {
    const letter = parseInt(params.get("letter"), 10);
    if (Number.isInteger(letter) && letter >= 0 && letter < GRID_SIZE * GRID_SIZE) {
      setResult(traverseFromCell(letter));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const highlighted = result ? new Set(result.path) : hover != null ? new Set([hover]) : null;

  const handleShareImage = async () => {
    if (!cardRef.current) return;
    setPreparingImage(true);
    try {
      await shareImage(cardRef.current);
    } catch (err) {
      toast.error(t("tools.shalaka.imageError"));
    } finally {
      setPreparingImage(false);
    }
  };

  const chaupai = result ? (lang === "hi" ? result.text : result.textEn) : null;
  const answer = result ? (lang === "hi" ? result.answerHi : result.answer) : null;
  const guidance = result ? (lang === "hi" ? result.guidanceHi : result.guidance) : null;
  const reference = result ? (lang === "hi" ? toHindiReference(result.reference) : result.reference) : null;

  return (
    <div>
      <div className="eyebrow mb-3">{t("tools.shalaka.heading")}</div>
      <h3 className="font-serif text-3xl mb-6">{t("tools.shalaka.title")}</h3>

      <div className="rounded-lg border border-border bg-card/60 p-6 mb-6" data-testid="shalaka-intro">
        <h4 className="text-center font-serif text-lg mb-6">{t("tools.shalaka.howItWorks")}</h4>
        <ul className="space-y-5 max-w-2xl mx-auto">
          {HOW_IT_WORKS_KEYS.map((key, i) => (
            <li key={key} className="flex items-start gap-3">
              <Flower2 className="size-6 text-primary shrink-0 mt-0.5" />
              <span className="text-sm text-foreground/90 leading-relaxed">{t(`tools.shalaka.${key}`)}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-xl border-2 border-border bg-card/50 p-2 max-w-xl mx-auto">
        <div
          className="grid gap-0.5 select-none"
          style={{ gridTemplateColumns: `repeat(${GRID_SIZE}, minmax(0, 1fr))` }}
          data-testid="shalaka-grid"
        >
          {FLAT_GRID.map((cell, idx) => {
            const isHighlighted = highlighted?.has(idx);
            return (
              <button
                key={idx}
                type="button"
                onMouseEnter={() => setHover(idx)}
                onMouseLeave={() => setHover(null)}
                onClick={() => setResult(traverseFromCell(idx))}
                className={`aspect-square rounded-[3px] border text-[8px] sm:text-[9px] font-devanagari flex items-center justify-center transition-colors overflow-hidden leading-none
                  ${isHighlighted ? "bg-accent/40 border-accent" : "bg-card/50 border-border hover:bg-accent/20"}`}
                data-testid={`shalaka-cell-${idx}`}
              >
                {cell}
              </button>
            );
          })}
        </div>
      </div>

      <Dialog open={!!result} onOpenChange={(open) => !open && setResult(null)}>
        <DialogContent className="max-w-3xl w-[95vw] sm:w-full max-h-[95vh] overflow-y-auto" data-testid="shalaka-result">
          {result && (
            <>
              <div className="flex justify-end mb-2 pr-8" data-testid="shalaka-lang-toggle">
                <div className="inline-flex rounded-full border border-border bg-muted/50 p-0.5 text-xs font-medium">
                  <button
                    type="button"
                    onClick={() => setLang("hi")}
                    className={`px-3 py-1 rounded-full font-devanagari transition-colors ${lang === "hi" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                    data-testid="shalaka-lang-hi"
                  >
                    हिंदी
                  </button>
                  <button
                    type="button"
                    onClick={() => setLang("en")}
                    className={`px-3 py-1 rounded-full transition-colors ${lang === "en" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                    data-testid="shalaka-lang-en"
                  >
                    English
                  </button>
                </div>
              </div>

              {/* Everything inside this ref is exactly what gets captured for "Share as image" — the full result card, god image included. */}
              <div ref={cardRef} className="flex flex-col sm:flex-row gap-6 bg-background p-1">
                <img
                  src={RAM_IMG}
                  alt="Shri Ram"
                  className="w-56 sm:w-72 h-64 sm:h-80 object-contain mx-auto sm:mx-0 shrink-0 drop-shadow-lg"
                />

                <div className="flex-1 min-w-0">
                  <p className="text-center sm:text-left text-sm text-muted-foreground mb-3">
                    {labels.selected} <span className="font-devanagari text-lg text-foreground" data-testid="shalaka-selected-letter">{result.selectedLetter}</span>
                  </p>

                  <h4 className="text-center sm:text-left font-serif text-lg border-b-2 border-primary/40 pb-1 mb-2 w-full">{labels.chaupai}</h4>
                  <blockquote className="font-devanagari text-xl text-center sm:text-left leading-relaxed mb-3" data-testid="shalaka-chaupai">
                    {chaupai}
                  </blockquote>

                  <h4 className="text-center sm:text-left font-serif text-lg border-b-2 border-primary/40 pb-1 mb-2 w-full">{labels.reference}</h4>
                  <p className="text-center sm:text-left text-sm text-muted-foreground mb-3" data-testid="shalaka-reference">{reference}</p>

                  <h4 className="text-center sm:text-left font-serif text-lg border-b-2 border-primary/40 pb-1 mb-2 w-full">{labels.answer}</h4>
                  <p className="text-center sm:text-left text-sm text-foreground/90 leading-relaxed mb-3" data-testid="shalaka-answer">{answer}</p>

                  <h4 className="text-center sm:text-left font-serif text-lg border-b-2 border-primary/40 pb-1 mb-2 w-full">{labels.guidance}</h4>
                  <p className="text-center sm:text-left text-sm text-foreground/90 leading-relaxed" data-testid="shalaka-guidance">{guidance}</p>
                </div>
              </div>

              <div className="flex flex-wrap justify-center sm:justify-end gap-3 pt-5">
                <Button onClick={() => setResult(null)} data-testid="shalaka-reset">
                  {labels.reset}
                </Button>
                <Button variant="secondary" onClick={() => shareLink(result, t)} data-testid="shalaka-share-link">
                  <Link2 className="size-4" />
                  {labels.shareLink}
                </Button>
                <Button variant="secondary" onClick={handleShareImage} disabled={preparingImage} data-testid="shalaka-share-image">
                  <ImageDown className="size-4" />
                  {preparingImage ? labels.preparingImage : labels.shareImage}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
