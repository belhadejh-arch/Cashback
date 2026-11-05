---
name: Preserve CASH BACK data
description: Database boundaries and data-safety requirements for the CASH BACK project.
---

Leave existing Firestore records untouched, but run the active CASH BACK app on Neon with fresh data. Do not migrate or delete Firestore records unless the user asks.

New accounts use email and password stored in Neon. Do not use Firebase authentication or SMS verification.

**Why:** The user chose Neon as the only active database, selected a fresh start instead of importing existing records, and chose email/password instead of SMS.

**How to apply:** Keep the old Firestore data as an untouched archive; do not connect the running app to Firebase or attempt an import. Future password recovery requires an email delivery provider.
