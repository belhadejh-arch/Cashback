import { bigint, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const cashbackDocuments = pgTable("cashback_documents", {
  path: text("path").primaryKey(),
  body: jsonb("body").$type<Record<string, unknown>>().notNull(),
  revision: bigint("revision", { mode: "number" }).notNull().default(1),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
