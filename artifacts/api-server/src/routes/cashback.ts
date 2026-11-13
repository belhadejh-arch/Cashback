import { randomUUID, createHash, timingSafeEqual } from "node:crypto";
import { Router, type IRouter, type Response, type NextFunction } from "express";
import {
  LoginCashbackBody,
  RegisterCashbackProfileBody,
  SubmitCashbackReceiptBody,
  DecideCashbackReceiptBody,
  DecideCashbackMerchantBody,
  RedeemMerchantCashbackBody,
  CreateCashbackProfilePhotoUploadBody,
  CreateCashbackProfilePhotoUploadResponse,
  SaveCashbackProfilePhotoBody,
  SaveCashbackProfilePhotoResponse,
  UpdateCashbackPreferencesBody,
  UpdateCashbackRateBody,
  UpdateCashbackCategoriesBody,
  UpdateCashbackCustomerStatusBody,
  UpdateCashbackMerchantStatusBody,
  UpdateCashbackMerchantCategoryBody,
  RotateCashbackMerchantQrParams,
  UpdateCashbackSystemSettingsBody,
  RateCashbackMerchantBody,
  CreateCashbackReceiptPhotoUploadBody,
  CreateCashbackReceiptPhotoUploadResponse,
  CreateCashbackPaymentSessionBody,
  ReverseCashbackPaymentBody,
  ReverseCashbackPaymentParams,
} from "@workspace/api-zod";
import {
  authenticateRequest,
  CashbackError,
  commit,
  createSession,
  createSessionGrant,
  decodeCashbackFields,
  documentWrite,
  emailLookupId,
  getDocument,
  hasCashbackAdminAccount,
  settleMerchantCommissionObligations,
  getState,
  hashPassword,
  mutateCashbackState,
  phoneLookupId,
  requireAdmin,
  revokeSession,
  savePreferences,
  sessionCookieName,
  unauthorizedRole,
  verifyNeonConnection,
  verifyPassword,
  type AuthenticatedRequest,
  type CashbackProfile,
  type CashbackState,
} from "../lib/cashback-neon";
import {
  createProfilePhotoUpload,
  createReceiptPhotoUpload,
  getProfilePhotoFile,
  profilePhotoMatchesType,
  readPrivateImage,
  readProfilePhoto,
} from "../lib/profilePhotoStorage";
import { receiveRenderDiskUpload } from "../lib/renderDiskStorage";
import { calculateCommissionAmounts } from "../lib/commission-ledger";
import { addCashbackNotification } from "../lib/cashback-notifications";

const router: IRouter = Router();
const MAX_IMAGE_LENGTH = 650_000;
async function recordFailedPayment(
  profile: CashbackProfile,
  req: any,
  error: unknown,
  details: { sessionId?: string; merchantId?: string } = {},
): Promise<void> {
  if (!(error instanceof CashbackError)) return;
  const allowedCodes = new Set([
    "PAYMENT_SESSION_NOT_FOUND",
    "PAYMENT_SESSION_ALREADY_USED",
    "PAYMENT_SESSION_EXPIRED",
    "QR_MERCHANT_UNAVAILABLE",
    "QR_INVALID_OR_WRONG_MERCHANT",
    "INSUFFICIENT_MERCHANT_BALANCE",
  ]);
  if (!allowedCodes.has(error.code)) return;
  try {
    await mutateState((state) => {
      const session = (state.paymentSessions ?? []).find(
        (entry: any) => entry.id === details.sessionId,
      );
      const merchantId = details.merchantId || session?.merchantId || "";
      const merchant = (state.merchants ?? []).find(
        (entry: any) => entry.id === merchantId,
      );
      addCashbackNotification(state, "admin", "admin.security.payment_failed", {
        customerId: profile.eid,
        merchant: merchant?.name || merchantId || "unknown",
        merchantId: merchantId || undefined,
        sessionId: details.sessionId || undefined,
        reason: error.code,
        ip: String(req.ip ?? "").slice(0, 80),
        dedupeKey: `payment:${profile.eid}:${details.sessionId || merchantId || "unknown"}:${error.code}`,
      });
      return { result: { ok: true } };
    });
  } catch {
    // The original payment error remains authoritative if alert persistence fails.
  }
}
const CATEGORIES = new Set([
  "restaurants",
  "cafes",
  "clothing",
  "electronics",
  "malls",
  "groceries",
  "perfume",
  "gifts",
  "shops",
  "other",
]);
const CUSTOMER_CATEGORIES = [
  "restaurants",
  "cafes",
  "clothing",
  "electronics",
  "malls",
  "groceries",
  "perfume",
  "gifts",
  "shops",
] as const;
const MERCHANT_APPLICATION_CATEGORIES = new Set([
  "groceries",
  "clothing",
  "electronics",
  "cafes",
  "restaurants",
]);
const QR_PAYMENT_SESSION_TTL_MS = 3 * 60 * 1000;

function respondError(res: Response, error: unknown): void {
  if (error instanceof CashbackError) {
    res.status(error.status).json({ error: error.code });
    return;
  }
  if (error instanceof Error && "issues" in error) {
    res.status(400).json({ error: "INVALID_REQUEST" });
    return;
  }
  res.status(500).json({ error: "INTERNAL_ERROR" });
}

function logReceiptFailure(req: any, operation: string, error: unknown): void {
  const value = error as {
    code?: unknown;
    constraint?: unknown;
    table?: unknown;
    column?: unknown;
  } | null;
  const context = {
    operation,
    errorName: error instanceof Error ? error.name : "UnknownError",
    errorCode: error instanceof CashbackError
      ? error.code
      : typeof value?.code === "string"
        ? value.code
        : undefined,
    constraint: typeof value?.constraint === "string" ? value.constraint : undefined,
    table: typeof value?.table === "string" ? value.table : undefined,
    column: typeof value?.column === "string" ? value.column : undefined,
  };
  if (error instanceof CashbackError && error.status < 500) {
    req.log.warn(context, "CASH BACK receipt request rejected");
  } else {
    req.log.error(context, "CASH BACK receipt request failed");
  }
}

router.get("/cashback/health", async (_req, res) => {
  try {
    await verifyNeonConnection();
    res.json({ status: "ok" });
  } catch (error) {
    const code = error instanceof CashbackError ? error.code : "DATABASE_INTERNAL_ERROR";
    _req.log.warn({ code }, "CASH BACK Neon health check failed");
    res.status(503).json({ status: "unavailable" });
  }
});

router.get("/cashback/first-admin/status", async (_req, res) => {
  try {
    res.json({ available: !(await hasCashbackAdminAccount()) });
  } catch (error) {
    respondError(res, error);
  }
});

router.post("/cashback/first-admin/bootstrap", async (req, res) => {
  try {
    const bootstrapSecretKey =
      process.env.NODE_ENV === "production"
        ? "CASHBACK_ADMIN_BOOTSTRAP_TOKEN"
        : "CASHBACK_DEV_ADMIN_BOOTSTRAP_TOKEN";
    const expectedToken = process.env[bootstrapSecretKey]?.trim() ?? "";
    const suppliedToken = req.get("x-cashback-admin-bootstrap-token") ?? "";
    if (Buffer.byteLength(expectedToken) < 32) {
      throw new CashbackError(503, "ADMIN_BOOTSTRAP_NOT_CONFIGURED");
    }
    const expectedBytes = Buffer.from(expectedToken);
    const suppliedBytes = Buffer.from(suppliedToken);
    if (
      expectedBytes.length !== suppliedBytes.length ||
      !timingSafeEqual(expectedBytes, suppliedBytes)
    ) {
      throw new CashbackError(403, "INVALID_ADMIN_BOOTSTRAP_TOKEN");
    }

    const input = req.body && typeof req.body === "object" ? req.body : {};
    const name = typeof input.name === "string" ? input.name.trim() : "";
    const email = typeof input.email === "string" ? input.email.trim().toLowerCase() : "";
    const password = typeof input.password === "string" ? input.password : "";
    if (
      name.length < 2 ||
      name.length > 100 ||
      email.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      password.length < 12 ||
      password.length > 128
    ) {
      throw new CashbackError(400, "INVALID_ADMIN_BOOTSTRAP_INPUT");
    }

    if (await hasCashbackAdminAccount()) {
      throw new CashbackError(409, "ADMIN_ALREADY_INITIALIZED");
    }
    if (await getDocument(`account_emails/${emailLookupId(email)}`)) {
      throw new CashbackError(409, "EMAIL_ALREADY_REGISTERED");
    }

    const id = `a_${randomUUID().replaceAll("-", "").slice(0, 16)}`;
    const uid = `u_${randomUUID().replaceAll("-", "").slice(0, 24)}`;
    const passwordHash = hashPassword(password);
    const profile = {
      uid,
      role: "admin" as const,
      eid: id,
      name,
      email,
      preferences: { language: "ar", theme: "dark" },
    };
    await mutateCashbackState((state) => {
      if (state.adminBootstrapComplete) {
        throw new CashbackError(409, "ADMIN_ALREADY_INITIALIZED");
      }
      state.adminBootstrapComplete = true;
      state.audit ??= [];
      state.audit.unshift({
        id: `audit_${randomUUID().replaceAll("-", "").slice(0, 18)}`,
        action: "first_admin_bootstrapped",
        adminUid: uid,
        at: Date.now(),
      });
      return {
        result: profile,
        extraWrites: [
          documentWrite("account_emails", emailLookupId(email), { uid }, false),
          documentWrite("accounts", uid, {
            email,
            passwordSalt: passwordHash.salt,
            passwordHash: passwordHash.hash,
            createdAt: Date.now(),
          }, false),
          documentWrite("users", uid, {
            role: profile.role,
            eid: id,
            name,
            email,
            preferences: profile.preferences,
          }, false),
        ],
      };
    });
    res.status(201).json(profile);
  } catch (error) {
    respondError(res, error);
  }
});

router.use(async (req, res, next: NextFunction) => {
  try {
    if (
      req.method === "POST" &&
      (req.path === "/cashback/register" || req.path === "/cashback/auth/login")
    ) {
      next();
      return;
    }
    const profile = await authenticateRequest(req);
    if (profile.role === "customer") {
      const { state } = await getState();
      const customer = (state.customers ?? []).find((entry: any) => entry.id === profile.eid);
      if (customer?.status === "suspended") throw new CashbackError(403, "ACCOUNT_SUSPENDED");
    }
    (req as AuthenticatedRequest).cashbackProfile = profile;
    next();
  } catch (error) {
    respondError(res, error);
  }
});

router.put("/cashback/storage/uploads/:token", async (req, res) => {
  try {
    const profile = (req as unknown as AuthenticatedRequest).cashbackProfile;
    const result = await receiveRenderDiskUpload(
      String(req.params.token ?? ""),
      profile.uid,
      String(req.get("content-type") ?? "").split(";", 1)[0].trim().toLowerCase(),
      req,
    );
    if (!result) {
      res.status(404).json({ error: "UPLOAD_NOT_FOUND" });
      return;
    }
    if (!result.ok) {
      res.status(result.status).json({ error: result.error });
      return;
    }
    res.status(201).json({ ok: true });
  } catch (error) {
    respondError(res, error);
  }
});

function fieldString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizePhone(value: string): string {
  const raw = value.replace(/[\u0660-\u0669]/g, (digit) =>
    String(digit.charCodeAt(0) - 1632),
  );
  const prefix = raw.startsWith("+") ? "+" : "";
  const digits = raw.replace(/\D/g, "");
  return `${prefix}${digits}`;
}

function validateImageData(value: string): { data: string; type: string; hash: string } {
  if (
    value.length > MAX_IMAGE_LENGTH ||
    !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(value)
  ) {
    throw new CashbackError(400, "INVALID_IMAGE");
  }
  const [header, base64] = value.split(",", 2);
  const type = header.match(/^data:(image\/(?:jpeg|png|webp));base64$/)?.[1];
  if (!type || !base64) throw new CashbackError(400, "INVALID_IMAGE");
  return {
    data: value,
    type,
    hash: createHash("sha256").update(base64).digest("hex"),
  };
}

const mutateState = mutateCashbackState;

function activeCustomerCategories(value: unknown): string[] {
  const configured = Array.isArray(value)
    ? value.filter((category): category is string =>
        CUSTOMER_CATEGORIES.includes(category),
      )
    : [];
  return configured.length ? configured : [...CUSTOMER_CATEGORIES];
}

function currencyForCountry(country: unknown): "DZD" | "LYD" {
  return country === "Libya" ? "LYD" : "DZD";
}

function isCurrencyEnabled(state: CashbackState, country: unknown): boolean {
  const enabled = state.settings?.enabledCurrencies;
  return !Array.isArray(enabled) || enabled.includes(currencyForCountry(country));
}

function normalizeCountry(country: unknown): "Algeria" | "Libya" | null {
  const value = String(country ?? "").trim().toLowerCase();
  if (["algeria", "algérie", "dz", "الجزائر"].includes(value)) return "Algeria";
  if (["libya", "libye", "ly", "ليبيا"].includes(value)) return "Libya";
  return null;
}

function projectState(
  profile: CashbackProfile,
  state: CashbackState,
): CashbackState {
  const merchants = Array.isArray(state.merchants) ? state.merchants : [];
  const customers = Array.isArray(state.customers) ? state.customers : [];
  const claims = Array.isArray(state.claims) ? state.claims : [];
  const txns = Array.isArray(state.txns) ? state.txns : [];
  const cbpays = Array.isArray(state.cbpays) ? state.cbpays : [];
  const notes = Array.isArray(state.notes) ? state.notes : [];
  const merchantTopups = Array.isArray(state.merchantTopups) ? state.merchantTopups : [];
  const merchantWithdrawals = Array.isArray(state.merchantWithdrawals) ? state.merchantWithdrawals : [];
  const merchantStoreChangeRequests = Array.isArray(state.merchantStoreChangeRequests) ? state.merchantStoreChangeRequests : [];
  const merchantCommissionLedger = Array.isArray(state.merchantCommissionLedger) ? state.merchantCommissionLedger : [];
  const merchantCommissionSettlements = Array.isArray(state.merchantCommissionSettlements) ? state.merchantCommissionSettlements : [];
  const ratings = Array.isArray(state.ratings) ? state.ratings : [];
  const settings = {
    cashback: Number(state.settings?.cashback ?? 4),
    claimHours: Number(state.settings?.claimHours ?? 720),
    minimumTopupDzd: Number(state.settings?.minimumTopupDzd ?? 1000),
    minimumTopupLyd: Number(state.settings?.minimumTopupLyd ?? 10),
    enabledCurrencies: Array.isArray(state.settings?.enabledCurrencies)
      ? state.settings.enabledCurrencies
      : ["DZD", "LYD"],
    enabledLanguages: Array.isArray(state.settings?.enabledLanguages)
      ? state.settings.enabledLanguages
      : ["ar", "en", "fr"],
    notificationsEnabled: state.settings?.notificationsEnabled !== false,
  };
  const platformCommission = Number(state.settings?.platformCommission ?? 2);

  if (profile.role === "admin") return state;
  if (profile.role === "customer") {
    const customer = customers.find((entry: any) => entry.id === profile.eid);
    const customerCountry = normalizeCountry(customer?.country ?? profile.country);
    const customerBalanceState = customer
      ? { ...customer, country: customer.country ?? profile.country }
      : null;
    if (customerBalanceState) delete customerBalanceState.wallet;
    const activeMerchants = merchants
      .filter((merchant: any) =>
        merchant.status === "active" &&
        customerCountry !== null &&
        normalizeCountry(merchant.country) === customerCountry,
      )
      .map((merchant: any) => {
        const merchantRatings = ratings.filter(
          (rating: any) => rating.mid === merchant.id,
        );
        const ownRating = merchantRatings.find(
          (rating: any) => rating.cid === profile.eid,
        );
        return {
          id: merchant.id,
          name: merchant.name,
          cat: merchant.cat,
          status: merchant.status,
          country: merchant.country,
          city: merchant.city,
          address: merchant.address,
          mapsUrl: merchant.mapsUrl,
          lat: merchant.lat,
          lng: merchant.lng,
          cashbackRate: merchant.cashbackRate,
          logoId: merchant.logoId,
          coverId: merchant.coverId,
          publicId: merchant.publicId,
          description: merchant.description,
          rating: merchantRatings.length
            ? merchantRatings.reduce(
                (sum: number, entry: any) => sum + Number(entry.rating || 0),
                0,
              ) / merchantRatings.length
            : 0,
          ratingCount: merchantRatings.length,
          userRating: Number(ownRating?.rating || 0),
        };
      });
    return {
      settings,
      merchants: activeMerchants,
      customers: customerBalanceState ? [customerBalanceState] : [],
      claims: claims.filter((claim: any) => claim.cid === profile.eid),
      txns: txns.filter((transaction: any) => transaction.cid === profile.eid),
      cbpays: cbpays.filter((payment: any) => payment.cid === profile.eid),
      notes: notes.filter((note: any) => note.to === profile.eid),
      categories: activeCustomerCategories(state.categories),
    };
  }

  const merchant = merchants.find((entry: any) => entry.id === profile.eid);
  const ownClaims = claims.filter((claim: any) => claim.mid === profile.eid);
  const ownPayments = cbpays.filter((payment: any) => payment.mid === profile.eid);
  const customerIds = new Set([
    ...ownClaims.map((claim: any) => claim.cid),
    ...ownPayments.map((payment: any) => payment.cid),
  ]);
  return {
    settings: {
      ...settings,
      platformCommission,
      paymentMethods: (state.settings?.paymentMethods ?? []).filter((method: any) => method.active),
    },
    merchants: merchant ? [merchant] : [],
    customers: customers
      .filter((customer: any) => customerIds.has(customer.id))
      .map((customer: any) => ({
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
      })),
    claims: ownClaims,
    txns: txns.filter((transaction: any) => transaction.mid === profile.eid),
    cbpays: ownPayments,
    merchantTopups: merchantTopups.filter((entry: any) => entry.merchantId === profile.eid),
    merchantWithdrawals: merchantWithdrawals.filter((entry: any) => entry.merchantId === profile.eid),
    merchantCommissionLedger: merchantCommissionLedger.filter((entry: any) => entry.merchantId === profile.eid),
    merchantCommissionSettlements: merchantCommissionSettlements.filter((entry: any) => entry.merchantId === profile.eid),
    merchantStoreChangeRequests: merchantStoreChangeRequests.filter((entry: any) => entry.merchantId === profile.eid),
    notes: notes.filter((note: any) => note.to === profile.eid),
  };
}

router.get("/cashback/session", async (req, res) => {
  try {
    const profile = (req as AuthenticatedRequest).cashbackProfile;
    const { state } = await getState();
    const profileDoc = await getDocument(`users/${profile.uid}`);
    const savedFields = decodeCashbackFields(profileDoc);
    const merchant = (state.merchants ?? []).find(
      (entry: any) => entry.id === profile.eid,
    );
    const resultProfile = {
      ...profile,
      name: savedFields.name || profile.name,
      avatarUpdatedAt: Number(savedFields.avatarUpdatedAt ?? profile.avatarUpdatedAt ?? 0) || undefined,
      preferences: savedFields.preferences ?? profile.preferences,
      ...(normalizeCountry(savedFields.country)
        ? { country: normalizeCountry(savedFields.country) }
        : {}),
      ...(profile.role === "merchant" && merchant
        ? { status: merchant.status, rejectionReason: merchant.rejectionReason ?? null }
        : {}),
    };
    res.json({ profile: resultProfile, state: projectState(profile, state) });
  } catch (error) {
    respondError(res, error);
  }
});

router.get("/cashback/notifications", async (req, res) => {
  try {
    const profile = (req as AuthenticatedRequest).cashbackProfile;
    const { state } = await getState();
    const recipient = profile.role === "admin" ? "admin" : profile.eid;
    const notifications = (state.notes ?? [])
      .filter((note: any) => note.to === recipient)
      .slice(0, 300);
    res.json({
      notifications,
      unreadCount: notifications.filter((note: any) => !note.read).length,
    });
  } catch (error) {
    respondError(res, error);
  }
});

router.post("/cashback/notifications/read-all", async (req, res) => {
  try {
    const profile = (req as AuthenticatedRequest).cashbackProfile;
    const recipient = profile.role === "admin" ? "admin" : profile.eid;
    const result = await mutateState((state) => {
      let updated = 0;
      for (const note of state.notes ?? []) {
        if (note.to === recipient && !note.read) {
          note.read = true;
          updated += 1;
        }
      }
      return { result: { ok: true, updated } };
    });
    res.json(result);
  } catch (error) {
    respondError(res, error);
  }
});

router.post("/cashback/register", async (req, res) => {
  try {
    const parsed = RegisterCashbackProfileBody.safeParse(req.body);
    if (!parsed.success) throw new CashbackError(400, "INVALID_REQUEST");
    const input = parsed.data;
    const email = fieldString(input.email).toLowerCase();
    const existing = await getDocument(`account_emails/${emailLookupId(email)}`);
    if (existing) throw new CashbackError(409, "EMAIL_ALREADY_REGISTERED");
    const name = fieldString(input.name);
    const phone = input.phone ? normalizePhone(input.phone) : "";
    if (
      name.length < 2 ||
      (phone && (phone.length < 7 || phone.length > 18)) ||
      (input.role === "merchant" && !phone)
    ) {
      throw new CashbackError(400, "INVALID_PROFILE");
    }
    const isMerchant = input.role === "merchant";
    if (isMerchant) {
      if (
        !input.country ||
        !fieldString(input.city) ||
        !fieldString(input.address) ||
        !fieldString(input.mapsUrl) ||
        !MERCHANT_APPLICATION_CATEGORIES.has(fieldString(input.category))
      ) {
        throw new CashbackError(400, "MERCHANT_FIELDS_REQUIRED");
      }
      if (input.mapsUrl && !/^https?:\/\/|^-?\d{1,2}\.\d+,\s*-?\d{1,3}\.\d+$/.test(input.mapsUrl)) {
        throw new CashbackError(400, "INVALID_LOCATION");
      }
      if (!input.logoData) throw new CashbackError(400, "MERCHANT_LOGO_REQUIRED");
    }
    const image = input.logoData ? validateImageData(input.logoData) : null;
    const id = `${isMerchant ? "m" : "c"}_${randomUUID().replaceAll("-", "").slice(0, 16)}`;
    const uid = `u_${randomUUID().replaceAll("-", "").slice(0, 24)}`;
    const sessionGrant = createSessionGrant(uid);
    const mediaId = image ? `logo_${id}` : undefined;
    const password = hashPassword(input.password);
    const profileDocument = {
      role: input.role,
      eid: id,
      name,
      phone: phone || null,
      email,
      preferences: { language: "ar", theme: "dark" },
      country: normalizeCountry(input.country),
      ...(phone ? { phoneVerified: false } : {}),
      ...(isMerchant ? { country: input.country, city: input.city, address: input.address } : {}),
    };
    await mutateState((state) => {
      state.customers ??= [];
      state.merchants ??= [];
      const duplicate = phone && [...state.customers, ...state.merchants].some(
        (entry: any) => normalizePhone(String(entry.phone ?? "")) === phone,
      );
      if (duplicate) throw new CashbackError(409, "PHONE_ALREADY_REGISTERED");
      if (input.role === "customer") {
        const customerCountry = normalizeCountry(input.country);
        if (!customerCountry) throw new CashbackError(400, "COUNTRY_REQUIRED");
        state.customers.push({
          id,
          profileUid: uid,
          name,
          phone: phone || null,
          email,
          country: customerCountry,
          cbm: {},
          createdAt: Date.now(),
          status: "active",
        });
      } else {
        if (!isCurrencyEnabled(state, input.country)) throw new CashbackError(400, "CURRENCY_DISABLED");
        const merchant = {
          id,
          profileUid: uid,
          name,
          phone,
          cat: input.category,
          country: input.country,
          city: fieldString(input.city),
          address: fieldString(input.address),
          mapsUrl: fieldString(input.mapsUrl),
          logoId: mediaId ?? null,
          status: "pending",
          appliedAt: Date.now(),
          cashbackRate: null,
        };
        state.merchants.push(merchant);
        addCashbackNotification(state, "admin", "admin.merchant.application.new", {
          merchant: name,
          city: merchant.city,
          country: merchant.country,
          merchantId: merchant.id,
        });
        addCashbackNotification(state, merchant.id, "merchant.application.pending");
      }
      const photoWrite = image && mediaId
        ? [documentWrite("photos", mediaId, {
            data: image.data,
            contentType: image.type,
            ownerUid: uid,
            kind: "merchant-logo",
          }, false)]
        : [];
      const accountWrites = [
        documentWrite("account_emails", emailLookupId(email), { uid }, false),
        ...(phone
          ? [documentWrite("account_phones", phoneLookupId(phone), { uid, verified: false }, false)]
          : []),
        documentWrite("accounts", uid, {
          email,
          passwordSalt: password.salt,
          passwordHash: password.hash,
          createdAt: Date.now(),
        }, false),
        documentWrite("users", uid, profileDocument, false),
      ];
      return {
        result: { id },
        extraWrites: [...accountWrites, ...photoWrite, sessionGrant.write],
      };
    });
    const sessionToken = sessionGrant.token;
    res.cookie(sessionCookieName(), sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });
    res.status(201).json({
      uid,
      role: input.role,
      eid: id,
      name,
      phone: phone || null,
      email,
      preferences: { language: "ar", theme: "dark" },
    });
  } catch (error) {
    if (!(error instanceof CashbackError)) {
      const dbError = error as { code?: unknown; table?: unknown; constraint?: unknown };
      req.log.error({
        errorName: error instanceof Error ? error.name : "UnknownError",
        databaseCode: typeof dbError?.code === "string" && /^[0-9A-Z]{5}$/.test(dbError.code)
          ? dbError.code
          : undefined,
        databaseTable: typeof dbError?.table === "string" ? dbError.table : undefined,
        databaseConstraint: typeof dbError?.constraint === "string"
          ? dbError.constraint
          : undefined,
      }, "CASH BACK registration failed");
    }
    respondError(res, error);
  }
});

router.post("/cashback/auth/login", async (req, res) => {
  try {
    const parsed = LoginCashbackBody.safeParse(req.body);
    if (!parsed.success) throw new CashbackError(400, "INVALID_REQUEST");
    const identifier = fieldString(parsed.data.identifier ?? parsed.data.email);
    if (!identifier) throw new CashbackError(400, "INVALID_REQUEST");
    const emailLogin = identifier.includes("@");
    let email = "";
    let uid = "";
    if (emailLogin) {
      email = identifier.toLowerCase();
      const emailDocument = await getDocument(`account_emails/${emailLookupId(email)}`);
      const emailFields = decodeCashbackFields(emailDocument);
      uid = typeof emailFields.uid === "string" ? emailFields.uid : "";
    } else {
      const phone = normalizePhone(identifier);
      if (phone.length < 7 || phone.length > 18) {
        throw new CashbackError(401, "INVALID_CREDENTIALS");
      }
      const phoneDocument = await getDocument(`account_phones/${phoneLookupId(phone)}`);
      const phoneFields = decodeCashbackFields(phoneDocument);
      if (!phoneDocument || typeof phoneFields.uid !== "string") {
        throw new CashbackError(401, "INVALID_CREDENTIALS");
      }
      if (phoneFields.verified !== true) {
        throw new CashbackError(401, "INVALID_CREDENTIALS");
      }
      uid = phoneFields.uid;
    }
    const accountDocument = uid ? await getDocument(`accounts/${uid}`) : null;
    const account = decodeCashbackFields(accountDocument);
    if (
      !accountDocument ||
      typeof account.passwordSalt !== "string" ||
      typeof account.passwordHash !== "string" ||
      !verifyPassword(parsed.data.password, account.passwordSalt, account.passwordHash)
    ) {
      throw new CashbackError(401, "INVALID_CREDENTIALS");
    }
    const profileDocument = await getDocument(`users/${uid}`);
    const fields = decodeCashbackFields(profileDocument);
    if (!profileDocument) throw new CashbackError(401, "INVALID_CREDENTIALS");
    const role = fields.role as CashbackProfile["role"];
    const eid = String(fields.eid ?? "");
    if (!eid || !["customer", "merchant", "admin"].includes(role)) {
      throw new CashbackError(403, "PROFILE_INCOMPLETE");
    }
    if (role === "customer") {
      const { state } = await getState();
      const customer = (state.customers ?? []).find((entry: any) => entry.id === eid);
      if (customer?.status === "suspended") throw new CashbackError(403, "ACCOUNT_SUSPENDED");
    }
    if (parsed.data.role && role !== parsed.data.role && role !== "admin") {
      throw new CashbackError(403, "ACCOUNT_TYPE_MISMATCH");
    }
    const sessionToken = await createSession(uid);
    res.cookie(sessionCookieName(), sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });
    res.json({
      uid,
      role,
      eid,
      name: String(fields.name ?? ""),
      phone: fields.phone ?? null,
      email: typeof fields.email === "string" ? fields.email : email || null,
      preferences: fields.preferences ?? { language: "ar", theme: "dark" },
    });
  } catch (error) {
    respondError(res, error);
  }
});

router.post("/cashback/auth/logout", async (req, res) => {
  try {
    await revokeSession(req);
    res.clearCookie(sessionCookieName(), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    });
    res.json({ ok: true });
  } catch (error) {
    respondError(res, error);
  }
});

router.post("/cashback/receipts/upload-url", async (req, res) => {
  try {
    const profile = (req as unknown as AuthenticatedRequest).cashbackProfile;
    unauthorizedRole(profile, "customer");
    const parsed = CreateCashbackReceiptPhotoUploadBody.safeParse(req.body);
    if (!parsed.success) {
      throw new CashbackError(400, "INVALID_RECEIPT_IMAGE");
    }
    const uploadId = `receipt_${randomUUID()}`;
    const upload = await createReceiptPhotoUpload(
      profile.uid,
      uploadId,
      parsed.data.contentType,
      parsed.data.size,
    );
    const saved = await commit([
      documentWrite(
        "receipt_uploads",
        uploadId,
        {
          ownerUid: profile.uid,
          objectPath: upload.objectPath,
          contentType: parsed.data.contentType,
          requestedSize: parsed.data.size,
          expiresAt: Date.now() + 15 * 60 * 1000,
        },
        false,
      ),
    ]);
    if (!saved) throw new CashbackError(409, "UPLOAD_ALREADY_EXISTS");
    res.json(
      CreateCashbackReceiptPhotoUploadResponse.parse({
        uploadURL: upload.uploadURL,
        objectPath: upload.objectPath,
        uploadId,
      }),
    );
  } catch (error) {
    logReceiptFailure(req, "receipt-upload-url", error);
    respondError(res, error);
  }
});

router.post("/cashback/receipts", async (req, res) => {
  const profile = (req as unknown as AuthenticatedRequest).cashbackProfile;
  let suspiciousReceipt: { merchantId: string; merchantName: string; reason: string } | null = null;
  try {
    unauthorizedRole(profile, "customer");
    const parsed = SubmitCashbackReceiptBody.safeParse(req.body);
    if (!parsed.success) throw new CashbackError(400, "INVALID_REQUEST");
    const input = parsed.data;
    const amount = Math.round(Number(input.amount) * 100) / 100;
    if (!(amount > 0) || !Number.isFinite(amount)) {
      throw new CashbackError(400, "INVALID_AMOUNT");
    }
    const dateOnly = input.date instanceof Date
      ? input.date.toISOString().slice(0, 10)
      : String(input.date).slice(0, 10);
    const date = new Date(`${dateOnly}T12:00:00Z`);
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(dateOnly) ||
      Number.isNaN(date.getTime()) ||
      date.toISOString().slice(0, 10) !== dateOnly ||
      date.getTime() > Date.now() + 86_400_000
    ) {
      throw new CashbackError(400, "INVALID_RECEIPT_DATE");
    }
    if (!input.uploadId || !input.objectPath) {
      throw new CashbackError(400, "RECEIPT_IMAGE_REQUIRED");
    }
    const uploadDoc = await getDocument(`receipt_uploads/${input.uploadId}`);
    if (!uploadDoc) throw new CashbackError(400, "INVALID_RECEIPT_IMAGE");
    const upload = decodeCashbackFields(uploadDoc);
    if (
      upload.ownerUid !== profile.uid ||
      upload.objectPath !== input.objectPath ||
      Number(upload.expiresAt ?? 0) < Date.now() ||
      !(upload.requestedSize > 0)
    ) {
      throw new CashbackError(403, "INVALID_RECEIPT_IMAGE");
    }
    let storedImage: Awaited<ReturnType<typeof readPrivateImage>>;
    try {
      storedImage = await readPrivateImage(input.objectPath);
    } catch {
      throw new CashbackError(400, "INVALID_RECEIPT_IMAGE");
    }
    if (
      storedImage.contentType !== upload.contentType ||
      storedImage.size > Number(upload.requestedSize)
    ) {
      throw new CashbackError(400, "INVALID_RECEIPT_IMAGE");
    }
    const base64 = storedImage.buffer.toString("base64");
    const image = {
      data: `data:${storedImage.contentType};base64,${base64}`,
      type: storedImage.contentType,
      hash: createHash("sha256").update(base64).digest("hex"),
    };
    const uploadedPhoto = {
      uploadId: input.uploadId,
      objectPath: input.objectPath,
      size: storedImage.size,
    };
    const claimId = `rcpt_${randomUUID().replaceAll("-", "").slice(0, 18)}`;
    const mediaId = `receipt_${claimId}`;
    const invoiceNumber = fieldString(input.invoiceNumber ?? "");
    const receipt = await mutateState((state) => {
      const customer = (state.customers ?? []).find(
        (entry: any) => entry.id === profile.eid,
      );
      if (!customer) throw new CashbackError(403, "PROFILE_INCOMPLETE");
      const customerCountry = normalizeCountry(customer.country ?? profile.country);
      const merchant = (state.merchants ?? []).find(
        (entry: any) => entry.id === input.merchantId,
      );
      if (
        !merchant ||
        merchant.status !== "active" ||
        !customerCountry ||
        normalizeCountry(merchant.country) !== customerCountry
      ) {
        throw new CashbackError(400, "MERCHANT_UNAVAILABLE");
      }
      const claimHours = Math.max(1, Number(state.settings?.claimHours ?? 720));
      if (Date.now() - date.getTime() > claimHours * 60 * 60 * 1000) {
        throw new CashbackError(400, "RECEIPT_TOO_OLD");
      }
      state.claims ??= [];
      if (
        uploadedPhoto &&
        state.claims.some((claim: any) => claim.uploadId === uploadedPhoto?.uploadId)
      ) {
        suspiciousReceipt = { merchantId: merchant.id, merchantName: merchant.name, reason: "RECEIPT_UPLOAD_ALREADY_USED" };
        throw new CashbackError(409, "RECEIPT_UPLOAD_ALREADY_USED");
      }
      const sameInvoice = invoiceNumber &&
        state.claims.some((claim: any) =>
          claim.mid === merchant.id &&
          String(claim.invoiceNumber ?? claim.no ?? "").trim().toLowerCase() === invoiceNumber.toLowerCase(),
        );
      if (sameInvoice) {
        suspiciousReceipt = { merchantId: merchant.id, merchantName: merchant.name, reason: "DUPLICATE_INVOICE_NUMBER" };
        throw new CashbackError(409, "DUPLICATE_RECEIPT");
      }
      const sameImage = state.claims.some((claim: any) =>
        claim.imageHash === image.hash ||
        claim.ph === legacyPhotoHash(image.data),
      );
      if (sameImage) {
        suspiciousReceipt = { merchantId: merchant.id, merchantName: merchant.name, reason: "DUPLICATE_IMAGE" };
        throw new CashbackError(409, "DUPLICATE_RECEIPT");
      }
      const possibleDuplicate = !invoiceNumber && state.claims.some(
        (claim: any) =>
          claim.mid === merchant.id &&
          claim.cid === customer.id &&
          claim.date === dateOnly &&
          Math.round(Number(claim.amount || 0) * 100) === Math.round(amount * 100) &&
          claim.status !== "cancelled",
      );
      const value = {
        id: claimId,
        mid: merchant.id,
        cid: customer.id,
        invoiceNumber: invoiceNumber || null,
        no: invoiceNumber || null,
        date: dateOnly,
        amount,
        photoId: mediaId,
        imageHash: image.hash,
        ...(uploadedPhoto ? { uploadId: uploadedPhoto.uploadId } : {}),
        ...(possibleDuplicate ? { possibleDuplicate: true } : {}),
        submitIp: String(req.ip ?? ""),
        status: "pending",
        created: Date.now(),
        submittedByUid: profile.uid,
      };
      state.claims.unshift(value);
      addCashbackNotification(state, "admin", "admin.receipt.new", {
        customer: customer.name,
        merchant: merchant.name,
        customerId: customer.id,
        merchantId: merchant.id,
        receiptId: claimId,
        amount,
      });
      if (possibleDuplicate) {
        addCashbackNotification(state, "admin", "admin.security.suspicious_receipt", {
          customerId: customer.id,
          merchant: merchant.name,
          reason: "SAME_STORE_CUSTOMER_DATE_AND_AMOUNT",
          dedupeKey: `receipt:${customer.id}:${merchant.id}:${dateOnly}:${amount}`,
          receiptId: claimId,
          ip: String(req.ip ?? ""),
        });
      }
      addCashbackNotification(state, customer.id, "customer.receipt.submitted", {
        merchant: merchant.name,
        receiptId: claimId,
      });
      addCashbackNotification(state, merchant.id, "merchant.receipt.new", {
        customer: customer.name,
        receiptId: claimId,
      });
      return {
        result: value,
        extraWrites: [
          documentWrite("photos", mediaId, {
            ...(uploadedPhoto
              ? {
                  objectPath: uploadedPhoto.objectPath,
                  size: uploadedPhoto.size,
                }
              : { data: image.data }),
            contentType: image.type,
            ownerUid: profile.uid,
            kind: "receipt",
          }, false),
        ],
      };
    });
    res.status(201).json(receipt);
  } catch (error) {
    logReceiptFailure(req, "receipt-submit", error);
    if (
      suspiciousReceipt &&
      error instanceof CashbackError &&
      ["DUPLICATE_RECEIPT", "RECEIPT_UPLOAD_ALREADY_USED"].includes(error.code)
    ) {
      try {
        await mutateState((state) => {
          addCashbackNotification(state, "admin", "admin.security.suspicious_receipt", {
            customerId: profile.eid,
            merchant: suspiciousReceipt?.merchantName ?? "unknown",
            merchantId: suspiciousReceipt?.merchantId,
            reason: suspiciousReceipt?.reason ?? error.code,
            dedupeKey: `receipt-attempt:${profile.eid}:${suspiciousReceipt?.merchantId ?? "unknown"}:${error.code}`,
            ip: String(req.ip ?? ""),
          });
          return { result: { ok: true } };
        });
      } catch {
        // Do not replace the original receipt error if alert persistence fails.
      }
    }
    respondError(res, error);
  }
});

function legacyPhotoHash(value: string): string {
  let hash = 5381;
  for (let index = 0; index < value.length; index += 7) {
    hash = ((hash << 5) + hash + value.charCodeAt(index)) | 0;
  }
  return `${hash >>> 0}:${value.length}`;
}

function getParamId(req: any): string {
  const raw = req.params.id;
  const id = Array.isArray(raw) ? raw[0] : raw;
  if (typeof id !== "string" || !/^[\w-]{1,80}$/.test(id)) {
    throw new CashbackError(400, "INVALID_ID");
  }
  return id;
}

router.patch("/cashback/receipts/:id/decision", async (req, res) => {
  const profile = (req as unknown as AuthenticatedRequest).cashbackProfile;
  try {
    requireAdmin(profile);
    const id = getParamId(req);
    const parsed = DecideCashbackReceiptBody.safeParse(req.body);
    if (!parsed.success) throw new CashbackError(400, "INVALID_REQUEST");
    await mutateState((state) => {
      const claim = (state.claims ?? []).find((entry: any) => entry.id === id);
      if (!claim) throw new CashbackError(404, "RECEIPT_NOT_FOUND");
      if (claim.status !== "pending") throw new CashbackError(409, "RECEIPT_ALREADY_REVIEWED");
      const merchant = (state.merchants ?? []).find((entry: any) => entry.id === claim.mid);
      const customer = (state.customers ?? []).find((entry: any) => entry.id === claim.cid);
      if (!merchant || !customer) throw new CashbackError(409, "RECEIPT_PROFILE_MISSING");
      if (parsed.data.approved) {
        const cashbackRate = Number(merchant.cashbackRate ?? state.settings?.cashback ?? 4);
        const platformCommissionRate = Number(
          merchant.platformCommissionRate ?? state.settings?.platformCommission ?? 2,
        );
        if (
          !Number.isFinite(cashbackRate) ||
          !Number.isFinite(platformCommissionRate) ||
          cashbackRate < 0 ||
          platformCommissionRate < 0 ||
          cashbackRate + platformCommissionRate > 100
        ) {
          throw new CashbackError(409, "INVALID_COMMISSION_CONFIGURATION");
        }
        const amounts = calculateCommissionAmounts(
          Number(claim.amount),
          cashbackRate,
          platformCommissionRate,
        );
        const cashback = amounts.cashbackAmount;
        const platformCommission = amounts.platformCommissionAmount;
        const merchantObligation = amounts.merchantObligationAmount;
        const commissionEntry = {
          id: `com_${randomUUID().replaceAll("-", "").slice(0, 18)}`,
          merchantId: merchant.id,
          customerId: customer.id,
          receiptId: claim.id,
          invoiceNumber: claim.invoiceNumber ?? null,
          country: merchant.country ?? null,
          currency: merchant.country === "Libya" ? "LYD" : "DZD",
          invoiceAmount: claim.amount,
          cashbackRate,
          platformCommissionRate,
          cashbackAmount: cashback,
          platformCommissionAmount: platformCommission,
          merchantObligationAmount: merchantObligation,
          netSaleAmount: amounts.netSaleAmount,
          rewardOutstanding: cashback,
          platformCommissionOutstanding: platformCommission,
          settledReward: 0,
          settledPlatformCommission: 0,
          settledAmount: 0,
          outstandingAmount: merchantObligation,
          status: "due",
          createdAt: Date.now(),
        };
        state.merchantCommissionLedger ??= [];
        state.merchantCommissionLedger.unshift(commissionEntry);
        customer.cbm ??= {};
        customer.cbm[merchant.id] = Math.round(
          (Number(customer.cbm[merchant.id] ?? 0) + cashback) * 100,
        ) / 100;
        const settlement = settleMerchantCommissionObligations(state, merchant, claim.id);
        claim.status = "approved";
        claim.cashback = cashback;
        claim.reviewedAt = Date.now();
        claim.reviewedBy = profile.uid;
        state.audit ??= [];
        state.audit.unshift({
          id: `audit_${randomUUID().replaceAll("-", "").slice(0, 18)}`,
          action: "invoice_commission_accrued",
          receiptId: claim.id,
          commissionEntryId: commissionEntry.id,
          merchantId: merchant.id,
          customerId: customer.id,
          invoiceAmount: claim.amount,
          cashbackAmount: cashback,
          platformCommissionAmount: platformCommission,
          merchantObligationAmount: merchantObligation,
          netSaleAmount: commissionEntry.netSaleAmount,
          settledAmount: settlement.amount,
          outstandingAmount: commissionEntry.outstandingAmount,
          adminUid: profile.uid,
          at: Date.now(),
        });
        state.txns ??= [];
        state.txns.unshift({
          id: `tx_${randomUUID().replaceAll("-", "").slice(0, 18)}`,
          t: Date.now(),
          mid: merchant.id,
          cid: customer.id,
          amount: claim.amount,
          cashback,
          method: "receipt",
          receiptId: claim.id,
        });
        addCashbackNotification(state, merchant.id, "merchant.invoice.approved", {
          receiptId: claim.invoiceNumber || claim.id,
          obligation: merchantObligation,
          settled: settlement.amount,
          outstanding: commissionEntry.outstandingAmount,
          currency: commissionEntry.currency,
        });
        addCashbackNotification(state, customer.id, "customer.receipt.approved", {
          merchant: merchant.name,
          receiptId: claim.id,
        });
        addCashbackNotification(state, customer.id, "customer.reward.added", {
          merchant: merchant.name,
          amount: cashback,
          currency: commissionEntry.currency,
          receiptId: claim.id,
        });
        addCashbackNotification(state, customer.id, "customer.balance.updated", {
          merchant: merchant.name,
          balance: Number(customer.cbm[merchant.id] ?? 0),
          currency: commissionEntry.currency,
          receiptId: claim.id,
        });
      } else {
        claim.status = "rejected";
        claim.reviewedAt = Date.now();
        claim.reviewedBy = profile.uid;
        claim.reason = fieldString(parsed.data.reason ?? "") || "RECEIPT_REJECTED";
        addCashbackNotification(state, customer.id, "customer.receipt.rejected", {
          merchant: merchant.name,
          reason: claim.reason,
          receiptId: claim.id,
        });
      }
      return { result: { id, status: claim.status, cashback: claim.cashback ?? 0 } };
    });
    res.json({ ok: true });
  } catch (error) {
    respondError(res, error);
  }
});

router.delete("/cashback/receipts/:id", async (req, res) => {
  const profile = (req as unknown as AuthenticatedRequest).cashbackProfile;
  try {
    unauthorizedRole(profile, "customer");
    const receiptId = getParamId(req);
    await mutateState((state) => {
      const claim = (state.claims ?? []).find(
        (entry: any) => entry.id === receiptId,
      );
      if (!claim || claim.cid !== profile.eid) {
        throw new CashbackError(404, "RECEIPT_NOT_FOUND");
      }
      if (claim.status !== "pending") {
        throw new CashbackError(409, "RECEIPT_NOT_CANCELLABLE");
      }
      claim.status = "cancelled";
      claim.cancelledAt = Date.now();
      addCashbackNotification(state, "admin", "admin.receipt.cancelled", {
        customerId: profile.eid,
        receiptId,
      });
      addCashbackNotification(state, profile.eid, "customer.receipt.cancelled", { receiptId });
      return { result: { ok: true } };
    });
    res.json({ ok: true });
  } catch (error) {
    respondError(res, error);
  }
});

router.patch("/cashback/merchants/:id/decision", async (req, res) => {
  const profile = (req as unknown as AuthenticatedRequest).cashbackProfile;
  try {
    requireAdmin(profile);
    const id = getParamId(req);
    const parsed = DecideCashbackMerchantBody.safeParse(req.body);
    if (!parsed.success) throw new CashbackError(400, "INVALID_REQUEST");
    await mutateState((state) => {
      const merchant = (state.merchants ?? []).find((entry: any) => entry.id === id);
      if (!merchant) throw new CashbackError(404, "MERCHANT_NOT_FOUND");
      if (merchant.status !== "pending") throw new CashbackError(409, "MERCHANT_ALREADY_REVIEWED");
      if (parsed.data.approved) {
        merchant.status = "active";
        const existingIds = new Set(
          (state.merchants ?? [])
            .filter((entry: any) => entry.id !== merchant.id)
            .map((entry: any) => entry.publicId)
            .filter((publicId: unknown): publicId is string => typeof publicId === "string"),
        );
        if (!merchant.publicId || existingIds.has(merchant.publicId)) {
          do {
            merchant.publicId = `CB-${randomUUID().replaceAll("-", "").slice(0, 16).toUpperCase()}`;
          } while (existingIds.has(merchant.publicId));
        }
        merchant.qrValue = `cashback://merchant/${merchant.publicId}`;
        merchant.activatedAt = Date.now();
        addCashbackNotification(state, merchant.id, "merchant.application.approved", {
          merchant: merchant.name,
        });
      } else {
        const reason = fieldString(parsed.data.reason ?? "");
        if (!reason) throw new CashbackError(400, "REJECTION_REASON_REQUIRED");
        merchant.status = "rejected";
        merchant.rejectionReason = reason;
        merchant.rejectedAt = Date.now();
        addCashbackNotification(state, merchant.id, "merchant.application.rejected", {
          merchant: merchant.name,
          reason: merchant.rejectionReason,
        });
      }
      return { result: { id: merchant.id, status: merchant.status } };
    });
    res.json({ ok: true });
  } catch (error) {
    respondError(res, error);
  }
});

router.post("/cashback/merchants/:id/rating", async (req, res) => {
  const profile = (req as unknown as AuthenticatedRequest).cashbackProfile;
  try {
    unauthorizedRole(profile, "customer");
    const parsed = RateCashbackMerchantBody.safeParse(req.body);
    if (!parsed.success) throw new CashbackError(400, "INVALID_RATING");
    const merchantId = getParamId(req);
    await mutateState((state) => {
      const merchant = (state.merchants ?? []).find(
        (entry: any) => entry.id === merchantId && entry.status === "active",
      );
      if (!merchant) throw new CashbackError(404, "MERCHANT_UNAVAILABLE");
      const customer = (state.customers ?? []).find(
        (entry: any) => entry.id === profile.eid,
      );
      const customerCountry = normalizeCountry(customer?.country ?? profile.country);
      if (!customerCountry || normalizeCountry(merchant.country) !== customerCountry) {
        throw new CashbackError(404, "MERCHANT_UNAVAILABLE");
      }
      const eligible = (state.claims ?? []).some(
        (claim: any) =>
          claim.mid === merchantId &&
          claim.cid === profile.eid &&
          claim.status === "approved",
      );
      if (!eligible) {
        throw new CashbackError(403, "RATING_REQUIRES_APPROVED_RECEIPT");
      }
      state.ratings ??= [];
      const existing = state.ratings.find(
        (rating: any) => rating.mid === merchantId && rating.cid === profile.eid,
      );
      if (existing) {
        existing.rating = parsed.data.rating;
        existing.updatedAt = Date.now();
      } else {
        state.ratings.push({
          id: `rating_${randomUUID().replaceAll("-", "").slice(0, 18)}`,
          mid: merchantId,
          cid: profile.eid,
          rating: parsed.data.rating,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      }
      return { result: { ok: true } };
    });
    res.json({ ok: true });
  } catch (error) {
    respondError(res, error);
  }
});

router.post("/cashback/wallet/redemptions", async (req, res) => {
  const profile = (req as unknown as AuthenticatedRequest).cashbackProfile;
  try {
    unauthorizedRole(profile, "customer");
    const parsed = RedeemMerchantCashbackBody.safeParse(req.body);
    if (!parsed.success) throw new CashbackError(400, "INVALID_REQUEST");
    const amount = Math.round(Number(parsed.data.amount) * 100) / 100;
    if (!(amount > 0) || !Number.isFinite(amount)) {
      throw new CashbackError(400, "INVALID_AMOUNT");
    }
    const result = await mutateState((state) => {
      const paymentSessions = (state.paymentSessions ??= []);
      const paymentSession = paymentSessions.find(
        (entry: any) => entry.id === parsed.data.sessionId,
      );
      if (
        !paymentSession ||
        paymentSession.customerId !== profile.eid ||
        paymentSession.customerUid !== profile.uid
      ) {
        throw new CashbackError(404, "PAYMENT_SESSION_NOT_FOUND");
      }
      if (paymentSession.status === "completed") {
        const previous = (state.cbpays ?? []).find(
          (entry: any) => entry.id === paymentSession.paymentId,
        );
        if (
          previous &&
          previous.status === "done" &&
          Number(previous.amount) === amount
        ) {
          return {
            result: {
              id: previous.id,
              reference: previous.reference,
              status: "done",
              amount: previous.amount,
              merchantId: previous.mid,
              remainingBalance: previous.remainingBalance,
              merchantBalance: previous.merchantBalance,
              at: previous.at,
            },
          };
        }
        throw new CashbackError(409, "PAYMENT_SESSION_ALREADY_USED");
      }
      if (
        paymentSession.status !== "pending" ||
        Number(paymentSession.expiresAt) <= Date.now()
      ) {
        throw new CashbackError(410, "PAYMENT_SESSION_EXPIRED");
      }
      const customer = (state.customers ?? []).find(
        (entry: any) => entry.id === profile.eid,
      );
      const merchant = (state.merchants ?? []).find(
        (entry: any) => entry.id === paymentSession.merchantId,
      );
      if (!customer) throw new CashbackError(403, "PROFILE_INCOMPLETE");
      const customerCountry = normalizeCountry(customer.country ?? profile.country);
      if (
        !merchant ||
        merchant.status !== "active" ||
        merchant.publicId !== paymentSession.publicId ||
        merchant.qrValue !== paymentSession.qrValue ||
        !customerCountry ||
        normalizeCountry(merchant.country) !== customerCountry
      ) {
        throw new CashbackError(400, "QR_MERCHANT_UNAVAILABLE");
      }
      customer.cbm ??= {};
      const available = Math.round(Number(customer.cbm[merchant.id] ?? 0) * 100) / 100;
      if (amount > available) throw new CashbackError(400, "INSUFFICIENT_MERCHANT_BALANCE");
      customer.cbm[merchant.id] = Math.round((available - amount) * 100) / 100;
      if (customer.cbm[merchant.id] <= 0) delete customer.cbm[merchant.id];
      state.cbpays ??= [];
      const at = Date.now();
      const id = `pay_${randomUUID().replaceAll("-", "").slice(0, 18)}`;
      let reference = "";
      do {
        reference = `CBP-${randomUUID().replaceAll("-", "").slice(0, 16).toUpperCase()}`;
      } while (state.cbpays.some((entry: any) => entry.reference === reference));
      const previousDebt = Math.max(0, Number(merchant.payoutDebt ?? 0));
      const debtSettled = Math.min(previousDebt, amount);
      merchant.payoutDebt = Math.round((previousDebt - debtSettled) * 100) / 100;
      merchant.payoutBalance = Math.round(
        (Number(merchant.payoutBalance ?? 0) + amount - debtSettled) * 100,
      ) / 100;
      const payment = {
        id,
        reference,
        cid: customer.id,
        mid: merchant.id,
        customerUid: profile.uid,
        merchantUid: merchant.profileUid,
        amount,
        status: "done",
        method: "qr",
        sessionId: paymentSession.id,
        at,
        done: at,
        remainingBalance: Number(customer.cbm[merchant.id] ?? 0),
        merchantBalance: Number(merchant.payoutBalance ?? 0),
      };
      state.cbpays.unshift(payment);
      paymentSession.status = "completed";
      paymentSession.completedAt = at;
      paymentSession.paymentId = id;
      paymentSession.amount = amount;
      state.audit ??= [];
      state.audit.unshift({
        id: `audit_${randomUUID().replaceAll("-", "").slice(0, 18)}`,
        action: "qr_payment_completed",
        reference,
        paymentId: id,
        sessionId: paymentSession.id,
        customerId: customer.id,
        merchantId: merchant.id,
        amount,
        at,
      });
      const currency = merchant.country === "Libya" ? "LYD" : "DZD";
      addCashbackNotification(state, merchant.id, "merchant.qr.payment.received", {
        merchant: merchant.name,
        customer: customer.name,
        amount,
        currency,
        reference,
      });
      addCashbackNotification(state, customer.id, "customer.qr.payment.completed", {
        merchant: merchant.name,
        amount,
        currency,
        reference,
      });
      addCashbackNotification(state, customer.id, "customer.balance.updated", {
        merchant: merchant.name,
        balance: Number(customer.cbm[merchant.id] ?? 0),
        currency,
        reference,
      });
      return {
        result: {
          id,
          reference,
          status: "done",
          amount,
          merchantId: merchant.id,
          remainingBalance: Number(customer.cbm[merchant.id] ?? 0),
          merchantBalance: Number(merchant.payoutBalance ?? 0),
          at,
        },
      };
    });
    res.status(201).json(result);
  } catch (error) {
    await recordFailedPayment(profile, req, error, {
      sessionId: typeof req.body?.sessionId === "string" ? req.body.sessionId.slice(0, 100) : undefined,
    });
    respondError(res, error);
  }
});

router.post("/cashback/wallet/payment-sessions", async (req, res) => {
  const profile = (req as AuthenticatedRequest).cashbackProfile;
  try {
    unauthorizedRole(profile, "customer");
    const parsed = CreateCashbackPaymentSessionBody.safeParse(req.body);
    if (!parsed.success) throw new CashbackError(400, "INVALID_REQUEST");
    const result = await mutateState((state) => {
      const merchant = (state.merchants ?? []).find(
        (entry: any) => entry.id === parsed.data.merchantId,
      );
      if (
        !merchant ||
        merchant.status !== "active" ||
        !merchant.publicId ||
        !merchant.qrValue ||
        parsed.data.qrValue !== merchant.qrValue
      ) {
        throw new CashbackError(400, "QR_INVALID_OR_WRONG_MERCHANT");
      }
      const customer = (state.customers ?? []).find(
        (entry: any) => entry.id === profile.eid,
      );
      if (!customer) throw new CashbackError(403, "PROFILE_INCOMPLETE");
      const customerCountry = normalizeCountry(customer.country ?? profile.country);
      if (!customerCountry || normalizeCountry(merchant.country) !== customerCountry) {
        throw new CashbackError(400, "QR_INVALID_OR_WRONG_MERCHANT");
      }
      const balance = Math.round(
        Number(customer.cbm?.[merchant.id] ?? 0) * 100,
      ) / 100;
      if (!(balance > 0)) {
        throw new CashbackError(400, "INSUFFICIENT_MERCHANT_BALANCE");
      }
      const now = Date.now();
      const paymentSessions = (state.paymentSessions ??= []);
      state.paymentSessions = paymentSessions.filter(
        (entry: any) =>
          Number(entry.expiresAt) > now ||
          (entry.status !== "pending" &&
            Number(entry.createdAt) > now - 24 * 60 * 60 * 1000),
      );
      const session = {
        id: randomUUID().replaceAll("-", ""),
        customerId: profile.eid,
        customerUid: profile.uid,
        merchantId: merchant.id,
        publicId: merchant.publicId,
        qrValue: merchant.qrValue,
        status: "pending",
        createdAt: now,
        expiresAt: now + QR_PAYMENT_SESSION_TTL_MS,
      };
      state.paymentSessions.unshift(session);
      state.paymentSessions.length = Math.min(state.paymentSessions.length, 5000);
      return {
        result: {
          sessionId: session.id,
          merchantId: merchant.id,
          merchantName: merchant.name,
          country: merchant.country ?? null,
          balance,
          expiresAt: session.expiresAt,
        },
      };
    });
    res.status(201).json(result);
  } catch (error) {
    await recordFailedPayment(profile, req, error, {
      merchantId: typeof req.body?.merchantId === "string" ? req.body.merchantId.slice(0, 100) : undefined,
    });
    respondError(res, error);
  }
});

router.post("/cashback/wallet/payments/:id/reversal", async (req, res) => {
  const profile = (req as unknown as AuthenticatedRequest).cashbackProfile;
  try {
    requireAdmin(profile);
    const params = ReverseCashbackPaymentParams.safeParse(req.params);
    const parsed = ReverseCashbackPaymentBody.safeParse(req.body);
    if (!params.success || !parsed.success) {
      throw new CashbackError(400, "INVALID_REQUEST");
    }
    const paymentId = params.data.id;
    const reason = fieldString(parsed.data.reason);
    await mutateState((state) => {
      const payment = (state.cbpays ?? []).find(
        (entry: any) => entry.id === paymentId,
      );
      if (!payment) throw new CashbackError(404, "PAYMENT_NOT_FOUND");
      if (payment.status !== "done" || payment.method !== "qr") {
        throw new CashbackError(409, "PAYMENT_NOT_REVERSIBLE");
      }
      const customer = (state.customers ?? []).find(
        (entry: any) => entry.id === payment.cid,
      );
      const merchant = (state.merchants ?? []).find(
        (entry: any) => entry.id === payment.mid,
      );
      if (!customer || !merchant) {
        throw new CashbackError(409, "PAYMENT_PARTY_NOT_FOUND");
      }
      const amount = Math.round(Number(payment.amount) * 100) / 100;
      customer.cbm ??= {};
      customer.cbm[merchant.id] = Math.round(
        (Number(customer.cbm[merchant.id] ?? 0) + amount) * 100,
      ) / 100;
      const available = Math.max(0, Number(merchant.payoutBalance ?? 0));
      const recovered = Math.min(available, amount);
      const debtAdded = Math.round((amount - recovered) * 100) / 100;
      merchant.payoutBalance = Math.round((available - recovered) * 100) / 100;
      merchant.payoutDebt = Math.round(
        (Number(merchant.payoutDebt ?? 0) + debtAdded) * 100,
      ) / 100;
      payment.status = "reversed";
      payment.reversedAt = Date.now();
      payment.reversedBy = profile.uid;
      payment.reversalReason = reason;
      const session = (state.paymentSessions ?? []).find(
        (entry: any) => entry.id === payment.sessionId,
      );
      if (session) {
        session.status = "reversed";
        session.reversedAt = payment.reversedAt;
      }
      state.audit ??= [];
      state.audit.unshift({
        id: `audit_${randomUUID().replaceAll("-", "").slice(0, 18)}`,
        action: "qr_payment_reversed",
        reference: payment.reference,
        paymentId: payment.id,
        customerId: customer.id,
        merchantId: merchant.id,
        amount,
        reason,
        adminUid: profile.uid,
        at: payment.reversedAt,
        merchantDebtAdded: debtAdded,
      });
      const currency = merchant.country === "Libya" ? "LYD" : "DZD";
      addCashbackNotification(state, customer.id, "customer.payment.reversed", {
        merchant: merchant.name,
        amount: payment.amount,
        currency,
        reference: payment.reference,
      });
      addCashbackNotification(state, merchant.id, "merchant.payment.reversed", {
        amount: payment.amount,
        currency,
        reference: payment.reference,
      });
      return { result: { ok: true } };
    });
    res.json({ ok: true });
  } catch (error) {
    respondError(res, error);
  }
});

router.patch("/cashback/profile/preferences", async (req, res) => {
  const profile = (req as AuthenticatedRequest).cashbackProfile;
  try {
    const parsed = UpdateCashbackPreferencesBody.safeParse(req.body);
    if (!parsed.success) throw new CashbackError(400, "INVALID_REQUEST");
    if (parsed.data.country && profile.role !== "customer") {
      throw new CashbackError(403, "CUSTOMER_COUNTRY_ONLY");
    }
    const { state } = await getState();
    const languages = state.settings?.enabledLanguages;
    if (Array.isArray(languages) && !languages.includes(parsed.data.language)) {
      throw new CashbackError(400, "LANGUAGE_UNAVAILABLE");
    }
    res.json(await savePreferences(profile, parsed.data));
  } catch (error) {
    respondError(res, error);
  }
});

router.post("/cashback/profile/photo/upload-url", async (req, res) => {
  const profile = (req as AuthenticatedRequest).cashbackProfile;
  try {
    const parsed = CreateCashbackProfilePhotoUploadBody.safeParse(req.body);
    if (!parsed.success) throw new CashbackError(400, "INVALID_REQUEST");
    const uploadId = `avatar_${randomUUID().replaceAll("-", "")}`;
    const { uploadURL, objectPath } = await createProfilePhotoUpload(
      profile.uid,
      parsed.data.contentType,
      parsed.data.size,
    );
    const createdAt = Date.now();
    const stored = await commit([
      documentWrite("profile_photo_uploads", uploadId, {
        uid: profile.uid,
        objectPath,
        contentType: parsed.data.contentType,
        declaredSize: parsed.data.size,
        createdAt,
        expiresAt: createdAt + 10 * 60 * 1000,
      }, false),
    ]);
    if (!stored) throw new CashbackError(503, "PHOTO_UPLOAD_CREATE_FAILED");
    res.status(201).json(
      CreateCashbackProfilePhotoUploadResponse.parse({ uploadURL, objectPath, uploadId }),
    );
  } catch (error) {
    respondError(res, error);
  }
});

router.patch("/cashback/profile/photo", async (req, res) => {
  const profile = (req as AuthenticatedRequest).cashbackProfile;
  try {
    const parsed = SaveCashbackProfilePhotoBody.safeParse(req.body);
    if (!parsed.success) throw new CashbackError(400, "INVALID_REQUEST");
    const uploadPath = `profile_photo_uploads/${parsed.data.uploadId}`;
    const uploadDoc = await getDocument(uploadPath);
    const upload = decodeCashbackFields(uploadDoc);
    if (
      !uploadDoc ||
      upload.uid !== profile.uid ||
      upload.objectPath !== parsed.data.objectPath ||
      upload.finalizedAt ||
      Number(upload.expiresAt ?? 0) <= Date.now()
    ) {
      throw new CashbackError(400, "PHOTO_UPLOAD_EXPIRED");
    }

    const file = await getProfilePhotoFile(upload.objectPath);
    const [metadata] = await file.getMetadata();
    const contentType = String(metadata.contentType ?? "");
    const size = Number(metadata.size ?? 0);
    if (
      contentType !== upload.contentType ||
      !["image/jpeg", "image/png", "image/webp"].includes(contentType) ||
      !Number.isFinite(size) ||
      size <= 0 ||
      size > 5 * 1024 * 1024 ||
      size > Number(upload.declaredSize) ||
      !(await profilePhotoMatchesType(file, contentType))
    ) {
      throw new CashbackError(400, "INVALID_IMAGE");
    }

    const profilePath = `users/${profile.uid}`;
    const profileDoc = await getDocument(profilePath);
    if (!profileDoc) throw new CashbackError(404, "PROFILE_NOT_FOUND");
    const fields = decodeCashbackFields(profileDoc);
    const avatarUpdatedAt = Math.max(Date.now(), Number(fields.avatarUpdatedAt ?? 0) + 1);
    const pendingUpdate = documentWrite("profile_photo_uploads", parsed.data.uploadId, {
      ...upload,
      finalizedAt: avatarUpdatedAt,
    }, true);
    pendingUpdate.currentDocument = { updateTime: uploadDoc.updateTime };
    const profileUpdate = documentWrite("users", profile.uid, {
      ...fields,
      avatarObjectPath: upload.objectPath,
      avatarUpdatedAt,
    }, true);
    profileUpdate.currentDocument = { updateTime: profileDoc.updateTime };
    const saved = await commit([pendingUpdate, profileUpdate]);
    if (!saved) throw new CashbackError(409, "PROFILE_UPDATE_CONFLICT");
    res.json(SaveCashbackProfilePhotoResponse.parse({ avatarUpdatedAt }));
  } catch (error) {
    respondError(res, error);
  }
});

router.get("/cashback/profile/photo", async (req, res) => {
  const profile = (req as AuthenticatedRequest).cashbackProfile;
  try {
    const profileDoc = await getDocument(`users/${profile.uid}`);
    const fields = decodeCashbackFields(profileDoc);
    const objectPath = String(fields.avatarObjectPath ?? "");
    if (!objectPath) throw new CashbackError(404, "MEDIA_NOT_FOUND");
    const photo = await readProfilePhoto(objectPath);
    res.setHeader("content-type", photo.contentType);
    res.setHeader("content-length", String(photo.size));
    res.setHeader("cache-control", "private, max-age=300");
    res.setHeader("x-content-type-options", "nosniff");
    photo.body.on("error", (error) => {
      req.log.warn({ err: error }, "Could not stream profile photo");
      if (!res.headersSent) res.status(500).end();
      else res.destroy(error);
    });
    photo.body.pipe(res);
  } catch (error) {
    respondError(res, error);
  }
});

router.patch("/cashback/settings/rate", async (req, res) => {
  const profile = (req as AuthenticatedRequest).cashbackProfile;
  try {
    requireAdmin(profile);
    const parsed = UpdateCashbackRateBody.safeParse(req.body);
    if (!parsed.success) throw new CashbackError(400, "INVALID_REQUEST");
    const rate = Number(parsed.data.rate);
    let platformCommissionRate = 2;
    await mutateState((state) => {
      state.settings ??= {};
      platformCommissionRate = Number(
        parsed.data.platformCommissionRate ?? state.settings.platformCommission ?? 2,
      );
      if (rate + platformCommissionRate > 100) {
        throw new CashbackError(400, "TOTAL_COMMISSION_EXCEEDS_100");
      }
      const invalidMerchant = (state.merchants ?? []).some((merchant: any) =>
        Number(merchant.cashbackRate ?? rate) +
          Number(merchant.platformCommissionRate ?? platformCommissionRate) > 100,
      );
      if (invalidMerchant) throw new CashbackError(409, "MERCHANT_COMMISSION_CONFIGURATION_CONFLICT");
      const previousRates = {
        cashback: Number(state.settings.cashback ?? 4),
        platformCommission: Number(state.settings.platformCommission ?? 2),
      };
      state.settings.cashback = rate;
      state.settings.platformCommission = platformCommissionRate;
      state.merchants ??= [];
      state.merchants.forEach((merchant: any) => {
        if (merchant.cashbackRate == null) merchant.cashbackRate = null;
      });
      state.audit ??= [];
      state.audit.unshift({
        id: `audit_${randomUUID().replaceAll("-", "").slice(0, 18)}`,
        action: "program_commission_rates_updated",
        previousRates,
        rates: { cashback: rate, platformCommission: platformCommissionRate },
        adminUid: profile.uid,
        at: Date.now(),
      });
      return { result: { rate, platformCommissionRate } };
    });
    res.json({ ok: true, rate, platformCommissionRate });
  } catch (error) {
    respondError(res, error);
  }
});

router.patch("/cashback/settings/categories", async (req, res) => {
  const profile = (req as AuthenticatedRequest).cashbackProfile;
  try {
    unauthorizedRole(profile, "admin");
    const parsed = UpdateCashbackCategoriesBody.safeParse(req.body);
    if (!parsed.success) throw new CashbackError(400, "INVALID_CATEGORIES");
    const categories = [...new Set(parsed.data.categories)];
    await mutateState((state) => {
      state.categories = categories;
      return { result: { ok: true, categories } };
    });
    res.json({ ok: true, categories });
  } catch (error) {
    respondError(res, error);
  }
});

router.patch("/cashback/settings/system", async (req, res) => {
  const profile = (req as AuthenticatedRequest).cashbackProfile;
  try {
    requireAdmin(profile);
    const parsed = UpdateCashbackSystemSettingsBody.safeParse(req.body);
    if (!parsed.success || !Object.keys(parsed.data).length) {
      throw new CashbackError(400, "INVALID_REQUEST");
    }
    let savedSettings: Record<string, unknown> = {};
    await mutateState((state) => {
      state.settings ??= {};
      const minimumTopupDzd = parsed.data.minimumTopupDzd ?? state.settings.minimumTopupDzd ?? 1000;
      const minimumTopupLyd = parsed.data.minimumTopupLyd ?? state.settings.minimumTopupLyd ?? 10;
      if (state.settings.maxTopupAmountDzd != null && minimumTopupDzd > Number(state.settings.maxTopupAmountDzd)) {
        throw new CashbackError(400, "MINIMUM_EXCEEDS_MAXIMUM");
      }
      if (state.settings.maxTopupAmountLyd != null && minimumTopupLyd > Number(state.settings.maxTopupAmountLyd)) {
        throw new CashbackError(400, "MINIMUM_EXCEEDS_MAXIMUM");
      }
      const before = {
        claimHours: Number(state.settings.claimHours ?? 720),
        minimumTopupDzd: Number(state.settings.minimumTopupDzd ?? 1000),
        minimumTopupLyd: Number(state.settings.minimumTopupLyd ?? 10),
        enabledCurrencies: state.settings.enabledCurrencies ?? ["DZD", "LYD"],
        enabledLanguages: state.settings.enabledLanguages ?? ["ar", "en", "fr"],
        notificationsEnabled: state.settings.notificationsEnabled !== false,
      };
      if (parsed.data.claimHours !== undefined) state.settings.claimHours = parsed.data.claimHours;
      if (parsed.data.minimumTopupDzd !== undefined) state.settings.minimumTopupDzd = parsed.data.minimumTopupDzd;
      if (parsed.data.minimumTopupLyd !== undefined) state.settings.minimumTopupLyd = parsed.data.minimumTopupLyd;
      if (parsed.data.enabledCurrencies !== undefined) state.settings.enabledCurrencies = parsed.data.enabledCurrencies;
      if (parsed.data.enabledLanguages !== undefined) state.settings.enabledLanguages = parsed.data.enabledLanguages;
      if (parsed.data.notificationsEnabled !== undefined) state.settings.notificationsEnabled = parsed.data.notificationsEnabled;
      savedSettings = {
        claimHours: Number(state.settings.claimHours ?? 720),
        minimumTopupDzd: Number(state.settings.minimumTopupDzd ?? 1000),
        minimumTopupLyd: Number(state.settings.minimumTopupLyd ?? 10),
        enabledCurrencies: state.settings.enabledCurrencies,
        enabledLanguages: state.settings.enabledLanguages,
        notificationsEnabled: state.settings.notificationsEnabled !== false,
      };
      state.audit ??= [];
      state.audit.unshift({
        id: `audit_${randomUUID().replaceAll("-", "").slice(0, 18)}`,
        action: "system_settings_updated",
        before,
        settings: savedSettings,
        adminUid: profile.uid,
        at: Date.now(),
      });
      return { result: savedSettings };
    });
    res.json({ ok: true, settings: savedSettings });
  } catch (error) {
    respondError(res, error);
  }
});

router.patch("/cashback/admin/customers/:id/status", async (req, res) => {
  const profile = (req as unknown as AuthenticatedRequest).cashbackProfile;
  try {
    requireAdmin(profile);
    const id = getParamId(req);
    const parsed = UpdateCashbackCustomerStatusBody.safeParse(req.body);
    if (!parsed.success) throw new CashbackError(400, "INVALID_REQUEST");
    await mutateState((state) => {
      const customer = (state.customers ?? []).find((entry: any) => entry.id === id);
      if (!customer) throw new CashbackError(404, "CUSTOMER_NOT_FOUND");
      const previousStatus = customer.status ?? "active";
      customer.status = parsed.data.status;
      customer.statusUpdatedAt = Date.now();
      customer.statusUpdatedBy = profile.uid;
      state.audit ??= [];
      state.audit.unshift({
        id: `audit_${randomUUID().replaceAll("-", "").slice(0, 18)}`,
        action: parsed.data.status === "suspended" ? "customer_suspended" : "customer_reactivated",
        customerId: customer.id,
        previousStatus,
        status: customer.status,
        adminUid: profile.uid,
        at: Date.now(),
      });
      addCashbackNotification(
        state,
        customer.id,
        parsed.data.status === "suspended" ? "customer.account.suspended" : "customer.account.reactivated",
      );
      return { result: { id: customer.id, status: customer.status } };
    });
    res.json({ ok: true, status: parsed.data.status });
  } catch (error) {
    respondError(res, error);
  }
});

router.patch("/cashback/admin/merchants/:id/status", async (req, res) => {
  const profile = (req as unknown as AuthenticatedRequest).cashbackProfile;
  try {
    requireAdmin(profile);
    const id = getParamId(req);
    const parsed = UpdateCashbackMerchantStatusBody.safeParse(req.body);
    if (!parsed.success) throw new CashbackError(400, "INVALID_REQUEST");
    await mutateState((state) => {
      const merchant = (state.merchants ?? []).find((entry: any) => entry.id === id);
      if (!merchant) throw new CashbackError(404, "MERCHANT_NOT_FOUND");
      if (!["active", "suspended"].includes(merchant.status)) {
        throw new CashbackError(409, "MERCHANT_NOT_ACTIVATED");
      }
      const previousStatus = merchant.status;
      merchant.status = parsed.data.status;
      merchant.statusUpdatedAt = Date.now();
      merchant.statusUpdatedBy = profile.uid;
      state.audit ??= [];
      state.audit.unshift({
        id: `audit_${randomUUID().replaceAll("-", "").slice(0, 18)}`,
        action: parsed.data.status === "suspended" ? "merchant_suspended" : "merchant_reactivated",
        merchantId: merchant.id,
        previousStatus,
        status: merchant.status,
        adminUid: profile.uid,
        at: Date.now(),
      });
      addCashbackNotification(
        state,
        merchant.id,
        parsed.data.status === "suspended" ? "merchant.account.suspended" : "merchant.account.reactivated",
      );
      return { result: { id: merchant.id, status: merchant.status } };
    });
    res.json({ ok: true, status: parsed.data.status });
  } catch (error) {
    respondError(res, error);
  }
});

router.patch("/cashback/admin/merchants/:id/category", async (req, res) => {
  const profile = (req as unknown as AuthenticatedRequest).cashbackProfile;
  try {
    requireAdmin(profile);
    const id = getParamId(req);
    const parsed = UpdateCashbackMerchantCategoryBody.safeParse(req.body);
    if (!parsed.success) throw new CashbackError(400, "INVALID_REQUEST");
    await mutateState((state) => {
      const merchant = (state.merchants ?? []).find((entry: any) => entry.id === id);
      if (!merchant) throw new CashbackError(404, "MERCHANT_NOT_FOUND");
      const categories = Array.isArray(state.categories) ? state.categories : CUSTOMER_CATEGORIES;
      if (!categories.includes(parsed.data.category)) throw new CashbackError(400, "CATEGORY_NOT_ACTIVE");
      const previousCategory = merchant.cat ?? "shops";
      merchant.cat = parsed.data.category;
      merchant.categoryUpdatedAt = Date.now();
      merchant.categoryUpdatedBy = profile.uid;
      state.audit ??= [];
      state.audit.unshift({
        id: `audit_${randomUUID().replaceAll("-", "").slice(0, 18)}`,
        action: "merchant_category_updated",
        merchantId: merchant.id,
        previousCategory,
        category: merchant.cat,
        adminUid: profile.uid,
        at: Date.now(),
      });
      return { result: { ok: true, merchantId: merchant.id, category: merchant.cat } };
    });
    res.json({ ok: true, category: parsed.data.category });
  } catch (error) {
    respondError(res, error);
  }
});

router.post("/cashback/admin/merchants/:id/rotate-qr", async (req, res) => {
  const profile = (req as unknown as AuthenticatedRequest).cashbackProfile;
  try {
    requireAdmin(profile);
    const params = RotateCashbackMerchantQrParams.safeParse(req.params);
    if (!params.success) throw new CashbackError(400, "INVALID_REQUEST");
    const result = await mutateState((state) => {
      const merchant = (state.merchants ?? []).find((entry: any) => entry.id === params.data.id);
      if (!merchant || !["active", "suspended"].includes(merchant.status)) {
        throw new CashbackError(404, "MERCHANT_NOT_FOUND");
      }
      const previousPublicId = merchant.publicId ?? null;
      const existingIds = new Set(
        (state.merchants ?? [])
          .filter((entry: any) => entry.id !== merchant.id)
          .map((entry: any) => entry.publicId)
          .filter((value: unknown): value is string => typeof value === "string"),
      );
      do {
        merchant.publicId = `CB-${randomUUID().replaceAll("-", "").slice(0, 16).toUpperCase()}`;
      } while (existingIds.has(merchant.publicId));
      merchant.qrValue = `cashback://merchant/${merchant.publicId}`;
      merchant.qrRotatedAt = Date.now();
      state.paymentSessions = (state.paymentSessions ?? []).map((session: any) =>
        session.merchantId === merchant.id && session.status === "pending"
          ? { ...session, status: "revoked", revokedAt: Date.now(), revokedReason: "qr_rotated" }
          : session,
      );
      state.audit ??= [];
      state.audit.unshift({
        id: `audit_${randomUUID().replaceAll("-", "").slice(0, 18)}`,
        action: "merchant_qr_rotated",
        merchantId: merchant.id,
        previousPublicId,
        publicId: merchant.publicId,
        adminUid: profile.uid,
        at: Date.now(),
      });
      addCashbackNotification(state, merchant.id, "merchant.qr.rotated");
      return { result: { ok: true, merchantId: merchant.id, publicId: merchant.publicId, qrValue: merchant.qrValue } };
    });
    res.json(result);
  } catch (error) {
    respondError(res, error);
  }
});

router.get("/cashback/media/:id", async (req, res) => {
  const profile = (req as unknown as AuthenticatedRequest).cashbackProfile;
  try {
    const id = getParamId(req);
    const [media, { state }] = await Promise.all([
      getDocument(`photos/${id}`),
      getState(),
    ]);
    if (!media) throw new CashbackError(404, "MEDIA_NOT_FOUND");
    const fields = decodeCashbackFields(media);
    const allowed =
      profile.role === "admin" ||
      fields.ownerUid === profile.uid ||
      (profile.role === "customer" &&
        (state.merchants ?? []).some(
          (merchant: any) => merchant.logoId === id && merchant.status === "active",
        )) ||
      (profile.role === "customer" &&
        (state.merchants ?? []).some(
          (merchant: any) => merchant.coverId === id && merchant.status === "active",
        )) ||
      (profile.role === "customer" &&
        (state.claims ?? []).some(
          (claim: any) => (claim.photoId === id || claim.id === id) && claim.cid === profile.eid,
        )) ||
      (profile.role === "merchant" &&
        (state.claims ?? []).some(
          (claim: any) => (claim.photoId === id || claim.id === id) && claim.mid === profile.eid,
        ));
    if (!allowed) throw new CashbackError(403, "FORBIDDEN");
    if (typeof fields.objectPath === "string" && fields.objectPath) {
      const photo = await readProfilePhoto(fields.objectPath);
      res.setHeader("content-type", photo.contentType);
      res.setHeader("content-length", String(photo.size));
      res.setHeader("cache-control", "private, max-age=300");
      res.setHeader("x-content-type-options", "nosniff");
      photo.body.on("error", (error) => {
        req.log.warn({ err: error }, "Could not stream receipt photo");
        if (!res.headersSent) res.status(500).end();
      });
      photo.body.pipe(res);
      return;
    }
    const encoded = String(fields.data ?? "").match(/^data:(image\/(?:jpeg|png|webp));base64,(.+)$/);
    if (!encoded) throw new CashbackError(404, "MEDIA_NOT_FOUND");
    res.setHeader("content-type", encoded[1]);
    res.setHeader("cache-control", "private, max-age=300");
    res.send(Buffer.from(encoded[2], "base64"));
  } catch (error) {
    respondError(res, error);
  }
});

export default router;
