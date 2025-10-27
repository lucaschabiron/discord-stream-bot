import { mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

import { runMigrations } from "./migrations/init.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const dataDir = join(__dirname, "..", "..", "data");

mkdirSync(dataDir, { recursive: true });

const db = new DatabaseSync(join(dataDir, "messages.db"));

runMigrations(db);

export { db };
