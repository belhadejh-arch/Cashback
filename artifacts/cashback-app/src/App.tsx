import { useEffect, useMemo, useState } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { setAuthTokenGetter } from '@workspace/api-client-react';
import {
  getGetCashbackSessionQueryKey, getGetCashbackMediaQueryKey,
  useGetCashbackSession, useRegisterCashbackProfile, useSubmitCashbackReceipt,
  useDecideCashbackReceipt, useDecideCashbackMerchant, useRedeemMerchantCashback,
  useUpdateCashbackPreferences, useUpdateCashbackRate, useGetCashbackMedia,
} from '@workspace/api-client-react';
import { useLocation } from 'wouter';
import { QRCodeSVG } from 'qrcode.react';
import {
  getFirebaseAuth, signInWithEmail, createEmailAccount, linkEmailPassword, sendPasswordReset, sendPhoneCode,
  confirmPhoneCode, currentFirebaseUser, signOutFirebase, firebaseErrorCode,
} from './lib/firebase-auth';
import {
  ArrowDownLeft, ArrowLeft, ArrowRight, BadgeCheck, Banknote, Camera, Check, ChevronDown,
  CircleHelp, Clock3, Compass, FileCheck2, FilePlus2, Globe2, LogOut, MapPin, Moon,
  Plus, ReceiptText, Search, Settings, ShieldCheck, Store, Sun, UserRound, Wallet,
  X, Upload, RefreshCw, LockKeyhole, Percent, LocateFixed,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { Route, Switch, Router as WouterRouter } from 'wouter';
import NotFound from '@/pages/not-found';

type Lang = 'en' | 'fr' | 'ar';
type Theme = 'dark' | 'light';
type Merchant = { id: string; name: string; cat?: string; status?: string; country?: string; city?: string; address?: string; mapsUrl?: string; lat?: number; lng?: number; cashbackRate?: number; logoId?: string; publicId?: string; qrValue?: string };
type Claim = { id: string; mid: string; cid: string; invoiceNumber?: string; date?: string; amount: number; photoId?: string; status: string; created?: string; cashback?: number; reason?: string };
type Txn = { id: string; t?: string; mid: string; cid: string; amount: number; cashback?: number; method?: string };
type Session = { profile: { uid: string; role: string; eid: string; name: string; phone?: string; email?: string; preferences?: { language?: Lang; theme?: Theme }; status?: string; rejectionReason?: string }; state: { settings?: { cashback?: number; claimHours?: number }; merchants?: Merchant[]; customers?: { id: string; name: string; phone?: string; wallet?: number; cbm?: Record<string, number> }[]; claims?: Claim[]; txns?: Txn[]; cbpays?: { id: string; cid: string; mid: string; amount: number; status: string; at?: string }[]; notes?: unknown[] } };
type Dict = Record<string, string>;
const dictionaries: Record<Lang, Dict> = {
  en: {
    tagline:'A little back, right where you shop.', algeria:'Algeria', libya:'Libya', localTag:'LOCAL REWARDS · NORTH AFRICA', separationNudge:'One shop. One balance.', separationHint:'Rewards stay with their shop.', welcome:'Good to see you.', login:'Sign in', createAccount:'Create account', customer:'Customer', merchant:'Shop owner', admin:'Administrator',
    email:'Email address', password:'Password', confirmPassword:'Confirm password', phone:'Phone number', name:'Full name', forgot:'Forgot password?', reset:'Send reset link', register:'Register', continue:'Continue', verify:'Verify phone', code:'SMS verification code', sendCode:'Send code', verifyCode:'Verify code', back:'Back to sign in',
    home:'Discover', wallet:'My rewards', profile:'Profile', settings:'Settings', signOut:'Sign out', hello:'Welcome back', nearby:'Shops worth coming back to', noShops:'Your local finds start here', noShopsHint:'Participating shops will appear when they join CASH BACK.', search:'Search shops or categories', details:'Shop details', earn:'Earn', cashback:'cashback', spendHere:'Spend rewards here', receipt:'Submit receipt', receiptHint:'Upload a clear photo of your receipt. Rewards are credited after review.', amount:'Purchase amount', invoice:'Invoice number (optional)', date:'Purchase date', upload:'Choose receipt photo', submit:'Send for review', walletTitle:'Your shop-by-shop rewards', walletHint:'Rewards belong to the shop that issued them. Spend them only there.', earned:'Earned', used:'Used', balance:'Available balance', ledger:'Activity', noActivity:'No activity yet', redeem:'Redeem rewards', redeemAmount:'Amount to redeem', confirmRedeem:'Confirm redemption', pending:'Under review', approved:'Approved', rejected:'Rejected', noReceipts:'No receipts yet', preferences:'Your preferences', language:'Language', theme:'Appearance', light:'Light', dark:'Dark', save:'Save preferences', saved:'Preferences saved', customerEntry:'Shopping locally pays you back.', customerBlurb:'Earn a separate reward balance at every participating shop. Keep it local. Spend it on your next visit.', shopEntry:'Bring your regulars back.', shopBlurb:'Apply to join a local rewards network that celebrates repeat visits.', applyShop:'Apply as a shop', statusPending:'Application in review', pendingHint:'We’re checking your shop details. Sales tools unlock after approval.', statusRejected:'Application not approved', reason:'Review note', retry:'Contact support for next steps', merchantDashboard:'Shop dashboard', merchantActive:'Your shop is live', salesOnly:'Your shop has been approved. Customer receipts are reviewed by the CASH BACK team.', rate:'Cashback rate', customers:'Customers', sales:'Sales', receiptQueue:'Receipt review', merchantQueue:'Merchant applications', adminDashboard:'Review desk', noPending:'All caught up', approve:'Approve', decline:'Decline', rejectionReason:'Reason (optional)', apply:'Submit application', country:'Country', city:'City / Wilaya', location:'Shop address', mapLink:'Maps link or coordinates', category:'Shop category', logo:'Shop photo or logo', shopName:'Shop name', choose:'Choose', close:'Close', loading:'Loading your account…', retryLoad:'Try again', loadError:'We could not load your account.', authError:'That didn’t work. Check your details and try again.', success:'Done', resetSent:'Password reset email sent.', noAccount:'New to CASH BACK?', haveAccount:'Already have an account?', shopOpen:'Open map', rateSaved:'Rate updated', allShops:'All shops', profileText:'Account details', adminSettings:'Program settings', claimHours:'Receipt claim window', noPermission:'This screen is not available for this account.', genericError:'Something went wrong. Please try again.', uploadRequired:'Please choose a photo first.', incomplete:'Complete all required fields.', passwordsDiffer:'Passwords do not match.', camera:'Use a clear photo', privacy:'Your receipt is shared only for reward review.', phoneStep:'We sent a code to your phone.', phoneLogin:'Sign in with phone', emailLogin:'Use email instead', mapNote:'Maps URL, or latitude and longitude', noHistory:'No purchases recorded yet', merchantId:'Shop', clear:'Clear', applyPending:'Application sent', sendReceipt:'Receipt sent for review', redeemDone:'Redemption recorded', finishPhoneProfile:'Your phone is verified. Complete your account details.', cat_restaurants:'Restaurants', cat_cafes:'Cafés', cat_clothing:'Clothing', cat_electronics:'Electronics', cat_malls:'Shopping centers', cat_groceries:'Groceries', cat_perfume:'Perfume', cat_gifts:'Gifts', cat_shops:'Other shops', cat_other:'Other', qrCode:'Shop QR code',
  },
  fr: {
    tagline:'Un petit retour, là où vous faites vos achats.', algeria:'Algérie', libya:'Libye', localTag:'RÉCOMPENSES LOCALES · AFRIQUE DU NORD', separationNudge:'Un commerce. Un solde.', separationHint:'Vos récompenses restent liées au commerce.', welcome:'Ravi de vous revoir.', login:'Se connecter', createAccount:'Créer un compte', customer:'Client', merchant:'Commerçant', admin:'Administrateur',
    email:'Adresse e-mail', password:'Mot de passe', confirmPassword:'Confirmer le mot de passe', phone:'Numéro de téléphone', name:'Nom complet', forgot:'Mot de passe oublié ?', reset:'Envoyer le lien', register:'Créer le compte', continue:'Continuer', verify:'Vérifier le téléphone', code:'Code de vérification SMS', sendCode:'Envoyer le code', verifyCode:'Vérifier le code', back:'Retour à la connexion',
    home:'Découvrir', wallet:'Mes récompenses', profile:'Profil', settings:'Paramètres', signOut:'Déconnexion', hello:'Bon retour', nearby:'Des commerces locaux à retrouver', noShops:'Vos adresses locales commencent ici', noShopsHint:'Les commerces participants apparaîtront lorsqu’ils rejoindront CASH BACK.', search:'Rechercher un commerce ou une catégorie', details:'Détails du commerce', earn:'Gagnez', cashback:'de cashback', spendHere:'Utiliser ici', receipt:'Envoyer un reçu', receiptHint:'Ajoutez une photo lisible. Les récompenses sont créditées après vérification.', amount:'Montant de l’achat', invoice:'Numéro de facture (facultatif)', date:'Date de l’achat', upload:'Choisir une photo du reçu', submit:'Envoyer pour vérification', walletTitle:'Vos récompenses, commerce par commerce', walletHint:'Les récompenses restent liées au commerce qui les a émises.', earned:'Gagné', used:'Utilisé', balance:'Solde disponible', ledger:'Activité', noActivity:'Aucune activité pour le moment', redeem:'Utiliser mes récompenses', redeemAmount:'Montant à utiliser', confirmRedeem:'Confirmer l’utilisation', pending:'En vérification', approved:'Approuvé', rejected:'Refusé', noReceipts:'Aucun reçu pour le moment', preferences:'Vos préférences', language:'Langue', theme:'Apparence', light:'Clair', dark:'Sombre', save:'Enregistrer les préférences', saved:'Préférences enregistrées', customerEntry:'Vos achats locaux vous récompensent.', customerBlurb:'Cumulez un solde distinct dans chaque commerce participant. Dépensez-le lors de votre prochaine visite.', shopEntry:'Faites revenir vos clients.', shopBlurb:'Rejoignez un réseau local de récompenses qui valorise la fidélité.', applyShop:'Inscrire mon commerce', statusPending:'Demande en cours', pendingHint:'Nous vérifions les informations de votre commerce. Les ventes seront accessibles après approbation.', statusRejected:'Demande non approuvée', reason:'Note de vérification', retry:'Contactez le support pour la suite', merchantDashboard:'Espace commerçant', merchantActive:'Votre commerce est actif', salesOnly:'Votre commerce est approuvé. Les reçus clients sont vérifiés par CASH BACK.', rate:'Taux de cashback', customers:'Clients', sales:'Ventes', receiptQueue:'Vérification des reçus', merchantQueue:'Demandes de commerces', adminDashboard:'Espace de vérification', noPending:'Tout est à jour', approve:'Approuver', decline:'Refuser', rejectionReason:'Motif (facultatif)', apply:'Envoyer la demande', country:'Pays', city:'Ville / Wilaya', location:'Adresse du commerce', mapLink:'Lien Maps ou coordonnées', category:'Catégorie du commerce', logo:'Photo ou logo du commerce', shopName:'Nom du commerce', choose:'Choisir', close:'Fermer', loading:'Chargement du compte…', retryLoad:'Réessayer', loadError:'Impossible de charger votre compte.', authError:'Échec de la connexion. Vérifiez vos informations.', success:'Terminé', resetSent:'E-mail de réinitialisation envoyé.', noAccount:'Nouveau sur CASH BACK ?', haveAccount:'Vous avez déjà un compte ?', shopOpen:'Ouvrir la carte', rateSaved:'Taux mis à jour', allShops:'Tous les commerces', profileText:'Informations du compte', adminSettings:'Paramètres du programme', claimHours:'Délai de dépôt du reçu', noPermission:'Cet écran n’est pas disponible pour ce compte.', genericError:'Une erreur est survenue. Veuillez réessayer.', uploadRequired:'Choisissez une photo.', incomplete:'Veuillez remplir les champs obligatoires.', passwordsDiffer:'Les mots de passe ne correspondent pas.', camera:'Prenez une photo lisible', privacy:'Votre reçu est utilisé uniquement pour vérifier la récompense.', phoneStep:'Un code a été envoyé sur votre téléphone.', phoneLogin:'Se connecter par téléphone', emailLogin:'Utiliser l’e-mail', mapNote:'Lien Maps ou latitude et longitude', noHistory:'Aucun achat enregistré', merchantId:'Commerce', clear:'Effacer', applyPending:'Demande envoyée', sendReceipt:'Reçu envoyé pour vérification', redeemDone:'Utilisation enregistrée', finishPhoneProfile:'Votre téléphone est vérifié. Complétez les informations du compte.', cat_restaurants:'Restaurants', cat_cafes:'Cafés', cat_clothing:'Vêtements', cat_electronics:'Électronique', cat_malls:'Centres commerciaux', cat_groceries:'Alimentation', cat_perfume:'Parfumerie', cat_gifts:'Cadeaux', cat_shops:'Autres commerces', cat_other:'Autre', qrCode:'Code QR du commerce',
  },
  ar: {
    tagline:'مكافأة صغيرة، في متجرك المفضل.', algeria:'الجزائر', libya:'ليبيا', localTag:'مكافآت محلية · شمال أفريقيا', separationNudge:'متجر واحد. رصيد واحد.', separationHint:'تبقى المكافآت لدى المتجر الذي منحها.', welcome:'سعداء بعودتك.', login:'تسجيل الدخول', createAccount:'إنشاء حساب', customer:'عميل', merchant:'صاحب متجر', admin:'مسؤول',
    email:'البريد الإلكتروني', password:'كلمة المرور', confirmPassword:'تأكيد كلمة المرور', phone:'رقم الهاتف', name:'الاسم الكامل', forgot:'هل نسيت كلمة المرور؟', reset:'إرسال رابط الاستعادة', register:'إنشاء الحساب', continue:'متابعة', verify:'تأكيد الهاتف', code:'رمز التحقق عبر SMS', sendCode:'إرسال الرمز', verifyCode:'تأكيد الرمز', back:'العودة إلى الدخول',
    home:'اكتشف المتاجر', wallet:'مكافآتي', profile:'الملف الشخصي', settings:'الإعدادات', signOut:'تسجيل الخروج', hello:'مرحباً بعودتك', nearby:'متاجر محلية تستحق زيارتك', noShops:'اكتشاف متاجرك المحلية يبدأ هنا', noShopsHint:'ستظهر المتاجر المشاركة عند انضمامها إلى CASH BACK.', search:'ابحث عن متجر أو فئة', details:'تفاصيل المتجر', earn:'اكسب', cashback:'استرداد نقدي', spendHere:'استخدم المكافآت هنا', receipt:'إرسال إيصال', receiptHint:'حمّل صورة واضحة للإيصال. تُضاف المكافآت بعد المراجعة.', amount:'قيمة الشراء', invoice:'رقم الفاتورة (اختياري)', date:'تاريخ الشراء', upload:'اختر صورة الإيصال', submit:'إرسال للمراجعة', walletTitle:'رصيد مستقل لكل متجر', walletHint:'تبقى المكافآت لدى المتجر الذي منحها، وتُستخدم لديه فقط.', earned:'المكتسب', used:'المستخدم', balance:'الرصيد المتاح', ledger:'النشاط', noActivity:'لا يوجد نشاط بعد', redeem:'استخدام المكافآت', redeemAmount:'قيمة الاستخدام', confirmRedeem:'تأكيد الاستخدام', pending:'قيد المراجعة', approved:'مقبول', rejected:'مرفوض', noReceipts:'لا توجد إيصالات بعد', preferences:'تفضيلاتك', language:'اللغة', theme:'المظهر', light:'فاتح', dark:'داكن', save:'حفظ التفضيلات', saved:'تم حفظ التفضيلات', customerEntry:'تسوّق محلياً واكسب مكافآت.', customerBlurb:'اكسب رصيداً منفصلاً لدى كل متجر مشارك، واستخدمه في زيارتك القادمة.', shopEntry:'امنح زبائنك سبباً للعودة.', shopBlurb:'انضم إلى شبكة مكافآت محلية تحتفي بالزبائن الدائمين.', applyShop:'قدّم متجرك', statusPending:'طلبك قيد المراجعة', pendingHint:'نراجع تفاصيل متجرك. ستتوفر أدوات البيع بعد الموافقة.', statusRejected:'لم تتم الموافقة على الطلب', reason:'ملاحظة المراجعة', retry:'تواصل مع الدعم لمعرفة الخطوات التالية', merchantDashboard:'لوحة المتجر', merchantActive:'متجرك نشط', salesOnly:'تمت الموافقة على متجرك. يراجع فريق CASH BACK إيصالات العملاء.', rate:'نسبة المكافأة', customers:'العملاء', sales:'المبيعات', receiptQueue:'مراجعة الإيصالات', merchantQueue:'طلبات المتاجر', adminDashboard:'لوحة المراجعة', noPending:'لا توجد طلبات معلقة', approve:'موافقة', decline:'رفض', rejectionReason:'سبب الرفض (اختياري)', apply:'إرسال الطلب', country:'الدولة', city:'المدينة / الولاية', location:'عنوان المتجر', mapLink:'رابط الخرائط أو الإحداثيات', category:'فئة المتجر', logo:'صورة أو شعار المتجر', shopName:'اسم المتجر', choose:'اختر', close:'إغلاق', loading:'جارٍ تحميل حسابك…', retryLoad:'إعادة المحاولة', loadError:'تعذر تحميل حسابك.', authError:'تعذر إتمام العملية. تحقق من بياناتك وحاول مجدداً.', success:'تم', resetSent:'تم إرسال رسالة استعادة كلمة المرور.', noAccount:'جديد على CASH BACK؟', haveAccount:'لديك حساب بالفعل؟', shopOpen:'فتح الخريطة', rateSaved:'تم تحديث النسبة', allShops:'كل المتاجر', profileText:'بيانات الحساب', adminSettings:'إعدادات البرنامج', claimHours:'مهلة إرسال الإيصال', noPermission:'هذه الصفحة غير متاحة لهذا الحساب.', genericError:'حدث خطأ. يرجى المحاولة مجدداً.', uploadRequired:'يرجى اختيار صورة أولاً.', incomplete:'أكمل الحقول المطلوبة.', passwordsDiffer:'كلمتا المرور غير متطابقتين.', camera:'استخدم صورة واضحة', privacy:'يُستخدم إيصالك لمراجعة المكافأة فقط.', phoneStep:'أرسلنا رمزاً إلى هاتفك.', phoneLogin:'الدخول برقم الهاتف', emailLogin:'استخدام البريد الإلكتروني', mapNote:'رابط خرائط أو خط العرض والطول', noHistory:'لا توجد مشتريات مسجلة بعد', merchantId:'المتجر', clear:'مسح', applyPending:'تم إرسال الطلب', sendReceipt:'تم إرسال الإيصال للمراجعة', redeemDone:'تم تسجيل الاستخدام', finishPhoneProfile:'تم التحقق من هاتفك. أكمل بيانات الحساب.', cat_restaurants:'مطاعم', cat_cafes:'مقاهٍ', cat_clothing:'ملابس', cat_electronics:'إلكترونيات', cat_malls:'مراكز تجارية', cat_groceries:'مواد غذائية', cat_perfume:'عطور', cat_gifts:'هدايا', cat_shops:'محلات أخرى', cat_other:'أخرى', qrCode:'رمز QR الخاص بالمتجر',
  },
};
const wilayas = ['Adrar','Chlef','Laghouat','Oum El Bouaghi','Batna','Béjaïa','Biskra','Béchar','Blida','Bouira','Tamanrasset','Tébessa','Tlemcen','Tiaret','Tizi Ouzou','Alger','Djelfa','Jijel','Sétif','Saïda','Skikda','Sidi Bel Abbès','Annaba','Guelma','Constantine','Médéa','Mostaganem','M’Sila','Mascara','Ouargla','Oran','El Bayadh','Illizi','Bordj Bou Arréridj','Boumerdès','El Tarf','Tindouf','Tissemsilt','El Oued','Khenchela','Souk Ahras','Tipaza','Mila','Aïn Defla','Naâma','Aïn Témouchent','Ghardaïa','Relizane','Timimoun','Bordj Badji Mokhtar','Ouled Djellal','Béni Abbès','In Salah','In Guezzam','Touggourt','Djanet','El M’Ghair','El Meniaa'];
const libyanCities = ['Tripoli','Benghazi','Misrata','Bayda','Zawiya','Zliten','Ajdabiya','Tobruk','Sabha','Sirte','Derna','Khoms','Gharyan','Tarhuna','Bani Walid','Jalu','Kufra','Ghadames','Murzuq','Nalut','Sabratha','Surman','Yefren','Ubari','Brak','Marj'];
const wilayasArabic = ['أدرار','الشلف','الأغواط','أم البواقي','باتنة','بجاية','بسكرة','بشار','البليدة','البويرة','تمنراست','تبسة','تلمسان','تيارت','تيزي وزو','الجزائر','الجلفة','جيجل','سطيف','سعيدة','سكيكدة','سيدي بلعباس','عنابة','قالمة','قسنطينة','المدية','مستغانم','المسيلة','معسكر','ورقلة','وهران','البيض','إليزي','برج بوعريريج','بومرداس','الطارف','تندوف','تيسمسيلت','الوادي','خنشلة','سوق أهراس','تيبازة','ميلة','عين الدفلى','النعامة','عين تموشنت','غرداية','غليزان','تيميمون','برج باجي مختار','أولاد جلال','بني عباس','عين صالح','عين قزام','تقرت','جانت','المغير','المنيعة'];
const libyanCitiesArabic = ['طرابلس','بنغازي','مصراتة','البيضاء','الزاوية','زليتن','أجدابيا','طبرق','سبها','سرت','درنة','الخمس','غريان','ترهونة','بني وليد','جالو','الكفرة','غدامس','مرزق','نالوت','صبراتة','صرمان','يفرن','أوباري','براك','المرج'];
const cityArabic = Object.fromEntries([...wilayas.map((name,index)=>[name,wilayasArabic[index]]),...libyanCities.map((name,index)=>[name,libyanCitiesArabic[index]])]) as Record<string,string>;
const localizeCity = (name:string|undefined, lang:Lang) => name && lang==='ar' ? cityArabic[name] || name : name || '';
const formatMoney = (n: number, country = 'Algeria') => `${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })} ${country === 'Libya' ? 'LYD' : 'DZD'}`;
const getHttpStatus = (error:unknown) => {
  if (!error || typeof error !== 'object') return 0;
  const value = error as { status?:unknown; statusCode?:unknown; response?:{status?:unknown} };
  return Number(value.status ?? value.statusCode ?? value.response?.status ?? 0);
};
const queryClient = new QueryClient();

function IconButton({ children, onClick, label, testId }: { children: ReactNode; onClick: () => void; label: string; testId: string }) {
  return <button className="btn btn-outline" onClick={onClick} aria-label={label} data-testid={testId} style={{ minHeight: 42, padding: '9px 12px' }}>{children}</button>;
}
function Field({ label, value, onChange, type = 'text', placeholder, testId, required = false, min, step }: { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string; testId: string; required?: boolean; min?: string; step?: string }) {
  return <label style={{ display:'grid', gap:6, fontSize:14, fontWeight:600 }}>{label}<input className="field" type={type} value={value} placeholder={placeholder} onChange={e=>onChange(e.target.value)} data-testid={testId} required={required} min={min} step={step} /></label>;
}
function SelectField({ label, value, onChange, options, testId, formatOption }: { label: string; value: string; onChange:(v:string)=>void; options:string[]; testId:string; formatOption?:(option:string,index:number)=>string }) {
  return <label style={{ display:'grid', gap:6, fontSize:14, fontWeight:600 }}>{label}<select className="field" value={value} onChange={e=>onChange(e.target.value)} data-testid={testId}><option value="">—</option>{options.map((o,index)=><option key={o} value={o}>{formatOption?.(o,index)??o}</option>)}</select></label>;
}
function MediaImage({ id, alt, style }: { id?: string; alt: string; style?: React.CSSProperties }) {
  const { data } = useGetCashbackMedia(id || '', { query: { queryKey: getGetCashbackMediaQueryKey(id || ''), enabled: !!id } });
  const [src, setSrc] = useState('');
  useEffect(() => { if (!data) return; const url = URL.createObjectURL(data); setSrc(url); return () => URL.revokeObjectURL(url); }, [data]);
  return src ? <img src={src} alt={alt} style={style} /> : <div aria-label={alt} style={{ ...style, display:'grid', placeItems:'center', background:'hsl(var(--muted))', color:'hsl(var(--muted-foreground))' }}><Store size={24}/></div>;
}

function AppInner() {
  const client = useQueryClient();
  const [location, setLocation] = useLocation();
  const [lang, setLang] = useState<Lang>('ar');
  const [theme, setTheme] = useState<Theme>('dark');
  const [firebaseUser, setFirebaseUser] = useState<{ uid?: string; phoneNumber?: string; email?: string } | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [splash, setSplash] = useState(true);
  const [authMode, setAuthMode] = useState<'login'|'register'|'reset'|'phone'>('login');
  const [registerRole, setRegisterRole] = useState<'customer'|'merchant'>('customer');
  const [authStep, setAuthStep] = useState<'form'|'sms'>('form');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [confirm, setConfirm] = useState('');
  const [phone, setPhone] = useState(''); const [code, setCode] = useState(''); const [name, setName] = useState('');
  const [country, setCountry] = useState('Algeria'); const [city, setCity] = useState(''); const [address, setAddress] = useState(''); const [mapsUrl, setMapsUrl] = useState(''); const [category, setCategory] = useState(''); const [logoData, setLogoData] = useState('');
  const [search, setSearch] = useState(''); const [selectedMerchant, setSelectedMerchant] = useState<Merchant|null>(null);
  const [dialog, setDialog] = useState<'receipt'|'redeem'|null>(null); const [receiptMerchantId, setReceiptMerchantId] = useState(''); const [receiptFile, setReceiptFile] = useState(''); const [invoice, setInvoice] = useState(''); const [purchaseAmount, setPurchaseAmount] = useState(''); const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().slice(0,10)); const [redeemAmount, setRedeemAmount] = useState('');
  const [reason, setReason] = useState(''); const [rateValue, setRateValue] = useState('');
  const t = (key: string) => dictionaries[lang][key] || (key.startsWith('cat_') ? key.slice(4) : key);
  const { data: session, isLoading, isError, error: queryError, refetch } = useGetCashbackSession({ query: { queryKey: getGetCashbackSessionQueryKey(), enabled: authReady && !!firebaseUser, retry: false, refetchOnWindowFocus: false } });
  const register = useRegisterCashbackProfile(); const submitReceipt = useSubmitCashbackReceipt(); const decideReceipt = useDecideCashbackReceipt();
  const decideMerchant = useDecideCashbackMerchant(); const redeem = useRedeemMerchantCashback(); const preferences = useUpdateCashbackPreferences(); const updateRate = useUpdateCashbackRate();
  const user = session as Session|undefined;
  const state = user?.state || {};
  const merchants = state.merchants || []; const claims = state.claims || []; const txns = state.txns || [];
  const profile = user?.profile;
  const activeMerchants = merchants.filter(m=>m.status==='active');
  const receiptStore = activeMerchants.find(m=>m.id===receiptMerchantId) || (selectedMerchant?.status==='active'?selectedMerchant:null);
  const selectedBalance = selectedMerchant && profile ? Number(state.customers?.find(c=>c.id===profile.eid)?.cbm?.[selectedMerchant.id] ?? 0) : 0;
  const isRtl = lang === 'ar';
  useEffect(() => { document.documentElement.classList.toggle('dark', theme === 'dark'); document.documentElement.dir = isRtl ? 'rtl' : 'ltr'; document.documentElement.lang = lang; }, [theme, lang, isRtl]);
  useEffect(() => { const id = window.setTimeout(()=>setSplash(false), 1850); return ()=>window.clearTimeout(id); }, []);
  useEffect(() => {
    let active = true;
    let unsubscribe = () => {};
    void getFirebaseAuth().then(auth => {
      if (!active) return;
      setAuthTokenGetter(async () => { const fbUser = currentFirebaseUser(); return fbUser ? await fbUser.getIdToken() : null; });
      unsubscribe = auth.onAuthStateChanged((next: { uid?: string; phoneNumber?: string; email?: string } | null) => {
        client.clear();
        setFirebaseUser(next);
        setAuthReady(true);
      });
    }).catch(() => { setAuthReady(true); });
    return () => { active = false; unsubscribe(); setAuthTokenGetter(null); };
  }, [client]);
  useEffect(() => { if (profile?.preferences?.language) { setLang(profile.preferences.language); setTheme(profile.preferences.theme || 'dark'); } }, [profile?.uid, profile?.preferences?.language, profile?.preferences?.theme]);
  useEffect(() => {
    if (firebaseUser && isError && getHttpStatus(queryError)===403 && !profile && authReady) {
      setPhone(firebaseUser.phoneNumber || '');
      setEmail(firebaseUser.email || '');
      setRegisterRole('customer');
      setAuthMode('register');
      setAuthStep('form');
      setNotice(t('finishPhoneProfile'));
    }
  }, [firebaseUser?.uid, firebaseUser?.phoneNumber, firebaseUser?.email, isError, queryError, profile, authReady]);
  useEffect(() => { if (location.startsWith('/shop/')) { const id = location.split('/')[2]; setSelectedMerchant(merchants.find(m=>m.id===id)||null); } else if (location !== '/shop') setSelectedMerchant(null); }, [location, merchants]);
  const refreshSession = () => client.invalidateQueries({ queryKey: getGetCashbackSessionQueryKey() });
  const filtered = useMemo(()=>merchants.filter(m=>m.status === 'active' && `${m.name} ${m.cat||''} ${m.city||''}`.toLowerCase().includes(search.toLowerCase())), [merchants,search]);
  const customer = profile?.role === 'customer'; const merchant = profile?.role === 'merchant'; const admin = profile?.role === 'admin';
  const clearMessages = () => { setError(''); setNotice(''); };
  const showErr = (e: unknown) => { setError(firebaseErrorCode(e) ? t('authError') : t('genericError')); };
  const invalidate = () => { void refreshSession(); };

  async function signIn() {
    clearMessages();
    try { await signInWithEmail(email, password); invalidate(); await refetch(); setLocation('/'); }
    catch (e) { showErr(e); }
  }
  async function beginPhone() {
    clearMessages();
    try { await sendPhoneCode(phone, 'sign-in'); setAuthMode('phone'); setAuthStep('sms'); setNotice(t('phoneStep')); }
    catch (e) { showErr(e); }
  }
  async function confirmPhone() {
    clearMessages();
    try { await confirmPhoneCode(code); invalidate(); await refetch(); setLocation('/'); setAuthStep('form'); }
    catch (e) { showErr(e); }
  }
  async function beginRegistration() {
    clearMessages();
    const phoneIdentity = !!firebaseUser?.phoneNumber;
    if (phoneIdentity) {
      if (!firebaseUser.phoneNumber) { setError(t('incomplete')); return; }
      if (!name || (registerRole === 'merchant' && (!phone || !email || !password || !confirm || !country || !city || !address || !category || !logoData))) { setError(t('incomplete')); return; }
      if (password && password !== confirm) { setError(t('passwordsDiffer')); return; }
      try {
        if (email && password) await linkEmailPassword(email, password);
        const body = { role: registerRole, name, phone: firebaseUser.phoneNumber, ...(email ? { email } : {}), ...(registerRole==='merchant' ? { country: country as 'Algeria'|'Libya', city, address, mapsUrl, category, logoData } : {}) };
        await register.mutateAsync({ data: body });
        invalidate(); await refetch(); setAuthStep('form'); setLocation('/');
      } catch (e) { showErr(e); }
      return;
    }
    if (firebaseUser?.email) {
      if (!name || !phone || (registerRole==='merchant' && (!country || !city || !address || !category || !logoData))) { setError(t('incomplete')); return; }
      try { await sendPhoneCode(phone, 'link'); setAuthMode('register'); setAuthStep('sms'); setNotice(t('phoneStep')); }
      catch (e) { showErr(e); }
      return;
    }
    if (!name || !phone || !email || !password || (registerRole==='merchant' && (!country || !city || !address || !category || !logoData))) { setError(t('incomplete')); return; }
    if (password !== confirm) { setError(t('passwordsDiffer')); return; }
    try {
      await createEmailAccount(email, password);
      await sendPhoneCode(phone, 'link');
      setAuthMode('register'); setAuthStep('sms'); setNotice(t('phoneStep'));
    } catch(e) { showErr(e); }
  }
  async function finishRegistration() {
    clearMessages();
    try {
      await confirmPhoneCode(code);
      const body = { role: registerRole, name, phone, ...(registerRole==='merchant' ? { country: country as 'Algeria'|'Libya', city, address, mapsUrl, category, logoData } : {}), email };
      await register.mutateAsync({ data: body });
      invalidate(); await refetch(); setAuthStep('form'); setLocation('/');
    } catch(e) { showErr(e); }
  }
  async function resetPassword() {
    clearMessages();
    try { await sendPasswordReset(email); setNotice(t('resetSent')); }
    catch(e) { showErr(e); }
  }
  async function changePreference(nextLang: Lang, nextTheme: Theme) {
    if (profile) {
      try { await preferences.mutateAsync({ data: { language: nextLang, theme: nextTheme } }); setLang(nextLang); setTheme(nextTheme); invalidate(); setNotice(dictionaries[nextLang].saved); }
      catch(e) { setError(t('genericError')); }
    } else { setLang(nextLang); setTheme(nextTheme); }
  }
  const fileToData = (file: File) => new Promise<string>((resolve,reject)=>{
    const source=URL.createObjectURL(file); const image=new Image();
    image.onload=()=>{ URL.revokeObjectURL(source); const scale=Math.min(1,1500/Math.max(image.width,image.height)); const canvas=document.createElement('canvas'); canvas.width=Math.max(1,Math.round(image.width*scale)); canvas.height=Math.max(1,Math.round(image.height*scale)); const context=canvas.getContext('2d'); if(!context){reject(new Error('IMAGE_PROCESSING_FAILED'));return;} context.drawImage(image,0,0,canvas.width,canvas.height); canvas.toBlob(blob=>{if(!blob){reject(new Error('IMAGE_PROCESSING_FAILED'));return;}const reader=new FileReader();reader.onload=()=>resolve(String(reader.result)||'');reader.onerror=reject;reader.readAsDataURL(blob);},'image/jpeg',.78); };
    image.onerror=()=>{URL.revokeObjectURL(source);reject(new Error('IMAGE_PROCESSING_FAILED'));}; image.src=source;
  });
  async function saveLogo(file?: File) { if (!file) return; try { setLogoData(await fileToData(file)); } catch { setError(t('genericError')); } }
  async function saveReceipt() {
    clearMessages();
    if (!receiptStore || !receiptFile) { setError(t('uploadRequired')); return; }
    if (!Number(purchaseAmount) || Number(purchaseAmount) <= 0 || !purchaseDate) { setError(t('incomplete')); return; }
    try {
      await submitReceipt.mutateAsync({ data: { merchantId:receiptStore.id, invoiceNumber: invoice || null, amount:Number(purchaseAmount), date:purchaseDate, imageData:receiptFile } });
      invalidate(); setDialog(null); setNotice(t('sendReceipt')); setReceiptFile(''); setInvoice(''); setPurchaseAmount('');
    } catch { setError(t('genericError')); }
  }
  const receiptDialog = dialog==='receipt' ? <Dialog close={()=>setDialog(null)} closeLabel={t('close')} title={t('receipt')}>
    <div style={{display:'grid',gap:14}}>
      <p className="subtle" style={{margin:0}}>{t('receiptHint')}</p>
      <SelectField label={t('merchantId')} value={receiptMerchantId || (selectedMerchant?.status==='active'?selectedMerchant.id:'')} onChange={setReceiptMerchantId} options={activeMerchants.map(m=>m.id)} formatOption={id=>activeMerchants.find(m=>m.id===id)?.name||id} testId="select-receipt-merchant"/>
      <Field label={t('amount')} value={purchaseAmount} onChange={setPurchaseAmount} type="number" min="0.01" step="0.01" testId="input-receipt-amount" required/>
      <Field label={t('date')} value={purchaseDate} onChange={setPurchaseDate} type="date" testId="input-receipt-date"/>
      <Field label={t('invoice')} value={invoice} onChange={setInvoice} testId="input-invoice"/>
      <label style={{display:'grid',gap:8,fontWeight:600}}>{t('upload')}<input type="file" accept="image/*" capture="environment" className="field" data-testid="input-receipt-photo" onChange={async e=>{if(e.target.files?.[0]){try{setReceiptFile(await fileToData(e.target.files[0]));}catch{setError(t('genericError'));}}}}/></label>
      <small className="subtle">{t('privacy')}</small>
      <button className="btn btn-primary" onClick={()=>void saveReceipt()} disabled={submitReceipt.isPending||activeMerchants.length===0} data-testid="button-submit-receipt"><Upload size={17}/>{submitReceipt.isPending?t('loading'):t('submit')}</button>
    </div>
  </Dialog> : null;
  const redeemDialog = dialog==='redeem' && selectedMerchant ? <Dialog close={()=>setDialog(null)} closeLabel={t('close')} title={t('redeem')}>
    <div style={{display:'grid',gap:14}}>
      <p className="subtle" style={{margin:0}}>{selectedMerchant.name}</p>
      <div style={{padding:16,borderRadius:14,background:'hsl(var(--muted))'}}><span className="subtle">{t('balance')}</span><strong style={{display:'block',fontSize:24}}>{formatMoney(selectedBalance,selectedMerchant.country)}</strong></div>
      <Field label={t('redeemAmount')} value={redeemAmount} onChange={setRedeemAmount} type="number" min="0.01" step="0.01" testId="input-redeem-amount"/>
      <button className="btn btn-primary" onClick={()=>void redeemAtMerchant()} disabled={redeem.isPending||selectedBalance<=0} data-testid="button-confirm-redeem">{t('confirmRedeem')}</button>
    </div>
  </Dialog> : null;
  async function redeemAtMerchant() {
    if (!selectedMerchant) return;
    const balance = Number(profile?.role==='customer' ? state.customers?.find(c=>c.id===profile.eid)?.cbm?.[selectedMerchant.id] ?? 0 : 0);
    if (!Number(redeemAmount) || Number(redeemAmount)>balance) { setError(t('incomplete')); return; }
    try { await redeem.mutateAsync({ data:{ merchantId:selectedMerchant.id, amount:Number(redeemAmount) } }); invalidate(); setDialog(null); setRedeemAmount(''); setNotice(t('redeemDone')); }
    catch { setError(t('genericError')); }
  }
  async function decideClaim(claim: Claim, approved: boolean) {
    try { await decideReceipt.mutateAsync({ id:claim.id, data:{ approved, ...(reason ? {reason} : {}) } }); invalidate(); setReason(''); setNotice(t('success')); }
    catch { setError(t('genericError')); }
  }
  async function decideShop(shop: Merchant, approved: boolean) {
    try { await decideMerchant.mutateAsync({ id:shop.id, data:{ approved, ...(reason ? {reason} : {}) } }); invalidate(); setReason(''); setNotice(t('success')); }
    catch { setError(t('genericError')); }
  }
  async function saveRate() {
    const rate=Number(rateValue || state.settings?.cashback || 0);
    if(!Number.isFinite(rate) || rate<0 || rate>100) { setError(t('incomplete')); return; }
    try { await updateRate.mutateAsync({ data:{ rate } }); invalidate(); setNotice(t('rateSaved')); }
    catch { setError(t('genericError')); }
  }
  async function logout() {
    try { await signOutFirebase(); } catch { /* Local view still exits if Firebase is unavailable. */ }
    client.clear(); setLocation('/'); setAuthMode('login'); setAuthStep('form');
  }
  const nav = (path: string) => { setLocation(path); setDialog(null); clearMessages(); };
  const header = (account = true) => <header style={{ maxWidth:1120, margin:'0 auto', padding:'14px 18px', display:'flex', alignItems:'center', justifyContent:'space-between', gap:12 }}>
    <button onClick={()=>nav('/')} data-testid="link-brand" style={{ border:0, background:'none', display:'flex', alignItems:'center', gap:10, cursor:'pointer', color:'inherit' }}><img src="/cashback-logo-transparent.png" alt="CASH BACK" style={{ width:54, height:46, objectFit:'contain', borderRadius:8 }} /><span style={{ fontWeight:800, letterSpacing:'.04em', fontSize:18 }}>CASH BACK</span></button>
    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
      <select aria-label={t('language')} className="field" style={{ width:94, minHeight:40, padding:'6px 8px' }} value={lang} onChange={e=>void changePreference(e.target.value as Lang,theme)} data-testid="select-language"><option value="en">English</option><option value="fr">Français</option><option value="ar">العربية</option></select>
      <IconButton onClick={()=>void changePreference(lang,theme==='dark'?'light':'dark')} label={t('theme')} testId="button-theme">{theme==='dark'?<Sun size={18}/>:<Moon size={18}/>}</IconButton>
      {account && profile && <IconButton onClick={()=>nav('/settings')} label={t('settings')} testId="button-settings"><Settings size={18}/></IconButton>}
      {account && profile && <IconButton onClick={()=>void logout()} label={t('signOut')} testId="button-header-logout"><LogOut size={18}/></IconButton>}
    </div>
  </header>;
  const shell = (content: ReactNode) => <div className="app-shell grain" dir={isRtl?'rtl':'ltr'}>{header()}<main className="page-enter" style={{ maxWidth:1120, margin:'0 auto', padding:'12px 18px 90px' }}>{content}</main></div>;
  const Empty = ({ icon, title, text }: { icon: ReactNode; title: string; text: string }) => <div className="surface" style={{ padding:'38px 24px', textAlign:'center' }}><div style={{ color:'hsl(var(--primary))', marginBottom:10 }}>{icon}</div><h3 style={{ margin:'0 0 6px', fontSize:20 }}>{title}</h3><p className="subtle" style={{ maxWidth:440, margin:'0 auto', lineHeight:1.65 }}>{text}</p></div>;
  const noticeBox = (text:string, isError=false) => <div role={isError?'alert':'status'} data-testid={isError?'status-error':'status-success'} style={{ background:isError?'hsl(var(--destructive) / .12)':'hsl(var(--primary) / .12)', color:isError?'hsl(var(--destructive))':'hsl(var(--foreground))', padding:'12px 15px', borderRadius:12, marginBottom:14, fontWeight:600 }}>{text}</div>;
  const statusLabel = (s:string) => s==='approved'?t('approved'):s==='rejected'?t('rejected'):t('pending');
  const statusPill = (s:string) => <span className="status-pill" data-testid={`status-${s}`}>{statusLabel(s)}</span>;

  if (splash) return <div className="splash"><img src="/splash.png" alt="CASH BACK" /></div>;
  if (isLoading && !profile) return <div className="app-shell" style={{ minHeight:'100dvh', display:'grid', placeItems:'center', padding:22 }}><div className="surface" style={{ width:'min(100%,420px)', padding:30, textAlign:'center' }}><div style={{ width:52,height:52,borderRadius:16,background:'hsl(var(--muted))',margin:'0 auto 14px' }} /><div style={{ height:15,width:'60%',borderRadius:8,background:'hsl(var(--muted))',margin:'0 auto 9px' }}/><p className="subtle">{t('loading')}</p></div></div>;
  if (profile && isError) return shell(<div style={{ maxWidth:540, margin:'50px auto' }}>{noticeBox(t('loadError'),true)}<button className="btn btn-primary" onClick={()=>void refetch()} data-testid="button-retry">{t('retryLoad')} <RefreshCw size={16}/></button></div>);

  if (!profile) {
    const activeAuth = authMode==='register' ? t('createAccount') : authMode==='reset' ? t('reset') : authMode==='phone' ? t('phoneLogin') : t('login');
    return <div className="app-shell grain" dir={isRtl?'rtl':'ltr'}>
      {header(false)}
      <main style={{ maxWidth:1040, margin:'0 auto', padding:'24px 18px 60px', display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(min(100%,360px),1fr))', gap:24, alignItems:'stretch' }}>
        <section style={{ minHeight:500, padding:'clamp(28px,5vw,58px)', borderRadius:28, background:'linear-gradient(145deg,#241208,#361706 62%,#17100a)', color:'#fff3dd', display:'flex', flexDirection:'column', justifyContent:'space-between', overflow:'hidden', position:'relative' }}>
          <div style={{ position:'absolute', inset:'auto -15% -27% auto', width:360,height:360,border:'1px solid #ff9c2b55',borderRadius:'50%', boxShadow:'0 0 0 35px #ff9c2b0d,0 0 0 75px #ff9c2b08' }}/>
          <div style={{ position:'relative' }}><span style={{ color:'#ffad3e', fontWeight:700, fontSize:13, letterSpacing:'.15em' }}>{t('localTag')}</span><h1 style={{ fontSize:'clamp(36px,6vw,62px)', lineHeight:1.03, margin:'22px 0 15px', maxWidth:480 }}>{t('customerEntry')}</h1><p style={{ color:'#e7c9a5', maxWidth:460, fontSize:17, lineHeight:1.65 }}>{t('customerBlurb')}</p></div>
          <div style={{ position:'relative', display:'flex', gap:13, alignItems:'center', marginTop:34 }}><div style={{ width:46,height:46,borderRadius:15,display:'grid',placeItems:'center',background:'#ff9e26',color:'#211006' }}><Wallet size={23}/></div><div><strong style={{ display:'block' }}>{t('separationNudge')}</strong><span style={{ color:'#d7b691',fontSize:13 }}>{t('separationHint')}</span></div></div>
        </section>
        <section className="surface" style={{ padding:'clamp(22px,4vw,36px)', borderRadius:26, alignSelf:'center' }}>
          <div style={{ display:'flex',gap:6, padding:4, borderRadius:13,background:'hsl(var(--muted))',marginBottom:24 }}>
            <button className={`btn ${registerRole==='customer'?'btn-primary':''}`} style={{ flex:1,background:registerRole==='customer'?undefined:'transparent' }} onClick={()=>{setRegisterRole('customer');setAuthMode('login');setAuthStep('form');clearMessages()}} data-testid="tab-customer"><UserRound size={16}/>{t('customer')}</button>
            <button className={`btn ${registerRole==='merchant'?'btn-primary':''}`} style={{ flex:1,background:registerRole==='merchant'?undefined:'transparent' }} onClick={()=>{setRegisterRole('merchant');setAuthMode('login');setAuthStep('form');clearMessages()}} data-testid="tab-merchant"><Store size={16}/>{t('merchant')}</button>
          </div>
          <div style={{ display:'flex',alignItems:'center',gap:12,marginBottom:18 }}><div style={{ width:42,height:42,borderRadius:13,background:'hsl(var(--primary) / .16)',color:'hsl(var(--primary))',display:'grid',placeItems:'center' }}>{registerRole==='merchant'?<Store size={20}/>:<Wallet size={20}/>}</div><div><h2 style={{ margin:0,fontSize:24 }}>{authStep==='sms'?t('verify'):activeAuth}</h2><span className="subtle" style={{ fontSize:13 }}>{t('welcome')}</span></div></div>
          {error && noticeBox(error,true)}{notice && noticeBox(notice)}
          {authStep==='sms' ? <div style={{ display:'grid',gap:15 }}>
            <p className="subtle" style={{ margin:0 }}>{t('phoneStep')}</p>
            <Field label={t('code')} value={code} onChange={setCode} testId="input-phone-code" placeholder="123456" />
            <button className="btn btn-primary" onClick={()=>authMode==='register'?void finishRegistration():void confirmPhone()} data-testid="button-verify-code">{t('verifyCode')} <ArrowRight size={17}/></button>
            <button className="btn btn-outline" onClick={()=>{setAuthStep('form');setCode('')}} data-testid="button-back">{t('back')}</button>
          </div> : authMode==='register' ? <div style={{ display:'grid',gap:13 }}>
            <Field label={registerRole==='merchant'?t('shopName'):t('name')} value={name} onChange={setName} testId="input-name" required/>
            <Field label={t('phone')} value={phone} onChange={setPhone} testId="input-phone" type="tel" required={!firebaseUser?.phoneNumber} placeholder="+213 …"/>
            {(!firebaseUser || (firebaseUser.phoneNumber && registerRole==='merchant')) && <>
              <Field label={t('email')} value={email} onChange={setEmail} testId="input-email" type="email" required={registerRole==='merchant'||!firebaseUser?.phoneNumber}/>
              <Field label={t('password')} value={password} onChange={setPassword} testId="input-password" type="password" required={registerRole==='merchant'||!firebaseUser?.phoneNumber}/>
              <Field label={t('confirmPassword')} value={confirm} onChange={setConfirm} testId="input-confirm-password" type="password" required={registerRole==='merchant'||!firebaseUser?.phoneNumber}/>
            </>}
            {registerRole==='merchant' && <>
              <label style={{display:'grid',gap:6,fontSize:14,fontWeight:600}}>{t('country')}<select className="field" value={country} onChange={e=>{setCountry(e.target.value);setCity('')}} data-testid="select-country"><option value="Algeria">{t('algeria')}</option><option value="Libya">{t('libya')}</option></select></label>
              <SelectField label={t('city')} value={city} onChange={setCity} options={country==='Algeria'?wilayas:libyanCities} testId="select-city" formatOption={(_option,index)=>lang==='ar'?(country==='Algeria'?wilayasArabic[index]:libyanCitiesArabic[index]):_option}/>
              <Field label={t('location')} value={address} onChange={setAddress} testId="input-address" required/>
              <Field label={t('mapLink')} value={mapsUrl} onChange={setMapsUrl} testId="input-map" placeholder={t('mapNote')}/>
              <label style={{display:'grid',gap:6,fontSize:14,fontWeight:600}}>{t('category')}<select className="field" value={category} onChange={e=>setCategory(e.target.value)} data-testid="input-category" required><option value="">—</option>{['restaurants','cafes','clothing','electronics','malls','groceries','perfume','gifts','shops','other'].map(key=><option key={key} value={key}>{t(`cat_${key}`)}</option>)}</select></label>
              <label style={{ display:'grid',gap:6,fontSize:14,fontWeight:600 }}>{t('logo')}<input className="field" type="file" accept="image/*" onChange={e=>void saveLogo(e.target.files?.[0])} data-testid="input-shop-logo"/>{logoData && <span className="subtle">✓ {t('choose')}</span>}</label>
            </>}
            <button className="btn btn-primary" onClick={()=>void beginRegistration()} disabled={register.isPending} data-testid="button-register">{register.isPending?t('loading'):t('continue')} <ArrowRight size={17}/></button>
            <button className="btn" style={{ background:'transparent',color:'hsl(var(--muted-foreground))' }} onClick={()=>{setAuthMode('login');clearMessages()}} data-testid="button-existing-account">{t('haveAccount')} {t('login')}</button>
          </div> : authMode==='reset' ? <div style={{ display:'grid',gap:14 }}><Field label={t('email')} value={email} onChange={setEmail} testId="input-email" type="email"/><button className="btn btn-primary" onClick={()=>void resetPassword()} data-testid="button-reset">{t('reset')} <ArrowRight size={17}/></button><button className="btn btn-outline" onClick={()=>setAuthMode('login')} data-testid="button-back-login">{t('back')}</button></div> : authMode==='phone' ? <div style={{ display:'grid',gap:14 }}><Field label={t('phone')} value={phone} onChange={setPhone} testId="input-phone" type="tel"/><button className="btn btn-primary" onClick={()=>void beginPhone()} data-testid="button-send-phone-code">{t('sendCode')} <ArrowRight size={17}/></button><button className="btn btn-outline" onClick={()=>setAuthMode('login')} data-testid="button-email-login">{t('emailLogin')}</button></div> :
          <div style={{ display:'grid',gap:14 }}>
            {isError && queryError && noticeBox(t('loadError'),true)}
            <Field label={t('email')} value={email} onChange={setEmail} testId="input-email" type="email" required/>
            <Field label={t('password')} value={password} onChange={setPassword} testId="input-password" type="password" required/>
            <button className="btn" style={{ justifyContent:'flex-end',background:'transparent',color:'hsl(var(--primary))',padding:0,minHeight:26 }} onClick={()=>{setAuthMode('reset');clearMessages()}} data-testid="button-forgot">{t('forgot')}</button>
            <button className="btn btn-primary" onClick={()=>void signIn()} data-testid="button-login">{t('login')} <ArrowRight size={17}/></button>
            <button className="btn btn-outline" onClick={()=>void beginPhone()} data-testid="button-phone-login">{t('phoneLogin')}</button>
            <div style={{ textAlign:'center', color:'hsl(var(--muted-foreground))',fontSize:14 }}>{t('noAccount')} <button onClick={()=>{setAuthMode('register');clearMessages()}} style={{ border:0,background:'transparent',color:'hsl(var(--primary))',fontWeight:700,cursor:'pointer' }} data-testid="button-create-account">{t('createAccount')}</button></div>
          </div>}
        </section>
      </main>
      <div style={{ maxWidth:1040,margin:'0 auto',padding:'0 18px 30px',textAlign:'center' }}><button className="btn btn-outline" onClick={()=>{setRegisterRole('merchant');setAuthMode('register');setAuthStep('form')}} data-testid="button-merchant-apply"><Store size={17}/>{t('applyShop')}</button><p className="subtle" style={{ fontSize:12,marginTop:14 }}>{t('tagline')}</p></div>
    </div>;
  }

  if (location.startsWith('/settings')) return shell(<SettingsPage lang={lang} theme={theme} setPreference={changePreference} t={t} profile={profile} logout={logout} notice={notice} error={error} />);
  if (customer && location.startsWith('/profile')) return shell(<section style={{maxWidth:740,margin:'20px auto',display:'grid',gap:18}}><PageTitle icon={<UserRound/>} title={t('profile')} eyebrow={t('profileText')}/><div className="surface" style={{padding:24,display:'grid',gap:15}}><InfoRow label={t('name')} value={profile.name}/><InfoRow label={t('phone')} value={profile.phone||'—'}/><InfoRow label={t('email')} value={profile.email||'—'}/><button className="btn btn-outline" onClick={()=>void logout()} data-testid="button-logout"><LogOut size={17}/>{t('signOut')}</button></div></section>);
  if (customer && location === '/wallet') return shell(<CustomerWallet profile={profile} state={state} merchants={merchants} txns={txns} claims={claims} setSelected={(m)=>{setSelectedMerchant(m);nav(`/wallet/${m.id}`)}} t={t} lang={lang} />);
  if (customer && location.startsWith('/wallet/')) {
    const mid=location.split('/')[2]; const shop=merchants.find(m=>m.id===mid);
    return <>{shell(shop?<WalletDetail shop={shop} profile={profile} state={state} txns={txns} t={t} openRedeem={()=>{setSelectedMerchant(shop);setDialog('redeem');}}/>:<Empty icon={<Wallet size={28}/>} title={t('walletTitle')} text={t('noShopsHint')}/>)}{redeemDialog}</>;
  }
  if (customer && selectedMerchant && location.startsWith('/shop/')) return <>{shell(<ShopDetail shop={selectedMerchant} t={t} lang={lang} onBack={()=>nav('/')} onReceipt={()=>{setReceiptMerchantId(selectedMerchant.id);setDialog('receipt');}} onWallet={()=>nav(`/wallet/${selectedMerchant.id}`)} />)}{receiptDialog}</>;
  if (customer && location.startsWith('/shop')) return shell(<Empty icon={<Store size={28}/>} title={t('details')} text={t('noShopsHint')}/>);
  if (customer && location.startsWith('/settings')) return null;

  if (merchant) {
    const status=profile.status || merchants.find(m=>m.id===profile.eid)?.status || 'pending';
    if (status==='pending' || status==='rejected') return shell(<div style={{maxWidth:670,margin:'32px auto'}}>{error&&noticeBox(error,true)}<div className="surface" style={{padding:'clamp(24px,6vw,44px)',textAlign:'center'}}><div style={{width:74,height:74,borderRadius:24,margin:'0 auto 18px',display:'grid',placeItems:'center',background:status==='pending'?'hsl(var(--secondary) / .28)':'hsl(var(--destructive) / .12)',color:status==='pending'?'hsl(var(--primary))':'hsl(var(--destructive))'}}>{status==='pending'?<Clock3 size={34}/>:<ShieldCheck size={34}/>}</div><span className="status-pill">{statusLabel(status)}</span><h1 style={{fontSize:34,margin:'14px 0 8px'}}>{status==='pending'?t('statusPending'):t('statusRejected')}</h1><p className="subtle" style={{fontSize:16,lineHeight:1.7}}>{status==='pending'?t('pendingHint'):profile.rejectionReason||t('retry')}</p><button className="btn btn-outline" style={{marginTop:18}} onClick={()=>void logout()} data-testid="button-logout"><LogOut size={17}/>{t('signOut')}</button></div></div>);
    const shop=merchants.find(m=>m.id===profile.eid);
    return shell(<MerchantDashboard shop={shop} state={state} claims={claims} t={t} notice={notice} error={error} />);
  }
  if (admin) return shell(<AdminDashboard merchants={merchants} claims={claims} state={state} t={t} lang={lang} reason={reason} setReason={setReason} decideShop={decideShop} decideClaim={decideClaim} rate={rateValue} setRate={setRateValue} saveRate={saveRate} notice={notice} error={error} />);
  if (!customer) return shell(<Empty icon={<CircleHelp size={28}/>} title={t('noPermission')} text={t('retryLoad')}/>);

  return <>
    {shell(<>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:16,margin:'8px 0 24px',flexWrap:'wrap'}}>
        <div><span className="subtle" style={{fontWeight:600}}>{t('hello')},</span><h1 style={{fontSize:'clamp(28px,4vw,38px)',margin:'0',lineHeight:1.2}}>{profile.name}</h1></div>
        <button className="btn btn-outline" onClick={()=>nav('/wallet')} data-testid="button-wallet"><Wallet size={18}/>{t('wallet')}</button>
      </div>
      <section style={{borderRadius:24,padding:'clamp(22px,4vw,36px)',background:'linear-gradient(112deg,#ef7f12,#f5a52d 55%,#f8c45c)',color:'#241307',display:'flex',justifyContent:'space-between',alignItems:'center',gap:16,overflow:'hidden',position:'relative',marginBottom:28}}>
        <div style={{position:'relative',zIndex:1,maxWidth:540}}><span style={{fontSize:12,fontWeight:800,letterSpacing:'.13em'}}>{t('tagline')}</span><h2 style={{fontSize:'clamp(26px,4vw,40px)',lineHeight:1.1,margin:'10px 0'}}>{t('nearby')}</h2><p style={{fontSize:15,margin:0,maxWidth:440,lineHeight:1.55}}>{t('customerBlurb')}</p></div><div style={{fontSize:80,opacity:.18,transform:'rotate(-12deg)'}}><Wallet size={100}/></div>
      </section>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:12,marginBottom:14}}><h2 style={{margin:0,fontSize:24}}>{t('allShops')}</h2><div style={{position:'relative',width:'min(100%,300px)'}}><Search size={17} style={{position:'absolute',top:14,left:isRtl?'auto':12,right:isRtl?12:'auto',color:'hsl(var(--muted-foreground))'}}/><input className="field" style={{paddingInlineStart:38}} value={search} onChange={e=>setSearch(e.target.value)} placeholder={t('search')} data-testid="input-search-shops"/></div></div>
        {filtered.length===0 ? <Empty icon={<Compass size={30}/>} title={t('noShops')} text={t('noShopsHint')}/> : <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(min(100%,250px),1fr))',gap:14}}>{filtered.map(shop=><button key={shop.id} className="surface" onClick={()=>nav(`/shop/${shop.id}`)} data-testid={`card-shop-${shop.id}`} style={{padding:0,textAlign:'start',overflow:'hidden',color:'inherit',cursor:'pointer'}}><MediaImage id={shop.logoId} alt={shop.name} style={{width:'100%',height:148,objectFit:'cover'}}/><div style={{padding:16}}><div style={{display:'flex',justifyContent:'space-between',gap:10,alignItems:'start'}}><div><h3 style={{margin:'0 0 4px',fontSize:19}}>{shop.name}</h3><span className="subtle" style={{fontSize:13}}>{shop.cat?t(`cat_${shop.cat}`):localizeCity(shop.city,lang)||t('allShops')}</span></div><span style={{fontWeight:800,color:'hsl(var(--primary))'}}>{shop.cashbackRate ?? 0}%</span></div><div className="subtle" style={{display:'flex',alignItems:'center',gap:5,marginTop:13,fontSize:13}}><MapPin size={14}/>{localizeCity(shop.city,lang)||shop.address||''}</div></div></button>)}</div>}
      <div style={{marginTop:30}}><h2 style={{fontSize:22}}>{t('receipt')}</h2>{claims.filter(c=>c.cid===profile.eid).length===0?<div className="surface" style={{padding:16,display:'flex',alignItems:'center',gap:12}}><ReceiptText size={22} color="hsl(var(--primary))"/><div><strong>{t('noReceipts')}</strong><div className="subtle" style={{fontSize:13}}>{t('receiptHint')}</div></div></div>:<div style={{display:'grid',gap:9}}>{claims.filter(c=>c.cid===profile.eid).map(c=><ClaimRow key={c.id} claim={c} shop={merchants.find(m=>m.id===c.mid)} t={t}/>)}</div>}</div>
    </>)}
    <button className="btn btn-primary" onClick={()=>{setReceiptMerchantId(selectedMerchant?.id||'');setDialog('receipt');}} aria-label={t('receipt')} data-testid="button-global-receipt" style={{position:'fixed',zIndex:20,bottom:'calc(68px + env(safe-area-inset-bottom))',left:'50%',transform:'translateX(-50%)',width:64,height:64,padding:0,borderRadius:32,boxShadow:'0 8px 30px hsl(var(--primary) / .4)'}}><Camera size={25}/></button>
    <BottomNav path={location} nav={nav} t={t}/>
    {receiptDialog}{redeemDialog}
  </>;
}

function PageTitle({icon,title,eyebrow}:{icon:ReactNode;title:string;eyebrow:string}) { return <div style={{display:'flex',alignItems:'center',gap:14}}><div style={{width:48,height:48,borderRadius:16,background:'hsl(var(--primary) / .15)',color:'hsl(var(--primary))',display:'grid',placeItems:'center'}}>{icon}</div><div><span className="subtle" style={{fontSize:13}}>{eyebrow}</span><h1 style={{margin:0,fontSize:30}}>{title}</h1></div></div>; }
function InfoRow({label,value}:{label:string;value:string}) { return <div style={{display:'flex',justifyContent:'space-between',gap:10,borderBottom:'1px solid hsl(var(--border))',paddingBottom:12}}><span className="subtle">{label}</span><strong data-testid={`text-${label}`}>{value}</strong></div>; }
function SettingsPage({lang,theme,setPreference,t,profile,logout,notice,error}:{lang:Lang;theme:Theme;setPreference:(l:Lang,th:Theme)=>Promise<void>;t:(s:string)=>string;profile:Session['profile'];logout:()=>void;notice:string;error:string}) {
  return <div style={{maxWidth:720,margin:'18px auto',display:'grid',gap:20}}><PageTitle icon={<Settings/>} title={t('settings')} eyebrow={t('preferences')}/>{error&&<div role="alert" className="surface" style={{padding:14,color:'hsl(var(--destructive))'}}>{error}</div>}{notice&&<div role="status" className="surface" style={{padding:14}}>{notice}</div>}<section className="surface" style={{padding:22,display:'grid',gap:20}}><div><strong style={{display:'block',marginBottom:8}}>{t('language')}</strong><div style={{display:'flex',gap:8,flexWrap:'wrap'}}>{([['en','English'],['fr','Français'],['ar','العربية']] as const).map(([key,label])=><button key={key} onClick={()=>void setPreference(key,theme)} className={`btn ${lang===key?'btn-primary':'btn-outline'}`} data-testid={`button-language-${key}`}>{label}</button>)}</div></div><div><strong style={{display:'block',marginBottom:8}}>{t('theme')}</strong><div style={{display:'flex',gap:8}}>{(['light','dark'] as Theme[]).map(v=><button key={v} onClick={()=>void setPreference(lang,v)} className={`btn ${theme===v?'btn-primary':'btn-outline'}`} data-testid={`button-theme-${v}`}>{v==='dark'?<Moon size={16}/>:<Sun size={16}/>} {t(v)}</button>)}</div></div></section><section className="surface" style={{padding:22,display:'grid',gap:14}}><strong>{t('profileText')}</strong><InfoRow label={t('name')} value={profile.name}/><InfoRow label={t('email')} value={profile.email||'—'}/><InfoRow label={t('phone')} value={profile.phone||'—'}/><button className="btn btn-outline" onClick={logout} data-testid="button-logout"><LogOut size={17}/>{t('signOut')}</button></section></div>;
}
function BottomNav({path,nav,t}:{path:string;nav:(path:string)=>void;t:(s:string)=>string}) {
  const items=[['/',<Compass size={19}/>,t('home')],['/wallet',<Wallet size={19}/>,t('wallet')],['/profile',<UserRound size={19}/>,t('profile')],['/settings',<Settings size={19}/>,t('settings')]] as const;
  return <nav style={{position:'fixed',zIndex:10,bottom:0,left:0,right:0,display:'flex',justifyContent:'center',padding:'8px 12px calc(8px + env(safe-area-inset-bottom))',background:'hsl(var(--card) / .96)',borderTop:'1px solid hsl(var(--border))',backdropFilter:'blur(12px)'}}>{items.map(([href,icon,label])=><button key={href} onClick={()=>nav(href)} data-testid={`nav-${href.replace('/','')||'home'}`} style={{flex:1,maxWidth:140,display:'grid',justifyItems:'center',gap:2,border:0,background:'transparent',color:path===href||path.startsWith(href+'/')?'hsl(var(--primary))':'hsl(var(--muted-foreground))',padding:6,cursor:'pointer',fontSize:11,fontWeight:700}}>{icon}{label}</button>)}</nav>;
}
function ClaimRow({claim,shop,t}:{claim:Claim;shop?:Merchant;t:(s:string)=>string}) { return <div className="surface" data-testid={`row-claim-${claim.id}`} style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:10,padding:14}}><div><strong>{shop?.name||t('merchantId')}</strong><div className="subtle" style={{fontSize:12}}>{claim.date||claim.created||'—'} · {formatMoney(claim.amount,shop?.country)}</div></div><span className="status-pill">{claim.status==='approved'?t('approved'):claim.status==='rejected'?t('rejected'):t('pending')}</span></div>; }
function CustomerWallet({profile,state,merchants,txns,claims,setSelected,t,lang}:{profile:Session['profile'];state:Session['state'];merchants:Merchant[];txns:Txn[];claims:Claim[];setSelected:(m:Merchant)=>void;t:(s:string)=>string;lang:Lang}) {
  const cbm=state.customers?.find(c=>c.id===profile.eid)?.cbm||{};
  const list=merchants.filter(m=>m.status==='active');
  return <div style={{display:'grid',gap:20,marginTop:14}}><PageTitle icon={<Wallet/>} title={t('walletTitle')} eyebrow={t('walletHint')}/>{list.length===0?<div className="surface" style={{padding:30,textAlign:'center'}}><Wallet size={27} color="hsl(var(--primary))"/><h3>{t('noActivity')}</h3><p className="subtle">{t('noShopsHint')}</p></div>:<div style={{display:'grid',gap:14}}>{list.map(shop=>{const earned=txns.filter(x=>x.cid===profile.eid&&x.mid===shop.id).reduce((n,x)=>n+Number(x.cashback||0),0);const used=state.cbpays?.filter(x=>x.cid===profile.eid&&x.mid===shop.id&&(x.status==='done'||x.status==='approved')).reduce((n,x)=>n+Number(x.amount||0),0)||0;return <button onClick={()=>setSelected(shop)} key={shop.id} className="surface" data-testid={`card-wallet-${shop.id}`} style={{color:'inherit',textAlign:'start',padding:20,cursor:'pointer',display:'grid',gridTemplateColumns:'1fr auto',gap:12}}><div><span className="subtle">{shop.cat?t(`cat_${shop.cat}`):localizeCity(shop.city,lang)||t('merchantId')}</span><h2 style={{margin:'2px 0',fontSize:22}}>{shop.name}</h2><div className="subtle" style={{fontSize:13}}>{t('earned')} {formatMoney(earned,shop.country)} · {t('used')} {formatMoney(used,shop.country)}</div></div><div style={{textAlign:'end'}}><span className="subtle" style={{fontSize:12}}>{t('balance')}</span><strong style={{display:'block',fontSize:24,color:'hsl(var(--primary))'}}>{formatMoney(Number(cbm[shop.id]||0),shop.country)}</strong><ArrowRight size={17}/></div></button>})}</div>}</div>;
}
function WalletDetail({shop,profile,state,txns,t,openRedeem}:{shop:Merchant;profile:Session['profile'];state:Session['state'];txns:Txn[];t:(s:string)=>string;openRedeem:()=>void}) {
  const customer=state.customers?.find(c=>c.id===profile.eid);const balance=Number(customer?.cbm?.[shop.id]||0);
  const entries=txns.filter(x=>x.cid===profile.eid&&x.mid===shop.id);
  const earned=entries.reduce((a,x)=>a+Number(x.cashback||0),0);const used=state.cbpays?.filter(x=>x.cid===profile.eid&&x.mid===shop.id&&(x.status==='done'||x.status==='approved')).reduce((a,x)=>a+Number(x.amount||0),0)||0;
  return <div style={{maxWidth:780,margin:'18px auto',display:'grid',gap:17}}><PageTitle icon={<Wallet/>} title={shop.name} eyebrow={t('walletHint')}/><section style={{padding:25,borderRadius:22,background:'linear-gradient(125deg,#ef7f12,#f1b445)',color:'#241307'}}><span style={{fontWeight:700}}>{t('balance')}</span><strong style={{display:'block',fontSize:42,lineHeight:1.25}}>{formatMoney(balance,shop.country)}</strong><div style={{display:'flex',gap:20,marginTop:10,fontSize:14}}><span>{t('earned')}: {formatMoney(earned,shop.country)}</span><span>{t('used')}: {formatMoney(used,shop.country)}</span></div></section><button onClick={openRedeem} className="btn btn-primary" disabled={balance<=0} data-testid="button-redeem"><Banknote size={18}/>{t('redeem')} · {shop.name}</button><section><h2 style={{fontSize:22}}>{t('ledger')}</h2>{entries.length===0?<div className="surface" style={{padding:20}}><p className="subtle">{t('noActivity')}</p></div>:entries.map(x=><div className="surface" key={x.id} data-testid={`row-ledger-${x.id}`} style={{display:'flex',justifyContent:'space-between',padding:14,marginBottom:8}}><span>{x.t||t('earned')}</span><strong>{formatMoney(x.cashback||0,shop.country)}</strong></div>)}</section></div>;
}
function ShopDetail({shop,t,onBack,onReceipt,onWallet,lang}:{shop:Merchant;t:(s:string)=>string;onBack:()=>void;onReceipt:()=>void;onWallet:()=>void;lang:Lang}) {
  return <div style={{maxWidth:820,margin:'10px auto',display:'grid',gap:18}}><button onClick={onBack} className="btn btn-outline" style={{justifySelf:'start'}} data-testid="button-back-shops"><ArrowLeft size={17}/>{t('allShops')}</button><div className="surface" style={{overflow:'hidden'}}><MediaImage id={shop.logoId} alt={shop.name} style={{width:'100%',height:'clamp(180px,38vw,330px)',objectFit:'cover'}}/><div style={{padding:'clamp(20px,4vw,32px)'}}><div style={{display:'flex',justifyContent:'space-between',gap:10,alignItems:'start'}}><div><span className="subtle">{shop.cat?t(`cat_${shop.cat}`):t('merchant')}</span><h1 style={{fontSize:34,margin:'3px 0'}}>{shop.name}</h1></div><div style={{color:'hsl(var(--primary))',fontSize:25,fontWeight:800}}>{shop.cashbackRate??0}%</div></div><p className="subtle" style={{display:'flex',alignItems:'center',gap:6}}><MapPin size={16}/>{shop.address||localizeCity(shop.city,lang)}</p>{shop.mapsUrl&&<a href={shop.mapsUrl} target="_blank" rel="noreferrer" className="btn btn-outline" style={{textDecoration:'none'}} data-testid="link-shop-map"><LocateFixed size={17}/>{t('shopOpen')}</a>}<div style={{display:'flex',gap:10,flexWrap:'wrap',marginTop:20}}><button className="btn btn-primary" onClick={onReceipt} data-testid="button-shop-receipt"><ReceiptText size={18}/>{t('receipt')}</button><button className="btn btn-outline" onClick={onWallet} data-testid="button-shop-wallet"><Wallet size={18}/>{t('spendHere')}</button></div></div></div></div>;
}
function MerchantDashboard({shop,state,claims,t,notice,error}:{shop?:Merchant;state:Session['state'];claims:Claim[];t:(s:string)=>string;notice:string;error:string}) {
  const ownClaims=claims.filter(c=>c.mid===shop?.id);const open=ownClaims.filter(c=>c.status==='pending');
  return <div style={{maxWidth:900,margin:'18px auto',display:'grid',gap:20}}>{error&&<div role="alert" className="surface" style={{padding:12,color:'hsl(var(--destructive))'}}>{error}</div>}{notice&&<div role="status" className="surface" style={{padding:12}}>{notice}</div>}<PageTitle icon={<Store/>} title={shop?.name||t('merchantDashboard')} eyebrow={t('merchantActive')}/><div className="surface" style={{padding:20,display:'flex',alignItems:'start',gap:14}}><BadgeCheck color="hsl(var(--primary))"/><div><strong>{t('merchantActive')}</strong><p className="subtle" style={{margin:'4px 0'}}>{t('salesOnly')}</p></div></div><div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(170px,1fr))',gap:12}}><Metric label={t('customers')} value={String(state.customers?.length||0)} icon={<UserRound/>}/><Metric label={t('sales')} value={String(ownClaims.filter(c=>c.status==='approved').length)} icon={<ReceiptText/>}/><Metric label={t('receiptQueue')} value={String(open.length)} icon={<Clock3/>}/></div><section className="surface" style={{padding:20}}><strong>{t('rate')}</strong><strong style={{display:'block',fontSize:30,color:'hsl(var(--primary))'}}>{shop?.cashbackRate??0}%</strong>{shop?.publicId&&<div style={{marginTop:14,display:'grid',gridTemplateColumns:'auto 1fr',alignItems:'center',gap:14}}><QRCodeSVG value={shop.qrValue||`cashback://merchant/${shop.publicId}`} size={156} bgColor="#ffffff" fgColor="#140b05" level="M"/><div><strong>{t('qrCode')}</strong><div className="subtle" style={{marginTop:6}}>{t('merchantId')}: {shop.publicId}</div></div></div>}</section><h2 style={{marginBottom:0}}>{t('receiptQueue')}</h2>{open.length===0?<div className="surface" style={{padding:20}}>{t('noPending')}</div>:open.map(c=><ClaimRow key={c.id} claim={c} shop={shop} t={t}/>)}</div>;
}
function Metric({label,value,icon}:{label:string;value:string;icon:ReactNode}) { return <div className="surface" style={{padding:17}}><div style={{color:'hsl(var(--primary))'}}>{icon}</div><strong style={{fontSize:27,display:'block'}}>{value}</strong><span className="subtle">{label}</span></div>; }
function AdminDashboard({merchants,claims,state,t,lang,reason,setReason,decideShop,decideClaim,rate,setRate,saveRate,notice,error}:{merchants:Merchant[];claims:Claim[];state:Session['state'];t:(s:string)=>string;lang:Lang;reason:string;setReason:(s:string)=>void;decideShop:(m:Merchant,a:boolean)=>void;decideClaim:(c:Claim,a:boolean)=>void;rate:string;setRate:(s:string)=>void;saveRate:()=>void;notice:string;error:string}) {
  const newMerchants=merchants.filter(m=>m.status==='pending');const newClaims=claims.filter(c=>c.status==='pending');
  return <div style={{maxWidth:1000,margin:'18px auto',display:'grid',gap:20}}>
    {error&&<div role="alert" className="surface" style={{padding:12,color:'hsl(var(--destructive))'}}>{error}</div>}
    {notice&&<div role="status" className="surface" style={{padding:12}}>{notice}</div>}
    <PageTitle icon={<ShieldCheck/>} title={t('adminDashboard')} eyebrow={t('merchantQueue')}/>
    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(170px,1fr))',gap:12}}>
      <Metric label={t('merchantQueue')} value={String(newMerchants.length)} icon={<Store/>}/>
      <Metric label={t('receiptQueue')} value={String(newClaims.length)} icon={<ReceiptText/>}/>
      <Metric label={t('customers')} value={String(state.customers?.length||0)} icon={<UserRound/>}/>
    </div>
    <section className="surface" style={{padding:18}}>
      <strong>{t('adminSettings')} · {t('rate')}</strong>
      <div style={{display:'flex',gap:9,marginTop:10}}>
        <input className="field" type="number" min="0" max="100" step=".1" value={rate||String(state.settings?.cashback||0)} onChange={e=>setRate(e.target.value)} data-testid="input-admin-rate"/>
        <button className="btn btn-primary" onClick={saveRate} data-testid="button-admin-save-rate"><Percent size={17}/>{t('save')}</button>
      </div>
    </section>
    <ReviewList title={t('merchantQueue')} empty={newMerchants.length===0?t('noPending'):''}>
      {newMerchants.map(m=><div className="surface" key={m.id} data-testid={`review-merchant-${m.id}`} style={{padding:16,display:'grid',gap:12}}>
        <div style={{display:'flex',gap:13,alignItems:'center'}}>
          <MediaImage id={m.logoId} alt={m.name} style={{width:64,height:64,objectFit:'cover',borderRadius:12}}/>
          <div>
            <strong style={{fontSize:18}}>{m.name}</strong>
            <div className="subtle">{m.cat?t(`cat_${m.cat}`):t('merchant')} · {localizeCity(m.city,lang)}, {t(m.country==='Libya'?'libya':'algeria')}</div>
            <div className="subtle">{m.address}</div>
            {m.mapsUrl&&<a href={m.mapsUrl} target="_blank" rel="noreferrer" style={{color:'hsl(var(--primary))'}}>{t('shopOpen')}</a>}
          </div>
        </div>
        <Field label={t('rejectionReason')} value={reason} onChange={setReason} testId={`input-reason-merchant-${m.id}`}/>
        <div style={{display:'flex',gap:9}}>
          <button className="btn btn-primary" onClick={()=>decideShop(m,true)} data-testid={`button-approve-merchant-${m.id}`}><Check size={17}/>{t('approve')}</button>
          <button className="btn btn-outline" onClick={()=>decideShop(m,false)} data-testid={`button-reject-merchant-${m.id}`}><X size={17}/>{t('decline')}</button>
        </div>
      </div>)}
    </ReviewList>
    <ReviewList title={t('receiptQueue')} empty={newClaims.length===0?t('noPending'):''}>
      {newClaims.map(c=>{
        const shop=merchants.find(m=>m.id===c.mid);
        return <div className="surface" key={c.id} data-testid={`review-receipt-${c.id}`} style={{padding:16,display:'grid',gap:12}}>
          <div><strong>{shop?.name||t('merchantId')}</strong><div className="subtle">{c.invoiceNumber||c.date||'—'} · {formatMoney(c.amount,shop?.country)}</div></div>
          {c.photoId&&<MediaImage id={c.photoId} alt={t('receipt')} style={{width:'100%',maxHeight:280,objectFit:'contain',background:'hsl(var(--muted))',borderRadius:12}}/>}
          <Field label={t('rejectionReason')} value={reason} onChange={setReason} testId={`input-reason-receipt-${c.id}`}/>
          <div style={{display:'flex',gap:9}}>
            <button className="btn btn-primary" onClick={()=>decideClaim(c,true)} data-testid={`button-approve-receipt-${c.id}`}><Check size={17}/>{t('approve')}</button>
            <button className="btn btn-outline" onClick={()=>decideClaim(c,false)} data-testid={`button-reject-receipt-${c.id}`}><X size={17}/>{t('decline')}</button>
          </div>
        </div>;
      })}
    </ReviewList>
  </div>;
}
function ReviewList({title,empty,children}:{title:string;empty:string;children:ReactNode}) { return <section style={{display:'grid',gap:12}}><h2 style={{margin:0}}>{title}</h2>{empty?<div className="surface" style={{padding:22,textAlign:'center'}}><FileCheck2 size={26} color="hsl(var(--primary))"/><p className="subtle">{empty}</p></div>:children}</section>; }
function Dialog({title,children,close,closeLabel}:{title:string;children:ReactNode;close:()=>void;closeLabel:string}) { return <div className="dialog-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)close()}}><section className="dialog-panel" role="dialog" aria-modal="true" aria-label={title}><header style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}><h2 style={{margin:0,fontSize:23}}>{title}</h2><button onClick={close} className="btn btn-outline" style={{padding:8,minHeight:38}} aria-label={closeLabel} data-testid="button-close-dialog"><X size={17}/></button></header>{children}</section></div>; }
function Router() { return <AppInner/>; }
function App() { return <QueryClientProvider client={queryClient}><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/,'')}><Router/></WouterRouter></QueryClientProvider>; }
export default App;
