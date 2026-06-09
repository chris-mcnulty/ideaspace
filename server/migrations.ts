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

/**
 * Ensure participants has a partial unique index on (space_id, user_id)
 * WHERE user_id IS NOT NULL, deduplicating any pre-existing duplicate
 * rows so the index can be created. Idempotent and safe to run on every
 * startup.
 *
 * Why: facilitator-only flows (bulk-import notes, accept AI suggestion,
 * accept invite link) used a get-then-create pattern. Without a uniqueness
 * constraint, rapid concurrent calls could create duplicate facilitator
 * participant rows for the same (space, user), polluting analytics that
 * count unique participants.
 *
 * Dedup strategy: for each (space_id, user_id) group with user_id NOT
 * NULL, keep the oldest row (joined_at ASC, id ASC as tiebreaker), repoint
 * every participant FK in dependent tables to that keeper, then delete
 * the loser rows. None of the dependent tables have UNIQUE constraints on
 * the participant_id columns, so plain UPDATEs are safe.
 */
export async function ensureParticipantsSpaceUserUniqueIndex(): Promise<void> {
  // Step 1: dedupe. Build a mapping of loser_id -> keeper_id for every
  // duplicate group, then repoint FKs and delete losers. Done in a single
  // transaction so a partial failure can't leave the data in a bad state.
  await pool.query(`
    DO $$
    DECLARE
      mapping_count integer;
    BEGIN
      CREATE TEMP TABLE _participant_dedupe_map ON COMMIT DROP AS
      WITH ranked AS (
        SELECT
          id,
          space_id,
          user_id,
          ROW_NUMBER() OVER (
            PARTITION BY space_id, user_id
            ORDER BY joined_at ASC, id ASC
          ) AS rn,
          FIRST_VALUE(id) OVER (
            PARTITION BY space_id, user_id
            ORDER BY joined_at ASC, id ASC
          ) AS keeper_id
        FROM participants
        WHERE user_id IS NOT NULL
      )
      SELECT id AS loser_id, keeper_id
      FROM ranked
      WHERE rn > 1;

      SELECT COUNT(*) INTO mapping_count FROM _participant_dedupe_map;
      IF mapping_count = 0 THEN
        RETURN;
      END IF;

      -- Repoint every participant FK column to the keeper. Listed
      -- explicitly so a future schema change here is a deliberate edit.
      UPDATE idea_contributions ic
        SET participant_id = m.keeper_id
        FROM _participant_dedupe_map m
        WHERE ic.participant_id = m.loser_id;

      UPDATE ideas i
        SET created_by_participant_id = m.keeper_id
        FROM _participant_dedupe_map m
        WHERE i.created_by_participant_id = m.loser_id;

      UPDATE marketplace_allocations ma
        SET participant_id = m.keeper_id
        FROM _participant_dedupe_map m
        WHERE ma.participant_id = m.loser_id;

      UPDATE notes n
        SET participant_id = m.keeper_id
        FROM _participant_dedupe_map m
        WHERE n.participant_id = m.loser_id;

      UPDATE personalized_results pr
        SET participant_id = m.keeper_id
        FROM _participant_dedupe_map m
        WHERE pr.participant_id = m.loser_id;

      UPDATE priority_matrix_positions pmp
        SET participant_id = m.keeper_id
        FROM _participant_dedupe_map m
        WHERE pmp.participant_id = m.loser_id;

      UPDATE priority_matrix_positions pmp
        SET locked_by = m.keeper_id
        FROM _participant_dedupe_map m
        WHERE pmp.locked_by = m.loser_id;

      UPDATE rankings r
        SET participant_id = m.keeper_id
        FROM _participant_dedupe_map m
        WHERE r.participant_id = m.loser_id;

      UPDATE staircase_positions sp
        SET participant_id = m.keeper_id
        FROM _participant_dedupe_map m
        WHERE sp.participant_id = m.loser_id;

      UPDATE staircase_positions sp
        SET locked_by = m.keeper_id
        FROM _participant_dedupe_map m
        WHERE sp.locked_by = m.loser_id;

      UPDATE survey_responses sr
        SET participant_id = m.keeper_id
        FROM _participant_dedupe_map m
        WHERE sr.participant_id = m.loser_id;

      UPDATE votes v
        SET participant_id = m.keeper_id
        FROM _participant_dedupe_map m
        WHERE v.participant_id = m.loser_id;

      DELETE FROM participants p
        USING _participant_dedupe_map m
        WHERE p.id = m.loser_id;

      RAISE NOTICE 'Deduplicated % participant row(s) before adding unique index', mapping_count;
    END
    $$;
  `);

  // Step 2: create the partial unique index. CONCURRENTLY would be safer
  // for large tables but cannot run inside a transaction or DO block; the
  // table is small enough that a brief lock is acceptable.
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS participants_space_user_unique
    ON participants (space_id, user_id)
    WHERE user_id IS NOT NULL;
  `);
}

/**
 * Ensure the per-user notification_preferences table exists.
 * Idempotent; safe to run on every startup.
 */
export async function ensureNotificationPreferencesTable(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS notification_preferences (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id varchar NOT NULL,
      type text NOT NULL,
      enabled boolean NOT NULL DEFAULT true,
      updated_at timestamp NOT NULL DEFAULT now(),
      CONSTRAINT notification_preferences_user_id_type_unique UNIQUE (user_id, type)
    );
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_notification_preferences_user
    ON notification_preferences(user_id);
  `);
}

/**
 * Ensure the organisation_api_keys table exists for Galaxy integration.
 * Idempotent; safe to run on every startup.
 */
export async function ensureOrganisationApiKeysTable(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS organisation_api_keys (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      organisation_id varchar NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      key_hash text NOT NULL,
      label text NOT NULL,
      is_umbrella boolean NOT NULL DEFAULT false,
      request_count integer NOT NULL DEFAULT 0,
      last_used_at timestamp,
      created_at timestamp NOT NULL DEFAULT now(),
      revoked_at timestamp
    );
  `);
  // Backfill: add columns to tables created before these columns existed
  await pool.query(`
    ALTER TABLE organisation_api_keys
    ADD COLUMN IF NOT EXISTS request_count integer NOT NULL DEFAULT 0;
  `);
  await pool.query(`
    ALTER TABLE organisation_api_keys
    ADD COLUMN IF NOT EXISTS is_umbrella boolean NOT NULL DEFAULT false;
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_org_api_keys_organisation
    ON organisation_api_keys(organisation_id);
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_org_api_keys_key_hash
    ON organisation_api_keys(key_hash);
  `);
}

/**
 * Ensure the starship envisioning module tables exist. Mirrors the priority
 * matrix tables: one config row per space plus a positions table that records
 * which zone (thrust/destination/drag) each note was dropped into and its
 * normalized x/y coordinate on the canvas. Idempotent and safe to run on every startup.
 */
export async function ensureStarshipTables(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS starships (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      space_id varchar NOT NULL REFERENCES spaces(id),
      module_run_id varchar REFERENCES workspace_module_runs(id) ON DELETE CASCADE,
      destination_label text NOT NULL DEFAULT 'Destinations',
      thrust_label text NOT NULL DEFAULT 'Propulsion',
      drag_label text NOT NULL DEFAULT 'Black Holes',
      assign_zone_as_category boolean NOT NULL DEFAULT true,
      created_at timestamp NOT NULL DEFAULT now(),
      updated_at timestamp NOT NULL DEFAULT now()
    );
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS starship_positions (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      starship_id varchar NOT NULL REFERENCES starships(id) ON DELETE CASCADE,
      note_id varchar NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
      module_run_id varchar REFERENCES workspace_module_runs(id) ON DELETE CASCADE,
      zone text NOT NULL,
      x_coord real NOT NULL DEFAULT 0.5 CHECK (x_coord >= 0 AND x_coord <= 1),
      y_coord real NOT NULL DEFAULT 0.5 CHECK (y_coord >= 0 AND y_coord <= 1),
      locked_by varchar REFERENCES participants(id),
      locked_at timestamp,
      participant_id varchar REFERENCES participants(id),
      created_at timestamp NOT NULL DEFAULT now(),
      updated_at timestamp NOT NULL DEFAULT now(),
      CONSTRAINT starship_positions_unique_note UNIQUE (starship_id, note_id, module_run_id)
    );
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_starship_positions_starship
    ON starship_positions(starship_id);
  `);
}

export async function runStartupMigrations(): Promise<void> {
  await ensureNotificationsTable();
  await ensureClientErrorsTable();
  await ensurePulseActivityEventsTable();
  await ensureParticipantsSpaceUserUniqueIndex();
  await ensureNotificationPreferencesTable();
  await ensureOrganisationApiKeysTable();
  await ensureStarshipTables();
}
