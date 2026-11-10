import { boolean, jsonb, text, timestamp, pgTable, index } from "drizzle-orm/pg-core";

export const cashbackPaymentMethods = pgTable("payment_methods", {
  id: text("id").primaryKey(),
  country: text("country").notNull(),
  currency: text("currency").notNull(),
  name: text("name").notNull(),
  beneficiary: text("beneficiary"),
  bankName: text("bank_name"),
  accountNumber: text("account_number"),
  ccpNumber: text("ccp_number"),
  phone: text("phone"),
  instructions: text("instructions"),
  active: boolean("active").notNull().default(true),
  record: jsonb("record").$type<Record<string, unknown>>().notNull().default({}),
});

export const cashbackNotifications = pgTable("notifications", {
  id: text("id").primaryKey(),
  recipientId: text("recipient_id").notNull(),
  recipientRole: text("recipient_role").notNull(),
  kind: text("kind").notNull(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  read: boolean("read").notNull().default(false),
  readAt: timestamp("read_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  record: jsonb("record").$type<Record<string, unknown>>().notNull().default({}),
}, (table) => [index("notifications_recipient_created_idx").on(table.recipientId, table.createdAt)]);

export const cashbackAuditLogs = pgTable("audit_logs", {
  id: text("id").primaryKey(),
  actorUid: text("actor_uid"),
  actorRole: text("actor_role"),
  action: text("action").notNull(),
  resourceType: text("resource_type"),
  resourceId: text("resource_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  details: jsonb("details").$type<Record<string, unknown>>().notNull().default({}),
}, (table) => [
  index("audit_logs_actor_created_idx").on(table.actorUid, table.createdAt),
  index("audit_logs_resource_idx").on(table.resourceType, table.resourceId),
]);

export const cashbackAppSettings = pgTable("app_settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").$type<Record<string, unknown>>().notNull().default({}),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
