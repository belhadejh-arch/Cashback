import { createPublicKey, createSign, verify } from "node:crypto";
import type { Request } from "express";
import { pool } from "@workspace/db";

const PROJECT_ID = "studio-5817063024-c14a2";
const DOCUMENT_ROOT = `projects/${PROJECT_ID}/databases/(default)/documents`;
const FIRESTORE_URL = `https://firestore.googleapis.com/v1/${DOCUMENT_ROOT}`;
const ADMIN_EMAIL = "imadbenhamouda509@gmail.com";
const NEON_MIGRATION_MARKER = "system/firestore_import_complete";

export type CashbackRole = "customer" | "merchant" | "admin";
export type CashbackProfile = {
  uid: string;
  role: CashbackRole;
  eid: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  preferences?: { language?: "ar" | "en" | "fr"; theme?: "dark" | "light" };
};
export type CashbackState = Record<string, any>;
export type AuthenticatedRequest = Request & { cashbackProfile: CashbackProfile };

export class CashbackError extends Error {
  constructor(
    public status: number,
    public code: string,
  ) {
    super(code);
    this.name = "CashbackError";
  }
}

const emptyState = (): CashbackState => ({
  settings: { cashback: 4, claimHours: 720 },
  merchants: [],
  customers: [],
  claims: [],
  txns: [],
  cbpays: [],
  notes: [],
  audit: [],
});

function normalizeLegacyState(state: CashbackState): CashbackState {
  state.settings ??= {};
  state.settings.cashback ??= 4;
  state.settings.claimHours ??= 720;
  for (const key of ["merchants", "customers", "claims", "txns", "cbpays", "notes", "audit"]) {
    if (!Array.isArray(state[key])) state[key] = [];
  }
  state.merchants.forEach((merchant: any) => {
    merchant.status ??= "active";
    merchant.cat ??= "shops";
    if (!merchant.logoId && merchant.cover) merchant.logoId = `cover_${merchant.id}`;
  });
  state.customers.forEach((customer: any) => {
    customer.wallet = Number(customer.wallet ?? 0);
    if (customer.cbm) return;
    const earned: Record<string, number> = {};
    state.txns.forEach((transaction: any) => {
      if (transaction.cid === customer.id && Number(transaction.cashback) > 0) {
        earned[transaction.mid] = (earned[transaction.mid] ?? 0) + Number(transaction.cashback);
      }
    });
    state.cbpays.forEach((payment: any) => {
      if (payment.cid === customer.id && payment.status === "done") {
        earned[payment.mid] = (earned[payment.mid] ?? 0) - Number(payment.amount ?? 0);
      }
    });
    let remaining = customer.wallet;
    customer.cbm = {};
    for (const [merchantId, balance] of Object.entries(earned)) {
      const share = Math.min(Math.round(Number(balance) * 100) / 100, remaining);
      if (share > 0.004) customer.cbm[merchantId] = Math.round(share * 100) / 100;
      remaining = Math.round((remaining - share) * 100) / 100;
    }
  });
  return state;
}

function fieldsOf(doc: any): Record<string, any> {
  return doc?.fields ?? {};
}

function decodeValue(value: any): any {
  if (!value) return null;
  if ("stringValue" in value) return value.stringValue;
  if ("integerValue" in value) return Number(value.integerValue);
  if ("doubleValue" in value) return Number(value.doubleValue);
  if ("booleanValue" in value) return value.booleanValue;
  if ("nullValue" in value) return null;
  if (value.mapValue) return decodeFields(value.mapValue.fields ?? {});
  if (value.arrayValue) return (value.arrayValue.values ?? []).map(decodeValue);
  return null;
}

function decodeFields(fields: Record<string, any>): Record<string, any> {
  return Object.fromEntries(
    Object.entries(fields).map(([key, value]) => [key, decodeValue(value)]),
  );
}

function encodeValue(value: any): any {
  if (value === null || value === undefined) return { nullValue: "NULL_VALUE" };
  if (typeof value === "string") return { stringValue: value };
  if (typeof value === "boolean") return { booleanValue: value };
  if (typeof value === "number") {
    return Number.isInteger(value)
      ? { integerValue: String(value) }
      : { doubleValue: value };
  }
  if (Array.isArray(value)) {
    return { arrayValue: { values: value.map(encodeValue) } };
  }
  if (typeof value === "object") {
    return {
      mapValue: {
        fields: Object.fromEntries(
          Object.entries(value).map(([key, item]) => [key, encodeValue(item)]),
        ),
      },
    };
  }
  return { nullValue: "NULL_VALUE" };
}

function encodeFields(fields: Record<string, any>): Record<string, any> {
  return Object.fromEntries(
    Object.entries(fields).map(([key, value]) => [key, encodeValue(value)]),
  );
}

let tokenCache: { token: string; expiresAt: number } | undefined;
type FirebaseJwk = { kid?: string; kty: string; n: string; e: string; alg?: string; use?: string };
let jwksCache: { keys: FirebaseJwk[]; expiresAt: number } | undefined;

async function serviceToken(): Promise<string> {
  if (tokenCache && Date.now() < tokenCache.expiresAt) return tokenCache.token;
  const raw = process.env.SA_KEY;
  if (!raw) throw new CashbackError(503, "SERVICE_ACCOUNT_SECRET_MISSING");
  const candidates = [raw.trim()];
  let account: { client_email?: string; private_key?: string } | undefined;
  for (let index = 0; index < candidates.length && index < 6; index += 1) {
    const candidate = candidates[index];
    try {
      const parsed = JSON.parse(candidate);
      if (typeof parsed === "string") {
        candidates.push(parsed.trim());
      } else if (parsed && typeof parsed === "object") {
        account = parsed as { client_email?: string; private_key?: string };
        break;
      }
    } catch {
      const normalized = candidate
        .replace(/("private_key"\s*:\s*")([\s\S]*?)("(?=\s*[,}]))/g, (_match, prefix, key, suffix) =>
          `${prefix}${String(key).replace(/\r?\n/g, "\\n")}${suffix}`,
        )
        .replace(/,\s*([}\]])/g, "$1");
      if (normalized !== candidate) candidates.push(normalized);
      if (/^[A-Za-z0-9+/_=-]+$/.test(candidate) && candidate.length > 100) {
        try {
          candidates.push(Buffer.from(candidate, "base64").toString("utf8").trim());
        } catch {
          // Ignore malformed base64 candidates.
        }
      }
    }
  }
  if (!account) throw new CashbackError(503, "SERVICE_ACCOUNT_JSON_INVALID");
  if (!account.client_email || !account.private_key) {
    throw new CashbackError(503, "SERVICE_ACCOUNT_FIELDS_MISSING");
  }
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const claim = Buffer.from(
    JSON.stringify({
      iss: account.client_email,
      scope: "https://www.googleapis.com/auth/datastore",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    }),
  ).toString("base64url");
  const signer = createSign("RSA-SHA256");
  signer.update(`${header}.${claim}`);
  signer.end();
  const assertion = `${header}.${claim}.${signer.sign(account.private_key).toString("base64url")}`;
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  if (!response.ok) {
    let providerCode = "UNKNOWN";
    try {
      const body = (await response.json()) as { error?: string };
      if (body.error && /^[a-z_]+$/i.test(body.error)) providerCode = body.error;
    } catch {
      // Do not include the provider response body in logs or API responses.
    }
    throw new CashbackError(503, `SERVICE_ACCOUNT_${providerCode}`);
  }
  const result = (await response.json()) as { access_token?: string; expires_in?: number };
  if (!result.access_token) throw new CashbackError(503, "SERVICE_ACCOUNT_TOKEN_MISSING");
  tokenCache = {
    token: result.access_token,
    expiresAt: Date.now() + Math.max(60, Number(result.expires_in ?? 3600) - 120) * 1000,
  };
  return result.access_token;
}

async function firestore(path: string, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers);
  headers.set("authorization", `Bearer ${await serviceToken()}`);
  if (init?.body && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  return fetch(`${FIRESTORE_URL}/${path}`, { ...init, headers });
}

function neonIsPrimary(): boolean {
  return process.env.CASHBACK_STORAGE === "neon";
}

function relativeDocumentPath(name: string): string {
  const prefix = `${DOCUMENT_ROOT}/`;
  if (!name.startsWith(prefix)) throw new CashbackError(400, "INVALID_DOCUMENT_PATH");
  return name.slice(prefix.length);
}

export async function getNeonDocument(path: string): Promise<any | null> {
  const result = await pool.query<{ body: any }>(
    "SELECT body FROM cashback_documents WHERE path = $1",
    [path],
  );
  return result.rows[0]?.body ?? null;
}

export async function listFirestoreCollection(
  collection: "cashback" | "users" | "photos",
): Promise<any[]> {
  const documents: any[] = [];
  let pageToken: string | undefined;
  do {
    const params = new URLSearchParams({ pageSize: "300" });
    if (pageToken) params.set("pageToken", pageToken);
    const response = await firestore(`${collection}?${params.toString()}`);
    if (!response.ok) throw new CashbackError(503, `FIRESTORE_LIST_HTTP_${response.status}`);
    const page = (await response.json()) as { documents?: any[]; nextPageToken?: string };
    documents.push(...(page.documents ?? []));
    pageToken = page.nextPageToken;
  } while (pageToken);
  return documents;
}

export async function importFirestoreDocumentToNeon(
  document: Record<string, any>,
): Promise<"inserted" | "unchanged"> {
  if (typeof document.name !== "string" || !document.fields) {
    throw new CashbackError(400, "INVALID_FIRESTORE_DOCUMENT");
  }
  const path = relativeDocumentPath(document.name);
  const body = JSON.stringify(document);
  const inserted = await pool.query(
    `INSERT INTO cashback_documents (path, body, revision)
     VALUES ($1, $2::jsonb, 1)
     ON CONFLICT (path) DO NOTHING
     RETURNING path`,
    [path, body],
  );
  if (inserted.rowCount === 1) return "inserted";
  const existing = await pool.query<{ identical: boolean }>(
    "SELECT body = $2::jsonb AS identical FROM cashback_documents WHERE path = $1",
    [path, body],
  );
  if (existing.rows[0]?.identical) return "unchanged";
  throw new CashbackError(409, "NEON_MIGRATION_CONFLICT");
}

export async function markFirestoreImportComplete(counts: Record<string, number>): Promise<void> {
  if (!(await getNeonDocument("cashback/state"))) {
    throw new CashbackError(409, "NEON_STATE_MISSING");
  }
  const document = {
    name: `${DOCUMENT_ROOT}/${NEON_MIGRATION_MARKER}`,
    fields: encodeFields({ json: JSON.stringify({ completedAt: Date.now(), counts }) }),
    updateTime: "neon:1",
  };
  const result = await pool.query(
    `INSERT INTO cashback_documents (path, body, revision)
     VALUES ($1, $2::jsonb, 1)
     ON CONFLICT (path) DO NOTHING
     RETURNING path`,
    [NEON_MIGRATION_MARKER, JSON.stringify(document)],
  );
  if (result.rowCount !== 1) throw new CashbackError(409, "NEON_MIGRATION_ALREADY_MARKED");
}

async function commitToNeon(writes: any[]): Promise<boolean> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const write of writes) {
      if (!write?.update?.name || !write.update.fields) {
        throw new CashbackError(400, "UNSUPPORTED_DATABASE_WRITE");
      }
      const path = relativeDocumentPath(write.update.name);
      const condition = write.currentDocument as
        | { exists?: boolean; updateTime?: string }
        | undefined;
      const selected = await client.query<{ body: any; revision: string | number }>(
        "SELECT body, revision FROM cashback_documents WHERE path = $1 FOR UPDATE",
        [path],
      );
      const current = selected.rows[0];
      if (condition?.exists === false && current) {
        await client.query("ROLLBACK");
        return false;
      }
      if (condition?.exists === true && !current) {
        await client.query("ROLLBACK");
        return false;
      }
      if (
        condition?.updateTime &&
        (!current || String(current.body?.updateTime ?? "") !== String(condition.updateTime))
      ) {
        await client.query("ROLLBACK");
        return false;
      }
      const nextRevision = Number(current?.revision ?? 0) + 1;
      const body = JSON.stringify({
        ...(current?.body ?? {}),
        ...write.update,
        updateTime: `neon:${nextRevision}`,
      });
      if (current) {
        const updated = await client.query(
          `UPDATE cashback_documents
           SET body = $2::jsonb, revision = $3, updated_at = now()
           WHERE path = $1 AND revision = $4`,
          [path, body, nextRevision, current.revision],
        );
        if (updated.rowCount !== 1) {
          await client.query("ROLLBACK");
          return false;
        }
      } else {
        const inserted = await client.query(
          `INSERT INTO cashback_documents (path, body, revision)
           VALUES ($1, $2::jsonb, $3)
           ON CONFLICT (path) DO NOTHING
           RETURNING path`,
          [path, body, nextRevision],
        );
        if (inserted.rowCount !== 1) {
          await client.query("ROLLBACK");
          return false;
        }
      }
    }
    await client.query("COMMIT");
    return true;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function getDocument(path: string): Promise<any | null> {
  if (neonIsPrimary()) return getNeonDocument(path);
  const response = await firestore(path);
  if (response.status === 404) return null;
  if (!response.ok) throw new CashbackError(503, `FIRESTORE_HTTP_${response.status}`);
  return response.json();
}

export async function getState(): Promise<{
  state: CashbackState;
  updateTime?: string;
  revision: number;
}> {
  if (neonIsPrimary() && !(await getNeonDocument(NEON_MIGRATION_MARKER))) {
    throw new CashbackError(503, "NEON_MIGRATION_REQUIRED");
  }
  const doc = await getDocument("cashback/state");
  const fields = fieldsOf(doc);
  const raw = fields.json?.stringValue;
  if (!raw) {
    if (neonIsPrimary()) throw new CashbackError(503, "NEON_STATE_MISSING");
    return { state: emptyState(), revision: 0 };
  }
  try {
    const state = normalizeLegacyState(JSON.parse(raw) as CashbackState);
    return {
      state,
      updateTime: doc.updateTime,
      revision: Number(fields.rev?.integerValue ?? 0),
    };
  } catch {
    throw new CashbackError(500, "STATE_DATA_INVALID");
  }
}

export function stateWrite(
  state: CashbackState,
  updateTime?: string,
  revision = 0,
): any {
  const json = JSON.stringify(state);
  if (json.length > 900_000) throw new CashbackError(413, "STATE_TOO_LARGE");
  return {
    update: {
      name: `${DOCUMENT_ROOT}/cashback/state`,
      fields: encodeFields({
        json,
        rev: revision + 1,
        t: Date.now(),
      }),
    },
    currentDocument: updateTime ? { updateTime } : { exists: false },
  };
}

export function documentWrite(collection: string, id: string, fields: Record<string, any>, exists?: boolean): any {
  const write: Record<string, any> = {
    update: {
      name: `${DOCUMENT_ROOT}/${collection}/${id}`,
      fields: encodeFields(fields),
    },
  };
  if (exists !== undefined) write.currentDocument = { exists };
  return write;
}

export async function commit(writes: any[]): Promise<boolean> {
  if (neonIsPrimary()) return commitToNeon(writes);
  const response = await firestore(":commit", {
    method: "POST",
    body: JSON.stringify({ writes }),
  });
  if (response.status === 409) return false;
  if (response.status === 400) {
    const errorText = await response.text();
    if (errorText.includes("FAILED_PRECONDITION") || errorText.includes("ALREADY_EXISTS")) {
      return false;
    }
    throw new CashbackError(503, `FIRESTORE_WRITE_HTTP_${response.status}`);
  }
  if (!response.ok) throw new CashbackError(503, `FIRESTORE_WRITE_HTTP_${response.status}`);
  return true;
}

async function getFirebaseKeys(): Promise<FirebaseJwk[]> {
  if (jwksCache && Date.now() < jwksCache.expiresAt) return jwksCache.keys;
  const response = await fetch(
    "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com",
  );
  if (!response.ok) throw new CashbackError(503, "IDENTITY_PROVIDER_UNAVAILABLE");
  const data = (await response.json()) as { keys: FirebaseJwk[] };
  jwksCache = { keys: data.keys, expiresAt: Date.now() + 60 * 60 * 1000 };
  return data.keys;
}

async function verifyFirebaseIdToken(
  token: string,
): Promise<{ uid: string; email: string; phoneNumber: string }> {
  const parts = token.split(".");
  if (parts.length !== 3) throw new CashbackError(401, "UNAUTHENTICATED");
  let header: any;
  let claims: any;
  try {
    header = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"));
    claims = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
  } catch {
    throw new CashbackError(401, "UNAUTHENTICATED");
  }
  if (header.alg !== "RS256" || !header.kid) throw new CashbackError(401, "UNAUTHENTICATED");
  const keyData = (await getFirebaseKeys()).find((key: any) => key.kid === header.kid);
  if (!keyData) throw new CashbackError(401, "UNAUTHENTICATED");
  const key = createPublicKey({ key: keyData as any, format: "jwk" });
  const signature = Buffer.from(parts[2], "base64url");
  if (!verify("RSA-SHA256", Buffer.from(`${parts[0]}.${parts[1]}`), key, signature)) {
    throw new CashbackError(401, "UNAUTHENTICATED");
  }
  const now = Math.floor(Date.now() / 1000);
  if (
    claims.aud !== PROJECT_ID ||
    claims.iss !== `https://securetoken.google.com/${PROJECT_ID}` ||
    typeof claims.sub !== "string" ||
    !claims.sub ||
    claims.exp <= now ||
    claims.iat > now + 300
  ) {
    throw new CashbackError(401, "SESSION_EXPIRED");
  }
  return {
    uid: claims.sub,
    email: String(claims.email ?? "").toLowerCase(),
    phoneNumber: String(claims.phone_number ?? ""),
  };
}

export async function authenticateIdentity(
  req: Request,
): Promise<{ uid: string; email: string; phoneNumber: string }> {
  const authorization = req.header("authorization") ?? "";
  const token = authorization.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) throw new CashbackError(401, "UNAUTHENTICATED");
  return verifyFirebaseIdToken(token);
}

export async function authenticateRequest(req: Request): Promise<CashbackProfile> {
  const identity = await authenticateIdentity(req);
  const doc = await getDocument(`users/${identity.uid}`);
  const fields = decodeFields(fieldsOf(doc));
  if (identity.email === ADMIN_EMAIL) {
    return {
      uid: identity.uid,
      role: "admin",
      eid: "admin",
      name: fields.name || "CASH BACK",
      email: identity.email,
      preferences: fields.preferences ?? { language: "ar", theme: "dark" },
    };
  }
  const role = fields.role;
  const eid = fields.eid;
  if ((role !== "customer" && role !== "merchant") || typeof eid !== "string" || !eid) {
    throw new CashbackError(403, "PROFILE_INCOMPLETE");
  }
  return {
    uid: identity.uid,
    role,
    eid,
    name: String(fields.name ?? ""),
    phone: fields.phone ? String(fields.phone) : null,
    email: identity.email || fields.email || null,
    preferences: fields.preferences ?? { language: "ar", theme: "dark" },
  };
}

export async function savePreferences(
  profile: CashbackProfile,
  preferences: { language: "ar" | "en" | "fr"; theme: "dark" | "light" },
): Promise<CashbackProfile> {
  const path = `users/${profile.uid}`;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const current = await getDocument(path);
    const fields = decodeFields(fieldsOf(current));
    const next = {
      ...fields,
      role: fields.role ?? profile.role,
      eid: fields.eid ?? profile.eid,
      name: fields.name ?? profile.name,
      phone: fields.phone ?? profile.phone ?? "",
      preferences,
    };
    const write = documentWrite("users", profile.uid, next, current ? undefined : false);
    if (current?.updateTime) {
      write.currentDocument = { updateTime: current.updateTime };
    }
    if (await commit([write])) return { ...profile, preferences };
  }
  throw new CashbackError(409, "WRITE_CONFLICT");
}

export function requireAdmin(profile: CashbackProfile): void {
  if (profile.role !== "admin") throw new CashbackError(403, "FORBIDDEN");
}

export function unauthorizedRole(profile: CashbackProfile, role: CashbackRole): void {
  if (profile.role !== role) throw new CashbackError(403, "FORBIDDEN");
}

export function decodeFirestoreFields(doc: any): Record<string, any> {
  return decodeFields(fieldsOf(doc));
}
