---
name: Starship live-phase access
description: Consistent status and permission rules for participants using the Starship workshop board.
---

When a facilitator advances a live workshop, the workspace’s status must record the selected phase. Starship participant actions—creating an idea, placing it, and returning it to the tray—must all be governed by the same rule: allow them while the workspace is open, in ideation, or in Starship.

**Why:** Treating phase navigation as a WebSocket-only event left the stored workspace state unchanged. Different endpoints then disagreed about whether participants could act: a person could see Starship but be blocked from adding or positioning an entry.

**How to apply:** Any future Starship interaction endpoint should reuse the shared participation predicate rather than introducing a separate status comparison. When adding live modules, ensure facilitator navigation persists a compatible workspace phase before relying on server-side access checks.