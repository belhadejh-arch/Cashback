import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

const neonDatabaseUrl =
  process.env.NODE_ENV === "production"
    ? process.env.NEON_DATABASE_URL
    : process.env.NEON_DEV_DATABASE_URL;

if (!neonDatabaseUrl) {
  throw new Error(
    process.env.NODE_ENV === "production"
      ? "NEON_DATABASE_URL must be set for the production database."
      : "NEON_DEV_DATABASE_URL must be set for the development database.",
  );
}

export const pool = new Pool({
  connectionString: neonDatabaseUrl,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
});
export const db = drizzle(pool, { schema });

export * from "./schema";
