"use client";

import { useCallback, useEffect, useState } from "react";
import { format } from "date-fns";
import { Headphones, ChevronDown, ImagePlus, Loader2, X } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { GoldButton } from "@/components/ui/gold-button";
import { SupportAttachmentGallery } from "@/components/support/support-attachment-gallery";
import { SupportMessageText } from "@/components/support/support-message-text";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import {
  SUPPORT_CATEGORIES,
  SUPPORT_MAX_ATTACHMENTS,
  SUPPORT_MAX_ATTACHMENT_BYTES,
  SUPPORT_ALLOWED_IMAGE_TYPES,
  type SupportTicket,
} from "@/lib/support";
import { cn } from "@/lib/utils";

function getTicketSubject(ticket: SupportTicket): string {
  return ticket.subject?.trim() || ticket.categoryLabel;
}

function canUserReply(ticket: SupportTicket): boolean {
  return (
    ticket.status === "open" &&
    (ticket.replies?.some((r) => r.authorRole === "admin") ?? false)
  );
}

interface SupportSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SupportSheet({ open, onOpenChange }: SupportSheetProps) {
  const { user } = useAuth();
  const [openTickets, setOpenTickets] = useState<SupportTicket[]>([]);
  const [resolvedTickets, setResolvedTickets] = useState<SupportTicket[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [category, setCategory] = useState<string>("deposit");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [uploadedPaths, setUploadedPaths] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [view, setView] = useState<"list" | "new">("list");
  const [listFilter, setListFilter] = useState<"open" | "resolved">("open");
  const [expandedTicketId, setExpandedTicketId] = useState<string | null>(null);
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [replyingTicketId, setReplyingTicketId] = useState<string | null>(null);

  const loadTickets = useCallback(async () => {
    if (!user) return;
    setLoadingTickets(true);
    try {
      const token = await user.getIdToken();
      const headers = { Authorization: `Bearer ${token}` };
      const [openRes, resolvedRes] = await Promise.all([
        fetch("/api/support/tickets?status=open", { headers }),
        fetch("/api/support/tickets?status=resolved", { headers }),
      ]);
      const [openData, resolvedData] = await Promise.all([
        openRes.json(),
        resolvedRes.json(),
      ]);
      if (!openRes.ok) {
        throw new Error(openData.error ?? "Failed to load open tickets");
      }
      if (!resolvedRes.ok) {
        throw new Error(resolvedData.error ?? "Failed to load resolved tickets");
      }
      setOpenTickets(openData.tickets ?? []);
      setResolvedTickets(resolvedData.tickets ?? []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load tickets");
    } finally {
      setLoadingTickets(false);
    }
  }, [user]);

  useEffect(() => {
    if (open && user) void loadTickets();
    if (!open) {
      setExpandedTicketId(null);
      setListFilter("open");
      setReplyDrafts({});
      setReplyingTicketId(null);
    }
  }, [open, user, loadTickets]);

  const showList = (filter: "open" | "resolved") => {
    setView("list");
    setListFilter(filter);
    setExpandedTicketId(null);
  };

  const visibleTickets =
    listFilter === "open" ? openTickets : resolvedTickets;

  const resetForm = () => {
    setCategory("deposit");
    setSubject("");
    setMessage("");
    setPendingFiles([]);
    setUploadedPaths([]);
  };

  const handleFilePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    const total = pendingFiles.length + files.length;
    if (total > SUPPORT_MAX_ATTACHMENTS) {
      toast.error(`Maximum ${SUPPORT_MAX_ATTACHMENTS} screenshots`);
      return;
    }
    for (const f of files) {
      if (!SUPPORT_ALLOWED_IMAGE_TYPES.includes(f.type as never)) {
        toast.error("Only JPEG, PNG, or WebP images allowed");
        return;
      }
      if (f.size > SUPPORT_MAX_ATTACHMENT_BYTES) {
        toast.error("Each image must be 4 MB or less");
        return;
      }
    }
    setPendingFiles((prev) => [...prev, ...files].slice(0, SUPPORT_MAX_ATTACHMENTS));
  };

  const uploadFiles = async (): Promise<string[]> => {
    if (!user || pendingFiles.length === 0) return uploadedPaths;
    setUploading(true);
    const paths = [...uploadedPaths];
    try {
      const token = await user.getIdToken();
      for (const file of pendingFiles) {
        const form = new FormData();
        form.append("file", file);
        const res = await fetch("/api/support/upload", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: form,
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Upload failed");
        paths.push(data.path);
      }
      setUploadedPaths(paths);
      setPendingFiles([]);
      return paths;
    } finally {
      setUploading(false);
    }
  };

  const handleUserReply = async (ticketId: string) => {
    if (!user) return;
    const draft = replyDrafts[ticketId]?.trim() ?? "";
    if (!draft) {
      toast.error("Enter a message");
      return;
    }

    setReplyingTicketId(ticketId);
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/support/tickets/reply", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ticketId, message: draft }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to send reply");

      toast.success("Reply sent");
      setReplyDrafts((prev) => {
        const next = { ...prev };
        delete next[ticketId];
        return next;
      });
      setExpandedTicketId(ticketId);
      await loadTickets();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to send reply");
    } finally {
      setReplyingTicketId(null);
    }
  };

  const handleSubmit = async () => {
    if (!user) return;
    if (message.trim().length < 10) {
      toast.error("Please describe your issue (at least 10 characters)");
      return;
    }
    if (category === "other" && !subject.trim()) {
      toast.error("Please enter a subject");
      return;
    }

    setSubmitting(true);
    try {
      const paths = await uploadFiles();
      const token = await user.getIdToken();
      const res = await fetch("/api/support/tickets", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          category,
          subject: category === "other" ? subject.trim() : undefined,
          message: message.trim(),
          attachmentPaths: paths,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to submit ticket");

      toast.success("Support request submitted");
      resetForm();
      setView("list");
      setListFilter("open");
      await loadTickets();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Submission failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="flex max-h-[90dvh] min-h-[60dvh] flex-col overflow-hidden rounded-t-2xl border-amber-500/20 bg-zinc-950 text-white"
      >
        <SheetHeader className="shrink-0">
          <SheetTitle className="flex items-center gap-2 text-white">
            <Headphones className="h-5 w-5 text-amber-400" />
            Support
          </SheetTitle>
        </SheetHeader>

        <div className="mt-4 flex shrink-0 flex-wrap gap-2 px-4">
          <button
            type="button"
            onClick={() => showList("open")}
            className={cn(
              "rounded-full px-3 py-1 text-xs",
              view === "list" && listFilter === "open"
                ? "bg-amber-500/20 text-amber-400"
                : "text-zinc-500"
            )}
          >
            Open ({openTickets.length})
          </button>
          <button
            type="button"
            onClick={() => showList("resolved")}
            className={cn(
              "rounded-full px-3 py-1 text-xs",
              view === "list" && listFilter === "resolved"
                ? "bg-amber-500/20 text-amber-400"
                : "text-zinc-500"
            )}
          >
            Resolved ({resolvedTickets.length})
          </button>
          <button
            type="button"
            onClick={() => setView("new")}
            className={cn(
              "rounded-full px-3 py-1 text-xs",
              view === "new"
                ? "bg-amber-500/20 text-amber-400"
                : "text-zinc-500"
            )}
          >
            New request
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6">
        {view === "list" ? (
          <div className="mt-4 space-y-3">
            {loadingTickets ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-amber-400" />
              </div>
            ) : visibleTickets.length === 0 ? (
              <p className="py-6 text-center text-sm text-zinc-500">
                {listFilter === "open"
                  ? "No open tickets. Submit a new request if you need help."
                  : "No resolved tickets yet."}
              </p>
            ) : (
              visibleTickets.map((t) => {
                const isExpanded = expandedTicketId === t.id;

                return (
                  <div
                    key={t.id}
                    className="overflow-hidden rounded-xl border border-white/5 bg-black/40"
                  >
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedTicketId(isExpanded ? null : t.id)
                      }
                      className="flex w-full items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-white/[0.03]"
                      aria-expanded={isExpanded}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-white">
                          {getTicketSubject(t)}
                        </p>
                      </div>
                      <span
                        className={cn(
                          "shrink-0 rounded-full px-2 py-0.5 text-[10px]",
                          t.status === "resolved"
                            ? "bg-zinc-500/15 text-zinc-400"
                            : "bg-emerald-500/15 text-emerald-400"
                        )}
                      >
                        {t.status === "resolved" ? "Resolved" : "Open"}
                      </span>
                      <ChevronDown
                        className={cn(
                          "h-4 w-4 shrink-0 text-zinc-500 transition-transform",
                          isExpanded && "rotate-180"
                        )}
                      />
                    </button>

                    {isExpanded && (
                      <div className="border-t border-white/5 px-3 pb-3 pt-2">
                        <p className="text-xs text-amber-400/80">
                          {t.categoryLabel}
                          {t.subject ? ` · ${t.subject}` : ""}
                        </p>
                        <p className="mt-1 text-xs text-zinc-500">
                          Opened{" "}
                          {t.createdAt
                            ? format(
                                new Date(t.createdAt.seconds * 1000),
                                "MMM d, yyyy h:mm a"
                              )
                            : "—"}
                        </p>
                        {t.status === "resolved" && t.resolvedAt && (
                          <p className="mt-0.5 text-xs text-zinc-500">
                            Resolved{" "}
                            {format(
                              new Date(t.resolvedAt.seconds * 1000),
                              "MMM d, yyyy h:mm a"
                            )}
                          </p>
                        )}
                        <SupportMessageText className="mt-2 text-sm text-zinc-400">
                          {t.message}
                        </SupportMessageText>
                        {t.replies && t.replies.length > 0 && (
                          <div className="mt-3 space-y-2 border-t border-white/5 pt-3">
                            {t.replies.map((r) => (
                              <div key={r.id} className="text-xs">
                                <span className="font-medium text-amber-400/90">
                                  {r.authorRole === "admin" ? "Support" : "You"}
                                </span>
                                <SupportMessageText className="mt-0.5 text-zinc-400">
                                  {r.body}
                                </SupportMessageText>
                              </div>
                            ))}
                          </div>
                        )}
                        {t.attachmentUrls.length > 0 && (
                          <div className="mt-3">
                            <SupportAttachmentGallery
                              urls={t.attachmentUrls}
                              thumbnailClassName="h-14 w-14"
                            />
                          </div>
                        )}
                        {t.status === "open" && !canUserReply(t) && (
                          <p className="mt-3 text-xs text-zinc-500">
                            Support will reply here. You can respond once they
                            message you.
                          </p>
                        )}
                        {canUserReply(t) && (
                          <div className="mt-3 space-y-2 border-t border-white/5 pt-3">
                            <textarea
                              value={replyDrafts[t.id] ?? ""}
                              onChange={(e) =>
                                setReplyDrafts((prev) => ({
                                  ...prev,
                                  [t.id]: e.target.value,
                                }))
                              }
                              rows={2}
                              maxLength={2000}
                              placeholder="Type your reply…"
                              className="w-full rounded-lg border border-white/10 bg-black px-3 py-2 text-sm text-white placeholder:text-zinc-600"
                            />
                            <GoldButton
                              type="button"
                              className="w-full"
                              disabled={
                                replyingTicketId === t.id ||
                                !(replyDrafts[t.id]?.trim())
                              }
                              onClick={() => void handleUserReply(t.id)}
                            >
                              {replyingTicketId === t.id ? (
                                <>
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  Sending…
                                </>
                              ) : (
                                "Send reply"
                              )}
                            </GoldButton>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
            <GoldButton
              type="button"
              className="w-full"
              onClick={() => setView("new")}
            >
              New support request
            </GoldButton>
          </div>
        ) : (
          <div className="mt-4 space-y-4 pb-4">
            <div>
              <Label className="text-zinc-400">Concern</Label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="mt-1 w-full rounded-lg border border-amber-500/20 bg-black px-3 py-2 text-sm text-white"
              >
                {SUPPORT_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            {category === "other" && (
              <div>
                <Label className="text-zinc-400">Subject</Label>
                <Input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  maxLength={120}
                  className="mt-1 border-amber-500/20 bg-black text-white"
                  placeholder="Brief subject"
                />
              </div>
            )}

            <div>
              <Label className="text-zinc-400">Message</Label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                maxLength={2000}
                rows={4}
                className="mt-1 w-full rounded-lg border border-amber-500/20 bg-black px-3 py-2 text-sm text-white placeholder:text-zinc-600"
                placeholder="Describe your issue in detail…"
              />
            </div>

            <div>
              <Label className="text-zinc-400">
                Screenshots (optional, max {SUPPORT_MAX_ATTACHMENTS})
              </Label>
              <label className="mt-2 flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm text-amber-400">
                <ImagePlus className="h-4 w-4" />
                Add screenshot
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  className="hidden"
                  onChange={handleFilePick}
                  disabled={
                    pendingFiles.length + uploadedPaths.length >=
                    SUPPORT_MAX_ATTACHMENTS
                  }
                />
              </label>
              {(pendingFiles.length > 0 || uploadedPaths.length > 0) && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {pendingFiles.map((f, i) => (
                    <div
                      key={`${f.name}-${i}`}
                      className="flex items-center gap-1 rounded-lg bg-black/60 px-2 py-1 text-xs text-zinc-400"
                    >
                      {f.name.slice(0, 20)}
                      <button
                        type="button"
                        onClick={() =>
                          setPendingFiles((p) => p.filter((_, j) => j !== i))
                        }
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                  {uploadedPaths.map((p) => (
                    <span
                      key={p}
                      className="rounded-lg bg-emerald-500/10 px-2 py-1 text-xs text-emerald-400"
                    >
                      Uploaded
                    </span>
                  ))}
                </div>
              )}
            </div>

            <GoldButton
              className="w-full"
              onClick={() => void handleSubmit()}
              disabled={submitting || uploading}
            >
              {submitting || uploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting…
                </>
              ) : (
                "Submit ticket"
              )}
            </GoldButton>
          </div>
        )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
