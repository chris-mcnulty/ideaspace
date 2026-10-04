// Active phase statuses remain participation-enabled, even when navigation
// replaces the general "open" status with the selected phase.
export function isWorkspaceOpenForParticipation(status: string): boolean {
  if (!status) return false;
  const normalized = status.toLowerCase().trim();
  if (normalized === "open") return true;
  if (["closed", "draft", "processing", "archived"].includes(normalized)) return false;
  const activePhasePrefixes = [
    "ideation", "ideate", "voting", "vote", "ranking", "rank",
    "marketplace", "market", "survey", "priority-matrix", "priority",
    "staircase", "starship", "signal", "results",
  ];
  return activePhasePrefixes.some(prefix => normalized.startsWith(prefix));
}