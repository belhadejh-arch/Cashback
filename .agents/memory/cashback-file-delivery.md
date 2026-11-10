---
name: CASH BACK file delivery
description: File export and sharing behavior for browser and Median.co WebView.
---

Use the Web Share API with file payloads when supported, and fall back to a Blob download for PDF, spreadsheet, CSV, and QR exports. Keep customer invoices and other private media behind authenticated routes; do not create public share links for them.

**Why:** The user plans to run CASH BACK inside a Median.co WebView, where browser download and native share support can vary.

**How to apply:** Preserve both native file sharing and a browser download path for generated exports, and verify behavior in the Median wrapper before promising native behavior.
