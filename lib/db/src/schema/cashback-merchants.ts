import { jsonb, numeric, text, timestamp, integer, boolean, pgTable } from "drizzle-orm/pg-core";
import { cashbackUsers } from "./cashback-users";

export const cashbackMerchantCategories = pgTable("merchant_categories", {
  key: text("key").primaryKey(),
  name: text("name").notNull(),
  active: boolean("active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  record: jsonb("record").$type<Record<string, unknown>>().notNull().default({}),
});

export const cashbackMerchants = pgTable("merchants", {
  id: text("id").primaryKey(),
  userId: text("user_id").references(() => cashbackUsers.id, { onDelete: "restrict" }),
  name: text("name").notNull(),
  status: text("status").notNull().default("pending"),
  country: text("country"),
  city: text("city"),
  categoryKey: text("category_key").references(() => cashbackMerchantCategories.key, { onDelete: "set null" }),
  phone: text("phone"),
  publicId: text("public_id").unique(),
  qrValue: text("qr_value").unique(),
  cashbackRate: numeric("cashback_rate", { precision: 8, scale: 4 }).notNull().default("4"),
  platformCommissionRate: numeric("platform_commission_rate", { precision: 8, scale: 4 }).notNull().default("2"),
  record: jsonb("record").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const cashbackMerchantLocations = pgTable("merchant_locations", {
  merchantId: text("merchant_id").primaryKey().references(() => cashbackMerchants.id, { onDelete: "restrict" }),
  country: text("country"),
  city: text("city"),
  address: text("address"),
  mapsUrl: text("maps_url"),
  latitude: numeric("latitude", { precision: 10, scale: 7 }),
  longitude: numeric("longitude", { precision: 10, scale: 7 }),
  openingHours: jsonb("opening_hours").$type<Record<string, unknown>>().notNull().default({}),
  record: jsonb("record").$type<Record<string, unknown>>().notNull().default({}),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const cashbackMerchantJoinRequests = pgTable("merchant_join_requests", {
  id: text("id").primaryKey(),
  merchantId: text("merchant_id").notNull().unique().references(() => cashbackMerchants.id, { onDelete: "restrict" }),
  status: text("status").notNull(),
  rejectionReason: text("rejection_reason"),
  submittedAt: timestamp("submitted_at", { withTimezone: true }),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  record: jsonb("record").$type<Record<string, unknown>>().notNull().default({}),
});
