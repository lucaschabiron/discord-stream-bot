import type { FastifyReply, FastifyRequest } from "fastify";

import type { StoredMessage } from "../models/messages.js";

type SseEvent =
  | { type: "connected" }
  | { type: "message"; data: StoredMessage };

type SseClient = {
  id: number;
  reply: FastifyReply;
};

export class SseClientManager {
  private clients: SseClient[] = [];
  private nextId = 1;
  private readonly defaultOrigin: string;

  constructor(defaultOrigin: string) {
    this.defaultOrigin = defaultOrigin;
  }

  handleStream(
    _req: FastifyRequest,
    reply: FastifyReply,
    originOverride?: string
  ) {
    const origin = originOverride ?? this.defaultOrigin;

    reply.raw.setHeader("Access-Control-Allow-Origin", origin);
    reply.raw.setHeader("Content-Type", "text/event-stream");
    reply.raw.setHeader("Cache-Control", "no-cache");
    reply.raw.setHeader("Connection", "keep-alive");
    reply.raw.flushHeaders?.();

    const clientId = this.nextId++;

    reply.raw.write(this.formatEvent({ type: "connected" }));

    const client: SseClient = { id: clientId, reply };
    this.clients.push(client);

    reply.raw.on("close", () => this.removeClient(clientId));
  }

  broadcastMessage(message: StoredMessage) {
    const payload = this.formatEvent({ type: "message", data: message });
    this.clients.forEach((client) => client.reply.raw.write(payload));
  }

  private removeClient(id: number) {
    this.clients = this.clients.filter((client) => client.id !== id);
  }

  private formatEvent(event: SseEvent) {
    return `data: ${JSON.stringify(event)}\n\n`;
  }
}
