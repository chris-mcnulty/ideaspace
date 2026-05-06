import { createHash } from "crypto";
import { log } from "../vite";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface IngestPageviewRow {
  sessionKey: string;
  path: string;
  title?: string;
  viewedAt: string;
  pageviewCount?: number;
  timeOnPageMs?: number;
  pageType?: string;
  referrerUrl?: string;
  referrerHost?: string;
  trafficSource?: string;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  country?: string;
  region?: string;
  city?: string;
  deviceType?: string;
  browserName?: string;
  browserVersion?: string;
  osName?: string;
}

export interface IngestSessionRow {
  sessionKey: string;
  startedAt: string;
  country?: string;
  deviceType?: string;
}

// ── Config ────────────────────────────────────────────────────────────────────

const BASE_URL = process.env.SYNOZUR_TRAFFIC_BASE_URL?.replace(/\/$/, "");
const API_KEY  = process.env.SYNOZUR_TRAFFIC_API_KEY;

const FLUSH_INTERVAL_MS = parseInt(
  process.env.SYNOZUR_TRAFFIC_FLUSH_INTERVAL_MS || "30000",
  10,
);
const BUFFER_LIMIT = 10_000;
const BATCH_SIZE   = 2_000;

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Build a deterministic, PII-free session key for a participant visit.
 * Format: neb_<workspaceCode>_<sha256(participantId).slice(0,16)>
 */
export function buildSessionKey(workspaceCode: string, participantId: string): string {
  const hash = createHash("sha256").update(participantId).digest("hex").slice(0, 16);
  return `neb_${workspaceCode}_${hash}`;
}

/** Coarse device-type from User-Agent. Marks known crawlers as "bot". */
export function detectDeviceType(ua: string): "desktop" | "mobile" | "tablet" | "bot" {
  if (!ua) return "desktop";
  const l = ua.toLowerCase();
  if (/bot|crawl|spider|headless|slurp|facebookexternalhit|semrush|ahrefsbot|bytespider/.test(l)) return "bot";
  if (/tablet|ipad/.test(l)) return "tablet";
  if (/mobile|android(?!.*tablet)|iphone|ipod|windows phone/.test(l)) return "mobile";
  return "desktop";
}

/** Coarse browser name from User-Agent. */
export function detectBrowser(ua: string): { name: string; version: string } | null {
  if (!ua) return null;
  const matchers: [RegExp, string][] = [
    [/Edg\/(\S+)/,         "Edge"],
    [/OPR\/(\S+)/,         "Opera"],
    [/Chrome\/(\S+)/,      "Chrome"],
    [/Firefox\/(\S+)/,     "Firefox"],
    [/Safari\/\S+ Version\/(\S+)/, "Safari"],
  ];
  for (const [re, name] of matchers) {
    const m = ua.match(re);
    if (m) return { name, version: m[1].split(".")[0] };
  }
  return null;
}

/** Coarse OS name from User-Agent. */
export function detectOS(ua: string): string | null {
  if (!ua) return null;
  if (/Windows NT/.test(ua)) return "Windows";
  if (/Mac OS X/.test(ua))   return "macOS";
  if (/Android/.test(ua))    return "Android";
  if (/iPhone|iPad|iPod/.test(ua)) return "iOS";
  if (/Linux/.test(ua))      return "Linux";
  return null;
}

// ── Buffer ────────────────────────────────────────────────────────────────────

const pageviewBuffer: IngestPageviewRow[] = [];
const sessionBuffer:  IngestSessionRow[]  = [];

export function enqueuePageview(row: IngestPageviewRow): void {
  if (!BASE_URL || !API_KEY) return;
  if (pageviewBuffer.length >= BUFFER_LIMIT) {
    log("synozur traffic buffer overflow — dropping oldest", "traffic");
    pageviewBuffer.shift();
  }
  pageviewBuffer.push(row);
}

export function enqueueSession(row: IngestSessionRow): void {
  if (!BASE_URL || !API_KEY) return;
  sessionBuffer.push(row);
}

// ── HTTP post with retry ──────────────────────────────────────────────────────

let workerPaused = false;

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function postBatch(
  pageviews: IngestPageviewRow[],
  sessions:  IngestSessionRow[],
  attempt = 0,
): Promise<void> {
  const body = JSON.stringify({
    pageviews,
    ...(sessions.length ? { sessions } : {}),
  });

  const controller = new AbortController();
  const reqTimeout = setTimeout(() => controller.abort(), 15_000);

  try {
    const res = await fetch(`${BASE_URL}/api/traffic/ingest`, {
      method: "POST",
      headers: {
        Authorization:   `Bearer ${API_KEY}`,
        "Content-Type":  "application/json",
      },
      body,
      signal: controller.signal,
    });
    clearTimeout(reqTimeout);

    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      log(
        `synozur traffic flush sent=${pageviews.length} accepted=${data.accepted ?? "?"} ` +
        `duplicates=${data.duplicates ?? 0} errors=${data.errors ?? 0}`,
        "traffic",
      );
      return;
    }

    if (res.status === 400) {
      const preview = body.slice(0, 400);
      log(`synozur traffic ingest 400 bad row shape — dropping batch. Payload prefix: ${preview}`, "traffic");
      return;
    }

    if (res.status === 401) {
      const prefix = API_KEY ? API_KEY.slice(0, 6) + "…" : "(empty)";
      log(`synozur traffic ingest 401 invalid key (${prefix}) — worker paused until restart`, "traffic");
      workerPaused = true;
      return;
    }

    if (res.status === 403) {
      log("synozur traffic ingest 403 property slug mismatch — dropping batch", "traffic");
      return;
    }

    if (res.status === 429) {
      log("synozur traffic ingest 429 rate limited — backing off 30s", "traffic");
      await sleep(30_000);
      return postBatch(pageviews, sessions, attempt + 1);
    }

    // 5xx or unexpected
    if (attempt < 10) {
      const delay = Math.min(1_000 * Math.pow(2, attempt), 60_000);
      log(`synozur traffic ingest ${res.status} — retry ${attempt + 1}/10 in ${delay}ms`, "traffic");
      await sleep(delay);
      return postBatch(pageviews, sessions, attempt + 1);
    }

    log(`synozur traffic ingest ${res.status} — max retries exceeded, dropping batch of ${pageviews.length}`, "traffic");

  } catch (err: any) {
    clearTimeout(reqTimeout);
    if (attempt < 10) {
      const delay = Math.min(1_000 * Math.pow(2, attempt), 60_000);
      log(`synozur traffic network error (${err?.message}) — retry ${attempt + 1}/10 in ${delay}ms`, "traffic");
      await sleep(delay);
      return postBatch(pageviews, sessions, attempt + 1);
    }
    log(`synozur traffic network error — max retries exceeded, dropping batch (${err?.message})`, "traffic");
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/** Drain the buffer and POST up to BATCH_SIZE rows immediately. */
export async function flushNow(): Promise<void> {
  if (!BASE_URL || !API_KEY || workerPaused) return;
  if (pageviewBuffer.length === 0 && sessionBuffer.length === 0) return;

  const pageviews = pageviewBuffer.splice(0, BATCH_SIZE);
  const sessions  = sessionBuffer.splice(0);
  await postBatch(pageviews, sessions);
}

let flushTimer: ReturnType<typeof setInterval> | null = null;

/** Start the periodic flush worker. Idempotent — safe to call once. */
export function startTrafficWorker(): void {
  if (!BASE_URL || !API_KEY) {
    log(
      "synozur traffic worker: SYNOZUR_TRAFFIC_BASE_URL or SYNOZUR_TRAFFIC_API_KEY not set — traffic ingest disabled",
      "traffic",
    );
    return;
  }

  log(
    `synozur traffic worker started intervalMs=${FLUSH_INTERVAL_MS} bufferLimit=${BUFFER_LIMIT}`,
    "traffic",
  );

  flushTimer = setInterval(async () => {
    if (workerPaused) return;
    try {
      await flushNow();
    } catch (err: any) {
      log(`synozur traffic worker unhandled error: ${err?.message}`, "traffic");
    }
  }, FLUSH_INTERVAL_MS);
}

/** Stop the flush timer (does NOT flush; call flushNow() first for shutdown). */
export function stopTrafficWorker(): void {
  if (flushTimer) {
    clearInterval(flushTimer);
    flushTimer = null;
  }
}
