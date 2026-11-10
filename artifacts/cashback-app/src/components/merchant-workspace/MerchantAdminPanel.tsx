import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  getGetCashbackSessionQueryKey, useCreateCashbackAdminWithdrawalProofUpload, useDecideCashbackMerchantStoreChange,
  useDecideCashbackMerchantTopup, useUpdateCashbackMerchantCommissionRates, useUpdateCashbackMerchantWithdrawal,
  useUpdateCashbackPaymentMethods,
} from '@workspace/api-client-react';
import { Check, ExternalLink, Percent, Plus, Save, Settings2, X } from 'lucide-react';
import './merchant-workspace.css';

type Lang = 'ar'|'en'|'fr';
type Row = Record<string, unknown>;
type PaymentMethod = {
  id:string; country:'Algeria'|'Libya'; name:string; beneficiary:string; account:string;
  phone?:string; instructions:string; active:boolean;
};
export type MerchantAdminPanelProps = {
  state: object;
  merchants: object[];
  lang: Lang;
  onRefresh: () => void;
};
const copy:Record<Lang,Record<string,string>> = {
  en:{
    title:'Merchant operations',hint:'Review the queues and keep merchant funding moving.',
    methods:'Top-up payment methods',methodsHint:'Configure the payment details merchants see when funding their wallet.',noMethods:'No payment methods configured.',
    commissionTitle:'Commissions and settlement',commissionHint:'Rates apply to future approved invoices. Customer cashback, platform fees, funded balance and QR proceeds remain separate.',customerRewardsIssued:'Customer rewards issued',customerRewardBalance:'Current customer reward balances',appCommission:'Platform commission',appCommissionSettled:'Commission collected',appCommissionDue:'Commission outstanding',merchantObligation:'Total merchant obligation',merchantObligationNote:'Total obligation equals the reward plus the platform fee; do not add this total to its components.',settled:'Settled',outstanding:'Outstanding',reward:'Customer reward',platformFee:'Platform fee',netSale:'Net sale',invoiceAmount:'Invoice amount',ledger:'Commission ledger',noLedger:'No approved invoices yet.',noActiveMerchants:'No active merchants yet.',rateOverrides:'Merchant-specific rates',rateOverridesHint:'Leave a field empty to inherit the program default.',cashbackRate:'Customer cashback rate (%)',platformCommissionRate:'Platform commission rate (%)',defaultRate:'Program default',saveRates:'Save rates',totalRateError:'Combined rates cannot exceed 100%.',ratesSaved:'Merchant rates saved.',fundedSettlement:'Top-ups applied to obligations',topupAvailable:'Available funded balance',qrProceeds:'QR proceeds balance',withdrawalAvailable:'Available to withdraw',withdrawalsPaid:'Withdrawals paid',withdrawalsReserved:'Withdrawals in settlement',
    maxDzd:'Maximum top-up (DZD)',maxLyd:'Maximum top-up (LYD)',unlimited:'Leave blank for no upper limit.',
    add:'Add method',save:'Save methods',saved:'Payment methods saved.',saveError:'Could not save these methods.',
    id:'Method ID',country:'Country',name:'Bank or payment method',beneficiary:'Beneficiary',account:'Account / IBAN / CCP',
    phone:'Phone (optional)',instructions:'Instructions',active:'Active',remove:'Remove',
    profiles:'Pending profile changes',profilesHint:'Review requested legal profile updates.',
    topups:'Pending top-ups',topupsHint:'Verify payment proof before approving funds.',
    withdrawals:'Withdrawal queue',withdrawalsHint:'Advance payouts through each review stage.',
    approve:'Approve',reject:'Reject',reason:'Reason for rejection (required)',reasonPlaceholder:'Explain why this request is rejected',
    reasonNeeded:'A rejection reason is required.',approved:'Approved.',rejected:'Rejected.',
    noProfiles:'No pending profile change requests.',noTopups:'No pending top-ups.',noWithdrawals:'No withdrawal requests.',
    merchant:'Merchant',requested:'Requested details',proof:'Payment proof',transferReceipt:'Transfer receipt',proofRequired:'Choose a transfer receipt image.',proofImageOnly:'Use a JPG, PNG, or WebP image up to 5 MB.',proofUploadFailed:'The receipt upload failed. Try again.',amount:'Amount',status:'Status',
    reference:'Transfer reference (required to mark paid)',advance:'Advance payout',markPaid:'Mark paid',
    transferring:'Mark transferring',review:'Review',unknown:'Unknown',method:'Payment method',
    error:'The action failed. Refresh and try again.',refresh:'Refresh',loading:'Saving…',openProof:'Open proof',
    algeria:'Algeria',libya:'Libya',pendingStatus:'Pending',approvedStatus:'Approved',rejectedStatus:'Rejected',
    transferringStatus:'Transferring',paidStatus:'Paid',fundedStatus:'Funded',doneStatus:'Completed',reviewedStatus:'Reviewed',
    countryField:'Country',categoryField:'Category',legalNameField:'Legal name',registrationField:'Registration number',taxField:'Tax number',
    catRestaurants:'Restaurants',catCafes:'Cafés',catClothing:'Clothing',catElectronics:'Electronics',catMalls:'Shopping centers',
    catGroceries:'Groceries',catPerfume:'Perfume',catGifts:'Gifts',catShops:'Other shops',catOther:'Other',
  },
  fr:{
    title:'Gestion des commerces',hint:'Traitez les demandes et suivez les paiements commerçants.',
    methods:'Modes de paiement des rechargements',methodsHint:'Configurez les coordonnées affichées aux commerces.',noMethods:'Aucun mode de paiement configuré.',
    commissionTitle:'Commissions et règlements',commissionHint:'Les taux s’appliquent aux prochaines factures approuvées. Les récompenses, commissions, fonds alimentés et recettes QR restent séparés.',customerRewardsIssued:'Récompenses accordées',customerRewardBalance:'Soldes actuels des clients',appCommission:'Commission de la plateforme',appCommissionSettled:'Commission encaissée',appCommissionDue:'Commission due',merchantObligation:'Obligation totale du commerce',merchantObligationNote:'Le total comprend la récompense et la commission ; ne l’ajoutez pas une seconde fois à ses composantes.',settled:'Réglé',outstanding:'Restant dû',reward:'Récompense client',platformFee:'Commission plateforme',netSale:'Vente nette',invoiceAmount:'Montant de la facture',ledger:'Registre des commissions',noLedger:'Aucune facture approuvée.',noActiveMerchants:'Aucun commerce actif.',rateOverrides:'Taux par commerce',rateOverridesHint:'Laissez un champ vide pour utiliser le taux par défaut.',cashbackRate:'Taux de récompense client (%)',platformCommissionRate:'Commission plateforme (%)',defaultRate:'Taux par défaut',saveRates:'Enregistrer les taux',totalRateError:'La somme des taux ne peut pas dépasser 100%.',ratesSaved:'Taux du commerce enregistrés.',fundedSettlement:'Rechargements affectés aux obligations',topupAvailable:'Solde alimenté disponible',qrProceeds:'Solde des recettes QR',withdrawalAvailable:'Montant retirable',withdrawalsPaid:'Retraits payés',withdrawalsReserved:'Retraits en règlement',
    maxDzd:'Plafond de recharge (DZD)',maxLyd:'Plafond de recharge (LYD)',unlimited:'Laisser vide pour ne pas fixer de plafond.',
    add:'Ajouter',save:'Enregistrer les modes',saved:'Modes de paiement enregistrés.',saveError:'Impossible d’enregistrer.',
    id:'Identifiant',country:'Pays',name:'Banque ou moyen de paiement',beneficiary:'Bénéficiaire',account:'Compte / IBAN / CCP',
    phone:'Téléphone (facultatif)',instructions:'Instructions',active:'Actif',remove:'Supprimer',
    profiles:'Modifications de profil en attente',profilesHint:'Examinez les changements légaux demandés.',
    topups:'Rechargements en attente',topupsHint:'Vérifiez la preuve avant d’approuver les fonds.',
    withdrawals:'Demandes de retrait',withdrawalsHint:'Faites progresser les paiements à chaque étape.',
    approve:'Approuver',reject:'Refuser',reason:'Motif du refus (obligatoire)',reasonPlaceholder:'Expliquez le refus',
    reasonNeeded:'Un motif de refus est obligatoire.',approved:'Demande approuvée.',rejected:'Demande refusée.',
    noProfiles:'Aucune modification en attente.',noTopups:'Aucun rechargement en attente.',noWithdrawals:'Aucun retrait.',
    merchant:'Commerce',requested:'Détails demandés',proof:'Justificatif',transferReceipt:'Justificatif de virement',proofRequired:'Choisissez une image du justificatif de virement.',proofImageOnly:'Utilisez une image JPG, PNG ou WebP de 5 Mo maximum.',proofUploadFailed:'Échec du téléversement. Réessayez.',amount:'Montant',status:'Statut',
    reference:'Référence de virement (obligatoire pour payer)',advance:'Faire avancer',markPaid:'Marquer payé',
    transferring:'Marquer en transfert',review:'Vérifier',unknown:'Inconnu',method:'Mode de paiement',
    error:'Échec de l’action. Actualisez et réessayez.',refresh:'Actualiser',loading:'Enregistrement…',openProof:'Ouvrir la preuve',
    algeria:'Algérie',libya:'Libye',pendingStatus:'En attente',approvedStatus:'Approuvé',rejectedStatus:'Refusé',
    transferringStatus:'En transfert',paidStatus:'Payé',fundedStatus:'Financé',doneStatus:'Terminé',reviewedStatus:'Examiné',
    countryField:'Pays',categoryField:'Catégorie',legalNameField:'Raison sociale',registrationField:'Numéro d’enregistrement',taxField:'Numéro fiscal',
    catRestaurants:'Restaurants',catCafes:'Cafés',catClothing:'Vêtements',catElectronics:'Électronique',catMalls:'Centres commerciaux',
    catGroceries:'Épicerie',catPerfume:'Parfumerie',catGifts:'Cadeaux',catShops:'Autres commerces',catOther:'Autre',
  },
  ar:{
    title:'إدارة التجار',hint:'راجع الطلبات وتابع عمليات تمويل التجار.',
    methods:'وسائل دفع التمويل',methodsHint:'أدر تفاصيل الدفع التي تظهر للتاجر عند تمويل محفظته.',noMethods:'لم تتم إضافة وسائل دفع بعد.',
    commissionTitle:'العمولات والتسوية',commissionHint:'تُطبق النسب على الفواتير المقبولة لاحقاً. مكافآت الزبائن وعمولات التطبيق والرصيد الممول وعائدات QR حسابات منفصلة.',customerRewardsIssued:'مكافآت الزبائن الممنوحة',customerRewardBalance:'أرصدة الزبائن الحالية',appCommission:'عمولة التطبيق',appCommissionSettled:'العمولة المحصلة',appCommissionDue:'العمولة المستحقة',merchantObligation:'إجمالي التزام التاجر',merchantObligationNote:'الإجمالي يساوي المكافأة مضافاً إليها العمولة؛ لا تجمعه مرة ثانية مع مكوناته.',settled:'تمت تسويته',outstanding:'مستحق',reward:'مكافأة الزبون',platformFee:'عمولة التطبيق',netSale:'صافي البيع',invoiceAmount:'قيمة الفاتورة',ledger:'سجل العمولات',noLedger:'لا توجد فواتير مقبولة بعد.',noActiveMerchants:'لا توجد متاجر نشطة بعد.',rateOverrides:'نسب خاصة بالتجار',rateOverridesHint:'اترك الخانة فارغة لاستخدام النسبة الافتراضية.',cashbackRate:'مكافأة الزبون (%)',platformCommissionRate:'عمولة التطبيق (%)',defaultRate:'النسبة الافتراضية',saveRates:'حفظ النسب',totalRateError:'مجموع النسب لا يمكن أن يتجاوز 100%.',ratesSaved:'تم حفظ نسب التاجر.',fundedSettlement:'التمويل المخصص لتسوية الالتزامات',topupAvailable:'الرصيد الممول المتاح',qrProceeds:'رصيد عائدات QR',withdrawalAvailable:'الرصيد القابل للسحب',withdrawalsPaid:'السحوبات المنفذة',withdrawalsReserved:'السحوبات قيد التسوية',
    maxDzd:'الحد الأقصى للشحن (دج)',maxLyd:'الحد الأقصى للشحن (د.ل)',unlimited:'اتركه فارغاً لعدم تحديد سقف أعلى.',
    add:'إضافة وسيلة',save:'حفظ وسائل الدفع',saved:'تم حفظ وسائل الدفع.',saveError:'تعذر حفظ وسائل الدفع.',
    id:'معرّف الوسيلة',country:'الدولة',name:'البنك أو وسيلة الدفع',beneficiary:'المستفيد',account:'رقم الحساب أو IBAN أو CCP',
    phone:'الهاتف (اختياري)',instructions:'التعليمات',active:'نشط',remove:'حذف',
    profiles:'طلبات تعديل بيانات المتجر',profilesHint:'راجع التعديلات القانونية المطلوبة.',
    topups:'طلبات التمويل المعلقة',topupsHint:'تحقق من إثبات الدفع قبل قبول التمويل.',
    withdrawals:'طلبات السحب',withdrawalsHint:'تابع طلبات الدفع في مراحل المراجعة.',
    approve:'موافقة',reject:'رفض',reason:'سبب الرفض (مطلوب)',reasonPlaceholder:'وضح سبب رفض الطلب',
    reasonNeeded:'سبب الرفض مطلوب.',approved:'تمت الموافقة.',rejected:'تم الرفض.',
    noProfiles:'لا توجد طلبات تعديل معلقة.',noTopups:'لا توجد طلبات تمويل معلقة.',noWithdrawals:'لا توجد طلبات سحب.',
    merchant:'التاجر',requested:'التفاصيل المطلوبة',proof:'إثبات الدفع',transferReceipt:'وصل التحويل',proofRequired:'اختر صورة وصل التحويل.',proofImageOnly:'استخدم صورة JPG أو PNG أو WebP بحجم لا يتجاوز 5 ميغابايت.',proofUploadFailed:'تعذر رفع الوصل. حاول مجدداً.',amount:'المبلغ',status:'الحالة',
    reference:'مرجع التحويل (مطلوب لإتمام الدفع)',advance:'تحديث حالة السحب',markPaid:'تحديد كمدفوع',
    transferring:'بدء التحويل',review:'مراجعة',unknown:'غير معروف',method:'وسيلة الدفع',
    error:'تعذر تنفيذ الإجراء. حدّث الصفحة وحاول مجدداً.',refresh:'تحديث',loading:'جارٍ الحفظ…',openProof:'فتح الإثبات',
    algeria:'الجزائر',libya:'ليبيا',pendingStatus:'قيد المراجعة',approvedStatus:'مقبول',rejectedStatus:'مرفوض',
    transferringStatus:'قيد التحويل',paidStatus:'مدفوع',fundedStatus:'تم التمويل',doneStatus:'مكتمل',reviewedStatus:'تمت المراجعة',
    countryField:'الدولة',categoryField:'الفئة',legalNameField:'الاسم القانوني',registrationField:'رقم التسجيل',taxField:'الرقم الضريبي',
    catRestaurants:'مطاعم',catCafes:'مقاهٍ',catClothing:'ملابس',catElectronics:'إلكترونيات',catMalls:'مراكز تجارية',
    catGroceries:'مواد غذائية',catPerfume:'عطور',catGifts:'هدايا',catShops:'محلات أخرى',catOther:'أخرى',
  },
};
const rows = (v:unknown):Row[] => Array.isArray(v) ? v.filter((r):r is Row => !!r && typeof r==='object') : [];
const text = (v:unknown,fallback='') => typeof v==='string'||typeof v==='number' ? String(v) : fallback;
const value = (r:Row,...keys:string[]) => keys.map(k=>r[k]).find(v=>v!==null&&v!==undefined);
const stateOf = (r:Row) => text(value(r,'status','state'),'pending').toLowerCase();
const amountOf = (r:Row) => Number(value(r,'amount') ?? 0);
const categoryKeys:Record<string,string> = {
  restaurants:'catRestaurants',cafes:'catCafes',clothing:'catClothing',electronics:'catElectronics',
  malls:'catMalls',groceries:'catGroceries',perfume:'catPerfume',gifts:'catGifts',shops:'catShops',other:'catOther',
};
const normalizeCountry = (v:unknown):'Algeria'|'Libya'|'' => {
  const country=text(v).trim().toLowerCase();
  if(['algeria','dz','الجزائر','algérie'].includes(country)) return 'Algeria';
  if(['libya','ly','ليبيا','libye'].includes(country)) return 'Libya';
  return '';
};

export function MerchantAdminPanel({state,merchants,lang,onRefresh}:MerchantAdminPanelProps) {
  const t = copy[lang];
  const rtl = lang === 'ar';
  const stateRecord = state as Row;
  const merchantRows = merchants as Row[];
  const client = useQueryClient();
  const decideProfile = useDecideCashbackMerchantStoreChange();
  const decideTopup = useDecideCashbackMerchantTopup();
  const updateWithdrawal = useUpdateCashbackMerchantWithdrawal();
  const createWithdrawalProofUpload = useCreateCashbackAdminWithdrawalProofUpload();
  const updateCommissionRates = useUpdateCashbackMerchantCommissionRates();
  const saveMethods = useUpdateCashbackPaymentMethods();
  const [methods,setMethods] = useState<PaymentMethod[]>([]);
  const [reasons,setReasons] = useState<Record<string,string>>({});
  const [references,setReferences] = useState<Record<string,string>>({});
  const [proofFiles,setProofFiles] = useState<Record<string,File>>({});
  const [commissionRateOverrides,setCommissionRateOverrides] = useState<Record<string,{cashback:string;platformCommission:string}>>({});
  const [message,setMessage] = useState('');
  const [busy,setBusy] = useState(false);
  const [maxTopupAmountDzd,setMaxTopupAmountDzd] = useState('');
  const [maxTopupAmountLyd,setMaxTopupAmountLyd] = useState('');
  const settings = stateRecord.settings && typeof stateRecord.settings==='object' ? stateRecord.settings as Row : {};
  const globalCashbackRate = Number(value(settings,'cashback') ?? 4);
  const globalPlatformCommissionRate = Number(value(settings,'platformCommission') ?? 2);
  const commissionLedger = rows(value(stateRecord,'merchantCommissionLedger'));
  const commissionSettlements = rows(value(stateRecord,'merchantCommissionSettlements'));
  const rateSignature = merchantRows.map(merchant=>`${text(merchant.id)}:${text(merchant.cashbackRate)}:${text(merchant.platformCommissionRate)}`).join('|');
  const serverMethods = rows(settings.paymentMethods) as PaymentMethod[];
  useEffect(()=>{
    setCommissionRateOverrides(Object.fromEntries(merchantRows.map(merchant=>[
      text(merchant.id),
      {cashback:merchant.cashbackRate==null?'':text(merchant.cashbackRate),platformCommission:merchant.platformCommissionRate==null?'':text(merchant.platformCommissionRate)},
    ])));
  },[rateSignature]);
  useEffect(()=>{
    setMethods(serverMethods.map(m=>({...m})));
    setMaxTopupAmountDzd(value(settings,'maxTopupAmountDzd') == null ? '' : text(settings.maxTopupAmountDzd));
    setMaxTopupAmountLyd(value(settings,'maxTopupAmountLyd') == null ? '' : text(settings.maxTopupAmountLyd));
  },[stateRecord]);
  const storeChanges = rows(value(stateRecord,'merchantStoreChangeRequests','storeChangeRequests')).filter(r=>stateOf(r)==='pending');
  const topups = rows(value(stateRecord,'merchantTopups','topups')).filter(r=>stateOf(r)==='pending');
  const withdrawals = rows(value(stateRecord,'merchantWithdrawals','withdrawals')).filter(r=>!['paid','rejected'].includes(stateOf(r)));
  const activeMerchants = merchantRows.filter(merchant=>stateOf(merchant)==='active');
  const sumField=(list:Row[],field:string)=>list.reduce((sum,row)=>sum+Number(value(row,field)??0),0);
  const customers=rows(value(stateRecord,'customers'));
  const allWithdrawals=rows(value(stateRecord,'merchantWithdrawals','withdrawals'));
  const currencyTotals=[{currency:'DZD',country:'Algeria'},{currency:'LYD',country:'Libya'}].map(({currency,country})=>{
    const merchantIds=new Set(merchantRows.filter(merchant=>normalizeCountry(value(merchant,'country'))===country).map(merchant=>text(merchant.id)));
    const ledger=commissionLedger.filter(entry=>merchantIds.has(text(entry.merchantId)));
    const settlements=commissionSettlements.filter(entry=>merchantIds.has(text(entry.merchantId)));
    const currencyWithdrawals=allWithdrawals.filter(entry=>merchantIds.has(text(entry.merchantId)));
    const customerRewardBalance=customers.reduce((total,customer)=>{
      const balances=customer.cbm&&typeof customer.cbm==='object'?customer.cbm as Record<string,unknown>:{};
      return total+[...merchantIds].reduce((sum,id)=>sum+Number(balances[id]??0),0);
    },0);
    return {
      currency,ledger,customerRewardBalance,
      rewardsIssued:sumField(ledger,'cashbackAmount'),
      appCommission:sumField(ledger,'platformCommissionAmount'),
      appCommissionSettled:sumField(ledger,'settledPlatformCommission'),
      appCommissionDue:sumField(ledger,'platformCommissionOutstanding'),
      merchantObligation:sumField(ledger,'merchantObligationAmount'),
      merchantObligationDue:sumField(ledger,'outstandingAmount'),
      topupAvailable:merchantRows.filter(merchant=>merchantIds.has(text(merchant.id))).reduce((sum,merchant)=>sum+Number(value(merchant,'topupBalance')??0),0),
      qrProceeds:merchantRows.filter(merchant=>merchantIds.has(text(merchant.id))).reduce((sum,merchant)=>sum+Number(value(merchant,'payoutBalance')??0),0),
      withdrawalAvailable:merchantRows.filter(merchant=>merchantIds.has(text(merchant.id))).reduce((sum,merchant)=>{
        const due=ledger.filter(entry=>text(entry.merchantId)===text(merchant.id)).reduce((subtotal,entry)=>subtotal+Number(value(entry,'outstandingAmount')??0),0);
        return sum+Math.max(0,Number(value(merchant,'payoutBalance')??0)-due);
      },0),
      topupSettled:sumField(settlements,'amount'),
      withdrawalsReserved:merchantRows.filter(merchant=>merchantIds.has(text(merchant.id))).reduce((sum,merchant)=>sum+Number(value(merchant,'reservedWithdrawalBalance')??0),0),
      withdrawalsPaid:currencyWithdrawals.filter(entry=>stateOf(entry)==='paid').reduce((sum,entry)=>sum+amountOf(entry),0),
    };
  });
  const formatCurrency=(amount:number,currency:string)=>new Intl.NumberFormat(lang==='ar'?'ar-DZ':lang==='fr'?'fr-FR':'en',{style:'currency',currency}).format(amount);
  const statusLabel=(status:string) => {
    const key:Record<string,string> = {
      pending:'pendingStatus',submitted:'pendingStatus',approved:'approvedStatus',accepted:'approvedStatus',
      rejected:'rejectedStatus',declined:'rejectedStatus',transferring:'transferringStatus',
      paid:'paidStatus',funded:'fundedStatus',done:'doneStatus',complete:'doneStatus',completed:'doneStatus',
      due:'outstanding',partially_settled:'outstanding',settled:'settled',
      reviewed:'reviewedStatus',in_review:'pendingStatus',under_review:'pendingStatus',
    };
    return t[key[status.toLowerCase().replace(/[\s-]+/g,'_')] ?? 'unknown'];
  };
  const countryLabel=(value:unknown) => {
    const country=normalizeCountry(value);
    return country==='Algeria'?t.algeria:country==='Libya'?t.libya:t.unknown;
  };
  const fieldLabel=(key:string) => ({
    country:t.countryField,category:t.categoryField,legalName:t.legalNameField,
    registrationNumber:t.registrationField,taxNumber:t.taxField,
  }[key] ?? t.unknown);
  const fieldValue=(key:string,val:unknown) => key==='country'?countryLabel(val):key==='category'?t[categoryKeys[text(val).toLowerCase()]??'unknown']:text(val,t.unknown);
  const merchantCountry=(r:Row) => {
    const id=text(value(r,'merchantId','mid'));
    return normalizeCountry(value(r,'country')) || normalizeCountry(merchantRows.find(m=>text(m.id)===id)?.country);
  };
  const formatAmount=(r:Row) => {
    const currency=merchantCountry(r)==='Libya'?'LYD':'DZD';
    return new Intl.NumberFormat(lang==='ar'?'ar':lang==='fr'?'fr-FR':'en',{style:'currency',currency,maximumFractionDigits:2}).format(amountOf(r));
  };
  const dateLabel=(r:Row) => {
    const raw=value(r,'createdAt','created','date');
    const date=typeof raw==='number'?new Date(raw):new Date(text(raw));
    return Number.isNaN(date.getTime())?t.unknown:date.toLocaleString(lang==='ar'?'ar-DZ':lang==='fr'?'fr-FR':'en');
  };
  const persist = () => { void client.invalidateQueries({queryKey:getGetCashbackSessionQueryKey()}); onRefresh(); };
  const saveCommissionRates = async (merchant:Row) => {
    const id=text(merchant.id);
    const override=commissionRateOverrides[id]??{
      cashback:merchant.cashbackRate==null?'':text(merchant.cashbackRate),
      platformCommission:merchant.platformCommissionRate==null?'':text(merchant.platformCommissionRate),
    };
    const cashbackRate=override.cashback.trim()===''?null:Number(override.cashback);
    const platformCommissionRate=override.platformCommission.trim()===''?null:Number(override.platformCommission);
    const effectiveCashback=cashbackRate??globalCashbackRate;
    const effectiveCommission=platformCommissionRate??globalPlatformCommissionRate;
    if((cashbackRate!==null&&(!Number.isFinite(cashbackRate)||cashbackRate<0||cashbackRate>100))||
      (platformCommissionRate!==null&&(!Number.isFinite(platformCommissionRate)||platformCommissionRate<0||platformCommissionRate>100))){
      setMessage(t.totalRateError);return;
    }
    if(effectiveCashback+effectiveCommission>100){setMessage(t.totalRateError);return}
    setBusy(true);setMessage('');
    try{
      await updateCommissionRates.mutateAsync({id,data:{cashbackRate,platformCommissionRate}});
      setCommissionRateOverrides(current=>({...current,[id]:{cashback:cashbackRate===null?'':String(cashbackRate),platformCommission:platformCommissionRate===null?'':String(platformCommissionRate)}}));
      persist();setMessage(t.ratesSaved);
    }catch{setMessage(t.error)}finally{setBusy(false)}
  };
  const changeMethod = (index:number,key:keyof PaymentMethod,val:string|boolean) => setMethods(existing=>existing.map((m,i)=>i===index?{...m,[key]:val}:m));
  const savePaymentMethods = async (event:FormEvent) => {
    event.preventDefault(); setBusy(true);setMessage('');
    try {
      await saveMethods.mutateAsync({data:{
        methods,
        maxTopupAmountDzd:maxTopupAmountDzd.trim() ? Number(maxTopupAmountDzd) : null,
        maxTopupAmountLyd:maxTopupAmountLyd.trim() ? Number(maxTopupAmountLyd) : null,
      }});
      persist();setMessage(t.saved);
    } catch { setMessage(t.saveError); } finally { setBusy(false); }
  };
  const decide = async (kind:'profile'|'topup',r:Row,approved:boolean) => {
    const id=text(r.id);
    const reason=(reasons[id] ?? '').trim();
    if(!approved&&!reason){setMessage(t.reasonNeeded);return}
    setBusy(true);setMessage('');
    try {
      if(kind==='profile') await decideProfile.mutateAsync({id,data:{approved,reason:approved?undefined:reason}});
      else await decideTopup.mutateAsync({id,data:{approved,reason:approved?undefined:reason}});
      persist();setMessage(approved?t.approved:t.rejected);
      setReasons(prev=>({...prev,[id]:''}));
    } catch {setMessage(t.error)} finally {setBusy(false)}
  };
  const updatePayout = async (r:Row,status:'approved'|'transferring'|'paid'|'rejected') => {
    const id=text(r.id);
    const reason=(reasons[id]??'').trim();
    const transferReference=(references[id]??'').trim();
    const proofFile=proofFiles[id];
    if(status==='rejected'&&!reason){setMessage(t.reasonNeeded);return}
    if(status==='paid'&&!transferReference){setMessage(t.reference);return}
    if(status==='paid'&&!proofFile){setMessage(t.proofRequired);return}
    if(status==='paid'&&(!['image/jpeg','image/png','image/webp'].includes(proofFile.type)||proofFile.size<1||proofFile.size>5*1024*1024)){setMessage(t.proofImageOnly);return}
    setBusy(true);setMessage('');
    try {
      let proofFields:{transferProofUploadId:string;transferProofObjectPath:string}|undefined;
      if(status==='paid'&&proofFile){
        const upload=await createWithdrawalProofUpload.mutateAsync({id,data:{
          contentType:proofFile.type as 'image/jpeg'|'image/png'|'image/webp',
          size:proofFile.size,
        }});
        const uploaded=await fetch(upload.uploadURL,{method:'PUT',headers:{'Content-Type':proofFile.type},body:proofFile});
        if(!uploaded.ok) throw new Error(t.proofUploadFailed);
        proofFields={transferProofUploadId:upload.uploadId,transferProofObjectPath:upload.objectPath};
      }
      await updateWithdrawal.mutateAsync({id,data:{status,...(status==='rejected'?{reason}:{}),...(status==='paid'?{transferReference,...proofFields}:{})}});
      persist();setMessage(status==='rejected'?t.rejected:t.approved);
      setReasons(prev=>({...prev,[id]:''}));
      setProofFiles(prev=>{const next={...prev};delete next[id];return next});
    } catch (error) {setMessage(error instanceof Error&&error.message===t.proofUploadFailed?t.proofUploadFailed:t.error)} finally {setBusy(false)}
  };
  const merchantName=(r:Row) => {
    const id=text(value(r,'merchantId','mid'));
    return text(value(r,'merchantName','name')) || text(merchantRows.find(m=>text(m.id)===id)?.name,t.unknown);
  };
  const rejectionField=(r:Row) => <input className="mw-input mw-reason" aria-label={t.reason} placeholder={t.reasonPlaceholder} value={reasons[text(r.id)]??''} onChange={e=>setReasons({...reasons,[text(r.id)]:e.target.value})}/>;
  const queueActions=(kind:'profile'|'topup',r:Row) => <div className="mw-card-actions">{rejectionField(r)}<button className="mw-btn mw-btn-primary" onClick={()=>void decide(kind,r,true)} disabled={busy}><Check size={14}/>{t.approve}</button><button className="mw-btn mw-btn-danger" onClick={()=>void decide(kind,r,false)} disabled={busy}><X size={14}/>{t.reject}</button></div>;
  const section=(title:string,hint:string,content:ReactNode)=><section className="mw-card"><div className="mw-card-head"><div><h2>{title}</h2><p>{hint}</p></div></div>{content}</section>;
  const empty=(textValue:string)=><div className="mw-empty"><Settings2 size={20}/><strong>{textValue}</strong></div>;
  return <div className="merchant-workspace" data-theme="dark" dir={rtl?'rtl':'ltr'}>
    <div className="mw-content">
      <div className="mw-page-heading"><div><div className="mw-kicker">{t.title}</div><h1>{t.title}</h1><p>{t.hint}</p></div><button className="mw-btn" onClick={onRefresh}>{t.refresh}</button></div>
      {busy&&!message?<div className="mw-loading-line" role="status"><span className="mw-skeleton"/>{t.loading}</div>:message?<div className={message===t.error||message===t.reasonNeeded||message===t.saveError?'mw-notice':'mw-banner'} role="status">{message}</div>:null}
      <div className="mw-admin-grid">
        {section(t.commissionTitle,t.commissionHint,<div className="mw-grid">
          <div className="mw-grid" style={{gridTemplateColumns:'repeat(auto-fit,minmax(min(100%,300px),1fr))'}}>
            {currencyTotals.map(summary=><article className="mw-card" key={summary.currency}>
              <div className="mw-card-head"><h3>{summary.currency}</h3><Percent size={18}/></div>
              <div className="mw-balance-split">
                <div><span>{t.customerRewardsIssued}</span><b>{formatCurrency(summary.rewardsIssued,summary.currency)}</b></div>
                <div><span>{t.customerRewardBalance}</span><b>{formatCurrency(summary.customerRewardBalance,summary.currency)}</b></div>
                <div><span>{t.appCommission}</span><b>{formatCurrency(summary.appCommission,summary.currency)}</b></div>
                <div><span>{t.appCommissionSettled}</span><b>{formatCurrency(summary.appCommissionSettled,summary.currency)}</b></div>
                <div><span>{t.appCommissionDue}</span><b>{formatCurrency(summary.appCommissionDue,summary.currency)}</b></div>
                <div><span>{t.merchantObligation}</span><b>{formatCurrency(summary.merchantObligation,summary.currency)}</b></div>
                <div><span>{t.outstanding} · {t.merchantObligation}</span><b>{formatCurrency(summary.merchantObligationDue,summary.currency)}</b></div>
                <div><span>{t.fundedSettlement}</span><b>{formatCurrency(summary.topupSettled,summary.currency)}</b></div>
                <div><span>{t.topupAvailable}</span><b>{formatCurrency(summary.topupAvailable,summary.currency)}</b></div>
                <div><span>{t.qrProceeds}</span><b>{formatCurrency(summary.qrProceeds,summary.currency)}</b></div>
                <div><span>{t.withdrawalAvailable}</span><b>{formatCurrency(summary.withdrawalAvailable,summary.currency)}</b></div>
                <div><span>{t.withdrawalsReserved}</span><b>{formatCurrency(summary.withdrawalsReserved,summary.currency)}</b></div>
                <div><span>{t.withdrawalsPaid}</span><b>{formatCurrency(summary.withdrawalsPaid,summary.currency)}</b></div>
              </div>
            </article>)}
          </div>
          <p className="mw-banner">{t.merchantObligationNote}</p>
          <div>
            <div className="mw-card-head"><div><h3>{t.rateOverrides}</h3><p>{t.rateOverridesHint} {t.defaultRate}: {globalCashbackRate}% + {globalPlatformCommissionRate}%</p></div></div>
            {activeMerchants.length?<div className="mw-grid">{activeMerchants.map(merchant=>{
              const id=text(merchant.id);
              const override=commissionRateOverrides[id]??{cashback:merchant.cashbackRate==null?'':text(merchant.cashbackRate),platformCommission:merchant.platformCommissionRate==null?'':text(merchant.platformCommissionRate)};
              return <article className="mw-card" key={id}>
                <div className="mw-row"><div className="mw-row-copy"><strong>{text(merchant.name,t.unknown)}</strong><small>{countryLabel(value(merchant,'country'))} · {id}</small></div><Percent size={17}/></div>
                <div className="mw-form-grid">
                  <label className="mw-field"><span>{t.cashbackRate} · {t.defaultRate} {globalCashbackRate}%</span><input type="number" min="0" max="100" step="0.1" className="mw-input" value={override.cashback} onChange={e=>setCommissionRateOverrides(current=>({...current,[id]:{...override,cashback:e.target.value}}))} data-testid={`input-cashback-rate-${id}`}/></label>
                  <label className="mw-field"><span>{t.platformCommissionRate} · {t.defaultRate} {globalPlatformCommissionRate}%</span><input type="number" min="0" max="100" step="0.1" className="mw-input" value={override.platformCommission} onChange={e=>setCommissionRateOverrides(current=>({...current,[id]:{...override,platformCommission:e.target.value}}))} data-testid={`input-platform-rate-${id}`}/></label>
                  <button type="button" className="mw-btn mw-btn-primary" onClick={()=>void saveCommissionRates(merchant)} disabled={busy}>{t.saveRates}</button>
                </div>
              </article>;
            })}</div>:empty(t.noActiveMerchants)}
          </div>
          <div>
            <div className="mw-card-head"><div><h3>{t.ledger}</h3><p>{t.merchantObligationNote}</p></div></div>
            {commissionLedger.length?<div className="mw-table-wrap"><table className="mw-table">
              <thead><tr><th>{t.merchant}</th><th>{t.invoiceAmount}</th><th>{t.reward}</th><th>{t.platformFee}</th><th>{t.merchantObligation}</th><th>{t.settled}</th><th>{t.outstanding}</th><th>{t.status}</th></tr></thead>
              <tbody>{commissionLedger.slice().sort((a,b)=>Number(b.createdAt??0)-Number(a.createdAt??0)).slice(0,40).map((entry,index)=>{
                const currency=text(value(entry,'currency'),'DZD');
                const invoiceValue=Number(value(entry,'invoiceAmount')??0);
                const amount=(field:string)=>formatCurrency(Number(value(entry,field)??0),currency);
                return <tr key={text(entry.id,String(index))}>
                  <td>{merchantName(entry)}<small className="mw-table-secondary">{text(value(entry,'invoiceNumber','receiptId'))}</small></td>
                  <td>{formatCurrency(invoiceValue,currency)}</td><td>{amount('cashbackAmount')}</td><td>{amount('platformCommissionAmount')}</td>
                  <td>{amount('merchantObligationAmount')}<small className="mw-table-secondary">{t.netSale}: {amount('netSaleAmount')}</small></td>
                  <td>{amount('settledAmount')}</td><td>{amount('outstandingAmount')}</td><td>{statusLabel(stateOf(entry))}</td>
                </tr>;
              })}</tbody>
            </table></div>:empty(t.noLedger)}
          </div>
        </div>)}
        {section(t.methods,t.methodsHint,<form onSubmit={savePaymentMethods}>
          {methods.length===0&&empty(t.noMethods)}
          <div className="mw-form-grid mw-limit-grid">
            <label className="mw-field"><span>{t.maxDzd}</span><input type="number" min="1000" step="0.01" className="mw-input" value={maxTopupAmountDzd} onChange={e=>setMaxTopupAmountDzd(e.target.value)}/></label>
            <label className="mw-field"><span>{t.maxLyd}</span><input type="number" min="10" step="0.01" className="mw-input" value={maxTopupAmountLyd} onChange={e=>setMaxTopupAmountLyd(e.target.value)}/></label>
            <small className="mw-limit-hint">{t.unlimited}</small>
          </div>
          <div className="mw-grid">{methods.map((method,index)=><div className="mw-admin-method" key={`${method.id}-${index}`}>
            <label className="mw-field"><span>{t.id}</span><input className="mw-input" value={method.id} required onChange={e=>changeMethod(index,'id',e.target.value)}/></label>
            <label className="mw-field"><span>{t.country}</span><select className="mw-select" value={method.country} onChange={e=>changeMethod(index,'country',e.target.value)}><option value="Algeria">{t.algeria}</option><option value="Libya">{t.libya}</option></select></label>
            <label className="mw-field"><span>{t.name}</span><input className="mw-input" value={method.name} required onChange={e=>changeMethod(index,'name',e.target.value)}/></label>
            <label className="mw-field"><span>{t.beneficiary}</span><input className="mw-input" value={method.beneficiary} required onChange={e=>changeMethod(index,'beneficiary',e.target.value)}/></label>
            <label className="mw-field"><span>{t.account}</span><input className="mw-input" value={method.account} required onChange={e=>changeMethod(index,'account',e.target.value)}/></label>
            <label className="mw-field"><span>{t.phone}</span><input className="mw-input" value={method.phone??''} onChange={e=>changeMethod(index,'phone',e.target.value)}/></label>
            <label className="mw-field span-2"><span>{t.instructions}</span><textarea className="mw-textarea" value={method.instructions} required onChange={e=>changeMethod(index,'instructions',e.target.value)}/></label>
            <label className="mw-field"><span>{t.active}</span><select className="mw-select" value={method.active?'yes':'no'} onChange={e=>changeMethod(index,'active',e.target.value==='yes')}><option value="yes">{t.active}</option><option value="no">—</option></select></label>
            <button type="button" className="mw-btn mw-btn-danger" onClick={()=>setMethods(items=>items.filter((_,i)=>i!==index))}><X size={14}/>{t.remove}</button>
          </div>)}</div>
          <div className="mw-card-actions"><button type="button" className="mw-btn" onClick={()=>setMethods(items=>[...items,{id:`method-${Date.now()}`,country:'Algeria',name:'',beneficiary:'',account:'',phone:'',instructions:'',active:true}])}><Plus size={15}/>{t.add}</button><button className="mw-btn mw-btn-primary" disabled={busy}><Save size={15}/>{busy?t.loading:t.save}</button></div>
        </form>)}
        {section(t.profiles,t.profilesHint,storeChanges.length? <div className="mw-grid">{storeChanges.map((r,i)=>{
          const id=text(r.id,`profile-${i}`); const shopId=text(value(r,'merchantId','mid'));
          const changes=r.changes&&typeof r.changes==='object'?r.changes as Row:{};
          const changeValue=(key:string)=>value(r,key)??value(changes,key);
          const changeKeys=['country','category','legalName','registrationNumber','taxNumber'].filter(key=>changeValue(key)!==undefined);
          return <article className="mw-card" key={id}><div className="mw-row"><div className="mw-row-copy"><strong>{merchantName(r)}</strong><small>{t.merchant} · {shopId}</small></div><span className="mw-status is-pending">{t.review}</span></div>
            <div className="mw-balance-split">{changeKeys.map(k=><div key={k}><span>{fieldLabel(k)}</span><b>{fieldValue(k,changeValue(k))}</b></div>)}</div>
            {queueActions('profile',r)}
          </article>
        })}</div>:empty(t.noProfiles))}
        {section(t.topups,t.topupsHint,topups.length?<div className="mw-grid">{topups.map((r,i)=>{
          const proofId=text(value(r,'proofId','mediaId','objectId')); const proofUrl=proofId?`/api/cashback/media/${encodeURIComponent(proofId)}`:'';
          return <article className="mw-card" key={text(r.id,String(i))}><div className="mw-row"><div className="mw-row-copy"><strong>{merchantName(r)}</strong><small>{countryLabel(value(r,'country'))} · {formatAmount(r)} · {dateLabel(r)}</small></div><span className={`mw-status is-${stateOf(r)}`}>{statusLabel(stateOf(r))}</span></div>
            <div className="mw-row"><div className="mw-row-copy"><strong>{text(value(r,'paymentMethodName'),t.method)}</strong><small>{text(value(r,'payerReference','reference'))}</small></div></div>
            {proofUrl ? <a href={proofUrl} target="_blank" rel="noreferrer"><img className="mw-proof" src={proofUrl} alt={t.proof}/><span className="mw-card-actions"><ExternalLink size={14}/>{t.openProof}</span></a> : <div className="mw-banner">{t.proof}: —</div>}
            {queueActions('topup',r)}
          </article>
        })}</div>:empty(t.noTopups))}
        {section(t.withdrawals,t.withdrawalsHint,withdrawals.length?<div className="mw-grid">{withdrawals.map((r,i)=>{
          const status=stateOf(r);
          return <article className="mw-card" key={text(r.id,String(i))}><div className="mw-row"><div className="mw-row-copy"><strong>{merchantName(r)}</strong><small>{t.amount}: {formatAmount(r)} · {text(r.method)}</small></div><span className={`mw-status is-${status}`}>{statusLabel(status)}</span></div>
            <p>{text(value(r,'accountDetails'),t.unknown)}</p>
            {['pending','approved','transferring'].includes(status)&&<div className="mw-card-actions">
              {status==='pending'&&<button className="mw-btn mw-btn-primary" onClick={()=>void updatePayout(r,'approved')} disabled={busy}>{t.approve}</button>}
              {status==='approved'&&<button className="mw-btn mw-btn-primary" onClick={()=>void updatePayout(r,'transferring')} disabled={busy}>{t.transferring}</button>}
              {status==='transferring'&&<><input className="mw-input mw-reason" aria-label={t.reference} placeholder={t.reference} value={references[text(r.id)]??''} onChange={e=>setReferences({...references,[text(r.id)]:e.target.value})}/><label className="mw-field"><span>{t.transferReceipt}</span><input type="file" accept="image/jpeg,image/png,image/webp" className="mw-file" onChange={e=>{const file=e.target.files?.[0];if(file)setProofFiles(current=>({...current,[text(r.id)]:file}))}}/><small>{proofFiles[text(r.id)]?.name??t.proofRequired}</small></label><button className="mw-btn mw-btn-primary" onClick={()=>void updatePayout(r,'paid')} disabled={busy}>{t.markPaid}</button></>}
              {rejectionField(r)}<button className="mw-btn mw-btn-danger" onClick={()=>void updatePayout(r,'rejected')} disabled={busy}>{t.reject}</button>
            </div>}
          </article>
        })}</div>:empty(t.noWithdrawals))}
      </div>
    </div>
  </div>;
}

export default MerchantAdminPanel;
