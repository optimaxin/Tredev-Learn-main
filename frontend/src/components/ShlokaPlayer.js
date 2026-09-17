import React, { useEffect, useRef, useState } from "react";
import { Play, Pause, Gauge } from "lucide-react";

/**
 * The Jewel — Shloka Player.
 * Asymmetric editorial layout:
 *  - Left: Devanagari verse + IAST + Word-by-word grammar (hover-highlight)
 *  - Right: Attributed translations + commentaries (tabs)
 *  - Bottom: Glass audio bar with playback
 */
const speechSupported = typeof window !== "undefined" && "speechSynthesis" in window;

function pickSanskritVoice() {
  if (!speechSupported) return null;
  const voices = window.speechSynthesis.getVoices();
  return voices.find((v) => /^(sa|hi)/i.test(v.lang)) || voices.find((v) => /^en/i.test(v.lang)) || voices[0] || null;
}

export default function ShlokaPlayer({ verse }) {
  const [hovered, setHovered] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [tab, setTab] = useState("translations");
  const [progress, setProgress] = useState(0);
  const [repeatCount, setRepeatCount] = useState(1);
  const repeatsLeftRef = useRef(0);

  // Reset playback state and cancel any in-flight speech when the verse changes or unmounts.
  useEffect(() => {
    setPlaying(false);
    setProgress(0);
    return () => {
      if (speechSupported) window.speechSynthesis.cancel();
    };
  }, [verse]);

  // Native speechSynthesis is the only playback path — the previous unofficial Google
  // translate_tts stream throttled unpredictably (intermittent 503s) and, on failure, briefly
  // played back the garbled error response before falling back, which is what sounded wrong.
  const speakOnce = (text) => {
    const utter = new SpeechSynthesisUtterance(text.replace(/\n/g, ". "));
    const voice = pickSanskritVoice();
    if (voice) utter.voice = voice;
    utter.lang = voice?.lang || "hi-IN";
    utter.rate = speed;
    utter.onboundary = (e) => setProgress(text.length ? (e.charIndex / text.length) * 100 : 0);
    utter.onend = () => {
      repeatsLeftRef.current -= 1;
      if (repeatsLeftRef.current > 0) { setProgress(0); speakOnce(text); }
      else { setPlaying(false); setProgress(0); }
    };
    utter.onerror = () => { setPlaying(false); setProgress(0); };
    window.speechSynthesis.speak(utter);
  };

  const togglePlay = () => {
    const text = verse?.devanagari || verse?.iast;
    if (!text || !speechSupported) return;
    if (playing) {
      window.speechSynthesis.cancel();
      setPlaying(false);
      setProgress(0);
      return;
    }
    repeatsLeftRef.current = Math.max(1, Math.min(20, Number(repeatCount) || 1));
    speakOnce(text);
    setPlaying(true);
  };

  if (!verse) return null;
  const words = verse.word_by_word || [];
  const translations = verse.translations || [];
  const commentaries = verse.commentaries || [];

  return (
    <div className="relative rounded-lg border border-border bg-card/60 overflow-hidden animate-fade-in-up" data-testid="shloka-player">
      <div className="grid lg:grid-cols-[1.15fr_1fr]">
        {/* LEFT — Verse */}
        <div className="p-5 sm:p-8 lg:p-14 border-b lg:border-b-0 lg:border-r border-border">
          <div className="flex items-baseline gap-3 mb-8">
            <div className="eyebrow text-primary">{verse.scripture}</div>
            <div className="text-xs text-muted-foreground tabular">{verse.reference}</div>
          </div>
          <div className="font-devanagari text-2xl sm:text-3xl md:text-4xl leading-[1.7] sm:leading-[1.9] tracking-wide text-foreground whitespace-pre-line" data-testid="shloka-devanagari">
            {verse.devanagari}
          </div>
          <div className="mt-8 pt-8 border-t border-border/60">
            <div className="eyebrow mb-3">Transliteration (IAST)</div>
            <div className="font-serif italic text-lg md:text-xl leading-relaxed text-foreground/85 whitespace-pre-line" data-testid="shloka-iast">
              {verse.iast}
            </div>
          </div>

          {words.length > 0 && (
            <div className="mt-10">
              <div className="eyebrow mb-3">Word by word</div>
              <div className="flex flex-wrap gap-2">
                {words.map((w, i) => (
                  <button
                    key={i}
                    onMouseEnter={() => setHovered(i)}
                    onMouseLeave={() => setHovered(null)}
                    onFocus={() => setHovered(i)}
                    data-testid={`shloka-word-${i}`}
                    className={`text-left px-3 py-2 rounded border transition-colors ${hovered === i ? "border-accent bg-accent/10" : "border-border hover:border-accent/60"}`}
                  >
                    <div className="font-devanagari text-lg">{w.sanskrit}</div>
                    <div className="text-[10px] tracking-widest uppercase text-muted-foreground mt-0.5">{w.iast}</div>
                  </button>
                ))}
              </div>
              {hovered !== null && words[hovered] && (
                <div className="mt-4 text-sm text-foreground/80">
                  <span className="text-primary font-medium">{words[hovered].iast}</span>{" "}
                  <span className="text-muted-foreground">·</span> {words[hovered].meaning}
                </div>
              )}
            </div>
          )}
        </div>

        {/* RIGHT — Attribution */}
        <div className="p-5 sm:p-8 lg:p-14">
          <div className="flex flex-wrap gap-2 mb-6">
            {[
              { k: "translations", label: `Translations · ${translations.length}` },
              { k: "commentaries", label: `Commentaries · ${commentaries.length}` },
            ].map((t) => (
              <button
                key={t.k}
                onClick={() => setTab(t.k)}
                data-testid={`shloka-tab-${t.k}`}
                className={`text-xs uppercase tracking-widest px-3 py-2 rounded-full border transition-colors whitespace-nowrap ${tab === t.k ? "bg-primary text-primary-foreground border-primary" : "border-border hover:border-primary/50"}`}
              >
                {t.label}
              </button>
            ))}
          </div>
          {tab === "translations" ? (
            <ul className="space-y-6">
              {translations.map((t, i) => (
                <li key={i} className="border-l-2 border-accent/50 pl-4">
                  <div className="eyebrow text-accent-foreground/70">{t.author}</div>
                  <p className="font-serif italic text-lg leading-relaxed mt-1">"{t.text}"</p>
                </li>
              ))}
            </ul>
          ) : (
            <ul className="space-y-6">
              {commentaries.map((c, i) => (
                <li key={i}>
                  <div className="eyebrow text-secondary/80">{c.author}</div>
                  <p className="text-sm leading-relaxed text-foreground/85 mt-1">{c.text}</p>
                </li>
              ))}
              {commentaries.length === 0 && <li className="text-sm text-muted-foreground">No commentaries attached.</li>}
            </ul>
          )}
        </div>
      </div>

      {/* Audio bar */}
      <div className="glass border-t border-border p-4 md:p-5 flex items-center gap-3 sm:gap-4">
        <button
          onClick={togglePlay}
          disabled={(!verse?.devanagari && !verse?.iast) || !speechSupported}
          data-testid="shloka-play-btn"
          title="Play pronunciation"
          className="w-11 h-11 shrink-0 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 transition-colors disabled:opacity-40">
          {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
        </button>
        <div className="flex-1 min-w-0">
          <div className="h-1 rounded-full bg-muted overflow-hidden">
            <div className="h-full bg-accent transition-all" style={{ width: `${progress}%` }} />
          </div>
          <div className="flex items-center gap-2 sm:gap-3 mt-2 text-[11px] text-muted-foreground uppercase tracking-widest flex-wrap">
            <Gauge className="w-3 h-3" />
            {[0.5, 0.75, 1, 1.25, 1.5].map((s) => (
              <button key={s} onClick={() => setSpeed(s)}
                data-testid={`shloka-speed-${s}`}
                className={`px-1.5 py-0.5 rounded ${speed === s ? "text-primary" : "hover:text-foreground"}`}>
                {s}×
              </button>
            ))}
            <label className="flex items-center gap-1.5 ml-2 pl-2 border-l border-border normal-case tracking-normal">
              Repeat
              <input
                type="number" min={1} max={20} value={repeatCount}
                onChange={(e) => setRepeatCount(e.target.value)}
                data-testid="shloka-repeat-count"
                className="w-12 h-6 rounded border border-border bg-background px-1.5 text-center text-foreground"
              />
              ×
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
