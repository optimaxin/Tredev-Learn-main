import React, { useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { GRID_SIZE, buildFlatGrid, traverseFromCell } from "@/lib/tools/ramShalaka";

const FLAT_GRID = buildFlatGrid();

export default function RamShalakaTool() {
  const [question, setQuestion] = useState("");
  const [result, setResult] = useState(null);
  const [hover, setHover] = useState(null);

  const highlighted = result ? new Set(result.path) : hover != null ? new Set(traverseFromCell(hover).path) : null;

  const onCellClick = (idx) => {
    setResult(traverseFromCell(idx));
  };

  return (
    <div>
      <div className="eyebrow mb-3">Rāma Śalākā Prashnāvalī · 15×15</div>
      <h3 className="font-serif text-3xl mb-2">Ask, then choose a letter.</h3>
      <p className="text-sm text-muted-foreground mb-6 max-w-2xl">
        Hold your question in mind, then click any cell. Every 9th letter from there — wrapping around the grid —
        assembles one of nine lines. A reflective tradition, not a promise of outcome.
      </p>

      <div className="mb-6 max-w-md">
        <Label className="eyebrow">Your question (optional, for your own focus)</Label>
        <Input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          className="mt-2 h-11 font-serif italic"
          data-testid="shalaka-question"
          placeholder="What do I need to see today?"
        />
      </div>

      <div
        className="grid gap-1 max-w-2xl mx-auto mb-8 select-none"
        style={{ gridTemplateColumns: `repeat(${GRID_SIZE}, minmax(0, 1fr))` }}
        data-testid="shalaka-grid"
      >
        {FLAT_GRID.map((cell, idx) => {
          const isHighlighted = highlighted?.has(idx);
          const isChosen = result?.cellIndex === idx;
          return (
            <button
              key={idx}
              type="button"
              onMouseEnter={() => setHover(idx)}
              onMouseLeave={() => setHover(null)}
              onClick={() => onCellClick(idx)}
              className={`aspect-square rounded-sm border text-[9px] sm:text-[10px] font-devanagari flex items-center justify-center transition-colors overflow-hidden leading-none px-0.5
                ${isChosen ? "bg-primary text-primary-foreground border-primary" : isHighlighted ? "bg-accent/40 border-accent" : "bg-card/50 border-border hover:bg-accent/20"}`}
              data-testid={`shalaka-cell-${idx}`}
            >
              {cell}
            </button>
          );
        })}
      </div>

      {result && (
        <div className="rounded-lg border border-border p-8 bg-card/60 relative overflow-hidden animate-fade-in-up" data-testid="shalaka-result">
          <div className="text-6xl mb-3 opacity-30">🏹</div>
          <div className="eyebrow mb-2 text-primary">{result.auspiciousness}</div>
          <blockquote className="font-devanagari text-2xl leading-relaxed border-l-2 border-accent pl-4" data-testid="shalaka-chaupai">
            {result.text}
          </blockquote>
          <p className="mt-4 text-sm text-foreground/80 leading-relaxed">{result.meaning}</p>
          <p className="mt-6 text-xs text-muted-foreground italic">
            Traced from your chosen letter, every 9th cell, across the 225-letter grid. This is an interactive
            demonstration of the traditional mechanism using devotional lines composed for this tool — not a
            letter-perfect reproduction of one specific printed edition. A study object, not a fortune.
          </p>
        </div>
      )}
    </div>
  );
}
