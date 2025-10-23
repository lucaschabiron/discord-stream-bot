import Fastify from "fastify";
import "dotenv/config";

const fastify = Fastify({
  logger: true,
});

type Client = { id: number; reply: any };
let clients: Client[] = [];
let nextId = 1;

if (!process.env.FRONTEND_URL) {
  console.warn("WARNING: FRONTEND_URL is not set, CORS is open");
}

// SSE stream
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

  // Send initial confirmation event
  reply.raw.write(`data: ${JSON.stringify({ type: "connected" })}\n\n`);

  req.raw.on("close", () => {
    clients = clients.filter((c) => c.id !== id);
  });
});
// Receive messages from bot
fastify.post("/message", async (req, reply) => {
  const body = req.body as any;
  const payload = { type: "message", data: body };
  const data = `data: ${JSON.stringify(payload)}\n\n`;
  clients.forEach((c) => c.reply.raw.write(data));
  reply.status(204).send();
});

const PORT = Number(process.env.PORT) || 4000;
fastify
  .listen({ port: PORT, host: "0.0.0.0" })
  .then(() => console.log(`Fastify backend on :${PORT}`))
  .catch((err) => {
    fastify.log.error(err);
    process.exit(1);
  });
