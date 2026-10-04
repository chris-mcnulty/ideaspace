---
name: Live note deletion constraints
description: Production database constraints can differ from the declared schema when deleting workshop entries.
---

Inspect the actual deployed foreign-key constraints before assuming dependent workshop data will automatically disappear when an entry is deleted. Any explicit dependent cleanup must be atomic with the entry deletion.

**Why:** On 2026-10-04, production used automatic deletion for several dependent activity records despite declarations without that behavior in the shared schema, while survey answers still blocked deletion. The declared schema alone was not a reliable description of live deletion behavior.

**How to apply:** Use read-only production constraint inspection when diagnosing deletion failures. Preserve all-or-nothing cleanup and do not introduce production schema changes merely to match an assumption about cascading behavior.