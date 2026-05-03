import { z } from "zod";

export const CSV_IMPORT_TYPES = ["templates", "users", "ideas"] as const;
export type CsvImportType = (typeof CSV_IMPORT_TYPES)[number];

const trimmed = z.string().trim();
const optionalText = trimmed.optional().or(z.literal("").transform(() => undefined));
const hexColor = z.string().regex(/^#?[0-9a-fA-F]{6}$/, "color must be a 6-digit hex").transform((v) =>
  v.startsWith("#") ? v : `#${v}`,
);

// Each line in the `ideas` cell: `text` or `text|category`
const templateIdeaItemSchema = z.object({
  text: trimmed.min(1).max(2000),
  category: optionalText,
});

// Each line in the `categories` cell: `name` or `name|#hex`
const templateCategoryItemSchema = z.object({
  name: trimmed.min(1).max(120),
  color: hexColor.optional(),
});

export const templateCsvRowSchema = z.object({
  name: trimmed.min(1, "name is required").max(120),
  description: optionalText,
  ideas: z.array(templateIdeaItemSchema).default([]),
  categories: z.array(templateCategoryItemSchema).default([]),
}).refine((row) => row.ideas.length > 0 || row.categories.length > 0, {
  message: "Template must have at least one idea or category",
});
export type TemplateCsvRow = z.infer<typeof templateCsvRowSchema>;

export const USER_CSV_ROLES = ["user", "facilitator", "company_admin", "global_admin"] as const;
export const userCsvRowSchema = z.object({
  email: trimmed.email("email must be a valid email address").transform((s) => s.toLowerCase()),
  displayName: trimmed.min(1, "displayName is required").max(120),
  role: trimmed.toLowerCase().refine(
    (v) => (USER_CSV_ROLES as readonly string[]).includes(v),
    { message: `role must be one of: ${USER_CSV_ROLES.join(", ")}` },
  ),
  organization: optionalText,
});
export type UserCsvRow = z.infer<typeof userCsvRowSchema>;

export const ideaCsvRowSchema = z.object({
  workspaceCode: trimmed.regex(/^\d{4}-\d{4}$/, "workspaceCode must look like nnnn-nnnn"),
  text: trimmed.min(1, "text is required").max(2000),
  // Normalize the exporter's "Uncategorized" sentinel back to undefined so
  // re-importing a per-workspace export does not create a real category.
  category: optionalText.transform((v) =>
    v && v.trim().toLowerCase() === "uncategorized" ? undefined : v,
  ),
});
export type IdeaCsvRow = z.infer<typeof ideaCsvRowSchema>;

export interface CsvPreviewError {
  row: number;
  field?: string;
  message: string;
}

export interface CsvPreviewResponse<TRow = unknown> {
  type: CsvImportType;
  totalRows: number;
  validRows: TRow[];
  /** Original 1-based CSV line numbers for each entry in `validRows`. */
  sourceRows: number[];
  /** Count of distinct invalid CSV rows (NOT the total number of issues). */
  invalidCount: number;
  errors: CsvPreviewError[];
}

export const csvConfirmTemplatesBodySchema = z.object({
  rows: z.array(templateCsvRowSchema).min(1),
});

export const csvConfirmUsersBodySchema = z.object({
  rows: z.array(userCsvRowSchema).min(1),
  sendInvites: z.boolean().optional().default(true),
});

export const csvConfirmIdeasBodySchema = z.object({
  rows: z.array(ideaCsvRowSchema).min(1),
});

export const TEMPLATE_CSV_HEADERS = ["name", "description", "ideas", "categories"] as const;
export const USER_CSV_HEADERS = ["email", "displayName", "role", "organization"] as const;
export const IDEA_CSV_HEADERS = ["workspaceCode", "text", "category"] as const;

// Aliases let the unified importer accept CSVs produced by the per-workspace
// idea exporter (`Idea,Category,Participant,Created At`). When workspaceCode
// is absent in the CSV, callers may supply a `defaultWorkspaceCode` and the
// `Participant` / `Created At` columns are ignored.
export const IDEA_HEADER_ALIASES: Record<string, string> = {
  idea: "text",
  text: "text",
  category: "category",
  workspacecode: "workspaceCode",
  "workspace code": "workspaceCode",
};

function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else { inQuotes = !inQuotes; }
    } else if (ch === "," && !inQuotes) {
      fields.push(current); current = "";
    } else { current += ch; }
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
      if (inQuotes && text[i + 1] === '"') { current += '""'; i++; }
      else { inQuotes = !inQuotes; current += ch; }
    } else if ((ch === "\n" || ch === "\r") && !inQuotes) {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      if (current.length > 0) rows.push(current);
      current = "";
    } else { current += ch; }
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
  ideas: ["text"],
};

export interface BuildCsvPreviewOptions {
  /** When set and the CSV has no workspaceCode column, fills it for ideas. */
  defaultWorkspaceCode?: string;
}

/**
 * Parse + Zod-validate a CSV. Used by both the client (for instant feedback
 * before upload) and the server (for the authoritative preview).
 */
export function buildCsvPreview<T>(
  type: CsvImportType,
  csvText: string,
  opts: BuildCsvPreviewOptions = {},
): CsvPreviewResponse<T> {
  if (!CSV_IMPORT_TYPES.includes(type)) {
    throw new Error(`Unsupported CSV import type: ${type}`);
  }

  const expectedHeaders = HEADER_BY_TYPE[type];
  const requiredHeaders = REQUIRED_HEADERS[type];
  const schema = ROW_SCHEMA_BY_TYPE[type] as z.ZodTypeAny;

  const rows = splitCsvRows(csvText.replace(/^\uFEFF/, ""));
  if (rows.length === 0) {
    return { type, totalRows: 0, validRows: [], sourceRows: [], invalidCount: 1, errors: [{ row: 1, message: "CSV is empty" }] };
  }

  const rawHeaders = parseCsvLine(rows[0]).map((h) => h.trim());
  const headerIndex = new Map<string, number>();
  rawHeaders.forEach((h, idx) => {
    if (type === "ideas") {
      const norm = IDEA_HEADER_ALIASES[h.toLowerCase()] ?? h;
      headerIndex.set(norm, idx);
    } else {
      headerIndex.set(h, idx);
    }
  });

  const errors: CsvPreviewError[] = [];
  const hasDefaultWs = type === "ideas" && !!opts.defaultWorkspaceCode;
  const effectiveRequired = type === "ideas" && hasDefaultWs
    ? requiredHeaders.filter((h) => h !== "workspaceCode")
    : type === "ideas"
      ? ["workspaceCode", "text"]
      : requiredHeaders;
  const missing = effectiveRequired.filter((h) => !headerIndex.has(h));
  if (missing.length > 0) {
    errors.push({
      row: 1,
      message: `Missing required header(s): ${missing.join(", ")}. Expected: ${expectedHeaders.join(",")}`,
    });
  }

  const validRows: T[] = [];
  const sourceRows: number[] = [];
  const invalidRowSet = new Set<number>();
  if (errors.length > 0) invalidRowSet.add(1);

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

    if (type === "ideas" && hasDefaultWs && !raw.workspaceCode) {
      raw.workspaceCode = opts.defaultWorkspaceCode!;
    }

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
      sourceRows.push(sourceRow);
    } else {
      invalidRowSet.add(sourceRow);
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
    sourceRows,
    invalidCount: invalidRowSet.size,
    errors,
  };
}

/**
 * Parse a multi-line cell from the templates CSV (newline-separated entries
 * with optional `|` delimiter) into structured items.
 */
export function parseTemplateIdeasCell(cell: string): { text: string; category?: string }[] {
  if (!cell || !cell.trim()) return [];
  return cell.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).map((line) => {
    const [text, category] = line.split("|").map((p) => p.trim());
    return category ? { text, category } : { text };
  });
}

export function parseTemplateCategoriesCell(cell: string): { name: string; color?: string }[] {
  if (!cell || !cell.trim()) return [];
  return cell.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).map((line) => {
    const [name, color] = line.split("|").map((p) => p.trim());
    return color ? { name, color } : { name };
  });
}
