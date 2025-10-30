import type { Space } from "@shared/schema";

export type PhaseType = "ideation" | "voting" | "ranking" | "marketplace";

export type PhaseStatus = "not-scheduled" | "upcoming" | "active" | "ended";

interface PhaseTimeWindow {
  startsAt: Date | null | undefined;
  endsAt: Date | null | undefined;
}

export function getPhaseStatus(
  sessionMode: string,
  phase: PhaseTimeWindow
): PhaseStatus {
  // In live mode, phases are always active (controlled manually by facilitator)
  if (sessionMode === "live") {
    return "active";
  }

  // In async mode, check time windows
  if (!phase.startsAt || !phase.endsAt) {
    return "not-scheduled";
  }

  const now = new Date();
  const start = new Date(phase.startsAt);
  const end = new Date(phase.endsAt);

  if (now < start) return "upcoming";
  if (now >= start && now <= end) return "active";
  return "ended";
}

export function isPhaseActive(
  space: Space,
  phaseType: PhaseType
): boolean {
  // Check time windows for all session modes
  // For live mode, facilitators can enable phases by setting time windows
  const phase = getPhaseTimeWindow(space, phaseType);
  
  // If no time window is set, phase is not active
  if (!phase.startsAt || !phase.endsAt) {
    return false;
  }

  const now = new Date();
  const start = new Date(phase.startsAt);
  const end = new Date(phase.endsAt);

  // Phase is active if current time is within the window
  return now >= start && now <= end;
}

export function getPhaseTimeWindow(
  space: Space,
  phaseType: PhaseType
): PhaseTimeWindow {
  switch (phaseType) {
    case "ideation":
      return {
        startsAt: space.ideationStartsAt,
        endsAt: space.ideationEndsAt,
      };
    case "voting":
      return {
        startsAt: space.votingStartsAt,
        endsAt: space.votingEndsAt,
      };
    case "ranking":
      return {
        startsAt: space.rankingStartsAt,
        endsAt: space.rankingEndsAt,
      };
    case "marketplace":
      return {
        startsAt: space.marketplaceStartsAt,
        endsAt: space.marketplaceEndsAt,
      };
  }
}

export function getTimeRemaining(endTime: Date | null | undefined): string {
  if (!endTime) return "";

  const now = new Date();
  const end = new Date(endTime);
  const diff = end.getTime() - now.getTime();

  if (diff <= 0) return "Ended";

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  if (days > 0) return `${days}d ${hours}h remaining`;
  if (hours > 0) return `${hours}h ${minutes}m remaining`;
  return `${minutes}m remaining`;
}

export function formatPhaseWindow(
  startsAt: Date | null | undefined,
  endsAt: Date | null | undefined
): string {
  if (!startsAt || !endsAt) return "Not scheduled";

  const start = new Date(startsAt);
  const end = new Date(endsAt);

  const dateOptions: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  };

  return `${start.toLocaleString(undefined, dateOptions)} - ${end.toLocaleString(undefined, dateOptions)}`;
}
