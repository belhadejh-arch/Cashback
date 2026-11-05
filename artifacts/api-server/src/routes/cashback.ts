import { randomUUID, createHash } from "node:crypto";
import { Router, type IRouter, type Response, type NextFunction } from "express";
import {
  LoginCashbackBody,
  RegisterCashbackProfileBody,
  SubmitCashbackReceiptBody,
  DecideCashbackReceiptBody,
  DecideCashbackMerchantBody,
  RedeemMerchantCashbackBody,
  UpdateCashbackPreferencesBody,
  UpdateCashbackRateBody,
} from "@workspace/api-zod";
import {
  authenticateRequest,
  CashbackError,
  commit,
  createSession,
  decodeCashbackFields,
  documentWrite,
  emailLookupId,
  getDocument,
  getState,
  hashPassword,
  requireAdmin,
  revokeSession,
  savePreferences,
  sessionCookieName,
  stateWrite,
  unauthorizedRole,
  verifyNeonConnection,
  verifyPassword,
  type AuthenticatedRequest,
  type CashbackProfile,
  type CashbackState,
} from "../lib/cashback-neon";

const router: IRouter = Router();
const MAX_IMAGE_LENGTH = 650_000;
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

router.use(async (req, res, next: NextFunction) => {
  try {
    if (
      req.method === "POST" &&
      (req.path === "/cashback/register" || req.path === "/cashback/auth/login")
    ) {
      next();
      return;
    }
    (req as AuthenticatedRequest).cashbackProfile = await authenticateRequest(req);
    next();
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

function addNote(state: CashbackState, to: string, text: string): void {
  state.notes ??= [];
  state.notes.unshift({ id: randomUUID(), to, text, t: Date.now(), read: false });
  state.notes.length = Math.min(state.notes.length, 300);
}

async function mutateState<T>(
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
  const settings = {
    cashback: Number(state.settings?.cashback ?? 4),
    claimHours: Number(state.settings?.claimHours ?? 720),
  };

  if (profile.role === "admin") return state;
  if (profile.role === "customer") {
    const customer = customers.find((entry: any) => entry.id === profile.eid);
    return {
      settings,
      merchants: merchants
        .filter((merchant: any) => merchant.status === "active")
        .map((merchant: any) => ({
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
          publicId: merchant.publicId,
          description: merchant.description,
        })),
      customers: customer ? [customer] : [],
      claims: claims.filter((claim: any) => claim.cid === profile.eid),
      txns: txns.filter((transaction: any) => transaction.cid === profile.eid),
      cbpays: cbpays.filter((payment: any) => payment.cid === profile.eid),
      notes: notes.filter((note: any) => note.to === profile.eid),
      categories: [...CATEGORIES],
    };
  }

  const merchant = merchants.find((entry: any) => entry.id === profile.eid);
  const ownClaims = claims.filter((claim: any) => claim.mid === profile.eid);
  const customerIds = new Set(ownClaims.map((claim: any) => claim.cid));
  return {
    settings,
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
    cbpays: cbpays.filter((payment: any) => payment.mid === profile.eid),
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
      preferences: savedFields.preferences ?? profile.preferences,
      ...(profile.role === "merchant" && merchant
        ? { status: merchant.status, rejectionReason: merchant.rejectionReason ?? null }
        : {}),
    };
    res.json({ profile: resultProfile, state: projectState(profile, state) });
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
        !CATEGORIES.has(fieldString(input.category))
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
    const mediaId = image ? `logo_${id}` : undefined;
    const password = hashPassword(input.password);
    const profileDocument = {
      role: input.role,
      eid: id,
      name,
      phone: phone || null,
      email,
      preferences: { language: "ar", theme: "dark" },
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
        state.customers.push({ id, name, phone: phone || null, wallet: 0, cbm: {} });
      } else {
        state.merchants.push({
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
        });
        addNote(state, "admin", `طلب انضمام تاجر جديد: ${name}`);
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
        extraWrites: [...accountWrites, ...photoWrite],
      };
    });
    const sessionToken = await createSession(uid);
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
    respondError(res, error);
  }
});

router.post("/cashback/auth/login", async (req, res) => {
  try {
    const parsed = LoginCashbackBody.safeParse(req.body);
    if (!parsed.success) throw new CashbackError(400, "INVALID_REQUEST");
    const email = fieldString(parsed.data.email).toLowerCase();
    const emailDocument = await getDocument(`account_emails/${emailLookupId(email)}`);
    const emailFields = decodeCashbackFields(emailDocument);
    const uid = typeof emailFields.uid === "string" ? emailFields.uid : "";
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
      email,
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

router.post("/cashback/receipts", async (req, res) => {
  const profile = (req as unknown as AuthenticatedRequest).cashbackProfile;
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
    if (Number.isNaN(date.getTime()) || date.getTime() > Date.now() + 86_400_000) {
      throw new CashbackError(400, "INVALID_RECEIPT_DATE");
    }
    const image = validateImageData(input.imageData);
    const claimId = `rcpt_${randomUUID().replaceAll("-", "").slice(0, 18)}`;
    const mediaId = `receipt_${claimId}`;
    const invoiceNumber = fieldString(input.invoiceNumber ?? "");
    const receipt = await mutateState((state) => {
      const customer = (state.customers ?? []).find(
        (entry: any) => entry.id === profile.eid,
      );
      if (!customer) throw new CashbackError(403, "PROFILE_INCOMPLETE");
      const merchant = (state.merchants ?? []).find(
        (entry: any) => entry.id === input.merchantId,
      );
      if (!merchant || merchant.status !== "active") {
        throw new CashbackError(400, "MERCHANT_UNAVAILABLE");
      }
      state.claims ??= [];
      const sameInvoice = invoiceNumber &&
        state.claims.some((claim: any) =>
          claim.mid === merchant.id &&
          String(claim.invoiceNumber ?? claim.no ?? "").trim().toLowerCase() === invoiceNumber.toLowerCase(),
        );
      if (sameInvoice) throw new CashbackError(409, "DUPLICATE_RECEIPT");
      const sameImage = state.claims.some((claim: any) =>
        claim.imageHash === image.hash ||
        claim.ph === legacyPhotoHash(image.data),
      );
      if (sameImage) throw new CashbackError(409, "DUPLICATE_RECEIPT");
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
        submitIp: String(req.ip ?? ""),
        status: "pending",
        created: Date.now(),
        submittedByUid: profile.uid,
      };
      state.claims.unshift(value);
      addNote(state, "admin", `فاتورة جديدة بانتظار المراجعة من ${customer.name}`);
      addNote(state, customer.id, `تم إرسال الفاتورة إلى المراجعة لدى ${merchant.name}`);
      return {
        result: value,
        extraWrites: [
          documentWrite("photos", mediaId, {
            data: image.data,
            contentType: image.type,
            ownerUid: profile.uid,
            kind: "receipt",
          }, false),
        ],
      };
    });
    res.status(201).json(receipt);
  } catch (error) {
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
        const cashback = Math.round(claim.amount * cashbackRate) / 100;
        customer.wallet = Math.round((Number(customer.wallet ?? 0) + cashback) * 100) / 100;
        customer.cbm ??= {};
        customer.cbm[merchant.id] = Math.round(
          (Number(customer.cbm[merchant.id] ?? 0) + cashback) * 100,
        ) / 100;
        claim.status = "approved";
        claim.cashback = cashback;
        claim.reviewedAt = Date.now();
        claim.reviewedBy = profile.uid;
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
        addNote(state, customer.id, `تم اعتماد فاتورتك لدى ${merchant.name} وإضافة المكافأة إلى رصيد هذا المتجر`);
      } else {
        claim.status = "rejected";
        claim.reviewedAt = Date.now();
        claim.reviewedBy = profile.uid;
        claim.reason = fieldString(parsed.data.reason ?? "") || "RECEIPT_REJECTED";
        addNote(state, customer.id, `تم رفض الفاتورة لدى ${merchant.name}`);
      }
      return { result: { id, status: claim.status, cashback: claim.cashback ?? 0 } };
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
        merchant.publicId ??= `CB-${randomUUID().replaceAll("-", "").slice(0, 10).toUpperCase()}`;
        merchant.qrValue = `cashback://merchant/${merchant.publicId}`;
        merchant.activatedAt = Date.now();
        addNote(state, merchant.id, "تمت الموافقة على طلب انضمام متجرك، يمكنك الآن استخدام لوحة التاجر");
      } else {
        merchant.status = "rejected";
        merchant.rejectionReason = fieldString(parsed.data.reason ?? "") || "APPLICATION_REJECTED";
        merchant.rejectedAt = Date.now();
        addNote(state, merchant.id, `تم رفض طلب انضمام متجرك: ${merchant.rejectionReason}`);
      }
      return { result: { id: merchant.id, status: merchant.status } };
    });
    res.json({ ok: true });
  } catch (error) {
    respondError(res, error);
  }
});

router.post("/cashback/wallet/redemptions", async (req, res) => {
  const profile = (req as AuthenticatedRequest).cashbackProfile;
  try {
    unauthorizedRole(profile, "customer");
    const parsed = RedeemMerchantCashbackBody.safeParse(req.body);
    if (!parsed.success) throw new CashbackError(400, "INVALID_REQUEST");
    const amount = Math.round(Number(parsed.data.amount) * 100) / 100;
    if (!(amount > 0) || !Number.isFinite(amount)) {
      throw new CashbackError(400, "INVALID_AMOUNT");
    }
    const result = await mutateState((state) => {
      const customer = (state.customers ?? []).find(
        (entry: any) => entry.id === profile.eid,
      );
      const merchant = (state.merchants ?? []).find(
        (entry: any) => entry.id === parsed.data.merchantId,
      );
      if (!customer) throw new CashbackError(403, "PROFILE_INCOMPLETE");
      if (!merchant || merchant.status !== "active") {
        throw new CashbackError(400, "MERCHANT_UNAVAILABLE");
      }
      customer.cbm ??= {};
      const available = Math.round(Number(customer.cbm[merchant.id] ?? 0) * 100) / 100;
      if (amount > available) throw new CashbackError(400, "INSUFFICIENT_MERCHANT_BALANCE");
      customer.cbm[merchant.id] = Math.round((available - amount) * 100) / 100;
      if (customer.cbm[merchant.id] <= 0) delete customer.cbm[merchant.id];
      customer.wallet = Math.round((Number(customer.wallet ?? 0) - amount) * 100) / 100;
      state.cbpays ??= [];
      const payment = {
        id: `redeem_${randomUUID().replaceAll("-", "").slice(0, 18)}`,
        cid: customer.id,
        mid: merchant.id,
        amount,
        status: "done",
        at: Date.now(),
        done: Date.now(),
      };
      state.cbpays.unshift(payment);
      merchant.cbIn = Math.round((Number(merchant.cbIn ?? 0) + amount) * 100) / 100;
      addNote(state, merchant.id, `استُخدمت مكافأة بقيمة ${amount} لدى متجرك`);
      addNote(state, customer.id, `تم استخدام ${amount} من رصيد ${merchant.name}`);
      return { result: { id: payment.id, status: "done", amount, merchantId: merchant.id } };
    });
    res.status(201).json(result);
  } catch (error) {
    respondError(res, error);
  }
});

router.patch("/cashback/profile/preferences", async (req, res) => {
  const profile = (req as AuthenticatedRequest).cashbackProfile;
  try {
    const parsed = UpdateCashbackPreferencesBody.safeParse(req.body);
    if (!parsed.success) throw new CashbackError(400, "INVALID_REQUEST");
    res.json(await savePreferences(profile, parsed.data));
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
    await mutateState((state) => {
      state.settings ??= {};
      state.settings.cashback = rate;
      state.merchants ??= [];
      state.merchants.forEach((merchant: any) => {
        if (merchant.cashbackRate == null) merchant.cashbackRate = null;
      });
      return { result: { rate } };
    });
    res.json({ ok: true, rate });
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
        (state.claims ?? []).some(
          (claim: any) => (claim.photoId === id || claim.id === id) && claim.cid === profile.eid,
        )) ||
      (profile.role === "merchant" &&
        (state.claims ?? []).some(
          (claim: any) => (claim.photoId === id || claim.id === id) && claim.mid === profile.eid,
        ));
    if (!allowed) throw new CashbackError(403, "FORBIDDEN");
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
