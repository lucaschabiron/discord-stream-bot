"use client";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";

const BACKEND_BASE_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000";

type ThreadSummary = {
  id: string;
  name: string;
  lastMessageAt: string | null;
  parentId?: string | null;
  parentName?: string | null;
  ownerName?: string | null;
  ownerId?: string | null;
  lastMessageFromAgent: boolean;
  pendingCustomerMessages: number;
  lastAgentMessageAt?: string | null;
};

type ThreadMessage = {
  id: number;
  author: string;
  authorId?: string | null;
  avatarUrl?: string | null;
  content: string;
  createdAt: string;
  threadId: string;
  threadName?: string | null;
  threadParentId?: string | null;
  threadParentName?: string | null;
  isSupportAgent: boolean;
};

export default function Page() {
  const [threads, setThreads] = useState<ThreadSummary[]>([]);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ThreadMessage[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [messagesError, setMessagesError] = useState<string | null>(null);
  const [isNavOpen, setIsNavOpen] = useState(false);

  const sortThreads = useCallback((list: ThreadSummary[]) => {
    return [...list].sort((a, b) => {
      if (a.lastMessageFromAgent !== b.lastMessageFromAgent) {
        return a.lastMessageFromAgent ? 1 : -1;
      }
      const aTime = a.lastMessageAt ? Date.parse(a.lastMessageAt) : 0;
      const bTime = b.lastMessageAt ? Date.parse(b.lastMessageAt) : 0;
      return bTime - aTime;
    });
  }, []);

  useEffect(() => {
    let ignore = false;

    const fetchThreads = async () => {
      try {
        const res = await fetch(`${BACKEND_BASE_URL}/threads`);
        if (!res.ok) {
          throw new Error(`Failed to load threads (status ${res.status})`);
        }
        const data = (await res.json()) as ThreadSummary[];
        if (ignore) return;
        const sorted = sortThreads(data);
        setThreads(sorted);
        setSelectedThreadId((prev) => {
          if (prev && sorted.some((thread) => thread.id === prev)) {
            return prev;
          }
          return sorted[0]?.id ?? null;
        });
      } catch (error) {
        if (ignore) return;
        console.error("Failed to load threads", error);
      }
    };

    fetchThreads();
    const interval = setInterval(fetchThreads, 15000);

    return () => {
      ignore = true;
      clearInterval(interval);
    };
  }, [sortThreads]);

  useEffect(() => {
    if (!selectedThreadId) {
      setMessages([]);
      setMessagesError(null);
      setIsLoadingMessages(false);
      return;
    }

    let ignore = false;
    let firstLoad = true;

    const fetchMessages = async () => {
      try {
        if (!ignore && firstLoad) {
          setIsLoadingMessages(true);
        }
        const res = await fetch(
          `${BACKEND_BASE_URL}/threads/${encodeURIComponent(
            selectedThreadId
          )}/messages?limit=50`
        );
        if (!res.ok) {
          throw new Error(`Failed to load messages (status ${res.status})`);
        }
        const data = (await res.json()) as ThreadMessage[];
        if (ignore) return;
        setMessages(data);
        setMessagesError(null);
      } catch (error) {
        if (ignore) return;
        console.error("Failed to load messages", error);
        setMessagesError("Unable to load messages");
      } finally {
        if (!ignore) {
          setIsLoadingMessages(false);
        }
        firstLoad = false;
      }
    };

    fetchMessages();
    const interval = setInterval(fetchMessages, 5000);

    return () => {
      ignore = true;
      clearInterval(interval);
    };
  }, [selectedThreadId]);

  const selectedThread = useMemo(
    () => threads.find((t) => t.id === selectedThreadId) ?? null,
    [threads, selectedThreadId]
  );

  const handleThreadSelect = useCallback((threadId: string) => {
    setSelectedThreadId(threadId);
    setIsNavOpen(false);
  }, []);

  return (
    <div className="flex h-screen bg-background text-foreground">
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 border-r border-border bg-surface/60 backdrop-blur supports-[backdrop-filter]:bg-surface/40 flex flex-col transform transition-transform duration-200 md:relative md:translate-x-0 md:flex ${
          isNavOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
      >
        <div className="p-6 border-b border-border">
          <h2 className="text-xl font-semibold text-white">Posts</h2>
          <p className="text-sm text-text-secondary mt-1">
            Browse the threads from your forum channel.
          </p>
        </div>
        <nav className="flex-1 overflow-y-auto">
          {threads.length === 0 ? (
            <p className="px-4 py-6 text-sm text-text-secondary">
              Waiting for thread activity...
            </p>
          ) : (
            threads.map((thread) => {
              const isActive = thread.id === selectedThreadId;
              const isPending = !thread.lastMessageFromAgent;
              const pendingCount = thread.pendingCustomerMessages;
              const displayName = thread.ownerName?.trim() || thread.name;
              const showThreadTitle =
                thread.name && thread.name !== displayName;
              const badgeContent =
                pendingCount > 99 ? "99+" : String(pendingCount);
              return (
                <button
                  type="button"
                  key={thread.id}
                  onClick={() => handleThreadSelect(thread.id)}
                  className={`w-full text-left px-4 py-3 transition ${
                    isActive
                      ? "bg-surface border-l-2 border-accent text-white"
                      : isPending
                      ? "bg-surface/40 border-l-2 border-amber-400/80 text-white"
                      : "hover:bg-surface/50 text-text-secondary"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3 text-sm font-medium">
                    <span className="truncate">{displayName}</span>
                    <div className="flex items-center gap-2">
                      {pendingCount > 0 && (
                        <span className="inline-flex min-w-[1.5rem] justify-center rounded-full bg-amber-500/90 px-2 py-0.5 text-xs font-semibold text-black">
                          {badgeContent}
                        </span>
                      )}
                    </div>
                  </div>
                  {showThreadTitle && (
                    <p className="text-xs text-text-secondary/90 mt-1 truncate">
                      {thread.name}
                    </p>
                  )}
                  {thread.lastMessageAt && (
                    <p className="text-xs text-text-secondary mt-1">
                      Last message{" "}
                      {new Date(thread.lastMessageAt).toLocaleTimeString()}
                    </p>
                  )}
                </button>
              );
            })
          )}
        </nav>
      </aside>
      {isNavOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          onClick={() => setIsNavOpen(false)}
        />
      )}
      <main className="flex-1 flex flex-col md:ml-0">
        <header className="bg-linear-to-b from-[#301947] to-[#161322] border-b border-border p-6 shadow-lg">
          <div className="flex items-center gap-4">
            <button
              type="button"
              className="md:hidden inline-flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-surface/60 text-white hover:border-accent focus:outline-none focus-visible:ring focus-visible:ring-accent/60"
              onClick={() => setIsNavOpen((prev) => !prev)}
              aria-label="Toggle navigation"
            >
              <span className="flex flex-col gap-1.5">
                <span className="block h-0.5 w-5 bg-current"></span>
                <span className="block h-0.5 w-5 bg-current"></span>
                <span className="block h-0.5 w-5 bg-current"></span>
              </span>
            </button>
            <div>
              <h2 className="text-3xl font-bold text-white">
                {selectedThread
                  ? selectedThread.ownerName ?? selectedThread.name
                  : "Discord message stream"}
              </h2>
              <p className="text-text-secondary mt-1">
                {selectedThread ? (
                  <>
                    {selectedThread.name}
                    {!selectedThread.lastMessageFromAgent && (
                      <span className="ml-2 inline-flex items-center gap-1 text-amber-300">
                        <span className="inline-block h-2 w-2 rounded-full bg-amber-300"></span>
                        Awaiting support reply
                      </span>
                    )}
                  </>
                ) : (
                  "Waiting for messages from the Discord bot."
                )}
              </p>
            </div>
          </div>
        </header>

        <section className="p-8 overflow-y-auto">
          {messagesError && (
            <div className="mb-4 rounded-lg border border-red-400 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {messagesError}
            </div>
          )}
          {isLoadingMessages && messages.length === 0 ? (
            <p className="text-text-secondary italic">Loading messages...</p>
          ) : messages.length === 0 ? (
            <p className="text-text-secondary italic">
              {selectedThreadId
                ? "No messages yet for this post."
                : "Select a post to view messages."}
            </p>
          ) : (
            <div className="space-y-3">
              {messages.map((m) => (
                <div
                  key={m.id}
                  className="bg-surface border border-border rounded-xl p-4 hover:border-accent/40 transition"
                >
                  <div className="flex gap-4">
                    <div className="flex-shrink-0">
                      {m.avatarUrl ? (
                        <Image
                          src={m.avatarUrl}
                          alt={`${m.author} avatar`}
                          className="w-10 h-10 rounded-full object-cover"
                          width={40}
                          height={40}
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-sm text-white">
                          {m.author.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between items-center mb-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{m.author}</span>
                          {m.isSupportAgent && (
                            <span className="rounded-full bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent">
                              Support
                            </span>
                          )}
                        </div>
                        <span className="text-sm text-text-secondary">
                          {new Date(m.createdAt).toLocaleTimeString()}
                        </span>
                      </div>

                      <p>{m.content}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
