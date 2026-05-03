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
  category: optionalText,
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
