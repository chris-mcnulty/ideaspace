import { pool } from "./db";

/**
 * Ensure the in-app notifications table and its indexes exist.
 * Idempotent; safe to run on every startup. Used so fresh deployments
 * automatically gain the table without a manual migration step.
 */
export async function ensureNotificationsTable(): Promise<void> {
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
}

export async function runStartupMigrations(): Promise<void> {
  await ensureNotificationsTable();
}
