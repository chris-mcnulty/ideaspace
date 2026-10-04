---
name: Live note deletion constraints
description: Production database constraints can differ from the declared schema when deleting workshop entries.
---

Inspect the actual deployed foreign-key constraints before assuming dependent workshop data will automatically disappear when an entry is deleted. Any explicit dependent cleanup must be atomic with the entry deletion.

**Why:** On 2026-10-04, production used automatic deletion for several dependent activity records despite declarations without that behavior in the shared schema, while survey answers still blocked deletion. The declared schema alone was not a reliable description of live deletion behavior.

**How to apply:** Use read-only production constraint inspection when diagnosing deletion failures. Preserve all-or-nothing cleanup and do not introduce production schema changes merely to match an assumption about cascading behavior.

## Apparent failure after a committed deletion

Do not infer that a note still exists in storage solely from a failure toast or a stale board. Separate persistence failure from UI confirmation failure before repeating a destructive operation.

**Why:** During the deletion investigation, Ideas Hub treated an empty successful deletion response as a failure and skipped refreshing its data. This produced an apparent permissions or persistence problem even when the server deletion succeeded.

**How to apply:** For reported deletion failures, check both the response handling and read-only record state. Include super-admin paths rather than assuming a facilitator authorization issue explains every account.