import type { DatabaseSync } from "node:sqlite";

import type {
  IncomingMessage,
  StoredMessage,
  ThreadSummary,
} from "../../models/messages.js";

export const insertMessage = (
  db: DatabaseSync,
  payload: IncomingMessage
): StoredMessage => {
  const stmt = db.prepare(`
    INSERT INTO messages (
      channel_id,
      channel_name,
      author,
      author_id,
      avatar_url,
      content,
      created_at,
      thread_parent_id,
      thread_parent_name,
      is_support_agent
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const runResult = stmt.run(
    payload.threadId,
    payload.threadName ?? null,
    payload.author,
    payload.authorId ?? null,
    payload.avatarUrl ?? null,
    payload.content,
    payload.createdAt,
    payload.threadParentId ?? null,
    payload.threadParentName ?? null,
    payload.isSupportAgent ? 1 : 0
  );

  return {
    id: Number(runResult.lastInsertRowid),
    author: payload.author,
    authorId: payload.authorId ?? null,
    avatarUrl: payload.avatarUrl ?? null,
    content: payload.content,
    createdAt: payload.createdAt,
    threadId: payload.threadId,
    threadName: payload.threadName ?? null,
    threadParentId: payload.threadParentId ?? null,
    threadParentName: payload.threadParentName ?? null,
    isSupportAgent: Boolean(payload.isSupportAgent),
  };
};

export const listThreads = (
  db: DatabaseSync,
  threadParentId: string
): ThreadSummary[] => {
  let sql = `
    SELECT
      channel_id AS id,
      COALESCE(NULLIF(MAX(channel_name), ''), channel_id) AS name,
      MAX(created_at) AS lastMessageAt,
      COUNT(*) AS messageCount,
      COALESCE(NULLIF(MAX(thread_parent_id), ''), NULL) AS threadParentId,
      COALESCE(NULLIF(MAX(thread_parent_name), ''), NULL) AS threadParentName,
      MAX(CASE WHEN created_at = (
          SELECT MIN(created_at)
          FROM messages AS first
          WHERE first.channel_id = messages.channel_id
        ) THEN author ELSE NULL END) AS ownerName,
      MAX(CASE WHEN created_at = (
          SELECT MIN(created_at)
          FROM messages AS first
          WHERE first.channel_id = messages.channel_id
        ) THEN author_id ELSE NULL END) AS ownerId,
      MAX(CASE WHEN created_at = (
          SELECT MAX(created_at)
          FROM messages AS last
          WHERE last.channel_id = messages.channel_id
        ) THEN COALESCE(is_support_agent, 0) ELSE 0 END) AS lastMessageFromAgent,
      MAX(CASE WHEN COALESCE(is_support_agent, 0) = 1 THEN created_at ELSE NULL END) AS lastAgentMessageAt,
      SUM(
        CASE
          WHEN COALESCE(is_support_agent, 0) = 0
            AND created_at > COALESCE((
              SELECT MAX(created_at)
              FROM messages AS agent
              WHERE agent.channel_id = messages.channel_id
                AND COALESCE(agent.is_support_agent, 0) = 1
            ), '0000-00-00T00:00:00.000Z')
          THEN 1
          ELSE 0
        END
      ) AS pendingCustomerMessages
    FROM messages
  `;

  const params: string[] = [];
  const conditions: string[] = [];

  conditions.push("thread_parent_id = ?");
  params.push(threadParentId);

  if (conditions.length > 0) {
    sql += `WHERE ${conditions.join(" AND ")}
`;
  }

  sql += `GROUP BY channel_id
ORDER BY lastMessageFromAgent ASC, lastMessageAt IS NULL, lastMessageAt DESC
`;

  const rows = db.prepare(sql).all(...params) as Array<{
    id: string;
    name: string | null;
    lastMessageAt: string | null;
    messageCount: number;
    threadParentId: string | null;
    threadParentName: string | null;
    ownerName: string | null;
    ownerId: string | null;
    lastMessageFromAgent: number | null;
    lastAgentMessageAt: string | null;
    pendingCustomerMessages: number | null;
  }>;

  return rows.map((row) => ({
    id: row.id,
    name: row.name ?? row.id,
    lastMessageAt: row.lastMessageAt,
    messageCount: row.messageCount,
    parentId: row.threadParentId,
    parentName: row.threadParentName,
    ownerName: row.ownerName,
    ownerId: row.ownerId,
    lastMessageFromAgent: Boolean(row.lastMessageFromAgent),
    pendingCustomerMessages: Number(row.pendingCustomerMessages ?? 0),
    lastAgentMessageAt: row.lastAgentMessageAt,
  }));
};

export const listThreadMessages = (
  db: DatabaseSync,
  threadId: string,
  options: { threadParentId?: string; limit: number; after?: string }
): StoredMessage[] => {
  let sql = `
    SELECT
      id,
      channel_id AS threadId,
      channel_name AS threadName,
      author,
      author_id AS authorId,
      avatar_url AS avatarUrl,
      content,
      created_at AS createdAt,
      thread_parent_id AS threadParentId,
      thread_parent_name AS threadParentName,
      COALESCE(is_support_agent, 0) AS isSupportAgent
    FROM messages
    WHERE channel_id = ?
  `;

  const params: Array<string | number> = [threadId];

  if (options.threadParentId) {
    sql += " AND thread_parent_id = ?";
    params.push(options.threadParentId);
  }

  if (options.after) {
    sql += " AND created_at > ?";
    params.push(options.after);
  }

  sql += `
    ORDER BY created_at DESC
    LIMIT ?
  `;
  params.push(options.limit);

  const rows = db.prepare(sql).all(...params) as Array<{
    id: number;
    threadId: string;
    threadName?: string | null;
    author: string;
    authorId?: string | null;
    avatarUrl?: string | null;
    content: string;
    createdAt: string;
    threadParentId?: string | null;
    threadParentName?: string | null;
    isSupportAgent: number;
  }>;

  return rows.map((row) => ({
    id: Number(row.id),
    author: row.author,
    authorId: row.authorId ?? null,
    avatarUrl: row.avatarUrl ?? null,
    content: row.content,
    createdAt: row.createdAt,
    threadId: row.threadId,
    threadName: row.threadName ?? null,
    threadParentId: row.threadParentId ?? null,
    threadParentName: row.threadParentName ?? null,
    isSupportAgent: Boolean(row.isSupportAgent),
  }));
};
