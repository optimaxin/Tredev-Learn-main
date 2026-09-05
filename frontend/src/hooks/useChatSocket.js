import { useEffect, useRef, useState } from "react";

/** Owns a per-channel WebSocket connection for the Community chat. */
export default function useChatSocket(channelId, { onMessage, onMessageDeleted, onChannelUpdated, onChannelDeleted, onChannelsChanged, onError }) {
  const wsRef = useRef(null);
  const handlersRef = useRef({});
  const [connected, setConnected] = useState(false);
  handlersRef.current = { onMessage, onMessageDeleted, onChannelUpdated, onChannelDeleted, onChannelsChanged, onError };

  useEffect(() => {
    if (!channelId) return undefined;

    const backend = process.env.REACT_APP_BACKEND_URL || "";
    const wsBase = backend.replace(/^http/, "ws");
    const token = localStorage.getItem("tredev_token");
    const url = `${wsBase}/api/ws/chat/${channelId}${token ? `?token=${token}` : ""}`;

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);
    ws.onmessage = (event) => {
      const h = handlersRef.current;
      let frame;
      try { frame = JSON.parse(event.data); } catch { return; }
      if (frame.type === "message") h.onMessage?.(frame.message);
      else if (frame.type === "message_deleted") h.onMessageDeleted?.(frame.message_id);
      else if (frame.type === "channel_updated") h.onChannelUpdated?.(frame.channel);
      else if (frame.type === "channel_deleted") h.onChannelDeleted?.(frame.channel_id);
      else if (frame.type === "channels_changed") h.onChannelsChanged?.();
      else if (frame.type === "error") h.onError?.(frame.reason);
    };

    return () => {
      ws.close();
      wsRef.current = null;
      setConnected(false);
    };
  }, [channelId]);

  const send = (content, attachmentUrl = "") => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "message", content, attachment_url: attachmentUrl }));
    }
  };

  return { send, connected };
}
