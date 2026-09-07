import React, { useEffect, useRef, useState, useCallback } from "react";
import api, { formatApiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import QueryTicketList from "@/components/queries/QueryTicketList";
import QueryChatThread from "@/components/queries/QueryChatThread";
import GrantCourseAccessDialog from "@/components/queries/GrantCourseAccessDialog";

const LIST_POLL_MS = 8000;
const MSG_POLL_MS = 4000;

const EMPTY_LABELS = {
  unassigned: "Nothing waiting — the pool is empty.",
  mine: "You haven't claimed any queries yet.",
  all: "No queries yet.",
  escalated: "Nothing escalated right now.",
};

/** Staff Panel — "Queries" tab. Unassigned pool + claimed queue, with an admin override view. */
export default function QueriesStaff() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "super_admin";
  const [queue, setQueue] = useState("unassigned");
  const [unassigned, setUnassigned] = useState([]);
  const [mine, setMine] = useState([]);
  const [all, setAll] = useState([]);
  const [escalated, setEscalated] = useState([]);
  const [staffUsers, setStaffUsers] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [selected, setSelected] = useState(null);
  const [messages, setMessages] = useState([]);
  const [search, setSearch] = useState("");
  const [sending, setSending] = useState(false);
  const [closing, setClosing] = useState(false);
  const [reassigning, setReassigning] = useState(false);
  const [escalating, setEscalating] = useState(false);
  const selectedIdRef = useRef(null);

  const loadLists = useCallback(async () => {
    const calls = [
      api.get("/queries/unassigned").catch(() => ({ data: [] })),
      api.get("/queries/assigned-to-me").catch(() => ({ data: [] })),
      isAdmin ? api.get("/queries/all").catch(() => ({ data: [] })) : Promise.resolve({ data: [] }),
      isAdmin ? api.get("/queries/escalated").catch(() => ({ data: [] })) : Promise.resolve({ data: [] }),
    ];
    const [u, m, a, esc] = await Promise.all(calls);
    const uData = Array.isArray(u.data) ? u.data : [];
    const mData = Array.isArray(m.data) ? m.data : [];
    const aData = Array.isArray(a.data) ? a.data : [];
    const escData = Array.isArray(esc.data) ? esc.data : [];
    setUnassigned(uData);
    setMine(mData);
    if (isAdmin) { setAll(aData); setEscalated(escData); }
    if (selectedIdRef.current) {
      const merged = [...uData, ...mData, ...(isAdmin ? aData : [])];
      const fresh = merged.find((t) => t.id === selectedIdRef.current);
      if (fresh) setSelected(fresh);
    }
    setLoadingList(false);
  }, [isAdmin]);

  useEffect(() => {
    loadLists();
    const id = setInterval(loadLists, LIST_POLL_MS);
    return () => clearInterval(id);
  }, [loadLists]);

  useEffect(() => {
    if (!isAdmin) return;
    api.get("/users").then(({ data }) => setStaffUsers((Array.isArray(data) ? data : []).filter((u) => u.role === "academic_staff"))).catch(() => {});
  }, [isAdmin]);

  const loadMessages = useCallback(async (ticketId) => {
    try {
      const { data } = await api.get(`/queries/${ticketId}/messages`);
      if (selectedIdRef.current === ticketId) setMessages(Array.isArray(data) ? data : []);
    } catch { /* keep last known thread on a transient poll failure */ }
  }, []);

  useEffect(() => {
    selectedIdRef.current = selected?.id || null;
    if (!selected) { setMessages([]); return; }
    loadMessages(selected.id);
    const id = setInterval(() => loadMessages(selected.id), MSG_POLL_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id, loadMessages]);

  const handleSend = async (text) => {
    if (!selected) return;
    setSending(true);
    try {
      await api.post(`/queries/${selected.id}/messages`, { message_text: text });
      await loadMessages(selected.id);
      await loadLists();
      // Claiming moves the ticket out of the unassigned pool — follow it into "My queue".
      if (queue === "unassigned") setQueue("mine");
    } catch (e) { toast.error(formatApiError(e)); }
    setSending(false);
  };

  const handleClose = async () => {
    if (!selected) return;
    setClosing(true);
    try {
      await api.post(`/queries/${selected.id}/close`);
      toast.success("Query closed.");
      await loadMessages(selected.id);
      await loadLists();
    } catch (e) { toast.error(formatApiError(e)); }
    setClosing(false);
  };

  const handleReassign = async (staffId) => {
    if (!selected) return;
    setReassigning(true);
    try {
      const { data } = await api.post(`/queries/${selected.id}/reassign`, { staff_id: staffId });
      toast.success(staffId ? "Reassigned." : "Returned to the unassigned pool.");
      setSelected(data);
      await loadLists();
    } catch (e) { toast.error(formatApiError(e)); }
    setReassigning(false);
  };

  const handleEscalate = async () => {
    if (!selected) return;
    setEscalating(true);
    try {
      const { data } = await api.post(`/queries/${selected.id}/escalate`);
      toast.success("Escalated to admin.");
      setSelected(data);
      await loadLists();
    } catch (e) { toast.error(formatApiError(e)); }
    setEscalating(false);
  };

  const handleResolveEscalation = async () => {
    if (!selected) return;
    setEscalating(true);
    try {
      await api.post(`/queries/${selected.id}/resolve-escalation`);
      toast.success("Escalation resolved.");
      setSelected((s) => (s ? { ...s, escalated: false } : s));
      await loadLists();
    } catch (e) { toast.error(formatApiError(e)); }
    setEscalating(false);
  };

  const canClose = !!selected && (isAdmin || selected.assigned_staff_id === user?.id);
  const lists = { unassigned, mine, all, escalated };

  return (
    <div data-testid="queries-staff">
      <Tabs value={queue} onValueChange={setQueue} className="mb-4">
        <TabsList>
          <TabsTrigger value="unassigned" data-testid="staff-queue-unassigned">Unassigned ({unassigned.length})</TabsTrigger>
          <TabsTrigger value="mine" data-testid="staff-queue-mine">My queue ({mine.length})</TabsTrigger>
          {isAdmin && <TabsTrigger value="all" data-testid="staff-queue-all">All (override) ({all.length})</TabsTrigger>}
          {isAdmin && (
            <TabsTrigger value="escalated" data-testid="staff-queue-escalated">
              Escalated ({escalated.length})
            </TabsTrigger>
          )}
        </TabsList>
      </Tabs>
      <div className="grid lg:grid-cols-[360px_1fr] gap-6">
        <QueryTicketList
          tickets={lists[queue]} selectedId={selected?.id} onSelect={setSelected}
          search={search} onSearchChange={setSearch} mode="staff" loading={loadingList}
          emptyLabel={EMPTY_LABELS[queue]} testidPrefix="staff-query"
        />
        <div className="space-y-3">
          {selected && (
            <div className="rounded-xl border border-border bg-card p-3 flex flex-wrap items-center gap-3" data-testid="query-action-bar">
              {isAdmin && (
                <>
                  <span className="text-xs text-muted-foreground shrink-0">Reassign to</span>
                  <Select value={selected.assigned_staff_id || "unassigned"}
                    onValueChange={(v) => handleReassign(v === "unassigned" ? "" : v)} disabled={reassigning}>
                    <SelectTrigger className="h-9 w-44" data-testid="query-reassign-select"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unassigned">Unassigned (back to pool)</SelectItem>
                      {staffUsers.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </>
              )}
              {selected.escalated ? (
                <Badge variant="destructive" className="text-[10px] uppercase tracking-widest" data-testid="query-escalated-badge">
                  <AlertTriangle className="w-3 h-3 mr-1" /> Escalated
                </Badge>
              ) : (
                !isAdmin && (
                  <Button size="sm" variant="outline" className="rounded-full" onClick={handleEscalate}
                    disabled={escalating} data-testid="query-escalate-btn">
                    <AlertTriangle className="w-3.5 h-3.5 mr-1.5" /> Escalate to admin
                  </Button>
                )
              )}
              {isAdmin && selected.escalated && (
                <Button size="sm" variant="outline" className="rounded-full" onClick={handleResolveEscalation}
                  disabled={escalating} data-testid="query-resolve-escalation-btn">
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> Resolve escalation
                </Button>
              )}
              <div className="ml-auto">
                <GrantCourseAccessDialog userId={selected.user_id} />
              </div>
            </div>
          )}
          <QueryChatThread
            ticket={selected} messages={messages} mode="staff"
            onSend={handleSend} onClose={handleClose} sending={sending} closing={closing}
            canClose={canClose}
          />
        </div>
      </div>
    </div>
  );
}
