import { db } from "../server/db";
import { sql } from "drizzle-orm";

async function main() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS workspace_visits (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      space_id VARCHAR NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
      organization_id VARCHAR REFERENCES organizations(id),
      participant_id VARCHAR,
      session_key TEXT NOT NULL,
      is_guest BOOLEAN NOT NULL DEFAULT false,
      device_type TEXT,
      country TEXT,
      visited_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS workspace_visits_space_idx ON workspace_visits(space_id)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS workspace_visits_org_idx ON workspace_visits(organization_id)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS workspace_visits_visited_at_idx ON workspace_visits(visited_at)`);
  console.log("workspace_visits table and indexes created.");
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
