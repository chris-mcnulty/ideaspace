import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Read the CSRF token cookie set by the server's csrfMiddleware. Returns
 * undefined when the cookie isn't present (e.g. before first request or in
 * non-browser environments).
 */
function readCsrfToken(): string | undefined {
  if (typeof document === "undefined") return undefined;
  const match = document.cookie.match(/(?:^|; )csrf-token=([^;]+)/);
  if (!match) return undefined;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return undefined;
  }
}

function urlFromInput(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

function isSameOrigin(url: string): boolean {
  if (typeof window === "undefined") return true;
  if (url.startsWith("/") && !url.startsWith("//")) return true;
  try {
    const u = new URL(url, window.location.href);
    return u.origin === window.location.origin;
  } catch {
    return false;
  }
}

/**
 * fetch wrapper that injects credentials and the CSRF token header on
 * mutating same-origin requests. Cross-origin destinations pass through
 * untouched so we don't leak the token to third parties. Use this for any
 * direct fetch in the app.
 */
export async function csrfFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
): Promise<Response> {
  // When `input` is a Request, its own method/headers must be honored even
  // when `init.method` is unset, otherwise mutating Request POSTs would be
  // misdetected as GET.
  const method = (
    init.method ||
    (input instanceof Request ? input.method : "GET")
  ).toUpperCase();
  const url = urlFromInput(input);
  const sameOrigin = isSameOrigin(url);

  if (SAFE_METHODS.has(method) || !sameOrigin) {
    return fetch(input, {
      ...init,
      credentials: init.credentials ?? (sameOrigin ? "include" : init.credentials),
    });
  }

  const headers = new Headers(
    init.headers || (input instanceof Request ? input.headers : undefined),
  );
  const token = readCsrfToken();
  if (token && !headers.has("X-CSRF-Token")) {
    headers.set("X-CSRF-Token", token);
  }
  return fetch(input, {
    credentials: "include",
    ...init,
    headers,
  });
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const res = await csrfFetch(url, {
    method,
    headers: data ? { "Content-Type": "application/json" } : undefined,
    body: data ? JSON.stringify(data) : undefined,
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await csrfFetch(queryKey.join("/") as string);

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
