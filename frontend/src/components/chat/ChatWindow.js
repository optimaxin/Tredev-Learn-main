import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { Send, Lock, Trash2, Megaphone, Paperclip, X, Menu } from "lucide-react";
import api, { formatApiError } from "@/lib/api";
import { compressImage } from "@/lib/upload";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import SenderInfoDialog from "@/components/chat/SenderInfoDialog";
import { fmtTime } from "@/lib/queryUtils";
import { CHAT } from "@/constants/testIds";

const ACCEPTED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"];
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export default function ChatWindow({ channel, messages, setMessages, hasMore, onLoadOlder, user, isStaff, socket, onDeleteChannel, onToggleReadOnly, onOpenSidebar }) {
  const [text, setText] = useState("");
  const [signinOpen, setSigninOpen] = useState(false);
  const [attachment, setAttachment] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [senderInfo, setSenderInfo] = useState(null);
  const [senderInfoOpen, setSenderInfoOpen] = useState(false);
  const bottomRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ block: "nearest" }); }, [messages.length]);

  const MobileMenuButton = () => (
    <Button size="icon" variant="ghost" className="h-8 w-8 md:hidden shrink-0" title="Channels" onClick={onOpenSidebar}>
      <Menu className="w-4 h-4" />
    </Button>
  );

  if (!channel) {
    return (
      <div className="flex-1 flex flex-col min-h-0">
        <div className="p-2 border-b border-border md:hidden"><MobileMenuButton /></div>
        <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
          Select a channel to start chatting.
        </div>
      </div>
    );
  }

  if (channel.locked) {
    return (
      <div className="flex-1 flex flex-col min-h-0">
        <div className="p-2 border-b border-border md:hidden"><MobileMenuButton /></div>
        <div className="flex-1 flex flex-col items-center justify-center text-center gap-2 text-muted-foreground p-8">
          <Lock className="w-8 h-8" />
          <p className="text-sm max-w-xs">Enrolled learners of this course can join this chat.</p>
        </div>
      </div>
    );
  }

  const deleteMessage = async (id) => {
    try {
      await api.delete(`/messages/${id}`);
      setMessages((prev) => prev.filter((m) => m.id !== id));
    } catch (err) {
      toast.error(formatApiError(err));
    }
  };

  const showSenderInfo = async (messageId) => {
    try {
      const { data } = await api.get(`/messages/${messageId}/sender`);
      setSenderInfo(data);
      setSenderInfoOpen(true);
    } catch (err) {
      toast.error(formatApiError(err));
    }
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) return toast.error("Only PNG, JPEG, GIF, or WEBP images are allowed.");
    // Compress first (native canvas re-encode, no library) — a phone photo that's
    // over the 5MB cap raw often fits comfortably once downscaled/re-encoded.
    const compressed = await compressImage(file);
    if (compressed.size > MAX_IMAGE_BYTES) return toast.error("Image must be 5MB or smaller.");
    setAttachment(compressed);
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!text.trim() && !attachment) return;
    let attachmentUrl = "";
    if (attachment) {
      setUploading(true);
      try {
        const { data } = await api.post("/chat/sign-upload", {
          channel_id: channel.id,
          filename: attachment.name,
          content_type: attachment.type,
        });
        await axios.put(data.upload_url, attachment, { headers: { "Content-Type": attachment.type } });
        attachmentUrl = data.public_url;
      } catch (err) {
        toast.error(formatApiError(err));
        setUploading(false);
        return;
      }
      setUploading(false);
    }
    socket.send(text.trim(), attachmentUrl);
    setText("");
    setAttachment(null);
  };

  return (
    <div className="flex-1 flex flex-col h-[70vh] min-h-[520px]">
      <div className="p-4 border-b border-border flex items-center gap-3">
        <MobileMenuButton />
        <div className="flex-1 min-w-0">
          <div className="font-display font-semibold leading-tight truncate"># {channel.name}</div>
          {channel.course_title && <div className="text-[11px] text-muted-foreground">{channel.course_title}</div>}
        </div>
        {channel.is_read_only && <Megaphone className="w-4 h-4 text-muted-foreground shrink-0" />}
        {isStaff && (
          <>
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0">
              Members can post
              <Switch checked={!channel.is_read_only} onCheckedChange={() => onToggleReadOnly(channel)}
                data-testid={CHAT.toggleReadOnlyButton} />
            </label>
            <Button size="icon" variant="ghost" className="h-8 w-8" title="Delete channel"
              onClick={() => onDeleteChannel(channel)} data-testid={CHAT.deleteChannelButton}>
              <Trash2 className="w-4 h-4" />
            </Button>
          </>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {hasMore && (
          <div className="text-center mb-3">
            <Button size="sm" variant="outline" className="rounded-full" onClick={onLoadOlder} data-testid={CHAT.loadOlderButton}>
              Load older messages
            </Button>
          </div>
        )}
        {messages.map((m) => {
          const own = user && m.user_id === user.id;
          const canDelete = m.can_delete;
          return (
            <div key={m.id} className={`group flex gap-2 ${own ? "justify-end" : "justify-start"} mb-3`} data-testid={`chat-msg-${m.id}`}>
              {!own && (
                <Avatar className="w-8 h-8 shrink-0">
                  <AvatarFallback className="bg-gradient-hot text-white text-xs font-semibold">{m.user_name?.[0]?.toUpperCase() || "?"}</AvatarFallback>
                </Avatar>
              )}
              <div className={`max-w-[85%] sm:max-w-[70%] ${own ? "items-end" : "items-start"} flex flex-col`}>
                {!own && <div className="text-[11px] text-muted-foreground mb-0.5">{m.user_name}</div>}
                <div className="flex items-center gap-1.5">
                  {canDelete && (
                    <button onClick={() => deleteMessage(m.id)} data-testid={`chat-delete-msg-${m.id}`}
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <div
                    onClick={isStaff ? () => showSenderInfo(m.id) : undefined}
                    data-testid={`${CHAT.messageInfoPrefix}-${m.id}`}
                    className={`rounded-2xl px-4 py-2.5 ${isStaff ? "cursor-pointer" : ""} ${own ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-muted text-foreground rounded-bl-sm"}`}>
                    <p className="text-sm whitespace-pre-wrap leading-relaxed">{m.content}</p>
                    {m.attachment_url && <img src={m.attachment_url} alt="" className="mt-2 rounded-lg max-h-64" />}
                    <div className={`text-[10px] mt-1 ${own ? "text-primary-foreground/70" : "text-muted-foreground"}`}>{fmtTime(m.created_at)}</div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        {messages.length === 0 && <div className="text-center text-sm text-muted-foreground py-10">No messages yet.</div>}
        <div ref={bottomRef} />
      </div>

      <div className="p-4 border-t border-border">
        {!user ? (
          <div className="flex items-center justify-between gap-3 rounded-full bg-muted px-4 py-2.5" data-testid={CHAT.readOnlyBanner}>
            <span className="text-sm text-muted-foreground">Sign in to join the conversation</span>
            <Button size="sm" className="rounded-full" onClick={() => setSigninOpen(true)} data-testid={CHAT.guestSigninButton}>
              Sign in
            </Button>
          </div>
        ) : !channel.can_write ? (
          <div className="text-sm text-muted-foreground text-center">Staff-only channel — read only</div>
        ) : (
          <>
            {attachment && (
              <div className="flex items-center gap-2 mb-2 text-xs bg-muted rounded-full px-3 py-1.5 w-fit">
                <span className="truncate max-w-[160px]">{attachment.name}</span>
                <button type="button" onClick={() => setAttachment(null)} className="text-muted-foreground hover:text-destructive">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
            <form onSubmit={submit} className="flex items-center gap-2">
              <input ref={fileInputRef} type="file" accept={ACCEPTED_IMAGE_TYPES.join(",")} onChange={handleFileChange} hidden />
              <Button type="button" size="icon" variant="ghost" className="h-11 w-11 rounded-full shrink-0" title="Attach an image"
                onClick={() => fileInputRef.current?.click()} data-testid={CHAT.attachmentButton}>
                <Paperclip className="w-4 h-4" />
              </Button>
              <Input value={text} onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(e); } }}
                placeholder="Type your message…" data-testid={CHAT.messageInput}
                className="flex-1 h-11 rounded-full px-4" />
              <Button type="submit" disabled={(!text.trim() && !attachment) || !socket.connected || uploading} size="icon"
                className="rounded-full h-11 w-11 bg-gradient-hot text-white border-0 shrink-0" data-testid={CHAT.sendButton}>
                <Send className="w-4 h-4" />
              </Button>
            </form>
            {uploading && <div className="text-[11px] text-muted-foreground mt-1.5">Uploading…</div>}
          </>
        )}
      </div>

      <Dialog open={signinOpen} onOpenChange={setSigninOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sign in to join the conversation</DialogTitle>
          </DialogHeader>
          <DialogFooter>
            <Link to="/login"><Button data-testid="chat-signin-modal-link">Sign in</Button></Link>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SenderInfoDialog open={senderInfoOpen} onOpenChange={setSenderInfoOpen} info={senderInfo} />
    </div>
  );
}
