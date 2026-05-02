/**
 * Backfill knowledge_base_chunks for existing documents.
 *
 * Run after `npm run db:push` has applied the new schema. Safe to re-run:
 * for each document we delete existing chunks and re-extract.
 *
 * Usage: npx tsx scripts/backfill-kb-chunks.ts [--dry-run]
 */

import { db } from "../server/db";
import { knowledgeBaseDocuments } from "../shared/schema";
import { storage } from "../server/storage";
import { extractAndChunk, isExtractableMime } from "../server/services/kbExtraction";

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const docs = await db.select().from(knowledgeBaseDocuments);

  let extracted = 0;
  let skipped = 0;
  let totalChunks = 0;

  for (const doc of docs) {
    if (!isExtractableMime(doc.mimeType)) {
      console.log(`[skip] ${doc.id} (${doc.mimeType}) "${doc.title}"`);
      skipped++;
      continue;
    }

    const result = await extractAndChunk(doc.filePath, doc.mimeType);
    if (!result.supported || result.chunks.length === 0) {
      console.log(`[empty] ${doc.id} "${doc.title}"`);
      skipped++;
      continue;
    }

    if (!dryRun) {
      await storage.deleteKnowledgeBaseChunksByDocument(doc.id);
      await storage.createKnowledgeBaseChunks(
        result.chunks.map((content, chunkIndex) => ({
          documentId: doc.id,
          chunkIndex,
          content,
        })),
      );
    }

    extracted++;
    totalChunks += result.chunks.length;
    console.log(`[ok]   ${doc.id} "${doc.title}" -> ${result.chunks.length} chunks${dryRun ? " (dry run)" : ""}`);
  }

  console.log(`\nDone. Extracted ${extracted}/${docs.length} documents (${totalChunks} chunks). Skipped ${skipped}.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
