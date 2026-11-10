import {
  createHash,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import type { Request } from "express";
import { pool } from "@workspace/db";
export {
  getMerchantCommissionDue,
  settleMerchantCommissionObligations,
} from "./commission-ledger";

const PROJECT_ID = "cashback-neon";
const DOCUMENT_ROOT = `projects/${PROJECT_ID}/databases/(default)/documents`;
const SESSION_COOKIE = "cashback_session";
const SESSION_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000;

export type CashbackRole = "customer" | "merchant" | "admin";
export type CashbackProfile = {
  uid: string;
  role: CashbackRole;
  eid: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  avatarUpdatedAt?: number;
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
  settings: {
    cashback: 4,
    platformCommission: 2,
    claimHours: 720,
    minimumTopupDzd: 1000,
    minimumTopupLyd: 10,
    enabledCurrencies: ["DZD", "LYD"],
    enabledLanguages: ["ar", "en", "fr"],
    notificationsEnabled: true,
    paymentMethods: [],
    maxTopupAmountDzd: null,
    maxTopupAmountLyd: null,
  },
  categories: ["restaurants", "cafes", "clothing", "electronics", "malls", "groceries", "perfume", "gifts", "shops"],
  merchants: [],
  customers: [],
  claims: [],
  merchantCommissionLedger: [],
  merchantCommissionSettlements: [],
  ratings: [],
  txns: [],
  cbpays: [],
  paymentSessions: [],
  notes: [],
  audit: [],
});

function normalizeState(state: CashbackState): CashbackState {
  state.settings ??= {};
  state.settings.cashback ??= 4;
  state.settings.platformCommission ??= 2;
  state.settings.claimHours ??= 720;
  state.settings.minimumTopupDzd ??= 1000;
  state.settings.minimumTopupLyd ??= 10;
  state.settings.enabledCurrencies ??= ["DZD", "LYD"];
  state.settings.enabledLanguages ??= ["ar", "en", "fr"];
  state.settings.notificationsEnabled ??= true;
  state.settings.paymentMethods ??= [];
  state.settings.maxTopupAmountDzd ??= null;
  state.settings.maxTopupAmountLyd ??= null;
  for (const key of ["merchants", "customers", "claims", "merchantCommissionLedger", "merchantCommissionSettlements", "ratings", "txns", "cbpays", "paymentSessions", "notes", "audit", "merchantTopups", "merchantWithdrawals", "merchantStoreChangeRequests"]) {
    if (!Array.isArray(state[key])) state[key] = [];
  }
  state.categories ??= ["restaurants", "cafes", "clothing", "electronics", "malls", "groceries", "perfume", "gifts", "shops"];
  state.merchants.forEach((merchant: any) => {
    merchant.status ??= "active";
    merchant.cat ??= "shops";
    merchant.topupBalance = Number(merchant.topupBalance ?? 0);
    merchant.payoutBalance = Number(merchant.payoutBalance ?? 0);
    merchant.payoutDebt = Number(merchant.payoutDebt ?? 0);
    merchant.reservedWithdrawalBalance = Number(merchant.reservedWithdrawalBalance ?? 0);
  });
  state.customers.forEach((customer: any) => {
    customer.wallet = Number(customer.wallet ?? 0);
    customer.cbm ??= {};
    customer.status ??= "active";
  });
  return state;
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
  if (Array.isArray(value)) return { arrayValue: { values: value.map(encodeValue) } };
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

function encodeFields(fields: Record<string, any>): Record<string, any> {
  return Object.fromEntries(
    Object.entries(fields).map(([key, value]) => [key, encodeValue(value)]),
  );
}

function decodeFields(fields: Record<string, any>): Record<string, any> {
  return Object.fromEntries(
    Object.entries(fields).map(([key, value]) => [key, decodeValue(value)]),
  );
}

function fieldsOf(doc: any): Record<string, any> {
  return doc?.fields ?? {};
}

function relativePath(name: string): string {
  const prefix = `${DOCUMENT_ROOT}/`;
  if (!name.startsWith(prefix)) throw new CashbackError(400, "INVALID_DOCUMENT_PATH");
  return name.slice(prefix.length);
}

export function decodeCashbackFields(doc: any): Record<string, any> {
  return decodeFields(fieldsOf(doc));
}

export async function getDocument(path: string): Promise<any | null> {
  const result = await pool.query<{ body: any }>(
    "SELECT body FROM cashback_documents WHERE path = $1",
    [path],
  );
  return result.rows[0]?.body ?? null;
}

export async function getState(): Promise<{
  state: CashbackState;
  updateTime?: string;
  revision: number;
}> {
  const doc = await getDocument("cashback/state");
  const fields = fieldsOf(doc);
  const raw = fields.json?.stringValue;
  if (!raw) return { state: emptyState(), revision: 0 };
  try {
    return {
      state: normalizeState(JSON.parse(raw) as CashbackState),
      updateTime: doc.updateTime,
      revision: Number(fields.rev?.integerValue ?? 0),
    };
  } catch {
    throw new CashbackError(500, "STATE_DATA_INVALID");
  }
}

export function stateWrite(state: CashbackState, updateTime?: string, revision = 0): any {
  const json = JSON.stringify(state);
  if (json.length > 8_000_000) throw new CashbackError(413, "STATE_TOO_LARGE");
  return {
    update: {
      name: `${DOCUMENT_ROOT}/cashback/state`,
      fields: encodeFields({ json, rev: revision + 1, t: Date.now() }),
    },
    currentDocument: updateTime ? { updateTime } : { exists: false },
  };
}

export function documentWrite(
  collection: string,
  id: string,
  fields: Record<string, any>,
  exists?: boolean,
): any {
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
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const write of writes) {
      if (!write?.update?.name || !write.update.fields) {
        throw new CashbackError(400, "UNSUPPORTED_DATABASE_WRITE");
      }
      const path = relativePath(write.update.name);
      const condition = write.currentDocument as
        | { exists?: boolean; updateTime?: string }
        | undefined;
      const selected = await client.query<{ body: any; revision: string | number }>(
        "SELECT body, revision FROM cashback_documents WHERE path = $1 FOR UPDATE",
        [path],
      );
      const current = selected.rows[0];
      if ((condition?.exists === false && current) || (condition?.exists === true && !current)) {
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

export async function mutateCashbackState<T>(
  mutate: (state: CashbackState) => { result: T; extraWrites?: any[] },
): Promise<T> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const current = await getState();
    const { result, extraWrites = [] } = mutate(current.state);
    if (
      await commit([
        stateWrite(current.state, current.updateTime, current.revision),
        ...extraWrites,
      ])
    ) {
      return result;
    }
  }
  throw new CashbackError(409, "WRITE_CONFLICT");
}

export async function createSession(uid: string): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const expiresAt = Date.now() + SESSION_LIFETIME_MS;
  const saved = await commit([
    documentWrite("sessions", tokenHash, { uid, expiresAt }, false),
  ]);
  if (!saved) throw new CashbackError(503, "SESSION_CREATE_FAILED");
  return token;
}

export function sessionCookieName(): string {
  return SESSION_COOKIE;
}

export function getSessionToken(req: Request): string | null {
  const cookieHeader = req.headers.cookie ?? "";
  const cookie = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${SESSION_COOKIE}=`));
  if (!cookie) return null;
  try {
    return decodeURIComponent(cookie.slice(SESSION_COOKIE.length + 1)) || null;
  } catch {
    return null;
  }
}

export async function revokeSession(req: Request): Promise<void> {
  const token = getSessionToken(req);
  if (!token) return;
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const doc = await getDocument(`sessions/${tokenHash}`);
  if (!doc) return;
  const fields = decodeFields(fieldsOf(doc));
  await commit([
    documentWrite("sessions", tokenHash, { ...fields, revokedAt: Date.now() }, true),
  ]);
}

export async function authenticateRequest(req: Request): Promise<CashbackProfile> {
  const token = getSessionToken(req);
  if (!token) throw new CashbackError(401, "UNAUTHENTICATED");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const sessionDoc = await getDocument(`sessions/${tokenHash}`);
  const session = decodeFields(fieldsOf(sessionDoc));
  if (
    !sessionDoc ||
    session.revokedAt ||
    Number(session.expiresAt ?? 0) <= Date.now() ||
    typeof session.uid !== "string"
  ) {
    throw new CashbackError(401, "SESSION_EXPIRED");
  }
  const profileDoc = await getDocument(`users/${session.uid}`);
  const fields = decodeFields(fieldsOf(profileDoc));
  if (!profileDoc) throw new CashbackError(401, "UNAUTHENTICATED");
  const role = fields.role;
  const eid = fields.eid;
  if (
    (role !== "customer" && role !== "merchant" && role !== "admin") ||
    typeof eid !== "string" ||
    !eid
  ) {
    throw new CashbackError(403, "PROFILE_INCOMPLETE");
  }
  return {
    uid: session.uid,
    role,
    eid,
    name: String(fields.name ?? ""),
    phone: fields.phone ? String(fields.phone) : null,
    email: fields.email ? String(fields.email) : null,
    avatarUpdatedAt: Number(fields.avatarUpdatedAt ?? 0) || undefined,
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
    if (!current) throw new CashbackError(404, "PROFILE_NOT_FOUND");
    const fields = decodeFields(fieldsOf(current));
    const next = { ...fields, preferences };
    const write = documentWrite("users", profile.uid, next, true);
    write.currentDocument = { updateTime: current.updateTime };
    if (await commit([write])) return { ...profile, preferences };
  }
  throw new CashbackError(409, "PROFILE_UPDATE_CONFLICT");
}

export function emailLookupId(email: string): string {
  return createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
}

export function phoneLookupId(phone: string): string {
  return createHash("sha256").update(phone).digest("hex");
}

export function hashPassword(password: string): { salt: string; hash: string } {
  const salt = randomBytes(16).toString("hex");
  return { salt, hash: scryptSync(password, salt, 64).toString("hex") };
}

export function verifyPassword(password: string, salt: string, expectedHash: string): boolean {
  if (!/^[a-f0-9]{32}$/i.test(salt) || !/^[a-f0-9]{128}$/i.test(expectedHash)) return false;
  const actual = scryptSync(password, salt, 64);
  const expected = Buffer.from(expectedHash, "hex");
  return expected.length === actual.length && timingSafeEqual(actual, expected);
}

export async function verifyNeonConnection(): Promise<void> {
  await pool.query("SELECT 1");
}

export function requireAdmin(profile: CashbackProfile): void {
  if (profile.role !== "admin") throw new CashbackError(403, "ADMIN_REQUIRED");
}

export function unauthorizedRole(profile: CashbackProfile, role: CashbackRole): void {
  if (profile.role !== role) throw new CashbackError(403, "ROLE_FORBIDDEN");
}

