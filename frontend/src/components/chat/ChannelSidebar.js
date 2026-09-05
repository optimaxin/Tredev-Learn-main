import React from "react";
import { Lock, Megaphone, Plus, Link2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { CHAT } from "@/constants/testIds";

export default function ChannelSidebar({ channels, selectedChannelId, onSelect, isStaff, onCreate, mobileOpen, onClose }) {
  const publicChannels = channels.filter((c) => c.type === "PUBLIC");
  const courseChannels = channels.filter((c) => c.type === "COURSE_PRIVATE");
  const inviteChannels = channels.filter((c) => c.type === "INVITE_ONLY");

  const copyInviteLink = (e, token) => {
    e.stopPropagation();
    navigator.clipboard.writeText(`${window.location.origin}/community?join=${token}`);
    toast.success("Invite link copied");
  };

  const renderGroup = (label, list) => (
    list.length > 0 && (
      <div className="mb-4">
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground px-3 mb-1.5">{label}</div>
        {list.map((c) => {
          const active = c.id === selectedChannelId;
          return (
            <button
              key={c.id}
              onClick={() => { onSelect(c.id); onClose?.(); }}
              data-testid={`${CHAT.channelPrefix}-${c.id}`}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left transition-colors ${
                active ? "bg-primary text-primary-foreground" : "hover:bg-muted text-foreground/85"
              } ${c.locked ? "opacity-50" : ""}`}
            >
              {c.type === "INVITE_ONLY" && !c.join_token && <Link2 className="w-3.5 h-3.5 shrink-0" />}
              <span className="truncate flex-1"># {c.name}</span>
              {c.locked && <Lock className="w-3.5 h-3.5 shrink-0" />}
              {c.is_read_only && <Megaphone className="w-3.5 h-3.5 shrink-0" />}
              {c.join_token && (
                <span
                  role="button"
                  title="Copy invite link"
                  onClick={(e) => copyInviteLink(e, c.join_token)}
                  data-testid={`chat-copy-invite-${c.id}`}
                  className="shrink-0 opacity-70 hover:opacity-100"
                >
                  <Link2 className="w-3.5 h-3.5" />
                </span>
              )}
            </button>
          );
        })}
      </div>
    )
  );

  return (
    <div
      className={`${mobileOpen ? "flex" : "hidden"} md:flex absolute md:relative inset-0 z-20 bg-card
        w-full md:w-64 shrink-0 border-r border-border p-3 flex-col h-[70vh] min-h-[520px] overflow-y-auto`}
    >
      <div className="flex items-center justify-between px-1 mb-3">
        <span className="font-display font-semibold">Channels</span>
        <div className="flex items-center gap-1">
          {isStaff && (
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onCreate} data-testid={CHAT.createChannelButton}>
              <Plus className="w-4 h-4" />
            </Button>
          )}
          <Button size="icon" variant="ghost" className="h-7 w-7 md:hidden" onClick={onClose} title="Close">
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>
      {renderGroup("Public", publicChannels)}
      {renderGroup("My Courses", courseChannels)}
      {renderGroup("Invite-only", inviteChannels)}
      {channels.length === 0 && <div className="text-sm text-muted-foreground px-3">No channels yet.</div>}
    </div>
  );
}
