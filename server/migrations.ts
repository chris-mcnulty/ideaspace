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

/**
 * Ensure the client_errors telemetry table exists.
 * Idempotent; safe to run on every startup.
 */
export async function ensureClientErrorsTable(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS client_errors (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      scope text,
      message text NOT NULL,
      stack text,
      component_stack text,
      route text,
      user_agent text,
      user_id varchar,
      participant_id varchar,
      ip_address text,
      created_at timestamp NOT NULL DEFAULT now()
    );
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_client_errors_created
    ON client_errors(created_at DESC);
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_client_errors_user_created
    ON client_errors(user_id, created_at DESC);
  `);
}

/**
 * Ensure the pulse_activity_events append-only log exists.
 * Idempotent; safe to run on every startup. Backs the per-minute
 * participation heatmap on the Pulse tab.
 */
export async function ensurePulseActivityEventsTable(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS pulse_activity_events (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      space_id varchar NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
      module_type text NOT NULL,
      participant_id varchar,
      occurred_at timestamp NOT NULL DEFAULT now()
    );
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_pulse_events_space_time
    ON pulse_activity_events(space_id, occurred_at);
  `);
}

export async function runStartupMigrations(): Promise<void> {
  await ensureNotificationsTable();
  await ensureClientErrorsTable();
  await ensurePulseActivityEventsTable();
}
