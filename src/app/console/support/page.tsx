"use client";

import { useCallback, useEffect, useState } from "react";
import { format } from "date-fns";
import { ConsoleError } from "@/components/console/console-error";
import { ConsoleLoader } from "@/components/console/console-loader";
import { GoldButton } from "@/components/ui/gold-button";
import { SupportAttachmentGallery } from "@/components/support/support-attachment-gallery";
import { SupportMessageText } from "@/components/support/support-message-text";
import { useConsoleBadges } from "@/contexts/console-badges";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { SupportTicket } from "@/lib/support";

function todayIso(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
  }).format(new Date());
}

type StatusFilter = "all" | "open" | "resolved";

export default function ConsoleSupportPage() {
  const { user } = useAuth();
  const { refetchSupportBadge } = useConsoleBadges();
  const [date, setDate] = useState(todayIso);
  const [status, setStatus] = useState<StatusFilter>("all");
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [selected, setSelected] = useState<SupportTicket | null>(null);
  const [reply, setReply] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [cursors, setCursors] = useState<(string | null)[]>([null]);
  const [acting, setActing] = useState(false);

  const fetchTickets = useCallback(
    async (cursor: string | null, pageNum: number) => {
      if (!user) return;
      setLoading(true);
      setError(null);
      try {
        const token = await user.getIdToken();
        const params = new URLSearchParams({
          date,
          status,
          page: String(pageNum),
        });
        if (cursor) params.set("cursor", cursor);

        const res = await fetch(`/api/console/support?${params}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error ?? "Failed to load tickets");
          return;
        }
        setTickets(data.tickets ?? []);
        setHasMore(Boolean(data.hasMore));
        setNextCursor(data.nextCursor ?? null);
        void refetchSupportBadge();
      } finally {
        setLoading(false);
      }
    },
    [user, date, status, refetchSupportBadge]
  );

  const loadDetail = async (ticketId: string) => {
    if (!user) return;
    const token = await user.getIdToken();
    const res = await fetch(`/api/console/support/${ticketId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error ?? "Failed to load ticket");
      return;
    }
    setSelected(data.ticket);
  };

  useEffect(() => {
    setPage(1);
    setCursors([null]);
    void fetchTickets(null, 1);
  }, [fetchTickets, date, status]);

  const goNext = () => {
    if (!hasMore || !nextCursor) return;
    const newPage = page + 1;
    setCursors((c) => [...c, nextCursor]);
    setPage(newPage);
    void fetchTickets(nextCursor, newPage);
  };

  const goPrev = () => {
    if (page <= 1) return;
    const newPage = page - 1;
    const cursor = cursors[newPage - 1] ?? null;
    setPage(newPage);
    void fetchTickets(cursor, newPage);
  };

  const sendReply = async () => {
    if (!user || !selected || !reply.trim()) return;
    setActing(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/console/support", {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "reply",
          ticketId: selected.id,
          message: reply.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Reply failed");
      setSelected(data.ticket);
      setReply("");
      toast.success("Reply sent");
      void fetchTickets(cursors[page - 1] ?? null, page);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Reply failed");
    } finally {
      setActing(false);
    }
  };

  const resolveTicket = async () => {
    if (!user || !selected) return;
    setActing(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/console/support", {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "resolve",
          ticketId: selected.id,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to resolve");
      setSelected(data.ticket);
      toast.success("Ticket marked resolved");
      void fetchTickets(cursors[page - 1] ?? null, page);
      void refetchSupportBadge();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to resolve");
    } finally {
      setActing(false);
    }
  };

  if (error) return <ConsoleError message={error} />;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-white">Support Tickets</h1>
        <p className="text-sm text-zinc-500">
          Reply to user requests and mark them resolved
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="text-xs text-zinc-500">Date</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="mt-1 block rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-white"
          />
        </div>
        <div className="flex gap-1">
          {(["all", "open", "resolved"] as StatusFilter[]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatus(s)}
              className={cn(
                "rounded-full px-3 py-1 text-xs capitalize",
                status === s
                  ? "bg-amber-500/20 text-amber-400"
                  : "text-zinc-500 hover:text-white"
              )}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="surface-flat overflow-hidden">
          {loading ? (
            <ConsoleLoader variant="section" />
          ) : tickets.length === 0 ? (
            <p className="p-6 text-sm text-zinc-500">
              No tickets for this date
            </p>
          ) : (
            <ul className="divide-y divide-white/5">
              {tickets.map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => void loadDetail(t.id)}
                    className={cn(
                      "w-full px-4 py-3 text-left hover:bg-white/[0.02]",
                      selected?.id === t.id && "bg-amber-500/5"
                    )}
                  >
                    <div className="flex justify-between gap-2">
                      <p className="text-sm font-medium text-white">
                        {t.userEmail}
                      </p>
                      <span
                        className={cn(
                          "text-[10px] uppercase",
                          t.status === "open"
                            ? "text-emerald-400"
                            : "text-zinc-500"
                        )}
                      >
                        {t.status}
                      </span>
                    </div>
                    <p className="text-xs text-amber-400/80">
                      {t.categoryLabel}
                    </p>
                    <SupportMessageText className="mt-1 line-clamp-2 text-xs text-zinc-500">
                      {t.message}
                    </SupportMessageText>
                    <p className="mt-1 text-[10px] text-zinc-600">
                      {t.createdAt
                        ? format(
                            new Date(t.createdAt.seconds * 1000),
                            "h:mm a"
                          )
                        : ""}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex items-center justify-between border-t border-white/5 px-4 py-3">
            <button
              type="button"
              disabled={page <= 1 || loading}
              onClick={goPrev}
              className="text-xs text-zinc-400 disabled:opacity-40"
            >
              Previous
            </button>
            <span className="text-xs text-zinc-500">Page {page}</span>
            <button
              type="button"
              disabled={!hasMore || loading}
              onClick={goNext}
              className="text-xs text-zinc-400 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>

        <div className="surface-flat min-h-[320px] p-4">
          {!selected ? (
            <p className="text-sm text-zinc-500">Select a ticket to view</p>
          ) : (
            <div className="space-y-4">
              <div>
                <p className="font-medium text-white">
                  {selected.userDisplayName}
                </p>
                <p className="text-xs text-zinc-500">{selected.userEmail}</p>
                <p className="mt-2 text-sm text-amber-400">
                  {selected.categoryLabel}
                  {selected.subject ? ` — ${selected.subject}` : ""}
                </p>
                <SupportMessageText className="mt-2 text-sm text-zinc-300">
                  {selected.message}
                </SupportMessageText>
              </div>

              {selected.attachmentUrls.length > 0 && (
                <SupportAttachmentGallery urls={selected.attachmentUrls} />
              )}

              {selected.replies && selected.replies.length > 0 && (
                <div className="space-y-2 border-t border-white/5 pt-3">
                  <p className="text-xs font-medium text-zinc-500">Thread</p>
                  {selected.replies.map((r) => (
                    <div
                      key={r.id}
                      className="rounded-lg bg-black/40 px-3 py-2 text-sm"
                    >
                      <p className="text-xs text-amber-400">
                        {r.authorRole === "admin" ? "You (Support)" : "User"}
                      </p>
                      <SupportMessageText className="text-zinc-300">
                        {r.body}
                      </SupportMessageText>
                    </div>
                  ))}
                </div>
              )}

              {selected.status === "open" && (
                <>
                  <textarea
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    rows={3}
                    maxLength={2000}
                    placeholder="Type your reply…"
                    className="w-full rounded-lg border border-white/10 bg-black px-3 py-2 text-sm text-white"
                  />
                  <div className="flex gap-2">
                    <GoldButton
                      className="flex-1"
                      disabled={acting || !reply.trim()}
                      onClick={() => void sendReply()}
                    >
                      Send reply
                    </GoldButton>
                    <button
                      type="button"
                      disabled={acting}
                      onClick={() => void resolveTicket()}
                      className="rounded-lg border border-emerald-500/30 px-4 py-2 text-sm text-emerald-400"
                    >
                      Resolve
                    </button>
                  </div>
                </>
              )}

              {selected.status === "resolved" && (
                <p className="text-sm text-zinc-500">This ticket is resolved.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
