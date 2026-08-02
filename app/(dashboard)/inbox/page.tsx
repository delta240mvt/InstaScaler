"use client";

/**
 * Inbox
 *
 * Instagram DM conversations for the selected account, with live message
 * history and a reply composer. Messages are read from the Conversations API
 * (Meta only exposes the 20 most recent per thread) and refreshed by polling.
 * Sending is subject to Instagram's 24-hour messaging window — Meta's error is
 * surfaced verbatim when it applies.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import AccountSelect, { type AccountOption } from "@/components/account-select";
import { readCache, writeCache } from "@/lib/client-cache";
type ConversationListItem = { id: string; contact: { id: string; username?: string }; updatedTime: string | null; lastMessage: { text: string; fromMe: boolean } | null };
type ThreadMessage = { id: string; text: string; fromMe: boolean; createdTime: string | null; fromUsername?: string };

const POLL_MS = 12_000;
// Cached list/threads are shown instantly on revisit, then revalidated in the
// background. The Instagram Conversations API is slow (often several seconds),
// so this is what makes the inbox feel fast after the first load.
const CACHE_MAX_AGE_MS = 60_000;
const convCacheKey = (accountId: string) => `inbox:convs:${accountId}`;
const msgCacheKey = (conversationId: string) => `inbox:msgs:${conversationId}`;

function formatTime(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  return sameDay
    ? d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
    : d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function InboxPage() {
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  // Seed from the last-used account so a revisit can paint the cached
  // conversation list immediately, before the account list even loads.
  const [selectedAccountId, setSelectedAccountId] = useState(() => {
    if (typeof window === "undefined") return "";
    return window.sessionStorage.getItem("inbox:selectedAccount") ?? "";
  });

  const [conversations, setConversations] = useState<ConversationListItem[]>([]);
  const [convLoading, setConvLoading] = useState(true);
  const [convError, setConvError] = useState<string | null>(null);

  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ThreadMessage[]>([]);
  const [threadLoading, setThreadLoading] = useState(false);

  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);

  const active = conversations.find((c) => c.id === activeId) ?? null;

  // Accounts for the selector; default to the first connected account. Uses the
  // lightweight accounts endpoint (one query) rather than the heavy dashboard
  // stats aggregation, so the inbox isn't gated on analytics before it can load.
  useEffect(() => {
    fetch("/api/instagram/accounts")
      .then((r) => r.json())
      .then((payload) => {
        if (!payload.success) return;
        const next: AccountOption[] = payload.data.instagramAccounts ?? [];
        setAccounts(next);
        setSelectedAccountId((prev) => {
          // Keep the seeded account only if it's still connected; otherwise
          // fall back to the default so a removed account can't wedge the inbox.
          const stillValid = prev && next.some((a) => a.id === prev);
          return stillValid
            ? prev
            : payload.data.selectedInstagramAccountId || next[0]?.id || "";
        });
      })
      .catch(() => setAccounts([]));
  }, []);

  // Remember the chosen account for the next visit.
  useEffect(() => {
    if (typeof window === "undefined" || !selectedAccountId) return;
    window.sessionStorage.setItem("inbox:selectedAccount", selectedAccountId);
  }, [selectedAccountId]);

  const loadConversations = useCallback(
    async (silent: boolean) => {
      if (!selectedAccountId) return;
      if (!silent) setConvLoading(true);
      try {
        const res = await fetch(
          `/api/instagram/conversations?instagramAccountId=${selectedAccountId}`,
          { cache: "no-store" }
        );
        const data = await res.json();
        if (data.success) {
          setConversations(data.data.conversations);
          writeCache(convCacheKey(selectedAccountId), data.data.conversations);
          setConvError(null);
        } else if (!silent) {
          setConvError(data.error ?? "Failed to load conversations");
        }
      } catch {
        if (!silent) setConvError("Failed to load conversations");
      } finally {
        if (!silent) setConvLoading(false);
      }
    },
    [selectedAccountId]
  );

  // Load + poll conversations for the selected account. A cached list is shown
  // immediately (so revisits are instant) while a fresh copy loads silently.
  useEffect(() => {
    if (!selectedAccountId) return;
    // Reset the open thread when switching accounts. This is an intentional
    // synchronous reset on a dependency change, not derived render state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setActiveId(null);
    setMessages([]);
    const cached = readCache<ConversationListItem[]>(
      convCacheKey(selectedAccountId),
      CACHE_MAX_AGE_MS
    );
    if (cached.data) {
      setConversations(cached.data);
      setConvLoading(false);
    } else {
      setConversations([]);
      setConvLoading(true);
    }
    void loadConversations(Boolean(cached.data));
    const timer = window.setInterval(() => void loadConversations(true), POLL_MS);
    return () => window.clearInterval(timer);
  }, [selectedAccountId, loadConversations]);

  const loadMessages = useCallback(
    async (conversationId: string, silent: boolean) => {
      if (!selectedAccountId) return;
      if (!silent) setThreadLoading(true);
      try {
        const res = await fetch(
          `/api/instagram/conversations/${conversationId}?instagramAccountId=${selectedAccountId}`,
          { cache: "no-store" }
        );
        const data = await res.json();
        if (data.success) {
          setMessages(data.data.messages);
          writeCache(msgCacheKey(conversationId), data.data.messages);
        }
      } catch {
        // keep whatever is shown
      } finally {
        if (!silent) setThreadLoading(false);
      }
    },
    [selectedAccountId]
  );

  // Load + poll the open thread. Cached messages render instantly while a fresh
  // copy loads silently; opening a thread never shows a blank pane on revisit.
  useEffect(() => {
    if (!activeId) return;
    const cached = readCache<ThreadMessage[]>(
      msgCacheKey(activeId),
      CACHE_MAX_AGE_MS
    );
    if (cached.data) {
      // Paint cached messages instantly on thread change; intentional reset.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMessages(cached.data);
      setThreadLoading(false);
    } else {
      setMessages([]);
      setThreadLoading(true);
    }
    void loadMessages(activeId, Boolean(cached.data));
    const timer = window.setInterval(
      () => void loadMessages(activeId, true),
      POLL_MS
    );
    return () => window.clearInterval(timer);
  }, [activeId, loadMessages]);

  // Keep the thread pinned to the latest message.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  function openConversation(id: string) {
    setActiveId(id);
    setSendError(null);
    // Paint any cached thread synchronously so the pane never flashes empty
    // or shows the previously open conversation while the fetch runs.
    const cached = readCache<ThreadMessage[]>(msgCacheKey(id), CACHE_MAX_AGE_MS);
    setMessages(cached.data ?? []);
    setThreadLoading(!cached.data);
  }

  async function handleSend() {
    const text = draft.trim();
    if (!text || !active?.contact.id || sending) return;
    setSending(true);
    setSendError(null);

    // Optimistically show the reply immediately, then confirm with the server.
    const optimistic: ThreadMessage = {
      id: `optimistic-${Date.now()}`,
      text,
      fromMe: true,
      fromUsername: undefined,
      createdTime: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    setDraft("");

    try {
      const res = await fetch("/api/instagram/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instagramAccountId: selectedAccountId,
          recipientId: active.contact.id,
          text,
        }),
      });
      const data = await res.json();
      if (data.success) {
        await loadMessages(active.id, true);
        void loadConversations(true);
      } else {
        // Roll the optimistic message back and restore the draft so it's not lost.
        setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
        setDraft(text);
        setSendError(data.error ?? "Failed to send message");
      }
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      setDraft(text);
      setSendError("Failed to send message");
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  }

  return (
    <div className="space-y-4">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="app-kicker">Conversations</p><h1 className="app-page-title mt-2">Inbox</h1><p className="app-page-description mt-2">Reply to your latest Instagram conversations.</p></div>
        {accounts.length > 1 && (
          <AccountSelect
            accounts={accounts}
            value={selectedAccountId}
            onChange={setSelectedAccountId}
            includeAll={false}
          />
        )}
      </header>

      <div className="app-card grid h-[calc(100dvh-13rem)] min-h-[28rem] grid-cols-1 overflow-hidden sm:grid-cols-[300px_1fr]">
        {/* Conversation list. On mobile it takes the full pane and is hidden
            once a thread is open (ManyChat-style); on sm+ it is always shown. */}
        <div
          className={`min-h-0 flex-col border-b border-border sm:flex sm:border-b-0 sm:border-r ${
            active ? "hidden" : "flex"
          }`}
        >
          <div className="shrink-0 border-b border-border px-4 py-3 text-sm font-semibold text-foreground">
            Conversations
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {convLoading ? (
              <p className="px-4 py-6 text-sm text-muted">Loading…</p>
            ) : convError ? (
              <p className="px-4 py-6 text-sm text-error">{convError}</p>
            ) : conversations.length === 0 ? (
              <p className="px-4 py-6 text-sm text-muted">No conversations yet.</p>
            ) : (
              conversations.map((c) => {
                const isActive = c.id === activeId;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => openConversation(c.id)}
                    className={`block w-full border-b border-border px-4 py-3 text-left ${
                      isActive ? "bg-surface-hover" : "hover:bg-surface-hover"
                    }`}
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-sm font-medium text-foreground">
                        @{c.contact.username ?? "unknown"}
                      </span>
                      <span className="shrink-0 text-[11px] text-zinc-500">
                        {formatTime(c.updatedTime)}
                      </span>
                    </div>
                    {c.lastMessage && (
                      <p className="mt-0.5 truncate text-xs text-muted">
                        {c.lastMessage.fromMe ? "You: " : ""}
                        {c.lastMessage.text || "(no text)"}
                      </p>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Thread. On mobile it is only shown once a conversation is open and
            fills the pane; on sm+ it always sits beside the list. */}
        <div
          aria-label="Conversation thread"
          className={`min-h-0 flex-col ${active ? "flex" : "hidden sm:flex"}`}
        >
          {!active ? (
            <div className="flex flex-1 items-center justify-center p-6 text-sm text-muted">
              Select a conversation to read and reply.
            </div>
          ) : (
            <>
              <div className="sticky top-0 z-10 flex shrink-0 items-center gap-2 border-b border-border bg-surface/95 px-3 py-2.5 text-sm font-semibold text-foreground backdrop-blur">
                <button
                  type="button"
                  onClick={() => setActiveId(null)}
                  className="app-button app-button-secondary -ml-1 min-h-11 px-3 text-xs sm:hidden"
                  aria-label="Back to conversations"
                >
                  Back
                </button>
                <span className="truncate">
                  @{active.contact.username ?? "unknown"}
                </span>
              </div>

              <div ref={scrollRef} className="min-h-0 flex-1 space-y-2 overflow-y-auto p-4">
                {threadLoading && messages.length === 0 ? (
                  <p className="text-sm text-muted">Loading…</p>
                ) : messages.length === 0 ? (
                  <p className="text-sm text-muted">No messages.</p>
                ) : (
                  messages.map((m) => (
                    <div
                      key={m.id}
                      className={`flex ${m.fromMe ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm sm:max-w-[75%] ${
                          m.fromMe
                            ? "bg-accent text-white"
                            : "bg-surface text-foreground border border-border"
                        }`}
                      >
                        <p className="whitespace-pre-wrap break-words">{m.text}</p>
                        <p
                          className={`mt-1 text-[10px] ${
                            m.fromMe ? "text-white/70" : "text-zinc-500"
                          }`}
                        >
                          {formatTime(m.createdTime)}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="sticky bottom-0 shrink-0 border-t border-border bg-surface/95 p-3 pb-[max(.75rem,env(safe-area-inset-bottom))] backdrop-blur">
                {sendError && (
                  <p className="mb-2 text-xs text-error">{sendError}</p>
                )}
                <div className="flex items-end gap-2">
                  <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={handleKeyDown}
                    rows={1}
                    placeholder="Write a reply…  (Enter to send, Shift+Enter for a new line)"
                    className="app-field max-h-32 min-h-11 min-w-0 flex-1 resize-none"
                    aria-label="Reply message"
                  />
                  <button
                    type="button"
                    onClick={() => void handleSend()}
                    disabled={sending || !draft.trim()}
                    className="app-button app-button-primary shrink-0 disabled:opacity-50"
                  >
                    {sending ? "Sending…" : "Send"}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
