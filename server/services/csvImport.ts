import { buildCsvPreview, type CsvPreviewResponse } from "@shared/csvImport";

export { buildCsvPreview };

export function buildErrorReportCsv(preview: CsvPreviewResponse<unknown>): string {
  const escape = (v: string) => {
    if (v.includes(",") || v.includes('"') || v.includes("\n")) {
      return '"' + v.replace(/"/g, '""') + '"';
    }
    return v;
  };
  const lines: string[] = ["row,field,message"];
  for (const err of preview.errors) {
    lines.push([String(err.row), escape(err.field ?? ""), escape(err.message)].join(","));
  }
  return lines.join("\n") + "\n";
}
