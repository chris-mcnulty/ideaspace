/**
 * Install a global fetch interceptor that adds the CSRF token header on
 * mutating same-origin requests. This lets existing direct `fetch()` callers
 * keep working when the server enables CSRF enforcement, without forcing a
 * sweep of every callsite.
 *
 * It is safe and idempotent: cross-origin requests, safe methods, and
 * requests that already include the header are passed through unchanged.
 */

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const HEADER = "X-CSRF-Token";
const COOKIE = "csrf-token";

function readToken(): string | undefined {
  if (typeof document === "undefined") return undefined;
  const match = document.cookie.match(/(?:^|; )csrf-token=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : undefined;
}

function isSameOrigin(url: string): boolean {
  if (url.startsWith("/")) return true;
  try {
    const u = new URL(url, window.location.href);
    return u.origin === window.location.origin;
  } catch {
    return false;
  }
}

let installed = false;

export function installFetchCsrf(): void {
  if (installed || typeof window === "undefined") return;
  installed = true;

  // Reference the cookie name once so it's not unused if cookies disappear.
  void COOKIE;

  const original = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const method = (init?.method || (input instanceof Request ? input.method : "GET")).toUpperCase();
    if (SAFE_METHODS.has(method)) return original(input, init);

    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    if (!isSameOrigin(url)) return original(input, init);

    const headers = new Headers(init?.headers || (input instanceof Request ? input.headers : undefined));
    if (!headers.has(HEADER)) {
      const token = readToken();
      if (token) headers.set(HEADER, token);
    }

    return original(input, { ...init, headers });
  };
}
