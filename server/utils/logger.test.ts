import { describe, it, expect } from "vitest";
import { redact } from "./logger";

describe("redact", () => {
  it("redacts password fields", () => {
    expect(redact({ password: "hunter2" })).toEqual({ password: "[REDACTED]" });
    expect(redact({ newPassword: "x" })).toEqual({ newPassword: "[REDACTED]" });
    expect(redact({ user_password: "x" })).toEqual({ user_password: "[REDACTED]" });
  });

  it("redacts token-shaped keys", () => {
    expect(redact({ token: "abc", access_token: "y", id_token: "z", refresh_token: "r" }))
      .toEqual({ token: "[REDACTED]", access_token: "[REDACTED]", id_token: "[REDACTED]", refresh_token: "[REDACTED]" });
  });

  it("redacts cookies, secrets, api keys", () => {
    expect(redact({ Cookie: "abc", apiKey: "x", clientSecret: "y" })).toEqual({
      Cookie: "[REDACTED]",
      apiKey: "[REDACTED]",
      clientSecret: "[REDACTED]",
    });
  });

  it("redacts OAuth code and code_verifier", () => {
    expect(redact({ code: "abc", code_verifier: "x" })).toEqual({
      code: "[REDACTED]",
      code_verifier: "[REDACTED]",
    });
  });

  it("preserves non-sensitive keys", () => {
    expect(redact({ userId: "abc", limit: 30, isAdmin: true })).toEqual({
      userId: "abc",
      limit: 30,
      isAdmin: true,
    });
  });

  it("does not redact sessionId but does redact session payloads", () => {
    expect(redact({ sessionId: "ok" })).toEqual({ sessionId: "ok" });
    expect(redact({ session: { foo: "bar" } })).toEqual({ session: "[REDACTED]" });
  });

  it("recursively redacts nested objects", () => {
    expect(redact({ outer: { inner: { password: "x" } } })).toEqual({
      outer: { inner: { password: "[REDACTED]" } },
    });
  });

  it("walks arrays", () => {
    expect(redact([{ token: "a" }, { token: "b" }])).toEqual([
      { token: "[REDACTED]" },
      { token: "[REDACTED]" },
    ]);
  });

  it("converts Error to a serializable shape", () => {
    const err = new Error("boom");
    const out = redact(err) as { name: string; message: string; stack?: string };
    expect(out.name).toBe("Error");
    expect(out.message).toBe("boom");
    expect(typeof out.stack).toBe("string");
  });

  it("masks email addresses in strings", () => {
    expect(redact("contact: alice@example.com please")).toBe(
      "contact: a***@example.com please",
    );
  });

  it("preserves short emails (no info to mask)", () => {
    expect(redact("a@b.com")).toBe("a@b.com");
  });

  it("truncates very long strings", () => {
    const long = "x".repeat(3000);
    const out = redact(long) as string;
    expect(out.length).toBeLessThan(2100);
    expect(out).toContain("[truncated");
  });

  it("stops recursion at max depth", () => {
    const deep: any = { a: { a: { a: { a: { a: { a: { a: { a: "x" } } } } } } } };
    const out = redact(deep) as any;
    // At some depth, returns the sentinel
    let cur: any = out;
    while (cur && typeof cur === "object" && "a" in cur) cur = cur.a;
    expect(cur).toBe("[redact: max depth]");
  });
});
