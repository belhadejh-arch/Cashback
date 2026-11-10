import { randomUUID } from "node:crypto";

type Language = "ar" | "en" | "fr";
type LocalizedMessage = { title: string; body: string };
type NotificationTemplate = Record<Language, LocalizedMessage>;
type NoteData = Record<string, string | number | boolean | null | undefined>;
type NotificationState = {
  settings?: { notificationsEnabled?: boolean };
  notes?: any[];
};

const templates: Record<string, NotificationTemplate> = {
  "customer.receipt.submitted": {
    ar: { title: "تم استلام الفاتورة", body: "أُرسلت فاتورتك من {merchant} إلى المراجعة." },
    en: { title: "Invoice received", body: "Your invoice from {merchant} was sent for review." },
    fr: { title: "Facture reçue", body: "Votre facture de {merchant} a été envoyée pour vérification." },
  },
  "merchant.receipt.new": {
    ar: { title: "فاتورة جديدة", body: "أرسل {customer} فاتورة من متجرك، وهي قيد مراجعة الإدارة." },
    en: { title: "New invoice", body: "{customer} submitted an invoice for your store; it is under admin review." },
    fr: { title: "Nouvelle facture", body: "{customer} a envoyé une facture de votre commerce, en cours de vérification." },
  },
  "admin.receipt.new": {
    ar: { title: "فاتورة جديدة", body: "فاتورة جديدة من {customer} لدى {merchant} بانتظار المراجعة." },
    en: { title: "New invoice", body: "An invoice from {customer} at {merchant} is awaiting review." },
    fr: { title: "Nouvelle facture", body: "Une facture de {customer} chez {merchant} attend une vérification." },
  },
  "admin.security.suspicious_receipt": {
    ar: { title: "محاولة فاتورة مكررة", body: "رُفضت فاتورة مشتبه بها من الحساب {customerId} لدى {merchant}. السبب: {reason}." },
    en: { title: "Suspicious duplicate invoice", body: "A suspicious invoice from account {customerId} at {merchant} was blocked. Reason: {reason}." },
    fr: { title: "Facture potentiellement dupliquée", body: "Une facture suspecte du compte {customerId} chez {merchant} a été bloquée. Motif : {reason}." },
  },
  "customer.receipt.approved": {
    ar: { title: "تم قبول الفاتورة", body: "وافقت الإدارة على فاتورتك لدى {merchant}." },
    en: { title: "Invoice approved", body: "Your invoice from {merchant} was approved by the administration." },
    fr: { title: "Facture approuvée", body: "Votre facture de {merchant} a été approuvée par l’administration." },
  },
  "customer.receipt.rejected": {
    ar: { title: "تم رفض الفاتورة", body: "رُفضت فاتورتك لدى {merchant}. السبب: {reason}." },
    en: { title: "Invoice rejected", body: "Your invoice from {merchant} was rejected. Reason: {reason}." },
    fr: { title: "Facture refusée", body: "Votre facture de {merchant} a été refusée. Motif : {reason}." },
  },
  "customer.reward.added": {
    ar: { title: "أضيفت مكافأة كاش باك", body: "أُضيف {amount} {currency} إلى رصيدك لدى {merchant}." },
    en: { title: "Cashback added", body: "{amount} {currency} was added to your balance at {merchant}." },
    fr: { title: "Cashback crédité", body: "{amount} {currency} a été ajouté à votre solde chez {merchant}." },
  },
  "customer.balance.updated": {
    ar: { title: "تم تحديث رصيد المتجر", body: "رصيدك المتاح لدى {merchant} أصبح {balance} {currency}." },
    en: { title: "Shop balance updated", body: "Your available balance at {merchant} is now {balance} {currency}." },
    fr: { title: "Solde du commerce mis à jour", body: "Votre solde disponible chez {merchant} est maintenant de {balance} {currency}." },
  },
  "customer.qr.payment.completed": {
    ar: { title: "اكتمل الدفع", body: "دفعت {amount} {currency} لدى {merchant}. المرجع: {reference}." },
    en: { title: "Payment completed", body: "You paid {amount} {currency} at {merchant}. Reference: {reference}." },
    fr: { title: "Paiement terminé", body: "Vous avez payé {amount} {currency} chez {merchant}. Référence : {reference}." },
  },
  "merchant.application.pending": {
    ar: { title: "طلب الانضمام قيد المراجعة", body: "استلمنا طلب متجرك. ستصلك رسالة عند تحديث حالته." },
    en: { title: "Application under review", body: "Your store application was received. We will notify you when its status changes." },
    fr: { title: "Demande en cours", body: "La demande de votre commerce a été reçue. Vous serez averti de son évolution." },
  },
  "admin.merchant.application.new": {
    ar: { title: "طلب تاجر جديد", body: "طلب انضمام جديد من {merchant} في {city}، {country}." },
    en: { title: "New merchant application", body: "{merchant} submitted a store application in {city}, {country}." },
    fr: { title: "Nouvelle demande de commerce", body: "{merchant} a envoyé une demande à {city}, {country}." },
  },
  "merchant.application.approved": {
    ar: { title: "تم تفعيل متجرك", body: "وافقت الإدارة على طلب {merchant}. يمكنك الآن استخدام لوحة التاجر." },
    en: { title: "Store activated", body: "The administration approved {merchant}. Your merchant workspace is now available." },
    fr: { title: "Commerce activé", body: "L’administration a approuvé {merchant}. Votre espace commerçant est disponible." },
  },
  "merchant.application.rejected": {
    ar: { title: "رُفض طلب المتجر", body: "رُفض طلب انضمام {merchant}. السبب: {reason}." },
    en: { title: "Store application rejected", body: "The application for {merchant} was rejected. Reason: {reason}." },
    fr: { title: "Demande de commerce refusée", body: "La demande de {merchant} a été refusée. Motif : {reason}." },
  },
  "admin.topup.new": {
    ar: { title: "طلب شحن جديد", body: "طلب شحن بقيمة {amount} {currency} من {merchant} بانتظار المراجعة." },
    en: { title: "New top-up request", body: "{merchant} submitted a top-up request for {amount} {currency}." },
    fr: { title: "Nouvelle demande de recharge", body: "{merchant} a demandé une recharge de {amount} {currency}." },
  },
  "merchant.topup.submitted": {
    ar: { title: "تم استلام طلب الشحن", body: "طلب شحن {amount} {currency} لدى الإدارة قيد المراجعة." },
    en: { title: "Top-up request received", body: "Your request to top up {amount} {currency} is under review." },
    fr: { title: "Demande de recharge reçue", body: "Votre demande de recharge de {amount} {currency} est en cours de vérification." },
  },
  "merchant.topup.approved": {
    ar: { title: "تم قبول الشحن", body: "أُضيف {amount} {currency} إلى رصيد الشحن لمتجرك." },
    en: { title: "Top-up approved", body: "{amount} {currency} was added to your store’s funded balance." },
    fr: { title: "Recharge approuvée", body: "{amount} {currency} a été ajouté au solde financé de votre commerce." },
  },
  "merchant.topup.rejected": {
    ar: { title: "رُفض طلب الشحن", body: "رُفض طلب شحن {amount} {currency}. السبب: {reason}." },
    en: { title: "Top-up rejected", body: "Your {amount} {currency} top-up request was rejected. Reason: {reason}." },
    fr: { title: "Recharge refusée", body: "Votre demande de recharge de {amount} {currency} a été refusée. Motif : {reason}." },
  },
  "admin.withdrawal.new": {
    ar: { title: "طلب سحب جديد", body: "طلب {merchant} سحب {amount} {currency}، والطلب بانتظار المراجعة." },
    en: { title: "New withdrawal request", body: "{merchant} requested a withdrawal of {amount} {currency}." },
    fr: { title: "Nouvelle demande de retrait", body: "{merchant} a demandé un retrait de {amount} {currency}." },
  },
  "merchant.withdrawal.submitted": {
    ar: { title: "تم استلام طلب السحب", body: "طلب سحب {amount} {currency} لدى الإدارة قيد المراجعة." },
    en: { title: "Withdrawal request received", body: "Your {amount} {currency} withdrawal request is under review." },
    fr: { title: "Demande de retrait reçue", body: "Votre demande de retrait de {amount} {currency} est en cours de vérification." },
  },
  "merchant.withdrawal.approved": {
    ar: { title: "تمت الموافقة على السحب", body: "وافقت الإدارة على طلب سحب {amount} {currency}." },
    en: { title: "Withdrawal approved", body: "The administration approved your withdrawal of {amount} {currency}." },
    fr: { title: "Retrait approuvé", body: "L’administration a approuvé votre retrait de {amount} {currency}." },
  },
  "merchant.withdrawal.transferring": {
    ar: { title: "السحب قيد التحويل", body: "بدأت الإدارة تحويل مبلغ {amount} {currency}." },
    en: { title: "Withdrawal being transferred", body: "The administration started transferring {amount} {currency}." },
    fr: { title: "Retrait en cours de virement", body: "L’administration a commencé le virement de {amount} {currency}." },
  },
  "merchant.withdrawal.paid": {
    ar: { title: "تم تنفيذ السحب", body: "تم تحويل {amount} {currency}. المرجع: {reference}." },
    en: { title: "Withdrawal paid", body: "{amount} {currency} was transferred. Reference: {reference}." },
    fr: { title: "Retrait effectué", body: "{amount} {currency} a été transféré. Référence : {reference}." },
  },
  "merchant.withdrawal.rejected": {
    ar: { title: "رُفض طلب السحب", body: "رُفض طلب سحب {amount} {currency}. السبب: {reason}." },
    en: { title: "Withdrawal rejected", body: "Your {amount} {currency} withdrawal was rejected. Reason: {reason}." },
    fr: { title: "Retrait refusé", body: "Votre retrait de {amount} {currency} a été refusé. Motif : {reason}." },
  },
  "merchant.qr.payment.received": {
    ar: { title: "استلم متجرك دفعة", body: "استلم متجرك {amount} {currency} من {customer} عبر QR. المرجع: {reference}." },
    en: { title: "QR payment received", body: "Your store received {amount} {currency} from {customer} via QR. Reference: {reference}." },
    fr: { title: "Paiement QR reçu", body: "Votre commerce a reçu {amount} {currency} de {customer} par QR. Référence : {reference}." },
  },
  "admin.security.payment_failed": {
    ar: { title: "محاولة دفع غير ناجحة", body: "فشلت محاولة دفع من الحساب {customerId}. رمز الخطأ: {reason}." },
    en: { title: "Failed payment attempt", body: "A payment attempt by account {customerId} failed. Error: {reason}." },
    fr: { title: "Tentative de paiement échouée", body: "Une tentative du compte {customerId} a échoué. Erreur : {reason}." },
  },
  "merchant.account.suspended": {
    ar: { title: "تم تعليق المتجر", body: "علّقت الإدارة حساب متجرك. تواصل مع الإدارة لمعرفة التفاصيل." },
    en: { title: "Store suspended", body: "The administration suspended your store. Contact the administration for details." },
    fr: { title: "Commerce suspendu", body: "L’administration a suspendu votre commerce. Contactez-la pour plus d’informations." },
  },
  "merchant.account.reactivated": {
    ar: { title: "أُعيد تفعيل المتجر", body: "أعادت الإدارة تفعيل حساب متجرك." },
    en: { title: "Store reactivated", body: "The administration reactivated your store." },
    fr: { title: "Commerce réactivé", body: "L’administration a réactivé votre commerce." },
  },
  "customer.account.suspended": {
    ar: { title: "تم تعليق الحساب", body: "علّقت الإدارة حسابك. تواصل معها لمعرفة التفاصيل." },
    en: { title: "Account suspended", body: "The administration suspended your account. Contact them for details." },
    fr: { title: "Compte suspendu", body: "L’administration a suspendu votre compte. Contactez-la pour plus d’informations." },
  },
  "customer.account.reactivated": {
    ar: { title: "أُعيد تفعيل الحساب", body: "أعادت الإدارة تفعيل حسابك." },
    en: { title: "Account reactivated", body: "The administration reactivated your account." },
    fr: { title: "Compte réactivé", body: "L’administration a réactivé votre compte." },
  },
  "merchant.qr.rotated": {
    ar: { title: "تم تحديث رمز QR", body: "أصدرت الإدارة رمز QR جديداً وأبطلت الرمز السابق." },
    en: { title: "QR code updated", body: "The administration issued a new QR code and invalidated the previous one." },
    fr: { title: "Code QR renouvelé", body: "L’administration a émis un nouveau code QR et désactivé l’ancien." },
  },
  "merchant.store.change.submitted": {
    ar: { title: "تعديل المتجر قيد المراجعة", body: "أُرسلت تعديلات البيانات الحساسة لمتجرك إلى الإدارة." },
    en: { title: "Store changes under review", body: "Your sensitive store changes were sent to the administration." },
    fr: { title: "Modifications en cours de vérification", body: "Les modifications sensibles de votre commerce ont été envoyées à l’administration." },
  },
  "admin.store.change.new": {
    ar: { title: "طلب تعديل متجر", body: "طلب {merchant} الموافقة على تعديل بيانات حساسة." },
    en: { title: "Store change request", body: "{merchant} requested approval for sensitive store changes." },
    fr: { title: "Demande de modification", body: "{merchant} demande l’approbation de modifications sensibles." },
  },
  "merchant.store.change.approved": {
    ar: { title: "تمت الموافقة على تعديل المتجر", body: "وافقت الإدارة على تعديل بيانات متجرك الحساسة." },
    en: { title: "Store changes approved", body: "The administration approved your sensitive store changes." },
    fr: { title: "Modifications approuvées", body: "L’administration a approuvé les modifications sensibles de votre commerce." },
  },
  "merchant.store.change.rejected": {
    ar: { title: "رُفض تعديل المتجر", body: "رفضت الإدارة تعديل بيانات متجرك الحساسة. السبب: {reason}." },
    en: { title: "Store changes rejected", body: "The administration rejected your sensitive store changes. Reason: {reason}." },
    fr: { title: "Modifications refusées", body: "L’administration a refusé vos modifications sensibles. Motif : {reason}." },
  },
  "merchant.invoice.approved": {
    ar: { title: "تمت مراجعة فاتورة", body: "اعتمدت الإدارة الفاتورة {receiptId}. الالتزام {obligation} {currency}؛ سُوّي {settled} والمتبقي {outstanding}." },
    en: { title: "Invoice reviewed", body: "The administration approved invoice {receiptId}. Obligation: {obligation} {currency}; settled: {settled}; remaining: {outstanding}." },
    fr: { title: "Facture vérifiée", body: "L’administration a approuvé la facture {receiptId}. Obligation : {obligation} {currency} ; réglé : {settled} ; restant : {outstanding}." },
  },
  "customer.receipt.cancelled": {
    ar: { title: "تم إلغاء إرسال الفاتورة", body: "أُلغيت فاتورتك قبل مراجعتها." },
    en: { title: "Invoice submission cancelled", body: "Your invoice was cancelled before review." },
    fr: { title: "Envoi de facture annulé", body: "Votre facture a été annulée avant vérification." },
  },
  "admin.receipt.cancelled": {
    ar: { title: "أُلغي إرسال فاتورة", body: "ألغى الحساب {customerId} الفاتورة {receiptId} قبل مراجعتها." },
    en: { title: "Invoice cancelled", body: "Account {customerId} cancelled invoice {receiptId} before review." },
    fr: { title: "Facture annulée", body: "Le compte {customerId} a annulé la facture {receiptId} avant vérification." },
  },
  "customer.payment.reversed": {
    ar: { title: "تم عكس الدفع", body: "أُعيد {amount} {currency} إلى رصيدك لدى {merchant}. المرجع: {reference}." },
    en: { title: "Payment reversed", body: "{amount} {currency} was returned to your balance at {merchant}. Reference: {reference}." },
    fr: { title: "Paiement annulé", body: "{amount} {currency} a été recrédité sur votre solde chez {merchant}. Référence : {reference}." },
  },
  "merchant.payment.reversed": {
    ar: { title: "تم عكس دفعة", body: "عكست الإدارة العملية {reference} بقيمة {amount} {currency}." },
    en: { title: "Payment reversed", body: "The administration reversed payment {reference} for {amount} {currency}." },
    fr: { title: "Paiement annulé", body: "L’administration a annulé le paiement {reference} de {amount} {currency}." },
  },
};

function interpolate(message: string, data: NoteData): string {
  return message.replace(/\{([a-zA-Z0-9_]+)\}/g, (_match, key: string) => {
    const value = data[key];
    return value === null || value === undefined || value === "" ? "—" : String(value);
  });
}

export function addCashbackNotification(
  state: NotificationState,
  to: string,
  type: string,
  data: NoteData = {},
): void {
  const isSecurityAlert = type.startsWith("admin.security.");
  if (state.settings?.notificationsEnabled === false && !isSecurityAlert) return;
  const now = Date.now();
  const signature = typeof data.dedupeKey === "string" ? data.dedupeKey : "";
  state.notes ??= [];
  if (isSecurityAlert && signature) {
    const duplicate = state.notes.find((note) =>
      note.to === to &&
      note.type === type &&
      note.signature === signature &&
      now - Number(note.t ?? 0) < 5 * 60_000,
    );
    if (duplicate) {
      duplicate.t = now;
      duplicate.read = false;
      duplicate.occurrences = Number(duplicate.occurrences ?? 1) + 1;
      return;
    }
  }
  const template = templates[type] ?? {
    ar: { title: "إشعار", body: "لديك تحديث جديد في CASH BACK." },
    en: { title: "Notification", body: "You have a new CASH BACK update." },
    fr: { title: "Notification", body: "Vous avez une nouvelle mise à jour CASH BACK." },
  };
  const messages = {
    ar: { title: interpolate(template.ar.title, data), body: interpolate(template.ar.body, data) },
    en: { title: interpolate(template.en.title, data), body: interpolate(template.en.body, data) },
    fr: { title: interpolate(template.fr.title, data), body: interpolate(template.fr.body, data) },
  };
  state.notes.unshift({
    id: randomUUID(),
    to,
    type,
    title: messages.ar.title,
    text: messages.ar.body,
    messages,
    data: Object.fromEntries(Object.entries(data).filter(([key]) => key !== "dedupeKey")),
    ...(signature ? { signature } : {}),
    severity: isSecurityAlert ? "warning" : "info",
    t: now,
    read: false,
  });
  state.notes.length = Math.min(state.notes.length, 300);
}
