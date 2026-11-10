import { jsonb, numeric, text, timestamp, pgTable, primaryKey, uniqueIndex, index } from "drizzle-orm/pg-core";
import { cashbackCustomers } from "./cashback-users";
import { cashbackInvoices } from "./cashback-invoices";
import { cashbackMerchants } from "./cashback-merchants";

export const cashbackAccounts = pgTable("cashback_accounts", {
  customerId: text("customer_id").notNull().references(() => cashbackCustomers.id, { onDelete: "restrict" }),
  merchantId: text("merchant_id").notNull().references(() => cashbackMerchants.id, { onDelete: "restrict" }),
  balance: numeric("balance", { precision: 14, scale: 2 }).notNull().default("0"),
  earnedTotal: numeric("earned_total", { precision: 14, scale: 2 }).notNull().default("0"),
  usedTotal: numeric("used_total", { precision: 14, scale: 2 }).notNull().default("0"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [primaryKey({ columns: [table.customerId, table.merchantId] })]);

export const cashbackWallets = pgTable("wallets", {
  merchantId: text("merchant_id").primaryKey().references(() => cashbackMerchants.id, { onDelete: "restrict" }),
  currency: text("currency").notNull(),
  fundedBalance: numeric("funded_balance", { precision: 14, scale: 2 }).notNull().default("0"),
  payoutBalance: numeric("payout_balance", { precision: 14, scale: 2 }).notNull().default("0"),
  reservedWithdrawalBalance: numeric("reserved_withdrawal_balance", { precision: 14, scale: 2 }).notNull().default("0"),
  commissionDue: numeric("commission_due", { precision: 14, scale: 2 }).notNull().default("0"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const cashbackPayments = pgTable("payments", {
  id: text("id").primaryKey(),
  reference: text("reference").notNull().unique(),
  sessionId: text("session_id").unique(),
  customerId: text("customer_id").notNull().references(() => cashbackCustomers.id, { onDelete: "restrict" }),
  merchantId: text("merchant_id").notNull().references(() => cashbackMerchants.id, { onDelete: "restrict" }),
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
  currency: text("currency").notNull(),
  status: text("status").notNull(),
  kind: text("kind").notNull().default("qr_redemption"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  record: jsonb("record").$type<Record<string, unknown>>().notNull().default({}),
}, (table) => [
  index("payments_customer_created_idx").on(table.customerId, table.createdAt),
  index("payments_merchant_created_idx").on(table.merchantId, table.createdAt),
]);

export const cashbackTransactions = pgTable("cashback_transactions", {
  id: text("id").primaryKey(),
  customerId: text("customer_id").notNull().references(() => cashbackCustomers.id, { onDelete: "restrict" }),
  merchantId: text("merchant_id").notNull().references(() => cashbackMerchants.id, { onDelete: "restrict" }),
  invoiceId: text("invoice_id").references(() => cashbackInvoices.id, { onDelete: "restrict" }),
  paymentId: text("payment_id").references(() => cashbackPayments.id, { onDelete: "restrict" }),
  kind: text("kind").notNull(),
  status: text("status").notNull().default("posted"),
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
  currency: text("currency").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  record: jsonb("record").$type<Record<string, unknown>>().notNull().default({}),
}, (table) => [
  index("cashback_transactions_account_idx").on(table.customerId, table.merchantId, table.createdAt),
]);

export const cashbackWalletTransactions = pgTable("wallet_transactions", {
  id: text("id").primaryKey(),
  merchantId: text("merchant_id").notNull().references(() => cashbackMerchants.id, { onDelete: "restrict" }),
  kind: text("kind").notNull(),
  direction: text("direction").notNull(),
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
  currency: text("currency").notNull(),
  status: text("status").notNull(),
  reference: text("reference"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  record: jsonb("record").$type<Record<string, unknown>>().notNull().default({}),
}, (table) => [index("wallet_transactions_merchant_created_idx").on(table.merchantId, table.createdAt)]);

export const cashbackMerchantTopups = pgTable("merchant_topups", {
  id: text("id").primaryKey(),
  merchantId: text("merchant_id").notNull().references(() => cashbackMerchants.id, { onDelete: "restrict" }),
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
  currency: text("currency").notNull(),
  status: text("status").notNull(),
  paymentMethodId: text("payment_method_id"),
  receiptPath: text("receipt_path"),
  rejectionReason: text("rejection_reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  record: jsonb("record").$type<Record<string, unknown>>().notNull().default({}),
});

export const cashbackMerchantWithdrawals = pgTable("merchant_withdrawals", {
  id: text("id").primaryKey(),
  merchantId: text("merchant_id").notNull().references(() => cashbackMerchants.id, { onDelete: "restrict" }),
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
  currency: text("currency").notNull(),
  status: text("status").notNull(),
  method: text("method"),
  payoutDetails: jsonb("payout_details").$type<Record<string, unknown>>().notNull().default({}),
  transferReference: text("transfer_reference"),
  transferProofPath: text("transfer_proof_path"),
  rejectionReason: text("rejection_reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  record: jsonb("record").$type<Record<string, unknown>>().notNull().default({}),
});

export const cashbackCommissions = pgTable("commissions", {
  id: text("id").primaryKey(),
  invoiceId: text("invoice_id").references(() => cashbackInvoices.id, { onDelete: "restrict" }),
  customerId: text("customer_id").references(() => cashbackCustomers.id, { onDelete: "restrict" }),
  merchantId: text("merchant_id").notNull().references(() => cashbackMerchants.id, { onDelete: "restrict" }),
  invoiceAmount: numeric("invoice_amount", { precision: 14, scale: 2 }).notNull().default("0"),
  cashbackAmount: numeric("cashback_amount", { precision: 14, scale: 2 }).notNull().default("0"),
  platformAmount: numeric("platform_amount", { precision: 14, scale: 2 }).notNull().default("0"),
  dueAmount: numeric("due_amount", { precision: 14, scale: 2 }).notNull().default("0"),
  settledAmount: numeric("settled_amount", { precision: 14, scale: 2 }).notNull().default("0"),
  currency: text("currency").notNull(),
  status: text("status").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  record: jsonb("record").$type<Record<string, unknown>>().notNull().default({}),
});
