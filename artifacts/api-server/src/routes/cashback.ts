import { randomUUID, createHash } from "node:crypto";
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
  RateCashbackMerchantBody,
  CreateCashbackReceiptPhotoUploadBody,
  CreateCashbackReceiptPhotoUploadResponse,
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
  phoneLookupId,
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
import {
  createProfilePhotoUpload,
  createReceiptPhotoUpload,
  getProfilePhotoFile,
  profilePhotoMatchesType,
  readPrivateImage,
  readProfilePhoto,
} from "../lib/profilePhotoStorage";

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

function activeCustomerCategories(value: unknown): string[] {
  const configured = Array.isArray(value)
    ? value.filter((category): category is string =>
        CUSTOMER_CATEGORIES.includes(category),
      )
    : [];
  return configured.length ? configured : [...CUSTOMER_CATEGORIES];
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
  const ratings = Array.isArray(state.ratings) ? state.ratings : [];
  const settings = {
    cashback: Number(state.settings?.cashback ?? 4),
    claimHours: Number(state.settings?.claimHours ?? 720),
  };

  if (profile.role === "admin") return state;
  if (profile.role === "customer") {
    const customer = customers.find((entry: any) => entry.id === profile.eid);
    const activeMerchants = merchants
      .filter((merchant: any) => merchant.status === "active")
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
      customers: customer ? [customer] : [],
      claims: claims.filter((claim: any) => claim.cid === profile.eid),
      txns: txns.filter((transaction: any) => transaction.cid === profile.eid),
      cbpays: cbpays.filter((payment: any) => payment.cid === profile.eid),
      notes: notes.filter((note: any) => note.to === profile.eid),
      categories: activeCustomerCategories(state.categories),
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
      avatarUpdatedAt: Number(savedFields.avatarUpdatedAt ?? profile.avatarUpdatedAt ?? 0) || undefined,
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
    const mediaId = image ? `logo_${id}` : undefined;
    const password = hashPassword(input.password);
    const profileDocument = {
      role: input.role,
      eid: id,
      name,
      phone: phone || null,
      email,
      preferences: { language: "ar", theme: "dark" },
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
  const profile = (req as unknown as AuthenticatedRequest).cashbackProfile;
  unauthorizedRole(profile, "customer");
  const parsed = CreateCashbackReceiptPhotoUploadBody.safeParse(req.body);
  if (!parsed.success) {
    throw new CashbackError(400, "INVALID_RECEIPT_IMAGE");
  }
  const uploadId = `receipt_${randomUUID()}`;
  const upload = await createReceiptPhotoUpload(profile.uid, uploadId);
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
      const merchant = (state.merchants ?? []).find(
        (entry: any) => entry.id === input.merchantId,
      );
      if (!merchant || merchant.status !== "active") {
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
        throw new CashbackError(409, "RECEIPT_UPLOAD_ALREADY_USED");
      }
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
      addNote(state, "admin", `فاتورة جديدة بانتظار المراجعة من ${customer.name}`);
      if (possibleDuplicate) {
        addNote(state, "admin", `اشتباه تكرار فاتورة: نفس المتجر والزبون والتاريخ والمبلغ (${merchant.name})`);
      }
      addNote(state, customer.id, `تم إرسال الفاتورة إلى المراجعة لدى ${merchant.name}`);
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
      addNote(state, "admin", `تم إلغاء الفاتورة ${receiptId} من صاحب الحساب`);
      addNote(state, profile.eid, "تم إلغاء إرسال الفاتورة قبل مراجعتها");
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
        merchant.publicId ??= `CB-${randomUUID().replaceAll("-", "").slice(0, 10).toUpperCase()}`;
        merchant.qrValue = `cashback://merchant/${merchant.publicId}`;
        merchant.activatedAt = Date.now();
        addNote(state, merchant.id, "تمت الموافقة على طلب انضمام متجرك، يمكنك الآن استخدام لوحة التاجر");
      } else {
        const reason = fieldString(parsed.data.reason ?? "");
        if (!reason) throw new CashbackError(400, "REJECTION_REASON_REQUIRED");
        merchant.status = "rejected";
        merchant.rejectionReason = reason;
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

router.post("/cashback/profile/photo/upload-url", async (req, res) => {
  const profile = (req as AuthenticatedRequest).cashbackProfile;
  try {
    const parsed = CreateCashbackProfilePhotoUploadBody.safeParse(req.body);
    if (!parsed.success) throw new CashbackError(400, "INVALID_REQUEST");
    const uploadId = `avatar_${randomUUID().replaceAll("-", "")}`;
    const { uploadURL, objectPath } = await createProfilePhotoUpload(profile.uid);
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
