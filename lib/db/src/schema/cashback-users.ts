import { boolean, jsonb, text, timestamp, pgTable } from "drizzle-orm/pg-core";

export const cashbackUsers = pgTable("users", {
  id: text("id").primaryKey(),
  role: text("role").notNull(),
  entityId: text("entity_id").notNull(),
  email: text("email"),
  phone: text("phone"),
  name: text("name"),
  status: text("status").notNull().default("active"),
  passwordSalt: text("password_salt"),
  passwordHash: text("password_hash"),
  preferences: jsonb("preferences").$type<Record<string, unknown>>().notNull().default({}),
  record: jsonb("record").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const cashbackCustomers = pgTable("customers", {
  id: text("id").primaryKey(),
  userId: text("user_id").references(() => cashbackUsers.id, { onDelete: "restrict" }),
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone"),
  status: text("status").notNull().default("active"),
  record: jsonb("record").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const cashbackAdminUsers = pgTable("admin_users", {
  userId: text("user_id").primaryKey().references(() => cashbackUsers.id, { onDelete: "restrict" }),
  role: text("role").notNull().default("admin"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
