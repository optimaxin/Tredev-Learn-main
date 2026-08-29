import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { drawThreeCards, synthesizeReading } from "@/lib/tools/tarotDeck";

const DECK_STACK = [-6, -2, 2, 6, 0];

export default function TarotTool() {
  const [question, setQuestion] = useState("");
  const [spread, setSpread] = useState(null);

  const draw = () => setSpread(drawThreeCards());
  const reset = () => setSpread(null);

  return (
    <div className="grid md:grid-cols-[1fr_1.4fr] gap-10">
      <div>
        <div className="eyebrow mb-3">Tarot · reflective reading</div>
        <h3 className="font-serif text-3xl">A mirror, not a prophecy.</h3>
        <p className="text-sm text-muted-foreground mt-2 mb-6">
          Focus on your question, then draw three cards — Past, Present, Future.
        </p>
        <Label className="eyebrow">Your question / focus (optional)</Label>
        <Input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          className="mt-2 h-11 font-serif italic"
          placeholder="What do I need to see today?"
          data-testid="tarot-question"
        />

        {!spread && (
          <button
            type="button"
            onClick={draw}
            data-testid="tarot-draw"
            className="relative mt-10 h-40 w-28 mx-auto md:mx-0 block cursor-pointer"
            aria-label="Draw three cards"
          >
            {DECK_STACK.map((rotate, i) => (
              <div
                key={i}
                className="absolute inset-0 rounded-lg border border-border bg-gradient-cosmic"
                style={{ transform: `rotate(${rotate}deg) translateY(${i * -1}px)` }}
              />
            ))}
          </button>
        )}
        {!spread && (
          <p className="text-xs text-muted-foreground italic mt-3 text-center md:text-left">Tap the deck to draw</p>
        )}

        {spread && (
          <Button onClick={reset} data-testid="tarot-reset" className="mt-4 rounded-full px-6">
            Draw again
          </Button>
        )}
      </div>

      {spread && (
        <div data-testid="tarot-result">
          <div className="grid grid-cols-3 gap-3">
            {spread.map((c, i) => {
              const keywords = c.reversed ? c.keywordsReversed : c.keywordsUpright;
              const meaning = c.reversed ? c.meaningReversed : c.meaningUpright;
              return (
                <div
                  key={c.id}
                  className="rounded-lg border border-border bg-gradient-cosmic p-5 text-white text-center relative overflow-hidden aspect-[3/5] flex flex-col justify-between animate-fade-in-up"
                  style={{ animationDelay: `${i * 150}ms` }}
                >
                  <div>
                    <div className="text-[10px] uppercase tracking-widest opacity-80">{c.position}</div>
                    <div className="font-serif text-lg mt-2 leading-tight">{c.name}</div>
                    {c.reversed && <div className="text-[10px] mt-1 opacity-70 italic">reversed</div>}
                    <div className="flex flex-wrap gap-1 justify-center mt-2">
                      {keywords.slice(0, 3).map((kw) => (
                        <Badge key={kw} variant="outline" className="text-[9px] px-1.5 py-0 border-white/30 text-white/90">
                          {kw}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div className="text-4xl opacity-30">✦</div>
                  <p className="text-xs opacity-90 leading-snug">{meaning}</p>
                </div>
              );
            })}
          </div>
          <blockquote className="font-serif italic text-lg leading-relaxed border-l-2 border-accent pl-4 mt-6">
            "{synthesizeReading(spread)}"
          </blockquote>
          <p className="mt-4 text-xs text-muted-foreground italic">
            A mirror for reflection, not a fixed fate. {question && `Held alongside your question: "${question}"`}
          </p>
        </div>
      )}
    </div>
  );
}
