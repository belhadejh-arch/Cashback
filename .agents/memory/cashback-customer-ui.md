---
name: CASH BACK role navigation
description: The user's standing navigation and visual requirements for customer and merchant CASH BACK screens.
---

Use the user's attached CASH BACK mobile screen as the canonical reference for customer-facing UI: black/dark surfaces, orange-to-gold accents, rounded cards, Changa, Arabic RTL by default, and the customer profile/avatar at the top of the home screen. The home layout includes location/search, a cashback promotion, categories, participating shops, recent activity, and a bottom navigation bar. Each major section should open on its own screen; receipt capture and notifications must be full pages. Keep all receipt entry points visually consistent, use a logo-only centered home brand beside the profile/actions row, and label the Arabic wallet “محفظتي”. Keep dark/light and Arabic/English/French preferences applied across the app and persisted to the user's account.

**Why:** The user repeatedly made fidelity to the attached design mandatory and specified profile placement, theme/language behavior, independent receipt/notification pages, and consistent camera navigation. They clarified that “كل المتاجر” beside the home search should be reduced only within that filter, not by changing home section labels or globally forcing one text size.

**How to apply:** When changing customer screens, match the reference while retaining live backend data and working controls; do not invent shop ratings, balances, or activity to fill visual gaps. Use Changa, preserve the existing size hierarchy, and reduce only the home search-area filter text when needed to keep “كل المتاجر” fully visible. Route every receipt CTA to the same camera page and preserve shared camera control styling.

Active merchants use a separate five-item mobile bar: home, invoices, QR/payments, wallet, and more. Secondary merchant tools open on their own pages from More. Customers and administrators must not receive the merchant navigation or merchant-only routes.

**Why:** The user explicitly requires different navigation and permissions by account type, with a dedicated merchant bar and section pages.

**How to apply:** Keep customer and merchant navigation separate. Show the merchant workspace only for active merchant accounts; retain distinct customer and admin access rules.
