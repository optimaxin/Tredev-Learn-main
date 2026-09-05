import React, { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import api, { formatApiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import useChatSocket from "@/hooks/useChatSocket";
import ChannelSidebar from "@/components/chat/ChannelSidebar";
import ChatWindow from "@/components/chat/ChatWindow";
import CreateChannelModal from "@/components/chat/CreateChannelModal";

const STAFF_ROLES = ["academic_staff", "admin", "super_admin"];
const LAST_CHANNEL_KEY = "tredev_last_channel_id";

export default function Community() {
  const { t } = useTranslation();
  const { user, loading: authLoading } = useAuth();
  const isStaff = !!user && STAFF_ROLES.includes(user.role);
  const [searchParams, setSearchParams] = useSearchParams();
  const joinAttemptedRef = useRef(null);

  const [channels, setChannels] = useState([]);
  const [selectedChannelId, setSelectedChannelId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const selectedChannel = channels.find((c) => c.id === selectedChannelId) || null;

  const loadChannels = async (preferId) => {
    try {
      const { data } = await api.get("/channels");
      const list = Array.isArray(data?.channels) ? data.channels : [];
      setChannels(list);
      if (preferId !== undefined && list.some((c) => c.id === preferId)) {
        setSelectedChannelId(preferId);
      } else if (!selectedChannelId || !list.some((c) => c.id === selectedChannelId)) {
        const remembered = localStorage.getItem(LAST_CHANNEL_KEY);
        const general = list.find((c) => c.name === "general");
        const fallback = general ? general.id : list[0]?.id ?? null;
        setSelectedChannelId(remembered && list.some((c) => c.id === remembered) ? remembered : fallback);
      }
    } catch (err) {
      toast.error(formatApiError(err));
    }
  };

  useEffect(() => { loadChannels(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Remember the open channel so leaving Community (navbar, back button, etc.) and
  // returning shows the same channel instead of resetting to #general.
  useEffect(() => {
    if (selectedChannelId) localStorage.setItem(LAST_CHANNEL_KEY, selectedChannelId);
  }, [selectedChannelId]);

  useEffect(() => {
    const token = searchParams.get("join");
    if (!token || authLoading || joinAttemptedRef.current === token) return;

    if (!user) {
      joinAttemptedRef.current = token;
      toast.error(t("community.signInToJoin"));
      setSearchParams((prev) => { const next = new URLSearchParams(prev); next.delete("join"); return next; }, { replace: true });
      return;
    }

    joinAttemptedRef.current = token;
    api.post(`/channels/join/${token}`)
      .then(({ data }) => {
        toast.success(t("community.joinedChannel"));
        loadChannels(data.id);
      })
      .catch((err) => toast.error(formatApiError(err)))
      .finally(() => {
        setSearchParams((prev) => { const next = new URLSearchParams(prev); next.delete("join"); return next; }, { replace: true });
      });
  }, [searchParams, user, authLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!selectedChannel || selectedChannel.locked) { setMessages([]); setHasMore(false); return; }
    api.get(`/channels/${selectedChannel.id}/messages`)
      .then(({ data }) => { setMessages(Array.isArray(data?.messages) ? data.messages : []); setHasMore(!!data?.has_more); })
      .catch((err) => toast.error(formatApiError(err)));
  }, [selectedChannelId]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadOlder = async () => {
    if (!messages.length) return;
    const before = messages[0].created_at;
    try {
      const { data } = await api.get(`/channels/${selectedChannel.id}/messages`, { params: { before, limit: 50 } });
      setMessages((prev) => [...(Array.isArray(data?.messages) ? data.messages : []), ...prev]);
      setHasMore(!!data?.has_more);
    } catch (err) {
      toast.error(formatApiError(err));
    }
  };

  const socket = useChatSocket(selectedChannel && !selectedChannel.locked ? selectedChannel.id : null, {
    onMessage: (message) => setMessages((prev) => (prev.some((m) => m.id === message.id) ? prev : [...prev, message])),
    onMessageDeleted: (messageId) => setMessages((prev) => prev.filter((m) => m.id !== messageId)),
    onChannelUpdated: (channel) => setChannels((prev) => prev.map((c) => (c.id === channel.id ? { ...c, ...channel } : c))),
    onChannelsChanged: () => loadChannels(selectedChannelId),
    onChannelDeleted: (channelId) => {
      setChannels((prev) => {
        const next = prev.filter((c) => c.id !== channelId);
        if (channelId === selectedChannelId) {
          const general = next.find((c) => c.name === "general");
          setSelectedChannelId(general ? general.id : next[0]?.id ?? null);
        }
        return next;
      });
    },
    onError: (reason) => toast.error(reason),
  });

  const deleteChannel = async (channel) => {
    if (!window.confirm(t("community.confirmDelete", { name: channel.name }))) return;
    try {
      await api.delete(`/channels/${channel.id}`);
      toast.success(t("community.channelDeleted"));
    } catch (err) {
      toast.error(formatApiError(err));
    }
  };

  const toggleReadOnly = async (channel) => {
    try {
      const { data } = await api.patch(`/channels/${channel.id}`, { is_read_only: !channel.is_read_only });
      setChannels((prev) => prev.map((c) => (c.id === channel.id ? data : c)));
    } catch (err) {
      toast.error(formatApiError(err));
    }
  };

  return (
    <div className="max-w-6xl mx-auto py-10 px-4 md:px-6">
      <div className="eyebrow mb-2">{t("community.badge")}</div>
      <h1 className="text-4xl font-display tracking-tight mb-6">{t("community.heading")}</h1>
      <div className="rounded-2xl border border-border bg-card flex overflow-hidden relative">
        <ChannelSidebar
          channels={channels}
          selectedChannelId={selectedChannelId}
          onSelect={setSelectedChannelId}
          isStaff={isStaff}
          onCreate={() => setCreateOpen(true)}
          mobileOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />
        <ChatWindow
          channel={selectedChannel}
          messages={messages}
          setMessages={setMessages}
          hasMore={hasMore}
          onLoadOlder={loadOlder}
          user={user}
          isStaff={isStaff}
          socket={socket}
          onDeleteChannel={deleteChannel}
          onToggleReadOnly={toggleReadOnly}
          onOpenSidebar={() => setSidebarOpen(true)}
        />
      </div>
      <CreateChannelModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(channel) => setChannels((prev) => [...prev, channel])}
      />
    </div>
  );
}
