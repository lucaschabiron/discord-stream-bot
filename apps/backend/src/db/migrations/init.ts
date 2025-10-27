import type { DatabaseSync } from "node:sqlite";

export const runMigrations = (db: DatabaseSync) => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      channel_id TEXT NOT NULL,
      channel_name TEXT,
      author TEXT NOT NULL,
      author_id TEXT,
      avatar_url TEXT,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL,
      thread_parent_id TEXT,
      thread_parent_name TEXT,
      is_support_agent INTEGER DEFAULT 0
    )
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_messages_channel_created_at
    ON messages (channel_id, created_at)
  `);

  const existingColumns = db.prepare("PRAGMA table_info(messages)").all() as Array<{
    name: string;
  }>;
  const existingColumnNames = new Set(existingColumns.map((col) => col.name));

  if (!existingColumnNames.has("thread_parent_id")) {
    db.exec("ALTER TABLE messages ADD COLUMN thread_parent_id TEXT");
  }

  if (!existingColumnNames.has("thread_parent_name")) {
    db.exec("ALTER TABLE messages ADD COLUMN thread_parent_name TEXT");
  }

  if (!existingColumnNames.has("author_id")) {
    db.exec("ALTER TABLE messages ADD COLUMN author_id TEXT");
  }

  if (!existingColumnNames.has("is_support_agent")) {
    db.exec("ALTER TABLE messages ADD COLUMN is_support_agent INTEGER DEFAULT 0");
  }

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_messages_thread_parent
    ON messages (thread_parent_id, channel_id, created_at)
  `);
};
