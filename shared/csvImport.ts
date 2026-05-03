import { z } from "zod";

export const CSV_IMPORT_TYPES = ["templates", "users", "ideas"] as const;
export type CsvImportType = (typeof CSV_IMPORT_TYPES)[number];

const trimmed = z.string().trim();
const optionalText = trimmed.optional().or(z.literal("").transform(() => undefined));

export const templateCsvRowSchema = z.object({
  templateName: trimmed.min(1, "templateName is required").max(120),
  templateType: optionalText.transform((v) => (v && v.length ? v : "general")),
  templateDescription: optionalText,
  itemKind: trimmed.toLowerCase().refine(
    (v) => v === "category" || v === "idea",
    { message: "itemKind must be 'category' or 'idea'" },
  ),
  itemContent: trimmed.min(1, "itemContent is required").max(2000),
  itemCategory: optionalText,
  itemColor: optionalText,
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
  organization: optionalText, // slug or name; required for non-global_admin
});
export type UserCsvRow = z.infer<typeof userCsvRowSchema>;

export const ideaCsvRowSchema = z.object({
  workspaceCode: trimmed.regex(/^\d{4}-\d{4}$/, "workspaceCode must look like nnnn-nnnn"),
  content: trimmed.min(1, "content is required").max(2000),
  category: optionalText,
});
export type IdeaCsvRow = z.infer<typeof ideaCsvRowSchema>;

export interface CsvPreviewError {
  row: number; // 1-based row number in the source file (header is row 1)
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
  rows: z.array(templateCsvRowSchema).min(1, "At least one row is required"),
});

export const csvConfirmUsersBodySchema = z.object({
  rows: z.array(userCsvRowSchema).min(1, "At least one row is required"),
  sendInvites: z.boolean().optional().default(true),
});

export const csvConfirmIdeasBodySchema = z.object({
  rows: z.array(ideaCsvRowSchema).min(1, "At least one row is required"),
});

export const TEMPLATE_CSV_HEADERS = [
  "templateName",
  "templateType",
  "templateDescription",
  "itemKind",
  "itemContent",
  "itemCategory",
  "itemColor",
] as const;

export const USER_CSV_HEADERS = ["email", "displayName", "role", "organization"] as const;

export const IDEA_CSV_HEADERS = ["workspaceCode", "content", "category"] as const;
