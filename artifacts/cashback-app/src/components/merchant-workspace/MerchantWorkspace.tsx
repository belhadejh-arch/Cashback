import { useEffect, useMemo, useRef, useState, type ReactNode, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  useCreateCashbackMerchantAssetUpload, useUpdateCashbackMerchantStore,
  useCreateCashbackMerchantStoreChangeRequest, useCreateCashbackMerchantWithdrawal,
  useCreateCashbackMerchantTopup, getGetCashbackSessionQueryKey,
  getGetCashbackNotificationsQueryKey, useGetCashbackNotifications,
  useMarkCashbackNotificationsRead,
} from '@workspace/api-client-react';
import { notificationCopy } from '@/components/notifications/notification-copy';
import {
  Activity, ArrowDownToLine, ArrowLeftRight, ArrowUpRight, BadgeDollarSign,
  Bell, Check, CircleDollarSign, Download,
  Clock3, FileText, Gift, Home, MapPin, Menu, Percent, QrCode, ReceiptText, RefreshCw,
  Settings, Store, SunMoon, Users, Wallet, X,
} from 'lucide-react';
import './merchant-workspace.css';

type Lang = 'ar' | 'en' | 'fr';
type Theme = 'dark' | 'light';
type RecordLike = Record<string, unknown>;
export type MerchantWorkspaceProps = {
  shop: object;
  state: object;
  currentPath: string;
  lang: Lang;
  theme: Theme;
  onNavigate: (path: string) => void;
  onLanguageChange: (lang: Lang) => void;
  onThemeChange: (theme: Theme) => void;
  qrPanel: ReactNode;
  onRefresh: () => void;
};

type Copy = Record<string, string>;
const words: Record<Lang, Copy> = {
  en: {
    overview:'Overview', store:'Store profile', qr:'QR payments', invoices:'Invoices', customers:'Customers',
    rewards:'Cashback earned', payments:'QR payments', wallet:'Payout balances', topups:'Fund wallet',
    withdrawals:'Withdrawals', transfers:'Transfers', reports:'Reports', notifications:'Notifications',
    settings:'Settings', workspace:'MERCHANT WORKSPACE', welcome:'Your shop, at a glance',
    overviewHint:'A clear view of today’s business.', sales:'Approved invoice sales', approvedInvoices:'Approved invoices',
    cashbackAwarded:'Cashback awarded', qrSpent:'QR cashback spent', payoutBalance:'QR proceeds balance', withdrawableBalance:'Available to withdraw', commissionDue:'Merchant obligations due', platformCommissionDue:'Platform commission due',
    funded:'Funded balance', qrBalance:'QR proceeds balance', topupFunded:'Funded top-ups', withdrawalsPaid:'Paid withdrawals', reservedWithdrawals:'Withdrawals in settlement',
    commissionLedger:'Commission ledger',commissionLedgerHint:'Each invoice records the customer reward and platform fee once. Total obligation is their sum.',commissionTotal:'Total obligation',commissionSettled:'Settled',commissionOutstanding:'Outstanding',platformFee:'Platform fee',netSale:'Net sale',invoiceAmount:'Invoice amount',fundedSettlement:'Applied to obligations',cashbackRate:'Reward rate',platformCommissionRate:'Platform commission rate',
    uniqueCustomers:'Unique customers', recentActivity:'Recent activity', viewAll:'View all', noActivity:'No activity to show yet',
    noActivityHint:'Approved sales and customer payments will appear here.', amount:'Amount', date:'Date', status:'Status',
    invoice:'Invoice', customer:'Customer', cashback:'Cashback', method:'Method', reference:'Reference',
    search:'Search records…', all:'All', approved:'Approved', pending:'Pending', rejected:'Rejected',
    paid:'Paid', processing:'Processing', fundedStatus:'Funded', reversed:'Reversed', emptyTitle:'Nothing here yet',
    emptyHint:'When activity is recorded, it will appear here.', refresh:'Refresh data', loading:'Loading merchant data…',
    loadError:'Some merchant data could not be read. Refresh to try again.', storeDetails:'Store details',
    shopName:'Store name', phone:'Phone', description:'Description', address:'Address', mapUrl:'Map URL',
    latitude:'Latitude', longitude:'Longitude', openingHours:'Opening hours', save:'Save store profile',
    uploadLogo:'Store logo', uploadCover:'Cover image', chooseFile:'Choose image', saved:'Changes saved.',
    uploadError:'Upload failed. Check the image and try again.', requiredImage:'Choose an image first.',
    invalidImage:'Use a JPEG, PNG or WebP image up to 5 MB.', saveError:'Could not save changes. Try again.',
    requestChange:'Request legal details change', country:'Country', category:'Category', legalName:'Legal name',
    registration:'Registration number', tax:'Tax number', submitRequest:'Send change request', requestSent:'Change request sent.',
    qrHint:'QR transactions credited to your shop. Reversals are excluded from net spend.', noQr:'No QR payments recorded.',
    earnedHint:'Cashback credited through approved invoices. Rewards remain scoped to your shop.',
    customerHint:'Each customer’s reward balance belongs to this shop only.', customerBalance:'Shop reward balance',
    visits:'Transactions', lastPurchase:'Last transaction', noCustomers:'No customers yet.',
    payoutHint:'Two separate balances, two separate purposes.', requestWithdrawal:'Request withdrawal',
    topupBalanceHint:'Top-up funds are separate from QR payments.', requestTopup:'Submit top-up request',
    amountLabel:'Amount', paymentMethod:'Payment method', payerReference:'Payer reference', proof:'Payment proof',transferReceipt:'Transfer receipt',
    accountDetails:'Receiving account details', submit:'Submit request', noMethods:'No active payment methods are available.',
    formError:'Complete all required fields.', requestError:'Request could not be submitted.', submitted:'Request submitted.',
    withdrawalsHint:'Track each payout request from review through payment.', topupsHint:'Funding requests and their review status.',
    transfersHint:'Payout transfer records for this shop.', reportTitle:'Business reports', reportHint:'Export the current merchant ledger as a CSV file.',
    exportCsv:'Export CSV', exported:'Report downloaded', noReport:'There is no activity to export.',
    readAll:'Mark all as read', markedRead:'Notifications marked as read.', noNotifications:'You are all caught up.',
    settingsHint:'Choose how your workspace looks and reads.', appearance:'Appearance', language:'Language',
    dark:'Dark', light:'Light', english:'English', french:'Français', arabic:'العربية',
    preferencesHint:'Changes apply immediately to this workspace.', available:'Available', QR:'QR', topup:'Top-up',
    storeLocation:'Store location', openMap:'Open map', noStoreInfo:'Store information has not been completed.',
    recent:'Recent', net:'Net', unknown:'Unknown', error:'Something went wrong. Please try again.',
    invoiceCount:'Invoices',allStatuses:'All statuses',invoiceSales:'Sales from approved invoices', read:'Read', unread:'Unread', fromShop:'At this shop',
    amountCurrency:'Amount', profileSaved:'Store profile updated.', more:'More',
    algeria:'Algeria',libya:'Libya',statusApproved:'Approved',statusPending:'Pending',statusRejected:'Rejected',
    statusPaid:'Paid',statusTransferring:'Transferring',statusFunded:'Funded',statusDone:'Completed',
    statusReversed:'Reversed',statusCancelled:'Cancelled',statusProcessing:'Processing',statusReview:'In review',
    catRestaurants:'Restaurants',catCafes:'Cafés',catClothing:'Clothing',catElectronics:'Electronics',
    catMalls:'Shopping centers',catGroceries:'Groceries',catPerfume:'Perfume',catGifts:'Gifts',catShops:'Other shops',catOther:'Other',
    legalNameLabel:'Legal name',registrationLabel:'Registration number',taxLabel:'Tax number',
    topupMinimum:'Minimum top-up',minimumError:'The amount is below the minimum for this country.',
    topupMaximumLabel:'Maximum top-up',noMaximum:'No fixed maximum',maximumError:'The amount exceeds the limit set by the administrator.',
    rejectionReason:'Rejection reason',
    withdrawalLimitError:'The withdrawal amount exceeds your available QR proceeds.',
    methodUnavailableError:'This payment method is no longer available.',
    sensitiveRequests:'Sensitive change requests',noSensitiveRequests:'No sensitive profile changes submitted.',
    reviewed:'Reviewed',requestedChanges:'Requested changes',beneficiary:'Beneficiary',account:'Account / IBAN / CCP',instructions:'Payment instructions',
  },
  fr: {
    overview:'Vue d’ensemble', store:'Profil du commerce', qr:'Paiements QR', invoices:'Factures', customers:'Clients',
    rewards:'Cashback gagné', payments:'Paiements QR', wallet:'Soldes de paiement', topups:'Alimenter le solde',
    withdrawals:'Retraits', transfers:'Virements', reports:'Rapports', notifications:'Notifications',
    settings:'Paramètres', workspace:'ESPACE COMMERÇANT', welcome:'Votre commerce en un coup d’œil',
    overviewHint:'Une vue claire de votre activité.', sales:'Ventes des factures approuvées', approvedInvoices:'Factures approuvées',
    cashbackAwarded:'Cashback accordé', qrSpent:'Cashback dépensé par QR', payoutBalance:'Solde des recettes QR', withdrawableBalance:'Montant retirable', commissionDue:'Obligations dues', platformCommissionDue:'Commission de la plateforme due',
    funded:'Solde alimenté', qrBalance:'Solde des recettes QR', topupFunded:'Rechargements financés', withdrawalsPaid:'Retraits payés', reservedWithdrawals:'Retraits en règlement',
    commissionLedger:'Registre des commissions',commissionLedgerHint:'Chaque facture enregistre une seule fois la récompense et la commission. L’obligation totale est leur somme.',commissionTotal:'Obligation totale',commissionSettled:'Réglé',commissionOutstanding:'Restant dû',platformFee:'Commission plateforme',netSale:'Vente nette',invoiceAmount:'Montant de la facture',fundedSettlement:'Affecté aux obligations',cashbackRate:'Taux de récompense',platformCommissionRate:'Taux de commission',
    uniqueCustomers:'Clients uniques', recentActivity:'Activité récente', viewAll:'Tout voir', noActivity:'Aucune activité pour le moment',
    noActivityHint:'Les ventes validées et paiements apparaîtront ici.', amount:'Montant', date:'Date', status:'Statut',
    invoice:'Facture', customer:'Client', cashback:'Cashback', method:'Méthode', reference:'Référence',
    search:'Rechercher…', all:'Tout', approved:'Approuvé', pending:'En attente', rejected:'Refusé',
    paid:'Payé', processing:'En cours', fundedStatus:'Financé', reversed:'Annulé', emptyTitle:'Aucune donnée',
    emptyHint:'Les opérations apparaîtront ici dès leur enregistrement.', refresh:'Actualiser', loading:'Chargement des données…',
    loadError:'Certaines données n’ont pas pu être lues. Actualisez pour réessayer.', storeDetails:'Informations du commerce',
    shopName:'Nom du commerce', phone:'Téléphone', description:'Description', address:'Adresse', mapUrl:'Lien de carte',
    latitude:'Latitude', longitude:'Longitude', openingHours:'Horaires', save:'Enregistrer le profil',
    uploadLogo:'Logo du commerce', uploadCover:'Image de couverture', chooseFile:'Choisir une image', saved:'Modifications enregistrées.',
    uploadError:'Échec du téléversement. Vérifiez l’image et réessayez.', requiredImage:'Choisissez une image.',
    invalidImage:'Image JPEG, PNG ou WebP de 5 Mo maximum.', saveError:'Impossible d’enregistrer. Réessayez.',
    requestChange:'Demander une modification légale', country:'Pays', category:'Catégorie', legalName:'Raison sociale',
    registration:'Numéro d’enregistrement', tax:'Numéro fiscal', submitRequest:'Envoyer la demande', requestSent:'Demande envoyée.',
    qrHint:'Transactions QR créditées au commerce. Les annulations sont exclues du net.', noQr:'Aucun paiement QR enregistré.',
    earnedHint:'Cashback crédité via les factures approuvées. Les récompenses restent liées au commerce.',
    customerHint:'Le solde de chaque client appartient uniquement à ce commerce.', customerBalance:'Solde de récompenses',
    visits:'Transactions', lastPurchase:'Dernière opération', noCustomers:'Aucun client pour le moment.',
    payoutHint:'Deux soldes distincts, deux usages différents.', requestWithdrawal:'Demander un retrait',
    topupBalanceHint:'Les fonds alimentés sont séparés des paiements QR.', requestTopup:'Demander un rechargement',
    amountLabel:'Montant', paymentMethod:'Mode de paiement', payerReference:'Référence du payeur', proof:'Justificatif',transferReceipt:'Justificatif de virement',
    accountDetails:'Coordonnées de réception', submit:'Envoyer la demande', noMethods:'Aucun moyen de paiement actif.',
    formError:'Veuillez remplir les champs obligatoires.', requestError:'La demande n’a pas pu être envoyée.', submitted:'Demande envoyée.',
    withdrawalsHint:'Suivez chaque retrait, de la vérification au paiement.', topupsHint:'Demandes de financement et leur statut.',
    transfersHint:'Historique des virements de ce commerce.', reportTitle:'Rapports d’activité', reportHint:'Exportez le registre du commerce au format CSV.',
    exportCsv:'Exporter CSV', exported:'Rapport téléchargé', noReport:'Aucune activité à exporter.',
    readAll:'Tout marquer comme lu', markedRead:'Notifications marquées comme lues.', noNotifications:'Tout est à jour.',
    settingsHint:'Personnalisez la langue et l’apparence de votre espace.', appearance:'Apparence', language:'Langue',
    dark:'Sombre', light:'Clair', english:'English', french:'Français', arabic:'العربية',
    preferencesHint:'Les changements s’appliquent immédiatement.', available:'Disponible', QR:'QR', topup:'Rechargement',
    storeLocation:'Adresse du commerce', openMap:'Ouvrir la carte', noStoreInfo:'Les informations du commerce sont incomplètes.',
    recent:'Récent', net:'Net', unknown:'Inconnu', error:'Une erreur est survenue. Réessayez.',
    invoiceCount:'Factures',allStatuses:'Tous les statuts',invoiceSales:'Ventes des factures approuvées', read:'Lue', unread:'Non lue', fromShop:'Dans ce commerce',
    amountCurrency:'Montant', profileSaved:'Profil du commerce mis à jour.', more:'Plus',
    algeria:'Algérie',libya:'Libye',statusApproved:'Approuvé',statusPending:'En attente',statusRejected:'Refusé',
    statusPaid:'Payé',statusTransferring:'En transfert',statusFunded:'Financé',statusDone:'Terminé',
    statusReversed:'Annulé',statusCancelled:'Annulé',statusProcessing:'En cours',statusReview:'En vérification',
    catRestaurants:'Restaurants',catCafes:'Cafés',catClothing:'Vêtements',catElectronics:'Électronique',
    catMalls:'Centres commerciaux',catGroceries:'Épicerie',catPerfume:'Parfumerie',catGifts:'Cadeaux',catShops:'Autres commerces',catOther:'Autre',
    legalNameLabel:'Raison sociale',registrationLabel:'Numéro d’enregistrement',taxLabel:'Numéro fiscal',
    topupMinimum:'Rechargement minimum',minimumError:'Le montant est inférieur au minimum requis.',
    topupMaximumLabel:'Plafond de recharge',noMaximum:'Aucun plafond fixe',maximumError:'Le montant dépasse la limite définie par l’administration.',
    rejectionReason:'Motif du refus',
    withdrawalLimitError:'Le retrait dépasse vos recettes QR disponibles.',
    methodUnavailableError:'Ce mode de paiement n’est plus disponible.',
    sensitiveRequests:'Demandes de modification sensibles',noSensitiveRequests:'Aucune demande de modification sensible.',
    reviewed:'Examiné',requestedChanges:'Modifications demandées',beneficiary:'Bénéficiaire',account:'Compte / IBAN / CCP',instructions:'Instructions de paiement',
  },
  ar: {
    overview:'نظرة عامة', store:'ملف المتجر', qr:'مدفوعات QR', invoices:'الفواتير', customers:'الزبائن',
    rewards:'المكافآت المكتسبة', payments:'مدفوعات QR', wallet:'أرصدة السحب', topups:'تمويل الرصيد',
    withdrawals:'طلبات السحب', transfers:'التحويلات', reports:'التقارير', notifications:'الإشعارات',
    settings:'الإعدادات', workspace:'مساحة التاجر', welcome:'متجرك في لمحة',
    overviewHint:'صورة واضحة عن نشاطك اليومي.', sales:'مبيعات الفواتير المقبولة', approvedInvoices:'الفواتير المقبولة',
    cashbackAwarded:'المكافآت الممنوحة', qrSpent:'المكافآت المصروفة عبر QR', payoutBalance:'رصيد عائدات QR', withdrawableBalance:'الرصيد المتاح للسحب', commissionDue:'التزامات التاجر المستحقة', platformCommissionDue:'عمولة التطبيق المستحقة',
    funded:'الرصيد الممول', qrBalance:'رصيد عائدات QR', topupFunded:'التمويل المقبول', withdrawalsPaid:'السحوبات المدفوعة', reservedWithdrawals:'السحوبات قيد التسوية',
    commissionLedger:'سجل العمولات',commissionLedgerHint:'تُسجل مكافأة الزبون وعمولة التطبيق مرة واحدة لكل فاتورة. إجمالي الالتزام هو مجموعهما.',commissionTotal:'إجمالي الالتزام',commissionSettled:'تمت تسويته',commissionOutstanding:'المتبقي',platformFee:'عمولة التطبيق',netSale:'صافي البيع',invoiceAmount:'قيمة الفاتورة',fundedSettlement:'المبلغ المستخدم لتسوية الالتزامات',cashbackRate:'نسبة المكافأة',platformCommissionRate:'نسبة عمولة التطبيق',
    uniqueCustomers:'الزبائن الفريدون', recentActivity:'النشاط الأخير', viewAll:'عرض الكل', noActivity:'لا يوجد نشاط لعرضه بعد',
    noActivityHint:'ستظهر المبيعات المقبولة ومدفوعات الزبائن هنا.', amount:'المبلغ', date:'التاريخ', status:'الحالة',
    invoice:'الفاتورة', customer:'الزبون', cashback:'المكافأة', method:'الطريقة', reference:'المرجع',
    search:'ابحث في السجلات…', all:'الكل', approved:'مقبول', pending:'قيد المراجعة', rejected:'مرفوض',
    paid:'مدفوع', processing:'قيد التنفيذ', fundedStatus:'تم التمويل', reversed:'معكوس', emptyTitle:'لا توجد بيانات بعد',
    emptyHint:'ستظهر العمليات هنا عند تسجيلها.', refresh:'تحديث البيانات', loading:'جارٍ تحميل بيانات التاجر…',
    loadError:'تعذرت قراءة بعض البيانات. حدّث الصفحة للمحاولة مجدداً.', storeDetails:'تفاصيل المتجر',
    shopName:'اسم المتجر', phone:'الهاتف', description:'الوصف', address:'العنوان', mapUrl:'رابط الخريطة',
    latitude:'خط العرض', longitude:'خط الطول', openingHours:'ساعات العمل', save:'حفظ ملف المتجر',
    uploadLogo:'شعار المتجر', uploadCover:'صورة الغلاف', chooseFile:'اختر صورة', saved:'تم حفظ التغييرات.',
    uploadError:'تعذر رفع الصورة. تحقق منها وحاول مجدداً.', requiredImage:'اختر صورة أولاً.',
    invalidImage:'اختر صورة JPEG أو PNG أو WebP لا تتجاوز 5 ميغابايت.', saveError:'تعذر حفظ التغييرات. حاول مجدداً.',
    requestChange:'طلب تعديل البيانات القانونية', country:'الدولة', category:'الفئة', legalName:'الاسم القانوني',
    registration:'رقم التسجيل', tax:'الرقم الضريبي', submitRequest:'إرسال طلب التعديل', requestSent:'تم إرسال طلب التعديل.',
    qrHint:'عمليات QR التي تضاف إلى متجرك. تُستثنى العمليات المعكوسة من الصافي.', noQr:'لا توجد مدفوعات QR مسجلة.',
    earnedHint:'المكافآت المضافة عبر الفواتير المقبولة. تبقى المكافآت مرتبطة بمتجرك.',
    customerHint:'رصيد كل زبون مخصص لهذا المتجر فقط.', customerBalance:'رصيد مكافآت المتجر',
    visits:'المعاملات', lastPurchase:'آخر معاملة', noCustomers:'لا يوجد زبائن بعد.',
    payoutHint:'رصيدان منفصلان واستخدامان مختلفان.', requestWithdrawal:'طلب سحب',
    topupBalanceHint:'الرصيد الممول منفصل عن مدفوعات QR.', requestTopup:'إرسال طلب تمويل',
    amountLabel:'المبلغ', paymentMethod:'طريقة الدفع', payerReference:'مرجع الدافع', proof:'إثبات الدفع',transferReceipt:'وصل التحويل',
    accountDetails:'تفاصيل حساب الاستلام', submit:'إرسال الطلب', noMethods:'لا توجد وسائل دفع نشطة.',
    formError:'أكمل جميع الحقول المطلوبة.', requestError:'تعذر إرسال الطلب.', submitted:'تم إرسال الطلب.',
    withdrawalsHint:'تابع طلبات السحب من المراجعة إلى الدفع.', topupsHint:'طلبات التمويل وحالة مراجعتها.',
    transfersHint:'سجل تحويلات هذا المتجر.', reportTitle:'تقارير النشاط', reportHint:'صدّر سجل المتجر الحالي بصيغة CSV.',
    exportCsv:'تصدير CSV', exported:'تم تنزيل التقرير', noReport:'لا يوجد نشاط لتصديره.',
    readAll:'تحديد الكل كمقروء', markedRead:'تم تحديد الإشعارات كمقروءة.', noNotifications:'أنت على اطلاع بكل شيء.',
    settingsHint:'اختر مظهر مساحة العمل ولغتها.', appearance:'المظهر', language:'اللغة',
    dark:'داكن', light:'فاتح', english:'English', french:'Français', arabic:'العربية',
    preferencesHint:'تُطبق التغييرات فوراً على مساحة العمل.', available:'متاح', QR:'QR', topup:'تمويل',
    storeLocation:'موقع المتجر', openMap:'فتح الخريطة', noStoreInfo:'لم تكتمل معلومات المتجر بعد.',
    recent:'الأحدث', net:'الصافي', unknown:'غير معروف', error:'حدث خطأ. حاول مجدداً.',
    invoiceCount:'الفواتير',allStatuses:'بكل الحالات',invoiceSales:'مبيعات الفواتير المقبولة', read:'مقروء', unread:'غير مقروء', fromShop:'في هذا المتجر',
    amountCurrency:'المبلغ', profileSaved:'تم تحديث ملف المتجر.', more:'المزيد',
    algeria:'الجزائر',libya:'ليبيا',statusApproved:'مقبول',statusPending:'قيد المراجعة',statusRejected:'مرفوض',
    statusPaid:'مدفوع',statusTransferring:'قيد التحويل',statusFunded:'تم التمويل',statusDone:'مكتمل',
    statusReversed:'معكوس',statusCancelled:'ملغى',statusProcessing:'قيد التنفيذ',statusReview:'قيد المراجعة',
    catRestaurants:'مطاعم',catCafes:'مقاهٍ',catClothing:'ملابس',catElectronics:'إلكترونيات',
    catMalls:'مراكز تجارية',catGroceries:'مواد غذائية',catPerfume:'عطور',catGifts:'هدايا',catShops:'محلات أخرى',catOther:'أخرى',
    legalNameLabel:'الاسم القانوني',registrationLabel:'رقم التسجيل',taxLabel:'الرقم الضريبي',
    topupMinimum:'الحد الأدنى للشحن',minimumError:'المبلغ أقل من الحد الأدنى لهذا البلد.',
    topupMaximumLabel:'الحد الأقصى للشحن',noMaximum:'لا يوجد سقف ثابت',maximumError:'المبلغ يتجاوز الحد الذي حددته الإدارة.',
    rejectionReason:'سبب الرفض',
    withdrawalLimitError:'مبلغ السحب يتجاوز عائدات QR المتاحة.',
    methodUnavailableError:'وسيلة الدفع هذه لم تعد متاحة.',
    sensitiveRequests:'طلبات تعديل البيانات الحساسة',noSensitiveRequests:'لا توجد طلبات تعديل حساسة.',
    reviewed:'تمت المراجعة',requestedChanges:'التعديلات المطلوبة',beneficiary:'المستفيد',account:'رقم الحساب أو IBAN أو CCP',instructions:'تعليمات الدفع',
  },
};

const navItems = [
  { path:'/merchant', key:'overview', icon:Home }, { path:'/merchant/store', key:'store', icon:Store },
  { path:'/merchant/qr', key:'qr', icon:QrCode }, { path:'/merchant/invoices', key:'invoices', icon:ReceiptText },
  { path:'/merchant/customers', key:'customers', icon:Users }, { path:'/merchant/rewards', key:'rewards', icon:Gift },
  { path:'/merchant/payments', key:'payments', icon:CircleDollarSign }, { path:'/merchant/wallet', key:'wallet', icon:Wallet },
  { path:'/merchant/topups', key:'topups', icon:ArrowDownToLine }, { path:'/merchant/withdrawals', key:'withdrawals', icon:ArrowUpRight },
  { path:'/merchant/transfers', key:'transfers', icon:ArrowLeftRight }, { path:'/merchant/reports', key:'reports', icon:FileText },
  { path:'/merchant/notifications', key:'notifications', icon:Bell }, { path:'/merchant/settings', key:'settings', icon:Settings },
];
const asRows = (value: unknown): RecordLike[] => Array.isArray(value) ? value.filter((v): v is RecordLike => !!v && typeof v === 'object') : [];
const str = (v: unknown, fallback = ''): string => typeof v === 'string' || typeof v === 'number' ? String(v) : fallback;
const num = (v: unknown): number => Number.isFinite(Number(v)) ? Number(v) : 0;
const first = (r: RecordLike, ...keys: string[]): unknown => keys.map(k => r[k]).find(v => v !== undefined && v !== null);
const statusOf = (r: RecordLike): string => str(first(r, 'status', 'state', 'decision'), 'pending').toLowerCase();
const countryCode = (value: unknown): 'Algeria'|'Libya'|'' => {
  const country = str(value).trim().toLowerCase();
  if (country === 'algeria' || country === 'dz' || country === 'الجزائر' || country === 'algérie') return 'Algeria';
  if (country === 'libya' || country === 'ly' || country === 'ليبيا' || country === 'libye') return 'Libya';
  return '';
};
const categoryTranslationKey: Record<string,string> = {
  restaurants:'catRestaurants', cafes:'catCafes', clothing:'catClothing', electronics:'catElectronics',
  malls:'catMalls', groceries:'catGroceries', perfume:'catPerfume', gifts:'catGifts', shops:'catShops', other:'catOther',
};
const dateOf = (r: RecordLike): string => {
  const value = first(r, 'date', 'at', 'createdAt', 'created', 't', 'timestamp');
  if (value === undefined) return '—';
  const d = new Date(typeof value === 'number' && value < 10_000_000_000 ? value * 1000 : value as string | number);
  return Number.isNaN(d.getTime()) ? str(value) : new Intl.DateTimeFormat(undefined, { dateStyle:'medium', timeStyle:'short' }).format(d);
};
const timeOf = (r: RecordLike): number => {
  const value = first(r,'date','at','createdAt','created','t','timestamp');
  if (typeof value === 'number' || (typeof value === 'string' && /^\d+$/.test(value))) {
    const n = Number(value);
    return n < 10_000_000_000 ? n * 1000 : n;
  }
  const date = new Date(str(value)).getTime();
  return Number.isNaN(date) ? 0 : date;
};
const escapeCsv = (v: unknown) => `"${str(v).replace(/"/g, '""')}"`;

export function MerchantWorkspace(props: MerchantWorkspaceProps) {
  const { currentPath, lang, theme, onNavigate, onLanguageChange, onThemeChange, qrPanel, onRefresh } = props;
  const shop = props.shop as RecordLike;
  const state = props.state as RecordLike;
  const t = words[lang];
  const rtl = lang === 'ar';
  const queryClient = useQueryClient();
  const assetUpload = useCreateCashbackMerchantAssetUpload();
  const updateStore = useUpdateCashbackMerchantStore();
  const changeRequest = useCreateCashbackMerchantStoreChangeRequest();
  const createWithdrawal = useCreateCashbackMerchantWithdrawal();
  const createTopup = useCreateCashbackMerchantTopup();
  const notificationQuery = useGetCashbackNotifications({ query: {
    queryKey: getGetCashbackNotificationsQueryKey(),
    refetchInterval: 15000,
    refetchOnWindowFocus: true,
  } });
  const markRead = useMarkCashbackNotificationsRead();
  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;
  useEffect(() => {
    const timer = window.setInterval(() => {
      void queryClient.invalidateQueries({ queryKey:getGetCashbackSessionQueryKey() });
      onRefreshRef.current();
    }, 10_000);
    return () => window.clearInterval(timer);
  }, [queryClient]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [form, setForm] = useState<Record<string,string>>({});
  const [logo, setLogo] = useState<File | null>(null);
  const [cover, setCover] = useState<File | null>(null);
  const [proof, setProof] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const merchantCountry = countryCode(shop.country);
  const settingsRecord = state.settings && typeof state.settings === 'object' ? state.settings as RecordLike : {};
  const topupMinimum = merchantCountry === 'Libya'
    ? num(first((state.settings ?? {}) as RecordLike, 'minimumTopupLyd') ?? 10)
    : num(first((state.settings ?? {}) as RecordLike, 'minimumTopupDzd') ?? 1000);
  const topupMaximumRaw = settingsRecord[merchantCountry === 'Libya' ? 'maxTopupAmountLyd' : 'maxTopupAmountDzd'];
  const topupMaximum = topupMaximumRaw == null ? undefined : num(topupMaximumRaw);
  const currency = str(first(shop, 'currency'), merchantCountry === 'Libya' ? 'LYD' : 'DZD');
  const money = (v: number) => new Intl.NumberFormat(lang === 'ar' ? 'ar' : lang === 'fr' ? 'fr-FR' : 'en', { style:'currency', currency, maximumFractionDigits:2 }).format(v);
  const claims = asRows(state.claims).filter(r => str(first(r, 'mid', 'merchantId', 'shopId')) === str(shop.id));
  const txns = asRows(state.txns).filter(r => str(first(r, 'mid', 'merchantId', 'shopId')) === str(shop.id));
  const cbpays = asRows(state.cbpays).filter(r => str(first(r, 'mid', 'merchantId', 'shopId')) === str(shop.id));
  const customers = asRows(state.customers);
  const customerById = useMemo(() => new Map(customers.map(customer => [str(customer.id), customer])), [customers]);
  const notes = asRows(
    (notificationQuery.data as { notifications?: unknown[] }|undefined)?.notifications ?? state.notes,
  ).filter(r => str(first(r, 'to')) === str(shop.id));
  const unreadNotifications = notes.filter(r => !r.read).length;
  const topups = asRows(first(state, 'merchantTopups', 'topups')).filter(r => !first(r, 'merchantId', 'mid') || str(first(r, 'merchantId', 'mid')) === str(shop.id));
  const withdrawals = asRows(first(state, 'merchantWithdrawals', 'withdrawals')).filter(r => !first(r, 'merchantId', 'mid') || str(first(r, 'merchantId', 'mid')) === str(shop.id));
  const commissionEntries = asRows(first(state, 'merchantCommissionLedger')).filter(r => str(first(r,'merchantId','mid')) === str(shop.id));
  const commissionDue = commissionEntries.reduce((sum,r)=>sum+(num(first(r,'outstandingAmount'))||num(first(r,'rewardOutstanding'))+num(first(r,'platformCommissionOutstanding'))),0);
  const platformCommissionDue = commissionEntries.reduce((sum,r)=>sum+num(first(r,'platformCommissionOutstanding')),0);
  const sensitiveRequests = asRows(state.merchantStoreChangeRequests)
    .filter(r => !first(r,'merchantId','mid') || str(first(r,'merchantId','mid')) === str(shop.id));
  const approvedClaims = claims.filter(r => statusOf(r) === 'approved');
  const invoiceSales = approvedClaims.reduce((sum,r) => sum + num(first(r, 'amount', 'total')), 0);
  const cashbacks = approvedClaims.reduce((sum,r) => sum + num(first(r, 'cashback', 'rewardAmount')), 0);
  const fundedTopups = topups.filter(r => ['funded','approved','paid'].includes(statusOf(r))).reduce((sum,r)=>sum+num(r.amount),0);
  const qrNet = cbpays.reduce((sum,r) => {
    const status = statusOf(r);
    if (first(r,'reversalReason') || ['reversed','reversal','refunded'].includes(status)) return sum;
    return sum + num(first(r, 'amount'));
  }, 0);
  const payoutBalance = num(shop.payoutBalance);
  const withdrawableBalance = Math.max(0,payoutBalance-commissionDue);
  const reservedWithdrawalBalance = num(shop.reservedWithdrawalBalance);
  const fundedBalance = num(shop.topupBalance);
  const customerStats = useMemo(() => {
    const map = new Map<string, {row:RecordLike; visits:number; balance:number; last:unknown}>();
    for (const customer of customers) {
      const id = str(customer.id);
      if (!id) continue;
      const scopedBalance = num((customer.cbm as RecordLike | undefined)?.[str(shop.id)]);
      if (scopedBalance > 0) map.set(id,{row:customer,visits:0,balance:scopedBalance,last:undefined});
    }
    for (const claim of approvedClaims) {
      const id = str(first(claim, 'cid', 'customerId'));
      if (!id) continue;
      const customer = customers.find(c => str(c.id) === id) ?? { id };
      const entry = map.get(id) ?? { row:customer, visits:0, balance:num((customer.cbm as RecordLike | undefined)?.[str(shop.id)]), last:undefined };
      entry.visits++;
      const dateVal = first(claim, 'date', 'created', 'at');
      if (!entry.last || timeOf({date:dateVal}) > timeOf({date:entry.last})) entry.last = dateVal;
      map.set(id, entry);
    }
    for (const payment of cbpays) {
      if (first(payment,'reversalReason') || ['pending','rejected','cancelled','canceled','reversed','reversal','refunded'].includes(statusOf(payment))) continue;
      const id = str(first(payment,'cid','customerId'));
      if (!id) continue;
      const customer = customerById.get(id) ?? { id };
      const entry = map.get(id) ?? { row:customer,visits:0,balance:num((customer.cbm as RecordLike | undefined)?.[str(shop.id)]),last:undefined };
      entry.visits++;
      const dateVal = first(payment,'at','createdAt','date');
      if (!entry.last || timeOf({at:dateVal}) > timeOf({at:entry.last})) entry.last = dateVal;
      map.set(id,entry);
    }
    return [...map.values()];
  }, [approvedClaims, cbpays, customerById, shop.id]);
  const activeNav = navItems.find(item => item.path === currentPath) ?? navItems[0];
  const currentTitle = t[activeNav.key];
  const invalidating = () => {
    void queryClient.invalidateQueries({ queryKey:getGetCashbackSessionQueryKey() });
    void queryClient.invalidateQueries({ queryKey:getGetCashbackNotificationsQueryKey() });
    onRefresh();
  };
  const notificationAction = async () => {
    setMessage('');
    try { await markRead.mutateAsync(); invalidating(); setMessage(t.markedRead); }
    catch { setMessage(t.error); }
  };
  const formatStatus = (s: string) => {
    const normalized = s.toLowerCase().replace(/[\s-]+/g,'_');
    const aliases: Record<string,string> = {
      approved:'statusApproved', accepted:'statusApproved', pending:'statusPending', submitted:'statusPending',
      rejected:'statusRejected', declined:'statusRejected', paid:'statusPaid', transferring:'statusTransferring',
      funded:'statusFunded', done:'statusDone', complete:'statusDone', completed:'statusDone',
      reversed:'statusReversed', reversal:'statusReversed', refunded:'statusReversed', cancelled:'statusCancelled',
      canceled:'statusCancelled', processing:'statusProcessing', in_review:'statusReview', under_review:'statusReview',
      reviewed:'reviewed', active:'statusApproved',
    };
    return t[aliases[normalized] ?? ''] ?? t.unknown;
  };
  const countryLabel = (value: unknown) => {
    const code = countryCode(value);
    return code === 'Algeria' ? t.algeria : code === 'Libya' ? t.libya : t.unknown;
  };
  const categoryLabel = (value: unknown) => {
    const key = categoryTranslationKey[str(value).toLowerCase()];
    return key ? t[key] : t.unknown;
  };
  const sensitiveFieldLabel = (key: string) => ({
    country:t.country, category:t.category, legalName:t.legalNameLabel,
    registrationNumber:t.registrationLabel, taxNumber:t.taxLabel,
  }[key] ?? t.unknown);
  const sensitiveFieldValue = (key:string,value:unknown) => key==='country' ? countryLabel(value) : key==='category' ? categoryLabel(value) : str(value,t.unknown);
  const friendlyApiError = (error: unknown) => {
    const raw = error instanceof Error ? error.message : typeof error === 'string' ? error : JSON.stringify(error) ?? '';
    if (raw.includes('TOPUP_BELOW_MINIMUM')) return t.minimumError;
    if (raw.includes('TOPUP_EXCEEDS_ADMIN_LIMIT')) return t.maximumError;
    if (raw.includes('WITHDRAWAL_EXCEEDS_AVAILABLE')) return t.withdrawalLimitError;
    if (raw.includes('PAYMENT_METHOD_UNAVAILABLE')) return t.methodUnavailableError;
    return t.requestError;
  };
  const statusPill = (s: string) => <span className={`mw-status is-${s}`}>{formatStatus(s)}</span>;
  const doUpload = async (file: File, asset: 'logo'|'cover'|'topup-proof') => {
    const allowed = ['image/jpeg','image/png','image/webp'];
    if (!allowed.includes(file.type) || file.size > 5 * 1024 * 1024 || file.size < 1) throw new Error(t.invalidImage);
    const result = await assetUpload.mutateAsync({ data:{ asset, contentType:file.type as 'image/jpeg'|'image/png'|'image/webp', size:file.size } });
    const response = await fetch(result.uploadURL, { method:'PUT', headers:{ 'Content-Type':file.type }, body:file });
    if (!response.ok) throw new Error(t.uploadError);
    return result;
  };
  const saveStore = async (event: FormEvent) => {
    event.preventDefault(); setMessage(''); setBusy(true);
    try {
      const data: Record<string, unknown> = {};
      for (const key of ['name','phone','description','address','mapsUrl','openingHours']) if (form[key] !== undefined) data[key] = form[key];
      if (form.lat) data.lat = Number(form.lat);
      if (form.lng) data.lng = Number(form.lng);
      if (logo) { const upload = await doUpload(logo,'logo'); data.logoUploadId = upload.uploadId; data.logoObjectPath = upload.objectPath; }
      if (cover) { const upload = await doUpload(cover,'cover'); data.coverUploadId = upload.uploadId; data.coverObjectPath = upload.objectPath; }
      await updateStore.mutateAsync({ data });
      invalidating(); setMessage(t.profileSaved); setLogo(null); setCover(null);
    } catch (error) { setMessage(error instanceof Error ? error.message : t.saveError); }
    finally { setBusy(false); }
  };
  const submitChangeRequest = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setMessage('');
    try {
      await changeRequest.mutateAsync({ data:{
        country: (form.country || undefined) as 'Algeria'|'Libya'|undefined,
        category: (form.category || undefined) as 'restaurants'|'cafes'|'clothing'|'electronics'|'malls'|'groceries'|'perfume'|'gifts'|'shops'|'other'|undefined, legalName:form.legalName || undefined,
        registrationNumber:form.registrationNumber || undefined, taxNumber:form.taxNumber || undefined,
      } }); invalidating(); setMessage(t.requestSent);
    } catch { setMessage(t.error); } finally { setBusy(false); }
  };
  const requestWithdrawal = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setMessage('');
    if (!num(form.amount) || !form.method || !form.accountDetails) { setBusy(false); setMessage(t.formError); return; }
    if (num(form.amount) > withdrawableBalance) { setBusy(false); setMessage(t.withdrawalLimitError); return; }
    try {
      await createWithdrawal.mutateAsync({ data:{ amount:num(form.amount), method:form.method, accountDetails:form.accountDetails } });
      invalidating(); setForm({}); setMessage(t.submitted);
    } catch (error) { setMessage(friendlyApiError(error)); } finally { setBusy(false); }
  };
  const requestTopup = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setMessage('');
    if (!num(form.amount) || !form.paymentMethodId || !proof) {
      setBusy(false);
      setMessage(!proof ? t.requiredImage : t.formError);
      return;
    }
    if (num(form.amount) < topupMinimum) {
      setBusy(false);
      setMessage(t.minimumError);
      return;
    }
    if (topupMaximum !== undefined && num(form.amount) > topupMaximum) {
      setBusy(false);
      setMessage(t.maximumError);
      return;
    }
    try {
      const upload = await doUpload(proof,'topup-proof');
      await createTopup.mutateAsync({ data:{ amount:num(form.amount), paymentMethodId:form.paymentMethodId, payerReference:form.payerReference || undefined, uploadId:upload.uploadId, objectPath:upload.objectPath } });
      invalidating(); setForm({}); setProof(null); setMessage(t.submitted);
    } catch (error) { setMessage(friendlyApiError(error)); } finally { setBusy(false); }
  };
  const methods = asRows(settingsRecord.paymentMethods)
    .filter(r => r.active !== false && countryCode(r.country) === merchantCountry);
  const selectedMethod = methods.find(method => str(method.id) === form.paymentMethodId);
  const recordRows = useMemo(() => {
    switch (currentPath) {
      case '/merchant/invoices': return claims;
      case '/merchant/rewards': return approvedClaims;
      case '/merchant/payments': case '/merchant/qr': return cbpays;
      case '/merchant/topups': return topups;
      case '/merchant/withdrawals': return withdrawals;
      case '/merchant/transfers': return withdrawals.filter(r => ['paid','transferring','approved'].includes(statusOf(r)));
      default: return [];
    }
  }, [currentPath, approvedClaims, cbpays, topups, withdrawals]);
  const filteredRecords = recordRows.filter(r => {
    const query = search.toLowerCase();
    const matchesSearch = !query || JSON.stringify(r).toLowerCase().includes(query);
    return matchesSearch && (filter === 'all' || statusOf(r) === filter);
  });
  const recentRows = [
    ...claims.map(r=>({...r,__kind:'invoice'})),
    ...txns.map(r=>({...r,__kind:'reward'})),
    ...cbpays.map(r=>({...r,__kind:'qr'})),
    ...topups.map(r=>({...r,__kind:'topup'})),
    ...withdrawals.map(r=>({...r,__kind:'withdrawal'})),
  ].sort((a,b)=>timeOf(b)-timeOf(a)).slice(0,6);
  const exportCsv = () => {
    const rows = [
      ['type','id','date','status','amount','customer_or_reference'],
      ...[
        ...approvedClaims.map(r => ['invoice',str(r.id),dateOf(r),statusOf(r),num(r.amount),str(first(r,'invoiceNumber','invoice'))]),
        ...cbpays.map(r => ['qr-payment',str(r.id),dateOf(r),statusOf(r),num(r.amount),str(first(r,'reference','cid'))]),
        ...topups.map(r => ['topup',str(r.id),dateOf(r),statusOf(r),num(r.amount),str(first(r,'reference','payerReference'))]),
        ...withdrawals.map(r => ['withdrawal',str(r.id),dateOf(r),statusOf(r),num(r.amount),str(first(r,'transferReference','method'))]),
      ].map(row => row.map(escapeCsv)),
    ];
    if (rows.length === 1) { setMessage(t.noReport); return; }
    const blob = new Blob([rows.map(row => row.join(',')).join('\r\n')], { type:'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'cashback-merchant-report.csv'; a.click(); URL.revokeObjectURL(url); setMessage(t.exported);
  };
  const renderTable = (data: RecordLike[], kind: 'invoice'|'qr'|'topup'|'withdrawal') => {
    if (!data.length) return <Empty title={t.emptyTitle} hint={kind === 'qr' ? t.noQr : t.emptyHint} />;
    return <div className="mw-table-wrap"><table className="mw-table"><thead><tr>
      <th>{kind === 'invoice' ? t.invoice : t.reference}</th><th>{kind === 'invoice' ? t.customer : t.method}</th>
      <th>{t.date}</th><th>{t.amount}</th>{kind === 'invoice' && <th>{t.cashback}</th>}<th>{t.status}</th>
    </tr></thead><tbody>{data.map((r,i) => {
      const status = statusOf(r);
      const customerId = str(first(r,'cid','customerId'));
      const customerRecord = customerById.get(customerId);
      const resolvedCustomerName = str(customerRecord?.name, str(first(r,'customerName'), customerId || '—'));
    const transferProofId = str(first(r,'transferProofId'));
      return <tr key={str(r.id, `${kind}-${i}`)} data-testid={`row-${kind}-${str(r.id,String(i))}`}>
        <td>{str(first(r,'invoiceNumber','reference','id'), '—')}</td>
        <td>{kind === 'invoice' ? <span>{resolvedCustomerName}{customerRecord?.phone ? <small className="mw-table-secondary">{str(customerRecord.phone)}</small> : null}</span> : kind === 'withdrawal' ? str(first(r,'transferReference'),str(first(r,'method'),t.method)) : str(first(r,'method','paymentMethodName','payerReference'), kind === 'qr' ? t.QR : t.method)}</td>
        <td>{dateOf(r)}</td><td>{money(num(first(r,'amount','total')))}</td>
        {kind === 'invoice' && <td>{money(num(first(r,'cashback','rewardAmount')))}</td>}<td>{statusPill(status)}{kind === 'topup' && num(first(r,'commissionSettlementAmount'))>0 && <small className="mw-table-secondary">{t.fundedSettlement}: {money(num(r.commissionSettlementAmount))}</small>}{kind === 'topup' && status === 'rejected' && str(first(r,'reason')) && <small className="mw-table-secondary">{t.rejectionReason}: {str(r.reason)}</small>}{kind === 'withdrawal' && transferProofId && <a className="mw-table-secondary" href={`/api/cashback/media/${encodeURIComponent(transferProofId)}`} target="_blank" rel="noreferrer">{t.transferReceipt}</a>}</td>
      </tr>;
    })}</tbody></table></div>;
  };
  const heading = (title:string, hint:string, action?:ReactNode) => <div className="mw-page-heading"><div><div className="mw-kicker"><span className="mw-status is-approved">{countryLabel(shop.country)}</span>{t.workspace}</div><h1>{title}</h1><p>{hint}</p></div>{action}</div>;
  const kpi = (label:string,value:string,sub:string,icon:ReactNode) => <div className="mw-kpi" data-testid={`kpi-${label.toLowerCase().replace(/\W+/g,'-')}`}><div className="mw-kpi-head"><span>{label}</span><i className="mw-kpi-icon">{icon}</i></div><strong>{value}</strong><small>{sub}</small></div>;
  const page = () => {
    if (!state || typeof state !== 'object') return <div className="mw-notice" role="alert">{t.loadError}</div>;
    if (currentPath === '/merchant') return <>
      {heading(t.welcome,t.overviewHint,<button className="mw-btn" onClick={() => { onRefresh(); setMessage(''); }} data-testid="button-refresh"><RefreshCw size={15}/>{t.refresh}</button>)}
      <div className="mw-grid mw-kpi-grid">
        {kpi(t.sales,money(invoiceSales),t.invoiceSales,<BadgeDollarSign size={16}/>)}
        {kpi(t.invoiceCount,String(claims.length),t.allStatuses,<ReceiptText size={16}/>)}
        {kpi(t.cashbackAwarded,money(cashbacks),t.earnedHint,<Gift size={16}/>)}
        {kpi(t.qrSpent,money(qrNet),t.net,<CircleDollarSign size={16}/>)}
        {kpi(t.withdrawableBalance,money(withdrawableBalance),`${t.qrBalance}: ${money(payoutBalance)}`,<Wallet size={16}/>)}
        {kpi(t.commissionDue,money(commissionDue),t.commissionOutstanding,<BadgeDollarSign size={16}/>)}
        {kpi(t.platformCommissionDue,money(platformCommissionDue),t.platformFee,<Percent size={16}/>)}
        {kpi(t.topupFunded,money(fundedTopups),t.fundedStatus,<ArrowDownToLine size={16}/>)}
        {kpi(t.withdrawalsPaid,money(withdrawals.filter(r=>statusOf(r)==='paid').reduce((s,r)=>s+num(r.amount),0)),t.paid,<ArrowUpRight size={16}/>)}
        {kpi(t.reservedWithdrawals,money(reservedWithdrawalBalance),t.transferring,<Clock3 size={16}/>)}
      {kpi(t.uniqueCustomers,String(customerStats.length),t.customers,<Users size={16}/>)}
      </div>
      <div className="mw-grid mw-overview-grid">
        <section className="mw-card"><div className="mw-card-head"><div><h2>{t.recentActivity}</h2><p>{t.noActivityHint}</p></div><button className="mw-link-button" onClick={()=>onNavigate('/merchant/invoices')}>{t.viewAll}</button></div>
          {recentRows.length ? <div className="mw-ledger">{recentRows.map((r,i)=>{const row=r as RecordLike;const kind=str(row.__kind);const title=kind==='qr'?t.QR:kind==='reward'?t.cashback:kind==='topup'?t.topups:kind==='withdrawal'?t.withdrawals:t.invoice;const customerId=str(first(row,'cid','customerId'));const customer=customerById.get(customerId);const detail=kind==='invoice'?str(first(row,'invoiceNumber'),str(customer?.name,customerId||t.customer)):str(first(row,'reference','payerReference','transferReference','method','customerName'),kind==='reward'||kind==='qr'?str(customer?.name,t.customer):t.reference);return <div className="mw-row" key={`${kind}-${str(row.id,String(i))}`}><div className="mw-row-main"><i className="mw-row-icon">{kind==='qr'?<CircleDollarSign size={17}/>:kind==='reward'?<Gift size={17}/>:kind==='topup'?<ArrowDownToLine size={17}/>:kind==='withdrawal'?<ArrowUpRight size={17}/>:<ReceiptText size={17}/>}</i><div className="mw-row-copy"><strong>{title} · {detail}</strong><small>{dateOf(row)}</small></div></div><div className="mw-row-value">{money(num(first(row,'amount','cashback')))}<small>{statusPill(statusOf(row))}</small></div></div>})}</div> : <Empty title={t.noActivity} hint={t.noActivityHint}/>}
        </section>
        <div className="mw-grid">
          <div className="mw-balance-card"><small>{t.wallet}</small><div className="mw-balance-split"><div><span>{t.qrBalance}</span><b>{money(payoutBalance)}</b></div><div><span>{t.funded}</span><b>{money(fundedBalance)}</b></div></div></div>
          <section className="mw-card"><div className="mw-card-head"><div><h2>{t.storeDetails}</h2><p>{countryLabel(shop.country)} · {str(shop.city)}</p></div><Store size={18}/></div><p>{str(first(shop,'description'),t.noStoreInfo)}</p><div className="mw-row"><div className="mw-row-main"><MapPin size={17}/><div className="mw-row-copy"><strong>{str(first(shop,'address'),t.storeLocation)}</strong><small>{str(first(shop,'phone'))}</small></div></div>{str(shop.mapsUrl) && <a href={str(shop.mapsUrl)} target="_blank" rel="noreferrer" className="mw-link-button">{t.openMap}</a>}</div></section>
        </div>
      </div>
    </>;
    if (currentPath === '/merchant/store') return <>
      {heading(t.store,t.storeDetails)}
      <div className="mw-grid">
        <form onSubmit={saveStore}>
        <section className="mw-card"><div className="mw-card-head"><h2>{t.storeDetails}</h2><Store size={18}/></div>
          <div className="mw-form-grid">
            <Field label={t.shopName}><input className="mw-input" value={form.name ?? str(shop.name)} onChange={e=>setForm({...form,name:e.target.value})} required maxLength={100} data-testid="input-store-name"/></Field>
            <Field label={t.phone}><input className="mw-input" value={form.phone ?? str(shop.phone)} onChange={e=>setForm({...form,phone:e.target.value})} data-testid="input-store-phone"/></Field>
            <Field label={t.address}><input className="mw-input" value={form.address ?? str(shop.address)} onChange={e=>setForm({...form,address:e.target.value})} data-testid="input-store-address"/></Field>
            <Field label={t.mapUrl}><input className="mw-input" value={form.mapsUrl ?? str(shop.mapsUrl)} onChange={e=>setForm({...form,mapsUrl:e.target.value})} data-testid="input-store-map"/></Field>
            <Field label={t.latitude}><input type="number" step="any" className="mw-input" value={form.lat ?? str(shop.lat)} onChange={e=>setForm({...form,lat:e.target.value})}/></Field>
            <Field label={t.longitude}><input type="number" step="any" className="mw-input" value={form.lng ?? str(shop.lng)} onChange={e=>setForm({...form,lng:e.target.value})}/></Field>
            <Field label={t.openingHours}><input className="mw-input" value={form.openingHours ?? str(shop.openingHours)} onChange={e=>setForm({...form,openingHours:e.target.value})}/></Field>
            <Field label={t.description} wide><textarea className="mw-textarea" value={form.description ?? str(shop.description)} onChange={e=>setForm({...form,description:e.target.value})}/></Field>
            <Field label={t.uploadLogo}><input type="file" accept="image/jpeg,image/png,image/webp" className="mw-file" onChange={e=>setLogo(e.target.files?.[0] ?? null)}/><small>{logo?.name}</small></Field>
            <Field label={t.uploadCover}><input type="file" accept="image/jpeg,image/png,image/webp" className="mw-file" onChange={e=>setCover(e.target.files?.[0] ?? null)}/><small>{cover?.name}</small></Field>
          </div>
          <div className="mw-card-actions"><button className="mw-btn mw-btn-primary" disabled={busy}>{busy ? t.loading : t.save}</button></div>
        </section>
        </form>
        <section className="mw-card"><div className="mw-card-head"><div><h2>{t.requestChange}</h2><p>{t.country} · {t.category} · {t.legalName}</p></div></div>
          <form className="mw-form-grid" onSubmit={submitChangeRequest}>
            <Field label={t.country}><select className="mw-select" value={form.country ?? ''} onChange={e=>setForm({...form,country:e.target.value})}><option value="">—</option><option value="Algeria">{t.algeria}</option><option value="Libya">{t.libya}</option></select></Field>
            <Field label={t.category}><select className="mw-select" value={form.category ?? ''} onChange={e=>setForm({...form,category:e.target.value})}><option value="">—</option>{Object.entries(categoryTranslationKey).map(([code,key])=><option value={code} key={code}>{t[key]}</option>)}</select></Field>
            <Field label={t.legalName}><input className="mw-input" value={form.legalName ?? ''} onChange={e=>setForm({...form,legalName:e.target.value})}/></Field>
            <Field label={t.registration}><input className="mw-input" value={form.registrationNumber ?? ''} onChange={e=>setForm({...form,registrationNumber:e.target.value})}/></Field>
            <Field label={t.tax}><input className="mw-input" value={form.taxNumber ?? ''} onChange={e=>setForm({...form,taxNumber:e.target.value})}/></Field>
            <button className="mw-btn mw-btn-primary" disabled={busy}>{t.submitRequest}</button>
          </form>
        </section>
        <section className="mw-card"><div className="mw-card-head"><div><h2>{t.sensitiveRequests}</h2><p>{t.requestedChanges}</p></div></div>
          {sensitiveRequests.length ? <div className="mw-ledger">{[...sensitiveRequests].reverse().map((request,index)=>{
            const changes = request.changes && typeof request.changes==='object' ? request.changes as RecordLike : {};
            const requestValue=(key:string)=>first(request,key) ?? first(changes,key);
            const keys = ['country','category','legalName','registrationNumber','taxNumber'].filter(key=>requestValue(key)!==undefined);
            return <div className="mw-row" key={str(request.id,String(index))}><div className="mw-row-copy"><strong>{str(first(request,'created','at'),t.requestedChanges)}</strong><small>{str(request.reason)}</small><div className="mw-change-values">{keys.map(key=><span key={key}><b>{sensitiveFieldLabel(key)}:</b> {sensitiveFieldValue(key,requestValue(key))}</span>)}</div></div>{statusPill(statusOf(request))}</div>;
          })}</div> : <Empty title={t.noSensitiveRequests} hint={t.noSensitiveRequests}/>}
        </section>
      </div>
    </>;
    if (currentPath === '/merchant/qr') return <>{heading(t.qr,t.qrHint)}<section className="mw-card">{qrPanel ?? <Empty title={t.noQr} hint={t.qrHint}/>}</section></>;
    if (currentPath === '/merchant/customers') return <>
      {heading(t.customers,t.customerHint)}
      {customerStats.length ? <div className="mw-table-wrap"><table className="mw-table"><thead><tr><th>{t.customer}</th><th>{t.phone}</th><th>{t.customerBalance}</th><th>{t.visits}</th><th>{t.lastPurchase}</th></tr></thead><tbody>{customerStats.map(({row,visits,balance,last},i)=><tr key={str(row.id,String(i))}><td>{str(row.name,t.unknown)}</td><td>{str(row.phone,'—')}</td><td>{money(balance)}</td><td>{visits}</td><td>{last ? dateOf({at:last}) : '—'}</td></tr>)}</tbody></table></div> : <Empty title={t.noCustomers} hint={t.customerHint}/>}
    </>;
    if (currentPath === '/merchant/wallet') return <>
      {heading(t.wallet,t.payoutHint)}
      <div className="mw-grid" style={{gridTemplateColumns:'repeat(auto-fit,minmax(min(100%,270px),1fr))'}}>
        <div className="mw-balance-card"><small>{t.funded}</small><strong>{money(fundedBalance)}</strong><p>{t.topupBalanceHint}</p><button className="mw-btn" onClick={()=>onNavigate('/merchant/topups')}>{t.requestTopup}</button></div>
        <div className="mw-balance-card"><small>{t.qrBalance}</small><strong>{money(payoutBalance)}</strong><p>{t.commissionDue}: {money(commissionDue)} · {t.platformCommissionDue}: {money(platformCommissionDue)}</p><div className="mw-balance-split"><div><span>{t.withdrawableBalance}</span><b>{money(withdrawableBalance)}</b></div><div><span>{t.reservedWithdrawals}</span><b>{money(reservedWithdrawalBalance)}</b></div></div><button className="mw-btn" onClick={()=>onNavigate('/merchant/withdrawals')}>{t.requestWithdrawal}</button></div>
      </div>
      <div style={{height:14}}/>
      <section className="mw-card"><div className="mw-card-head"><div><h2>{t.commissionLedger}</h2><p>{t.commissionLedgerHint}</p></div><Percent size={18}/></div>
        {commissionEntries.length?<div className="mw-table-wrap"><table className="mw-table"><thead><tr><th>{t.invoiceAmount}</th><th>{t.cashbackRate}</th><th>{t.platformCommissionRate}</th><th>{t.cashbackAwarded}</th><th>{t.platformFee}</th><th>{t.commissionTotal}</th><th>{t.commissionSettled}</th><th>{t.commissionOutstanding}</th><th>{t.netSale}</th></tr></thead><tbody>{commissionEntries.slice().sort((a,b)=>num(b.createdAt)-num(a.createdAt)).slice(0,50).map((entry,index)=><tr key={str(entry.id,String(index))}><td>{money(num(entry.invoiceAmount))}<small className="mw-table-secondary">{str(first(entry,'invoiceNumber','receiptId'))}</small></td><td>{num(entry.cashbackRate)}%</td><td>{num(entry.platformCommissionRate)}%</td><td>{money(num(entry.cashbackAmount))}</td><td>{money(num(entry.platformCommissionAmount))}</td><td>{money(num(entry.merchantObligationAmount))}</td><td>{money(num(entry.settledAmount))}</td><td>{money(num(entry.outstandingAmount))}</td><td>{money(num(entry.netSaleAmount))}</td></tr>)}</tbody></table></div>:<Empty title={t.noActivity} hint={t.commissionLedgerHint}/>}
      </section>
    </>;
    if (currentPath === '/merchant/topups') return <>
      {heading(t.topups,t.topupsHint)}
      <section className="mw-card"><div className="mw-card-head"><div><h2>{t.requestTopup}</h2><p>{t.topupBalanceHint}</p></div><ArrowDownToLine size={18}/></div>
        {!methods.length ? <div className="mw-banner">{t.noMethods}</div> : <form className="mw-form-grid" onSubmit={requestTopup}>
          <Field label={t.amountLabel}><input type="number" min={topupMinimum} max={topupMaximum} step="0.01" className="mw-input" value={form.amount ?? ''} onChange={e=>setForm({...form,amount:e.target.value})} required/><small>{t.topupMinimum}: {money(topupMinimum)} · {topupMaximum === undefined ? t.noMaximum : `${t.topupMaximumLabel}: ${money(topupMaximum)}`}</small></Field>
          <Field label={t.paymentMethod}><select className="mw-select" value={form.paymentMethodId ?? ''} onChange={e=>setForm({...form,paymentMethodId:e.target.value})} required><option value="">—</option>{methods.map(m=><option key={str(m.id)} value={str(m.id)}>{str(m.name)} · {countryLabel(m.country)}</option>)}</select></Field>
          {selectedMethod && <div className="mw-payment-instructions span-2">
            <div><span>{t.beneficiary}</span><strong>{str(selectedMethod.beneficiary,t.unknown)}</strong></div>
            <div><span>{t.account}</span><strong>{str(selectedMethod.account,t.unknown)}{selectedMethod.phone ? ` · ${str(selectedMethod.phone)}` : ''}</strong></div>
            <p><b>{t.instructions}</b> {str(selectedMethod.instructions,t.unknown)}</p>
          </div>}
          <Field label={t.payerReference}><input className="mw-input" value={form.payerReference ?? ''} onChange={e=>setForm({...form,payerReference:e.target.value})}/></Field>
          <Field label={t.proof}><input type="file" accept="image/jpeg,image/png,image/webp" className="mw-file" onChange={e=>setProof(e.target.files?.[0] ?? null)} required/><small>{proof?.name}</small></Field>
          <button className="mw-btn mw-btn-primary" disabled={busy || !methods.length}>{t.submit}</button>
        </form>}
      </section>
      <div style={{height:14}}/>
      {renderTable([...topups].reverse(),'topup')}
    </>;
    if (currentPath === '/merchant/withdrawals') return <>
      {heading(t.withdrawals,t.withdrawalsHint)}
      <section className="mw-card"><div className="mw-card-head"><div><h2>{t.requestWithdrawal}</h2><p>{t.payoutHint}</p></div><ArrowUpRight size={18}/></div>
        <form className="mw-form-grid" onSubmit={requestWithdrawal}>
          <Field label={t.amountLabel}><input type="number" min="0.01" max={withdrawableBalance} step="0.01" className="mw-input" value={form.amount ?? ''} onChange={e=>setForm({...form,amount:e.target.value})} required/><small>{t.withdrawableBalance}: {money(withdrawableBalance)}</small></Field>
          <Field label={t.method}><input className="mw-input" value={form.method ?? ''} onChange={e=>setForm({...form,method:e.target.value})} required/></Field>
          <Field label={t.accountDetails} wide><textarea className="mw-textarea" value={form.accountDetails ?? ''} onChange={e=>setForm({...form,accountDetails:e.target.value})} required minLength={3}/></Field>
          <button className="mw-btn mw-btn-primary" disabled={busy}>{t.submit}</button>
        </form>
      </section><div style={{height:14}}/>{renderTable([...withdrawals].reverse(),'withdrawal')}
    </>;
    if (currentPath === '/merchant/reports') return <>
      {heading(t.reportTitle,t.reportHint,<button className="mw-btn mw-btn-primary" onClick={exportCsv} data-testid="button-export-csv"><Download size={15}/>{t.exportCsv}</button>)}
      <div className="mw-grid mw-kpi-grid">{kpi(t.sales,money(invoiceSales),t.invoiceSales,<BadgeDollarSign size={16}/>)}{kpi(t.cashbackAwarded,money(cashbacks),t.earnedHint,<Gift size={16}/>)}{kpi(t.qrSpent,money(qrNet),t.net,<CircleDollarSign size={16}/>)}{kpi(t.uniqueCustomers,String(customerStats.length),t.customers,<Users size={16}/>)}</div>
      <section className="mw-card"><div className="mw-card-head"><div><h2>{t.recentActivity}</h2><p>{t.reportHint}</p></div></div>{renderTable([...approvedClaims].reverse(),'invoice')}</section>
    </>;
    if (currentPath === '/merchant/notifications') return <>
      {heading(t.notifications,t.recentActivity,<button className="mw-btn" onClick={notificationAction} disabled={markRead.isPending}><Check size={15}/>{t.readAll}</button>)}
      {notes.length ? <div className="mw-grid">{notes.map((note,i)=>{const copy=notificationCopy(note as any,lang);return <section className="mw-card" key={str(note.id,String(i))}><div className="mw-row-main"><i className="mw-row-icon"><Bell size={17}/></i><div className="mw-row-copy"><strong>{copy.title||t.notifications}</strong><small>{copy.body}</small><small>{dateOf(note)}</small></div><span className={`mw-status ${note.read ? '' : 'is-pending'}`}>{note.read ? t.read : t.unread}</span></div></section>})}</div> : <Empty title={t.noNotifications} hint={t.noNotifications}/>}
    </>;
    if (currentPath === '/merchant/settings') return <>
      {heading(t.settings,t.settingsHint)}
      <section className="mw-card"><div className="mw-settings-row"><div><strong>{t.appearance}</strong><small>{t.preferencesHint}</small></div><div className="mw-actions"><button className={`mw-btn ${theme==='dark'?'mw-btn-primary':''}`} onClick={()=>onThemeChange('dark')}><SunMoon size={15}/>{t.dark}</button><button className={`mw-btn ${theme==='light'?'mw-btn-primary':''}`} onClick={()=>onThemeChange('light')}>{t.light}</button></div></div>
        <div className="mw-settings-row"><div><strong>{t.language}</strong><small>{t.preferencesHint}</small></div><div className="mw-actions">{(['ar','en','fr'] as Lang[]).map(l=><button key={l} className={`mw-btn ${lang===l?'mw-btn-primary':''}`} onClick={()=>onLanguageChange(l)}>{t[l==='ar'?'arabic':l==='en'?'english':'french']}</button>)}</div></div>
      </section>
    </>;
    if (['/merchant/invoices','/merchant/rewards','/merchant/payments','/merchant/transfers'].includes(currentPath)) {
      const kind = currentPath === '/merchant/invoices' || currentPath === '/merchant/rewards' ? 'invoice' : currentPath === '/merchant/transfers' ? 'withdrawal' : 'qr';
      return <>
        {heading(currentTitle,currentPath === '/merchant/rewards' ? t.earnedHint : currentPath === '/merchant/payments' ? t.qrHint : currentPath === '/merchant/transfers' ? t.transfersHint : t.invoiceSales)}
        <div className="mw-toolbar"><div><input className="mw-input" placeholder={t.search} value={search} onChange={e=>setSearch(e.target.value)} aria-label={t.search}/><select className="mw-select" style={{width:'auto'}} value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">{t.all}</option>{['approved','pending','rejected','paid','transferring','funded'].map(s=><option value={s} key={s}>{formatStatus(s)}</option>)}</select></div>
          {currentPath === '/merchant/rewards' && <span className="mw-status is-approved">{money(cashbacks)} · {t.cashback}</span>}
          {currentPath === '/merchant/payments' && <span className="mw-status is-approved">{money(qrNet)} · {t.net}</span>}
        </div>
        {renderTable(filteredRecords,kind)}
      </>;
    }
    return <>{heading(t.overview,t.overviewHint)}<div className="mw-notice">{t.loadError}</div></>;
  };
  const mobilePaths = ['/merchant','/merchant/invoices','/merchant/customers','/merchant/wallet','/merchant/settings'];
  return <div className="merchant-workspace" data-theme={theme} dir={rtl?'rtl':'ltr'}>
    <div className={`mw-mobile-shade ${menuOpen?'is-open':''}`} onClick={()=>setMenuOpen(false)} aria-hidden="true"/>
    <div className="mw-shell">
      <aside className={`mw-sidebar ${menuOpen?'is-open':''}`}>
        <div className="mw-brand"><div className="mw-brand-mark">CB</div><div className="mw-brand-copy"><strong>CASH BACK</strong><small>{t.workspace}</small></div></div>
        <div className="mw-shop-chip"><div className="mw-shop-avatar">{str(shop.name,'C').slice(0,1)}</div><span><strong>{str(shop.name,t.store)}</strong><small>{str(shop.city, countryLabel(shop.country))}</small></span></div>
        <nav className="mw-nav" aria-label={t.workspace}>{navItems.map(({path,key,icon:Icon})=><button type="button" key={path} className={`mw-nav-item ${path===currentPath?'is-active':''}`} onClick={()=>{onNavigate(path);setMenuOpen(false)}} data-testid={`nav-${key}`}><Icon size={17}/><span>{t[key]}</span>{key==='notifications'&&unreadNotifications>0&&<i className="mw-nav-badge">{unreadNotifications>9?'9+':unreadNotifications}</i>}</button>)}</nav>
        <div className="mw-sidebar-foot">CASH BACK · {new Date().getFullYear()}</div>
      </aside>
      <div className="mw-main">
        <header className="mw-topbar"><div className="mw-topbar-left"><button className="mw-menu-button" onClick={()=>setMenuOpen(!menuOpen)} aria-label="Menu"><Menu size={18}/></button><div className="mw-topbar-title"><small>{str(shop.name)}</small><strong>{currentTitle}</strong></div></div><div className="mw-actions"><button className="mw-icon-button" title={t.refresh} onClick={onRefresh} data-testid="button-topbar-refresh"><RefreshCw size={16}/></button><button className="mw-icon-button" title={t.settings} onClick={()=>onNavigate('/merchant/settings')}><Settings size={16}/></button></div></header>
        <main className="mw-content" key={currentPath}>
          {busy && !message ? <div className="mw-loading-line" role="status"><span className="mw-skeleton"/>{t.loading}</div> : message ? <div className={/error|failed|could not|تعذر/i.test(message) ? 'mw-notice' : 'mw-banner'} role="status">{message}</div> : null}
          {page()}
        </main>
      </div>
    </div>
    <nav className="mw-mobile-nav" aria-label={t.workspace}>{mobilePaths.map(path=>{const item=navItems.find(n=>n.path===path)!;const Icon=item.icon;return <button key={path} className={currentPath===path?'is-active':''} onClick={()=>onNavigate(path)}><Icon/><span>{t[item.key]}</span></button>})}<button onClick={()=>setMenuOpen(true)}><Menu/><span>{t.more}</span></button></nav>
  </div>;
}

function Field({label,children,wide=false}:{label:string;children:ReactNode;wide?:boolean}) {
  return <label className={`mw-field ${wide?'span-2':''}`}><span>{label}</span>{children}</label>;
}
function Empty({title,hint}:{title:string;hint:string}) {
  return <div className="mw-empty"><Activity size={21}/><strong>{title}</strong><span>{hint}</span></div>;
}

export default MerchantWorkspace;
