import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { drawCard, synthesizeReading, TAROT_CATEGORIES } from "@/lib/tools/tarotDeck";

const CARD_BACK = "/tarot-cards/card-back.png";

const SPREAD_COUNT = 15;
const SPREAD_ARC = 130;
const SPREAD_CENTER = Math.floor(SPREAD_COUNT / 2);

/** A single card image (back art or drawn-card art) in a gold frame. Never
 * carries text or icons of its own — labels always render outside it. */
function FramedCard({ src, alt = "", className = "", reversed = false }) {
  return (
    <div
      className={`rounded-xl p-[3px] shadow-lg overflow-hidden ${className}`}
      style={{ background: "linear-gradient(135deg, var(--color-border-gold), var(--color-text-gold))" }}
    >
      <img
        src={src}
        alt={alt}
        className="h-full w-full rounded-[10px] object-cover"
        style={reversed ? { transform: "rotate(180deg)" } : undefined}
      />
    </div>
  );
}

const SUGGESTED_QUESTIONS = {
  career: [
    "Should I change jobs this year?",
    "Will my business succeed?",
    "Is this the right time for a promotion?",
  ],
  health: [
    "What should I focus on for my wellbeing?",
    "Will my energy improve soon?",
    "What is my body trying to tell me?",
  ],
  relationship: [
    "Where is this relationship heading?",
    "Should I reach out to them?",
    "What do I need to understand about this bond?",
  ],
  yesno: [
    "Will this work out?",
    "Should I go ahead with this?",
    "Is now the right time?",
  ],
};

export default function TarotTool() {
  const { t } = useTranslation();
  const [step, setStep] = useState(1);
  const [category, setCategory] = useState(null);
  const [question, setQuestion] = useState("");
  const [card, setCard] = useState(null);
  const [dealt, setDealt] = useState(false);
  const [pickedIndex, setPickedIndex] = useState(null);
  const [flipped, setFlipped] = useState(false);
  // ponytail: radius/arc scale off the viewport at mount, not on resize — a
  // rotate-mid-reading edge case, not worth a resize listener here.
  const [sceneWidth] = useState(() => (typeof window !== "undefined" ? window.innerWidth : 1024));
  const isNarrow = sceneWidth < 640;
  const spreadArc = isNarrow ? 90 : SPREAD_ARC;
  const spreadRadius = isNarrow ? 140 : 340;

  // Deal the fan out from the deck a beat after the spread mounts.
  useEffect(() => {
    if (step !== 3) return;
    setDealt(false);
    setPickedIndex(null);
    setFlipped(false);
    const t = setTimeout(() => setDealt(true), 60);
    return () => clearTimeout(t);
  }, [step]);

  const chooseCategory = (cat) => {
    setCategory(cat);
    setStep(2);
  };

  const submitQuestion = () => {
    if (!question.trim()) return;
    setStep(3);
  };

  // Flip, then advance, once a card is picked — cleared on unmount/reset so a
  // stray timer can't setState after the component is gone.
  useEffect(() => {
    if (pickedIndex === null) return;
    const flipTimer = setTimeout(() => setFlipped(true), 280);
    const advanceTimer = setTimeout(() => setStep(4), 1150);
    return () => {
      clearTimeout(flipTimer);
      clearTimeout(advanceTimer);
    };
  }, [pickedIndex]);

  const pickCard = (i) => {
    if (pickedIndex !== null) return;
    setCard(drawCard());
    setPickedIndex(i);
  };

  const reset = () => {
    setStep(1);
    setCategory(null);
    setQuestion("");
    setCard(null);
    setDealt(false);
    setPickedIndex(null);
    setFlipped(false);
  };

  const keywords = card ? (card.reversed ? card.keywordsReversed : card.keywordsUpright) : [];
  const meaning = card ? (card.reversed ? card.meaningReversed : card.meaningUpright) : "";

  return (
    <div>
      <div className="text-center mb-8">
        <div className="eyebrow mb-3">{t("tools.tarot.heading")}</div>
        <h3 className="font-serif text-3xl">{t("tools.tarot.title")}</h3>
        <p className="text-sm text-muted-foreground mt-2">
          {t("tools.tarot.subtext")}
        </p>
      </div>

      {step === 1 && (
        <div className="flex flex-nowrap justify-center items-stretch gap-3 sm:gap-6">
          {TAROT_CATEGORIES.map((cat, i) => (
            <button
              key={cat.slug}
              type="button"
              onClick={() => chooseCategory(cat)}
              data-testid={`tarot-category-${cat.slug}`}
              className="group w-20 sm:w-32 md:w-36 shrink-0 text-center transition-transform duration-300 hover:-translate-y-2 animate-fade-in-up"
              style={{ animationDelay: `${i * 80}ms` }}
            >
              <FramedCard src={CARD_BACK} className="aspect-[2/3] group-hover:shadow-2xl transition-shadow" />
              <div className="font-serif text-[11px] sm:text-base leading-tight text-foreground mt-2">{t(`tools.tarot.categories.${cat.slug}.label`)}</div>
              <div className="hidden sm:block text-[10px] leading-snug mt-1 text-muted-foreground">{t(`tools.tarot.categories.${cat.slug}.blurb`)}</div>
            </button>
          ))}
        </div>
      )}

      {step === 2 && (
        <div className="max-w-md mx-auto text-center">
          <Label className="eyebrow">{t("tools.tarot.yourQuestion", { category: t(`tools.tarot.categories.${category.slug}.label`) })}</Label>
          <Input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            className="mt-2 h-11 font-serif italic text-center"
            placeholder={t("tools.tarot.questionPlaceholder", { category: t(`tools.tarot.categories.${category.slug}.label`).toLowerCase() })}
            data-testid="tarot-question"
            autoFocus
          />
          <div className="flex flex-wrap justify-center gap-2 mt-3">
            {(SUGGESTED_QUESTIONS[category.slug] || []).map((suggestion, i) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => setQuestion(suggestion)}
                data-testid={`tarot-suggestion-${i}`}
                className="rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground hover:border-accent hover:text-foreground transition-colors"
              >
                {suggestion}
              </button>
            ))}
          </div>
          <div className="flex justify-center gap-3 mt-4">
            <Button onClick={submitQuestion} disabled={!question.trim()} data-testid="tarot-continue" className="rounded-full px-6">
              {t("tools.tarot.continue")}
            </Button>
            <Button variant="ghost" onClick={() => setStep(1)}>
              {t("tools.tarot.back")}
            </Button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div>
          <p className="text-sm text-muted-foreground mb-10 text-center">
            {pickedIndex === null ? t("tools.tarot.focusHint") : t("tools.tarot.revealing")}
          </p>
          <div className="tarot-scene relative h-72 sm:h-96 max-w-4xl mx-auto overflow-hidden">
            {Array.from({ length: SPREAD_COUNT }).map((_, i) => {
              const angle = (i - (SPREAD_COUNT - 1) / 2) * (spreadArc / (SPREAD_COUNT - 1));
              const rad = (angle * Math.PI) / 180;
              const radius = spreadRadius;
              const x = radius * Math.sin(rad);
              const y = radius * (1 - Math.cos(rad));
              const isCenter = i === SPREAD_CENTER;
              const isPicked = pickedIndex === i;
              const isOtherPicked = pickedIndex !== null && !isPicked;

              const transform = isPicked
                ? "translateX(-50%) translateY(-6px) scale(1.6) rotate(0deg)"
                : dealt
                ? `translateX(calc(-50% + ${x}px)) translateY(${y - (isCenter ? 10 : 0)}px) rotate(${angle}deg)`
                : "translateX(-50%) translateY(40px) rotate(0deg) scale(0.35)";

              return (
                <div
                  key={i}
                  className="absolute left-1/2 top-2"
                  style={{
                    transform,
                    opacity: isOtherPicked ? 0 : 1,
                    transition: `transform 550ms cubic-bezier(0.16, 1, 0.3, 1) ${dealt ? i * 30 : 0}ms, opacity 300ms ease-out`,
                    zIndex: isPicked ? 50 : isCenter ? SPREAD_COUNT : SPREAD_COUNT - Math.abs(i - SPREAD_CENTER),
                    pointerEvents: pickedIndex === null ? "auto" : "none",
                  }}
                >
                  <button
                    type="button"
                    onClick={() => pickCard(i)}
                    disabled={pickedIndex !== null}
                    data-testid={isCenter ? "tarot-draw" : undefined}
                    aria-label="Pick this card"
                    className={`block cursor-pointer transition-transform duration-300 disabled:cursor-default ${pickedIndex === null ? "hover:-translate-y-4 hover:scale-105 hover:z-20" : ""} ${isCenter ? "w-16 sm:w-20" : "w-12 sm:w-16"} ${isPicked ? "!w-16 sm:!w-20" : ""}`}
                  >
                    <div className={`tarot-flip aspect-[2/3] ${isPicked && flipped ? "is-flipped" : ""}`}>
                      <FramedCard
                        src={CARD_BACK}
                        className={`tarot-flip-face tarot-flip-face-back aspect-[2/3] ${isPicked ? "shadow-2xl animate-glow" : "hover:shadow-2xl"}`}
                      />
                      {isPicked && card && (
                        <FramedCard
                          src={card.image}
                          alt={card.name}
                          reversed={card.reversed}
                          className="tarot-flip-face tarot-flip-face-front aspect-[2/3] shadow-2xl"
                        />
                      )}
                    </div>
                  </button>
                </div>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground italic mt-3 text-center">
            {pickedIndex === null ? t("tools.tarot.tapToDraw") : " "}
          </p>
          <div className="text-center">
            <Button variant="ghost" onClick={() => setStep(2)} disabled={pickedIndex !== null} className="mt-2">
              {t("tools.tarot.back")}
            </Button>
          </div>
        </div>
      )}

      {step === 4 && card && (
        <div className="grid md:grid-cols-[auto_1fr] gap-10 items-start max-w-3xl mx-auto" data-testid="tarot-result">
          <div className="text-center animate-fade-in-up">
            <FramedCard src={card.image} alt={card.name} reversed={card.reversed} className="w-52 sm:w-60 aspect-[2/3] mx-auto shadow-2xl" />
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground mt-3">{t(`tools.tarot.categories.${category.slug}.label`)}</div>
            <div className="font-serif text-lg mt-1 leading-tight text-foreground">{card.name}</div>
            {card.reversed && <div className="text-[10px] mt-1 italic text-muted-foreground">{t("tools.tarot.reversed")}</div>}
            <div className="flex flex-wrap gap-1 justify-center mt-3">
              {keywords.map((kw) => (
                <Badge key={kw} variant="outline" className="text-[9px] px-1.5 py-0">
                  {kw}
                </Badge>
              ))}
            </div>
          </div>

          <div className="animate-fade-in-up">
            <p className="text-sm text-foreground/90 leading-relaxed">{meaning}</p>
            <blockquote className="font-serif italic text-lg leading-relaxed border-l-2 border-accent pl-4 mt-6">
              "{synthesizeReading(card, category, question)}"
            </blockquote>
            <p className="mt-4 text-xs text-muted-foreground italic">
              {t("tools.tarot.mirrorNote")}
            </p>
            <Button onClick={reset} data-testid="tarot-reset" className="mt-6 rounded-full px-6">
              {t("tools.tarot.startOver")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
