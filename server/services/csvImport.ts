import { z } from "zod";
import {
  CSV_IMPORT_TYPES,
  TEMPLATE_CSV_HEADERS,
  USER_CSV_HEADERS,
  IDEA_CSV_HEADERS,
  templateCsvRowSchema,
  userCsvRowSchema,
  ideaCsvRowSchema,
  type CsvImportType,
  type CsvPreviewError,
  type CsvPreviewResponse,
} from "@shared/csvImport";

/**
 * Parse a single CSV line into fields, supporting quoted values and escaped
 * double-quotes ("") inside quoted fields. Mirrors the inline parser used in
 * server/routes.ts for the existing /import/data-csv endpoint.
 */
function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      fields.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  fields.push(current);
  return fields;
}

/**
 * Split CSV text into logical lines. CSV records may contain newlines inside
 * quoted fields, so we cannot just split on \n.
 */
function splitCsvRows(text: string): string[] {
  const rows: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      if (inQuotes && text[i + 1] === '"') {
        current += '""';
        i++;
      } else {
        inQuotes = !inQuotes;
        current += ch;
      }
    } else if ((ch === "\n" || ch === "\r") && !inQuotes) {
      // Treat \r\n as a single break
      if (ch === "\r" && text[i + 1] === "\n") i++;
      if (current.length > 0) rows.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  if (current.length > 0) rows.push(current);
  return rows;
}

const HEADER_BY_TYPE: Record<CsvImportType, readonly string[]> = {
  templates: TEMPLATE_CSV_HEADERS,
  users: USER_CSV_HEADERS,
  ideas: IDEA_CSV_HEADERS,
};

const ROW_SCHEMA_BY_TYPE = {
  templates: templateCsvRowSchema,
  users: userCsvRowSchema,
  ideas: ideaCsvRowSchema,
} as const;

export interface ParsePreviewResult<T> {
  preview: CsvPreviewResponse<T>;
}

/**
 * Parse a CSV buffer for the given import type and return a structured preview
 * with valid rows and per-row errors. Does not touch the database.
 */
export function buildCsvPreview<T>(
  type: CsvImportType,
  csvText: string,
): CsvPreviewResponse<T> {
  if (!CSV_IMPORT_TYPES.includes(type)) {
    throw new Error(`Unsupported CSV import type: ${type}`);
  }

  const expectedHeaders = HEADER_BY_TYPE[type];
  const schema = ROW_SCHEMA_BY_TYPE[type] as z.ZodTypeAny;

  const rows = splitCsvRows(csvText.replace(/^\uFEFF/, ""));
  if (rows.length === 0) {
    return {
      type,
      totalRows: 0,
      validRows: [],
      invalidCount: 0,
      errors: [{ row: 1, message: "CSV is empty" }],
    };
  }

  const headerFields = parseCsvLine(rows[0]).map((h) => h.trim());
  const headerErrors: CsvPreviewError[] = [];

  // Build header -> index map; missing required headers produce a global error
  const headerIndex = new Map<string, number>();
  headerFields.forEach((h, idx) => headerIndex.set(h, idx));

  const missing = expectedHeaders.filter(
    (h) => !["templateDescription", "templateType", "itemCategory", "itemColor", "category", "organization"].includes(h)
      && !headerIndex.has(h),
  );
  if (missing.length > 0) {
    headerErrors.push({
      row: 1,
      message: `Missing required header(s): ${missing.join(", ")}. Expected: ${expectedHeaders.join(",")}`,
    });
  }

  const validRows: T[] = [];
  const errors: CsvPreviewError[] = [...headerErrors];

  for (let i = 1; i < rows.length; i++) {
    const sourceRow = i + 1; // 1-based, header is row 1
    const line = rows[i];
    if (line.trim() === "") continue;

    const fields = parseCsvLine(line);
    const obj: Record<string, string> = {};
    for (const header of expectedHeaders) {
      const idx = headerIndex.get(header);
      obj[header] = idx !== undefined && idx < fields.length ? fields[idx] : "";
    }

    const parsed = schema.safeParse(obj);
    if (parsed.success) {
      validRows.push(parsed.data as T);
    } else {
      for (const issue of parsed.error.issues) {
        errors.push({
          row: sourceRow,
          field: issue.path.join(".") || undefined,
          message: issue.message,
        });
      }
    }
  }

  return {
    type,
    totalRows: Math.max(0, rows.length - 1),
    validRows,
    invalidCount: errors.length,
    errors,
  };
}

/**
 * Convert a CsvPreviewResponse into a downloadable CSV string with one row per
 * error. Used by the Admin Imports UI as a "download error report".
 */
export function buildErrorReportCsv(preview: CsvPreviewResponse<unknown>): string {
  const escape = (v: string) => {
    if (v.includes(",") || v.includes("\"") || v.includes("\n")) {
      return '"' + v.replace(/"/g, '""') + '"';
    }
    return v;
  };
  const lines: string[] = ["row,field,message"];
  for (const err of preview.errors) {
    lines.push([
      String(err.row),
      escape(err.field ?? ""),
      escape(err.message),
    ].join(","));
  }
  return lines.join("\n") + "\n";
}
