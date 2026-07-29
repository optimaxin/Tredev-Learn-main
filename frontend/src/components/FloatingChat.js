import React, { useState, useEffect } from "react";
import { MessageCircle, X, Send } from "lucide-react";

/** Floating chat widget — modeled on Occult Gurukul's chat, static/scripted for MVP. */
export default function FloatingChat() {
  const [open, setOpen] = useState(false);
  const [showTeaser, setShowTeaser] = useState(false);
  const [messages, setMessages] = useState([
    { from: "bot", text: "🙏 Namaskāra! Welcome to Tredev Learn." },
    { from: "bot", text: "Not sure where to begin? I can point you to the right pathway — or you can book a free consultation with a human." },
  ]);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setShowTeaser(true), 6000);
    return () => clearTimeout(t);
  }, []);

  const send = () => {
    if (!draft.trim()) return;
    const q = draft.trim();
    setMessages((m) => [...m, { from: "you", text: q }]);
    setDraft("");
    setTimeout(() => {
      let reply = "For a personalised pathway, tap 'Free Consultation' — a real academic staff member will reach out within 24 hours.";
      const l = q.toLowerCase();
      if (l.includes("gita")) reply = "Start with Bhagavad Gītā — A Verse-by-Verse Journey (₹4,999). Ācharya-signed, 12 weeks self-paced.";
      else if (l.includes("sanskrit")) reply = "Sanskrit for Absolute Beginners (₹8,999) is our 8-week live cohort. Vasant Panchamī is a beautiful moment to start.";
      else if (l.includes("astro") || l.includes("kundli")) reply = "Try 'Introduction to Vedic Astrology as Śāstra' (₹5,999). We teach the discipline, not fortune-telling.";
      else if (l.includes("sadhana") || l.includes("mantra")) reply = "The 40-day Rudram Sādhana (₹2,999) opens at Mahā Śivarātri. Daily japa, cohort practice, compassionate streak.";
      else if (l.includes("free") || l.includes("cost")) reply = "Free tools: Panchang, Kundli, Numerology, Tarot, Rāma Śalākā, Shloka of the day. And a free pathway consultation with a human.";
      setMessages((m) => [...m, { from: "bot", text: reply }]);
    }, 700);
  };

  return (
    <>
      {open && (
        <div className="fixed bottom-24 right-6 z-50 w-80 md:w-96 glass-strong rounded-2xl shadow-2xl overflow-hidden fade-in-up" data-testid="chat-widget">
          <div className="bg-gradient-hot text-white p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-xl">🕉️</div>
            <div>
              <div className="font-serif font-semibold">Tredev Guide</div>
              <div className="text-[11px] opacity-90">Typically replies within an hour</div>
            </div>
            <button onClick={() => setOpen(false)} data-testid="chat-close" className="ml-auto opacity-80 hover:opacity-100">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="h-72 overflow-y-auto p-4 space-y-3 bg-background">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.from === "you" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[80%] text-sm px-3 py-2 rounded-2xl ${
                  m.from === "you" ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-muted text-foreground rounded-bl-sm"
                }`}>{m.text}</div>
              </div>
            ))}
          </div>
          <div className="p-3 border-t border-border flex gap-2">
            <input value={draft} onChange={(e)=>setDraft(e.target.value)} onKeyDown={(e)=>e.key==="Enter" && send()}
              placeholder="Ask about a course, tradition, or sadhana…"
              data-testid="chat-input"
              className="flex-1 h-10 px-3 rounded-full bg-muted text-sm outline-none border border-transparent focus:border-primary" />
            <button onClick={send} data-testid="chat-send"
              className="w-10 h-10 rounded-full bg-gradient-hot text-white flex items-center justify-center">
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
      {!open && showTeaser && (
        <div className="fixed bottom-24 right-6 z-40 glass rounded-2xl p-3 pr-4 max-w-xs shadow-lg fade-in-up hidden sm:block" data-testid="chat-teaser">
          <div className="text-xs text-muted-foreground">🙏 Rādhe Rādhe</div>
          <div className="text-sm mt-1">Not sure where to start? Ask me anything.</div>
        </div>
      )}
      <button
        onClick={() => { setOpen((o) => !o); setShowTeaser(false); }}
        data-testid="chat-toggle"
        className={`fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-gradient-hot text-white flex items-center justify-center shadow-2xl transition-transform hover:scale-105 ${!open ? "pulse-glow" : ""}`}
        aria-label="Open chat"
      >
        {open ? <X className="w-6 h-6" /> : <MessageCircle className="w-6 h-6" />}
      </button>
    </>
  );
}
