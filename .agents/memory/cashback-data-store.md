---
name: Preserve CASH BACK data
description: Database boundaries and data-safety requirements for the CASH BACK project.
---

Leave existing Firestore records untouched, but run the active CASH BACK app on Neon with fresh data. Do not migrate or delete Firestore records unless the user asks.

New accounts use email and password stored in Neon. Do not use Firebase authentication or SMS verification.

**Why:** The user chose Neon as the only active database, selected a fresh start instead of importing existing records, and chose email/password instead of SMS.

**How to apply:** Keep the old Firestore data as an untouched archive; do not connect the running app to Firebase or attempt an import. Future password recovery requires an email delivery provider.

New receipt photos go to private App Storage through a short-lived owner-bound upload. Neon stores receipt metadata and hashes, while the media endpoint keeps reading older inline photo records under the existing access checks.

**Why:** Receipt image bytes are larger than transactional data and should not grow the Neon JSON document store; existing receipts must remain readable.

**How to apply:** Verify uploaded receipt size and actual image type on the server, store only the object path and metadata in Neon, and preserve backward-compatible reads for previously stored images. Do not bulk-migrate old records unless requested.
