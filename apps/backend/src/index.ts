import cors from "@fastify/cors";
import Fastify from "fastify";
import { mkdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import "dotenv/config";

const fastify = Fastify({
  logger: true,
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const dataDir = join(__dirname, "..", "data");
mkdirSync(dataDir, { recursive: true });

const db = new DatabaseSync(join(dataDir, "messages.db"));
db.exec(`
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    channel_id TEXT NOT NULL,
    channel_name TEXT,
    author TEXT NOT NULL,
    avatar_url TEXT,
    content TEXT NOT NULL,
    created_at TEXT NOT NULL
  )
`);
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_messages_channel_created_at
  ON messages (channel_id, created_at)
`);

type OutgoingMessage = {
  id: number;
  author: string;
  avatarUrl?: string | null;
  content: string;
  createdAt: string;
  channelId: string;
  channelName?: string | null;
};

type Client = { id: number; reply: any };
let clients: Client[] = [];
let nextId = 1;

if (!process.env.FRONTEND_URL) {
  console.warn("WARNING: FRONTEND_URL is not set, CORS is open");
}

await fastify.register(cors, {
  origin: process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : true,
});

// SSE stream (kept for compatibility)
fastify.get("/stream", async (req, reply) => {
  reply.raw.setHeader(
    "Access-Control-Allow-Origin",
    process.env.FRONTEND_URL! || "*"
  );
  reply.raw.setHeader("Content-Type", "text/event-stream");
  reply.raw.setHeader("Cache-Control", "no-cache");
  reply.raw.setHeader("Connection", "keep-alive");

  reply.raw.flushHeaders?.();

  const id = nextId++;
  clients.push({ id, reply });

  reply.raw.write(`data: ${JSON.stringify({ type: "connected" })}\n\n`);

  req.raw.on("close", () => {
    clients = clients.filter((c) => c.id !== id);
  });
});

type IncomingMessage = {
  author: string;
  avatarUrl?: string;
  content: string;
  createdAt: string;
  channelId: string;
  channelName?: string;
};

const insertMessageStmt = db.prepare(
  `
INSERT INTO messages (
  channel_id,
  channel_name,
  author,
  avatar_url,
  content,
  created_at
) VALUES (?, ?, ?, ?, ?, ?)
`
);

// Receive messages from bot
fastify.post("/message", async (req, reply) => {
  const body = req.body as IncomingMessage | undefined;

  if (
    !body ||
    !body.author ||
    !body.content ||
    !body.createdAt ||
    !body.channelId
  ) {
    reply.status(400).send({ error: "Invalid message payload" });
    return;
  }

  const runResult = insertMessageStmt.run(
    body.channelId,
    body.channelName ?? null,
    body.author,
    body.avatarUrl ?? null,
    body.content,
    body.createdAt
  );

  const storedMessage: OutgoingMessage = {
    id: Number(runResult.lastInsertRowid),
    author: body.author,
    avatarUrl: body.avatarUrl ?? null,
    content: body.content,
    createdAt: body.createdAt,
    channelId: body.channelId,
    channelName: body.channelName ?? null,
  };

  const payload = { type: "message", data: storedMessage };
  const data = `data: ${JSON.stringify(payload)}\n\n`;
  clients.forEach((c) => c.reply.raw.write(data));

  reply.status(201).send({ id: storedMessage.id });
});

fastify.get("/channels", async (_req, reply) => {
  const rows = db
    .prepare(
      `
SELECT
  channel_id AS id,
  COALESCE(
    NULLIF(MAX(channel_name), ''),
    channel_id
  ) AS name,
  MAX(created_at) AS lastMessageAt,
  COUNT(*) AS messageCount
FROM messages
GROUP BY channel_id
ORDER BY lastMessageAt IS NULL, lastMessageAt DESC
`
    )
    .all() as Array<{
    id: string;
    name: string | null;
    lastMessageAt: string | null;
    messageCount: number;
  }>;

  reply.send(
    rows.map((row) => ({
      id: row.id,
      name: row.name ?? row.id,
      lastMessageAt: row.lastMessageAt,
      messageCount: row.messageCount,
    }))
  );
});

fastify.get<{
  Params: { channelId: string };
  Querystring: { limit?: string; after?: string };
}>("/channels/:channelId/messages", async (req, reply) => {
  const { channelId } = req.params;
  const limitParam = Number(req.query.limit ?? 50);
  const limit = Number.isFinite(limitParam)
    ? Math.min(Math.max(Math.floor(limitParam), 1), 200)
    : 50;
  const after = req.query.after;

  let sql = `
SELECT
  id,
  channel_id AS channelId,
  channel_name AS channelName,
  author,
  avatar_url AS avatarUrl,
  content,
  created_at AS createdAt
FROM messages
WHERE channel_id = ?
`;
  const params: Array<string | number> = [channelId];

  if (after) {
    sql += " AND created_at > ?";
    params.push(after);
  }

  sql += `
ORDER BY created_at DESC
LIMIT ?
`;
  params.push(limit);

  const rows = db.prepare(sql).all(...params) as OutgoingMessage[];
  reply.send(
    rows.map((row) => ({
      ...row,
      id: Number(row.id),
    }))
  );
});

const PORT = Number(process.env.PORT) || 4000;
fastify
  .listen({ port: PORT, host: "0.0.0.0" })
  .then(() => console.log(`Fastify backend on :${PORT}`))
  .catch((err) => {
    fastify.log.error(err);
    process.exit(1);
  });
