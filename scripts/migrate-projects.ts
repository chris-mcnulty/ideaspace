/**
 * Production Migration Script: Projects Layer
 * 
 * This script ensures all organizations have a default project and all
 * workspaces are linked to their organization's default project.
 * 
 * Safe to run multiple times (idempotent).
 * 
 * Usage:
 *   npx tsx scripts/migrate-projects.ts
 * 
 * Prerequisites:
 *   - Database schema must be up to date (run `npm run db:push` first)
 *   - DATABASE_URL environment variable must be set
 */

import { drizzle } from "drizzle-orm/neon-serverless";
import { Pool, neonConfig } from "@neondatabase/serverless";
import { eq, isNull, isNotNull, and } from "drizzle-orm";
import ws from "ws";
import * as schema from "../shared/schema";

neonConfig.webSocketConstructor = ws;

async function runMigration() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("ERROR: DATABASE_URL environment variable is not set");
    process.exit(1);
  }

  console.log("Connecting to database...");
  const pool = new Pool({ connectionString: databaseUrl });
  const db = drizzle(pool, { schema });

  try {
    console.log("\n=== Projects Migration Script ===\n");

    // Step 1: Find organizations without a default project
    console.log("Step 1: Checking organizations for default projects...");
    
    const allOrgs = await db.select().from(schema.organizations);
    console.log(`  Found ${allOrgs.length} organizations`);

    let projectsCreated = 0;
    for (const org of allOrgs) {
      const existingDefault = await db
        .select()
        .from(schema.projects)
        .where(
          and(
            eq(schema.projects.organizationId, org.id),
            eq(schema.projects.isDefault, true)
          )
        )
        .limit(1);

      if (existingDefault.length === 0) {
        console.log(`  Creating default project for org: ${org.name} (${org.id})`);
        await db.insert(schema.projects).values({
          id: crypto.randomUUID(),
          organizationId: org.id,
          name: "Default Project",
          slug: "default",
          description: "Default project for workspaces",
          isDefault: true,
        });
        projectsCreated++;
      }
    }
    
    console.log(`  Created ${projectsCreated} new default projects`);

    // Step 2: Link orphaned workspaces to their org's default project
    console.log("\nStep 2: Linking workspaces without projects...");
    
    const orphanedWorkspaces = await db
      .select()
      .from(schema.spaces)
      .where(
        and(
          isNull(schema.spaces.projectId),
          isNotNull(schema.spaces.organizationId)
        )
      );

    console.log(`  Found ${orphanedWorkspaces.length} workspaces without project assignment`);

    let workspacesLinked = 0;
    for (const workspace of orphanedWorkspaces) {
      if (!workspace.organizationId) continue;

      const defaultProject = await db
        .select()
        .from(schema.projects)
        .where(
          and(
            eq(schema.projects.organizationId, workspace.organizationId),
            eq(schema.projects.isDefault, true)
          )
        )
        .limit(1);

      if (defaultProject.length > 0) {
        console.log(`  Linking workspace "${workspace.name}" to default project`);
        await db
          .update(schema.spaces)
          .set({ projectId: defaultProject[0].id })
          .where(eq(schema.spaces.id, workspace.id));
        workspacesLinked++;
      } else {
        console.warn(`  WARNING: No default project found for org ${workspace.organizationId}`);
      }
    }

    console.log(`  Linked ${workspacesLinked} workspaces to default projects`);

    // Step 3: Summary
    console.log("\n=== Migration Summary ===");
    
    const totalProjects = await db.select().from(schema.projects);
    const totalWorkspaces = await db.select().from(schema.spaces);
    const linkedWorkspaces = totalWorkspaces.filter(w => w.projectId !== null);
    const unlinkedWorkspaces = totalWorkspaces.filter(w => w.projectId === null && w.organizationId !== null);

    console.log(`  Total organizations: ${allOrgs.length}`);
    console.log(`  Total projects: ${totalProjects.length}`);
    console.log(`  Total workspaces: ${totalWorkspaces.length}`);
    console.log(`  Workspaces with project: ${linkedWorkspaces.length}`);
    console.log(`  Workspaces without project (but with org): ${unlinkedWorkspaces.length}`);
    
    if (unlinkedWorkspaces.length > 0) {
      console.log("\n  WARNING: Some workspaces still don't have projects assigned:");
      for (const ws of unlinkedWorkspaces) {
        console.log(`    - ${ws.name} (org: ${ws.organizationId})`);
      }
    }

    console.log("\n=== Migration Complete ===\n");

  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
