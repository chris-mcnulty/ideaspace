import { pool } from "../server/db";

async function run() {
  console.log("[migrate-notifications] Ensuring notifications table exists...");
  await pool.query(`
    CREATE TABLE IF NOT EXISTS notifications (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id varchar NOT NULL,
      type text NOT NULL,
      title text NOT NULL,
      body text,
      link text,
      space_id varchar,
      read_at timestamp,
      created_at timestamp NOT NULL DEFAULT now()
    );
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_notifications_user_created
    ON notifications(user_id, created_at DESC);
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
    ON notifications(user_id) WHERE read_at IS NULL;
  `);
  console.log("[migrate-notifications] Done.");
  await pool.end();
}

run().catch((err) => {
  console.error("[migrate-notifications] Failed:", err);
  process.exit(1);
});
