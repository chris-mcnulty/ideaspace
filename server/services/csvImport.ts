import { z } from "zod";
import {
  CSV_IMPORT_TYPES,
  TEMPLATE_CSV_HEADERS,
  USER_CSV_HEADERS,
  IDEA_CSV_HEADERS,
  templateCsvRowSchema,
  userCsvRowSchema,
  ideaCsvRowSchema,
  parseTemplateIdeasCell,
  parseTemplateCategoriesCell,
  type CsvImportType,
  type CsvPreviewError,
  type CsvPreviewResponse,
} from "@shared/csvImport";

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

const REQUIRED_HEADERS: Record<CsvImportType, readonly string[]> = {
  templates: ["name"],
  users: ["email", "displayName", "role"],
  ideas: ["workspaceCode", "text"],
};

export function buildCsvPreview<T>(
  type: CsvImportType,
  csvText: string,
): CsvPreviewResponse<T> {
  if (!CSV_IMPORT_TYPES.includes(type)) {
    throw new Error(`Unsupported CSV import type: ${type}`);
  }

  const expectedHeaders = HEADER_BY_TYPE[type];
  const requiredHeaders = REQUIRED_HEADERS[type];
  const schema = ROW_SCHEMA_BY_TYPE[type] as z.ZodTypeAny;

  const rows = splitCsvRows(csvText.replace(/^\uFEFF/, ""));
  if (rows.length === 0) {
    return {
      type,
      totalRows: 0,
      validRows: [],
      invalidCount: 1,
      errors: [{ row: 1, message: "CSV is empty" }],
    };
  }

  const headerFields = parseCsvLine(rows[0]).map((h) => h.trim());
  const headerIndex = new Map<string, number>();
  headerFields.forEach((h, idx) => headerIndex.set(h, idx));

  const errors: CsvPreviewError[] = [];
  const missing = requiredHeaders.filter((h) => !headerIndex.has(h));
  if (missing.length > 0) {
    errors.push({
      row: 1,
      message: `Missing required header(s): ${missing.join(", ")}. Expected: ${expectedHeaders.join(",")}`,
    });
  }

  const validRows: T[] = [];

  for (let i = 1; i < rows.length; i++) {
    const sourceRow = i + 1;
    const line = rows[i];
    if (line.trim() === "") continue;

    const fields = parseCsvLine(line);
    const raw: Record<string, string> = {};
    for (const header of expectedHeaders) {
      const idx = headerIndex.get(header);
      raw[header] = idx !== undefined && idx < fields.length ? fields[idx] : "";
    }

    // For templates, parse multi-line cells into structured arrays before
    // handing to Zod.
    let candidate: unknown = raw;
    if (type === "templates") {
      candidate = {
        name: raw.name,
        description: raw.description || undefined,
        ideas: parseTemplateIdeasCell(raw.ideas ?? ""),
        categories: parseTemplateCategoriesCell(raw.categories ?? ""),
      };
    }

    const parsed = schema.safeParse(candidate);
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

export function buildErrorReportCsv(preview: CsvPreviewResponse<unknown>): string {
  const escape = (v: string) => {
    if (v.includes(",") || v.includes('"') || v.includes("\n")) {
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
