import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  getGetCashbackSessionQueryKey, useDecideCashbackMerchantStoreChange,
  useDecideCashbackMerchantTopup, useUpdateCashbackMerchantWithdrawal,
  useUpdateCashbackPaymentMethods,
} from '@workspace/api-client-react';
import { Check, ExternalLink, Plus, Save, Settings2, X } from 'lucide-react';
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
    add:'Add method',save:'Save methods',saved:'Payment methods saved.',saveError:'Could not save these methods.',
    id:'Method ID',country:'Country',name:'Display name',beneficiary:'Beneficiary',account:'Account / IBAN',
    phone:'Phone (optional)',instructions:'Instructions',active:'Active',remove:'Remove',
    profiles:'Pending profile changes',profilesHint:'Review requested legal profile updates.',
    topups:'Pending top-ups',topupsHint:'Verify payment proof before approving funds.',
    withdrawals:'Withdrawal queue',withdrawalsHint:'Advance payouts through each review stage.',
    approve:'Approve',reject:'Reject',reason:'Reason for rejection (required)',reasonPlaceholder:'Explain why this request is rejected',
    reasonNeeded:'A rejection reason is required.',approved:'Approved.',rejected:'Rejected.',
    noProfiles:'No pending profile change requests.',noTopups:'No pending top-ups.',noWithdrawals:'No withdrawal requests.',
    merchant:'Merchant',requested:'Requested details',proof:'Payment proof',amount:'Amount',status:'Status',
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
    add:'Ajouter',save:'Enregistrer les modes',saved:'Modes de paiement enregistrés.',saveError:'Impossible d’enregistrer.',
    id:'Identifiant',country:'Pays',name:'Nom affiché',beneficiary:'Bénéficiaire',account:'Compte / IBAN',
    phone:'Téléphone (facultatif)',instructions:'Instructions',active:'Actif',remove:'Supprimer',
    profiles:'Modifications de profil en attente',profilesHint:'Examinez les changements légaux demandés.',
    topups:'Rechargements en attente',topupsHint:'Vérifiez la preuve avant d’approuver les fonds.',
    withdrawals:'Demandes de retrait',withdrawalsHint:'Faites progresser les paiements à chaque étape.',
    approve:'Approuver',reject:'Refuser',reason:'Motif du refus (obligatoire)',reasonPlaceholder:'Expliquez le refus',
    reasonNeeded:'Un motif de refus est obligatoire.',approved:'Demande approuvée.',rejected:'Demande refusée.',
    noProfiles:'Aucune modification en attente.',noTopups:'Aucun rechargement en attente.',noWithdrawals:'Aucun retrait.',
    merchant:'Commerce',requested:'Détails demandés',proof:'Justificatif',amount:'Montant',status:'Statut',
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
    add:'إضافة وسيلة',save:'حفظ وسائل الدفع',saved:'تم حفظ وسائل الدفع.',saveError:'تعذر حفظ وسائل الدفع.',
    id:'معرّف الوسيلة',country:'الدولة',name:'الاسم الظاهر',beneficiary:'المستفيد',account:'الحساب / IBAN',
    phone:'الهاتف (اختياري)',instructions:'التعليمات',active:'نشط',remove:'حذف',
    profiles:'طلبات تعديل بيانات المتجر',profilesHint:'راجع التعديلات القانونية المطلوبة.',
    topups:'طلبات التمويل المعلقة',topupsHint:'تحقق من إثبات الدفع قبل قبول التمويل.',
    withdrawals:'طلبات السحب',withdrawalsHint:'تابع طلبات الدفع في مراحل المراجعة.',
    approve:'موافقة',reject:'رفض',reason:'سبب الرفض (مطلوب)',reasonPlaceholder:'وضح سبب رفض الطلب',
    reasonNeeded:'سبب الرفض مطلوب.',approved:'تمت الموافقة.',rejected:'تم الرفض.',
    noProfiles:'لا توجد طلبات تعديل معلقة.',noTopups:'لا توجد طلبات تمويل معلقة.',noWithdrawals:'لا توجد طلبات سحب.',
    merchant:'التاجر',requested:'التفاصيل المطلوبة',proof:'إثبات الدفع',amount:'المبلغ',status:'الحالة',
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
  const saveMethods = useUpdateCashbackPaymentMethods();
  const [methods,setMethods] = useState<PaymentMethod[]>([]);
  const [reasons,setReasons] = useState<Record<string,string>>({});
  const [references,setReferences] = useState<Record<string,string>>({});
  const [message,setMessage] = useState('');
  const [busy,setBusy] = useState(false);
  const settings = stateRecord.settings && typeof stateRecord.settings==='object' ? stateRecord.settings as Row : {};
  const serverMethods = rows(settings.paymentMethods) as PaymentMethod[];
  useEffect(()=>{ setMethods(serverMethods.map(m=>({...m}))); },[stateRecord]);
  const storeChanges = rows(value(stateRecord,'merchantStoreChangeRequests','storeChangeRequests')).filter(r=>stateOf(r)==='pending');
  const topups = rows(value(stateRecord,'merchantTopups','topups')).filter(r=>stateOf(r)==='pending');
  const withdrawals = rows(value(stateRecord,'merchantWithdrawals','withdrawals')).filter(r=>!['paid','rejected'].includes(stateOf(r)));
  const statusLabel=(status:string) => {
    const key:Record<string,string> = {
      pending:'pendingStatus',submitted:'pendingStatus',approved:'approvedStatus',accepted:'approvedStatus',
      rejected:'rejectedStatus',declined:'rejectedStatus',transferring:'transferringStatus',
      paid:'paidStatus',funded:'fundedStatus',done:'doneStatus',complete:'doneStatus',completed:'doneStatus',
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
  const persist = () => { void client.invalidateQueries({queryKey:getGetCashbackSessionQueryKey()}); onRefresh(); };
  const changeMethod = (index:number,key:keyof PaymentMethod,val:string|boolean) => setMethods(existing=>existing.map((m,i)=>i===index?{...m,[key]:val}:m));
  const savePaymentMethods = async (event:FormEvent) => {
    event.preventDefault(); setBusy(true);setMessage('');
    try {
      await saveMethods.mutateAsync({data:{methods}});
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
    if(status==='rejected'&&!reason){setMessage(t.reasonNeeded);return}
    if(status==='paid'&&!transferReference){setMessage(t.reference);return}
    setBusy(true);setMessage('');
    try {
      await updateWithdrawal.mutateAsync({id,data:{status,...(status==='rejected'?{reason}:{}),...(status==='paid'?{transferReference}:{})}});
      persist();setMessage(status==='rejected'?t.rejected:t.approved);
    } catch {setMessage(t.error)} finally {setBusy(false)}
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
        {section(t.methods,t.methodsHint,<form onSubmit={savePaymentMethods}>
          {methods.length===0&&empty(t.noMethods)}
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
          return <article className="mw-card" key={text(r.id,String(i))}><div className="mw-row"><div className="mw-row-copy"><strong>{merchantName(r)}</strong><small>{t.amount}: {formatAmount(r)}</small></div><span className={`mw-status is-${stateOf(r)}`}>{statusLabel(stateOf(r))}</span></div>
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
              {status==='transferring'&&<><input className="mw-input mw-reason" aria-label={t.reference} placeholder={t.reference} value={references[text(r.id)]??''} onChange={e=>setReferences({...references,[text(r.id)]:e.target.value})}/><button className="mw-btn mw-btn-primary" onClick={()=>void updatePayout(r,'paid')} disabled={busy}>{t.markPaid}</button></>}
              {rejectionField(r)}<button className="mw-btn mw-btn-danger" onClick={()=>void updatePayout(r,'rejected')} disabled={busy}>{t.reject}</button>
            </div>}
          </article>
        })}</div>:empty(t.noWithdrawals))}
      </div>
    </div>
  </div>;
}

export default MerchantAdminPanel;
