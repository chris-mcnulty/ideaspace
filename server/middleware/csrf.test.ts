import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { Request, Response } from "express";
import { csrfMiddleware, CSRF_COOKIE, CSRF_HEADER } from "./csrf";

function mockReq(opts: {
  method?: string;
  path?: string;
  cookieToken?: string;
  headerToken?: string;
}): Request {
  const headers: Record<string, string> = {};
  if (opts.cookieToken !== undefined) {
    headers["cookie"] = `${CSRF_COOKIE}=${opts.cookieToken}`;
  }
  if (opts.headerToken !== undefined) {
    headers[CSRF_HEADER] = opts.headerToken;
  }
  return {
    method: opts.method ?? "POST",
    path: opts.path ?? "/api/anything",
    headers,
  } as unknown as Request;
}

function mockRes() {
  const headers: Record<string, string | string[]> = {};
  const state = { statusCode: 200, jsonBody: undefined as any };
  const res: any = {
    setHeader: (k: string, v: string | string[]) => {
      headers[k] = v;
    },
    getHeader: (k: string) => headers[k],
    status: (code: number) => {
      state.statusCode = code;
      return res;
    },
    json: (body: any) => {
      state.jsonBody = body;
      return res;
    },
    get headers() {
      return headers;
    },
    get statusCode() {
      return state.statusCode;
    },
    get jsonBody() {
      return state.jsonBody;
    },
  };
  return res as Response & {
    headers: Record<string, string | string[]>;
    statusCode: number;
    jsonBody: any;
  };
}

describe("csrfMiddleware", () => {
  let originalMode: string | undefined;
  beforeEach(() => {
    originalMode = process.env.CSRF_MODE;
  });
  afterEach(() => {
    if (originalMode === undefined) delete process.env.CSRF_MODE;
    else process.env.CSRF_MODE = originalMode;
  });

  it("is a no-op when CSRF_MODE=off (default)", () => {
    delete process.env.CSRF_MODE;
    const req = mockReq({ method: "POST" });
    const res = mockRes() as any;
    const next = vi.fn();
    csrfMiddleware(req, res, next);
    expect(next).toHaveBeenCalled();
    // Cookie still set so clients can populate the header preemptively.
    expect(res.headers["Set-Cookie"]).toBeDefined();
  });

  it("sets a fresh token cookie when none exists", () => {
    process.env.CSRF_MODE = "enforce";
    const req = mockReq({ method: "GET" });
    const res = mockRes() as any;
    const next = vi.fn();
    csrfMiddleware(req, res, next);
    const cookie = res.headers["Set-Cookie"];
    expect(cookie).toBeDefined();
    const cookieStr = Array.isArray(cookie) ? cookie.join(";") : cookie;
    expect(cookieStr).toContain(`${CSRF_COOKIE}=`);
    expect(cookieStr).toContain("SameSite=Lax");
    expect(next).toHaveBeenCalled();
  });

  it("allows safe methods without a token", () => {
    process.env.CSRF_MODE = "enforce";
    const req = mockReq({ method: "GET", cookieToken: "abc" });
    const res = mockRes() as any;
    const next = vi.fn();
    csrfMiddleware(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it("rejects mutating requests with no header in enforce mode", () => {
    process.env.CSRF_MODE = "enforce";
    const req = mockReq({ method: "POST", cookieToken: "a".repeat(43) });
    const res = mockRes() as any;
    const next = vi.fn();
    csrfMiddleware(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
    expect(res.jsonBody).toEqual({ error: "Invalid or missing CSRF token" });
  });

  it("rejects mismatched header in enforce mode", () => {
    process.env.CSRF_MODE = "enforce";
    const token = "a".repeat(43);
    const req = mockReq({
      method: "PUT",
      cookieToken: token,
      headerToken: "b".repeat(43),
    });
    const res = mockRes() as any;
    const next = vi.fn();
    csrfMiddleware(req, res, next);
    expect(res.statusCode).toBe(403);
  });

  it("accepts matching header in enforce mode", () => {
    process.env.CSRF_MODE = "enforce";
    const token = "a".repeat(43);
    const req = mockReq({
      method: "DELETE",
      cookieToken: token,
      headerToken: token,
    });
    const res = mockRes() as any;
    const next = vi.fn();
    csrfMiddleware(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it("does not block in report mode but still calls next on mismatch", () => {
    process.env.CSRF_MODE = "report";
    const req = mockReq({ method: "POST", cookieToken: "a".repeat(43) });
    const res = mockRes() as any;
    const next = vi.fn();
    csrfMiddleware(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(res.statusCode).toBe(200);
  });

  it("allowlists OAuth callback paths", () => {
    process.env.CSRF_MODE = "enforce";
    const req = mockReq({ method: "POST", path: "/auth/callback" });
    const res = mockRes() as any;
    const next = vi.fn();
    csrfMiddleware(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it("does not crash on a cookie with malformed percent-encoding", () => {
    process.env.CSRF_MODE = "enforce";
    // Raw cookie header with broken percent-encoding the server would
    // otherwise pass to decodeURIComponent.
    const req = {
      method: "POST",
      path: "/api/anything",
      headers: { cookie: "csrf-token=%ZZ" },
    } as unknown as Request;
    const res = mockRes() as any;
    const next = vi.fn();
    expect(() => csrfMiddleware(req, res, next)).not.toThrow();
    // Cookie was unreadable, so the middleware treats it as missing and
    // issues a fresh one; the request itself fails CSRF since no header
    // was sent.
    expect(res.statusCode).toBe(403);
  });
});
