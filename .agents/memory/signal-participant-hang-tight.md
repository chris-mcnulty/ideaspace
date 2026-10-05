---
name: Signal participant hang-tight after WS drop
description: Participants stuck on "Hang tight" when WS drops due to proxy idle-timeout (close code 1000)
---

## Rule
Three fixes must all be in place for reliable Signal participant experience:
1. **`useWebSocket` close code 1000 must NOT be terminal** — load balancers/reverse proxies send 1000 on idle timeout. Removing it from `terminalCloseCodes` lets the client reconnect automatically.
2. **`useSignalRealtime` must invalidate on WS reconnect** — `onOpen: ({ reconnected }) => { if (reconnected) invalidateQueries(signalKey) }` immediately re-syncs the deck state after a drop.
3. **`useSignalDeck` polling fallback** — `refetchInterval: 5000` on participant/presenter/embed pages so they recover within 5 s even if WS never reconnects.

**Why:** Without these, a participant whose WS drops between "activity goes live" and "page is focused" will never receive the `signal_activity_changed` broadcast and will stay on the "Hang tight" waiting card indefinitely.

**How to apply:** Any new page that needs live Signal state (participant view, presenter, embed) should call `useSignalDeck(spaceId, { refetchInterval: 5000 })` and must call `useSignalRealtime` which handles the `onOpen` re-sync. The facilitator does NOT use `refetchInterval` to avoid racing with optimistic updates.

## Distinguish access failures from realtime failures

When anonymous participants report that an already-live question has not started, check the anonymous API response and workspace guest permissions before attributing the symptom to sequencing or WebSockets.

**Why:** A production report following reordering coincided with a valid live deck but a guest-disabled workspace. The participant screen had hidden the rejected request behind its waiting state, while the facilitator could still see the question because their access bypassed guest restrictions.

**How to apply:** Verify both stored live state and participant access. Signed-in facilitator testing alone cannot establish that anonymous participants can load the question. Confirm the affected workspace before changing permissions.

Recover stale participant access through an explicit rejoin, rather than silently clearing session identity or bypassing workspace authorization.

**Why:** A clean anonymous browser can succeed while an existing participant session fails. That distinction is not proof of the specific affected browser's error; preserve access checks and expose the actual failure instead of claiming the live state is broken.

**How to apply:** Compare fresh and existing-session access, keep error states separate from waiting states, and preserve the destination module when rejoining.
