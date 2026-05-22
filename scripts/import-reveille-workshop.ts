/**
 * Re-import the Reveille Software "May 2026 Offsite" workshop data after a DB restore.
 *
 * Run this AFTER restoring the database snapshot.
 * Uses ON CONFLICT (id) DO NOTHING throughout — safe to re-run multiple times.
 *
 * Usage:
 *   npx tsx scripts/import-reveille-workshop.ts [--dry-run]
 *
 * After this script completes, run:
 *   npx tsx scripts/backfill-kb-chunks.ts   ← regenerates KB full-text search vectors
 */

import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { neon } from "@neondatabase/serverless";

const __dirname = dirname(fileURLToPath(import.meta.url));

const DRY_RUN = process.argv.includes("--dry-run");

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const sqlClient = neon(process.env.DATABASE_URL);

type Row = Record<string, unknown>;

// Insert a batch of rows into a table using parameterised queries.
// Uses ON CONFLICT (id) DO NOTHING by default.
async function insertBatch(
  tableName: string,
  rows: Row[],
  conflictClause = "ON CONFLICT (id) DO NOTHING",
): Promise<number> {
  if (rows.length === 0) return 0;
  let count = 0;

  for (const row of rows) {
    const keys = Object.keys(row);
    if (keys.length === 0) continue;

    const cols = keys.map((k) => `"${k}"`).join(", ");
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(", ");
    const values = keys.map((k) => {
      const v = row[k];
      // Drizzle/neon returns parsed JS objects for jsonb; re-serialise for INSERT
      if (v !== null && v !== undefined && typeof v === "object" && !(v instanceof Date)) {
        return JSON.stringify(v);
      }
      return v ?? null;
    });

    const query = `INSERT INTO ${tableName} (${cols}) VALUES (${placeholders}) ${conflictClause}`;

    if (!DRY_RUN) {
      await sqlClient(query, values);
    }
    count++;
  }

  return count;
}

async function main() {
  const exportPath = join(__dirname, "reveille-workshop-export.json");
  console.log(`Reading export from: ${exportPath}\n`);

  const raw = readFileSync(exportPath, "utf-8");
  const exportData = JSON.parse(raw);

  if (DRY_RUN) console.log("[DRY RUN] No data will be written.\n");

  console.log(`Export timestamp : ${exportData.exportedAt}`);
  console.log(`Org              : ${exportData.orgId}`);
  console.log(`Project          : ${exportData.projectId}`);
  console.log(`Spaces           : ${exportData.spaceIds.join(", ")}\n`);

  const t = exportData.tables;

  // FK-safe insertion order
  const steps: Array<{ table: string; rows: Row[]; conflict?: string }> = [
    { table: "organizations",             rows: t.organizations },
    { table: "projects",                  rows: t.projects },
    { table: "project_members",           rows: t.projectMembers },
    { table: "company_admins",            rows: t.companyAdmins },
    { table: "spaces",                    rows: t.spaces },
    { table: "space_facilitators",        rows: t.spaceFacilitators,
      conflict: "ON CONFLICT (space_id, user_id) DO NOTHING" },
    { table: "participants",              rows: t.participants },
    { table: "categories",               rows: t.categories },
    { table: "notes",                     rows: t.notes },
    { table: "workspace_modules",         rows: t.workspaceModules },
    { table: "workspace_module_runs",     rows: t.workspaceModuleRuns },
    { table: "priority_matrices",         rows: t.priorityMatrices },
    { table: "priority_matrix_positions", rows: t.priorityMatrixPositions,
      conflict: "ON CONFLICT DO NOTHING" },
    { table: "staircase_modules",         rows: t.staircaseModules },
    { table: "staircase_positions",       rows: t.staircasePositions,
      conflict: "ON CONFLICT DO NOTHING" },
    { table: "survey_questions",          rows: t.surveyQuestions },
    { table: "votes",                     rows: t.votes },
    { table: "rankings",                  rows: t.rankings },
    { table: "marketplace_allocations",   rows: t.marketplaceAllocations },
    { table: "survey_responses",          rows: t.surveyResponses },
    { table: "cohort_results",            rows: t.cohortResults },
    { table: "personalized_results",      rows: t.personalizedResults },
    { table: "knowledge_base_documents",  rows: t.kbDocuments },
    // search_vector excluded from export; run backfill-kb-chunks.ts after import
    { table: "knowledge_base_chunks",     rows: t.kbChunks },
    { table: "ideas",                     rows: t.ideas },
    { table: "idea_contributions",        rows: t.ideaContributions },
  ];

  let total = 0;
  for (const step of steps) {
    if (!step.rows || step.rows.length === 0) continue;
    const n = await insertBatch(
      step.table,
      step.rows,
      step.conflict ?? "ON CONFLICT (id) DO NOTHING",
    );
    console.log(`  ${step.table.padEnd(30)} ${String(n).padStart(4)} rows`);
    total += n;
  }

  console.log(`\nTotal: ${total} rows ${DRY_RUN ? "would be" : ""} inserted.`);

  if (!DRY_RUN) {
    console.log("\nREMINDER — regenerate KB full-text search vectors:");
    console.log("  npx tsx scripts/backfill-kb-chunks.ts");
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Import failed:", err);
    process.exit(1);
  });
