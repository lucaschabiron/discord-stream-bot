import "dotenv/config";
import { Client, GatewayIntentBits, Partials } from "discord.js";

const DISCORD_TOKEN = process.env.DISCORD_TOKEN!;
const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:4000";

if (!DISCORD_TOKEN) {
  console.error("Missing DISCORD_TOKEN");
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel],
});

client.on("clientReady", () =>
  console.log(`Bot logged in as ${client.user?.tag}`)
);

client.on("messageCreate", async (msg) => {
  if (msg.author.bot) return;
  const channelName =
    msg.channel?.isTextBased() && "name" in (msg.channel as any)
      ? ((msg.channel as any).name as string | undefined) ?? undefined
      : undefined;
  try {
    await fetch(`${BACKEND_URL}/message`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        author: msg.author.username,
        avatarUrl: msg.author.displayAvatarURL
          ? msg.author.displayAvatarURL({ size: 128 })
          : undefined,
        content: msg.content,
        channelId: msg.channelId,
        channelName,
        createdAt: msg.createdAt.toISOString(),
      }),
    });
  } catch (e) {
    console.error("POST /message failed", e);
  }
});

client.login(DISCORD_TOKEN);
