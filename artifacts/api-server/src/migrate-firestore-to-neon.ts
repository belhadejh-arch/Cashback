import { pool } from "@workspace/db";
import {
  CashbackError,
  getNeonDocument,
  importFirestoreDocumentToNeon,
  listFirestoreCollection,
  markFirestoreImportComplete,
} from "./lib/cashback-firestore";

const collections = ["cashback", "users", "photos"] as const;

async function migrate(): Promise<void> {
  if (await getNeonDocument("system/firestore_import_complete")) {
    throw new CashbackError(409, "NEON_MIGRATION_ALREADY_MARKED");
  }

  const counts: Record<string, number> = {
    cashback: 0,
    users: 0,
    photos: 0,
    inserted: 0,
    unchanged: 0,
  };
  let stateFound = false;

  for (const collection of collections) {
    const documents = await listFirestoreCollection(collection);
    counts[collection] = documents.length;
    for (const document of documents) {
      if (document.name?.endsWith("/documents/cashback/state")) stateFound = true;
      const result = await importFirestoreDocumentToNeon(document);
      counts[result] += 1;
    }
  }

  if (!stateFound) throw new CashbackError(409, "FIRESTORE_STATE_MISSING");
  await markFirestoreImportComplete(counts);
  console.log(JSON.stringify({ status: "complete", counts }));
}

try {
  await migrate();
} catch (error) {
  const code =
    error instanceof CashbackError
      ? error.code
      : error && typeof error === "object" && "code" in error
        ? String((error as { code?: unknown }).code ?? "UNKNOWN")
        : "UNKNOWN";
  console.error(`FIRESTORE_TO_NEON_MIGRATION_FAILED:${code}`);
  process.exitCode = 1;
} finally {
  await pool.end();
}
