---
name: Merchant-scoped customer rewards
description: Financial isolation rules for customer reward balances and redemptions.
---

Customer cashback is a non-cash reward balance scoped to the merchant that issued it. A redemption must be explicitly tied to that merchant and may only debit that merchant's customer balance; the customer cannot transfer, withdraw, or spend it elsewhere. Do not treat a customer-wide aggregate total as spendable.

**Why:** The user requires separate per-shop balances, no cash-out or transfer for customers, and direct accounting of each reward earning and use.

**How to apply:** Keep the issuing merchant ID on every earning and redemption record, validate and update only that merchant-scoped balance in the backend transaction, and show each merchant's earned/used history separately in the customer wallet.
