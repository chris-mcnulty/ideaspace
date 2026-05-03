import { randomBytes } from "crypto";

export type ImportJobKind = "user-invites";
export type ImportJobStatus = "pending" | "running" | "complete";

export interface ImportJob {
  id: string;
  kind: ImportJobKind;
  status: ImportJobStatus;
  total: number;
  processed: number;
  succeeded: number;
  failed: number;
  failures: { target: string; message: string }[];
  startedAt: number;
  finishedAt?: number;
  ownerUserId: string;
}

const JOBS = new Map<string, ImportJob>();
const MAX_JOBS_RETAINED = 100;
const JOB_TTL_MS = 1000 * 60 * 60 * 6; // 6 hours

function gc() {
  const now = Date.now();
  for (const [id, job] of Array.from(JOBS.entries())) {
    if (job.finishedAt && now - job.finishedAt > JOB_TTL_MS) {
      JOBS.delete(id);
    }
  }
  if (JOBS.size > MAX_JOBS_RETAINED) {
    const sorted = Array.from(JOBS.values()).sort(
      (a, b) => (a.finishedAt ?? a.startedAt) - (b.finishedAt ?? b.startedAt),
    );
    const toRemove = sorted.slice(0, JOBS.size - MAX_JOBS_RETAINED);
    for (const j of toRemove) JOBS.delete(j.id);
  }
}

export function createImportJob(kind: ImportJobKind, total: number, ownerUserId: string): ImportJob {
  gc();
  const id = randomBytes(12).toString("hex");
  const job: ImportJob = {
    id,
    kind,
    status: total > 0 ? "pending" : "complete",
    total,
    processed: 0,
    succeeded: 0,
    failed: 0,
    failures: [],
    startedAt: Date.now(),
    finishedAt: total > 0 ? undefined : Date.now(),
    ownerUserId,
  };
  JOBS.set(id, job);
  return job;
}

export function getImportJob(id: string): ImportJob | undefined {
  return JOBS.get(id);
}

export function markJobRunning(id: string) {
  const job = JOBS.get(id);
  if (job && job.status === "pending") job.status = "running";
}

export function recordJobSuccess(id: string) {
  const job = JOBS.get(id);
  if (!job) return;
  job.processed++;
  job.succeeded++;
}

export function recordJobFailure(id: string, target: string, message: string) {
  const job = JOBS.get(id);
  if (!job) return;
  job.processed++;
  job.failed++;
  if (job.failures.length < 50) job.failures.push({ target, message });
}

export function finishJob(id: string) {
  const job = JOBS.get(id);
  if (!job) return;
  job.status = "complete";
  job.finishedAt = Date.now();
}
