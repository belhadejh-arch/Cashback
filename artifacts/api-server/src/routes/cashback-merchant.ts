import { randomUUID } from "node:crypto";
import { Router, type IRouter, type NextFunction, type Response } from "express";
import {
  CreateCashbackMerchantAssetUploadBody,
  CreateCashbackMerchantAssetUploadResponse,
  UpdateCashbackMerchantStoreBody,
  CreateCashbackMerchantStoreChangeRequestBody,
  DecideCashbackMerchantStoreChangeParams,
  DecideCashbackMerchantStoreChangeBody,
  CreateCashbackMerchantTopupBody,
  DecideCashbackMerchantTopupParams,
  DecideCashbackMerchantTopupBody,
  CreateCashbackMerchantWithdrawalBody,
  CreateCashbackAdminWithdrawalProofUploadParams,
  CreateCashbackAdminWithdrawalProofUploadBody,
  CreateCashbackAdminWithdrawalProofUploadResponse,
  UpdateCashbackMerchantCommissionRatesParams,
  UpdateCashbackMerchantCommissionRatesBody,
  UpdateCashbackMerchantWithdrawalParams,
  UpdateCashbackMerchantWithdrawalBody,
  UpdateCashbackPaymentMethodsBody,
} from "@workspace/api-zod";
import { addCashbackNotification } from "../lib/cashback-notifications";
import {
  CashbackError,
  authenticateRequest,
  commit,
  decodeCashbackFields,
  documentWrite,
  getMerchantCommissionDue,
  getDocument,
  getState,
  mutateCashbackState,
  requireAdmin,
  settleMerchantCommissionObligations,
  stateWrite,
  unauthorizedRole,
  type AuthenticatedRequest,
} from "../lib/cashback-neon";
import {
  createMerchantAssetUpload,
  readPrivateImage,
} from "../lib/profilePhotoStorage";

const router: IRouter = Router();
const allowedCategories = new Set([
  "restaurants", "cafes", "clothing", "electronics", "malls",
  "groceries", "perfume", "gifts", "shops", "other",
]);

async function authenticateMerchantRoutes(req: any, res: Response, next: NextFunction) {
  try {
    (req as AuthenticatedRequest).cashbackProfile = await authenticateRequest(req);
    next();
  } catch (error) {
    respondError(res, error);
  }
}

router.use("/cashback/merchant", authenticateMerchantRoutes);
router.use("/cashback/admin", authenticateMerchantRoutes);
router.use("/cashback/settings/payment-methods", authenticateMerchantRoutes);

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

function fieldString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function getParamId(req: any): string {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  if (typeof raw !== "string" || !/^[\w-]{1,100}$/.test(raw)) {
    throw new CashbackError(400, "INVALID_ID");
  }
  return raw;
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

async function verifyMerchantUpload(
  uid: string,
  merchantId: string,
  asset: "logo" | "cover" | "topup-proof" | "withdrawal-proof",
  uploadId: string,
  objectPath: string,
  expectedWithdrawalId?: string,
) {
  const uploadDoc = await getDocument(`merchant_asset_uploads/${uploadId}`);
  const upload = decodeCashbackFields(uploadDoc);
  if (
    !uploadDoc ||
    upload.ownerUid !== uid ||
    upload.merchantId !== merchantId ||
    upload.asset !== asset ||
    upload.objectPath !== objectPath ||
    (asset === "withdrawal-proof" && upload.withdrawalId !== expectedWithdrawalId) ||
    upload.finalizedAt ||
    Number(upload.expiresAt ?? 0) <= Date.now()
  ) {
    throw new CashbackError(400, "MERCHANT_ASSET_UPLOAD_EXPIRED");
  }
  let image: Awaited<ReturnType<typeof readPrivateImage>>;
  try {
    image = await readPrivateImage(objectPath);
  } catch {
    throw new CashbackError(400, "INVALID_MERCHANT_ASSET");
  }
  if (
    image.contentType !== upload.contentType ||
    image.size > Number(upload.declaredSize)
  ) {
    throw new CashbackError(400, "INVALID_MERCHANT_ASSET");
  }
  const photoId = `merchant_${asset.replaceAll("-", "_")}_${randomUUID().replaceAll("-", "")}`;
  const finalize = documentWrite(
    "merchant_asset_uploads",
    uploadId,
    { ...upload, finalizedAt: Date.now() },
    true,
  );
  finalize.currentDocument = { updateTime: uploadDoc.updateTime };
  const photo = documentWrite("photos", photoId, {
    ownerUid: uid,
    merchantId,
    kind: `merchant-${asset}`,
    objectPath,
    contentType: image.contentType,
    size: image.size,
    createdAt: Date.now(),
  }, false);
  return { photoId, writes: [finalize, photo] };
}

router.post("/cashback/merchant/assets/upload-url", async (req, res) => {
  const profile = (req as AuthenticatedRequest).cashbackProfile;
  try {
    unauthorizedRole(profile, "merchant");
    const parsed = CreateCashbackMerchantAssetUploadBody.safeParse(req.body);
    if (!parsed.success) throw new CashbackError(400, "INVALID_REQUEST");
    const { state } = await getState();
    const merchant = (state.merchants ?? []).find((entry: any) => entry.id === profile.eid);
    if (!merchant || merchant.status !== "active") throw new CashbackError(403, "MERCHANT_NOT_ACTIVE");
    const uploadId = `merchant_asset_${randomUUID().replaceAll("-", "")}`;
    const upload = await createMerchantAssetUpload(profile.uid, profile.eid, parsed.data.asset, uploadId);
    const createdAt = Date.now();
    const stored = await commit([
      documentWrite("merchant_asset_uploads", uploadId, {
        ownerUid: profile.uid,
        merchantId: profile.eid,
        asset: parsed.data.asset,
        objectPath: upload.objectPath,
        contentType: parsed.data.contentType,
        declaredSize: parsed.data.size,
        createdAt,
        expiresAt: createdAt + 10 * 60 * 1000,
      }, false),
    ]);
    if (!stored) throw new CashbackError(409, "UPLOAD_ALREADY_EXISTS");
    res.status(201).json(CreateCashbackMerchantAssetUploadResponse.parse({
      uploadURL: upload.uploadURL,
      objectPath: upload.objectPath,
      uploadId,
    }));
  } catch (error) {
    respondError(res, error);
  }
});

router.patch("/cashback/merchant/store", async (req, res) => {
  const profile = (req as AuthenticatedRequest).cashbackProfile;
  try {
    unauthorizedRole(profile, "merchant");
    const parsed = UpdateCashbackMerchantStoreBody.safeParse(req.body);
    if (!parsed.success) throw new CashbackError(400, "INVALID_REQUEST");
    const input = parsed.data;
    const editableKeys = [
      "name", "phone", "description", "address", "mapsUrl", "lat", "lng",
      "openingHours", "logoUploadId", "logoObjectPath", "coverUploadId", "coverObjectPath",
    ] as const;
    if (!editableKeys.some((key) => input[key] !== undefined)) {
      throw new CashbackError(400, "EMPTY_STORE_UPDATE");
    }
    const { state } = await getState();
    const current = (state.merchants ?? []).find((entry: any) => entry.id === profile.eid);
    if (!current || current.status !== "active") throw new CashbackError(403, "MERCHANT_NOT_ACTIVE");
    const writes: any[] = [];
    let logo: Awaited<ReturnType<typeof verifyMerchantUpload>> | undefined;
    let cover: Awaited<ReturnType<typeof verifyMerchantUpload>> | undefined;
    if (input.logoUploadId || input.logoObjectPath) {
      if (!input.logoUploadId || !input.logoObjectPath) throw new CashbackError(400, "INVALID_MERCHANT_ASSET");
      logo = await verifyMerchantUpload(profile.uid, profile.eid, "logo", input.logoUploadId, input.logoObjectPath);
      writes.push(...logo.writes);
    }
    if (input.coverUploadId || input.coverObjectPath) {
      if (!input.coverUploadId || !input.coverObjectPath) throw new CashbackError(400, "INVALID_MERCHANT_ASSET");
      cover = await verifyMerchantUpload(profile.uid, profile.eid, "cover", input.coverUploadId, input.coverObjectPath);
      writes.push(...cover.writes);
    }
    const phone = input.phone === undefined ? undefined : fieldString(input.phone) || null;
    if (phone && (phone.length < 7 || phone.length > 18)) throw new CashbackError(400, "INVALID_PHONE");
    if (input.mapsUrl !== undefined && input.mapsUrl.trim() &&
      !/^https?:\/\/|^-?\d{1,2}\.\d+,\s*-?\d{1,3}\.\d+$/.test(input.mapsUrl.trim())) {
      throw new CashbackError(400, "INVALID_LOCATION");
    }
    if ((input.lat === null) !== (input.lng === null) ||
      (input.lat !== undefined && input.lng === undefined) ||
      (input.lng !== undefined && input.lat === undefined)) {
      throw new CashbackError(400, "COORDINATES_MUST_MATCH");
    }
    await mutateCashbackState((state) => {
      const merchant = (state.merchants ?? []).find((entry: any) => entry.id === profile.eid);
      if (!merchant || merchant.status !== "active") throw new CashbackError(403, "MERCHANT_NOT_ACTIVE");
      if (phone) {
        const duplicate = [...(state.customers ?? []), ...(state.merchants ?? [])].some(
          (entry: any) => entry.id !== merchant.id && String(entry.phone ?? "").replace(/\D/g, "") === phone.replace(/\D/g, ""),
        );
        if (duplicate) throw new CashbackError(409, "PHONE_ALREADY_REGISTERED");
      }
      if (input.name !== undefined) merchant.name = fieldString(input.name);
      if (input.phone !== undefined) merchant.phone = phone;
      if (input.description !== undefined) merchant.description = input.description.trim();
      if (input.address !== undefined) merchant.address = input.address.trim();
      if (input.mapsUrl !== undefined) merchant.mapsUrl = input.mapsUrl.trim();
      if (input.lat !== undefined) merchant.lat = input.lat;
      if (input.lng !== undefined) merchant.lng = input.lng;
      if (input.openingHours !== undefined) merchant.openingHours = input.openingHours.trim();
      if (logo) merchant.logoId = logo.photoId;
      if (cover) merchant.coverId = cover.photoId;
      merchant.updatedAt = Date.now();
      return { result: { ok: true, merchantId: merchant.id }, extraWrites: writes };
    });
    res.json({ ok: true, merchantId: profile.eid });
  } catch (error) {
    respondError(res, error);
  }
});

router.post("/cashback/merchant/store-change-requests", async (req, res) => {
  const profile = (req as AuthenticatedRequest).cashbackProfile;
  try {
    unauthorizedRole(profile, "merchant");
    const parsed = CreateCashbackMerchantStoreChangeRequestBody.safeParse(req.body);
    if (!parsed.success) throw new CashbackError(400, "INVALID_REQUEST");
    const changes = Object.fromEntries(
      Object.entries(parsed.data).filter(([, value]) => value !== undefined),
    );
    if (!Object.keys(changes).length) throw new CashbackError(400, "EMPTY_CHANGE_REQUEST");
    if (parsed.data.category && !allowedCategories.has(parsed.data.category)) {
      throw new CashbackError(400, "INVALID_CATEGORY");
    }
    const requestId = `mchg_${randomUUID().replaceAll("-", "").slice(0, 20)}`;
    await mutateCashbackState((state) => {
      const merchant = (state.merchants ?? []).find((entry: any) => entry.id === profile.eid);
      if (!merchant || merchant.status !== "active") throw new CashbackError(403, "MERCHANT_NOT_ACTIVE");
      state.merchantStoreChangeRequests ??= [];
      if (state.merchantStoreChangeRequests.some((entry: any) =>
        entry.merchantId === profile.eid && entry.status === "pending")) {
        throw new CashbackError(409, "CHANGE_REQUEST_ALREADY_PENDING");
      }
      const request = {
        id: requestId,
        merchantId: profile.eid,
        merchantUid: profile.uid,
        ...changes,
        changes,
        status: "pending",
        createdAt: Date.now(),
      };
      state.merchantStoreChangeRequests.unshift(request);
      addCashbackNotification(state, profile.eid, "merchant.store.change.submitted", {
        requestId,
      });
      addCashbackNotification(state, "admin", "admin.store.change.new", {
        merchant: merchant.name,
        merchantId: merchant.id,
        requestId,
      });
      return { result: { id: requestId, status: request.status } };
    });
    res.status(201).json({ id: requestId, status: "pending" });
  } catch (error) {
    respondError(res, error);
  }
});

router.patch("/cashback/admin/store-change-requests/:id/decision", async (req, res) => {
  const profile = (req as unknown as AuthenticatedRequest).cashbackProfile;
  try {
    requireAdmin(profile);
    const params = DecideCashbackMerchantStoreChangeParams.safeParse(req.params);
    const parsed = DecideCashbackMerchantStoreChangeBody.safeParse(req.body);
    if (!params.success || !parsed.success) throw new CashbackError(400, "INVALID_REQUEST");
    const reason = fieldString(parsed.data.reason);
    if (!parsed.data.approved && !reason) throw new CashbackError(400, "REJECTION_REASON_REQUIRED");
    await mutateCashbackState((state) => {
      const request = (state.merchantStoreChangeRequests ?? []).find((entry: any) => entry.id === params.data.id);
      if (!request) throw new CashbackError(404, "CHANGE_REQUEST_NOT_FOUND");
      if (request.status !== "pending") throw new CashbackError(409, "CHANGE_REQUEST_ALREADY_REVIEWED");
      const merchant = (state.merchants ?? []).find((entry: any) => entry.id === request.merchantId);
      if (!merchant) throw new CashbackError(409, "MERCHANT_NOT_FOUND");
      request.status = parsed.data.approved ? "approved" : "rejected";
      request.reviewedAt = Date.now();
      request.reviewedBy = profile.uid;
      request.reason = reason || undefined;
      if (parsed.data.approved) {
        if (request.changes.country && Array.isArray(state.settings?.enabledCurrencies)) {
          const requestedCurrency = request.changes.country === "Libya" ? "LYD" : "DZD";
          if (!state.settings.enabledCurrencies.includes(requestedCurrency)) {
            throw new CashbackError(400, "CURRENCY_DISABLED");
          }
        }
        if (request.changes.country) merchant.country = request.changes.country;
        if (request.changes.category) merchant.cat = request.changes.category;
        merchant.legalData = {
          ...(merchant.legalData ?? {}),
          ...Object.fromEntries(Object.entries(request.changes).filter(
            ([key]) => ["legalName", "registrationNumber", "taxNumber"].includes(key),
          )),
        };
      }
      state.audit ??= [];
      state.audit.unshift({
        id: `audit_${randomUUID().replaceAll("-", "").slice(0, 18)}`,
        action: parsed.data.approved ? "merchant_store_change_approved" : "merchant_store_change_rejected",
        requestId: request.id,
        merchantId: merchant.id,
        adminUid: profile.uid,
        at: Date.now(),
        reason: reason || undefined,
      });
      addCashbackNotification(
        state,
        merchant.id,
        parsed.data.approved ? "merchant.store.change.approved" : "merchant.store.change.rejected",
        { reason, requestId: request.id },
      );
      return { result: { id: request.id, status: request.status } };
    });
    res.json({ ok: true });
  } catch (error) {
    respondError(res, error);
  }
});

router.post("/cashback/merchant/topups", async (req, res) => {
  const profile = (req as AuthenticatedRequest).cashbackProfile;
  try {
    unauthorizedRole(profile, "merchant");
    const parsed = CreateCashbackMerchantTopupBody.safeParse(req.body);
    if (!parsed.success) throw new CashbackError(400, "INVALID_REQUEST");
    const { state } = await getState();
    const merchant = (state.merchants ?? []).find((entry: any) => entry.id === profile.eid);
    if (!merchant || merchant.status !== "active") throw new CashbackError(403, "MERCHANT_NOT_ACTIVE");
    const minimum = merchant.country === "Libya"
      ? Number(state.settings?.minimumTopupLyd ?? 10)
      : Number(state.settings?.minimumTopupDzd ?? 1000);
    const amount = roundMoney(parsed.data.amount);
    if (!Number.isFinite(amount) || !Number.isSafeInteger(Math.round(amount * 100))) {
      throw new CashbackError(400, "INVALID_TOPUP_AMOUNT");
    }
    if (amount < minimum) throw new CashbackError(400, "TOPUP_BELOW_MINIMUM");
    const configuredMaximum = merchant.country === "Libya"
      ? state.settings?.maxTopupAmountLyd
      : state.settings?.maxTopupAmountDzd;
    if (configuredMaximum !== null && configuredMaximum !== undefined) {
      const maximum = roundMoney(Number(configuredMaximum));
      if (!Number.isFinite(maximum) || maximum < minimum) {
        throw new CashbackError(500, "INVALID_TOPUP_LIMIT");
      }
      if (amount > maximum) throw new CashbackError(400, "TOPUP_EXCEEDS_ADMIN_LIMIT");
    }
    const method = (state.settings?.paymentMethods ?? []).find(
      (entry: any) => entry.id === parsed.data.paymentMethodId &&
        entry.country === merchant.country && entry.active === true,
    );
    if (!method) throw new CashbackError(400, "PAYMENT_METHOD_UNAVAILABLE");
    const proof = await verifyMerchantUpload(
      profile.uid, profile.eid, "topup-proof", parsed.data.uploadId, parsed.data.objectPath,
    );
    const requestId = `top_${randomUUID().replaceAll("-", "").slice(0, 20)}`;
    const reference = `TOP-${randomUUID().replaceAll("-", "").slice(0, 14).toUpperCase()}`;
    await mutateCashbackState((state) => {
      const currentMerchant = (state.merchants ?? []).find((entry: any) => entry.id === profile.eid);
      if (!currentMerchant || currentMerchant.status !== "active") {
        throw new CashbackError(403, "MERCHANT_NOT_ACTIVE");
      }
      const currentMinimum = currentMerchant.country === "Libya"
        ? Number(state.settings?.minimumTopupLyd ?? 10)
        : Number(state.settings?.minimumTopupDzd ?? 1000);
      if (amount < currentMinimum) throw new CashbackError(400, "TOPUP_BELOW_MINIMUM");
      const currentMaximumRaw = currentMerchant.country === "Libya"
        ? state.settings?.maxTopupAmountLyd
        : state.settings?.maxTopupAmountDzd;
      if (currentMaximumRaw !== null && currentMaximumRaw !== undefined) {
        const currentMaximum = roundMoney(Number(currentMaximumRaw));
        if (!Number.isFinite(currentMaximum) || currentMaximum < currentMinimum) {
          throw new CashbackError(500, "INVALID_TOPUP_LIMIT");
        }
        if (amount > currentMaximum) throw new CashbackError(400, "TOPUP_EXCEEDS_ADMIN_LIMIT");
      }
      const currentMethod = (state.settings?.paymentMethods ?? []).find(
        (entry: any) => entry.id === parsed.data.paymentMethodId &&
          entry.country === currentMerchant.country && entry.active === true,
      );
      if (!currentMethod) throw new CashbackError(400, "PAYMENT_METHOD_UNAVAILABLE");
      state.merchantTopups ??= [];
      const request = {
        id: requestId,
        reference,
        merchantId: profile.eid,
        merchantUid: profile.uid,
        country: currentMerchant.country,
        amount,
        currency: currentMerchant.country === "Libya" ? "LYD" : "DZD",
        paymentMethodId: currentMethod.id,
        paymentMethodName: currentMethod.name,
        payerReference: fieldString(parsed.data.payerReference),
        proofId: proof.photoId,
        proofObjectPath: parsed.data.objectPath,
        status: "pending",
        createdAt: Date.now(),
      };
      state.merchantTopups.unshift(request);
      addCashbackNotification(state, "admin", "admin.topup.new", {
        merchant: currentMerchant.name,
        merchantId: currentMerchant.id,
        amount,
        currency: request.currency,
        requestId,
      });
      addCashbackNotification(state, profile.eid, "merchant.topup.submitted", {
        amount,
        currency: request.currency,
        requestId,
      });
      return {
        result: { id: requestId, reference, status: "pending" },
        extraWrites: proof.writes,
      };
    });
    res.status(201).json({ id: requestId, reference, status: "pending" });
  } catch (error) {
    respondError(res, error);
  }
});

router.patch("/cashback/admin/topups/:id/decision", async (req, res) => {
  const profile = (req as unknown as AuthenticatedRequest).cashbackProfile;
  try {
    requireAdmin(profile);
    const params = DecideCashbackMerchantTopupParams.safeParse(req.params);
    const parsed = DecideCashbackMerchantTopupBody.safeParse(req.body);
    if (!params.success || !parsed.success) throw new CashbackError(400, "INVALID_REQUEST");
    const reason = fieldString(parsed.data.reason);
    if (!parsed.data.approved && !reason) throw new CashbackError(400, "REJECTION_REASON_REQUIRED");
    await mutateCashbackState((state) => {
      const request = (state.merchantTopups ?? []).find((entry: any) => entry.id === params.data.id);
      if (!request) throw new CashbackError(404, "TOPUP_NOT_FOUND");
      if (request.status !== "pending") throw new CashbackError(409, "TOPUP_ALREADY_REVIEWED");
      const merchant = (state.merchants ?? []).find((entry: any) => entry.id === request.merchantId);
      if (!merchant) throw new CashbackError(409, "MERCHANT_NOT_FOUND");
      request.status = parsed.data.approved ? "approved" : "rejected";
      request.reason = reason || undefined;
      request.reviewedAt = Date.now();
      request.reviewedBy = profile.uid;
      if (parsed.data.approved) {
        merchant.topupBalance = roundMoney(Number(merchant.topupBalance ?? 0) + Number(request.amount));
        const settlement = settleMerchantCommissionObligations(state, merchant, request.id);
        request.commissionSettlementAmount = settlement.amount;
        request.commissionRewardSettled = settlement.rewardAmount;
        request.commissionPlatformSettled = settlement.platformCommissionAmount;
        request.availableFundedBalance = merchant.topupBalance;
      }
      addCashbackNotification(
        state,
        merchant.id,
        parsed.data.approved ? "merchant.topup.approved" : "merchant.topup.rejected",
        {
          amount: request.amount,
          currency: request.currency,
          reason,
          requestId: request.id,
        },
      );
      state.audit ??= [];
      state.audit.unshift({
        id: `audit_${randomUUID().replaceAll("-", "").slice(0, 18)}`,
        action: parsed.data.approved ? "merchant_topup_approved" : "merchant_topup_rejected",
        requestId: request.id,
        merchantId: merchant.id,
        amount: request.amount,
        commissionSettlementAmount: request.commissionSettlementAmount ?? 0,
        commissionRewardSettled: request.commissionRewardSettled ?? 0,
        commissionPlatformSettled: request.commissionPlatformSettled ?? 0,
        adminUid: profile.uid,
        at: Date.now(),
        reason: reason || undefined,
      });
      return { result: { id: request.id, status: request.status } };
    });
    res.json({ ok: true });
  } catch (error) {
    respondError(res, error);
  }
});

router.post("/cashback/merchant/withdrawals", async (req, res) => {
  const profile = (req as AuthenticatedRequest).cashbackProfile;
  try {
    unauthorizedRole(profile, "merchant");
    const parsed = CreateCashbackMerchantWithdrawalBody.safeParse(req.body);
    if (!parsed.success) throw new CashbackError(400, "INVALID_REQUEST");
    const amount = roundMoney(parsed.data.amount);
    const requestId = `wd_${randomUUID().replaceAll("-", "").slice(0, 20)}`;
    const reference = `WD-${randomUUID().replaceAll("-", "").slice(0, 14).toUpperCase()}`;
    await mutateCashbackState((state) => {
      const merchant = (state.merchants ?? []).find((entry: any) => entry.id === profile.eid);
      if (!merchant || merchant.status !== "active") throw new CashbackError(403, "MERCHANT_NOT_ACTIVE");
      const commissionDue = getMerchantCommissionDue(state, merchant.id);
      const withdrawable = roundMoney(Math.max(0, Number(merchant.payoutBalance ?? 0) - commissionDue));
      if (amount > withdrawable) {
        throw new CashbackError(400, "WITHDRAWAL_EXCEEDS_AVAILABLE");
      }
      merchant.payoutBalance = roundMoney(Number(merchant.payoutBalance ?? 0) - amount);
      merchant.reservedWithdrawalBalance = roundMoney(Number(merchant.reservedWithdrawalBalance ?? 0) + amount);
      state.merchantWithdrawals ??= [];
      const request = {
        id: requestId,
        reference,
        merchantId: merchant.id,
        merchantUid: profile.uid,
        country: merchant.country,
        currency: merchant.country === "Libya" ? "LYD" : "DZD",
        amount,
        commissionDueAtRequest: commissionDue,
        availableBalanceAtRequest: withdrawable,
        method: fieldString(parsed.data.method),
        accountDetails: fieldString(parsed.data.accountDetails),
        status: "pending",
        createdAt: Date.now(),
      };
      state.merchantWithdrawals.unshift(request);
      addCashbackNotification(state, merchant.id, "merchant.withdrawal.submitted", {
        amount,
        currency: request.currency,
        requestId,
      });
      addCashbackNotification(state, "admin", "admin.withdrawal.new", {
        merchant: merchant.name,
        merchantId: merchant.id,
        amount,
        currency: request.currency,
        requestId,
      });
      return { result: { id: requestId, reference, status: "pending" } };
    });
    res.status(201).json({ id: requestId, reference, status: "pending" });
  } catch (error) {
    respondError(res, error);
  }
});

router.patch("/cashback/admin/withdrawals/:id/update", async (req, res) => {
  const profile = (req as unknown as AuthenticatedRequest).cashbackProfile;
  try {
    requireAdmin(profile);
    const params = UpdateCashbackMerchantWithdrawalParams.safeParse(req.params);
    const parsed = UpdateCashbackMerchantWithdrawalBody.safeParse(req.body);
    if (!params.success || !parsed.success) throw new CashbackError(400, "INVALID_REQUEST");
    const reason = fieldString(parsed.data.reason);
    const transferReference = fieldString(parsed.data.transferReference);
    const proofUploadId = fieldString(parsed.data.transferProofUploadId);
    const proofObjectPath = fieldString(parsed.data.transferProofObjectPath);
    if (parsed.data.status === "rejected" && !reason) throw new CashbackError(400, "REJECTION_REASON_REQUIRED");
    if (parsed.data.status === "paid" && !transferReference) throw new CashbackError(400, "TRANSFER_REFERENCE_REQUIRED");
    if (parsed.data.status === "paid" && (!proofUploadId || !proofObjectPath)) {
      throw new CashbackError(400, "TRANSFER_PROOF_REQUIRED");
    }
    if (parsed.data.status !== "paid" && (proofUploadId || proofObjectPath)) {
      throw new CashbackError(400, "INVALID_REQUEST");
    }
    let transferProof: Awaited<ReturnType<typeof verifyMerchantUpload>> | undefined;
    if (parsed.data.status === "paid") {
      const { state } = await getState();
      const request = (state.merchantWithdrawals ?? []).find((entry: any) => entry.id === params.data.id);
      if (!request) throw new CashbackError(404, "WITHDRAWAL_NOT_FOUND");
      if (request.status !== "transferring") throw new CashbackError(409, "INVALID_WITHDRAWAL_TRANSITION");
      const merchant = (state.merchants ?? []).find((entry: any) => entry.id === request.merchantId);
      if (!merchant) throw new CashbackError(409, "MERCHANT_NOT_FOUND");
      transferProof = await verifyMerchantUpload(
        request.merchantUid,
        merchant.id,
        "withdrawal-proof",
        proofUploadId,
        proofObjectPath,
        request.id,
      );
    }
    await mutateCashbackState((state) => {
      const request = (state.merchantWithdrawals ?? []).find((entry: any) => entry.id === params.data.id);
      if (!request) throw new CashbackError(404, "WITHDRAWAL_NOT_FOUND");
      const transitions: Record<string, string[]> = {
        pending: ["approved", "rejected"],
        approved: ["transferring", "rejected"],
        transferring: ["paid", "rejected"],
      };
      if (!transitions[request.status]?.includes(parsed.data.status)) {
        throw new CashbackError(409, "INVALID_WITHDRAWAL_TRANSITION");
      }
      const merchant = (state.merchants ?? []).find((entry: any) => entry.id === request.merchantId);
      if (!merchant) throw new CashbackError(409, "MERCHANT_NOT_FOUND");
      if (parsed.data.status === "rejected") {
        merchant.reservedWithdrawalBalance = roundMoney(
          Math.max(0, Number(merchant.reservedWithdrawalBalance ?? 0) - Number(request.amount)),
        );
        merchant.payoutBalance = roundMoney(Number(merchant.payoutBalance ?? 0) + Number(request.amount));
      }
      if (parsed.data.status === "paid") {
        merchant.reservedWithdrawalBalance = roundMoney(
          Math.max(0, Number(merchant.reservedWithdrawalBalance ?? 0) - Number(request.amount)),
        );
        request.transferReference = transferReference;
        request.transferProofId = transferProof?.photoId;
        request.transferProofObjectPath = proofObjectPath;
        request.paidAt = Date.now();
      }
      request.status = parsed.data.status;
      request.reason = reason || undefined;
      request.updatedAt = Date.now();
      request.reviewedBy = profile.uid;
      const withdrawalNotificationType: Record<string, string> = {
        approved: "merchant.withdrawal.approved",
        transferring: "merchant.withdrawal.transferring",
        paid: "merchant.withdrawal.paid",
        rejected: "merchant.withdrawal.rejected",
      };
      addCashbackNotification(
        state,
        merchant.id,
        withdrawalNotificationType[parsed.data.status] ?? "merchant.withdrawal.approved",
        {
          amount: request.amount,
          currency: request.currency,
          reason,
          reference: transferReference,
          requestId: request.id,
        },
      );
      state.audit ??= [];
      state.audit.unshift({
        id: `audit_${randomUUID().replaceAll("-", "").slice(0, 18)}`,
        action: `merchant_withdrawal_${parsed.data.status}`,
        requestId: request.id,
        merchantId: merchant.id,
        amount: request.amount,
        transferReference: transferReference || undefined,
        transferProofId: transferProof?.photoId,
        adminUid: profile.uid,
        at: Date.now(),
        reason: reason || undefined,
      });
      return {
        result: { id: request.id, status: request.status },
        extraWrites: transferProof?.writes,
      };
    });
    res.json({ ok: true });
  } catch (error) {
    respondError(res, error);
  }
});

router.post("/cashback/admin/withdrawals/:id/proof-upload-url", async (req, res) => {
  const profile = (req as unknown as AuthenticatedRequest).cashbackProfile;
  try {
    requireAdmin(profile);
    const params = CreateCashbackAdminWithdrawalProofUploadParams.safeParse(req.params);
    const parsed = CreateCashbackAdminWithdrawalProofUploadBody.safeParse(req.body);
    if (!params.success || !parsed.success) throw new CashbackError(400, "INVALID_REQUEST");
    const { state } = await getState();
    const request = (state.merchantWithdrawals ?? []).find((entry: any) => entry.id === params.data.id);
    if (!request) throw new CashbackError(404, "WITHDRAWAL_NOT_FOUND");
    if (request.status !== "transferring") throw new CashbackError(409, "INVALID_WITHDRAWAL_TRANSITION");
    const merchant = (state.merchants ?? []).find((entry: any) => entry.id === request.merchantId);
    if (!merchant || !request.merchantUid) throw new CashbackError(409, "MERCHANT_NOT_FOUND");

    const uploadId = `merchant_asset_${randomUUID().replaceAll("-", "")}`;
    const upload = await createMerchantAssetUpload(
      request.merchantUid,
      merchant.id,
      "withdrawal-proof",
      uploadId,
    );
    const createdAt = Date.now();
    const stored = await commit([
      documentWrite("merchant_asset_uploads", uploadId, {
        ownerUid: request.merchantUid,
        requestedByUid: profile.uid,
        merchantId: merchant.id,
        asset: "withdrawal-proof",
        objectPath: upload.objectPath,
        contentType: parsed.data.contentType,
        declaredSize: parsed.data.size,
        withdrawalId: request.id,
        createdAt,
        expiresAt: createdAt + 10 * 60 * 1000,
      }, false),
    ]);
    if (!stored) throw new CashbackError(409, "UPLOAD_ALREADY_EXISTS");
    res.status(201).json(CreateCashbackAdminWithdrawalProofUploadResponse.parse({
      uploadURL: upload.uploadURL,
      objectPath: upload.objectPath,
      uploadId,
    }));
  } catch (error) {
    respondError(res, error);
  }
});

router.patch("/cashback/admin/merchants/:id/commission-rates", async (req, res) => {
  const profile = (req as unknown as AuthenticatedRequest).cashbackProfile;
  try {
    requireAdmin(profile);
    const params = UpdateCashbackMerchantCommissionRatesParams.safeParse(req.params);
    const parsed = UpdateCashbackMerchantCommissionRatesBody.safeParse(req.body);
    if (!params.success || !parsed.success) throw new CashbackError(400, "INVALID_REQUEST");
    await mutateCashbackState((state) => {
      const merchant = (state.merchants ?? []).find((entry: any) => entry.id === params.data.id);
      if (!merchant) throw new CashbackError(404, "MERCHANT_NOT_FOUND");
      const cashbackRate = parsed.data.cashbackRate;
      const platformCommissionRate = parsed.data.platformCommissionRate;
      const effectiveCashbackRate = Number(cashbackRate ?? state.settings?.cashback ?? 4);
      const effectiveCommissionRate = Number(
        platformCommissionRate ?? state.settings?.platformCommission ?? 2,
      );
      if (effectiveCashbackRate + effectiveCommissionRate > 100) {
        throw new CashbackError(400, "TOTAL_COMMISSION_EXCEEDS_100");
      }
      merchant.cashbackRate = cashbackRate;
      merchant.platformCommissionRate = platformCommissionRate;
      state.audit ??= [];
      state.audit.unshift({
        id: `audit_${randomUUID().replaceAll("-", "").slice(0, 18)}`,
        action: "merchant_commission_rates_updated",
        merchantId: merchant.id,
        cashbackRate,
        platformCommissionRate,
        effectiveCashbackRate,
        effectiveCommissionRate,
        adminUid: profile.uid,
        at: Date.now(),
      });
      return {
        result: {
          merchantId: merchant.id,
          cashbackRate,
          platformCommissionRate,
          effectiveCashbackRate,
          effectiveCommissionRate,
        },
      };
    });
    res.json({ ok: true });
  } catch (error) {
    respondError(res, error);
  }
});

router.patch("/cashback/settings/payment-methods", async (req, res) => {
  const profile = (req as AuthenticatedRequest).cashbackProfile;
  try {
    requireAdmin(profile);
    const parsed = UpdateCashbackPaymentMethodsBody.safeParse(req.body);
    if (!parsed.success) throw new CashbackError(400, "INVALID_REQUEST");
    const ids = parsed.data.methods.map((method) => method.id.trim());
    if (new Set(ids).size !== ids.length) throw new CashbackError(400, "DUPLICATE_PAYMENT_METHOD_ID");
    await mutateCashbackState((state) => {
      state.settings ??= {};
      state.settings.paymentMethods = parsed.data.methods.map((method) => ({
        ...method,
        id: method.id.trim(),
        name: method.name.trim(),
        beneficiary: method.beneficiary.trim(),
        account: method.account.trim(),
        phone: method.phone?.trim() ?? "",
        instructions: method.instructions.trim(),
      }));
      if (parsed.data.maxTopupAmountDzd !== undefined) {
        state.settings.maxTopupAmountDzd = parsed.data.maxTopupAmountDzd === null
          ? null
          : roundMoney(parsed.data.maxTopupAmountDzd);
      }
      if (parsed.data.maxTopupAmountLyd !== undefined) {
        state.settings.maxTopupAmountLyd = parsed.data.maxTopupAmountLyd === null
          ? null
          : roundMoney(parsed.data.maxTopupAmountLyd);
      }
      return { result: { ok: true, count: state.settings.paymentMethods.length } };
    });
    res.json({ ok: true, count: parsed.data.methods.length });
  } catch (error) {
    respondError(res, error);
  }
});

router.post("/cashback/merchant/notifications/read-all", async (req, res) => {
  const profile = (req as AuthenticatedRequest).cashbackProfile;
  try {
    unauthorizedRole(profile, "merchant");
    const result = await mutateCashbackState((state) => {
      let updated = 0;
      for (const note of state.notes ?? []) {
        if (note.to === profile.eid && !note.read) {
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

export default router;
