import React, { useEffect, useRef, useState } from "react";
import { Play, Pause, Mic, MicOff, Gauge } from "lucide-react";

/**
 * The Jewel — Shloka Player.
 * Asymmetric editorial layout:
 *  - Left: Devanagari verse + IAST + Word-by-word grammar (hover-highlight)
 *  - Right: Attributed translations + commentaries (tabs)
 *  - Bottom: Glass audio bar with playback and record-yourself (mocked mic recorder)
 */
export default function ShlokaPlayer({ verse }) {
  const [hovered, setHovered] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [tab, setTab] = useState("translations");
  const [recording, setRecording] = useState(false);
  const [progress, setProgress] = useState(0);
  const timerRef = useRef(null);
  const mediaRef = useRef(null);

  useEffect(() => {
    if (playing) {
      timerRef.current = setInterval(() => {
        setProgress((p) => (p >= 100 ? 0 : p + (0.6 * speed)));
      }, 100);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [playing, speed]);

  const startRec = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      rec.start();
      mediaRef.current = { rec, stream };
      setRecording(true);
    } catch { setRecording(false); }
  };
  const stopRec = () => {
    try { mediaRef.current?.rec?.stop(); mediaRef.current?.stream?.getTracks().forEach(t => t.stop()); } catch {}
    setRecording(false);
  };

  if (!verse) return null;
  const words = verse.word_by_word || [];
  const translations = verse.translations || [];
  const commentaries = verse.commentaries || [];

  return (
    <div className="relative rounded-lg border border-border bg-card/60 overflow-hidden animate-fade-in-up" data-testid="shloka-player">
      <div className="grid lg:grid-cols-[1.15fr_1fr]">
        {/* LEFT — Verse */}
        <div className="p-8 lg:p-14 border-b lg:border-b-0 lg:border-r border-border">
          <div className="flex items-baseline gap-3 mb-8">
            <div className="overline text-primary">{verse.scripture}</div>
            <div className="text-xs text-muted-foreground tabular">{verse.reference}</div>
          </div>
          <div className="font-devanagari text-3xl md:text-4xl leading-[1.9] tracking-wide text-foreground whitespace-pre-line" data-testid="shloka-devanagari">
            {verse.devanagari}
          </div>
          <div className="mt-8 pt-8 border-t border-border/60">
            <div className="overline mb-3">Transliteration (IAST)</div>
            <div className="font-serif italic text-lg md:text-xl leading-relaxed text-foreground/85 whitespace-pre-line" data-testid="shloka-iast">
              {verse.iast}
            </div>
          </div>

          {words.length > 0 && (
            <div className="mt-10">
              <div className="overline mb-3">Word by word</div>
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
        <div className="p-8 lg:p-14">
          <div className="flex gap-1 mb-6">
            {[
              { k: "translations", label: `Translations · ${translations.length}` },
              { k: "commentaries", label: `Commentaries · ${commentaries.length}` },
            ].map((t) => (
              <button
                key={t.k}
                onClick={() => setTab(t.k)}
                data-testid={`shloka-tab-${t.k}`}
                className={`text-xs uppercase tracking-widest px-3 py-2 rounded-full border transition-colors ${tab === t.k ? "bg-primary text-primary-foreground border-primary" : "border-border hover:border-primary/50"}`}
              >
                {t.label}
              </button>
            ))}
          </div>
          {tab === "translations" ? (
            <ul className="space-y-6">
              {translations.map((t, i) => (
                <li key={i} className="border-l-2 border-accent/50 pl-4">
                  <div className="overline text-accent-foreground/70">{t.author}</div>
                  <p className="font-serif italic text-lg leading-relaxed mt-1">"{t.text}"</p>
                </li>
              ))}
            </ul>
          ) : (
            <ul className="space-y-6">
              {commentaries.map((c, i) => (
                <li key={i}>
                  <div className="overline text-secondary/80">{c.author}</div>
                  <p className="text-sm leading-relaxed text-foreground/85 mt-1">{c.text}</p>
                </li>
              ))}
              {commentaries.length === 0 && <li className="text-sm text-muted-foreground">No commentaries attached.</li>}
            </ul>
          )}
        </div>
      </div>

      {/* Audio bar */}
      <div className="glass border-t border-border p-4 md:p-5 flex items-center gap-4">
        <button
          onClick={() => setPlaying((p) => !p)}
          data-testid="shloka-play-btn"
          className="w-11 h-11 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 transition-colors">
          {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
        </button>
        <div className="flex-1">
          <div className="h-1 rounded-full bg-muted overflow-hidden">
            <div className="h-full bg-accent transition-all" style={{ width: `${progress}%` }} />
          </div>
          <div className="flex items-center gap-3 mt-2 text-[11px] text-muted-foreground uppercase tracking-widest">
            <Gauge className="w-3 h-3" />
            {[0.5, 0.75, 1, 1.25, 1.5].map((s) => (
              <button key={s} onClick={() => setSpeed(s)}
                data-testid={`shloka-speed-${s}`}
                className={`px-1.5 py-0.5 rounded ${speed === s ? "text-primary" : "hover:text-foreground"}`}>
                {s}×
              </button>
            ))}
          </div>
        </div>
        <button
          onClick={() => (recording ? stopRec() : startRec())}
          data-testid="shloka-record-btn"
          className={`w-11 h-11 rounded-full border flex items-center justify-center transition-colors ${
            recording ? "border-primary bg-primary/10 text-primary animate-glow" : "border-border hover:border-primary/50"
          }`}
          title="Record yourself"
        >
          {recording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}
