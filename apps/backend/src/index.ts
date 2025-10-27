import cors from "@fastify/cors";
import Fastify from "fastify";
import "dotenv/config";

import { registerMessageController } from "./controllers/messageController.js";
import { db } from "./db/index.js";
import { startDiscordBot } from "./handlers/discord.js";
import { SseClientManager } from "./handlers/sse.js";

const fastify = Fastify({
  logger: true,
});

const threadParentId = process.env.THREAD_PARENT_CHANNEL_ID;
const frontendUrl = process.env.FRONTEND_URL;
const discordToken = process.env.DISCORD_TOKEN;
const supportAgentRoleId = process.env.SUPPORT_AGENT_ROLE_ID;

if (!threadParentId) {
  throw new Error("THREAD_PARENT_CHANNEL_ID must be set");
}

if (!frontendUrl) {
  console.warn("WARNING: FRONTEND_URL is not set, CORS is open");
}

if (!discordToken) {
  throw new Error("DISCORD_TOKEN must be set");
}

if (!supportAgentRoleId) {
  throw new Error("SUPPORT_AGENT_ROLE_ID must be set");
}

await fastify.register(cors, {
  origin: frontendUrl ? [frontendUrl] : true,
});

const sseClientManager = new SseClientManager(frontendUrl ?? "*");

registerMessageController(fastify, {
  db,
  sse: sseClientManager,
  threadParentId,
  frontendUrl,
});

const PORT = Number(process.env.PORT) || 4000;
const start = async () => {
  try {
    await startDiscordBot({
      db,
      sse: sseClientManager,
      threadParentId,
      supportAgentRoleId,
      token: discordToken,
    });
    await fastify.listen({ port: PORT, host: "0.0.0.0" });
    fastify.log.info(`Fastify backend on :${PORT}`);
  } catch (error) {
    fastify.log.error(error);
    process.exit(1);
  }
};

void start();
