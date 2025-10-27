import "dotenv/config";
import {
  AnyThreadChannel,
  Client,
  GatewayIntentBits,
  Partials,
  type Message,
} from "discord.js";
import type { DatabaseSync } from "node:sqlite";

import { insertMessage } from "../db/queries/messages.js";
import type { IncomingMessage } from "../models/messages.js";
import { SseClientManager } from "./sse.js";

type DiscordHandlerOptions = {
  db: DatabaseSync;
  sse: SseClientManager;
  threadParentId: string;
  supportAgentRoleId: string;
  token: string;
};

export const startDiscordBot = async ({
  db,
  sse,
  threadParentId,
  supportAgentRoleId,
  token,
}: DiscordHandlerOptions) => {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.GuildMembers,
    ],
    partials: [Partials.Channel],
  });

  client.on("ready", () =>
    console.log(`Bot logged in as ${client.user?.tag}`)
  );

  client.on("messageCreate", async (msg: Message) => {
    if (msg.author.bot) return;
    const channel = msg.channel;
    if (!channel || typeof (channel as AnyThreadChannel).isThread !== "function") {
      return;
    }
    if (!channel.isThread?.()) return;

    let thread = channel as AnyThreadChannel;

    if ((thread as AnyThreadChannel).partial) {
      try {
        thread = (await thread.fetch()) as AnyThreadChannel;
      } catch (error) {
        console.warn("Unable to fetch thread details", error);
        return;
      }
    }

    const parentId = thread.parentId ?? undefined;

    if (!parentId || parentId !== threadParentId) {
      return;
    }

    let threadParentName: string | undefined = thread.parent?.name;
    if (!threadParentName && parentId) {
      try {
        const parent = await thread.guild.channels.fetch(parentId);
        if (parent && typeof (parent as { name?: string }).name === "string") {
          threadParentName = (parent as { name?: string }).name;
        }
      } catch (error) {
        console.warn("Unable to resolve thread parent", error);
      }
    }

    let isSupportAgent = false;
    try {
      const member =
        msg.member ?? (await msg.guild?.members.fetch(msg.author.id));
      if (member) {
        isSupportAgent = member.roles.cache.has(supportAgentRoleId);
      }
    } catch (error) {
      console.warn("Unable to resolve member roles", error);
    }

    const payload: IncomingMessage = {
      author: msg.author.username,
      authorId: msg.author.id,
      avatarUrl: msg.author.displayAvatarURL
        ? msg.author.displayAvatarURL({ size: 128 })
        : undefined,
      content: msg.content,
      threadId: msg.channelId,
      threadName: thread.name ?? undefined,
      threadParentId: parentId,
      threadParentName,
      createdAt: msg.createdAt.toISOString(),
      isSupportAgent,
    };

    try {
      const stored = insertMessage(db, payload);
      sse.broadcastMessage(stored);
    } catch (error) {
      console.error("Failed to persist Discord message", error);
    }
  });

  await client.login(token);
  return client;
};
