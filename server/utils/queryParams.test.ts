import { describe, it, expect } from "vitest";
import {
  paginationQuerySchema,
  notificationListQuerySchema,
  kbSearchQuerySchema,
  safeReturnTo,
} from "./queryParams";

describe("paginationQuerySchema", () => {
  it("applies defaults when params are missing", () => {
    const out = paginationQuerySchema.parse({});
    expect(out).toEqual({ page: 1, limit: 20 });
  });

  it("parses numeric strings", () => {
    expect(paginationQuerySchema.parse({ page: "3", limit: "50" })).toEqual({
      page: 3,
      limit: 50,
    });
  });

  it("rejects non-integer values", () => {
    expect(() => paginationQuerySchema.parse({ page: "foo" })).toThrow();
    expect(() => paginationQuerySchema.parse({ limit: "1.5" })).toThrow();
  });

  it("rejects values out of range", () => {
    expect(() => paginationQuerySchema.parse({ page: "0" })).toThrow();
    expect(() => paginationQuerySchema.parse({ limit: "101" })).toThrow();
    expect(() => paginationQuerySchema.parse({ limit: "-1" })).toThrow();
  });
});

describe("notificationListQuerySchema", () => {
  it("defaults limit to 30", () => {
    expect(notificationListQuerySchema.parse({})).toEqual({ limit: 30 });
  });

  it("rejects limit > 100", () => {
    expect(() => notificationListQuerySchema.parse({ limit: "500" })).toThrow();
  });
});

describe("kbSearchQuerySchema", () => {
  it("trims q and defaults scope to system", () => {
    expect(kbSearchQuerySchema.parse({ q: "  hello  " })).toEqual({
      q: "hello",
      scope: "system",
      scopeId: undefined,
      limit: 8,
    });
  });

  it("rejects invalid scope values", () => {
    expect(() => kbSearchQuerySchema.parse({ scope: "evil" })).toThrow();
  });

  it("caps q at 500 chars to prevent abuse", () => {
    const q = "a".repeat(1000);
    expect(kbSearchQuerySchema.parse({ q }).q.length).toBe(500);
  });
});

describe("safeReturnTo", () => {
  it("returns the fallback for non-string values", () => {
    expect(safeReturnTo(undefined)).toBe("/");
    expect(safeReturnTo(null)).toBe("/");
    expect(safeReturnTo(42)).toBe("/");
    expect(safeReturnTo("", "/o")).toBe("/o");
  });

  it("accepts safe relative paths", () => {
    expect(safeReturnTo("/dashboard")).toBe("/dashboard");
    expect(safeReturnTo("/o/workspaces/abc?tab=ideation")).toBe(
      "/o/workspaces/abc?tab=ideation",
    );
  });

  it("rejects absolute URLs (open redirect)", () => {
    expect(safeReturnTo("https://evil.com/path")).toBe("/");
    expect(safeReturnTo("http://evil.com")).toBe("/");
  });

  it("rejects protocol-relative URLs", () => {
    expect(safeReturnTo("//evil.com/path")).toBe("/");
  });

  it("rejects backslash-prefixed paths (Windows trick)", () => {
    expect(safeReturnTo("/\\evil.com")).toBe("/");
  });

  it("rejects CR/LF injections (header smuggling)", () => {
    expect(safeReturnTo("/path\r\nSet-Cookie: foo=bar")).toBe("/");
    expect(safeReturnTo("/path\nfoo")).toBe("/");
  });

  it("rejects scheme-with-relative-path tricks", () => {
    expect(safeReturnTo("/javascript:alert(1)")).toBe("/");
  });

  it("rejects overly long paths", () => {
    expect(safeReturnTo("/" + "a".repeat(3000))).toBe("/");
  });

  it("uses provided fallback", () => {
    expect(safeReturnTo("nope", "/login")).toBe("/login");
  });
});
