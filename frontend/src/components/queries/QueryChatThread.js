import React, { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Send, Lock, XCircle } from "lucide-react";
import { fmtTime, fmtDate, STATUS_BADGE } from "@/lib/queryUtils";

/** Right panel — the active chat thread for a selected ticket. Shared by both portals. */
export default function QueryChatThread({ ticket, messages, mode, onSend, onClose, sending, closing, canClose }) {
  const [text, setText] = useState("");
  const bottomRef = useRef(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ block: "nearest" }); }, [messages.length]);

  if (!ticket) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card/40 h-[70vh] min-h-[520px] flex items-center justify-center text-sm text-muted-foreground">
        Select a query to view the conversation.
      </div>
    );
  }

  const status = STATUS_BADGE[ticket.status] || STATUS_BADGE.OPEN;
  const headerName = mode === "staff" ? (ticket.user_name || "Learner") : (ticket.assigned_staff_name || "Unassigned");
  const headerSub = mode === "staff" ? "Learner" : (ticket.assigned_staff_name ? "Mentor assigned" : "Waiting for a mentor to pick this up");
  const isClosed = ticket.status === "CLOSED";
  const isOwn = (m) => (mode === "staff" ? m.sender_role === "STAFF" : m.sender_role === "STUDENT");

  const submit = (e) => {
    e.preventDefault();
    if (!text.trim() || sending) return;
    onSend(text.trim());
    setText("");
  };

  return (
    <div className="rounded-2xl border border-border bg-card flex flex-col h-[70vh] min-h-[520px]" data-testid="query-thread">
      <div className="p-4 border-b border-border flex items-center gap-3">
        <Avatar className="w-10 h-10">
          <AvatarFallback className="bg-gradient-hot text-white font-semibold">{headerName[0]?.toUpperCase() || "?"}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="font-display font-semibold leading-tight truncate">{headerName}</div>
          <div className="text-[11px] text-muted-foreground">{headerSub}</div>
        </div>
        <Badge variant={status.variant} className="text-[9px] uppercase tracking-widest shrink-0" data-testid="query-status-badge">{status.label}</Badge>
        {canClose && !isClosed && (
          <Button size="sm" variant="outline" onClick={onClose} disabled={closing} className="rounded-full" data-testid="query-close-btn">
            <XCircle className="w-3.5 h-3.5 mr-1.5" /> {closing ? "Closing…" : "Close"}
          </Button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="text-center mb-4">
          <div className="text-[11px] text-muted-foreground">{ticket.title}</div>
          <div className="text-[10px] text-muted-foreground/70 mt-0.5">Opened {fmtDate(ticket.created_at)}</div>
        </div>
        {messages.map((m) => {
          if (m.sender_role === "SYSTEM") {
            return (
              <div key={m.id} className="flex justify-center my-3" data-testid={`query-msg-${m.id}`}>
                <span className="text-[11px] rounded-full bg-muted px-3 py-1 text-muted-foreground flex items-center gap-1.5">
                  <Lock className="w-3 h-3" /> {m.message_text}
                </span>
              </div>
            );
          }
          const own = isOwn(m);
          return (
            <div key={m.id} className={`flex ${own ? "justify-end" : "justify-start"} mb-3`} data-testid={`query-msg-${m.id}`}>
              <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${own ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-muted text-foreground rounded-bl-sm"}`}>
                <p className="text-sm whitespace-pre-wrap leading-relaxed">{m.message_text}</p>
                <div className={`text-[10px] mt-1 ${own ? "text-primary-foreground/70" : "text-muted-foreground"}`}>{fmtTime(m.created_at)}</div>
              </div>
            </div>
          );
        })}
        {messages.length === 0 && <div className="text-center text-sm text-muted-foreground py-10">No messages yet.</div>}
        <div ref={bottomRef} />
      </div>

      <div className="p-4 border-t border-border">
        {isClosed ? (
          <Button disabled className="w-full rounded-full" data-testid="query-closed-btn">
            <Lock className="w-4 h-4 mr-2" /> Query Closed
          </Button>
        ) : (
          <form onSubmit={submit} className="flex items-center gap-2">
            <Input value={text} onChange={(e) => setText(e.target.value)}
              placeholder="Type your message…" data-testid="query-message-input"
              className="flex-1 h-11 rounded-full px-4" />
            <Button type="submit" disabled={!text.trim() || sending} size="icon"
              className="rounded-full h-11 w-11 bg-gradient-hot text-white border-0 shrink-0" data-testid="query-send-btn">
              <Send className="w-4 h-4" />
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
