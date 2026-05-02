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
 * Ensure performance indexes exist on hot foreign-key columns.
 * Idempotent — uses CREATE INDEX IF NOT EXISTS so safe on every startup.
 * Targets the most frequent N+1 / aggregation lookups: notes/votes/rankings/
 * marketplace_allocations/survey_responses by spaceId, participants by space,
 * spaces by organizationId/projectId, projects by organizationId.
 */
export async function ensurePerformanceIndexes(): Promise<void> {
  const statements = [
    `CREATE INDEX IF NOT EXISTS idx_notes_space ON notes(space_id);`,
    `CREATE INDEX IF NOT EXISTS idx_notes_participant ON notes(participant_id);`,
    `CREATE INDEX IF NOT EXISTS idx_votes_space ON votes(space_id);`,
    `CREATE INDEX IF NOT EXISTS idx_votes_participant ON votes(participant_id);`,
    `CREATE INDEX IF NOT EXISTS idx_rankings_space ON rankings(space_id);`,
    `CREATE INDEX IF NOT EXISTS idx_rankings_participant ON rankings(participant_id);`,
    `CREATE INDEX IF NOT EXISTS idx_marketplace_allocations_space ON marketplace_allocations(space_id);`,
    `CREATE INDEX IF NOT EXISTS idx_survey_responses_space ON survey_responses(space_id);`,
    `CREATE INDEX IF NOT EXISTS idx_survey_questions_space ON survey_questions(space_id);`,
    `CREATE INDEX IF NOT EXISTS idx_participants_space ON participants(space_id);`,
    `CREATE INDEX IF NOT EXISTS idx_participants_user ON participants(user_id);`,
    `CREATE INDEX IF NOT EXISTS idx_categories_space ON categories(space_id);`,
    `CREATE INDEX IF NOT EXISTS idx_spaces_organization ON spaces(organization_id);`,
    `CREATE INDEX IF NOT EXISTS idx_spaces_project ON spaces(project_id);`,
    `CREATE INDEX IF NOT EXISTS idx_projects_organization ON projects(organization_id);`,
    `CREATE INDEX IF NOT EXISTS idx_project_members_user ON project_members(user_id);`,
    `CREATE INDEX IF NOT EXISTS idx_project_members_project ON project_members(project_id);`,
    `CREATE INDEX IF NOT EXISTS idx_space_facilitators_user ON space_facilitators(user_id);`,
    `CREATE INDEX IF NOT EXISTS idx_space_facilitators_space ON space_facilitators(space_id);`,
  ];
  for (const sql of statements) {
    try {
      await pool.query(sql);
    } catch (err) {
      // Log but never fail startup — indexes are best-effort optimization.
      console.error("Failed to create performance index:", sql, err);
    }
  }
}

export async function runStartupMigrations(): Promise<void> {
  await ensureNotificationsTable();
  await ensureClientErrorsTable();
  await ensurePerformanceIndexes();
}
