import { useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { FileSpreadsheet, FileText, Filter, TrendingUp } from 'lucide-react';
import { deliverFile } from '../../lib/fileDelivery';
import './cashback-reports.css';

type Lang = 'ar' | 'en' | 'fr';
type Row = Record<string, any>;
type ReportKind = 'invoice' | 'reward' | 'qr' | 'commission' | 'topup' | 'withdrawal' | 'customer';
type Period = 'daily' | 'monthly';
type Event = {
  id: string;
  kind: ReportKind;
  at: number;
  merchantId: string;
  customerId: string;
  country: string;
  city: string;
  currency: 'DZD' | 'LYD';
  amount: number;
  status: string;
  reference: string;
};
type Props = { state: Row; merchants: Row[]; claims: Row[]; lang: Lang };

const words: Record<Lang, Record<string, string>> = {
  ar: {
    title: 'التقارير', description: 'تقارير يومية وشهرية من العمليات المسجلة في قاعدة البيانات.',
    daily: 'التقرير اليومي', monthly: 'التقرير الشهري', date: 'التاريخ', month: 'الشهر',
    country: 'الدولة', allCountries: 'كل الدول', city: 'المدينة', allCities: 'كل المدن',
    merchant: 'التاجر', allMerchants: 'كل التجار', customer: 'الزبون', allCustomers: 'كل الزبائن',
    operation: 'نوع العملية', allOperations: 'كل العمليات',
    invoice: 'الفواتير', reward: 'مكافآت ممنوحة', qr: 'مدفوعات QR',
    commission: 'عمولات التطبيق', topup: 'طلبات الشحن', withdrawal: 'طلبات السحب',
    customerNew: 'زبائن جدد', salesToday: 'المبيعات المقبولة', invoicesRecorded: 'الفواتير المسجلة',
    accepted: 'الفواتير المقبولة', rejected: 'الفواتير المرفوضة', rewardsGranted: 'المكافآت الممنوحة',
    rewardsUsed: 'المكافآت المستعملة', qrAmount: 'إجمالي مدفوعات QR', qrCount: 'عمليات QR',
    appCommission: 'عمولات التطبيق', topups: 'عمليات الشحن', withdrawals: 'عمليات السحب',
    monthlySales: 'إجمالي المبيعات', profit: 'إجمالي عمولات التطبيق', totalRewards: 'مكافآت الزبائن',
    totalPayments: 'المدفوعات المكتملة', bestMerchants: 'أفضل التجار حسب المبيعات',
    mostUsed: 'أكثر المحلات استخداماً عبر QR', newCustomers: 'الزبائن الجدد',
    operationTrend: 'تطور العمليات المالية', trendHint: 'عدد العمليات لكل شهر خلال آخر 12 شهراً، دون دمج العملات.',
    events: 'تفاصيل العمليات', eventDate: 'التاريخ والوقت', type: 'النوع', status: 'الحالة',
    reference: 'المرجع', amount: 'المبلغ', noRows: 'لا توجد عمليات مطابقة للفلاتر.',
    noRanking: 'لا توجد بيانات خلال الفترة المحددة.', downloadPdf: 'تصدير PDF', downloadExcel: 'تصدير Excel',
    preparing: 'جارٍ تجهيز الملف…', exportComplete: 'تم تجهيز الملف للمشاركة أو التنزيل.', exportFailed: 'تعذر إنشاء الملف. حاول مجدداً.',
    invoiceAmount: 'قيمة الفواتير', topupAmount: 'قيمة الشحن', withdrawalAmount: 'قيمة السحب',
    registered: 'مسجل', pending: 'قيد المراجعة', approved: 'مقبول', rejectedStatus: 'مرفوض',
    completed: 'مكتمل', reversed: 'معكوس', due: 'مستحق', settled: 'مسدد', active: 'نشط',
    allStatuses: 'كل الحالات', filters: 'تصفية التقارير', merchantName: 'اسم التاجر',
    reportPeriod: 'الفترة', selectedFilters: 'الفلاتر المطبقة', page: 'صفحة', previous: 'السابق',
    next: 'التالي', of: 'من', rows: 'عملية', reportGenerated: 'تقرير CASH BACK',
    periodLabel: 'نطاق التقرير', merchantCount: 'عدد التجار', invoiceCount: 'عدد الفواتير',
    customerCount: 'عدد الزبائن', countryCount: 'الدولة', currencyNote: 'المبالغ معروضة منفصلة حسب العملة؛ لم يتم جمع دج ود.ل.',
    noCreationDate: 'تُحتسب الحسابات الجديدة التي لها تاريخ إنشاء محفوظ فقط.',
  },
  en: {
    title: 'Reports', description: 'Daily and monthly reports from recorded database activity.',
    daily: 'Daily report', monthly: 'Monthly report', date: 'Date', month: 'Month',
    country: 'Country', allCountries: 'All countries', city: 'City', allCities: 'All cities',
    merchant: 'Merchant', allMerchants: 'All merchants', customer: 'Customer', allCustomers: 'All customers',
    operation: 'Operation type', allOperations: 'All operations',
    invoice: 'Invoices', reward: 'Rewards granted', qr: 'QR payments',
    commission: 'Platform commissions', topup: 'Top-up requests', withdrawal: 'Withdrawal requests',
    customerNew: 'New customers', salesToday: 'Approved sales', invoicesRecorded: 'Invoices recorded',
    accepted: 'Approved invoices', rejected: 'Rejected invoices', rewardsGranted: 'Rewards granted',
    rewardsUsed: 'Rewards redeemed', qrAmount: 'QR payment total', qrCount: 'QR transactions',
    appCommission: 'Platform commissions', topups: 'Top-up activity', withdrawals: 'Withdrawal activity',
    monthlySales: 'Total sales', profit: 'Total platform commission', totalRewards: 'Customer rewards',
    totalPayments: 'Completed payments', bestMerchants: 'Top merchants by sales',
    mostUsed: 'Most used shops by QR payments', newCustomers: 'New customers',
    operationTrend: 'Financial activity trend', trendHint: 'Operation counts by month for the last 12 months; currencies are not combined.',
    events: 'Operation details', eventDate: 'Date and time', type: 'Type', status: 'Status',
    reference: 'Reference', amount: 'Amount', noRows: 'No operations match these filters.',
    noRanking: 'No data in the selected period.', downloadPdf: 'Export PDF', downloadExcel: 'Export Excel',
    preparing: 'Preparing file…', exportComplete: 'File shared or downloaded.', exportFailed: 'Could not create the file. Try again.',
    invoiceAmount: 'Invoice value', topupAmount: 'Top-up value', withdrawalAmount: 'Withdrawal value',
    registered: 'Recorded', pending: 'Under review', approved: 'Approved', rejectedStatus: 'Rejected',
    completed: 'Completed', reversed: 'Reversed', due: 'Due', settled: 'Settled', active: 'Active',
    allStatuses: 'All statuses', filters: 'Report filters', merchantName: 'Merchant name',
    reportPeriod: 'Report period', selectedFilters: 'Applied filters', page: 'Page', previous: 'Previous',
    next: 'Next', of: 'of', rows: 'operations', reportGenerated: 'CASH BACK report',
    periodLabel: 'Report range', merchantCount: 'Merchants', invoiceCount: 'Invoices',
    customerCount: 'Customers', countryCount: 'Country', currencyNote: 'Amounts remain separate by currency; DZD and LYD are never added together.',
    noCreationDate: 'Only accounts with a saved registration date are counted as new.',
  },
  fr: {
    title: 'Rapports', description: 'Rapports quotidiens et mensuels à partir des opérations enregistrées.',
    daily: 'Rapport quotidien', monthly: 'Rapport mensuel', date: 'Date', month: 'Mois',
    country: 'Pays', allCountries: 'Tous les pays', city: 'Ville', allCities: 'Toutes les villes',
    merchant: 'Commerce', allMerchants: 'Tous les commerces', customer: 'Client', allCustomers: 'Tous les clients',
    operation: 'Type d’opération', allOperations: 'Toutes les opérations',
    invoice: 'Factures', reward: 'Récompenses accordées', qr: 'Paiements QR',
    commission: 'Commissions plateforme', topup: 'Demandes de recharge', withdrawal: 'Demandes de retrait',
    customerNew: 'Nouveaux clients', salesToday: 'Ventes approuvées', invoicesRecorded: 'Factures enregistrées',
    accepted: 'Factures approuvées', rejected: 'Factures refusées', rewardsGranted: 'Récompenses accordées',
    rewardsUsed: 'Récompenses utilisées', qrAmount: 'Total des paiements QR', qrCount: 'Transactions QR',
    appCommission: 'Commissions plateforme', topups: 'Recharges', withdrawals: 'Retraits',
    monthlySales: 'Ventes totales', profit: 'Commissions plateforme totales', totalRewards: 'Récompenses clients',
    totalPayments: 'Paiements terminés', bestMerchants: 'Meilleurs commerces par ventes',
    mostUsed: 'Commerces les plus utilisés par QR', newCustomers: 'Nouveaux clients',
    operationTrend: 'Évolution de l’activité financière', trendHint: 'Nombre d’opérations par mois sur les 12 derniers mois ; devises non additionnées.',
    events: 'Détail des opérations', eventDate: 'Date et heure', type: 'Type', status: 'Statut',
    reference: 'Référence', amount: 'Montant', noRows: 'Aucune opération ne correspond aux filtres.',
    noRanking: 'Aucune donnée pour la période choisie.', downloadPdf: 'Exporter PDF', downloadExcel: 'Exporter Excel',
    preparing: 'Préparation du fichier…', exportComplete: 'Fichier partagé ou téléchargé.', exportFailed: 'Impossible de créer le fichier. Réessayez.',
    invoiceAmount: 'Valeur des factures', topupAmount: 'Montant des recharges', withdrawalAmount: 'Montant des retraits',
    registered: 'Enregistré', pending: 'En attente', approved: 'Approuvé', rejectedStatus: 'Refusé',
    completed: 'Terminé', reversed: 'Annulé', due: 'Dû', settled: 'Réglé', active: 'Actif',
    allStatuses: 'Tous les statuts', filters: 'Filtres du rapport', merchantName: 'Nom du commerce',
    reportPeriod: 'Période du rapport', selectedFilters: 'Filtres appliqués', page: 'Page', previous: 'Précédent',
    next: 'Suivant', of: 'sur', rows: 'opérations', reportGenerated: 'Rapport CASH BACK',
    periodLabel: 'Période du rapport', merchantCount: 'Commerces', invoiceCount: 'Factures',
    customerCount: 'Clients', countryCount: 'Pays', currencyNote: 'Les montants restent séparés par devise ; DZD et LYD ne sont jamais additionnés.',
    noCreationDate: 'Seuls les comptes avec une date d’inscription enregistrée sont comptés.',
  },
};

const operationKinds: ReportKind[] = ['invoice', 'reward', 'qr', 'commission', 'topup', 'withdrawal', 'customer'];
const chartColors = {
  invoices: '#1F74AD', qrPayments: '#E98E2E', topups: '#9267C6', withdrawals: '#979797',
  rewards: '#44986D', commissions: '#61A9BD', customers: '#DD83C9',
};

function list(value: unknown): Row[] { return Array.isArray(value) ? value as Row[] : []; }
function text(value: unknown, fallback = '—'): string {
  if (value === null || value === undefined || value === '') return fallback;
  return String(value);
}
function amount(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}
function timestamp(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const numeric = Number(value);
    if (Number.isFinite(numeric) && numeric > 0) return numeric;
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}
function currencyFor(country: unknown): 'DZD' | 'LYD' {
  const normalized = String(country ?? '').toLowerCase();
  return normalized.includes('lib') || normalized === 'lyd' ? 'LYD' : 'DZD';
}
function localDateInput(date = new Date()): string {
  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return offsetDate.toISOString().slice(0, 10);
}
function localMonthInput(date = new Date()): string { return localDateInput(date).slice(0, 7); }
function dateStart(value: string): number { return new Date(`${value}T00:00:00`).getTime(); }
function monthStart(value: string): number { return new Date(`${value}-01T00:00:00`).getTime(); }
function inRange(at: number, start: number, endExclusive: number): boolean {
  return at >= start && at < endExclusive;
}

export function ReportsSection({ state, merchants, claims, lang }: Props) {
  const tr = words[lang];
  const locale = lang === 'ar' ? 'ar-DZ' : lang === 'fr' ? 'fr-FR' : 'en';
  const [period, setPeriod] = useState<Period>('daily');
  const [selectedDate, setSelectedDate] = useState(() => localDateInput());
  const [selectedMonth, setSelectedMonth] = useState(() => localMonthInput());
  const [countryFilter, setCountryFilter] = useState('all');
  const [cityFilter, setCityFilter] = useState('all');
  const [merchantFilter, setMerchantFilter] = useState('all');
  const [customerFilter, setCustomerFilter] = useState('all');
  const [kindFilter, setKindFilter] = useState<'all' | ReportKind>('all');
  const [page, setPage] = useState(0);
  const [exporting, setExporting] = useState<'pdf' | 'excel' | ''>('');
  const [exportMessage, setExportMessage] = useState('');
  const pdfReportRef = useRef<HTMLDivElement>(null);
  const pageSize = 50;

  const customers = useMemo(() => list(state.customers), [state.customers]);
  const merchantById = useMemo(() => new Map(merchants.map(merchant => [String(merchant.id), merchant])), [merchants]);
  const customerById = useMemo(() => new Map(customers.map(customer => [String(customer.id), customer])), [customers]);
  const events = useMemo<Event[]>(() => {
    const result: Event[] = [];
    const add = (event: Event) => { if (event.at > 0) result.push(event); };
    claims.forEach((claim, index) => {
      const merchantId = text(claim.mid, '');
      const customerId = text(claim.cid, '');
      const merchant = merchantById.get(merchantId);
      add({
        id: `invoice-${text(claim.id, String(index))}`,
        kind: 'invoice',
        at: timestamp(claim.created ?? claim.createdAt ?? claim.submittedAt ?? claim.date),
        merchantId,
        customerId,
        country: text(merchant?.country ?? claim.country, ''),
        city: text(merchant?.city ?? claim.city, ''),
        currency: currencyFor(merchant?.country ?? claim.country),
        amount: amount(claim.amount),
        status: text(claim.status, 'pending').toLowerCase(),
        reference: text(claim.invoiceNumber ?? claim.id),
      });
    });
    list(state.merchantCommissionLedger).forEach((entry, index) => {
      const merchantId = text(entry.merchantId ?? entry.mid, '');
      const customerId = text(entry.customerId ?? entry.cid, '');
      const merchant = merchantById.get(merchantId);
      const at = timestamp(entry.createdAt ?? entry.created ?? entry.date);
      const common = {
        at, merchantId, customerId,
        country: text(merchant?.country ?? entry.country, ''),
        city: text(merchant?.city ?? entry.city, ''),
        currency: (entry.currency === 'LYD' || entry.currency === 'DZD' ? entry.currency : currencyFor(merchant?.country ?? entry.country)) as 'DZD' | 'LYD',
        reference: text(entry.invoiceNumber ?? entry.receiptId ?? entry.id),
      };
      if (amount(entry.cashbackAmount) > 0) add({
        ...common, id: `reward-${text(entry.id, String(index))}`, kind: 'reward',
        amount: amount(entry.cashbackAmount), status: 'approved',
      });
      if (amount(entry.platformCommissionAmount) > 0) add({
        ...common, id: `commission-${text(entry.id, String(index))}`, kind: 'commission',
        amount: amount(entry.platformCommissionAmount), status: text(entry.status, 'due').toLowerCase(),
      });
    });
    list(state.cbpays).forEach((payment, index) => {
      if (String(payment.method ?? '').toLowerCase() !== 'qr') return;
      const merchantId = text(payment.mid ?? payment.merchantId, '');
      const customerId = text(payment.cid ?? payment.customerId, '');
      const merchant = merchantById.get(merchantId);
      add({
        id: `qr-${text(payment.id, String(index))}`, kind: 'qr',
        at: timestamp(payment.at ?? payment.createdAt ?? payment.date),
        merchantId, customerId, country: text(merchant?.country ?? payment.country, ''),
        city: text(merchant?.city ?? payment.city, ''),
        currency: currencyFor(merchant?.country ?? payment.country), amount: amount(payment.amount),
        status: text(payment.status, 'pending').toLowerCase(),
        reference: text(payment.reference ?? payment.id),
      });
    });
    list(state.merchantTopups).forEach((request, index) => {
      const merchantId = text(request.merchantId ?? request.mid, '');
      const merchant = merchantById.get(merchantId);
      add({
        id: `topup-${text(request.id, String(index))}`, kind: 'topup',
        at: timestamp(request.createdAt ?? request.created ?? request.date),
        merchantId, customerId: '', country: text(merchant?.country ?? request.country, ''),
        city: text(merchant?.city ?? request.city, ''),
        currency: currencyFor(merchant?.country ?? request.country), amount: amount(request.amount),
        status: text(request.status, 'pending').toLowerCase(), reference: text(request.id),
      });
    });
    list(state.merchantWithdrawals).forEach((request, index) => {
      const merchantId = text(request.merchantId ?? request.mid, '');
      const merchant = merchantById.get(merchantId);
      add({
        id: `withdrawal-${text(request.id, String(index))}`, kind: 'withdrawal',
        at: timestamp(request.createdAt ?? request.created ?? request.date),
        merchantId, customerId: '', country: text(merchant?.country ?? request.country, ''),
        city: text(merchant?.city ?? request.city, ''),
        currency: currencyFor(merchant?.country ?? request.country), amount: amount(request.amount),
        status: text(request.status, 'pending').toLowerCase(), reference: text(request.id),
      });
    });
    customers.forEach((customer, index) => {
      add({
        id: `customer-${text(customer.id, String(index))}`, kind: 'customer',
        at: timestamp(customer.createdAt ?? customer.created ?? customer.registeredAt),
        merchantId: '', customerId: text(customer.id, ''),
        country: text(customer.country, ''), city: text(customer.city, ''),
        currency: currencyFor(customer.country), amount: 0, status: 'active',
        reference: text(customer.email ?? customer.phone),
      });
    });
    return result;
  }, [claims, customers, merchantById, state.cbpays, state.merchantCommissionLedger, state.merchantTopups, state.merchantWithdrawals]);

  const periodRange = useMemo(() => {
    if (period === 'daily') {
      const start = dateStart(selectedDate);
      return { start, end: start + 24 * 60 * 60 * 1000 };
    }
    const start = monthStart(selectedMonth);
    const endDate = new Date(start);
    endDate.setMonth(endDate.getMonth() + 1);
    return { start, end: endDate.getTime() };
  }, [period, selectedDate, selectedMonth]);

  const cities = useMemo(() => [...new Set(merchants
    .filter(merchant => countryFilter === 'all' || currencyFor(merchant.country) === countryFilter)
    .map(merchant => text(merchant.city, ''))
    .filter(Boolean))].sort((a, b) => a.localeCompare(b, locale)), [countryFilter, locale, merchants]);

  const matchingMeta = (event: Event) => {
    const scopeMatch = (record: Event) => {
      const merchant = merchantById.get(record.merchantId);
      return (countryFilter === 'all' || (Boolean(record.country) && record.currency === countryFilter))
        && (cityFilter === 'all' || record.city === cityFilter)
        && (merchantFilter === 'all' || record.merchantId === merchantFilter)
        && (!merchant || countryFilter === 'all' || currencyFor(merchant.country) === countryFilter);
    };
    if (event.kind === 'customer') {
      const hasLocationFilter = countryFilter !== 'all' || cityFilter !== 'all' || merchantFilter !== 'all';
      const profileMatches = scopeMatch(event);
      const activityMatches = events.some(record =>
        record.kind !== 'customer' && record.customerId === event.customerId && scopeMatch(record));
      return (customerFilter === 'all' || event.customerId === customerFilter)
        && (kindFilter === 'all' || kindFilter === 'customer')
        && (!hasLocationFilter || profileMatches || activityMatches);
    }
    return scopeMatch(event)
      && (customerFilter === 'all' || event.customerId === customerFilter)
      && (kindFilter === 'all' || event.kind === kindFilter);
  };

  const filteredEvents = useMemo(() => events
    .filter(event => inRange(event.at, periodRange.start, periodRange.end) && matchingMeta(event))
    .sort((a, b) => b.at - a.at), [events, periodRange, countryFilter, cityFilter, merchantFilter, customerFilter, kindFilter, merchantById]);
  const invoiceEvents = filteredEvents.filter(event => event.kind === 'invoice');
  const approvedInvoices = invoiceEvents.filter(event => ['approved', 'accepted'].includes(event.status));
  const rejectedInvoices = invoiceEvents.filter(event => event.status === 'rejected');
  const qrEvents = filteredEvents.filter(event => event.kind === 'qr' && ['done', 'approved', 'completed', 'paid'].includes(event.status));
  const rewardEvents = filteredEvents.filter(event => event.kind === 'reward');
  const commissionEvents = filteredEvents.filter(event => event.kind === 'commission');
  const topupEvents = filteredEvents.filter(event => event.kind === 'topup');
  const withdrawalEvents = filteredEvents.filter(event => event.kind === 'withdrawal');
  const newCustomerEvents = filteredEvents.filter(event => event.kind === 'customer');

  const money = (value: number, currency: 'DZD' | 'LYD') => new Intl.NumberFormat(locale, {
    style: 'currency', currency, maximumFractionDigits: 2,
  }).format(value);
  const amountByCurrency = (records: Event[]) => (
    <span className="cr-dual-amount">
      {countryFilter !== 'LYD' && <b>{money(records.filter(row => row.currency === 'DZD').reduce((sum, row) => sum + row.amount, 0), 'DZD')}</b>}
      {countryFilter !== 'DZD' && <b>{money(records.filter(row => row.currency === 'LYD').reduce((sum, row) => sum + row.amount, 0), 'LYD')}</b>}
    </span>
  );
  const countByCurrency = (records: Event[]) => (
    <span className="cr-dual-amount">
      {countryFilter !== 'LYD' && <b>DZD · {records.filter(row => row.currency === 'DZD').length}</b>}
      {countryFilter !== 'DZD' && <b>LYD · {records.filter(row => row.currency === 'LYD').length}</b>}
    </span>
  );
  const sumByCurrency = (records: Event[], currency: 'DZD' | 'LYD') =>
    records.filter(row => row.currency === currency).reduce((sum, row) => sum + row.amount, 0);
  const formatDate = (at: number) => new Intl.DateTimeFormat(locale, {
    dateStyle: 'short', timeStyle: 'short',
  }).format(new Date(at));
  const periodLabel = period === 'daily' ? selectedDate : selectedMonth;
  const kindLabel = (kind: ReportKind) => tr[kind === 'customer' ? 'customerNew' : kind];
  const statusLabel = (value: string) => {
    const map: Record<string, string> = {
      pending: tr.pending, approved: tr.approved, accepted: tr.approved,
      rejected: tr.rejectedStatus, done: tr.completed, completed: tr.completed,
      paid: tr.completed, reversed: tr.reversed, due: tr.due, settled: tr.settled,
      active: tr.active,
    };
    return map[value] ?? value;
  };
  const eventMerchantName = (event: Event) => text(merchantById.get(event.merchantId)?.name, '—');
  const eventCustomerName = (event: Event) => text(customerById.get(event.customerId)?.name, '—');

  const filteredMerchants = useMemo(() => merchants.filter(merchant =>
    (countryFilter === 'all' || currencyFor(merchant.country) === countryFilter)
    && (cityFilter === 'all' || text(merchant.city, '') === cityFilter)
    && (merchantFilter === 'all' || String(merchant.id) === merchantFilter)), [merchants, countryFilter, cityFilter, merchantFilter]);
  const bestMerchants = useMemo(() => (['DZD', 'LYD'] as const).flatMap(currency => filteredMerchants
    .filter(merchant => currencyFor(merchant.country) === currency)
    .map(merchant => {
      const rows = approvedInvoices.filter(event => event.merchantId === String(merchant.id));
      return {
        id: String(merchant.id), name: text(merchant.name), currency,
        sales: rows.reduce((sum, event) => sum + event.amount, 0), count: rows.length,
      };
    })
    .filter(row => row.count > 0)
    .sort((a, b) => b.sales - a.sales)
    .slice(0, 5)), [filteredMerchants, approvedInvoices]);
  const mostUsedShops = useMemo(() => filteredMerchants.map(merchant => {
    const rows = qrEvents.filter(event => event.merchantId === String(merchant.id));
    return {
      id: String(merchant.id), name: text(merchant.name), currency: currencyFor(merchant.country),
      count: rows.length, amount: rows.reduce((sum, event) => sum + event.amount, 0),
    };
  }).filter(row => row.count > 0).sort((a, b) => b.count - a.count).slice(0, 5), [filteredMerchants, qrEvents]);

  const trendData = useMemo(() => {
    const endMonth = period === 'monthly' ? monthStart(selectedMonth) : monthStart(selectedDate.slice(0, 7));
    const end = new Date(endMonth);
    end.setMonth(end.getMonth() + 1);
    const first = new Date(endMonth);
    first.setMonth(first.getMonth() - 11);
    const trendEvents = events.filter(event => event.at >= first.getTime() && event.at < end.getTime() && matchingMeta(event));
    return Array.from({ length: 12 }, (_, index) => {
      const current = new Date(first);
      current.setMonth(first.getMonth() + index);
      const next = new Date(current);
      next.setMonth(next.getMonth() + 1);
      const bucket = trendEvents.filter(event => inRange(event.at, current.getTime(), next.getTime()));
      return {
        month: new Intl.DateTimeFormat(locale, { month: 'short' }).format(current),
        invoices: bucket.filter(event => event.kind === 'invoice').length,
        qrPayments: bucket.filter(event => event.kind === 'qr' && ['done', 'approved', 'completed', 'paid'].includes(event.status)).length,
        topups: bucket.filter(event => event.kind === 'topup').length,
        withdrawals: bucket.filter(event => event.kind === 'withdrawal').length,
        rewards: bucket.filter(event => event.kind === 'reward').length,
        commissions: bucket.filter(event => event.kind === 'commission').length,
        customers: bucket.filter(event => event.kind === 'customer').length,
      };
    });
  }, [events, period, selectedMonth, selectedDate, locale, countryFilter, cityFilter, merchantFilter, customerFilter, kindFilter, merchantById]);

  const pageCount = Math.max(1, Math.ceil(filteredEvents.length / pageSize));
  const visibleEvents = filteredEvents.slice(page * pageSize, (page + 1) * pageSize);
  const resetPage = () => setPage(0);
  const stat = (label: string, value: ReactNode, tint = '') => (
    <article className={`cr-stat ${tint}`} key={label}><small>{label}</small><strong>{value}</strong></article>
  );
  const reportRows = (all = false) => (all ? filteredEvents : visibleEvents).map(event => (
    <tr key={event.id}>
      <td>{formatDate(event.at)}</td>
      <td>{kindLabel(event.kind)}</td>
      <td>{eventMerchantName(event)}</td>
      <td>{eventCustomerName(event)}</td>
      <td>{event.reference}</td>
      <td>{event.amount ? money(event.amount, event.currency) : '—'}</td>
      <td><span className={`cr-status is-${event.status}`}>{statusLabel(event.status)}</span></td>
    </tr>
  ));

  const fileBase = `cash-back-${periodLabel}`;
  const exportExcel = async () => {
    setExporting('excel');
    setExportMessage('');
    try {
      const XLSX = await import('xlsx');
      const workbook = XLSX.utils.book_new();
      const summary: (string | number)[][] = [
        [tr.reportGenerated],
        [tr.reportPeriod, periodLabel],
        [tr.country, countryFilter === 'all' ? tr.allCountries : countryFilter],
        [tr.city, cityFilter === 'all' ? tr.allCities : cityFilter],
        [tr.merchant, merchantFilter === 'all' ? tr.allMerchants : text(merchantById.get(merchantFilter)?.name)],
        [tr.customer, customerFilter === 'all' ? tr.allCustomers : text(customerById.get(customerFilter)?.name)],
        [tr.operation, kindFilter === 'all' ? tr.allOperations : kindLabel(kindFilter)],
        [],
        [tr.invoicesRecorded, invoiceEvents.length],
        [tr.accepted, approvedInvoices.length],
        [tr.rejected, rejectedInvoices.length],
        [monthly ? tr.monthlySales : tr.salesToday, sumByCurrency(approvedInvoices, 'DZD'), 'DZD'],
        [monthly ? tr.monthlySales : tr.salesToday, sumByCurrency(approvedInvoices, 'LYD'), 'LYD'],
        [tr.rewardsGranted, sumByCurrency(rewardEvents, 'DZD'), 'DZD'],
        [tr.rewardsGranted, sumByCurrency(rewardEvents, 'LYD'), 'LYD'],
        [monthly ? tr.totalPayments : tr.rewardsUsed, sumByCurrency(qrEvents, 'DZD'), 'DZD'],
        [monthly ? tr.totalPayments : tr.rewardsUsed, sumByCurrency(qrEvents, 'LYD'), 'LYD'],
        [tr.qrCount, qrEvents.length],
        [monthly ? tr.profit : tr.appCommission, sumByCurrency(commissionEvents, 'DZD'), 'DZD'],
        [monthly ? tr.profit : tr.appCommission, sumByCurrency(commissionEvents, 'LYD'), 'LYD'],
        [tr.topups, topupEvents.length],
        [tr.topupAmount, sumByCurrency(topupEvents, 'DZD'), 'DZD'],
        [tr.topupAmount, sumByCurrency(topupEvents, 'LYD'), 'LYD'],
        [tr.withdrawals, withdrawalEvents.length],
        [tr.withdrawalAmount, sumByCurrency(withdrawalEvents, 'DZD'), 'DZD'],
        [tr.withdrawalAmount, sumByCurrency(withdrawalEvents, 'LYD'), 'LYD'],
        [tr.newCustomers, newCustomerEvents.length],
        [tr.currencyNote],
      ];
      const summarySheet = XLSX.utils.aoa_to_sheet(summary);
      summarySheet['!cols'] = [{ wch: 32 }, { wch: 38 }, { wch: 12 }];
      XLSX.utils.book_append_sheet(workbook, summarySheet, lang === 'ar' ? 'الملخص' : lang === 'fr' ? 'Résumé' : 'Summary');
      const dataRows = filteredEvents.map(event => ({
        [tr.eventDate]: formatDate(event.at),
        [tr.type]: kindLabel(event.kind),
        [tr.merchant]: eventMerchantName(event),
        [tr.customer]: eventCustomerName(event),
        [tr.country]: event.country,
        [tr.city]: event.city,
        [tr.reference]: event.reference,
        [tr.amount]: event.amount,
        Currency: event.currency,
        [tr.status]: statusLabel(event.status),
      }));
      const eventsSheet = XLSX.utils.json_to_sheet(dataRows);
      XLSX.utils.book_append_sheet(workbook, eventsSheet, lang === 'ar' ? 'العمليات' : lang === 'fr' ? 'Opérations' : 'Operations');
      const trendSheet = XLSX.utils.json_to_sheet(trendData.map(row => ({
        [lang === 'ar' ? 'الشهر' : lang === 'fr' ? 'Mois' : 'Month']: row.month,
        [tr.invoice]: row.invoices,
        [tr.qr]: row.qrPayments,
        [tr.topup]: row.topups,
        [tr.withdrawal]: row.withdrawals,
        [tr.reward]: row.rewards,
        [tr.commission]: row.commissions,
        [tr.customerNew]: row.customers,
      })));
      XLSX.utils.book_append_sheet(workbook, trendSheet, lang === 'ar' ? 'التطور الشهري' : lang === 'fr' ? 'Tendance mensuelle' : 'Monthly trend');
      if (monthly) {
        const merchantSheet = XLSX.utils.json_to_sheet(bestMerchants.map(merchant => ({
          [tr.merchant]: merchant.name,
          [tr.country]: merchant.currency,
          [tr.invoiceCount]: merchant.count,
          [tr.amount]: merchant.sales,
        })));
        XLSX.utils.book_append_sheet(workbook, merchantSheet, lang === 'ar' ? 'أفضل التجار' : lang === 'fr' ? 'Meilleurs commerces' : 'Top merchants');
        const usageSheet = XLSX.utils.json_to_sheet(mostUsedShops.map(merchant => ({
          [tr.merchant]: merchant.name,
          [tr.country]: merchant.currency,
          [tr.qrCount]: merchant.count,
          [tr.amount]: merchant.amount,
        })));
        XLSX.utils.book_append_sheet(workbook, usageSheet, lang === 'ar' ? 'استخدام QR' : lang === 'fr' ? 'Usage QR' : 'QR usage');
      }
      const workbookBytes = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
      const workbookBlob = new Blob([workbookBytes], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const delivery = await deliverFile(workbookBlob, `${fileBase}.xlsx`);
      if (delivery !== 'cancelled') setExportMessage(tr.exportComplete);
    } catch {
      setExportMessage(tr.exportFailed);
    } finally {
      setExporting('');
    }
  };

  const exportPdf = async () => {
    if (!pdfReportRef.current) return;
    setExporting('pdf');
    setExportMessage('');
    try {
      const { jsPDF } = await import('jspdf');
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      await new Promise<void>((resolve, reject) => {
        let settled = false;
        const timeout = window.setTimeout(() => {
          if (settled) return;
          settled = true;
          reject(new Error('PDF generation timed out'));
        }, 45_000);
        try {
          pdf.html(pdfReportRef.current as HTMLElement, {
            x: 8, y: 8, width: 281, windowWidth: 1200, autoPaging: 'text',
            html2canvas: { scale: 0.7, useCORS: true, backgroundColor: '#ffffff' },
            callback: document => {
              if (settled) return;
              settled = true;
              window.clearTimeout(timeout);
              void deliverFile(document.output('blob'), `${fileBase}.pdf`)
                .then(delivery => {
                  if (delivery !== 'cancelled') setExportMessage(tr.exportComplete);
                  resolve();
                })
                .catch(reject);
            },
          });
        } catch (error) {
          window.clearTimeout(timeout);
          settled = true;
          reject(error);
        }
      });
    } catch {
      setExportMessage(tr.exportFailed);
    } finally {
      setExporting('');
    }
  };

  const monthly = period === 'monthly';
  const localeCountry = (value: string) => value === 'Algeria'
    ? (lang === 'ar' ? 'الجزائر' : lang === 'fr' ? 'Algérie' : 'Algeria')
    : value === 'Libya' ? (lang === 'ar' ? 'ليبيا' : lang === 'fr' ? 'Libye' : 'Libya') : value;
  const reportSummary = (
    <>
      <h2>{tr.reportGenerated} · {monthly ? tr.monthly : tr.daily}</h2>
      <p>{tr.reportPeriod}: {periodLabel} · {tr.country}: {countryFilter === 'all' ? tr.allCountries : localeCountry(countryFilter)} · {tr.city}: {cityFilter === 'all' ? tr.allCities : cityFilter}</p>
      <p>{tr.merchant}: {merchantFilter === 'all' ? tr.allMerchants : text(merchantById.get(merchantFilter)?.name)} · {tr.customer}: {customerFilter === 'all' ? tr.allCustomers : text(customerById.get(customerFilter)?.name)} · {tr.operation}: {kindFilter === 'all' ? tr.allOperations : kindLabel(kindFilter)}</p>
    </>
  );

  return (
    <section className="cr-reports" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <header className="cr-heading">
        <div><span className="ac-eyebrow">{tr.selectedFilters}</span><h2>{tr.title}</h2><p>{tr.description}</p></div>
        <div className="cr-export-actions">
          <button type="button" className="ac-button" onClick={() => void exportPdf()} disabled={!!exporting} data-testid="button-report-pdf">
            <FileText size={15}/>{exporting === 'pdf' ? tr.preparing : tr.downloadPdf}
          </button>
          <button type="button" className="ac-button ac-button-primary" onClick={() => void exportExcel()} disabled={!!exporting} data-testid="button-report-excel">
            <FileSpreadsheet size={15}/>{exporting === 'excel' ? tr.preparing : tr.downloadExcel}
          </button>
        </div>
      </header>

      {exportMessage && <div className={`cr-export-message ${exportMessage === tr.exportFailed ? 'is-error' : ''}`} role="status">{exportMessage}</div>}

      <section className="ac-panel cr-filter-panel">
        <header className="ac-inline-title"><div><h3><Filter size={15}/> {tr.filters}</h3></div><span className="ac-counter">{filteredEvents.length}</span></header>
        <div className="cr-period-switch">
          <button type="button" className={!monthly ? 'is-active' : ''} onClick={() => { setPeriod('daily'); resetPage(); }} data-testid="button-report-daily">{tr.daily}</button>
          <button type="button" className={monthly ? 'is-active' : ''} onClick={() => { setPeriod('monthly'); resetPage(); }} data-testid="button-report-monthly">{tr.monthly}</button>
          <label>{monthly ? tr.month : tr.date}
            {monthly
              ? <input className="ac-input" type="month" value={selectedMonth} onChange={event => { if (event.target.value) { setSelectedMonth(event.target.value); resetPage(); } }} data-testid="input-report-month"/>
              : <input className="ac-input" type="date" value={selectedDate} onChange={event => { if (event.target.value) { setSelectedDate(event.target.value); resetPage(); } }} data-testid="input-report-date"/>}
          </label>
        </div>
        <div className="cr-filter-grid">
                <label>{tr.country}<select className="ac-input" value={countryFilter} onChange={event => { setCountryFilter(event.target.value); setCityFilter('all'); setMerchantFilter('all'); resetPage(); }} data-testid="select-report-country">
            <option value="all">{tr.allCountries}</option><option value="DZD">DZD · {localeCountry('Algeria')}</option><option value="LYD">LYD · {localeCountry('Libya')}</option>
          </select></label>
          <label>{tr.city}<select className="ac-input" value={cityFilter} onChange={event => { setCityFilter(event.target.value); setMerchantFilter('all'); resetPage(); }} data-testid="select-report-city">
            <option value="all">{tr.allCities}</option>{cities.map(city => <option key={city} value={city}>{city}</option>)}
          </select></label>
          <label>{tr.merchant}<select className="ac-input" value={merchantFilter} onChange={event => { setMerchantFilter(event.target.value); resetPage(); }} data-testid="select-report-merchant">
            <option value="all">{tr.allMerchants}</option>{merchants.filter(merchant => (countryFilter === 'all' || currencyFor(merchant.country) === countryFilter) && (cityFilter === 'all' || text(merchant.city, '') === cityFilter)).map(merchant => <option key={String(merchant.id)} value={String(merchant.id)}>{text(merchant.name)}</option>)}
          </select></label>
          <label>{tr.customer}<select className="ac-input" value={customerFilter} onChange={event => { setCustomerFilter(event.target.value); resetPage(); }} data-testid="select-report-customer">
            <option value="all">{tr.allCustomers}</option>{customers.map(customer => <option key={String(customer.id)} value={String(customer.id)}>{text(customer.name, text(customer.phone, String(customer.id)))}</option>)}
          </select></label>
          <label>{tr.operation}<select className="ac-input" value={kindFilter} onChange={event => { setKindFilter(event.target.value as 'all' | ReportKind); resetPage(); }} data-testid="select-report-operation">
            <option value="all">{tr.allOperations}</option>{operationKinds.map(kind => <option key={kind} value={kind}>{kindLabel(kind)}</option>)}
          </select></label>
        </div>
        <p className="cr-currency-note">{tr.currencyNote}</p>
      </section>

      <section className="cr-report-content">
        <header className="cr-export-header">{reportSummary}</header>
        <div className="cr-stat-grid">
          {stat(monthly ? tr.monthlySales : tr.salesToday, amountByCurrency(approvedInvoices))}
          {stat(tr.invoicesRecorded, invoiceEvents.length)}
          {stat(tr.accepted, invoiceEvents.filter(event => ['approved', 'accepted'].includes(event.status)).length)}
          {stat(tr.rejected, rejectedInvoices.length, 'is-warn')}
          {stat(tr.rewardsGranted, amountByCurrency(rewardEvents))}
          {stat(monthly ? tr.totalPayments : tr.rewardsUsed, amountByCurrency(qrEvents))}
          {stat(tr.qrCount, countByCurrency(qrEvents))}
          {stat(monthly ? tr.profit : tr.appCommission, amountByCurrency(commissionEvents), 'is-gold')}
          {stat(tr.topups, <>{topupEvents.length}<small>{amountByCurrency(topupEvents)}</small></>)}
          {stat(tr.withdrawals, <>{withdrawalEvents.length}<small>{amountByCurrency(withdrawalEvents)}</small></>)}
          {monthly && stat(tr.newCustomers, newCustomerEvents.length)}
        </div>
        {monthly && <p className="cr-currency-note">{tr.noCreationDate}</p>}

        {monthly && (
          <>
            <div className="cr-ranking-grid">
              <section className="ac-panel">
                <header className="ac-inline-title"><div><h3>{tr.bestMerchants}</h3></div></header>
                {(['DZD', 'LYD'] as const).map(currency => {
                  const rows = bestMerchants.filter(merchant => merchant.currency === currency);
                  return rows.length ? <div className="cr-ranking-currency" key={currency}><h4>{currency}</h4>{rows.map((merchant, index) => (
                    <div className="cr-ranking-row" key={merchant.id}><i>{index + 1}</i><b>{merchant.name}</b><small>{merchant.count} · {tr.invoice}</small><strong>{money(merchant.sales, merchant.currency)}</strong></div>
                  ))}</div> : null;
                })}
                {!bestMerchants.length && <p className="cr-empty">{tr.noRanking}</p>}
              </section>
              <section className="ac-panel">
                <header className="ac-inline-title"><div><h3>{tr.mostUsed}</h3></div></header>
                {mostUsedShops.length ? mostUsedShops.map((merchant, index) => (
                  <div className="cr-ranking-row" key={merchant.id}><i>{index + 1}</i><b>{merchant.name}</b><small>{merchant.count} · {tr.qr}</small><strong>{money(merchant.amount, merchant.currency)}</strong></div>
                )) : <p className="cr-empty">{tr.noRanking}</p>}
              </section>
            </div>
            <section className="ac-panel cr-trend-panel">
              <header className="ac-inline-title"><div><h3><TrendingUp size={16}/> {tr.operationTrend}</h3><p>{tr.trendHint}</p></div></header>
              <div className="cr-trend-chart" dir="ltr">
                <ResponsiveContainer width="100%" height={290}>
                  <BarChart data={trendData} margin={{ top: 10, right: 15, left: 0, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--ac-line))"/>
                    <XAxis dataKey="month" stroke="hsl(var(--ac-muted))" tick={{ fontSize: 11 }}/>
                    <YAxis allowDecimals={false} stroke="hsl(var(--ac-muted))" tick={{ fontSize: 11 }}/>
                    <Tooltip formatter={(value: number) => value.toLocaleString(locale)} contentStyle={{ background: 'hsl(var(--ac-card))', borderColor: 'hsl(var(--ac-line))', borderRadius: 10, color: 'hsl(var(--ac-text))' }}/>
                    <Legend/>
                    {(kindFilter === 'all' || kindFilter === 'invoice') && <Bar dataKey="invoices" name={tr.invoice} fill={chartColors.invoices} radius={[4, 4, 0, 0]}/>}
                    {(kindFilter === 'all' || kindFilter === 'qr') && <Bar dataKey="qrPayments" name={tr.qr} fill={chartColors.qrPayments} radius={[4, 4, 0, 0]}/>}
                    {(kindFilter === 'all' || kindFilter === 'topup') && <Bar dataKey="topups" name={tr.topup} fill={chartColors.topups} radius={[4, 4, 0, 0]}/>}
                    {(kindFilter === 'all' || kindFilter === 'withdrawal') && <Bar dataKey="withdrawals" name={tr.withdrawal} fill={chartColors.withdrawals} radius={[4, 4, 0, 0]}/>}
                    {(kindFilter === 'all' || kindFilter === 'reward') && <Bar dataKey="rewards" name={tr.reward} fill={chartColors.rewards} radius={[4, 4, 0, 0]}/>}
                    {(kindFilter === 'all' || kindFilter === 'commission') && <Bar dataKey="commissions" name={tr.commission} fill={chartColors.commissions} radius={[4, 4, 0, 0]}/>}
                    {(kindFilter === 'all' || kindFilter === 'customer') && <Bar dataKey="customers" name={tr.customerNew} fill={chartColors.customers} radius={[4, 4, 0, 0]}/>}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>
          </>
        )}

        <section className="ac-panel cr-events-panel">
          <header className="ac-inline-title"><div><h3>{tr.events}</h3><p>{filteredEvents.length} {tr.rows}</p></div></header>
          {filteredEvents.length ? (
            <>
              <div className="ac-table-wrap cr-events-table"><table>
                <thead><tr><th>{tr.eventDate}</th><th>{tr.type}</th><th>{tr.merchant}</th><th>{tr.customer}</th><th>{tr.reference}</th><th>{tr.amount}</th><th>{tr.status}</th></tr></thead>
                <tbody>{reportRows()}</tbody>
              </table></div>
              <div className="cr-pagination" data-export-exclude="true">
                <span>{tr.page} {page + 1} {tr.of} {pageCount} · {filteredEvents.length} {tr.rows}</span>
                <div><button type="button" className="ac-button" disabled={page <= 0} onClick={() => setPage(value => Math.max(0, value - 1))}>{tr.previous}</button><button type="button" className="ac-button" disabled={page + 1 >= pageCount} onClick={() => setPage(value => Math.min(pageCount - 1, value + 1))}>{tr.next}</button></div>
              </div>
            </>
          ) : <p className="cr-empty">{tr.noRows}</p>}
        </section>
      </section>

      <div className="cr-pdf-report" ref={pdfReportRef} aria-hidden="true">
        {reportSummary}
        <p>{tr.currencyNote}</p>
        <table><thead><tr><th>{tr.type}</th><th>DZD</th><th>LYD</th><th>{tr.events}</th></tr></thead><tbody>
          <tr><td>{tr.invoicesRecorded}</td><td>{invoiceEvents.filter(row => row.currency === 'DZD').length}</td><td>{invoiceEvents.filter(row => row.currency === 'LYD').length}</td><td>{invoiceEvents.length}</td></tr>
          <tr><td>{tr.accepted}</td><td>{approvedInvoices.filter(row => row.currency === 'DZD').length}</td><td>{approvedInvoices.filter(row => row.currency === 'LYD').length}</td><td>{approvedInvoices.length}</td></tr>
          <tr><td>{tr.rejected}</td><td>{rejectedInvoices.filter(row => row.currency === 'DZD').length}</td><td>{rejectedInvoices.filter(row => row.currency === 'LYD').length}</td><td>{rejectedInvoices.length}</td></tr>
          <tr><td>{tr.monthlySales}</td><td>{money(sumByCurrency(approvedInvoices, 'DZD'), 'DZD')}</td><td>{money(sumByCurrency(approvedInvoices, 'LYD'), 'LYD')}</td><td>—</td></tr>
          <tr><td>{tr.rewardsGranted}</td><td>{money(sumByCurrency(rewardEvents, 'DZD'), 'DZD')}</td><td>{money(sumByCurrency(rewardEvents, 'LYD'), 'LYD')}</td><td>{rewardEvents.length}</td></tr>
          <tr><td>{tr.rewardsUsed}</td><td>{money(sumByCurrency(qrEvents, 'DZD'), 'DZD')}</td><td>{money(sumByCurrency(qrEvents, 'LYD'), 'LYD')}</td><td>{qrEvents.length}</td></tr>
          <tr><td>{monthly ? tr.profit : tr.appCommission}</td><td>{money(sumByCurrency(commissionEvents, 'DZD'), 'DZD')}</td><td>{money(sumByCurrency(commissionEvents, 'LYD'), 'LYD')}</td><td>{commissionEvents.length}</td></tr>
          <tr><td>{tr.topups}</td><td>{money(sumByCurrency(topupEvents, 'DZD'), 'DZD')}</td><td>{money(sumByCurrency(topupEvents, 'LYD'), 'LYD')}</td><td>{topupEvents.length}</td></tr>
          <tr><td>{tr.withdrawals}</td><td>{money(sumByCurrency(withdrawalEvents, 'DZD'), 'DZD')}</td><td>{money(sumByCurrency(withdrawalEvents, 'LYD'), 'LYD')}</td><td>{withdrawalEvents.length}</td></tr>
          {monthly && <tr><td>{tr.newCustomers}</td><td>—</td><td>—</td><td>{newCustomerEvents.length}</td></tr>}
        </tbody></table>
        {monthly && <>
          <h3>{tr.bestMerchants}</h3>
          <table><thead><tr><th>{tr.merchant}</th><th>{tr.country}</th><th>{tr.invoiceCount}</th><th>{tr.amount}</th></tr></thead><tbody>{bestMerchants.map(merchant => <tr key={merchant.id}><td>{merchant.name}</td><td>{merchant.currency}</td><td>{merchant.count}</td><td>{money(merchant.sales, merchant.currency)}</td></tr>)}</tbody></table>
          <h3>{tr.mostUsed}</h3>
          <table><thead><tr><th>{tr.merchant}</th><th>{tr.qrCount}</th><th>{tr.amount}</th></tr></thead><tbody>{mostUsedShops.map(merchant => <tr key={merchant.id}><td>{merchant.name}</td><td>{merchant.count}</td><td>{money(merchant.amount, merchant.currency)}</td></tr>)}</tbody></table>
          <h3>{tr.operationTrend}</h3>
          <table><thead><tr><th>{lang === 'ar' ? 'الشهر' : lang === 'fr' ? 'Mois' : 'Month'}</th><th>{tr.invoice}</th><th>{tr.qr}</th><th>{tr.topup}</th><th>{tr.withdrawal}</th><th>{tr.reward}</th><th>{tr.commission}</th><th>{tr.customerNew}</th></tr></thead><tbody>{trendData.map(row => <tr key={row.month}><td>{row.month}</td><td>{row.invoices}</td><td>{row.qrPayments}</td><td>{row.topups}</td><td>{row.withdrawals}</td><td>{row.rewards}</td><td>{row.commissions}</td><td>{row.customers}</td></tr>)}</tbody></table>
        </>}
        <table><thead><tr><th>{tr.eventDate}</th><th>{tr.type}</th><th>{tr.merchant}</th><th>{tr.customer}</th><th>{tr.reference}</th><th>{tr.amount}</th><th>{tr.status}</th></tr></thead><tbody>{reportRows(true)}</tbody></table>
      </div>
    </section>
  );
}
