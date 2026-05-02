import fs from "fs/promises";

/**
 * Knowledge Base text extraction & chunking.
 *
 * Currently supports plain-text-style formats (text/plain, text/markdown,
 * text/csv, text/html). PDF and Office formats are intentionally out of scope
 * for this initial pass — they log a warning and produce no chunks. This keeps
 * the dependency surface small while still enabling FTS over the most common
 * KB content (notes, briefs, exported transcripts, CSV exports).
 */

const TEXT_MIME_PREFIXES = ["text/"];
const SUPPORTED_TEXT_MIMES = new Set([
  "text/plain",
  "text/markdown",
  "text/csv",
  "text/html",
  "application/json",
  "application/x-ndjson",
]);

const WORDS_PER_CHUNK = 500;
const CHUNK_OVERLAP_WORDS = 50;

export function isExtractableMime(mimeType: string): boolean {
  if (!mimeType) return false;
  if (SUPPORTED_TEXT_MIMES.has(mimeType)) return true;
  return TEXT_MIME_PREFIXES.some((p) => mimeType.startsWith(p));
}

function stripHtml(input: string): string {
  return input
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Read a file from local storage and return its plain-text representation.
 * Returns null when the mime type is not extractable.
 */
export async function extractTextFromFile(
  filePath: string,
  mimeType: string,
): Promise<string | null> {
  if (!isExtractableMime(mimeType)) {
    return null;
  }

  let buffer: Buffer;
  try {
    buffer = await fs.readFile(filePath);
  } catch (err) {
    console.warn(`[kbExtraction] Failed to read file ${filePath}:`, err);
    return null;
  }

  const raw = buffer.toString("utf-8");
  if (mimeType === "text/html") {
    return stripHtml(raw);
  }
  return raw;
}

/**
 * Split text into overlapping word chunks suitable for FTS indexing.
 */
export function chunkText(text: string): string[] {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];

  const words = normalized.split(/\s+/);
  if (words.length <= WORDS_PER_CHUNK) {
    return [normalized];
  }

  const chunks: string[] = [];
  const step = WORDS_PER_CHUNK - CHUNK_OVERLAP_WORDS;
  for (let i = 0; i < words.length; i += step) {
    const slice = words.slice(i, i + WORDS_PER_CHUNK);
    if (slice.length === 0) break;
    chunks.push(slice.join(" "));
    if (i + WORDS_PER_CHUNK >= words.length) break;
  }
  return chunks;
}

export interface ExtractedChunks {
  supported: boolean;
  chunks: string[];
}

export async function extractAndChunk(
  filePath: string,
  mimeType: string,
): Promise<ExtractedChunks> {
  const text = await extractTextFromFile(filePath, mimeType);
  if (text === null) {
    return { supported: false, chunks: [] };
  }
  return { supported: true, chunks: chunkText(text) };
}
