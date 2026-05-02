import fs from "fs/promises";
import path from "path";

/**
 * Knowledge Base text extraction & chunking.
 *
 * Supports the same formats the upload route allows:
 *   - text/plain, text/markdown, text/csv, text/html, application/json
 *   - application/csv (alt CSV mime)
 *   - application/pdf (via pdf-parse)
 *   - application/msword (.doc — best-effort, treated as binary text)
 *   - application/vnd.openxmlformats-officedocument.wordprocessingml.document
 *     (.docx via mammoth)
 *   - application/vnd.ms-excel (.xls via xlsx)
 *   - application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
 *     (.xlsx via xlsx)
 */

const TEXT_MIME_PREFIXES = ["text/"];
const TEXT_LIKE_MIMES = new Set([
  "text/plain",
  "text/markdown",
  "text/csv",
  "text/html",
  "application/csv",
  "application/json",
  "application/x-ndjson",
]);
const PDF_MIME = "application/pdf";
const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const DOC_MIME = "application/msword";
const XLSX_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const XLS_MIME = "application/vnd.ms-excel";

const WORDS_PER_CHUNK = 500;
const CHUNK_OVERLAP_WORDS = 50;

export function isExtractableMime(mimeType: string): boolean {
  if (!mimeType) return false;
  if (TEXT_LIKE_MIMES.has(mimeType)) return true;
  if (mimeType === PDF_MIME) return true;
  if (mimeType === DOCX_MIME || mimeType === DOC_MIME) return true;
  if (mimeType === XLSX_MIME || mimeType === XLS_MIME) return true;
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

async function extractPdf(buffer: Buffer): Promise<string> {
  // pdf-parse v2 exposes a class-based API: `new PDFParse({ data }).getText()`.
  const mod = (await import("pdf-parse")) as any;
  const PDFParse = mod.PDFParse || mod.default?.PDFParse;
  if (!PDFParse) throw new Error("pdf-parse: PDFParse export missing");
  const parser = new PDFParse({ data: buffer });
  const out = await parser.getText();
  return (out?.text || "").replace(/\s+\n/g, "\n").trim();
}

async function extractDocx(buffer: Buffer): Promise<string> {
  const mammoth: any = await import("mammoth");
  const result = await mammoth.extractRawText({ buffer });
  return (result?.value || "").trim();
}

async function extractSpreadsheet(buffer: Buffer): Promise<string> {
  const xlsx: any = await import("xlsx");
  const wb = xlsx.read(buffer, { type: "buffer" });
  const parts: string[] = [];
  for (const name of wb.SheetNames as string[]) {
    const sheet = wb.Sheets[name];
    const csv = xlsx.utils.sheet_to_csv(sheet);
    if (csv && csv.trim().length > 0) {
      parts.push(`# Sheet: ${name}\n${csv}`);
    }
  }
  return parts.join("\n\n").trim();
}

/**
 * Read a file from local storage and return its plain-text representation.
 * Returns null when extraction is not possible for that mime type.
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

  try {
    if (mimeType === PDF_MIME) {
      return await extractPdf(buffer);
    }
    if (mimeType === DOCX_MIME) {
      return await extractDocx(buffer);
    }
    if (mimeType === XLSX_MIME || mimeType === XLS_MIME) {
      return await extractSpreadsheet(buffer);
    }
    if (mimeType === DOC_MIME) {
      // Legacy .doc binary format. mammoth doesn't support it; fall back to
      // a permissive ASCII strip so we at least index any embedded text.
      const ascii = buffer.toString("latin1").replace(/[^\x20-\x7E\n\r\t]+/g, " ");
      return ascii.replace(/\s+/g, " ").trim();
    }
    const raw = buffer.toString("utf-8");
    if (mimeType === "text/html") return stripHtml(raw);
    return raw;
  } catch (err) {
    console.warn(
      `[kbExtraction] Extraction failed for ${path.basename(filePath)} (${mimeType}):`,
      err,
    );
    return null;
  }
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
