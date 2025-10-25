"use client";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";

const BACKEND_BASE_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000";

type Channel = {
  id: string;
  name: string;
  lastMessageAt: string | null;
  messageCount: number;
};

type Msg = {
  id: number;
  author: string;
  avatarUrl?: string | null;
  content: string;
  createdAt: string;
  channelId: string;
  channelName?: string | null;
};

export default function Page() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(
    null
  );
  const [messages, setMessages] = useState<Msg[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [messagesError, setMessagesError] = useState<string | null>(null);
  const [isNavOpen, setIsNavOpen] = useState(false);

  useEffect(() => {
    let ignore = false;

    const fetchChannels = async () => {
      try {
        const res = await fetch(`${BACKEND_BASE_URL}/channels`);
        if (!res.ok) {
          throw new Error(`Failed to load channels (status ${res.status})`);
        }
        const data = (await res.json()) as Channel[];
        if (ignore) return;
        setChannels(data);
        setSelectedChannelId((prev) => prev ?? data[0]?.id ?? null);
      } catch (error) {
        if (ignore) return;
        console.error("Failed to load channels", error);
      }
    };

    fetchChannels();
    const interval = setInterval(fetchChannels, 15000);

    return () => {
      ignore = true;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (!selectedChannelId) {
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
          `${BACKEND_BASE_URL}/channels/${encodeURIComponent(
            selectedChannelId
          )}/messages?limit=50`
        );
        if (!res.ok) {
          throw new Error(`Failed to load messages (status ${res.status})`);
        }
        const data = (await res.json()) as Msg[];
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
  }, [selectedChannelId]);

  const selectedChannel = useMemo(
    () => channels.find((c) => c.id === selectedChannelId) ?? null,
    [channels, selectedChannelId]
  );

  const handleChannelSelect = useCallback((channelId: string) => {
    setSelectedChannelId(channelId);
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
          <h2 className="text-xl font-semibold text-white">Channels</h2>
          <p className="text-sm text-text-secondary mt-1">
            Choose a channel to browse messages.
          </p>
        </div>
        <nav className="flex-1 overflow-y-auto">
          {channels.length === 0 ? (
            <p className="px-4 py-6 text-sm text-text-secondary">
              Waiting for channel activity...
            </p>
          ) : (
            channels.map((channel) => {
              const isActive = channel.id === selectedChannelId;
              return (
                <button
                  type="button"
                  key={channel.id}
                  onClick={() => handleChannelSelect(channel.id)}
                  className={`w-full text-left px-4 py-3 transition ${
                    isActive
                      ? "bg-surface border-l-2 border-accent text-white"
                      : "hover:bg-surface/50 text-text-secondary"
                  }`}
                >
                  <div className="flex justify-between items-center text-sm font-medium">
                    <span className="truncate">#{channel.name}</span>
                    {channel.messageCount > 0 && (
                      <span className="text-xs text-text-secondary">
                        {channel.messageCount}
                      </span>
                    )}
                  </div>
                  {channel.lastMessageAt && (
                    <p className="text-xs text-text-secondary mt-1">
                      Last message{" "}
                      {new Date(channel.lastMessageAt).toLocaleTimeString()}
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
                {selectedChannel
                  ? `#${selectedChannel.name}`
                  : "Discord message stream"}
              </h2>
              <p className="text-text-secondary mt-1">
                {selectedChannel
                  ? "Latest messages for this channel."
                  : "Waiting for messages from the Discord bot."}
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
              {selectedChannelId
                ? "No messages yet for this channel."
                : "Select a channel to view messages."}
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
                        <span className="font-semibold">{m.author}</span>
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
