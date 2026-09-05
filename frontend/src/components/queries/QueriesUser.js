import React, { useEffect, useRef, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import api, { formatApiError } from "@/lib/api";
import { toast } from "sonner";
import QueryTicketList from "@/components/queries/QueryTicketList";
import QueryChatThread from "@/components/queries/QueryChatThread";
import CreateQueryDialog from "@/components/queries/CreateQueryDialog";

const LIST_POLL_MS = 8000;
const MSG_POLL_MS = 4000;

/** User Portal — "Queries" tab. Dual-panel master-detail, GUVI/Zen Class style. */
export default function QueriesUser() {
  const { t } = useTranslation();
  const [tickets, setTickets] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [selected, setSelected] = useState(null);
  const [messages, setMessages] = useState([]);
  const [search, setSearch] = useState("");
  const [sending, setSending] = useState(false);
  const [closing, setClosing] = useState(false);
  const selectedIdRef = useRef(null);

  const loadTickets = useCallback(async () => {
    try {
      const { data } = await api.get("/queries/mine");
      setTickets(data);
      if (selectedIdRef.current) {
        const fresh = data.find((tk) => tk.id === selectedIdRef.current);
        if (fresh) setSelected(fresh);
      }
    } catch { /* keep last known list on a transient poll failure */ }
    setLoadingList(false);
  }, []);

  const loadMessages = useCallback(async (ticketId) => {
    try {
      const { data } = await api.get(`/queries/${ticketId}/messages`);
      if (selectedIdRef.current === ticketId) setMessages(data);
    } catch { /* keep last known thread on a transient poll failure */ }
  }, []);

  useEffect(() => {
    loadTickets();
    const id = setInterval(loadTickets, LIST_POLL_MS);
    return () => clearInterval(id);
  }, [loadTickets]);

  useEffect(() => {
    selectedIdRef.current = selected?.id || null;
    if (!selected) { setMessages([]); return; }
    loadMessages(selected.id);
    const id = setInterval(() => loadMessages(selected.id), MSG_POLL_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id, loadMessages]);

  const handleCreated = (ticket) => {
    setTickets((prev) => [ticket, ...prev]);
    setSelected(ticket);
  };

  const handleSend = async (text) => {
    if (!selected) return;
    setSending(true);
    try {
      await api.post(`/queries/${selected.id}/messages`, { message_text: text });
      await loadMessages(selected.id);
      await loadTickets();
    } catch (e) { toast.error(formatApiError(e)); }
    setSending(false);
  };

  const handleClose = async () => {
    if (!selected) return;
    setClosing(true);
    try {
      await api.post(`/queries/${selected.id}/close`);
      toast.success(t("queriesUser.closed"));
      await loadMessages(selected.id);
      await loadTickets();
    } catch (e) { toast.error(formatApiError(e)); }
    setClosing(false);
  };

  return (
    <div className="grid lg:grid-cols-[360px_1fr] gap-6" data-testid="queries-user">
      <QueryTicketList
        tickets={tickets} selectedId={selected?.id} onSelect={setSelected}
        search={search} onSearchChange={setSearch} mode="user" loading={loadingList}
        createAction={<CreateQueryDialog onCreated={handleCreated} />}
        emptyLabel={t("queriesUser.empty")} testidPrefix="user-query"
      />
      <QueryChatThread
        ticket={selected} messages={messages} mode="user"
        onSend={handleSend} onClose={handleClose} sending={sending} closing={closing}
        canClose={!!selected}
      />
    </div>
  );
}
