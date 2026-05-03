import { db } from "../server/db";
import { sql } from "drizzle-orm";

async function main() {
  console.log("Adding ai_generated column to notes (if missing)...");
  await db.execute(
    sql`ALTER TABLE notes ADD COLUMN IF NOT EXISTS ai_generated boolean NOT NULL DEFAULT false`
  );
  console.log("Done.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
