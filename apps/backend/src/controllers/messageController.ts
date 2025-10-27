import type { FastifyInstance } from "fastify";
import type { DatabaseSync } from "node:sqlite";

import { insertMessage, listThreadMessages, listThreads } from "../db/queries/messages.js";
import { SseClientManager } from "../handlers/sse.js";
import type { IncomingMessage } from "../models/messages.js";

type MessageControllerOptions = {
  db: DatabaseSync;
  sse: SseClientManager;
  threadParentId: string;
  frontendUrl?: string;
};

export const registerMessageController = (
  fastify: FastifyInstance,
  options: MessageControllerOptions
) => {
  const { db, sse, threadParentId, frontendUrl } = options;
  const allowedOrigin = frontendUrl ?? "*";

  fastify.get("/stream", async (req, reply) => {
    sse.handleStream(req, reply, allowedOrigin);
  });

  fastify.post("/message", async (req, reply) => {
    const body = req.body as IncomingMessage | undefined;

    if (
      !body ||
      !body.author ||
      !body.content ||
      !body.createdAt ||
      !body.threadId
    ) {
      reply.status(400).send({ error: "Invalid message payload" });
      return;
    }

    if (!body.threadParentId) {
      reply.status(400).send({ error: "Missing thread parent id" });
      return;
    }

    if (body.threadParentId !== threadParentId) {
      reply.status(202).send({ ignored: true });
      return;
    }

    const stored = insertMessage(db, {
      ...body,
      isSupportAgent: Boolean(body.isSupportAgent),
    });

    sse.broadcastMessage(stored);

    reply.status(201).send({ id: stored.id });
  });

  fastify.get("/threads", async (_req, reply) => {
    const threads = listThreads(db, threadParentId);
    reply.send(threads);
  });

  fastify.get<{
    Params: { threadId: string };
    Querystring: { limit?: string; after?: string };
  }>("/threads/:threadId/messages", async (req, reply) => {
    const { threadId } = req.params;
    const limitParam = Number(req.query.limit ?? 50);
    const limit = Number.isFinite(limitParam)
      ? Math.min(Math.max(Math.floor(limitParam), 1), 200)
      : 50;
    const after = req.query.after;

    const messages = listThreadMessages(db, threadId, {
      threadParentId,
      limit,
      after,
    });

    reply.send(messages);
  });
};
