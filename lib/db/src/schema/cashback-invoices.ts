import { jsonb, numeric, text, timestamp, date, pgTable, index, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { cashbackCustomers, cashbackUsers } from "./cashback-users";
import { cashbackMerchants } from "./cashback-merchants";

export const cashbackInvoices = pgTable("invoices", {
  id: text("id").primaryKey(),
  customerId: text("customer_id").notNull().references(() => cashbackCustomers.id, { onDelete: "restrict" }),
  merchantId: text("merchant_id").notNull().references(() => cashbackMerchants.id, { onDelete: "restrict" }),
  invoiceNumber: text("invoice_number"),
  invoiceDate: date("invoice_date"),
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
  currency: text("currency").notNull(),
  status: text("status").notNull(),
  cashbackAmount: numeric("cashback_amount", { precision: 14, scale: 2 }).notNull().default("0"),
  imagePath: text("image_path"),
  imageHash: text("image_hash"),
  submitterIp: text("submitter_ip"),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  rejectionReason: text("rejection_reason"),
  record: jsonb("record").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("invoices_merchant_number_unique")
    .on(table.merchantId, table.invoiceNumber)
    .where(sql`${table.invoiceNumber} IS NOT NULL AND ${table.invoiceNumber} <> ''`),
  index("invoices_customer_created_idx").on(table.customerId, table.createdAt),
  index("invoices_merchant_created_idx").on(table.merchantId, table.createdAt),
]);

export const cashbackInvoiceVerifications = pgTable("invoice_verifications", {
  id: text("id").primaryKey(),
  invoiceId: text("invoice_id").notNull().references(() => cashbackInvoices.id, { onDelete: "restrict" }),
  reviewerUserId: text("reviewer_user_id").references(() => cashbackUsers.id, { onDelete: "set null" }),
  status: text("status").notNull(),
  reason: text("reason"),
  duplicateDetails: jsonb("duplicate_details").$type<Record<string, unknown>>().notNull().default({}),
  checkedAt: timestamp("checked_at", { withTimezone: true }).notNull().defaultNow(),
});
