import { randomBytes } from "node:crypto";

const roundLedgerAmount = (value: number) =>
  Math.round((value + Number.EPSILON) * 100) / 100;

export function calculateCommissionAmounts(
  invoiceAmount: number,
  cashbackRate: number,
  platformCommissionRate: number,
) {
  if (
    !Number.isFinite(invoiceAmount) ||
    invoiceAmount < 0 ||
    !Number.isFinite(cashbackRate) ||
    cashbackRate < 0 ||
    !Number.isFinite(platformCommissionRate) ||
    platformCommissionRate < 0 ||
    cashbackRate + platformCommissionRate > 100
  ) {
    throw new RangeError("Invalid commission amounts or rates");
  }
  const cashbackAmount = roundLedgerAmount((invoiceAmount * cashbackRate) / 100);
  const platformCommissionAmount = roundLedgerAmount(
    (invoiceAmount * platformCommissionRate) / 100,
  );
  const merchantObligationAmount = roundLedgerAmount(
    cashbackAmount + platformCommissionAmount,
  );
  return {
    cashbackAmount,
    platformCommissionAmount,
    merchantObligationAmount,
    netSaleAmount: roundLedgerAmount(invoiceAmount - merchantObligationAmount),
  };
}

export function getMerchantCommissionDue(state: any, merchantId: string): number {
  const ledger = Array.isArray(state.merchantCommissionLedger)
    ? state.merchantCommissionLedger
    : [];
  return roundLedgerAmount(
    ledger
      .filter((entry: any) => entry.merchantId === merchantId)
      .reduce(
        (sum: number, entry: any) =>
          sum +
          Number(entry.rewardOutstanding ?? 0) +
          Number(entry.platformCommissionOutstanding ?? 0),
        0,
      ),
  );
}

export function settleMerchantCommissionObligations(
  state: any,
  merchant: Record<string, any>,
  sourceId: string,
): { amount: number; rewardAmount: number; platformCommissionAmount: number } {
  state.merchantCommissionLedger ??= [];
  state.merchantCommissionSettlements ??= [];
  let available = Math.max(0, roundLedgerAmount(Number(merchant.topupBalance ?? 0)));
  let rewardAmount = 0;
  let platformCommissionAmount = 0;
  const ledger = state.merchantCommissionLedger
    .filter(
      (entry: any) =>
        entry.merchantId === merchant.id &&
        (Number(entry.rewardOutstanding ?? 0) > 0 ||
          Number(entry.platformCommissionOutstanding ?? 0) > 0),
    )
    .sort((a: any, b: any) => Number(a.createdAt ?? 0) - Number(b.createdAt ?? 0));

  for (const entry of ledger) {
    if (available <= 0) break;
    const rewardPaid = Math.min(
      available,
      Math.max(0, Number(entry.rewardOutstanding ?? 0)),
    );
    if (rewardPaid > 0) {
      entry.rewardOutstanding = roundLedgerAmount(
        Number(entry.rewardOutstanding) - rewardPaid,
      );
      entry.settledReward = roundLedgerAmount(
        Number(entry.settledReward ?? 0) + rewardPaid,
      );
      available = roundLedgerAmount(available - rewardPaid);
      rewardAmount = roundLedgerAmount(rewardAmount + rewardPaid);
    }
    const commissionPaid = Math.min(
      available,
      Math.max(0, Number(entry.platformCommissionOutstanding ?? 0)),
    );
    if (commissionPaid > 0) {
      entry.platformCommissionOutstanding = roundLedgerAmount(
        Number(entry.platformCommissionOutstanding) - commissionPaid,
      );
      entry.settledPlatformCommission = roundLedgerAmount(
        Number(entry.settledPlatformCommission ?? 0) + commissionPaid,
      );
      available = roundLedgerAmount(available - commissionPaid);
      platformCommissionAmount = roundLedgerAmount(
        platformCommissionAmount + commissionPaid,
      );
    }
    entry.settledAmount = roundLedgerAmount(
      Number(entry.settledReward ?? 0) +
        Number(entry.settledPlatformCommission ?? 0),
    );
    entry.outstandingAmount = roundLedgerAmount(
      Number(entry.rewardOutstanding ?? 0) +
        Number(entry.platformCommissionOutstanding ?? 0),
    );
    entry.status =
      entry.outstandingAmount <= 0
        ? "settled"
        : entry.settledAmount > 0
          ? "partially_settled"
          : "due";
    if (entry.outstandingAmount <= 0) entry.settledAt = Date.now();
    entry.updatedAt = Date.now();
    if (rewardPaid > 0 || commissionPaid > 0) {
      state.merchantCommissionSettlements.unshift({
        id: `cms_${randomBytes(10).toString("hex")}`,
        merchantId: merchant.id,
        commissionEntryId: entry.id,
        receiptId: entry.receiptId,
        country: entry.country ?? null,
        currency: entry.currency ?? null,
        source: "merchant_topup_balance",
        sourceId,
        rewardAmount: rewardPaid,
        platformCommissionAmount: commissionPaid,
        amount: roundLedgerAmount(rewardPaid + commissionPaid),
        at: Date.now(),
      });
    }
  }
  merchant.topupBalance = available;
  return {
    amount: roundLedgerAmount(rewardAmount + platformCommissionAmount),
    rewardAmount,
    platformCommissionAmount,
  };
}
