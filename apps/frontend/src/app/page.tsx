"use client";
import { useEffect, useState } from "react";

type Msg = {
  author: string;
  content: string;
  createdAt: string;
  channelId: string;
};

export default function Page() {
  const [messages, setMessages] = useState<Msg[]>([]);
  useEffect(() => {
    const base = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000";
    const es = new EventSource(`${base}/stream`);
    es.onmessage = (ev) => {
      try {
        const payload = JSON.parse(ev.data);
        if (payload?.type === "message") {
          setMessages((prev) => [payload.data as Msg, ...prev].slice(0, 50));
        }
      } catch {}
    };
    return () => es.close();
  }, []);

  return (
    <div className="flex h-screen bg-background text-foreground">
      <main className="flex-1 flex flex-col">
        <header className="bg-linear-to-b from-[#301947] to-[#161322] border-b border-border p-6 shadow-lg">
          <h2 className="text-3xl font-bold text-white">
            Discord message stream
          </h2>
          <p className="text-text-secondary mt-1">
            Live Discord messages streamed in real time.
          </p>
        </header>

        <section className="p-8 overflow-y-auto">
          <div className="space-y-3">
            {messages.length === 0 && (
              <p className="text-text-secondary italic">
                Waiting for messages...
              </p>
            )}
            {messages.map((m, i) => (
              <div
                key={i}
                className="bg-surface border border-border rounded-xl p-4 hover:border-accent/40 transition"
              >
                <div className="flex justify-between mb-1">
                  <span className="font-semibold">{m.author}</span>
                  <span className="text-sm text-text-secondary">
                    {new Date(m.createdAt).toLocaleTimeString()}
                  </span>
                </div>
                <p>{m.content}</p>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
