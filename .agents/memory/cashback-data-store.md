---
name: Preserve CASH BACK data
description: Database boundaries and data-safety requirements for the CASH BACK project.
---

Preserve the existing CASH BACK database, stored records, and functions. Do not delete existing data or replace/migrate the database without explicit approval.

**Why:** The user explicitly requires maintaining the current project and its data, and prohibits deletion or database replacement without consent.

**How to apply:** Add server-side capabilities to the current persistence layer; any destructive data changes or database migration require explicit user approval first.
