---
name: Merchant-scoped customer rewards
description: Financial isolation rules for customer reward balances and redemptions.
---

Customer cashback is a non-cash reward balance scoped to the merchant that issued it. A redemption must be explicitly tied to that merchant and may only debit that merchant's customer balance; the customer cannot transfer, withdraw, or spend it elsewhere. Do not treat a customer-wide aggregate total as spendable.

**Why:** The user requires separate per-shop balances, no cash-out or transfer for customers, and direct accounting of each reward earning and use.

**How to apply:** Keep the issuing merchant ID on every earning and redemption record, validate and update only that merchant-scoped balance in the backend transaction, and show each merchant's earned/used history separately in the customer wallet.

QR is the customer's primary way to spend cashback. A QR payment must be bound server-side to the authenticated customer and the issuing merchant through a short-lived, single-use session. The customer chooses an amount; confirming it atomically debits that shop's customer balance and credits the merchant's payment balance. Admin reversals must restore/debit the corresponding balances and retain an audit record.

**Why:** The user requires QR-based in-store payment, explicit amount confirmation, protection from replay, atomic transfer, and administrator-controlled reversals with an audit trail.

**How to apply:** Never trust merchant IDs or QR payloads supplied by the client without resolving them against the active merchant record. Consume the session and write both sides of the ledger in one Neon transaction; store a unique reference and preserve reversal history.

Merchant top-up funds, QR proceeds, customer rewards, platform fees, and reserved withdrawals are distinct balances. Only available QR proceeds may fund a merchant withdrawal; a pending request reserves that amount until paid or rejected.

**Why:** The user requires separate merchant financial accounts and prohibits treating top-ups, customer rewards, or unsettled amounts as withdrawable proceeds.

**How to apply:** Keep ledger balances distinct in the backend and dashboard. Reserve withdrawals atomically from QR proceeds, release them on rejection, and do not include top-up balance in the withdrawal limit.

When an approved invoice creates a reward and platform fee that exceed available merchant funding, approve the invoice and credit the customer reward, but retain the unpaid obligation as due. Future approved top-ups settle due entries oldest-first, applying funds to the reward component before the platform fee. QR redemption changes the customer balance and merchant QR proceeds; it must not create a second commission charge. Withdrawable QR proceeds are reduced by outstanding merchant obligations.

**Why:** The user chose to accept valid invoices and record the unfunded amount as a debt for later settlement. Reward-first settlement protects the customer reward balance, while separating QR proceeds prevents counting the same invoice obligation twice.

**How to apply:** Keep invoice rate snapshots and separate reward/fee outstanding amounts. Apply top-up settlements atomically, and use outstanding obligations when calculating merchant withdrawal availability.
