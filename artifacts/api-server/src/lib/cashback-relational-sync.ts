type Row = Record<string, any>;

const asArray = (value: unknown): Row[] =>
  Array.isArray(value) ? value.filter((entry): entry is Row => Boolean(entry) && typeof entry === "object") : [];

const asObject = (value: unknown): Row =>
  value && typeof value === "object" && !Array.isArray(value) ? value as Row : {};

function omit(source: Row, keys: string[]): Row {
  const result = { ...source };
  for (const key of keys) delete result[key];
  return result;
}

const text = (value: unknown): string | null => {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
};

const amount = (value: unknown): string => {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number.toFixed(2) : "0.00";
};

const timestamp = (value: unknown): Date | null => {
  if (value === null || value === undefined || value === "") return null;
  const date = typeof value === "number" || /^\d+$/.test(String(value))
    ? new Date(Number(value))
    : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
};

function decodeValue(value: any): any {
  if (!value || typeof value !== "object") return null;
  if ("stringValue" in value) return value.stringValue;
  if ("integerValue" in value) return Number(value.integerValue);
  if ("doubleValue" in value) return Number(value.doubleValue);
  if ("booleanValue" in value) return value.booleanValue;
  if ("nullValue" in value) return null;
  if (value.mapValue) return decodeFields(value.mapValue.fields ?? {});
  if (value.arrayValue) return (value.arrayValue.values ?? []).map(decodeValue);
  return null;
}

function decodeFields(fields: Record<string, any>): Row {
  return Object.fromEntries(Object.entries(fields ?? {}).map(([key, value]) => [key, decodeValue(value)]));
}

function documentFields(body: any): Row {
  return decodeFields(body?.fields ?? {});
}

async function upsertMany(
  client: any,
  table: string,
  columns: string[],
  conflictColumns: string[],
  rows: unknown[][],
): Promise<void> {
  if (!rows.length) return;
  const chunkSize = Math.max(1, Math.floor(60000 / columns.length));
  for (let offset = 0; offset < rows.length; offset += chunkSize) {
    const chunk = rows.slice(offset, offset + chunkSize);
    const values: unknown[] = [];
    const tuples = chunk.map((row) => {
      const placeholders = row.map((value) => {
        values.push(value);
        return `$${values.length}`;
      });
      return `(${placeholders.join(", ")})`;
    });
    const updates = columns
      .filter((column) => !conflictColumns.includes(column))
      .map((column) => `${column} = EXCLUDED.${column}`)
      .join(", ");
    await client.query(
      `INSERT INTO ${table} (${columns.join(", ")})
       VALUES ${tuples.join(", ")}
       ON CONFLICT (${conflictColumns.join(", ")})
       ${updates ? `DO UPDATE SET ${updates}` : "DO NOTHING"}`,
      values,
    );
  }
}

export async function syncCashbackRelationalState(client: any, state: Row): Promise<void> {
  const customers = asArray(state.customers);
  const merchants = asArray(state.merchants);
  const claims = asArray(state.claims);
  const commissionLedger = asArray(state.merchantCommissionLedger);
  const payments = asArray(state.cbpays);
  const topups = asArray(state.merchantTopups);
  const withdrawals = asArray(state.merchantWithdrawals);
  const notes = asArray(state.notes);
  const audit = asArray(state.audit);
  const settings = asObject(state.settings);
  const now = new Date();

  // Auth documents remain compatible with the existing sign-in flow; their safe
  // server-side records are mirrored into the relational users table.
  const authDocs = await client.query(
    "SELECT path, body FROM cashback_documents WHERE path LIKE 'users/%' OR path LIKE 'accounts/%'",
  );
  const profiles = new Map<string, Row>();
  const accounts = new Map<string, Row>();
  for (const doc of authDocs.rows) {
    const [collection, ...parts] = doc.path.split("/");
    const id = parts.join("/");
    if (!id) continue;
    (collection === "accounts" ? accounts : profiles).set(id, documentFields(doc.body));
  }
  const userIds = new Set([...profiles.keys(), ...accounts.keys()]);
  const users = [...userIds].map((id) => {
    const profile = profiles.get(id) ?? {};
    const account = accounts.get(id) ?? {};
    const entityId = text(profile.eid ?? account.eid) ?? id;
    const role = text(profile.role ?? account.role) ?? "customer";
    const entity = role === "merchant"
      ? merchants.find((entry) => entry.id === entityId)
      : role === "customer"
        ? customers.find((entry) => entry.id === entityId)
        : undefined;
    return {
      id,
      role,
      entityId,
      email: text(profile.email ?? account.email),
      phone: text(profile.phone ?? account.phone),
      name: text(profile.name ?? account.name),
      status: text(entity?.status) ?? "active",
      passwordSalt: text(account.passwordSalt),
      passwordHash: text(account.passwordHash),
      preferences: asObject(profile.preferences),
      record: { profile, account: { role: account.role, eid: account.eid } },
    };
  });

  await upsertMany(client, "users",
    ["id", "role", "entity_id", "email", "phone", "name", "status", "password_salt", "password_hash", "preferences", "record", "updated_at"],
    ["id"],
    users.map((user) => [
      user.id, user.role, user.entityId, user.email, user.phone, user.name, user.status,
      user.passwordSalt, user.passwordHash, user.preferences, user.record, now,
    ]),
  );

  const categoryValues = Array.isArray(state.categories) ? state.categories : [];
  const categories = [...new Set(categoryValues
    .map((entry: any) => text(typeof entry === "object" ? entry.key ?? entry.slug : entry))
    .filter((entry): entry is string => Boolean(entry)))];
  if (!categories.length) {
    categories.push("restaurants", "cafes", "clothing", "electronics", "malls", "groceries", "perfume", "gifts", "shops");
  }
  await upsertMany(client, "merchant_categories",
    ["key", "name", "active", "sort_order", "record"],
    ["key"],
    categories.map((key, sortOrder) => [key, key, true, sortOrder, { key }]),
  );

  await upsertMany(client, "customers",
    ["id", "user_id", "name", "email", "phone", "status", "record", "updated_at"],
    ["id"],
    customers.map((customer) => [
      customer.id,
      text(customer.profileUid) && userIds.has(String(customer.profileUid)) ? String(customer.profileUid) : null,
      text(customer.name) ?? "Customer",
      text(customer.email),
      text(customer.phone),
      text(customer.status) ?? "active",
      omit(customer, ["cbm", "wallet"]),
      now,
    ]),
  );

  await upsertMany(client, "merchants",
    ["id", "user_id", "name", "status", "country", "city", "category_key", "phone", "public_id", "qr_value", "cashback_rate", "platform_commission_rate", "record", "updated_at"],
    ["id"],
    merchants.map((merchant) => [
      merchant.id,
      text(merchant.profileUid) && userIds.has(String(merchant.profileUid)) ? String(merchant.profileUid) : null,
      text(merchant.name) ?? "Merchant",
      text(merchant.status) ?? "pending",
      text(merchant.country),
      text(merchant.city ?? merchant.wilaya),
      categories.includes(String(merchant.cat ?? "")) ? merchant.cat : null,
      text(merchant.phone),
      text(merchant.publicId),
      text(merchant.qrValue),
      String(Number(merchant.cashbackRate ?? settings.cashback ?? 4)),
      String(Number(merchant.platformCommissionRate ?? settings.platformCommission ?? 2)),
      omit(merchant, ["topupBalance", "payoutBalance", "payoutDebt", "reservedWithdrawalBalance"]),
      now,
    ]),
  );

  await upsertMany(client, "merchant_locations",
    ["merchant_id", "country", "city", "address", "maps_url", "latitude", "longitude", "opening_hours", "record", "updated_at"],
    ["merchant_id"],
    merchants.map((merchant) => [
      merchant.id, text(merchant.country), text(merchant.city ?? merchant.wilaya),
      text(merchant.address), text(merchant.mapsUrl ?? merchant.location),
      merchant.lat == null ? null : String(merchant.lat),
      merchant.lng == null ? null : String(merchant.lng),
      asObject(merchant.openingHours), merchant, now,
    ]),
  );

  await upsertMany(client, "merchant_join_requests",
    ["id", "merchant_id", "status", "rejection_reason", "submitted_at", "reviewed_at", "record"],
    ["id"],
    merchants.map((merchant) => [
      `join_${merchant.id}`, merchant.id, text(merchant.status) ?? "pending",
      text(merchant.rejectionReason ?? merchant.reason), timestamp(merchant.createdAt ?? merchant.created),
      timestamp(merchant.reviewedAt), merchant,
    ]),
  );

  const merchantById = new Map(merchants.map((merchant) => [String(merchant.id), merchant]));
  const photoDocs = await client.query(
    "SELECT path, body FROM cashback_documents WHERE path LIKE 'photos/%'",
  );
  const photoPaths = new Map<string, string>();
  for (const photo of photoDocs.rows) {
    const id = String(photo.path).slice("photos/".length);
    const objectPath = text(documentFields(photo.body).objectPath);
    if (id && objectPath) photoPaths.set(id, objectPath);
  }
  await upsertMany(client, "invoices",
    ["id", "customer_id", "merchant_id", "invoice_number", "invoice_date", "amount", "currency", "status", "cashback_amount", "image_path", "image_hash", "submitter_ip", "reviewed_at", "rejection_reason", "record", "created_at", "updated_at"],
    ["id"],
    claims
      .filter((claim) => customers.some((customer) => customer.id === claim.cid) && merchantById.has(String(claim.mid)))
      .map((claim) => {
        const merchant = merchantById.get(String(claim.mid))!;
        return [
          claim.id, claim.cid, claim.mid, text(claim.invoiceNumber ?? claim.no), text(claim.date),
          amount(claim.amount), merchant.country === "Libya" ? "LYD" : "DZD",
          text(claim.status) ?? "pending", amount(claim.cashback),
          text(claim.photoObjectPath) ?? photoPaths.get(String(claim.photoId)) ?? null,
          text(claim.imageHash), text(claim.submitIp),
          timestamp(claim.reviewedAt), text(claim.reason ?? claim.rejectionReason), claim,
          timestamp(claim.created) ?? now, now,
        ];
      }),
  );

  await upsertMany(client, "invoice_verifications",
    ["id", "invoice_id", "reviewer_user_id", "status", "reason", "duplicate_details", "checked_at"],
    ["id"],
    claims.filter((claim) => claim.status !== "pending")
      .map((claim) => [
        `verification_${claim.id}`, claim.id,
        text(claim.reviewedBy) && profiles.has(String(claim.reviewedBy)) ? String(claim.reviewedBy) : null,
        text(claim.status) ?? "pending", text(claim.reason ?? claim.rejectionReason),
        { possibleDuplicate: Boolean(claim.possibleDuplicate), imageHash: claim.imageHash ?? null },
        timestamp(claim.reviewedAt) ?? now,
      ]),
  );

  const ledgersFor = (customerId: string, merchantId: string) =>
    commissionLedger.filter((entry) => entry.customerId === customerId && entry.merchantId === merchantId);
  const paymentsFor = (customerId: string, merchantId: string) =>
    payments.filter((entry) => entry.cid === customerId && entry.mid === merchantId && entry.status === "done");
  const accountRows: unknown[][] = [];
  for (const customer of customers) {
    const balances = asObject(customer.cbm);
    const merchantIds = new Set([
      ...Object.keys(balances),
      ...commissionLedger.filter((entry) => entry.customerId === customer.id).map((entry) => String(entry.merchantId)),
      ...payments.filter((entry) => entry.cid === customer.id).map((entry) => String(entry.mid)),
    ]);
    for (const merchantId of merchantIds) {
      if (!merchantById.has(merchantId)) continue;
      const ledger = ledgersFor(String(customer.id), merchantId);
      const spent = paymentsFor(String(customer.id), merchantId);
      accountRows.push([
        customer.id, merchantId, amount(balances[merchantId]),
        amount(ledger.reduce((sum, entry) => sum + Number(entry.cashbackAmount ?? 0), 0)),
        amount(spent.reduce((sum, entry) => sum + Number(entry.amount ?? 0), 0)),
        now,
      ]);
    }
  }
  await upsertMany(client, "cashback_accounts",
    ["customer_id", "merchant_id", "balance", "earned_total", "used_total", "updated_at"],
    ["customer_id", "merchant_id"], accountRows);

  const topupsFor = (merchantId: string) => topups.filter((entry) => entry.merchantId === merchantId);
  const withdrawalsFor = (merchantId: string) => withdrawals.filter((entry) => entry.merchantId === merchantId);
  await upsertMany(client, "wallets",
    ["merchant_id", "currency", "funded_balance", "payout_balance", "reserved_withdrawal_balance", "commission_due", "updated_at"],
    ["merchant_id"],
    merchants.map((merchant) => [
      merchant.id, merchant.country === "Libya" ? "LYD" : "DZD",
      amount(merchant.topupBalance), amount(merchant.payoutBalance),
      amount(merchant.reservedWithdrawalBalance),
      amount(commissionLedger.filter((entry) => entry.merchantId === merchant.id)
        .reduce((sum, entry) => sum + Number(entry.outstandingAmount ?? 0), 0)),
      now,
    ]),
  );

  await upsertMany(client, "payments",
    ["id", "reference", "session_id", "customer_id", "merchant_id", "amount", "currency", "status", "kind", "created_at", "record"],
    ["id"],
    payments.filter((payment) =>
      customers.some((customer) => customer.id === payment.cid) && merchantById.has(String(payment.mid)))
      .map((payment) => [
        payment.id, text(payment.reference) ?? String(payment.id), text(payment.sessionId),
        payment.cid, payment.mid, amount(payment.amount),
        merchantById.get(String(payment.mid))?.country === "Libya" ? "LYD" : "DZD",
        text(payment.status) ?? "done", "qr_redemption",
        timestamp(payment.at ?? payment.done) ?? now, payment,
      ]),
  );

  const rewardTransactions = commissionLedger
    .filter((entry) => customers.some((customer) => customer.id === entry.customerId) && merchantById.has(String(entry.merchantId)))
    .map((entry) => [
      `reward_${entry.id}`, entry.customerId, entry.merchantId, text(entry.receiptId), null,
      "earn", entry.status === "reversed" ? "reversed" : "posted", amount(entry.cashbackAmount),
      merchantById.get(String(entry.merchantId))?.country === "Libya" ? "LYD" : "DZD",
      timestamp(entry.createdAt) ?? now, entry,
    ]);
  const redemptionTransactions = payments
    .filter((payment) => ["done", "reversed"].includes(String(payment.status)) && customers.some((customer) => customer.id === payment.cid) && merchantById.has(String(payment.mid)))
    .map((payment) => [
      `redeem_${payment.id}`, payment.cid, payment.mid, null, payment.id, "redeem",
      payment.status === "reversed" ? "reversed" : "posted", amount(payment.amount),
      merchantById.get(String(payment.mid))?.country === "Libya" ? "LYD" : "DZD",
      timestamp(payment.at ?? payment.done) ?? now, payment,
    ]);
  const paymentReversals = payments
    .filter((payment) => payment.status === "reversed" && customers.some((customer) => customer.id === payment.cid) && merchantById.has(String(payment.mid)))
    .map((payment) => [
      `reversal_${payment.id}`, payment.cid, payment.mid, null, payment.id, "reversal",
      "posted", amount(payment.amount),
      merchantById.get(String(payment.mid))?.country === "Libya" ? "LYD" : "DZD",
      timestamp(payment.reversedAt) ?? now,
      { reference: payment.reference, reason: payment.reversalReason, reversedBy: payment.reversedBy },
    ]);
  await upsertMany(client, "cashback_transactions",
    ["id", "customer_id", "merchant_id", "invoice_id", "payment_id", "kind", "status", "amount", "currency", "created_at", "record"],
    ["id"], [...rewardTransactions, ...redemptionTransactions, ...paymentReversals]);

  const topupRows = topups.filter((entry) => merchantById.has(String(entry.merchantId))).map((entry) => [
    entry.id, entry.merchantId, amount(entry.amount), text(entry.currency) ?? "DZD",
    text(entry.status) ?? "pending", text(entry.paymentMethodId),
    text(entry.proofObjectPath ?? entry.receiptPath),
    text(entry.reason), timestamp(entry.createdAt) ?? now, timestamp(entry.reviewedAt), entry,
  ]);
  await upsertMany(client, "merchant_topups",
    ["id", "merchant_id", "amount", "currency", "status", "payment_method_id", "receipt_path", "rejection_reason", "created_at", "reviewed_at", "record"],
    ["id"], topupRows);

  const withdrawalRows = withdrawals.filter((entry) => merchantById.has(String(entry.merchantId))).map((entry) => [
    entry.id, entry.merchantId, amount(entry.amount), text(entry.currency) ?? "DZD",
    text(entry.status) ?? "pending", text(entry.method),
    { accountDetails: text(entry.accountDetails) },
    text(entry.transferReference ?? entry.reference), text(entry.transferProofPath),
    text(entry.reason), timestamp(entry.createdAt) ?? now,
    timestamp(entry.updatedAt ?? entry.reviewedAt) ?? now,
    omit(entry, ["accountDetails"]),
  ]);
  await upsertMany(client, "merchant_withdrawals",
    ["id", "merchant_id", "amount", "currency", "status", "method", "payout_details", "transfer_reference", "transfer_proof_path", "rejection_reason", "created_at", "updated_at", "record"],
    ["id"], withdrawalRows);

  const walletRows: unknown[][] = [];
  for (const merchant of merchants) {
    for (const entry of topupsFor(String(merchant.id))) walletRows.push([
      `topup_${entry.id}`, merchant.id, "topup",
      entry.status === "approved" ? "in" : entry.status === "rejected" ? "void" : "pending",
      amount(entry.amount),
      text(entry.currency) ?? "DZD", text(entry.status) ?? "pending",
      text(entry.reference), timestamp(entry.createdAt) ?? now, entry,
    ]);
    for (const entry of withdrawalsFor(String(merchant.id))) walletRows.push([
      `withdrawal_${entry.id}`, merchant.id, "withdrawal",
      entry.status === "paid" ? "out" : entry.status === "rejected" ? "void" : "pending",
      amount(entry.amount),
      text(entry.currency) ?? "DZD", text(entry.status) ?? "pending",
      text(entry.reference), timestamp(entry.createdAt) ?? now, entry,
    ]);
    for (const payment of payments.filter((item) => item.mid === merchant.id && ["done", "reversed"].includes(String(item.status)))) walletRows.push([
      `payment_${payment.id}`, merchant.id, "qr_payment_received",
      payment.status === "done" ? "in" : "reversed", amount(payment.amount),
      merchant.country === "Libya" ? "LYD" : "DZD", text(payment.status) ?? "done",
      text(payment.reference), timestamp(payment.at ?? payment.done) ?? now, payment,
    ]);
    for (const payment of payments.filter((item) => item.mid === merchant.id && item.status === "reversed")) walletRows.push([
      `payment_reversal_${payment.id}`, merchant.id, "qr_payment_reversal", "out",
      amount(payment.amount), merchant.country === "Libya" ? "LYD" : "DZD", "done",
      text(payment.reference), timestamp(payment.reversedAt) ?? now,
      { paymentId: payment.id, reason: payment.reversalReason, reversedBy: payment.reversedBy },
    ]);
  }
  await upsertMany(client, "wallet_transactions",
    ["id", "merchant_id", "kind", "direction", "amount", "currency", "status", "reference", "created_at", "record"],
    ["id"], walletRows);

  await upsertMany(client, "commissions",
    ["id", "invoice_id", "customer_id", "merchant_id", "invoice_amount", "cashback_amount", "platform_amount", "due_amount", "settled_amount", "currency", "status", "created_at", "record"],
    ["id"],
    commissionLedger.filter((entry) =>
      merchantById.has(String(entry.merchantId)) &&
      customers.some((customer) => customer.id === entry.customerId))
      .map((entry) => [
        entry.id, text(entry.receiptId), entry.customerId, entry.merchantId,
        amount(entry.invoiceAmount), amount(entry.cashbackAmount),
        amount(entry.platformCommissionAmount), amount(entry.outstandingAmount),
        amount(entry.settledAmount),
        text(entry.currency) ?? (merchantById.get(String(entry.merchantId))?.country === "Libya" ? "LYD" : "DZD"),
        text(entry.status) ?? "due", timestamp(entry.createdAt) ?? now, entry,
      ]),
  );

  const paymentMethods = asArray(settings.paymentMethods);
  await upsertMany(client, "payment_methods",
    ["id", "country", "currency", "name", "beneficiary", "bank_name", "account_number", "ccp_number", "phone", "instructions", "active", "record"],
    ["id"],
    paymentMethods.filter((method) => text(method.id))
      .map((method) => [
        method.id, text(method.country) ?? "", text(method.currency) ?? "",
        text(method.name) ?? "Payment method", text(method.beneficiary),
        text(method.bankName ?? method.bank), text(method.accountNumber ?? method.account),
        text(method.ccpNumber ?? method.ccp), text(method.phone),
        text(method.instructions), method.active !== false,
        omit(method, ["beneficiary", "bankName", "bank", "accountNumber", "account", "ccpNumber", "ccp", "phone"]),
      ]),
  );

  await upsertMany(client, "notifications",
    ["id", "recipient_id", "recipient_role", "kind", "title", "message", "read", "read_at", "created_at", "record"],
    ["id"],
    notes.filter((note) => text(note.id))
      .map((note) => {
        const recipient = String(note.to ?? "");
        const recipientRole = recipient === "admin"
          ? "admin"
          : merchants.some((merchant) => merchant.id === recipient)
            ? "merchant"
            : "customer";
        const locale = asObject(note.messages).ar as Row | undefined;
        return [
          note.id, recipient, recipientRole, text(note.type) ?? "notification",
          text(locale?.title ?? note.title) ?? "Notification",
          text(locale?.body ?? note.text) ?? "",
          Boolean(note.read), timestamp(note.readAt),
          timestamp(note.t ?? note.createdAt) ?? now, note,
        ];
      }),
  );

  await upsertMany(client, "admin_users",
    ["user_id", "role", "active"],
    ["user_id"],
    users.filter((user) => user.role === "admin").map((user) => [user.id, "admin", user.status !== "suspended"]),
  );

  await upsertMany(client, "audit_logs",
    ["id", "actor_uid", "actor_role", "action", "resource_type", "resource_id", "created_at", "details"],
    ["id"],
    audit.filter((entry) => text(entry.id) && text(entry.action))
      .map((entry) => [
        entry.id, text(entry.adminUid ?? entry.actorUid ?? entry.uid),
        text(entry.actorRole), entry.action,
        text(entry.resourceType) ?? (entry.receiptId ? "invoice" : entry.paymentId ? "payment" : entry.merchantId ? "merchant" : "system"),
        text(entry.resourceId ?? entry.receiptId ?? entry.paymentId ?? entry.requestId ?? entry.merchantId),
        timestamp(entry.at ?? entry.createdAt) ?? now, entry,
      ]),
  );

  const { paymentMethods: _paymentMethods, ...normalizedSettings } = settings;
  await upsertMany(client, "app_settings",
    ["key", "value", "updated_at"],
    ["key"],
    [
      ["global", normalizedSettings, now],
      ["categories", { categories: state.categories ?? [] }, now],
    ],
  );
}
