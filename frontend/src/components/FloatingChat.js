import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/context/AuthContext";
import api, { formatApiError } from "@/lib/api";
import { toast } from "sonner";
import { MessageCircle, X, Send, HelpCircle, PhoneCall, ArrowLeft, LogIn } from "lucide-react";

const POLL_MS = 20000;

/** Floating chat widget — auth-gated Doubt / Consultation quick-actions, routed to the Staff Panel. */
export default function FloatingChat() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const [open, setOpen] = useState(false);
  const [showTeaser, setShowTeaser] = useState(false);
  // screen: "menu" | "gate" | "doubt" | "consultation"
  const [screen, setScreen] = useState("menu");
  const [messages, setMessages] = useState([]);
  const [doubtDraft, setDoubtDraft] = useState("");
  const [phoneDraft, setPhoneDraft] = useState("");
  const [sending, setSending] = useState(false);
  const seenAnswered = useRef(new Set());
  const seenReplied = useRef(new Set());

  useEffect(() => {
    const timer = setTimeout(() => setShowTeaser(true), 6000);
    return () => clearTimeout(timer);
  }, []);

  // Reset the widget's thread whenever the signed-in user changes — chat state
  // must never leak between accounts sharing a browser/tab.
  useEffect(() => {
    setScreen("menu");
    setMessages([{ from: "bot", text: t("floatingChat.greeting", { name: user?.name ? `, ${user.name.split(" ")[0]}` : "" }) }]);
    seenAnswered.current = new Set();
    seenReplied.current = new Set();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Poll the learner's own doubts/consultations while the widget is open, and push any
  // newly resolved answer or reply into this specific user's chat window.
  useEffect(() => {
    if (!open || !user) return;
    const check = async () => {
      try {
        const { data } = await api.get("/doubts/mine");
        for (const d of data) {
          if (d.answer && !seenAnswered.current.has(d.id)) {
            seenAnswered.current.add(d.id);
            setMessages((m) => [...m, { from: "bot", text: t("floatingChat.doubtReply", { question: d.question, answer: d.answer }) }]);
          }
        }
      } catch { /* ignore transient failures */ }
      try {
        const { data } = await api.get("/consultations/mine-learner");
        for (const c of data) {
          if (c.reply && !seenReplied.current.has(c.id)) {
            seenReplied.current.add(c.id);
            setMessages((m) => [...m, { from: "bot", text: t("floatingChat.consultationReply", { reply: c.reply }) }]);
          }
        }
      } catch { /* ignore transient failures */ }
    };
    check();
    const poll = setInterval(check, POLL_MS);
    return () => clearInterval(poll);
  }, [open, user, t]);

  const requireAuth = (nextScreen) => {
    if (!user) { setScreen("gate"); return; }
    setScreen(nextScreen);
  };

  const goLogin = () => nav("/login", { state: { from: loc.pathname } });

  const submitDoubt = async () => {
    if (!doubtDraft.trim()) return;
    setSending(true);
    try {
      await api.post("/doubts", { question: doubtDraft.trim() });
      setMessages((m) => [...m, { from: "you", text: doubtDraft.trim() },
        { from: "bot", text: t("floatingChat.doubtSubmitted") }]);
      setDoubtDraft("");
      setScreen("menu");
    } catch (e) { toast.error(formatApiError(e)); }
    setSending(false);
  };

  const submitConsultation = async () => {
    if (!phoneDraft.trim()) return;
    setSending(true);
    try {
      await api.post("/consultations", {
        name: user.name, email: user.email, phone: phoneDraft.trim(),
        interest: "Chat widget consultation request", consent: true,
      });
      setMessages((m) => [...m, { from: "you", text: phoneDraft.trim() },
        { from: "bot", text: t("floatingChat.consultationSubmitted") }]);
      setPhoneDraft("");
      setScreen("menu");
    } catch (e) { toast.error(formatApiError(e)); }
    setSending(false);
  };

  return (
    <>
      {open && (
        <div className="fixed bottom-24 right-6 z-50 w-80 md:w-96 glass-strong rounded-2xl shadow-2xl overflow-hidden fade-in-up" data-testid="chat-widget">
          <div className="bg-gradient-hot text-white p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-xl">🕉️</div>
            <div>
              <div className="font-serif font-semibold">{t("floatingChat.title")}</div>
              <div className="text-[11px] opacity-90">{t("floatingChat.subtitle")}</div>
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

            {screen === "menu" && (
              <div className="flex flex-col gap-2 pt-1">
                <button onClick={() => requireAuth("doubt")} data-testid="chat-option-doubt"
                  className="flex items-center gap-2 text-sm px-3 py-2.5 rounded-xl border border-border bg-card hover:border-primary transition-colors text-left">
                  <HelpCircle className="w-4 h-4 text-primary shrink-0" /> {t("floatingChat.doubt")}
                </button>
                <button onClick={() => requireAuth("consultation")} data-testid="chat-option-consultation"
                  className="flex items-center gap-2 text-sm px-3 py-2.5 rounded-xl border border-border bg-card hover:border-primary transition-colors text-left">
                  <PhoneCall className="w-4 h-4 text-primary shrink-0" /> {t("floatingChat.consultation")}
                </button>
              </div>
            )}

            {screen === "gate" && (
              <div className="rounded-xl border border-border bg-card p-4 space-y-3" data-testid="chat-login-gate">
                <p className="text-sm">{t("floatingChat.loginFirst")}</p>
                <button onClick={goLogin} data-testid="chat-login-redirect"
                  className="w-full flex items-center justify-center gap-2 text-sm px-3 py-2 rounded-full bg-gradient-hot text-white">
                  <LogIn className="w-4 h-4" /> {t("floatingChat.goToLogin")}
                </button>
                <button onClick={() => setScreen("menu")} className="w-full text-xs text-muted-foreground flex items-center justify-center gap-1">
                  <ArrowLeft className="w-3 h-3" /> {t("floatingChat.back")}
                </button>
              </div>
            )}

            {screen === "doubt" && (
              <div className="rounded-xl border border-border bg-card p-4 space-y-3" data-testid="chat-doubt-form">
                <p className="text-sm">{t("floatingChat.enterDoubt")}</p>
                <textarea value={doubtDraft} onChange={(e) => setDoubtDraft(e.target.value)}
                  data-testid="chat-doubt-input" rows={3} placeholder={t("floatingChat.doubtPlaceholder")}
                  className="w-full text-sm p-3 rounded-lg bg-muted outline-none border border-transparent focus:border-primary resize-none" />
                <div className="flex gap-2">
                  <button onClick={submitDoubt} disabled={sending || !doubtDraft.trim()} data-testid="chat-doubt-submit"
                    className="flex-1 flex items-center justify-center gap-2 text-sm px-3 py-2 rounded-full bg-gradient-hot text-white disabled:opacity-60">
                    <Send className="w-4 h-4" /> {sending ? t("floatingChat.sending") : t("floatingChat.submit")}
                  </button>
                  <button onClick={() => setScreen("menu")} className="text-xs text-muted-foreground px-2">{t("floatingChat.cancel")}</button>
                </div>
              </div>
            )}

            {screen === "consultation" && (
              <div className="rounded-xl border border-border bg-card p-4 space-y-3" data-testid="chat-consultation-form">
                <p className="text-sm">{t("floatingChat.enterPhone")}</p>
                <input value={phoneDraft} onChange={(e) => setPhoneDraft(e.target.value)} type="tel"
                  data-testid="chat-phone-input" placeholder="+91 …"
                  className="w-full h-10 px-3 rounded-full bg-muted text-sm outline-none border border-transparent focus:border-primary" />
                <div className="flex gap-2">
                  <button onClick={submitConsultation} disabled={sending || !phoneDraft.trim()} data-testid="chat-consultation-submit"
                    className="flex-1 flex items-center justify-center gap-2 text-sm px-3 py-2 rounded-full bg-gradient-hot text-white disabled:opacity-60">
                    <Send className="w-4 h-4" /> {sending ? t("floatingChat.sending") : t("floatingChat.submit")}
                  </button>
                  <button onClick={() => setScreen("menu")} className="text-xs text-muted-foreground px-2">{t("floatingChat.cancel")}</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      {!open && showTeaser && (
        <div className="fixed bottom-24 right-6 z-40 glass rounded-2xl p-3 pr-4 max-w-xs shadow-lg fade-in-up hidden sm:block" data-testid="chat-teaser">
          <div className="text-xs text-muted-foreground">🙏 Rādhe Rādhe</div>
          <div className="text-sm mt-1">{t("floatingChat.teaser")}</div>
        </div>
      )}
      <button
        onClick={() => { setOpen((o) => !o); setShowTeaser(false); }}
        data-testid="chat-toggle"
        className={`fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-gradient-hot text-white flex items-center justify-center shadow-2xl transition-transform hover:scale-105 ${!open ? "pulse-glow" : ""}`}
        aria-label={t("floatingChat.openChat")}
      >
        {open ? <X className="w-6 h-6" /> : <MessageCircle className="w-6 h-6" />}
      </button>
    </>
  );
}
