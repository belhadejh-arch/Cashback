import { defineConfig } from "drizzle-kit";
import path from "path";

if (!process.env.NEON_DEV_DATABASE_URL) {
  throw new Error("NEON_DEV_DATABASE_URL must be set to manage the development Neon schema");
}

export default defineConfig({
  schema: path.join(__dirname, "./src/schema/index.ts"),
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.NEON_DEV_DATABASE_URL,
  },
});
