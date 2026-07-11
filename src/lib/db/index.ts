import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

// We create a local file-based client using the SQLite db.
const client = createClient({
  url: "file:sqlite.db",
});

// Several background scripts (discovery, bulk matcher, crawler) write
// concurrently — wait for locks instead of failing with SQLITE_BUSY.
client.execute("PRAGMA busy_timeout = 60000").catch(() => {});

export const db = drizzle(client, { schema });
export * as schema from "./schema";
