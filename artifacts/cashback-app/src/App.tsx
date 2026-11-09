import { useEffect, useMemo, useRef, useState } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import {
  getGetCashbackSessionQueryKey, getGetCashbackMediaQueryKey,
  useGetCashbackSession, useRegisterCashbackProfile, useSubmitCashbackReceipt,
  useDecideCashbackReceipt, useDecideCashbackMerchant, useRedeemMerchantCashback,
  useCreateCashbackPaymentSession, useReverseCashbackPayment,
  useUpdateCashbackPreferences, useUpdateCashbackRate, useGetCashbackMedia,
  useLoginCashback, useLogoutCashback, useCreateCashbackProfilePhotoUpload,
  useSaveCashbackProfilePhoto, useCreateCashbackReceiptPhotoUpload,
  useCancelCashbackReceipt, useRateCashbackMerchant, useUpdateCashbackCategories,
} from '@workspace/api-client-react';
import { useLocation } from 'wouter';
import { QRCodeSVG } from 'qrcode.react';
import {
  ArrowDownLeft, ArrowLeft, ArrowRight, BadgeCheck, Banknote, Bell, Camera, Check, ChevronDown, Home,
  CircleHelp, Clock3, Compass, Coffee, FileCheck2, FilePlus2, Gift, Globe2, Laptop, LogOut, MapPin, Moon, Share2,
  Plus, ReceiptText, Search, Settings, ShieldCheck, Store, Sun, UserRound, Wallet,
  X, RefreshCw, LockKeyhole, Percent, LocateFixed, MoreHorizontal, Shirt, ShoppingBag, Star, Tag, Utensils, Download, Printer, ScanLine, RotateCcw, FileDown,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { Route, Switch, Router as WouterRouter } from 'wouter';
import NotFound from '@/pages/not-found';

type Lang = 'en' | 'fr' | 'ar';
type Theme = 'dark' | 'light';
type Merchant = { id: string; name: string; cat?: string; status?: string; country?: string; city?: string; address?: string; mapsUrl?: string; lat?: number; lng?: number; cashbackRate?: number; logoId?: string; publicId?: string; qrValue?: string; description?: string; rating?: number; ratingCount?: number; userRating?: number; payoutBalance?: number; payoutDebt?: number };
type Claim = { id: string; mid: string; cid: string; invoiceNumber?: string; date?: string; amount: number; photoId?: string; status: string; created?: string; cashback?: number; reason?: string; submitIp?: string; submittedByUid?: string; possibleDuplicate?: boolean };
type Txn = { id: string; t?: string; mid: string; cid: string; amount: number; cashback?: number; method?: string };
type CashbackNote = { id: string; to?: string; text: string; t?: number; read?: boolean };
type Session = { profile: { uid: string; role: string; eid: string; name: string; phone?: string; email?: string; avatarUpdatedAt?: number; preferences?: { language?: Lang; theme?: Theme }; status?: string; rejectionReason?: string }; state: { settings?: { cashback?: number; claimHours?: number }; categories?: string[]; merchants?: Merchant[]; customers?: { id: string; name: string; phone?: string; cbm?: Record<string, number> }[]; claims?: Claim[]; txns?: Txn[]; cbpays?: { id: string; cid: string; mid: string; amount: number; status: string; at?: string|number; reference?: string; method?: string; reversalReason?: string }[]; notes?: CashbackNote[] } };
type Dict = Record<string, string>;
const dictionaries: Record<Lang, Dict> = {
  en: {
    tagline:'A little back, right where you shop.', algeria:'Algeria', libya:'Libya', localTag:'LOCAL REWARDS · NORTH AFRICA', separationNudge:'One shop. One balance.', separationHint:'Rewards stay with their shop.', welcome:'Good to see you.', login:'Sign in', createAccount:'Create account', customer:'Customer', merchant:'Shop owner', admin:'Administrator',
    email:'Email address', loginIdentifier:'Email or phone number', phoneNotVerified:'This phone number is not verified. SMS verification is unavailable; sign in with email instead.', phoneSignupHint:'SMS verification is not connected yet. Sign in with email until your phone is verified.', accountTypeMismatch:'This account does not match the selected account type.', rejectionReasonRequired:'Enter a reason before rejecting this application.', password:'Password', confirmPassword:'Confirm password', phone:'Phone number', name:'Full name', forgot:'Forgot password?', reset:'Send reset link', register:'Register', continue:'Continue', verify:'Verify phone', code:'SMS verification code', sendCode:'Send code', verifyCode:'Verify code', back:'Back to sign in',
    home:'Discover', wallet:'My rewards', profile:'Profile', settings:'Settings', signOut:'Sign out', hello:'Welcome back', nearby:'Shops worth coming back to', noShops:'Your local finds start here', noShopsHint:'Participating shops will appear when they join CASH BACK.', search:'Search shops or categories', details:'Shop details', earn:'Earn', cashback:'cashback', spendHere:'Spend rewards here', receipt:'Submit receipt', receiptHint:'Upload a clear photo of your receipt. Rewards are credited after review.', amount:'Purchase amount', invoice:'Invoice number (optional)', date:'Purchase date', upload:'Choose receipt photo', submit:'Send for review', walletTitle:'Your shop-by-shop rewards', walletHint:'Rewards belong to the shop that issued them. Spend them only there.', earned:'Earned', used:'Used', balance:'Available balance', ledger:'Activity', noActivity:'No activity yet', redeem:'Redeem rewards', redeemAmount:'Amount to redeem', confirmRedeem:'Confirm redemption', pending:'Under review', approved:'Approved', rejected:'Rejected', noReceipts:'No receipts yet', preferences:'Your preferences', language:'Language', theme:'Appearance', light:'Light', dark:'Dark', save:'Save preferences', saved:'Preferences saved', customerEntry:'Shopping locally pays you back.', customerBlurb:'Earn a separate reward balance at every participating shop. Keep it local. Spend it on your next visit.', shopEntry:'Bring your regulars back.', shopBlurb:'Apply to join a local rewards network that celebrates repeat visits.', applyShop:'Apply as a shop', statusPending:'Application in review', pendingHint:'We’re checking your shop details. Sales tools unlock after approval.', statusRejected:'Application not approved', reason:'Review note', retry:'Contact support for next steps', merchantDashboard:'Shop dashboard', merchantActive:'Your shop is live', salesOnly:'Your shop has been approved. Customer receipts are reviewed by the CASH BACK team.', rate:'Cashback rate', customers:'Customers', sales:'Sales', receiptQueue:'Receipt review', merchantQueue:'Merchant applications', adminDashboard:'Review desk', noPending:'All caught up', approve:'Approve', decline:'Decline', rejectionReason:'Reason (optional)', apply:'Submit application', country:'Country', city:'City / Wilaya', location:'Shop address', mapLink:'Maps link or coordinates', category:'Shop category', logo:'Shop photo or logo', shopName:'Shop name', choose:'Choose', close:'Close', loading:'Loading your account…', retryLoad:'Try again', loadError:'We could not load your account.', authError:'That didn’t work. Check your details and try again.', success:'Done', resetSent:'Password reset email sent.', noAccount:'New to CASH BACK?', haveAccount:'Already have an account?', shopOpen:'Open map', rateSaved:'Rate updated', allShops:'All shops', profileText:'Account details', adminSettings:'Program settings', claimHours:'Receipt claim window', noPermission:'This screen is not available for this account.', genericError:'Something went wrong. Please try again.', uploadRequired:'Please choose a photo first.', incomplete:'Complete all required fields.', passwordsDiffer:'Passwords do not match.', camera:'Use a clear photo', privacy:'Your receipt is shared only for reward review.', phoneStep:'We sent a code to your phone.', phoneLogin:'Sign in with phone', emailLogin:'Use email instead', mapNote:'Maps URL, or latitude and longitude', noHistory:'No purchases recorded yet', merchantId:'Shop', clear:'Clear', applyPending:'Application sent', sendReceipt:'Receipt sent for review', redeemDone:'Redemption recorded', finishPhoneProfile:'Your phone is verified. Complete your account details.', recentActivity:'Recent activity', shopArea:'Shop area', cat_restaurants:'Restaurants', cat_cafes:'Cafés', cat_clothing:'Clothing', cat_electronics:'Electronics', cat_malls:'Shopping centers', cat_groceries:'Groceries', cat_perfume:'Perfume', cat_gifts:'Gifts', cat_shops:'Other shops', cat_other:'Other', qrCode:'Shop QR code',
  },
  fr: {
    tagline:'Un petit retour, là où vous faites vos achats.', algeria:'Algérie', libya:'Libye', localTag:'RÉCOMPENSES LOCALES · AFRIQUE DU NORD', separationNudge:'Un commerce. Un solde.', separationHint:'Vos récompenses restent liées au commerce.', welcome:'Ravi de vous revoir.', login:'Se connecter', createAccount:'Créer un compte', customer:'Client', merchant:'Commerçant', admin:'Administrateur',
    email:'Adresse e-mail', loginIdentifier:'E-mail ou numéro de téléphone', phoneNotVerified:'Ce numéro n’est pas vérifié. La vérification par SMS est indisponible ; connectez-vous par e-mail.', phoneSignupHint:'La vérification SMS n’est pas configurée. Connectez-vous par e-mail jusqu’à la vérification du téléphone.', accountTypeMismatch:'Ce compte ne correspond pas au type de compte choisi.', rejectionReasonRequired:'Indiquez un motif avant de refuser cette demande.', password:'Mot de passe', confirmPassword:'Confirmer le mot de passe', phone:'Numéro de téléphone', name:'Nom complet', forgot:'Mot de passe oublié ?', reset:'Envoyer le lien', register:'Créer le compte', continue:'Continuer', verify:'Vérifier le téléphone', code:'Code de vérification SMS', sendCode:'Envoyer le code', verifyCode:'Vérifier le code', back:'Retour à la connexion',
    home:'Découvrir', wallet:'Mes récompenses', profile:'Profil', settings:'Paramètres', signOut:'Déconnexion', hello:'Bon retour', nearby:'Des commerces locaux à retrouver', noShops:'Vos adresses locales commencent ici', noShopsHint:'Les commerces participants apparaîtront lorsqu’ils rejoindront CASH BACK.', search:'Rechercher un commerce ou une catégorie', details:'Détails du commerce', earn:'Gagnez', cashback:'de cashback', spendHere:'Utiliser ici', receipt:'Envoyer un reçu', receiptHint:'Ajoutez une photo lisible. Les récompenses sont créditées après vérification.', amount:'Montant de l’achat', invoice:'Numéro de facture (facultatif)', date:'Date de l’achat', upload:'Choisir une photo du reçu', submit:'Envoyer pour vérification', walletTitle:'Vos récompenses, commerce par commerce', walletHint:'Les récompenses restent liées au commerce qui les a émises.', earned:'Gagné', used:'Utilisé', balance:'Solde disponible', ledger:'Activité', noActivity:'Aucune activité pour le moment', redeem:'Utiliser mes récompenses', redeemAmount:'Montant à utiliser', confirmRedeem:'Confirmer l’utilisation', pending:'En vérification', approved:'Approuvé', rejected:'Refusé', noReceipts:'Aucun reçu pour le moment', preferences:'Vos préférences', language:'Langue', theme:'Apparence', light:'Clair', dark:'Sombre', save:'Enregistrer les préférences', saved:'Préférences enregistrées', customerEntry:'Vos achats locaux vous récompensent.', customerBlurb:'Cumulez un solde distinct dans chaque commerce participant. Dépensez-le lors de votre prochaine visite.', shopEntry:'Faites revenir vos clients.', shopBlurb:'Rejoignez un réseau local de récompenses qui valorise la fidélité.', applyShop:'Inscrire mon commerce', statusPending:'Demande en cours', pendingHint:'Votre demande a bien été envoyée à l’administration. Les outils de vente seront accessibles après approbation.', statusRejected:'Demande non approuvée', reason:'Note de vérification', retry:'Contactez le support pour la suite', merchantDashboard:'Espace commerçant', merchantActive:'Votre commerce est actif', salesOnly:'Votre commerce est approuvé. Les reçus clients sont vérifiés par CASH BACK.', rate:'Taux de cashback', customers:'Clients', sales:'Ventes', receiptQueue:'Vérification des reçus', merchantQueue:'Demandes de commerces', adminDashboard:'Espace de vérification', noPending:'Tout est à jour', approve:'Approuver', decline:'Refuser', rejectionReason:'Motif du refus', apply:'Envoyer la demande', country:'Pays', city:'Ville / Wilaya', location:'Adresse du commerce', mapLink:'Lien Maps ou coordonnées', category:'Catégorie du commerce', logo:'Photo ou logo du commerce', shopName:'Nom du commerce', choose:'Choisir', close:'Fermer', loading:'Chargement du compte…', retryLoad:'Réessayer', loadError:'Impossible de charger votre compte.', authError:'Échec de la connexion. Vérifiez vos informations.', success:'Terminé', resetSent:'E-mail de réinitialisation envoyé.', noAccount:'Nouveau sur CASH BACK ?', haveAccount:'Vous avez déjà un compte ?', shopOpen:'Ouvrir la carte', rateSaved:'Taux mis à jour', allShops:'Tous les commerces', profileText:'Informations du compte', adminSettings:'Paramètres du programme', claimHours:'Délai de dépôt du reçu', noPermission:'Cet écran n’est pas disponible pour ce compte.', genericError:'Une erreur est survenue. Veuillez réessayer.', uploadRequired:'Choisissez une photo.', incomplete:'Veuillez remplir les champs obligatoires.', passwordsDiffer:'Les mots de passe ne correspondent pas.', camera:'Prenez une photo lisible', privacy:'Votre reçu est utilisé uniquement pour vérifier la récompense.', phoneStep:'Un code a été envoyé sur votre téléphone.', phoneLogin:'Se connecter par téléphone', emailLogin:'Utiliser l’e-mail', mapNote:'Lien Maps ou latitude et longitude', noHistory:'Aucun achat enregistré', merchantId:'Commerce', clear:'Effacer', applyPending:'Votre demande d’adhésion a bien été envoyée à l’administration.', sendReceipt:'Reçu envoyé pour vérification', redeemDone:'Utilisation enregistrée', finishPhoneProfile:'Votre téléphone est vérifié. Complétez les informations du compte.', recentActivity:'Activité récente', shopArea:'Zone des commerces', cat_restaurants:'Restaurants', cat_cafes:'Cafés', cat_clothing:'Vêtements', cat_electronics:'Électronique', cat_malls:'Centres commerciaux', cat_groceries:'Alimentation', cat_perfume:'Parfumerie', cat_gifts:'Cadeaux', cat_shops:'Autres commerces', cat_other:'Autre', qrCode:'Code QR du commerce',
  },
  ar: {
    tagline:'مكافأة صغيرة، في متجرك المفضل.', algeria:'الجزائر', libya:'ليبيا', localTag:'مكافآت محلية · شمال أفريقيا', separationNudge:'متجر واحد. رصيد واحد.', separationHint:'تبقى المكافآت لدى المتجر الذي منحها.', welcome:'سعداء بعودتك.', login:'تسجيل الدخول', createAccount:'إنشاء حساب', customer:'عميل', merchant:'صاحب متجر', admin:'مسؤول',
    email:'البريد الإلكتروني', loginIdentifier:'البريد الإلكتروني أو رقم الهاتف', phoneNotVerified:'رقم الهاتف غير مؤكد. التحقق عبر SMS غير متاح حالياً؛ سجّل الدخول بالبريد الإلكتروني.', phoneSignupHint:'التحقق عبر SMS غير موصول حالياً. استخدم البريد الإلكتروني للدخول إلى أن يتم تأكيد الهاتف.', accountTypeMismatch:'نوع هذا الحساب لا يطابق الخيار المحدد.', rejectionReasonRequired:'اكتب سبب الرفض قبل رفض الطلب.', password:'كلمة المرور', confirmPassword:'تأكيد كلمة المرور', phone:'رقم الهاتف', name:'الاسم الكامل', forgot:'هل نسيت كلمة المرور؟', reset:'إرسال رابط الاستعادة', register:'إنشاء الحساب', continue:'متابعة', verify:'تأكيد الهاتف', code:'رمز التحقق عبر SMS', sendCode:'إرسال الرمز', verifyCode:'تأكيد الرمز', back:'العودة إلى الدخول',
    home:'اكتشف المتاجر', wallet:'مكافآتي', profile:'الملف الشخصي', settings:'الإعدادات', signOut:'تسجيل الخروج', hello:'مرحباً بعودتك', nearby:'متاجر محلية تستحق زيارتك', noShops:'اكتشاف متاجرك المحلية يبدأ هنا', noShopsHint:'ستظهر المتاجر المشاركة عند انضمامها إلى CASH BACK.', search:'ابحث عن متجر أو فئة', details:'تفاصيل المتجر', earn:'اكسب', cashback:'استرداد نقدي', spendHere:'استخدم المكافآت هنا', receipt:'إرسال إيصال', receiptHint:'حمّل صورة واضحة للإيصال. تُضاف المكافآت بعد المراجعة.', amount:'قيمة الشراء', invoice:'رقم الفاتورة (اختياري)', date:'تاريخ الشراء', upload:'اختر صورة الإيصال', submit:'إرسال للمراجعة', walletTitle:'رصيد مستقل لكل متجر', walletHint:'تبقى المكافآت لدى المتجر الذي منحها، وتُستخدم لديه فقط.', earned:'المكتسب', used:'المستخدم', balance:'الرصيد المتاح', ledger:'النشاط', noActivity:'لا يوجد نشاط بعد', redeem:'استخدام المكافآت', redeemAmount:'قيمة الاستخدام', confirmRedeem:'تأكيد الاستخدام', pending:'قيد المراجعة', approved:'مقبول', rejected:'مرفوض', noReceipts:'لا توجد إيصالات بعد', preferences:'تفضيلاتك', language:'اللغة', theme:'المظهر', light:'فاتح', dark:'داكن', save:'حفظ التفضيلات', saved:'تم حفظ التفضيلات', customerEntry:'تسوّق محلياً واكسب مكافآت.', customerBlurb:'اكسب رصيداً منفصلاً لدى كل متجر مشارك، واستخدمه في زيارتك القادمة.', shopEntry:'امنح زبائنك سبباً للعودة.', shopBlurb:'انضم إلى شبكة مكافآت محلية تحتفي بالزبائن الدائمين.', applyShop:'قدّم متجرك', statusPending:'طلبك قيد المراجعة', pendingHint:'تم إرسال طلب انضمامك إلى الإدارة بنجاح. نراجع تفاصيل متجرك وستتوفر أدوات البيع بعد الموافقة.', statusRejected:'لم تتم الموافقة على الطلب', reason:'ملاحظة المراجعة', retry:'تواصل مع الدعم لمعرفة الخطوات التالية', merchantDashboard:'لوحة المتجر', merchantActive:'متجرك نشط', salesOnly:'تمت الموافقة على متجرك. يراجع فريق CASH BACK إيصالات العملاء.', rate:'نسبة المكافأة', customers:'العملاء', sales:'المبيعات', receiptQueue:'مراجعة الإيصالات', merchantQueue:'طلبات المتاجر', adminDashboard:'لوحة المراجعة', noPending:'لا توجد طلبات معلقة', approve:'موافقة', decline:'رفض', rejectionReason:'سبب الرفض', apply:'إرسال الطلب', country:'الدولة', city:'المدينة / الولاية', location:'عنوان المتجر', mapLink:'رابط الخرائط أو الإحداثيات', category:'فئة المتجر', logo:'صورة أو شعار المتجر', shopName:'اسم المتجر', choose:'اختر', close:'إغلاق', loading:'جارٍ تحميل حسابك…', retryLoad:'إعادة المحاولة', loadError:'تعذر تحميل حسابك.', authError:'تعذر إتمام العملية. تحقق من بياناتك وحاول مجدداً.', success:'تم', resetSent:'تم إرسال رسالة استعادة كلمة المرور.', noAccount:'جديد على CASH BACK؟', haveAccount:'لديك حساب بالفعل؟', shopOpen:'فتح الخريطة', rateSaved:'تم تحديث النسبة', allShops:'كل المتاجر', profileText:'بيانات الحساب', adminSettings:'إعدادات البرنامج', claimHours:'مهلة إرسال الإيصال', noPermission:'هذه الصفحة غير متاحة لهذا الحساب.', genericError:'حدث خطأ. يرجى المحاولة مجدداً.', uploadRequired:'يرجى اختيار صورة أولاً.', incomplete:'أكمل الحقول المطلوبة.', passwordsDiffer:'كلمتا المرور غير متطابقتين.', camera:'استخدم صورة واضحة', privacy:'يُستخدم إيصالك لمراجعة المكافأة فقط.', phoneStep:'أرسلنا رمزاً إلى هاتفك.', phoneLogin:'الدخول برقم الهاتف', emailLogin:'استخدام البريد الإلكتروني', mapNote:'رابط خرائط أو خط العرض والطول', noHistory:'لا توجد مشتريات مسجلة بعد', merchantId:'المتجر', clear:'مسح', applyPending:'تم إرسال طلب انضمامك إلى الإدارة بنجاح.', sendReceipt:'تم إرسال الإيصال للمراجعة', redeemDone:'تم تسجيل الاستخدام', finishPhoneProfile:'تم التحقق من هاتفك. أكمل بيانات الحساب.', recentActivity:'النشاط الأخير', shopArea:'منطقة المتاجر', cat_restaurants:'مطاعم', cat_cafes:'مقاهٍ', cat_clothing:'ملابس', cat_electronics:'إلكترونيات', cat_malls:'مراكز تجارية', cat_groceries:'مواد غذائية', cat_perfume:'عطور', cat_gifts:'هدايا', cat_shops:'محلات أخرى', cat_other:'أخرى', qrCode:'رمز QR الخاص بالمتجر',
  },
};
const featureTranslations: Record<Lang, Dict> = {
  en: {
    rating:'Rating', noRatings:'No ratings yet', ratingCount:'ratings', rateAfterPurchase:'Submit an approved receipt here to rate this shop.', ratingSaved:'Your rating was saved.', merchantInfo:'About this shop', merchantBalance:'Your balance at this shop', cancelReceipt:'Cancel receipt', receiptCancelled:'Receipt cancelled.', cancelled:'Cancelled', cancelReceiptConfirm:'Cancel this receipt submission?', receiptTooOld:'This receipt is outside the allowed submission period.', duplicateReceipt:'This invoice or photo was already submitted.', receiptCustomer:'Customer', submittedAt:'Submitted', submittedIp:'Submission IP', allReceipts:'All receipts', searchReceipts:'Search invoices, customers, or shops', categoriesManager:'Shop categories', categoriesHint:'Choose which categories are visible to customers.', categoriesSaved:'Shop categories saved.', categoriesAtLeastOne:'Keep at least one category active.', imageUploadError:'The receipt photo could not be uploaded. Please take a new photo and try again.', ratingRequiresApprovedReceipt:'You can rate a shop after one of your receipts is approved.', possibleDuplicate:'Possible duplicate: same shop, customer, date, and amount.', useMyLocation:'Sort by distance', nearbySorted:'Nearby shops are sorted by distance.', locationUnavailable:'Location is not available on this device.', locationDenied:'Location access was denied.', kmAway:'km away', allCountries:'All countries', allCities:'All cities',
  },
  fr: {
    rating:'Note', noRatings:'Aucune note pour le moment', ratingCount:'avis', rateAfterPurchase:'Envoyez un reçu approuvé pour ce commerce afin de le noter.', ratingSaved:'Votre note a été enregistrée.', merchantInfo:'À propos du commerce', merchantBalance:'Votre solde dans ce commerce', cancelReceipt:'Annuler le reçu', receiptCancelled:'Reçu annulé.', cancelled:'Annulé', cancelReceiptConfirm:'Annuler l’envoi de ce reçu ?', receiptTooOld:'Ce reçu dépasse le délai autorisé.', duplicateReceipt:'Cette facture ou cette photo a déjà été envoyée.', receiptCustomer:'Client', submittedAt:'Envoyé', submittedIp:'IP d’envoi', allReceipts:'Tous les reçus', searchReceipts:'Rechercher une facture, un client ou un commerce', categoriesManager:'Catégories des commerces', categoriesHint:'Choisissez les catégories visibles par les clients.', categoriesSaved:'Catégories enregistrées.', categoriesAtLeastOne:'Gardez au moins une catégorie active.', imageUploadError:'La photo du reçu n’a pas pu être envoyée. Prenez une nouvelle photo et réessayez.', ratingRequiresApprovedReceipt:'Vous pouvez noter un commerce après l’approbation de l’un de vos reçus.', possibleDuplicate:'Doublon possible : même commerce, client, date et montant.', useMyLocation:'Trier par distance', nearbySorted:'Les commerces proches sont triés par distance.', locationUnavailable:'La position est indisponible sur cet appareil.', locationDenied:'L’accès à la position a été refusé.', kmAway:'km', allCountries:'Tous les pays', allCities:'Toutes les villes',
  },
  ar: {
    rating:'التقييم', noRatings:'لا توجد تقييمات بعد', ratingCount:'تقييمات', rateAfterPurchase:'أرسل فاتورة مقبولة من هذا المتجر لتتمكن من تقييمه.', ratingSaved:'تم حفظ تقييمك.', merchantInfo:'معلومات المتجر', merchantBalance:'رصيدك لدى هذا المتجر', cancelReceipt:'إلغاء الفاتورة', receiptCancelled:'تم إلغاء الفاتورة.', cancelled:'ملغاة', cancelReceiptConfirm:'هل تريد إلغاء إرسال هذه الفاتورة؟', receiptTooOld:'تاريخ الفاتورة أقدم من المدة المسموح بها.', duplicateReceipt:'تم إرسال هذه الفاتورة أو صورتها من قبل.', receiptCustomer:'الزبون', submittedAt:'تاريخ الإرسال', submittedIp:'عنوان IP عند الإرسال', allReceipts:'كل الفواتير', searchReceipts:'ابحث برقم الفاتورة أو اسم الزبون أو المتجر', categoriesManager:'تصنيفات المتاجر', categoriesHint:'اختر التصنيفات التي تظهر للزبائن.', categoriesSaved:'تم حفظ تصنيفات المتاجر.', categoriesAtLeastOne:'يجب إبقاء تصنيف واحد على الأقل.', imageUploadError:'تعذر رفع صورة الفاتورة. التقط صورة جديدة ثم حاول مجدداً.', ratingRequiresApprovedReceipt:'يمكنك تقييم المتجر بعد قبول فاتورة واحدة على الأقل.', possibleDuplicate:'اشتباه بتكرار: المتجر والزبون والتاريخ والمبلغ متطابقة.', useMyLocation:'ترتيب حسب المسافة', nearbySorted:'تم ترتيب المتاجر الأقرب حسب المسافة.', locationUnavailable:'الموقع غير متاح على هذا الجهاز.', locationDenied:'لم تسمح بالوصول إلى الموقع.', kmAway:'كم', allCountries:'كل الدول', allCities:'كل المدن',
  },
};
const extraTranslations: Record<Lang, Dict> = {
  en: { categories: 'Categories', accountSection: 'My account', claimHistory: 'Receipt history', rewardShops: 'Shops with rewards', transactions: 'Transactions', myDetails: 'Personal details', quickAccess: 'Your account', interfacePrefs: 'Preferences', helloProfile: 'Your local rewards, at a glance.', approvedReceipts: 'Approved receipts', profileSettingsTitle: 'Profile & settings', inviteFriends: 'Invite friends', inviteMessage: 'Join me on CASH BACK and earn rewards at local shops.', inviteCopied: 'Invitation link copied.', shareUnavailable: 'Sharing is unavailable in this browser.', changePhoto:'Change profile photo', photoUploading:'Uploading photo…', photoSaved:'Profile photo updated.', photoInvalidType:'Choose a JPEG, PNG or WebP image.', photoTooLarge:'Photo must be 5 MB or smaller.', photoUploadError:'Could not update your photo. Please try again.', noTransactions:'No transactions yet', historyLoad:'Loading your history…', receiptHistoryIntro:'Every receipt you have sent for review.', transactionHistoryIntro:'Every reward earned and redeemed across your shops.', payAtShop:'Pay at this shop', shopHistory:'Recent activity', viewShopHistory:'View shop history', myShopBalances:'My balances at shops' },
  fr: { categories: 'Catégories', accountSection: 'Mon compte', claimHistory: 'Historique des reçus', rewardShops: 'Commerces avec récompenses', transactions: 'Transactions', myDetails: 'Informations personnelles', quickAccess: 'Votre compte', interfacePrefs: 'Préférences', helloProfile: 'Vos récompenses locales, en un coup d’œil.', approvedReceipts: 'Reçus approuvés', profileSettingsTitle: 'Profil et paramètres', inviteFriends: 'Inviter des amis', inviteMessage: 'Rejoignez CASH BACK et gagnez des récompenses dans les commerces locaux.', inviteCopied: 'Lien d’invitation copié.', shareUnavailable: 'Le partage est indisponible dans ce navigateur.', changePhoto:'Modifier la photo de profil', photoUploading:'Envoi de la photo…', photoSaved:'Photo de profil mise à jour.', photoInvalidType:'Choisissez une image JPEG, PNG ou WebP.', photoTooLarge:'La photo doit faire 5 Mo maximum.', photoUploadError:'Impossible de modifier la photo. Réessayez.', noTransactions:'Aucune transaction pour le moment', historyLoad:'Chargement de l’historique…', receiptHistoryIntro:'Tous les reçus envoyés pour vérification.', transactionHistoryIntro:'Toutes les récompenses gagnées et utilisées dans vos commerces.', payAtShop:'Payer dans ce commerce', shopHistory:'Activité récente', viewShopHistory:'Voir l’historique', myShopBalances:'Mes soldes par commerce' },
  ar: { categories: 'التصنيفات', accountSection: 'حسابي', claimHistory: 'سجل الفواتير', rewardShops: 'متاجر لديها مكافآت', transactions: 'المعاملات', myDetails: 'البيانات الشخصية', quickAccess: 'حسابك', interfacePrefs: 'التفضيلات', helloProfile: 'مكافآتك المحلية، في لمحة.', approvedReceipts: 'الفواتير المقبولة', profileSettingsTitle: 'الملف الشخصي والإعدادات', inviteFriends: 'دعوة الأصدقاء', inviteMessage: 'انضم إليّ في CASH BACK واكسب مكافآت من المتاجر المحلية.', inviteCopied: 'تم نسخ رابط الدعوة.', shareUnavailable: 'المشاركة غير متاحة في هذا المتصفح.', changePhoto:'تغيير الصورة الشخصية', photoUploading:'جارٍ رفع الصورة…', photoSaved:'تم تحديث الصورة الشخصية.', photoInvalidType:'اختر صورة JPEG أو PNG أو WebP.', photoTooLarge:'يجب ألا يتجاوز حجم الصورة 5 ميغابايت.', photoUploadError:'تعذر تحديث الصورة. يرجى المحاولة مجدداً.', noTransactions:'لا توجد معاملات بعد', historyLoad:'جارٍ تحميل السجل…', receiptHistoryIntro:'كل الإيصالات التي أرسلتها للمراجعة.', transactionHistoryIntro:'كل المكافآت المكتسبة والمستخدمة لدى متاجرك.', payAtShop:'ادفع لدى هذا المتجر', shopHistory:'آخر العمليات', viewShopHistory:'عرض سجل المتجر', myShopBalances:'أرصدتي لدى المحلات' },
};
const cameraTranslations: Record<Lang, Dict> = {
  en: {
    receipt: 'Take a receipt photo',
    receiptHint: 'Take a clear photo of the full receipt. Rewards are added after review.',
    uploadRequired: 'Take a photo of the receipt first.',
    captureReceipt: 'Photograph the receipt',
    cameraHint: 'Point the camera at the full receipt, then take a photo.',
    cameraStarting: 'Opening the camera…',
    takeReceiptPhoto: 'Take receipt photo',
    retakeReceiptPhoto: 'Retake photo',
    cameraFallback: 'Open device camera',
    cameraUnavailable: 'The camera could not open. Check camera permission or use your device camera.',
    photoReady: 'Receipt photo is ready.',
  },
  fr: {
    receipt: 'Photographier un reçu',
    receiptHint: 'Photographiez clairement le reçu en entier. Les récompenses seront ajoutées après vérification.',
    uploadRequired: 'Photographiez d’abord le reçu.',
    captureReceipt: 'Photographier le reçu',
    cameraHint: 'Cadrez le reçu en entier, puis prenez la photo.',
    cameraStarting: 'Ouverture de la caméra…',
    takeReceiptPhoto: 'Prendre le reçu en photo',
    retakeReceiptPhoto: 'Reprendre la photo',
    cameraFallback: 'Ouvrir la caméra de l’appareil',
    cameraUnavailable: 'La caméra ne s’est pas ouverte. Vérifiez son autorisation ou utilisez la caméra de l’appareil.',
    photoReady: 'La photo du reçu est prête.',
  },
  ar: {
    receipt: 'تصوير إيصال الفاتورة',
    receiptHint: 'صوّر الإيصال كاملاً بوضوح. تُضاف المكافأة بعد مراجعة الفاتورة.',
    uploadRequired: 'يرجى تصوير إيصال الفاتورة أولاً.',
    captureReceipt: 'تصوير إيصال الفاتورة',
    cameraHint: 'وجّه الكاميرا نحو الإيصال كاملاً ثم التقط الصورة.',
    cameraStarting: 'جارٍ فتح الكاميرا…',
    takeReceiptPhoto: 'التقاط صورة الإيصال',
    retakeReceiptPhoto: 'إعادة التصوير',
    cameraFallback: 'فتح كاميرا الجهاز',
    cameraUnavailable: 'تعذر فتح الكاميرا. تحقق من الإذن أو افتح كاميرا الجهاز.',
    photoReady: 'صورة الإيصال جاهزة.',
  },
};
const homeNavTranslations: Record<Lang, Dict> = {
  en: { stores: 'Shops', more: 'More', cameraNav: 'Receipt photo', viewAll: 'View all', notifications: 'Notifications', noNotifications: 'No notifications yet', homeBrandTagline:'Shop more. Earn more.', homePromoTitle:'Cash back on your purchases', homePromoSubtitle:'Earn rewards every time you shop locally.', homeCashback:'Cashback', homeCameraAction:'Photograph your receipt now' },
  fr: { stores: 'Commerces', more: 'Plus', cameraNav: 'Photo du reçu', viewAll: 'Tout voir', notifications: 'Notifications', noNotifications: 'Aucune notification pour le moment', homeBrandTagline:'Achetez plus. Gagnez plus.', homePromoTitle:'Du cashback sur vos achats', homePromoSubtitle:'Gagnez des récompenses dans les commerces locaux.', homeCashback:'Cashback', homeCameraAction:'Photographiez votre reçu maintenant' },
  ar: { stores: 'المتاجر', more: 'المزيد', wallet: 'محفظتي', walletTitle: 'محفظتي', cameraNav: 'تصوير فاتورة', viewAll: 'عرض الكل', notifications: 'الإشعارات', noNotifications: 'لا توجد إشعارات بعد', homeBrandTagline:'اشترِ أكثر... اربح أكثر', homePromoTitle:'كاش باك على مشترياتك', homePromoSubtitle:'استرجع جزءاً من قيمة مشترياتك من المتاجر المشاركة.', homeCashback:'كاش باك', homeCameraAction:'صوّر فاتورتك الآن' },
};
const authStatusTranslations: Record<Lang, Dict> = {
  en: { phoneNotVerified:'Phone sign-in requires a verified number. SMS is not connected; use email sign-in.', rejectionReason:'Reason for rejection', pendingHint:'Your application was sent to the administration successfully. Sales tools unlock after approval.', applyPending:'Your application was sent to the administration successfully.' },
  fr: { phoneNotVerified:'La connexion par téléphone exige un numéro vérifié. Les SMS ne sont pas configurés ; utilisez votre e-mail.', rejectionReason:'Motif du refus', pendingHint:'Votre demande a bien été envoyée à l’administration. Les outils de vente seront accessibles après approbation.', applyPending:'Votre demande d’adhésion a bien été envoyée à l’administration.' },
  ar: { phoneNotVerified:'الدخول برقم الهاتف يتطلب تأكيده. خدمة SMS غير موصولة؛ استخدم البريد الإلكتروني.', rejectionReason:'سبب الرفض', pendingHint:'تم إرسال طلب انضمامك إلى الإدارة بنجاح. نراجع تفاصيل متجرك وستتوفر أدوات البيع بعد الموافقة.', applyPending:'تم إرسال طلب انضمامك إلى الإدارة بنجاح.' },
};
const paymentTranslations: Record<Lang, Dict> = {
  en: { scanPaymentQr:'Scan shop payment QR', scanHint:'Scan the QR shown by the shop to prepare a payment. Nothing is charged until you confirm.', startScan:'Open camera scanner', scanning:'Looking for a shop QR…', scanAgain:'Scan another QR', scanError:'The camera could not start. Allow camera access and try again.', sessionLoading:'Validating shop QR…', sessionError:'This QR could not be validated. Ask the shop to display its CASH BACK payment QR.', sessionExpired:'This payment session has expired. Scan the shop QR again.', expiresIn:'Session expires in', enterPaymentAmount:'Amount to pay', paymentReview:'Review payment', paymentConfirm:'Confirm payment', paymentWorking:'Processing payment…', paymentSuccess:'Payment complete', paymentReference:'Payment reference', remainingBalance:'Remaining shop balance', closePayment:'Close payment', qrDownloadPng:'Download PNG', qrDownloadPdf:'Download vector PDF', qrPrint:'Print QR', qrExportError:'The QR could not be exported. Try again.', completedPayments:'QR payment history', reversePayment:'Reverse payment', reversalReason:'Reason for reversal', reversalConfirm:'Confirm reversal', reversalDone:'Payment reversed and recorded', noCompletedPayments:'No completed QR payments to review.', reasonRequired:'Enter a reason of at least 3 characters.', confirmReversePrompt:'This reversal will be recorded in the audit trail.', reversalPending:'Reversing…', reference:'Reference', paymentDate:'Date', paymentShop:'Shop', paymentAmount:'Amount', scannedShop:'Shop QR accepted', scanSecureNote:'The QR identifies the shop only. Your balance and payment amount stay private until confirmation.', reversedPayment:'Reversed', merchantWalletBalance:'Available merchant balance', merchantWalletDebt:'Reversal debt', merchantQrPayments:'QR payments received', customerName:'Customer', balanceChanged:'Your shop balance changed. Check it and enter the amount again.' },
  fr: { scanPaymentQr:'Scanner le QR de paiement', scanHint:'Scannez le QR affiché par le commerce pour préparer le paiement. Rien n’est débité avant votre confirmation.', startScan:'Ouvrir le scanner', scanning:'Recherche du QR du commerce…', scanAgain:'Scanner un autre QR', scanError:'La caméra ne peut pas démarrer. Autorisez son accès puis réessayez.', sessionLoading:'Vérification du QR…', sessionError:'Ce QR n’a pas pu être vérifié. Demandez au commerce son QR CASH BACK.', sessionExpired:'Cette session a expiré. Scannez à nouveau le QR du commerce.', expiresIn:'La session expire dans', enterPaymentAmount:'Montant à payer', paymentReview:'Vérifier le paiement', paymentConfirm:'Confirmer le paiement', paymentWorking:'Paiement en cours…', paymentSuccess:'Paiement effectué', paymentReference:'Référence du paiement', remainingBalance:'Solde restant dans ce commerce', closePayment:'Fermer le paiement', qrDownloadPng:'Télécharger PNG', qrDownloadPdf:'Télécharger le PDF vectoriel', qrPrint:'Imprimer le QR', qrExportError:'Impossible d’exporter le QR. Réessayez.', completedPayments:'Historique des paiements QR', reversePayment:'Annuler le paiement', reversalReason:'Motif de l’annulation', reversalConfirm:'Confirmer l’annulation', reversalDone:'Paiement annulé et consigné', noCompletedPayments:'Aucun paiement QR effectué à examiner.', reasonRequired:'Saisissez un motif d’au moins 3 caractères.', confirmReversePrompt:'Cette annulation sera consignée dans le journal d’audit.', reversalPending:'Annulation…', reference:'Référence', paymentDate:'Date', paymentShop:'Commerce', paymentAmount:'Montant', scannedShop:'QR du commerce accepté', scanSecureNote:'Le QR identifie uniquement le commerce. Votre solde et le montant restent privés jusqu’à confirmation.', reversedPayment:'Annulé', merchantWalletBalance:'Solde commerçant disponible', merchantWalletDebt:'Dette après annulation', merchantQrPayments:'Paiements QR reçus', customerName:'Client', balanceChanged:'Le solde du commerce a changé. Vérifiez-le et saisissez à nouveau le montant.' },
  ar: { scanPaymentQr:'امسح رمز دفع المتجر', scanHint:'امسح الرمز الذي يعرضه المتجر لإعداد الدفع. لن يُخصم شيء قبل تأكيدك.', startScan:'فتح الكاميرا للمسح', scanning:'جارٍ البحث عن رمز المتجر…', scanAgain:'مسح رمز آخر', scanError:'تعذر تشغيل الكاميرا. اسمح بالوصول إليها ثم حاول مجدداً.', sessionLoading:'جارٍ التحقق من رمز المتجر…', sessionError:'تعذر التحقق من هذا الرمز. اطلب من المتجر عرض رمز الدفع الخاص بـ CASH BACK.', sessionExpired:'انتهت صلاحية جلسة الدفع. امسح رمز المتجر مجدداً.', expiresIn:'تنتهي الجلسة خلال', enterPaymentAmount:'مبلغ الدفع', paymentReview:'مراجعة الدفع', paymentConfirm:'تأكيد الدفع', paymentWorking:'جارٍ تنفيذ الدفع…', paymentSuccess:'تم الدفع بنجاح', paymentReference:'مرجع الدفع', remainingBalance:'الرصيد المتبقي لدى المتجر', closePayment:'إغلاق الدفع', qrDownloadPng:'تنزيل PNG', qrDownloadPdf:'تنزيل PDF متجهي', qrPrint:'طباعة الرمز', qrExportError:'تعذر تصدير الرمز. حاول مجدداً.', completedPayments:'سجل مدفوعات QR', reversePayment:'عكس الدفع', reversalReason:'سبب عكس العملية', reversalConfirm:'تأكيد عكس العملية', reversalDone:'تم عكس الدفع وتسجيله', noCompletedPayments:'لا توجد مدفوعات QR مكتملة للمراجعة.', reasonRequired:'اكتب سبباً لا يقل عن 3 أحرف.', confirmReversePrompt:'سيُسجل هذا الإجراء في سجل التدقيق.', reversalPending:'جارٍ العكس…', reference:'المرجع', paymentDate:'التاريخ', paymentShop:'المتجر', paymentAmount:'المبلغ', scannedShop:'تم قبول رمز المتجر', scanSecureNote:'يعرّف الرمز المتجر فقط. يبقى رصيدك ومبلغ الدفع خاصين حتى التأكيد.', reversedPayment:'معكوسة', merchantWalletBalance:'رصيد التاجر المتاح', merchantWalletDebt:'مستحق بعد عكس العمليات', merchantQrPayments:'دفعات QR المستلمة', customerName:'الزبون', balanceChanged:'تغيّر رصيدك لدى المتجر. تحقّق منه وأدخل المبلغ مجدداً.' },
};
const wilayas = ['Adrar','Chlef','Laghouat','Oum El Bouaghi','Batna','Béjaïa','Biskra','Béchar','Blida','Bouira','Tamanrasset','Tébessa','Tlemcen','Tiaret','Tizi Ouzou','Alger','Djelfa','Jijel','Sétif','Saïda','Skikda','Sidi Bel Abbès','Annaba','Guelma','Constantine','Médéa','Mostaganem','M’Sila','Mascara','Ouargla','Oran','El Bayadh','Illizi','Bordj Bou Arréridj','Boumerdès','El Tarf','Tindouf','Tissemsilt','El Oued','Khenchela','Souk Ahras','Tipaza','Mila','Aïn Defla','Naâma','Aïn Témouchent','Ghardaïa','Relizane','Timimoun','Bordj Badji Mokhtar','Ouled Djellal','Béni Abbès','In Salah','In Guezzam','Touggourt','Djanet','El M’Ghair','El Meniaa'];
const libyanCities = ['Tripoli','Benghazi','Misrata','Bayda','Zawiya','Zliten','Ajdabiya','Tobruk','Sabha','Sirte','Derna','Khoms','Gharyan','Tarhuna','Bani Walid','Jalu','Kufra','Ghadames','Murzuq','Nalut','Sabratha','Surman','Yefren','Ubari','Brak','Marj'];
const wilayasArabic = ['أدرار','الشلف','الأغواط','أم البواقي','باتنة','بجاية','بسكرة','بشار','البليدة','البويرة','تمنراست','تبسة','تلمسان','تيارت','تيزي وزو','الجزائر','الجلفة','جيجل','سطيف','سعيدة','سكيكدة','سيدي بلعباس','عنابة','قالمة','قسنطينة','المدية','مستغانم','المسيلة','معسكر','ورقلة','وهران','البيض','إليزي','برج بوعريريج','بومرداس','الطارف','تندوف','تيسمسيلت','الوادي','خنشلة','سوق أهراس','تيبازة','ميلة','عين الدفلى','النعامة','عين تموشنت','غرداية','غليزان','تيميمون','برج باجي مختار','أولاد جلال','بني عباس','عين صالح','عين قزام','تقرت','جانت','المغير','المنيعة'];
const libyanCitiesArabic = ['طرابلس','بنغازي','مصراتة','البيضاء','الزاوية','زليتن','أجدابيا','طبرق','سبها','سرت','درنة','الخمس','غريان','ترهونة','بني وليد','جالو','الكفرة','غدامس','مرزق','نالوت','صبراتة','صرمان','يفرن','أوباري','براك','المرج'];
const cityArabic = Object.fromEntries([...wilayas.map((name,index)=>[name,wilayasArabic[index]]),...libyanCities.map((name,index)=>[name,libyanCitiesArabic[index]])]) as Record<string,string>;
const localizeCity = (name:string|undefined, lang:Lang) => name && lang==='ar' ? cityArabic[name] || name : name || '';
const browseCategories = ['restaurants','cafes','clothing','electronics','malls','groceries','perfume','gifts','shops'] as const;
function merchantCoordinates(merchant: Merchant): {lat:number;lng:number}|null {
  if (merchant.lat!=null && merchant.lng!=null && Number.isFinite(Number(merchant.lat)) && Number.isFinite(Number(merchant.lng)) && Math.abs(Number(merchant.lat))<=90 && Math.abs(Number(merchant.lng))<=180) {
    return {lat:Number(merchant.lat),lng:Number(merchant.lng)};
  }
  const source=String(merchant.mapsUrl||'');
  let decoded=source;
  try { decoded=decodeURIComponent(source); } catch { /* keep the original Maps URL */ }
  const match=decoded.match(/@(-?\d{1,2}(?:\.\d+)?),\s*(-?\d{1,3}(?:\.\d+)?)/)
    || decoded.match(/!3d(-?\d{1,2}(?:\.\d+)?)!4d(-?\d{1,3}(?:\.\d+)?)/)
    || decoded.match(/[?&](?:q|query|ll)=(-?\d{1,2}(?:\.\d+)?)[,%+ ]+(-?\d{1,3}(?:\.\d+)?)/)
    || decoded.match(/^(-?\d{1,2}(?:\.\d+)?),\s*(-?\d{1,3}(?:\.\d+)?)$/);
  if (!match) return null;
  const lat=Number(match[1]),lng=Number(match[2]);
  return Math.abs(lat)<=90&&Math.abs(lng)<=180?{lat,lng}:null;
}
function distanceKm(from:{lat:number;lng:number},merchant:Merchant):number {
  const to=merchantCoordinates(merchant);
  if (!to) return Number.POSITIVE_INFINITY;
  const radians=(degree:number)=>degree*Math.PI/180;
  const dLat=radians(to.lat-from.lat),dLng=radians(to.lng-from.lng);
  const a=Math.sin(dLat/2)**2+Math.cos(radians(from.lat))*Math.cos(radians(to.lat))*Math.sin(dLng/2)**2;
  return 6371*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
}
const merchantApplicationCategories = ['groceries','clothing','electronics','cafes','restaurants'] as const;
const formatMoney = (n: number, country = 'Algeria') => `${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })} ${country === 'Libya' ? 'LYD' : 'DZD'}`;
const timestampOf = (value: unknown) => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const parsed = Date.parse(String(value ?? ''));
  return Number.isFinite(parsed) ? parsed : 0;
};
const getHttpStatus = (error: unknown) => {
  if (!error || typeof error !== 'object') return 0;
  const value = error as { status?: unknown; statusCode?: unknown; response?: { status?: unknown } };
  return Number(value.status ?? value.statusCode ?? value.response?.status ?? 0);
};
const queryClient = new QueryClient();

function IconButton({ children, onClick, label, testId }: { children: ReactNode; onClick: () => void; label: string; testId: string }) {
  return <button className="btn btn-outline" onClick={onClick} aria-label={label} data-testid={testId} style={{ minHeight: 42, padding: '9px 12px' }}>{children}</button>;
}
function Field({ label, value, onChange, type = 'text', placeholder, testId, required = false, min, step, autoComplete }: { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string; testId: string; required?: boolean; min?: string; step?: string; autoComplete?: string }) {
  return <label style={{ display:'grid', gap:6, fontSize:14, fontWeight:600 }}>{label}<input className="field" type={type} value={value} placeholder={placeholder} onChange={e=>onChange(e.target.value)} data-testid={testId} required={required} min={min} step={step} autoComplete={autoComplete} /></label>;
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
  const [authReady, setAuthReady] = useState(false);
  const [splash, setSplash] = useState(true);
  const [authMode, setAuthMode] = useState<'login'|'register'|'reset'>('login');
  const [registerRole, setRegisterRole] = useState<'customer'|'merchant'>('customer');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
   const [email, setEmail] = useState(''); const [loginIdentifier, setLoginIdentifier] = useState(''); const [password, setPassword] = useState(''); const [confirm, setConfirm] = useState('');
  const [phone, setPhone] = useState(''); const [name, setName] = useState('');
  const [country, setCountry] = useState('Algeria'); const [city, setCity] = useState(''); const [address, setAddress] = useState(''); const [mapsUrl, setMapsUrl] = useState(''); const [category, setCategory] = useState(''); const [logoData, setLogoData] = useState('');
  const [search, setSearch] = useState(''); const [selectedMerchant, setSelectedMerchant] = useState<Merchant|null>(null);
   const [selectedCategory, setSelectedCategory] = useState(''); const [countryFilter, setCountryFilter] = useState(''); const [cityFilter, setCityFilter] = useState('');
   const [nearbyCoords, setNearbyCoords] = useState<{lat:number;lng:number}|null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoFailed, setPhotoFailed] = useState(false);
  const [receiptCameraActive, setReceiptCameraActive] = useState(false);
  const [receiptCameraStarting, setReceiptCameraStarting] = useState(false);
  const [receiptCameraError, setReceiptCameraError] = useState('');
  const receiptVideoRef = useRef<HTMLVideoElement>(null);
  const receiptPhotoInputRef = useRef<HTMLInputElement>(null);
  const receiptCameraStreamRef = useRef<MediaStream|null>(null);
  const receiptCameraRequestRef = useRef(0);
  const [receiptMerchantId, setReceiptMerchantId] = useState(''); const [receiptFile, setReceiptFile] = useState(''); const [invoice, setInvoice] = useState(''); const [purchaseAmount, setPurchaseAmount] = useState(''); const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().slice(0,10));
  const [reason, setReason] = useState(''); const [rateValue, setRateValue] = useState('');
   const t = (key: string) => paymentTranslations[lang][key] || homeNavTranslations[lang][key] || cameraTranslations[lang][key] || authStatusTranslations[lang][key] || featureTranslations[lang][key] || extraTranslations[lang][key] || dictionaries[lang][key] || (key.startsWith('cat_') ? key.slice(4) : key);
  const { data: session, isLoading, isError, error: queryError, refetch } = useGetCashbackSession({ query: { queryKey: getGetCashbackSessionQueryKey(), enabled: authReady, retry: false, refetchOnWindowFocus: false } });
  const sessionHttpStatus = getHttpStatus(queryError);
   const register = useRegisterCashbackProfile(); const submitReceipt = useSubmitCashbackReceipt(); const receiptPhotoUpload = useCreateCashbackReceiptPhotoUpload(); const cancelReceiptRequest = useCancelCashbackReceipt(); const decideReceipt = useDecideCashbackReceipt();
   const decideMerchant = useDecideCashbackMerchant(); const redeem = useRedeemMerchantCashback(); const createPaymentSession = useCreateCashbackPaymentSession(); const reversePayment = useReverseCashbackPayment(); const preferences = useUpdateCashbackPreferences(); const updateRate = useUpdateCashbackRate();
   const rateMerchant = useRateCashbackMerchant(); const updateCategories = useUpdateCashbackCategories();
  const login = useLoginCashback(); const signOut = useLogoutCashback();
  const createPhotoUpload = useCreateCashbackProfilePhotoUpload();
  const saveProfilePhoto = useSaveCashbackProfilePhoto();
  const user = session as Session|undefined;
  const state = user?.state || {};
  const merchants = state.merchants || []; const claims = state.claims || []; const txns = state.txns || [];
  const profile = user?.profile;
   const activeMerchants = merchants.filter(m=>m.status==='active');
   const activeCategories: string[] = Array.isArray(state.categories)
     ? state.categories.filter(category=>browseCategories.includes(category as typeof browseCategories[number]))
     : [...browseCategories];
  const customerNotes = (state.notes||[])
    .filter(note=>!note.to||note.to===profile?.eid)
    .slice()
    .sort((a,b)=>Number(b.t||0)-Number(a.t||0));
  const notificationCount = customerNotes.length;
  const receiptStore = activeMerchants.find(m=>m.id===receiptMerchantId) || (selectedMerchant?.status==='active'?selectedMerchant:null);
  const selectedBalance = selectedMerchant && profile ? Number(state.customers?.find(c=>c.id===profile.eid)?.cbm?.[selectedMerchant.id] ?? 0) : 0;
  const isRtl = lang === 'ar';
  useEffect(() => { document.documentElement.classList.toggle('dark', theme === 'dark'); document.documentElement.dir = isRtl ? 'rtl' : 'ltr'; document.documentElement.lang = lang; }, [theme, lang, isRtl]);
  useEffect(() => { const id = window.setTimeout(()=>setSplash(false), 1850); return ()=>window.clearTimeout(id); }, []);
   useEffect(() => { setAuthReady(true); }, []);
   useEffect(() => { if (profile?.preferences?.language) { setLang(profile.preferences.language); setTheme(profile.preferences.theme || 'dark'); } }, [profile?.uid, profile?.preferences?.language, profile?.preferences?.theme]);
   useEffect(() => { setPhotoFailed(false); }, [profile?.uid, profile?.avatarUpdatedAt]);
  useEffect(() => {
    if (!receiptCameraActive || !receiptCameraStreamRef.current || !receiptVideoRef.current) return;
    receiptVideoRef.current.srcObject = receiptCameraStreamRef.current;
    void receiptVideoRef.current.play().catch(() => {
      setReceiptCameraError(t('cameraUnavailable'));
      stopReceiptCamera();
    });
  }, [receiptCameraActive, location]);
  useEffect(() => { if (location.startsWith('/shop/')) { const id = location.split('/')[2]; setSelectedMerchant(merchants.find(m=>m.id===id)||null); } else if (location !== '/shop') setSelectedMerchant(null); }, [location, merchants]);
  const refreshSession = () => client.invalidateQueries({ queryKey: getGetCashbackSessionQueryKey() });
   const availableCities = useMemo(()=>Array.from(new Set(activeMerchants.filter(m=>!countryFilter||m.country===countryFilter).map(m=>m.city).filter((value): value is string=>Boolean(value)))),[activeMerchants,countryFilter]);
  const availableCountries = useMemo(()=>Array.from(new Set(activeMerchants.map(m=>m.country).filter((value): value is string=>Boolean(value)))),[activeMerchants]);
   const filtered = useMemo(()=>{
     const matches=activeMerchants.filter(m=>
       `${m.name} ${m.cat||''} ${m.city||''} ${m.address||''}`.toLowerCase().includes(search.toLowerCase()) &&
       (!selectedCategory || m.cat===selectedCategory) &&
       (!countryFilter || m.country===countryFilter) &&
       (!cityFilter || m.city===cityFilter)
     );
     return nearbyCoords
       ? matches.sort((a,b)=>distanceKm(nearbyCoords,a)-distanceKm(nearbyCoords,b))
       : matches;
   }, [activeMerchants,search,selectedCategory,countryFilter,cityFilter,nearbyCoords]);
  const customer = profile?.role === 'customer'; const merchant = profile?.role === 'merchant'; const admin = profile?.role === 'admin';
  const clearMessages = () => { setError(''); setNotice(''); };
  function requestNearbySort() {
    clearMessages();
    if (!navigator.geolocation) { setError(t('locationUnavailable')); return; }
    navigator.geolocation.getCurrentPosition(
      position=>{setNearbyCoords({lat:position.coords.latitude,lng:position.coords.longitude});setNotice(t('nearbySorted'));},
      error=>setError(error.code===error.PERMISSION_DENIED?t('locationDenied'):t('locationUnavailable')),
      {enableHighAccuracy:false,timeout:10000,maximumAge:60000},
    );
  }
  const showErr = (caught: unknown) => {
    const code = (caught as { data?: { error?: string } })?.data?.error;
    if (code === 'EMAIL_ALREADY_REGISTERED') {
      setError(lang==='ar'?'هذا البريد الإلكتروني مسجل مسبقاً.':lang==='fr'?'Cette adresse e-mail est déjà utilisée.':'This email is already registered.');
    } else if (code === 'INVALID_CREDENTIALS') {
      setError(t('authError'));
    } else if (code === 'ACCOUNT_TYPE_MISMATCH') {
      setError(t('accountTypeMismatch'));
    } else if (code === 'REJECTION_REASON_REQUIRED') {
      setError(t('rejectionReasonRequired'));
    } else if (code === 'DUPLICATE_RECEIPT') {
      setError(t('duplicateReceipt'));
    } else if (code === 'RECEIPT_TOO_OLD') {
      setError(t('receiptTooOld'));
    } else if (code === 'RATING_REQUIRES_APPROVED_RECEIPT') {
      setError(t('ratingRequiresApprovedReceipt'));
    } else if (code === 'INVALID_RECEIPT_IMAGE' || code === 'RECEIPT_IMAGE_REQUIRED') {
      setError(t('imageUploadError'));
    } else if (code === 'INVALID_REQUEST' || code === 'INVALID_PROFILE' || code === 'MERCHANT_FIELDS_REQUIRED') {
      setError(t('incomplete'));
    } else {
      setError(t('genericError'));
    }
  };
  const invalidate = () => { void refreshSession(); };

  async function signIn() {
    clearMessages();
    try { await login.mutateAsync({ data: { identifier: loginIdentifier.trim(), password, role: registerRole } }); client.clear(); await refetch(); setLocation('/'); }
    catch (e) { showErr(e); }
  }
  async function beginRegistration() {
    clearMessages();
    if (!name || !email || !password || password.length < 8 || (registerRole==='merchant' && (!phone || !country || !city || !address || !mapsUrl || !category || !logoData))) { setError(t('incomplete')); return; }
    if (password !== confirm) { setError(t('passwordsDiffer')); return; }
    try {
      await register.mutateAsync({ data: { role: registerRole, name, phone: phone || null, email, password, ...(registerRole==='merchant' ? { country: country as 'Algeria'|'Libya', city, address, mapsUrl, category, logoData } : {}) } });
      if (registerRole==='merchant') setNotice(t('applyPending'));
      client.clear(); await refetch(); setLocation('/');
    } catch(e) { showErr(e); }
  }
  async function resetPassword() {
    clearMessages();
    setNotice(lang==='ar'?'استعادة كلمة المرور تتطلب إعداد خدمة بريد إلكتروني.':lang==='fr'?'La réinitialisation nécessite la configuration d’un service e-mail.':'Password reset needs an email delivery service to be configured.');
  }
  async function changePreference(nextLang: Lang, nextTheme: Theme) {
    if (profile) {
      try { await preferences.mutateAsync({ data: { language: nextLang, theme: nextTheme } }); setLang(nextLang); setTheme(nextTheme); invalidate(); setNotice(dictionaries[nextLang].saved); }
      catch(e) { setError(t('genericError')); }
    } else { setLang(nextLang); setTheme(nextTheme); }
  }
  async function inviteFriend() {
    const url = new URL(import.meta.env.BASE_URL, window.location.origin).toString();
    const payload = { title: 'CASH BACK', text: t('inviteMessage'), url };
    try {
      if (navigator.share) await navigator.share(payload);
      else if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(`${payload.text} ${url}`); setNotice(t('inviteCopied')); }
      else setError(t('shareUnavailable'));
    } catch (caught) {
      if ((caught as DOMException)?.name !== 'AbortError') setError(t('genericError'));
    }
  }
  const fileToData = (file: File) => new Promise<string>((resolve,reject)=>{
    const source=URL.createObjectURL(file); const image=new Image();
    image.onload=()=>{ URL.revokeObjectURL(source); const scale=Math.min(1,1500/Math.max(image.width,image.height)); const canvas=document.createElement('canvas'); canvas.width=Math.max(1,Math.round(image.width*scale)); canvas.height=Math.max(1,Math.round(image.height*scale)); const context=canvas.getContext('2d'); if(!context){reject(new Error('IMAGE_PROCESSING_FAILED'));return;} context.drawImage(image,0,0,canvas.width,canvas.height); canvas.toBlob(blob=>{if(!blob){reject(new Error('IMAGE_PROCESSING_FAILED'));return;}const reader=new FileReader();reader.onload=()=>resolve(String(reader.result)||'');reader.onerror=reject;reader.readAsDataURL(blob);},'image/jpeg',.78); };
    image.onerror=()=>{URL.revokeObjectURL(source);reject(new Error('IMAGE_PROCESSING_FAILED'));}; image.src=source;
  });
  function stopReceiptCamera() {
    receiptCameraRequestRef.current += 1;
    receiptCameraStreamRef.current?.getTracks().forEach(track => track.stop());
    receiptCameraStreamRef.current = null;
    setReceiptCameraActive(false);
    setReceiptCameraStarting(false);
  }
  async function startReceiptCamera() {
    stopReceiptCamera();
    setReceiptCameraError('');
    if (!navigator.mediaDevices?.getUserMedia) {
      setReceiptCameraError(t('cameraUnavailable'));
      return;
    }
    const requestId = ++receiptCameraRequestRef.current;
    setReceiptCameraStarting(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
      });
      if (receiptCameraRequestRef.current !== requestId) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }
      receiptCameraStreamRef.current = stream;
      setReceiptCameraActive(true);
    } catch {
      if (receiptCameraRequestRef.current === requestId) setReceiptCameraError(t('cameraUnavailable'));
    } finally {
      if (receiptCameraRequestRef.current === requestId) setReceiptCameraStarting(false);
    }
  }
  useEffect(() => {
    if (customer && location === '/capture-receipt') {
      if (!receiptFile && !receiptCameraActive && !receiptCameraStarting) void startReceiptCamera();
    } else if (receiptCameraActive || receiptCameraStarting || receiptCameraStreamRef.current) {
      stopReceiptCamera();
    }
  }, [customer, location, receiptFile, receiptCameraActive, receiptCameraStarting]);
  async function captureReceiptPhoto() {
    const video = receiptVideoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) {
      setReceiptCameraError(t('cameraUnavailable'));
      return;
    }
    const scale = Math.min(1, 1600 / Math.max(video.videoWidth, video.videoHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
    canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
    const context = canvas.getContext('2d');
    if (!context) {
      setError(t('genericError'));
      return;
    }
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(async blob => {
      if (!blob) {
        setError(t('genericError'));
        return;
      }
      try {
        const photo = await fileToData(new File([blob], 'receipt.jpg', { type: 'image/jpeg' }));
        setReceiptFile(photo);
        setReceiptCameraError('');
        stopReceiptCamera();
      } catch {
        setError(t('genericError'));
      }
    }, 'image/jpeg', .86);
  }
  async function handleReceiptPhotoFile(file?: File) {
    if (!file) return;
    try {
      setReceiptFile(await fileToData(file));
      setReceiptCameraError('');
      stopReceiptCamera();
    } catch {
      setError(t('genericError'));
    }
  }
  async function saveLogo(file?: File) { if (!file) return; try { setLogoData(await fileToData(file)); } catch { setError(t('genericError')); } }
  async function saveReceipt() {
    clearMessages();
    if (!receiptStore || !receiptFile) { setError(t('uploadRequired')); return; }
    if (!Number(purchaseAmount) || Number(purchaseAmount) <= 0 || !purchaseDate) { setError(t('incomplete')); return; }
    try {
      const blob = await (await fetch(receiptFile)).blob();
      const contentType = blob.type as 'image/jpeg'|'image/png'|'image/webp';
      if (!['image/jpeg','image/png','image/webp'].includes(contentType) || blob.size <= 0 || blob.size > 5 * 1024 * 1024) {
        throw new Error('INVALID_RECEIPT_IMAGE');
      }
      const upload = await receiptPhotoUpload.mutateAsync({ data: { contentType, size: blob.size } });
      const stored = await fetch(upload.uploadURL, { method:'PUT', headers:{'Content-Type':contentType}, body:blob });
      if (!stored.ok) throw new Error('RECEIPT_PHOTO_UPLOAD_FAILED');
      await submitReceipt.mutateAsync({ data: { merchantId:receiptStore.id, invoiceNumber: invoice || null, amount:Number(purchaseAmount), date:purchaseDate, uploadId:upload.uploadId, objectPath:upload.objectPath } });
      invalidate(); stopReceiptCamera(); setLocation('/receipts'); setNotice(t('sendReceipt')); setReceiptFile(''); setInvoice(''); setPurchaseAmount('');
    } catch (caught) {
      const code = (caught as { data?: { error?: string } })?.data?.error || (caught as Error)?.message;
      if (code === 'DUPLICATE_RECEIPT') setError(t('duplicateReceipt'));
      else if (code === 'RECEIPT_TOO_OLD') setError(t('receiptTooOld'));
      else if (code === 'INVALID_RECEIPT_IMAGE' || code === 'RECEIPT_IMAGE_REQUIRED' || code === 'RECEIPT_PHOTO_UPLOAD_FAILED') setError(t('imageUploadError'));
      else showErr(caught);
    }
  }
  const receiptPageContent = <section className="full-page-tool capture-page">
    <div className="profile-topbar full-page-tool-header" dir="ltr">
      <button className="profile-back" onClick={()=>nav(receiptStore?`/shop/${receiptStore.id}`:'/')} aria-label={t('home')} data-testid="button-capture-back"><ArrowLeft size={20}/></button>
      <h1 dir="auto">{t('captureReceipt')}</h1>
      <button className="profile-brand" onClick={()=>nav('/')} aria-label={t('home')} data-testid="link-capture-brand"><img src="/cashback-logo-transparent.png" alt="CASH BACK"/></button>
    </div>
    <p className="capture-page-hint">{t('cameraHint')}</p>
    <section className="receipt-camera-panel receipt-page-camera" aria-label={t('captureReceipt')}>
      {receiptFile ? <div className="receipt-photo-preview">
        <img src={receiptFile} alt={t('captureReceipt')}/>
        <div className="receipt-camera-actions">
          <strong role="status">{t('photoReady')}</strong>
          <button type="button" className="btn btn-outline" onClick={()=>{setReceiptFile('');void startReceiptCamera();}} data-testid="button-retake-receipt"><Camera size={17}/>{t('retakeReceiptPhoto')}</button>
        </div>
      </div> : receiptCameraActive ? <div className="receipt-live-camera">
        <video ref={receiptVideoRef} autoPlay playsInline muted aria-label={t('captureReceipt')}/>
        <div className="receipt-camera-actions">
          <span className="subtle">{t('cameraHint')}</span>
          <button type="button" className="btn btn-primary" onClick={()=>void captureReceiptPhoto()} data-testid="button-capture-receipt"><Camera size={18}/>{t('takeReceiptPhoto')}</button>
        </div>
      </div> : <div className="receipt-camera-fallback">
        {receiptCameraStarting ? <p role="status" className="subtle">{t('cameraStarting')}</p> : <>
          <Camera size={30} aria-hidden="true"/>
          {receiptCameraError&&<p role="alert" className="subtle">{receiptCameraError}</p>}
          <button type="button" className="btn btn-outline" onClick={()=>receiptPhotoInputRef.current?.click()} data-testid="button-open-device-camera"><Camera size={17}/>{t('cameraFallback')}</button>
          <input ref={receiptPhotoInputRef} type="file" accept="image/*" capture="environment" aria-label={t('captureReceipt')} className="camera-file-input" data-testid="input-receipt-photo" onChange={e=>{const file=e.target.files?.[0];e.target.value='';void handleReceiptPhotoFile(file);}}/>
        </>}
      </div>}
    </section>
    <div className="capture-receipt-fields">
      <SelectField label={t('merchantId')} value={receiptMerchantId || (selectedMerchant?.status==='active'?selectedMerchant.id:'')} onChange={setReceiptMerchantId} options={activeMerchants.map(m=>m.id)} formatOption={id=>activeMerchants.find(m=>m.id===id)?.name||id} testId="select-receipt-merchant"/>
      <Field label={t('amount')} value={purchaseAmount} onChange={setPurchaseAmount} type="number" min="0.01" step="0.01" testId="input-receipt-amount" required/>
      <Field label={t('date')} value={purchaseDate} onChange={setPurchaseDate} type="date" testId="input-receipt-date"/>
      <Field label={t('invoice')} value={invoice} onChange={setInvoice} testId="input-invoice"/>
      <small className="subtle">{t('privacy')}</small>
      <button className="btn btn-primary" onClick={()=>void saveReceipt()} disabled={submitReceipt.isPending||receiptPhotoUpload.isPending||activeMerchants.length===0} data-testid="button-submit-receipt"><ReceiptText size={17}/>{submitReceipt.isPending||receiptPhotoUpload.isPending?t('loading'):t('submit')}</button>
    </div>
  </section>;
  async function decideClaim(claim: Claim, approved: boolean) {
    try { await decideReceipt.mutateAsync({ id:claim.id, data:{ approved, ...(reason ? {reason} : {}) } }); invalidate(); setReason(''); setNotice(t('success')); }
    catch { setError(t('genericError')); }
  }
  async function beginQrPayment(merchantId:string, qrValue:string) {
    return createPaymentSession.mutateAsync({data:{merchantId,qrValue}});
  }
  async function finishQrPayment(sessionId:string, amount:number) {
    const result=await redeem.mutateAsync({data:{sessionId,amount}});
    await refreshSession();
    return result;
  }
  async function reverseQrPayment(id:string, reversalReason:string) {
    await reversePayment.mutateAsync({id,data:{reason:reversalReason}});
    await refreshSession();
    setNotice(t('reversalDone'));
  }
  async function decideShop(shop: Merchant, approved: boolean) {
    if (!approved && !reason.trim()) { setError(t('rejectionReasonRequired')); return; }
    try { await decideMerchant.mutateAsync({ id:shop.id, data:{ approved, ...(reason ? {reason} : {}) } }); invalidate(); setReason(''); setNotice(t('success')); }
    catch { setError(t('genericError')); }
  }
  async function saveRate() {
    const rate=Number(rateValue || state.settings?.cashback || 0);
    if(!Number.isFinite(rate) || rate<0 || rate>100) { setError(t('incomplete')); return; }
    try { await updateRate.mutateAsync({ data:{ rate } }); invalidate(); setNotice(t('rateSaved')); }
    catch { setError(t('genericError')); }
  }
  async function saveCategories(categories: string[]) {
    if (!categories.length) { setError(t('categoriesAtLeastOne')); return; }
    try {
      await updateCategories.mutateAsync({ data:{ categories:categories as typeof browseCategories[number][] } });
      invalidate();
      setNotice(t('categoriesSaved'));
    } catch { setError(t('genericError')); }
  }
  async function rateShop(shop: Merchant, rating: number) {
    try {
      await rateMerchant.mutateAsync({ id:shop.id, data:{ rating } });
      invalidate();
      setNotice(t('ratingSaved'));
    } catch (caught) {
      if ((caught as { data?: { error?: string } })?.data?.error === 'RATING_REQUIRES_APPROVED_RECEIPT') {
        setError(t('ratingRequiresApprovedReceipt'));
      } else setError(t('genericError'));
    }
  }
  async function cancelClaim(claim: Claim) {
    if (claim.status !== 'pending' || !window.confirm(t('cancelReceiptConfirm'))) return;
    try {
      await cancelReceiptRequest.mutateAsync({ id:claim.id });
      invalidate();
      setNotice(t('receiptCancelled'));
    } catch { setError(t('genericError')); }
  }
  async function logout() {
    stopReceiptCamera();
    try { await signOut.mutateAsync(); } catch { /* Clear the local view even if the session endpoint is unreachable. */ }
    client.clear(); setLocation('/'); setAuthMode('login');
  }
  async function uploadProfilePhoto(file?: File) {
    if (!file || !profile || photoUploading) return;
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'] as const;
    if (!allowedTypes.includes(file.type as typeof allowedTypes[number])) {
      setError(t('photoInvalidType'));
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError(t('photoTooLarge'));
      return;
    }
    setPhotoUploading(true);
    clearMessages();
    try {
      const upload = await createPhotoUpload.mutateAsync({ data: { contentType: file.type as typeof allowedTypes[number], size: file.size } });
      const response = await fetch(upload.uploadURL, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file });
      if (!response.ok) throw new Error('PHOTO_UPLOAD_FAILED');
      await saveProfilePhoto.mutateAsync({ data: { uploadId: upload.uploadId, objectPath: upload.objectPath } });
      setPhotoFailed(false);
      await client.invalidateQueries({ queryKey: getGetCashbackSessionQueryKey() });
      setNotice(t('photoSaved'));
    } catch {
      setError(t('photoUploadError'));
    } finally {
      setPhotoUploading(false);
    }
  }
  const nav = (path: string) => { stopReceiptCamera(); setLocation(path); clearMessages(); };
  const header = (account = true) => {
    if (customer && (location.startsWith('/profile') || location==='/notifications' || location==='/capture-receipt')) return null;
    if (customer && location === '/') return <header className="customer-home-header">
      <button className="home-header-profile" onClick={()=>nav('/profile')} data-testid="button-home-profile">
        {profile.avatarUpdatedAt!==undefined&&!photoFailed
          ? <img className="home-header-avatar" src={`/api/cashback/profile/photo?v=${encodeURIComponent(String(profile.avatarUpdatedAt))}`} alt="" aria-hidden="true" loading="eager" onLoad={()=>setPhotoFailed(false)} onError={()=>setPhotoFailed(true)}/>
          : <span className="home-header-avatar home-header-initials" aria-hidden="true">{profile.name.split(/\s+/).filter(Boolean).slice(0,2).map(part=>part[0]).join('').toLocaleUpperCase()}</span>}
        <span className="home-header-copy"><small>{t('hello')}</small><strong>{profile.name}</strong></span>
      </button>
      <button onClick={()=>nav('/')} data-testid="link-brand" className="home-header-brand"><img src="/cashback-logo-transparent.png" alt="CASH BACK"/></button>
      <div className="home-header-actions">
        <button className="home-header-icon" onClick={()=>nav('/notifications')} aria-label={t('notifications')} data-testid="button-home-notifications"><Bell size={20}/>{notificationCount>0&&<span className="home-header-badge">{notificationCount>9?'9+':notificationCount}</span>}</button>
        <button className="home-header-icon" onClick={()=>void logout()} aria-label={t('signOut')} data-testid="button-header-logout"><LogOut size={19}/></button>
      </div>
    </header>;
    return <header className="site-header" style={{ maxWidth:1120, margin:'0 auto', padding:'14px 18px', display:'flex', alignItems:'center', justifyContent:'space-between', gap:12 }}>
      <button onClick={()=>nav('/')} data-testid="link-brand" className="brand-lockup"><img src="/cashback-logo-transparent.png" alt="CASH BACK" style={{ width:54, height:46, objectFit:'contain', borderRadius:8 }} /></button>
      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
        <select aria-label={t('language')} className="field" style={{ width:94, minHeight:40, padding:'6px 8px' }} value={lang} onChange={e=>void changePreference(e.target.value as Lang,theme)} data-testid="select-language"><option value="en">English</option><option value="fr">Français</option><option value="ar">العربية</option></select>
        <IconButton onClick={()=>void changePreference(lang,theme==='dark'?'light':'dark')} label={t('theme')} testId="button-theme">{theme==='dark'?<Sun size={18}/>:<Moon size={18}/>}</IconButton>
        {account && profile && <IconButton onClick={()=>nav('/settings')} label={t('settings')} testId="button-settings"><Settings size={18}/></IconButton>}
        {account && profile && <IconButton onClick={()=>void logout()} label={t('signOut')} testId="button-header-logout"><LogOut size={18}/></IconButton>}
      </div>
    </header>;
  };
  const openReceiptPage = (merchantId?: string) => {
    setReceiptMerchantId(merchantId || selectedMerchant?.id || '');
    setReceiptFile('');
    setPurchaseDate(new Date().toISOString().slice(0,10));
    nav('/capture-receipt');
  };
  const shell = (content: ReactNode, showBottomNav = true) => <div className="app-shell grain" dir={isRtl?'rtl':'ltr'}>{header()}<main className="page-enter" style={{ maxWidth:1120, margin:'0 auto', padding:showBottomNav?'12px 18px 90px':'12px 18px 24px' }}>{content}</main>{customer&&showBottomNav&&<BottomNav path={location} nav={nav} t={t} onReceipt={openReceiptPage}/ >}</div>;
  const Empty = ({ icon, title, text }: { icon: ReactNode; title: string; text: string }) => <div className="surface" style={{ padding:'38px 24px', textAlign:'center' }}><div style={{ color:'hsl(var(--primary))', marginBottom:10 }}>{icon}</div><h3 style={{ margin:'0 0 6px', fontSize:20 }}>{title}</h3><p className="subtle" style={{ maxWidth:440, margin:'0 auto', lineHeight:1.65 }}>{text}</p></div>;
  const noticeBox = (text:string, isError=false) => <div role={isError?'alert':'status'} data-testid={isError?'status-error':'status-success'} style={{ background:isError?'hsl(var(--destructive) / .12)':'hsl(var(--primary) / .12)', color:isError?'hsl(var(--destructive))':'hsl(var(--foreground))', padding:'12px 15px', borderRadius:12, marginBottom:14, fontWeight:600 }}>{text}</div>;
  const statusLabel = (s:string) => s==='approved'?t('approved'):s==='rejected'?t('rejected'):s==='cancelled'?t('cancelled'):t('pending');
  const statusPill = (s:string) => <span className="status-pill" data-testid={`status-${s}`}>{statusLabel(s)}</span>;

  if (splash) return <div className="splash"><img src="/splash.png" alt="CASH BACK" /></div>;
  if (isLoading && !profile) return <div className="app-shell" style={{ minHeight:'100dvh', display:'grid', placeItems:'center', padding:22 }}><div className="surface" style={{ width:'min(100%,420px)', padding:30, textAlign:'center' }}><div style={{ width:52,height:52,borderRadius:16,background:'hsl(var(--muted))',margin:'0 auto 14px' }} /><div style={{ height:15,width:'60%',borderRadius:8,background:'hsl(var(--muted))',margin:'0 auto 9px' }}/><p className="subtle">{t('loading')}</p></div></div>;
  if (profile && isError) return shell(<div style={{ maxWidth:540, margin:'50px auto' }}>{noticeBox(t('loadError'),true)}<button className="btn btn-primary" onClick={()=>void refetch()} data-testid="button-retry">{t('retryLoad')} <RefreshCw size={16}/></button></div>);

  if (!profile) {
    const activeAuth = authMode==='register' ? t('createAccount') : authMode==='reset' ? t('reset') : t('login');
    return <div className="app-shell grain" dir={isRtl?'rtl':'ltr'}>
      {header(false)}
      <main style={{ maxWidth:1040, margin:'0 auto', padding:'24px 18px 60px', display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(min(100%,360px),1fr))', gap:24, alignItems:'stretch' }}>
        <section className="auth-hero" style={{ minHeight:500, padding:'clamp(28px,5vw,58px)', borderRadius:28, display:'flex', flexDirection:'column', justifyContent:'space-between', overflow:'hidden', position:'relative' }}>
          <div className="auth-orbit" style={{ position:'absolute', inset:'auto -15% -27% auto', width:360,height:360,borderRadius:'50%' }}/>
          <div className="auth-hero-copy" style={{ position:'relative' }}><span className="auth-kicker">{t('localTag')}</span><h1 style={{ fontSize:'clamp(36px,6vw,62px)', lineHeight:1.03, margin:'22px 0 15px', maxWidth:480 }}>{t('customerEntry')}</h1><p style={{ maxWidth:460, fontSize:17, lineHeight:1.65 }}>{t('customerBlurb')}</p></div>
          <div className="auth-callout" style={{ position:'relative', display:'flex', gap:13, alignItems:'center', marginTop:34 }}><div className="auth-callout-icon" style={{ width:46,height:46,borderRadius:15,display:'grid',placeItems:'center' }}><Wallet size={23}/></div><div><strong style={{ display:'block' }}>{t('separationNudge')}</strong><span className="auth-hint" style={{fontSize:13}}>{t('separationHint')}</span></div></div>
        </section>
        <section className="surface" style={{ padding:'clamp(22px,4vw,36px)', borderRadius:26, alignSelf:'center' }}>
          <div style={{ display:'flex',gap:6, padding:4, borderRadius:13,background:'hsl(var(--muted))',marginBottom:24 }}>
            <button className={`btn ${registerRole==='customer'?'btn-primary':''}`} style={{ flex:1,background:registerRole==='customer'?undefined:'transparent' }} onClick={()=>{setRegisterRole('customer');setAuthMode('login');clearMessages()}} data-testid="tab-customer"><UserRound size={16}/>{t('customer')}</button>
            <button className={`btn ${registerRole==='merchant'?'btn-primary':''}`} style={{ flex:1,background:registerRole==='merchant'?undefined:'transparent' }} onClick={()=>{setRegisterRole('merchant');setAuthMode('login');clearMessages()}} data-testid="tab-merchant"><Store size={16}/>{t('merchant')}</button>
          </div>
          <div style={{ display:'flex',alignItems:'center',gap:12,marginBottom:18 }}><div style={{ width:42,height:42,borderRadius:13,background:'hsl(var(--primary) / .16)',color:'hsl(var(--primary))',display:'grid',placeItems:'center' }}>{registerRole==='merchant'?<Store size={20}/>:<Wallet size={20}/>}</div><div><h2 style={{ margin:0,fontSize:24 }}>{activeAuth}</h2><span className="subtle" style={{ fontSize:13 }}>{t('welcome')}</span></div></div>
          {error && noticeBox(error,true)}{notice && noticeBox(notice)}
          {authMode==='register' ? <form onSubmit={e=>{e.preventDefault();void beginRegistration();}} style={{ display:'grid',gap:13 }}>
            <Field label={registerRole==='merchant'?t('shopName'):t('name')} value={name} onChange={setName} testId="input-name" required/>
            <Field label={t('phone')} value={phone} onChange={setPhone} testId="input-phone" type="tel" required={registerRole==='merchant'} placeholder="+213 …"/><small className="subtle">{t('phoneSignupHint')}</small>
            <Field label={t('email')} value={email} onChange={setEmail} testId="input-email" type="email" required/>
            <Field label={t('password')} value={password} onChange={setPassword} testId="input-password" type="password" required/>
            <Field label={t('confirmPassword')} value={confirm} onChange={setConfirm} testId="input-confirm-password" type="password" required/>
            {registerRole==='merchant' && <>
              <label style={{display:'grid',gap:6,fontSize:14,fontWeight:600}}>{t('country')}<select className="field" value={country} onChange={e=>{setCountry(e.target.value);setCity('')}} data-testid="select-country"><option value="Algeria">{t('algeria')}</option><option value="Libya">{t('libya')}</option></select></label>
              <SelectField label={t('city')} value={city} onChange={setCity} options={country==='Algeria'?wilayas:libyanCities} testId="select-city" formatOption={(_option,index)=>lang==='ar'?(country==='Algeria'?wilayasArabic[index]:libyanCitiesArabic[index]):_option}/>
              <Field label={t('location')} value={address} onChange={setAddress} testId="input-address" required/>
              <Field label={t('mapLink')} value={mapsUrl} onChange={setMapsUrl} testId="input-map" placeholder={t('mapNote')} required/>
              <label style={{display:'grid',gap:6,fontSize:14,fontWeight:600}}>{t('category')}<select className="field" value={category} onChange={e=>setCategory(e.target.value)} data-testid="input-category" required><option value="">—</option>{merchantApplicationCategories.map(key=><option key={key} value={key}>{t(`cat_${key}`)}</option>)}</select></label>
              <label style={{ display:'grid',gap:6,fontSize:14,fontWeight:600 }}>{t('logo')}<input className="field" type="file" accept="image/*" onChange={e=>void saveLogo(e.target.files?.[0])} data-testid="input-shop-logo"/>{logoData && <span className="subtle">✓ {t('choose')}</span>}</label>
            </>}
            <button type="submit" className="btn btn-primary" disabled={register.isPending} data-testid="button-register">{register.isPending?t('loading'):t('continue')} <ArrowRight size={17}/></button>
            <button type="button" className="btn" style={{ background:'transparent',color:'hsl(var(--muted-foreground))' }} onClick={()=>{setAuthMode('login');clearMessages()}} data-testid="button-existing-account">{t('haveAccount')} {t('login')}</button>
          </form> : authMode==='reset' ? <form onSubmit={e=>{e.preventDefault();void resetPassword();}} style={{ display:'grid',gap:14 }}><Field label={t('email')} value={email} onChange={setEmail} testId="input-email" type="email"/><button type="submit" className="btn btn-primary" data-testid="button-reset">{t('reset')} <ArrowRight size={17}/></button><button type="button" className="btn btn-outline" onClick={()=>setAuthMode('login')} data-testid="button-back-login">{t('back')}</button></form> :
          <form onSubmit={e=>{e.preventDefault();void signIn();}} style={{ display:'grid',gap:14 }}>
            {isError && queryError && sessionHttpStatus !== 401 && noticeBox(t('loadError'),true)}
             <Field label={t('loginIdentifier')} value={loginIdentifier} onChange={setLoginIdentifier} testId="input-email" type="text" autoComplete="username" required/>{loginIdentifier.trim()&&!loginIdentifier.includes('@')&&<small className="subtle">{t('phoneNotVerified')}</small>}
            <Field label={t('password')} value={password} onChange={setPassword} testId="input-password" type="password" required/>
            <button type="button" className="btn" style={{ justifyContent:'flex-end',background:'transparent',color:'hsl(var(--primary))',padding:0,minHeight:26 }} onClick={()=>{setAuthMode('reset');clearMessages()}} data-testid="button-forgot">{t('forgot')}</button>
            <button type="submit" className="btn btn-primary" data-testid="button-login">{t('login')} <ArrowRight size={17}/></button>
            <div style={{ textAlign:'center', color:'hsl(var(--muted-foreground))',fontSize:14 }}>{t('noAccount')} <button type="button" onClick={()=>{setAuthMode('register');clearMessages()}} style={{ border:0,background:'transparent',color:'hsl(var(--primary))',fontWeight:700,cursor:'pointer' }} data-testid="button-create-account">{t('createAccount')}</button></div>
          </form>}
        </section>
      </main>
      <div style={{ maxWidth:1040,margin:'0 auto',padding:'0 18px 30px',textAlign:'center' }}><button className="btn btn-outline" onClick={()=>{setRegisterRole('merchant');setAuthMode('register')}} data-testid="button-merchant-apply"><Store size={17}/>{t('applyShop')}</button><p className="subtle" style={{ fontSize:12,marginTop:14 }}>{t('tagline')}</p></div>
    </div>;
  }

  if (location.startsWith('/settings')) return shell(<SettingsPage lang={lang} theme={theme} setPreference={changePreference} t={t} profile={profile} logout={logout} notice={notice} error={error} />);
  if (customer && location === '/profile') {
    const customerData=state.customers?.find(c=>c.id===profile.eid);
    const profileClaims=claims.filter(c=>c.cid===profile.eid).sort((a,b)=>timestampOf(b.created||b.date)-timestampOf(a.created||a.date));
    const initials=profile.name.split(/\s+/).filter(Boolean).slice(0,2).map(part=>part[0]).join('').toLocaleUpperCase();
    const customerTxns=txns.filter(x=>x.cid===profile.eid);
    const customerPayments=(state.cbpays||[]).filter(payment=>payment.cid===profile.eid&&(payment.status==='done'||payment.status==='approved'||payment.status==='reversed')).sort((a,b)=>timestampOf(b.at)-timestampOf(a.at));
    const rewardShopCount=activeMerchants.filter(shop=>Number(customerData?.cbm?.[shop.id]||0)>0).length;
    const photoUrl=`/api/cashback/profile/photo?v=${encodeURIComponent(String(profile.avatarUpdatedAt??''))}`;
    return shell(<section className="profile-page profile-refresh" style={{maxWidth:740,margin:'12px auto',display:'grid',gap:15}}>
      <div className="profile-topbar" dir="ltr">
        <button className="profile-back" onClick={()=>nav('/')} aria-label={t('home')} data-testid="button-profile-back"><ArrowLeft size={20}/></button>
        <h1 dir="auto">{t('profileSettingsTitle')}</h1>
        <button className="profile-brand" onClick={()=>nav('/')} aria-label={t('home')} data-testid="link-profile-brand"><img src="/cashback-logo-transparent.png" alt="CASH BACK"/></button>
      </div>
      <div className="profile-summary surface">
        <div className="profile-summary-head">
          <div className="profile-avatar-wrap">
            {photoFailed||profile.avatarUpdatedAt===undefined?<div className="profile-avatar" aria-hidden="true">{initials}</div>:<img className="profile-avatar profile-avatar-image" src={photoUrl} alt={profile.name} loading="eager" onLoad={()=>setPhotoFailed(false)} onError={()=>setPhotoFailed(true)} data-testid="img-profile-avatar"/>}
            <button type="button" className="profile-photo-edit" aria-label={t('changePhoto')} title={t('changePhoto')} disabled={photoUploading} onClick={()=>document.getElementById('input-profile-photo')?.click()} data-testid="button-profile-photo"><Camera size={16}/></button>
            <input id="input-profile-photo" className="profile-photo-input" type="file" accept="image/jpeg,image/png,image/webp" aria-label={t('changePhoto')} disabled={photoUploading} onChange={event=>{const file=event.currentTarget.files?.[0];void uploadProfilePhoto(file);event.currentTarget.value='';}} data-testid="input-profile-photo"/>
          </div>
          <div className="profile-identity"><h2 data-testid="text-profile-name">{profile.name}</h2>{profile.phone&&<span data-testid="text-profile-phone">{profile.phone}</span>}{profile.email&&<span data-testid="text-profile-email">{profile.email}</span>}</div>
        </div>
        <div className="profile-stats">
          <div><strong data-testid="text-profile-receipt-count">{profileClaims.length}</strong><span>{t('receipt')}</span></div>
          <div><strong data-testid="text-profile-transaction-count">{customerTxns.length+customerPayments.length}</strong><span>{t('transactions')}</span></div>
          <div><strong data-testid="text-profile-reward-shops">{rewardShopCount}</strong><span>{t('rewardShops')}</span></div>
        </div>
        {photoUploading&&<div className="profile-photo-status" role="status" data-testid="status-profile-photo">{t('photoUploading')}</div>}
      </div>
      <section className="profile-menu surface">
        <h2>{t('quickAccess')}</h2>
        <button className="profile-menu-row" onClick={()=>nav('/settings')} data-testid="button-profile-details"><UserRound size={19}/><span>{t('myDetails')}</span><ArrowLeft className="profile-menu-chevron" size={17}/></button>
        <button className="profile-menu-row" onClick={()=>nav('/receipts')} data-testid="button-profile-receipts"><ReceiptText size={19}/><span>{t('claimHistory')}</span><ArrowLeft className="profile-menu-chevron" size={17}/></button>
        <button className="profile-menu-row" onClick={()=>nav('/wallet')} data-testid="button-profile-wallet"><Gift size={19}/><span>{t('walletTitle')}</span><ArrowLeft className="profile-menu-chevron" size={17}/></button>
        <button className="profile-menu-row" onClick={()=>nav('/transactions')} data-testid="button-profile-transactions"><ArrowDownLeft size={19}/><span>{t('transactions')}</span><ArrowLeft className="profile-menu-chevron" size={17}/></button>
        <button className="profile-menu-row" onClick={()=>void inviteFriend()} data-testid="button-profile-invite"><Share2 size={19}/><span>{t('inviteFriends')}</span><ArrowLeft className="profile-menu-chevron" size={17}/></button>
      </section>
      <section className="profile-menu profile-preferences surface">
        <h2>{t('interfacePrefs')}</h2>
        <div className="profile-menu-row profile-pref-row"><Moon size={19}/><span>{t('theme')}</span><button type="button" role="switch" aria-checked={theme==='dark'} aria-label={t('theme')} className={`profile-theme-switch ${theme==='dark'?'is-on':''}`} onClick={()=>void changePreference(lang,theme==='dark'?'light':'dark')} data-testid="button-profile-theme"><span/></button></div>
        <div className="profile-menu-row profile-pref-row"><Globe2 size={19}/><span>{t('language')}</span><select className="field profile-language-select" aria-label={t('language')} value={lang} onChange={e=>void changePreference(e.target.value as Lang,theme)} data-testid="select-profile-language"><option value="ar">العربية</option><option value="fr">Français</option><option value="en">English</option></select></div>
        <button className="profile-menu-row profile-settings-row" onClick={()=>nav('/settings')} data-testid="button-profile-all-settings"><Settings size={19}/><span>{t('settings')}</span><ArrowLeft className="profile-menu-chevron" size={17}/></button>
      </section>
      {(error||notice)&&<div className="profile-feedback" role={error?'alert':'status'}>{error||notice}</div>}
      <button className="btn btn-outline profile-logout" onClick={()=>void logout()} data-testid="button-logout"><LogOut size={17}/>{t('signOut')}</button>
    </section>);
  }
  if (customer && location === '/notifications') return shell(<section className="history-page notifications-page page-enter">
    <div className="profile-topbar full-page-tool-header" dir="ltr">
      <button className="profile-back" onClick={()=>nav('/')} aria-label={t('home')} data-testid="button-notifications-back"><ArrowLeft size={20}/></button>
      <h1 dir="auto">{t('notifications')}</h1>
      <button className="profile-brand" onClick={()=>nav('/')} aria-label={t('home')} data-testid="link-notifications-brand"><img src="/cashback-logo-transparent.png" alt="CASH BACK"/></button>
    </div>
    {customerNotes.length===0 ? <div className="surface profile-empty"><Bell size={24}/><span>{t('noNotifications')}</span></div> : <div className="notification-page-list">
      {customerNotes.map(note=><article className={`surface home-notification-row ${note.read?'is-read':'is-unread'}`} key={note.id} data-testid={`notification-${note.id}`}>
        <span className="home-notification-mark" aria-hidden="true"><Bell size={18}/></span>
        <div><p>{note.text}</p>{note.t&&<small className="subtle">{new Date(note.t).toLocaleString(lang==='ar'?'ar-DZ':lang==='fr'?'fr-FR':'en')}</small>}</div>
      </article>)}
    </div>}
  </section>);
  if (customer && location === '/capture-receipt') return shell(<>{error&&noticeBox(error,true)}{notice&&noticeBox(notice)}{receiptPageContent}</>,false);
  if (customer && location === '/receipts') {
    const profileClaims=claims.filter(c=>c.cid===profile.eid).sort((a,b)=>timestampOf(b.created||b.date)-timestampOf(a.created||a.date));
    return shell(<section className="history-page page-enter">
      <div className="profile-topbar" dir="ltr"><button className="profile-back" onClick={()=>nav('/profile')} aria-label={t('profile')} data-testid="button-receipts-back"><ArrowLeft size={20}/></button><h1 dir="auto">{t('claimHistory')}</h1><button className="profile-brand" onClick={()=>nav('/')} aria-label={t('home')} data-testid="link-receipts-brand"><img src="/cashback-logo-transparent.png" alt="CASH BACK"/></button></div>
      <div className="history-intro"><span className="history-eyebrow">{t('accountSection')}</span><p>{t('receiptHistoryIntro')}</p></div>
      {error&&noticeBox(error,true)}{notice&&noticeBox(notice)}
      {isLoading?<div className="history-skeleton" aria-label={t('historyLoad')}><i/><i/><i/></div>:profileClaims.length===0?<div className="surface profile-empty"><ReceiptText size={24}/><span>{t('noReceipts')}</span></div>:<div className="history-list">{profileClaims.map(claim=><ClaimRow key={claim.id} claim={claim} shop={merchants.find(m=>m.id===claim.mid)} t={t} onCancel={()=>void cancelClaim(claim)}/>)}</div>}
    </section>);
  }
  if (customer && location === '/transactions') {
    const customerTxns=txns.filter(x=>x.cid===profile.eid);
    const customerPayments=(state.cbpays||[]).filter(payment=>payment.cid===profile.eid&&(payment.status==='done'||payment.status==='approved'||payment.status==='reversed'));
    const historyRows=[
      ...customerPayments.map(payment=>({id:`payment-${payment.id}`,at:payment.at||'',kind:payment.status==='reversed'?'reversedPayment' as const:'used' as const,mid:payment.mid,value:Number(payment.amount)})),
      ...customerTxns.map(txn=>({id:`txn-${txn.id}`,at:txn.t||'',kind:'earned' as const,mid:txn.mid,value:Number(txn.cashback||0)})),
    ].sort((a,b)=>timestampOf(b.at)-timestampOf(a.at));
    return shell(<section className="history-page page-enter">
      <div className="profile-topbar" dir="ltr"><button className="profile-back" onClick={()=>nav('/profile')} aria-label={t('profile')} data-testid="button-transactions-back"><ArrowLeft size={20}/></button><h1 dir="auto">{t('transactions')}</h1><button className="profile-brand" onClick={()=>nav('/')} aria-label={t('home')} data-testid="link-transactions-brand"><img src="/cashback-logo-transparent.png" alt="CASH BACK"/></button></div>
      <div className="history-intro"><span className="history-eyebrow">{t('accountSection')}</span><p>{t('transactionHistoryIntro')}</p></div>
      {isLoading?<div className="history-skeleton" aria-label={t('historyLoad')}><i/><i/><i/></div>:historyRows.length===0?<div className="surface profile-empty"><ArrowDownLeft size={24}/><span>{t('noTransactions')}</span></div>:<div className="history-list">{historyRows.map(row=>{const shop=merchants.find(m=>m.id===row.mid);const returned=row.kind==='reversedPayment';return <div className="surface profile-transaction-row history-transaction" key={row.id} data-testid={`row-transaction-${row.id}`}><span><strong>{shop?.name||t('merchantId')}</strong><small>{t(row.kind)} · {row.at||'—'}</small></span><strong className={row.kind==='earned'||returned?'profile-earned-value':''}>{row.kind==='earned'||returned?'+':row.kind==='used'?'−':''}{formatMoney(row.value,shop?.country)}</strong></div>;})}</div>}
    </section>);
  }
  if (customer && location === '/shops') return shell(<div className="shops-directory-page" style={{display:'grid',gap:18,maxWidth:980,margin:'8px auto'}}>
    <PageTitle icon={<Store size={19}/>} title={t('stores')} eyebrow={t('nearby')}/>
    <div className="discovery-tools">
      <label className="shop-search"><Search size={17}/><input className="field" value={search} onChange={e=>setSearch(e.target.value)} placeholder={t('search')} aria-label={t('search')} data-testid="input-search-shops"/></label>
      <label className="area-select"><span><Globe2 size={16}/>{t('country')}</span><select className="field" value={countryFilter||(availableCountries.length===1?availableCountries[0]:'')} onChange={e=>{setCountryFilter(e.target.value);setCityFilter('');}} aria-label={t('country')} data-testid="select-shop-country"><option value="">{t('allCountries')}</option>{availableCountries.map(country=><option key={country} value={country}>{t(country==='Libya'?'libya':'algeria')}</option>)}</select></label>
      <label className="area-select"><span><MapPin size={16}/>{t('city')}</span><select className="field" value={cityFilter} onChange={e=>setCityFilter(e.target.value)} aria-label={t('city')} data-testid="select-shop-area"><option value="">{t('allCities')}</option>{availableCities.map(city=><option key={city} value={city}>{localizeCity(city,lang)}</option>)}</select></label>
    </div>
    <section className="category-section">
      <div className="home-section-head"><h2>{t('categories')}</h2><button className="text-link" onClick={()=>setSelectedCategory('')} data-testid="button-view-categories">{t('viewAll')}</button></div>
      <div className="category-rail" role="group" aria-label={t('categories')}>{activeCategories.map(cat=><button key={cat} className={`category-chip ${selectedCategory===cat?'is-active':''}`} onClick={()=>setSelectedCategory(selectedCategory===cat?'':cat)} aria-pressed={selectedCategory===cat} data-testid={`filter-category-${cat}`}><CategoryIcon category={cat}/>{t(`cat_${cat}`)}</button>)}</div>
    </section>
    <section className="home-shops-section">
      <div className="home-section-head"><div><h2>{t('nearby')}</h2><p className="subtle">{cityFilter?localizeCity(cityFilter,lang):countryFilter?t(countryFilter==='Libya'?'libya':'algeria'):availableCountries.length===1?t(availableCountries[0]==='Libya'?'libya':'algeria'):t('allShops')}</p></div><div style={{display:'flex',gap:10}}><button className="text-link" onClick={requestNearbySort} aria-label={t('useMyLocation')} title={t('useMyLocation')} data-testid="button-sort-nearby"><LocateFixed size={17}/></button><button className="text-link" onClick={()=>{setSearch('');setCountryFilter('');setCityFilter('');setSelectedCategory('');}} data-testid="button-view-shops">{t('viewAll')}</button></div></div>
      {filtered.length===0 ? <Empty icon={<Compass size={30}/>} title={t('noShops')} text={t('noShopsHint')}/> : <div className="merchant-grid">{filtered.map(shop=><button key={shop.id} className="surface merchant-card" onClick={()=>nav(`/shop/${shop.id}`)} data-testid={`card-shop-${shop.id}`}>
        <div className="merchant-card-image"><MediaImage id={shop.logoId} alt={shop.name} style={{width:'100%',height:'100%',objectFit:'cover'}}/>{shop.cashbackRate!==undefined&&<span className="merchant-rate"><strong>{shop.cashbackRate}%</strong><small>{t('cashback')}</small></span>}</div>
        <div className="merchant-card-copy"><div className="merchant-card-title"><div><h3>{shop.name}</h3><span className="subtle">{shop.cat?t(`cat_${shop.cat}`):t('merchant')}</span></div><ArrowRight size={17}/></div>
           {(shop.city||shop.address)&&<div className="merchant-location"><MapPin size={14}/><span>{localizeCity(shop.city,lang)||shop.address}{nearbyCoords&&Number.isFinite(distanceKm(nearbyCoords,shop))&&<> · {distanceKm(nearbyCoords,shop).toFixed(1)} {t('kmAway')}</>}</span></div>}
        </div>
      </button>)}</div>}
    </section>
  </div>);
  if (customer && location === '/wallet') return shell(<CustomerWallet profile={profile} state={state} merchants={merchants} txns={txns} setSelected={(m)=>{setSelectedMerchant(m);nav(`/wallet/${m.id}`)}} t={t} lang={lang} />);
  if (customer && location.startsWith('/wallet/')) {
    const mid=location.split('/')[2]; const shop=merchants.find(m=>m.id===mid);
    return shell(shop?<WalletDetail shop={shop} profile={profile} state={state} txns={txns} lang={lang} t={t} createSession={beginQrPayment} confirmPayment={finishQrPayment}/>:<Empty icon={<Wallet size={28}/>} title={t('walletTitle')} text={t('noShopsHint')}/>);
  }
  if (customer && selectedMerchant && location.startsWith('/shop/')) return shell(<ShopDetail shop={selectedMerchant} balance={selectedBalance} canRate={claims.some(claim=>claim.mid===selectedMerchant.id&&claim.cid===profile.eid&&claim.status==='approved')} ratingPending={rateMerchant.isPending} onRate={rating=>void rateShop(selectedMerchant,rating)} t={t} lang={lang} onBack={()=>nav('/')} onReceipt={()=>openReceiptPage(selectedMerchant.id)} onWallet={()=>nav(`/wallet/${selectedMerchant.id}`)} />);
  if (customer && location.startsWith('/shop')) return shell(<Empty icon={<Store size={28}/>} title={t('details')} text={t('noShopsHint')}/>);
  if (customer && location.startsWith('/settings')) return null;

  if (merchant) {
    const status=profile.status || merchants.find(m=>m.id===profile.eid)?.status || 'pending';
    if (status==='pending' || status==='rejected') return shell(<div style={{maxWidth:670,margin:'32px auto'}}>{error&&noticeBox(error,true)}{notice&&noticeBox(notice)}<div className="surface" style={{padding:'clamp(24px,6vw,44px)',textAlign:'center'}}><div style={{width:74,height:74,borderRadius:24,margin:'0 auto 18px',display:'grid',placeItems:'center',background:status==='pending'?'hsl(var(--secondary) / .28)':'hsl(var(--destructive) / .12)',color:status==='pending'?'hsl(var(--primary))':'hsl(var(--destructive))'}}>{status==='pending'?<Clock3 size={34}/>:<ShieldCheck size={34}/>}</div><span className="status-pill">{statusLabel(status)}</span><h1 style={{fontSize:34,margin:'14px 0 8px'}}>{status==='pending'?t('statusPending'):t('statusRejected')}</h1><p className="subtle" style={{fontSize:16,lineHeight:1.7}}>{status==='pending'?t('pendingHint'):profile.rejectionReason||t('retry')}</p><button className="btn btn-outline" style={{marginTop:18}} onClick={()=>void logout()} data-testid="button-logout"><LogOut size={17}/>{t('signOut')}</button></div></div>);
    const shop=merchants.find(m=>m.id===profile.eid);
    return shell(<MerchantDashboard shop={shop} state={state} claims={claims} t={t} lang={lang} notice={notice} error={error} onRefresh={()=>void refetch()} />);
  }
  if (admin) return shell(<AdminDashboard merchants={merchants} claims={claims} state={state} t={t} lang={lang} reason={reason} setReason={setReason} decideShop={decideShop} decideClaim={decideClaim} rate={rateValue} setRate={setRateValue} saveRate={saveRate} saveCategories={saveCategories} reversePayment={reverseQrPayment} reversalPending={reversePayment.isPending} notice={notice} error={error} />);
  if (!customer) return shell(<Empty icon={<CircleHelp size={28}/>} title={t('noPermission')} text={t('retryLoad')}/>);

  const customerClaims=claims.filter(c=>c.cid===profile.eid);
  const customerTransactions=txns.filter(x=>x.cid===profile.eid);
  const homeActivity=[
    ...customerTransactions.slice(-3).reverse().map(txn=>({id:`txn-${txn.id}`,kind:'txn' as const,txn,claim:null as Claim|null})),
    ...customerClaims.slice().sort((a,b)=>Date.parse(b.created||b.date||'')-Date.parse(a.created||a.date||'')).slice(0,3).map(claim=>({id:`claim-${claim.id}`,kind:'claim' as const,txn:null,claim})),
  ];
  return <>
    {shell(<>
      <div className="discovery-tools">
        <label className="shop-search"><Search size={17}/><input className="field" value={search} onChange={e=>setSearch(e.target.value)} placeholder={t('search')} aria-label={t('search')} data-testid="input-search-shops"/></label>
        <label className="area-select"><span><Globe2 size={16}/>{t('country')}</span><select className="field" value={countryFilter||(availableCountries.length===1?availableCountries[0]:'')} onChange={e=>{setCountryFilter(e.target.value);setCityFilter('');}} aria-label={t('country')} data-testid="select-shop-country"><option value="">{t('allCountries')}</option>{availableCountries.map(country=><option key={country} value={country}>{t(country==='Libya'?'libya':'algeria')}</option>)}</select></label>
        <label className="area-select"><span><MapPin size={16}/>{t('city')}</span><select className="field" value={cityFilter} onChange={e=>setCityFilter(e.target.value)} aria-label={t('city')} data-testid="select-shop-area"><option value="">{t('allCities')}</option>{availableCities.map(city=><option key={city} value={city}>{localizeCity(city,lang)}</option>)}</select></label>
      </div>
      <section className="promo-banner home-promo">
        <div className="home-promo-copy"><span className="home-promo-kicker">{t('homeBrandTagline')}</span><div className="home-promo-rate"><strong>{state.settings?.cashback ?? 4}%</strong><span>{t('homeCashback')}</span></div><h1>{t('homePromoTitle')}</h1><p>{t('homePromoSubtitle')}</p><button className="btn btn-promo" onClick={()=>openReceiptPage()} data-testid="button-promo-receipt"><Camera size={18}/>{t('homeCameraAction')}</button></div>
        <div className="promo-art" aria-hidden="true"><div className="promo-ticket"><ReceiptText size={34}/><strong>{t('cashback')}</strong><span><Gift size={20}/></span></div><span className="promo-orbit promo-orbit-one"/><span className="promo-orbit promo-orbit-two"/></div>
      </section>
      <section className="category-section">
        <div className="home-section-head"><h2>{t('categories')}</h2><button className="text-link" onClick={()=>nav('/shops')} data-testid="button-view-categories">{t('viewAll')}</button></div>
        <div className="category-rail" role="group" aria-label={t('categories')}>
          {activeCategories.map(cat=><button key={cat} className={`category-chip ${selectedCategory===cat?'is-active':''}`} onClick={()=>setSelectedCategory(selectedCategory===cat?'':cat)} aria-pressed={selectedCategory===cat} data-testid={`filter-category-${cat}`}><CategoryIcon category={cat}/>{t(`cat_${cat}`)}</button>)}
        </div>
      </section>
      <section id="home-shops" className="home-shops-section">
        <div className="home-section-head"><div><h2>{t('nearby')}</h2><p className="subtle">{cityFilter?localizeCity(cityFilter,lang):countryFilter?t(countryFilter==='Libya'?'libya':'algeria'):availableCountries.length===1?t(availableCountries[0]==='Libya'?'libya':'algeria'):t('allShops')}</p></div><div style={{display:'flex',gap:10}}><button className="text-link" onClick={requestNearbySort} aria-label={t('useMyLocation')} title={t('useMyLocation')} data-testid="button-sort-nearby"><LocateFixed size={17}/>{/* accessible location sort */}</button><button className="text-link" onClick={()=>nav('/shops')} data-testid="button-view-shops">{t('viewAll')}</button></div></div>
        {filtered.length===0 ? <Empty icon={<Compass size={30}/>} title={t('noShops')} text={t('noShopsHint')}/> : <div className="merchant-grid">{filtered.map(shop=><button key={shop.id} className="surface merchant-card" onClick={()=>nav(`/shop/${shop.id}`)} data-testid={`card-shop-${shop.id}`}>
          <div className="merchant-card-image"><MediaImage id={shop.logoId} alt={shop.name} style={{width:'100%',height:'100%',objectFit:'cover'}}/>{shop.cashbackRate!==undefined&&<span className="merchant-rate"><strong>{shop.cashbackRate}%</strong><small>{t('cashback')}</small></span>}</div>
          <div className="merchant-card-copy"><div className="merchant-card-title"><div><h3>{shop.name}</h3><span className="subtle">{shop.cat?t(`cat_${shop.cat}`):t('merchant')}</span></div><ArrowRight size={17}/></div>
             {(shop.city||shop.address)&&<div className="merchant-location"><MapPin size={14}/><span>{localizeCity(shop.city,lang)||shop.address}{nearbyCoords&&Number.isFinite(distanceKm(nearbyCoords,shop))&&<> · {distanceKm(nearbyCoords,shop).toFixed(1)} {t('kmAway')}</>}</span></div>}
          </div>
        </button>)}</div>}
      </section>
      <section className="home-activity-section">
        <div className="home-section-head"><h2>{t('recentActivity')}</h2><button className="text-link" onClick={()=>nav('/wallet')} data-testid="button-activity-wallet">{t('wallet')} <ArrowRight size={15}/></button></div>
        {homeActivity.length===0?<div className="surface activity-empty"><ReceiptText size={22}/><div><strong>{t('noActivity')}</strong><p>{t('receiptHint')}</p></div></div>:<div className="activity-list">{homeActivity.map(item=>{
          if(item.txn){const shop=merchants.find(m=>m.id===item.txn?.mid);return <div className="surface activity-row" key={item.id}><span className="activity-icon"><Wallet size={18}/></span><span className="activity-copy"><strong>{shop?.name||item.txn.t||t('merchantId')}</strong><small>{item.txn.t&&shop?.name?item.txn.t:t('earned')}</small></span>{item.txn.cashback!==undefined&&<strong className="activity-amount">+{formatMoney(item.txn.cashback,shop?.country)}</strong>}</div>}
          const claim=item.claim!;const shop=merchants.find(m=>m.id===claim.mid);return <div className="surface activity-row" key={item.id}><span className="activity-icon"><ReceiptText size={18}/></span><span className="activity-copy"><strong>{shop?.name||t('merchantId')}</strong><small>{claim.date||claim.created||t('receipt')} · {formatMoney(claim.amount,shop?.country)}</small></span>{statusPill(claim.status)}</div>;
        })}</div>}
      </section>
    </>)}
  </>;
}

function PageTitle({icon,title,eyebrow}:{icon:ReactNode;title:string;eyebrow:string}) { return <div style={{display:'flex',alignItems:'center',gap:14}}><div style={{width:48,height:48,borderRadius:16,background:'hsl(var(--primary) / .15)',color:'hsl(var(--primary))',display:'grid',placeItems:'center'}}>{icon}</div><div><span className="subtle" style={{fontSize:13}}>{eyebrow}</span><h1 style={{margin:0,fontSize:30}}>{title}</h1></div></div>; }
function InfoRow({label,value}:{label:string;value:string}) { return <div style={{display:'flex',justifyContent:'space-between',gap:10,borderBottom:'1px solid hsl(var(--border))',paddingBottom:12}}><span className="subtle">{label}</span><strong data-testid={`text-${label}`}>{value}</strong></div>; }
function SettingsPage({lang,theme,setPreference,t,profile,logout,notice,error}:{lang:Lang;theme:Theme;setPreference:(l:Lang,th:Theme)=>Promise<void>;t:(s:string)=>string;profile:Session['profile'];logout:()=>void;notice:string;error:string}) {
  return <div className="settings-page" style={{maxWidth:720,margin:'18px auto',display:'grid',gap:20}}><PageTitle icon={<Settings/>} title={t('settings')} eyebrow={t('preferences')}/>{error&&<div role="alert" className="surface" style={{padding:14,color:'hsl(var(--destructive))'}}>{error}</div>}{notice&&<div role="status" className="surface" style={{padding:14}}>{notice}</div>}<section className="surface" style={{padding:22,display:'grid',gap:20}}><div><strong style={{display:'block',marginBottom:8}}>{t('language')}</strong><div style={{display:'flex',gap:8,flexWrap:'wrap'}}>{([['en','English'],['fr','Français'],['ar','العربية']] as const).map(([key,label])=><button key={key} onClick={()=>void setPreference(key,theme)} className={`btn ${lang===key?'btn-primary':'btn-outline'}`} data-testid={`button-language-${key}`}>{label}</button>)}</div></div><div><strong style={{display:'block',marginBottom:8}}>{t('theme')}</strong><div style={{display:'flex',gap:8}}>{(['light','dark'] as Theme[]).map(v=><button key={v} onClick={()=>void setPreference(lang,v)} className={`btn ${theme===v?'btn-primary':'btn-outline'}`} data-testid={`button-theme-${v}`}>{v==='dark'?<Moon size={16}/>:<Sun size={16}/>} {t(v)}</button>)}</div></div></section><section className="surface" style={{padding:22,display:'grid',gap:14}}><strong>{t('profileText')}</strong><InfoRow label={t('name')} value={profile.name}/><InfoRow label={t('email')} value={profile.email||'—'}/><InfoRow label={t('phone')} value={profile.phone||'—'}/><button className="btn btn-outline" onClick={logout} data-testid="button-logout"><LogOut size={17}/>{t('signOut')}</button></section></div>;
}
function BottomNav({path,nav,t,onReceipt}:{path:string;nav:(path:string)=>void;t:(s:string)=>string;onReceipt:()=>void}) {
  const moreActive=['/profile','/receipts','/transactions','/settings'].includes(path);
  const items=[
    {href:'/',icon:<Home size={19}/>,label:t('home'),active:path==='/',onClick:()=>{if(path==='/')window.scrollTo({top:0,behavior:'smooth'});else nav('/');}},
    {href:'shops',icon:<Store size={19}/>,label:t('stores'),active:path==='/shops'||path.startsWith('/shop/'),onClick:()=>nav('/shops')},
    {href:'/wallet',icon:<Wallet size={19}/>,label:t('wallet'),active:path==='/wallet'||path.startsWith('/wallet/'),onClick:()=>nav('/wallet')},
    {href:'/profile',icon:<MoreHorizontal size={19}/>,label:t('more'),active:moreActive,onClick:()=>nav('/profile')},
  ];
  const renderItem=(item:typeof items[number])=><button key={item.href} className={`bottom-nav-item ${item.active?'is-active':''}`} onClick={item.onClick} data-testid={`nav-${item.href==='/'?'home':item.href==='shops'?'stores':item.href.slice(1)}`} aria-current={item.active?'page':undefined}>{item.icon}<span>{item.label}</span></button>;
  return <nav className="bottom-nav" aria-label={t('home')}>
    {items.slice(0,2).map(renderItem)}
    <button className="bottom-nav-receipt" onClick={onReceipt} aria-label={t('receipt')} data-testid="nav-receipt"><span><Camera size={22}/></span><small>{t('cameraNav')}</small></button>
    {items.slice(2).map(renderItem)}
  </nav>;
}
function CategoryIcon({category}:{category:string}) {
  if(category==='restaurants') return <Utensils size={17}/>;
  if(category==='cafes') return <Coffee size={17}/>;
  if(category==='clothing') return <Shirt size={17}/>;
  if(category==='electronics') return <Laptop size={17}/>;
  if(category==='malls'||category==='groceries') return <ShoppingBag size={17}/>;
  if(category==='gifts') return <Gift size={17}/>;
  return <Tag size={17}/>;
}
function ClaimRow({claim,shop,t,onCancel}:{claim:Claim;shop?:Merchant;t:(s:string)=>string;onCancel?:()=>void}) {
  const status = claim.status==='approved'?t('approved'):claim.status==='rejected'?t('rejected'):claim.status==='cancelled'?t('cancelled'):t('pending');
  return <div className="surface" data-testid={`row-claim-${claim.id}`} style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:10,padding:14,flexWrap:'wrap'}}>
    <div><strong>{shop?.name||t('merchantId')}</strong><div className="subtle" style={{fontSize:12}}>{claim.date||claim.created||'—'} · {formatMoney(claim.amount,shop?.country)}</div></div>
    <div style={{display:'flex',alignItems:'center',gap:8}}><span className="status-pill">{status}</span>{claim.status==='pending'&&onCancel&&<button className="btn btn-outline" onClick={onCancel} data-testid={`button-cancel-receipt-${claim.id}`}><X size={15}/>{t('cancelReceipt')}</button>}</div>
  </div>;
}
function CustomerWallet({profile,state,merchants,txns,setSelected,t,lang}:{profile:Session['profile'];state:Session['state'];merchants:Merchant[];txns:Txn[];setSelected:(m:Merchant)=>void;t:(s:string)=>string;lang:Lang}) {
  const cbm=state.customers?.find(c=>c.id===profile.eid)?.cbm||{};
  const list=merchants.filter(m=>m.status==='active');
  return <div className="customer-wallet-page">
    <PageTitle icon={<Wallet/>} title={t('myShopBalances')} eyebrow={t('walletHint')}/>
    {list.length===0?<div className="surface" style={{padding:30,textAlign:'center'}}><Wallet size={27} color="hsl(var(--primary))"/><h3>{t('noActivity')}</h3><p className="subtle">{t('noShopsHint')}</p></div>:<div className="customer-wallet-list">{list.map(shop=>{
      const entries=txns.filter(x=>x.cid===profile.eid&&x.mid===shop.id);
      const payments=state.cbpays?.filter(x=>x.cid===profile.eid&&x.mid===shop.id&&(x.status==='done'||x.status==='approved'||x.status==='reversed'))||[];
      const earned=entries.reduce((n,x)=>n+Number(x.cashback||0),0);
      const used=payments.filter(x=>x.status==='done'||x.status==='approved').reduce((n,x)=>n+Number(x.amount||0),0);
      const activity=[
        ...entries.map(x=>({id:`earn-${x.id}`,at:x.t||'',kind:'earned' as const,amount:Number(x.cashback||0)})),
        ...payments.map(x=>({id:`use-${x.id}`,at:x.at||'',kind:x.status==='reversed'?'reversedPayment' as const:'used' as const,amount:Number(x.amount||0)})),
      ].sort((a,b)=>timestampOf(b.at)-timestampOf(a.at)).slice(0,2);
      const balance=Number(cbm[shop.id]||0);
      return <article key={shop.id} className="surface customer-wallet-card" data-testid={`card-wallet-${shop.id}`}>
        <div className="customer-wallet-card-head">
          <MediaImage id={shop.logoId} alt={shop.name} style={{width:62,height:62,borderRadius:16,objectFit:'cover'}}/>
          <div className="customer-wallet-shop-copy"><span className="subtle">{shop.cat?t(`cat_${shop.cat}`):localizeCity(shop.city,lang)||t('merchantId')}</span><h2>{shop.name}</h2><div className="customer-wallet-totals"><span>{t('earned')}: {formatMoney(earned,shop.country)}</span><span>{t('used')}: {formatMoney(used,shop.country)}</span></div></div>
          <div className="customer-wallet-balance"><span className="subtle">{t('balance')}</span><strong>{formatMoney(balance,shop.country)}</strong></div>
        </div>
        <div className="customer-wallet-activity"><strong>{t('shopHistory')}</strong>{activity.length===0?<span className="subtle">{t('noActivity')}</span>:activity.map(row=><div className="customer-wallet-activity-row" key={row.id}><span>{t(row.kind)} · {row.at||'—'}</span><strong className={row.kind==='earned'||row.kind==='reversedPayment'?'profile-earned-value':''}>{row.kind==='earned'||row.kind==='reversedPayment'?'+':'−'}{formatMoney(row.amount,shop.country)}</strong></div>)}</div>
        <div className="customer-wallet-actions"><button className="btn btn-outline" onClick={()=>setSelected(shop)} data-testid={`button-wallet-history-${shop.id}`}><ReceiptText size={17}/>{t('viewShopHistory')}</button><button className="btn btn-primary" onClick={()=>setSelected(shop)} disabled={balance<=0} data-testid={`button-wallet-pay-${shop.id}`}><ScanLine size={17}/>{t('payAtShop')}</button></div>
      </article>;
    })}</div>}
  </div>;
}
function WalletDetail({shop,profile,state,txns,t,lang,createSession,confirmPayment}:{shop:Merchant;profile:Session['profile'];state:Session['state'];txns:Txn[];t:(s:string)=>string;lang:Lang;createSession:(merchantId:string,qrValue:string)=>Promise<any>;confirmPayment:(sessionId:string,amount:number)=>Promise<any>}) {
  const customer=state.customers?.find(c=>c.id===profile.eid);const balance=Number(customer?.cbm?.[shop.id]||0);
  const entries=txns.filter(x=>x.cid===profile.eid&&x.mid===shop.id);
  const payments=state.cbpays?.filter(x=>x.cid===profile.eid&&x.mid===shop.id&&(x.status==='done'||x.status==='approved'||x.status==='reversed'))||[];
  const earned=entries.reduce((a,x)=>a+Number(x.cashback||0),0);
  const used=payments.filter(x=>x.status==='done'||x.status==='approved').reduce((a,x)=>a+Number(x.amount||0),0);
  const activity=[
    ...entries.map(x=>({id:`earn-${x.id}`,at:x.t||'',kind:'earned' as const,amount:Number(x.cashback||0)})),
    ...payments.map(x=>({id:`use-${x.id}`,at:x.at||'',kind:x.status==='reversed'?'reversedPayment' as const:'used' as const,amount:Number(x.amount||0),reference:x.reference})),
  ].sort((a,b)=>timestampOf(b.at)-timestampOf(a.at));
  return <div className="customer-wallet-detail"><PageTitle icon={<Wallet/>} title={shop.name} eyebrow={t('walletHint')}/><section className="customer-wallet-detail-balance"><span>{t('balance')}</span><strong>{formatMoney(balance,shop.country)}</strong><div><span>{t('earned')}: {formatMoney(earned,shop.country)}</span><span>{t('used')}: {formatMoney(used,shop.country)}</span></div></section><QrPaymentFlow shop={shop} balance={balance} lang={lang} t={t} createSession={createSession} confirmPayment={confirmPayment}/><section><h2 style={{fontSize:22}}>{t('ledger')}</h2>{activity.length===0?<div className="surface" style={{padding:20}}><p className="subtle">{t('noActivity')}</p></div>:activity.map(row=><div className="surface" key={row.id} data-testid={`row-ledger-${row.id}`} style={{display:'flex',justifyContent:'space-between',padding:14,marginBottom:8}}><span><strong>{shop.name}</strong><small className="subtle" style={{display:'block'}}>{t(row.kind)} · {row.at||'—'}{'reference' in row&&row.reference?` · ${row.reference}`:''}</small></span><strong className={row.kind==='earned'||row.kind==='reversedPayment'?'profile-earned-value':''}>{row.kind==='earned'||row.kind==='reversedPayment'?'+':'−'}{formatMoney(row.amount,shop.country)}</strong></div>)}</section></div>;
}

function QrPaymentFlow({shop,balance,lang,t,createSession,confirmPayment}:{shop:Merchant;balance:number;lang:Lang;t:(key:string)=>string;createSession:(merchantId:string,qrValue:string)=>Promise<any>;confirmPayment:(sessionId:string,amount:number)=>Promise<any>}) {
  const [open,setOpen]=useState(false);
  return <><button type="button" onClick={()=>setOpen(true)} className="btn btn-primary qr-pay-trigger" disabled={balance<=0} data-testid="button-redeem"><ScanLine size={18}/>{t('payAtShop')} · {shop.name}</button>{open&&<PaymentDialog shop={shop} balance={balance} lang={lang} t={t} createSession={createSession} confirmPayment={confirmPayment} close={()=>setOpen(false)}/>}</>;
}

type PaymentSession = {sessionId:string;merchantId:string;merchantName:string;country?:string|null;balance:number;expiresAt:number};
type PaymentResult = {id:string;reference:string;status:'done';amount:number;merchantId:string;remainingBalance:number;merchantBalance:number;at:number};
function expiryMs(value:number) { return value < 1e12 ? value * 1000 : value; }
function PaymentDialog({shop,balance,lang,t,createSession,confirmPayment,close}:{shop:Merchant;balance:number;lang:Lang;t:(key:string)=>string;createSession:(merchantId:string,qrValue:string)=>Promise<PaymentSession>;confirmPayment:(sessionId:string,amount:number)=>Promise<PaymentResult>;close:()=>void}) {
  const [scanning,setScanning]=useState(false);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [session,setSession]=useState<PaymentSession|null>(null);
  const [amount,setAmount]=useState('');
  const [result,setResult]=useState<PaymentResult|null>(null);
  const [now,setNow]=useState(Date.now());
  const videoRef=useRef<HTMLVideoElement>(null);
  const scanTextRef=useRef<(text:string)=>void>(()=>undefined);
  const tRef=useRef(t);
  tRef.current=t;
  const expiresAt=session?expiryMs(session.expiresAt):0;
  const expired=!!session&&!result&&now>=expiresAt;
  useEffect(()=>{const timer=window.setInterval(()=>setNow(Date.now()),1000);return()=>window.clearInterval(timer);},[]);
  useEffect(()=>{
    if(!scanning)return;
    let alive=true;
    let controls:{stop:()=>void}|undefined;
    const video=videoRef.current;
    if(!video){setError(tRef.current('scanError'));setScanning(false);return;}
    void import('@zxing/browser').then(({BrowserQRCodeReader})=>{
      if(!alive)return;
      const reader=new BrowserQRCodeReader();
      return reader.decodeFromConstraints({audio:false,video:{facingMode:{ideal:'environment'}}},video,(decoded,_decodeError,control)=>{
        if(decoded&&alive){
          alive=false;
          control.stop();
          setScanning(false);
          scanTextRef.current(decoded.getText());
        }
      });
    }).then(value=>{if(value){controls=value;if(!alive)value.stop();}}).catch(()=>{if(alive){setError(tRef.current('scanError'));setScanning(false);}});
    return ()=>{alive=false;controls?.stop();const stream=video.srcObject as MediaStream|null;stream?.getTracks().forEach(track=>track.stop());video.srcObject=null;};
  },[scanning]);
  scanTextRef.current=(exactText:string)=>{
    setBusy(true);setError('');setSession(null);setResult(null);
    void createSession(shop.id,exactText).then(created=>{
      if(created.merchantId!==shop.id)throw new Error('QR_MERCHANT_MISMATCH');
      setSession(created);setAmount('');setNow(Date.now());
    }).catch(()=>setError(t('sessionError'))).finally(()=>setBusy(false));
  };
  const startScan=()=>{setError('');setSession(null);setResult(null);setScanning(true);};
  const submit=async()=>{
    if(!session||expired)return;
    const value=Number(amount);
    if(!Number.isFinite(value)||value<=0||value>session.balance)return;
    setBusy(true);setError('');
    try{const payment=await confirmPayment(session.sessionId,value);setResult(payment);setSession(null);}
    catch(caught){const code=(caught as {data?:{error?:string}})?.data?.error;if(code==='PAYMENT_SESSION_EXPIRED')setSession(null);setError(code==='PAYMENT_SESSION_EXPIRED'?t('sessionExpired'):code==='INSUFFICIENT_MERCHANT_BALANCE'?t('balanceChanged'):t('genericError'));}
    finally{setBusy(false);}
  };
  const remainingSeconds=Math.max(0,Math.ceil((expiresAt-now)/1000));
  const amountRemaining=Math.max(0,(session?.balance??0)-Number(amount||0));
  const formattedCountdown=`${String(Math.floor(remainingSeconds/60)).padStart(2,'0')}:${String(remainingSeconds%60).padStart(2,'0')}`;
  return <div className="dialog-backdrop qr-payment-backdrop" role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget)close();}}>
    <section className="dialog-panel qr-payment-dialog" role="dialog" aria-modal="true" aria-labelledby="qr-payment-title" dir={lang==='ar'?'rtl':'ltr'}>
      <header className="qr-dialog-header"><div><span className="qr-eyebrow">{t('wallet')}</span><h2 id="qr-payment-title">{t('scanPaymentQr')}</h2></div><button type="button" className="qr-close" onClick={close} aria-label={t('close')}><X size={20}/></button></header>
      {result?<div className="qr-success-state" role="status"><span className="qr-success-mark"><Check size={27}/></span><h3>{t('paymentSuccess')}</h3><p>{shop.name} · {formatMoney(result.amount,shop.country)}</p><div className="qr-result-row"><span>{t('paymentReference')}</span><strong dir="ltr">{result.reference}</strong></div><div className="qr-result-row"><span>{t('remainingBalance')}</span><strong>{formatMoney(result.remainingBalance,shop.country)}</strong></div><button type="button" className="btn btn-primary" onClick={close}>{t('closePayment')}</button></div>:
      <div className="qr-payment-body">
        {!session&&!busy&&<><p className="subtle qr-scan-hint">{t('scanHint')}</p><div className={`qr-camera-frame ${scanning?'is-scanning':''}`}>{scanning?<><video ref={videoRef} muted playsInline aria-label={t('scanning')}/><span className="qr-scan-corner qr-corner-one"/><span className="qr-scan-corner qr-corner-two"/><span className="qr-scan-line"/></>:<div className="qr-camera-empty"><ScanLine size={34}/><span>{t('scanSecureNote')}</span></div>}</div><button type="button" className="btn btn-primary qr-scan-button" onClick={startScan} disabled={scanning}><ScanLine size={18}/>{scanning?t('scanning'):t('startScan')}</button></>}
        {busy&&!session&&<div className="qr-inline-loading" role="status"><span className="qr-loading-bar"/><strong>{t('sessionLoading')}</strong></div>}
        {session&&!expired&&<div className="qr-confirm-card"><div className="qr-accepted"><BadgeCheck size={20}/><strong>{t('scannedShop')}</strong></div><h3>{session.merchantName}</h3><div className="qr-session-balance"><span>{t('balance')}</span><strong>{formatMoney(session.balance,session.country||shop.country)}</strong></div><p className="qr-expiry">{t('expiresIn')} <strong dir="ltr">{formattedCountdown}</strong></p><label className="qr-amount-field"><span>{t('enterPaymentAmount')}</span><input className="field" inputMode="decimal" type="number" min="0.01" step="0.01" max={session.balance} value={amount} onChange={event=>setAmount(event.target.value)} placeholder="0.00" data-testid="input-qr-payment-amount"/></label><div className="qr-session-balance"><span>{t('remainingBalance')}</span><strong>{formatMoney(amountRemaining,session.country||shop.country)}</strong></div><p className="qr-review-caption">{t('paymentReview')} · {shop.name}</p><button type="button" className="btn btn-primary qr-confirm-button" onClick={()=>void submit()} disabled={busy||!amount||Number(amount)<=0||Number(amount)>session.balance} data-testid="button-confirm-qr-payment">{busy?t('paymentWorking'):t('paymentConfirm')}</button></div>}
        {expired&&<div className="qr-expired" role="alert"><Clock3 size={24}/><strong>{t('sessionExpired')}</strong><button type="button" className="btn btn-outline" onClick={startScan}>{t('scanAgain')}</button></div>}
        {error&&<div className="qr-error" role="alert">{error}</div>}
        {!scanning&&!session&&!busy&&<p className="qr-privacy-note">{t('scanSecureNote')}</p>}
      </div>}
    </section>
  </div>;
}
function ShopDetail({shop,balance,canRate,ratingPending,onRate,t,onBack,onReceipt,onWallet,lang}:{shop:Merchant;balance:number;canRate:boolean;ratingPending:boolean;onRate:(rating:number)=>void;t:(s:string)=>string;onBack:()=>void;onReceipt:()=>void;onWallet:()=>void;lang:Lang}) {
  return <div style={{maxWidth:820,margin:'10px auto',display:'grid',gap:18}}>
    <button onClick={onBack} className="btn btn-outline" style={{justifySelf:'start'}} data-testid="button-back-shops"><ArrowLeft size={17}/>{t('allShops')}</button>
    <div className="surface" style={{overflow:'hidden'}}>
      <MediaImage id={shop.logoId} alt={shop.name} style={{width:'100%',height:'clamp(180px,38vw,330px)',objectFit:'cover'}}/>
      <div style={{padding:'clamp(18px,4vw,30px)',display:'grid',gap:16}}>
        <div style={{display:'flex',justifyContent:'space-between',gap:10,alignItems:'start'}}>
          <div><span className="subtle">{shop.cat?t(`cat_${shop.cat}`):t('merchant')}</span><h1 style={{fontSize:30,margin:'3px 0'}}>{shop.name}</h1></div>
          <div style={{color:'hsl(var(--primary))',fontSize:25,fontWeight:800,whiteSpace:'nowrap'}}>{shop.cashbackRate??0}%</div>
        </div>
        <div aria-label={t('rating')} style={{display:'flex',alignItems:'center',gap:7,flexWrap:'wrap'}}>
          <Star size={17} fill="hsl(var(--primary))" color="hsl(var(--primary))"/>
          <strong>{shop.ratingCount?Number(shop.rating||0).toFixed(1):t('noRatings')}</strong>
          {!!shop.ratingCount&&<span className="subtle">({shop.ratingCount} {t('ratingCount')})</span>}
        </div>
        <div style={{display:'flex',alignItems:'center',gap:6}} className="subtle"><MapPin size={16}/>{shop.address||localizeCity(shop.city,lang)||'—'}</div>
        {shop.mapsUrl&&<a href={shop.mapsUrl} target="_blank" rel="noreferrer" className="btn btn-outline" style={{textDecoration:'none',justifySelf:'start'}} data-testid="link-shop-map"><LocateFixed size={17}/>{t('shopOpen')}</a>}
        {shop.description&&<section><h2 style={{fontSize:20,margin:'0 0 5px'}}>{t('merchantInfo')}</h2><p className="subtle" style={{margin:0,lineHeight:1.7}}>{shop.description}</p></section>}
        <section className="surface" style={{padding:16,display:'flex',alignItems:'center',justifyContent:'space-between',gap:12,flexWrap:'wrap'}}>
          <div><span className="subtle">{t('merchantBalance')}</span><strong style={{display:'block',fontSize:24,color:'hsl(var(--primary))'}}>{formatMoney(balance,shop.country)}</strong></div>
          <button className="btn btn-outline" onClick={onWallet} data-testid="button-shop-wallet"><Wallet size={18}/>{t('spendHere')}</button>
        </section>
        <section>
          <strong>{t('rating')}</strong>
          <div style={{display:'flex',alignItems:'center',gap:5,marginTop:7}} role="group" aria-label={t('rating')}>
            {[1,2,3,4,5].map(value=><button key={value} type="button" className="btn btn-outline" aria-label={`${t('rating')} ${value}`} aria-pressed={Number(shop.userRating||0)===value} disabled={!canRate||ratingPending} onClick={()=>onRate(value)} data-testid={`button-rate-shop-${value}`} style={{padding:8,minHeight:40,color:Number(shop.userRating||0)>=value?'hsl(var(--primary))':undefined}}><Star size={18} fill={Number(shop.userRating||0)>=value?'currentColor':'none'}/></button>)}
          </div>
          {!canRate&&<p className="subtle" style={{margin:'6px 0 0',fontSize:13}}>{t('rateAfterPurchase')}</p>}
        </section>
        <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
          <button className="btn btn-primary" onClick={onReceipt} data-testid="button-shop-receipt"><ReceiptText size={18}/>{t('receipt')}</button>
        </div>
      </div>
    </div>
  </div>;
}
function MerchantDashboard({shop,state,claims,t,lang,notice,error,onRefresh}:{shop?:Merchant;state:Session['state'];claims:Claim[];t:(s:string)=>string;lang:Lang;notice:string;error:string;onRefresh:()=>void}) {
  const ownClaims=claims.filter(c=>c.mid===shop?.id);
  const open=ownClaims.filter(c=>c.status==='pending');
  const payments=(state.cbpays||[]).filter(payment=>payment.mid===shop?.id&&payment.method==='qr');
  const completedPayments=payments.filter(payment=>payment.status==='done');
  const received=completedPayments.reduce((sum,payment)=>sum+Number(payment.amount||0),0);
  const recentPayments=payments.slice().sort((a,b)=>timestampOf(b.at)-timestampOf(a.at)).slice(0,8);
  const refreshRef=useRef(onRefresh);
  refreshRef.current=onRefresh;
  useEffect(()=>{
    if(!shop?.id)return;
    const timer=window.setInterval(()=>refreshRef.current(),5000);
    return ()=>window.clearInterval(timer);
  },[shop?.id]);
  return <div style={{maxWidth:900,margin:'18px auto',display:'grid',gap:20}}>
    {error&&<div role="alert" className="surface" style={{padding:12,color:'hsl(var(--destructive))'}}>{error}</div>}
    {notice&&<div role="status" className="surface" style={{padding:12}}>{notice}</div>}
    <PageTitle icon={<Store/>} title={shop?.name||t('merchantDashboard')} eyebrow={t('merchantActive')}/>
    <div className="surface" style={{padding:20,display:'flex',alignItems:'start',gap:14}}><BadgeCheck color="hsl(var(--primary))"/><div><strong>{t('merchantActive')}</strong><p className="subtle" style={{margin:'4px 0'}}>{t('salesOnly')}</p></div></div>
    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))',gap:12}}>
      <Metric label={t('customers')} value={String(state.customers?.length||0)} icon={<UserRound/>}/>
      <Metric label={t('sales')} value={String(ownClaims.filter(c=>c.status==='approved').length)} icon={<ReceiptText/>}/>
      <Metric label={t('receiptQueue')} value={String(open.length)} icon={<Clock3/>}/>
      <Metric label={t('merchantQrPayments')} value={formatMoney(received,shop?.country)} icon={<Banknote/>}/>
      <Metric label={t('merchantWalletBalance')} value={formatMoney(Number(shop?.payoutBalance||0),shop?.country)} icon={<Wallet/>}/>
      {Number(shop?.payoutDebt||0)>0&&<Metric label={t('merchantWalletDebt')} value={formatMoney(Number(shop?.payoutDebt),shop?.country)} icon={<RotateCcw/>}/>}
    </div>
    <section className="surface merchant-qr-card" style={{padding:20}}>
      <div className="merchant-qr-info">
        <span className="qr-eyebrow">{t('merchantActive')}</span><strong>{t('qrCode')}</strong>
        <div className="subtle">{t('merchantId')}: {shop?.publicId||'—'}</div>
        <div className="merchant-qr-controls">
          <button className="btn btn-outline" type="button" onClick={()=>void downloadMerchantQr('png',t,shop?.name||'',shop?.publicId||'')} disabled={!shop?.qrValue}><Download size={16}/>{t('qrDownloadPng')}</button>
          <button className="btn btn-outline" type="button" onClick={()=>void downloadMerchantQr('pdf',t,shop?.name||'',shop?.publicId||'')} disabled={!shop?.qrValue}><FileDown size={16}/>{t('qrDownloadPdf')}</button>
          <button className="btn btn-outline" type="button" onClick={()=>printMerchantQr(t,shop?.name||'',shop?.publicId||'')} disabled={!shop?.qrValue}><Printer size={16}/>{t('qrPrint')}</button>
        </div>
      </div>
      {shop?.publicId&&shop.qrValue?<div className="merchant-qr-sheet" id="merchant-payment-qr" data-testid="merchant-payment-qr"><QRCodeSVG value={shop.qrValue} size={220} bgColor="#ffffff" fgColor="#140b05" level="M" includeMargin aria-label={t('qrCode')}/><strong className="merchant-qr-name">{shop.name}</strong><span dir="ltr">{shop.publicId}</span></div>:<p className="subtle">{t('qrExportError')}</p>}
    </section>
    <section className="surface payment-audit-section">
      <div className="payment-audit-heading"><div><span className="qr-eyebrow">{t('merchantDashboard')}</span><h2>{t('merchantQrPayments')}</h2></div><span className="payment-audit-count">{payments.length}</span></div>
      {recentPayments.length===0?<div className="payment-audit-empty"><Banknote size={22}/><span>{t('noActivity')}</span></div>:<div className="payment-audit-list">{recentPayments.map(payment=>{
        const customer=state.customers?.find(item=>item.id===payment.cid);
        const reversed=payment.status==='reversed';
        return <article className="payment-audit-row" key={payment.id} data-testid={`merchant-payment-${payment.id}`}>
          <div className="payment-audit-main"><div className="payment-audit-mark"><Banknote size={18}/></div><div className="payment-audit-copy"><strong>{customer?.name||payment.cid}</strong><small>{new Date(timestampOf(payment.at)).toLocaleString(lang==='ar'?'ar-DZ':lang==='fr'?'fr-FR':'en')}</small><code dir="ltr">{payment.reference||payment.id}</code></div><div className="payment-audit-amount"><small>{reversed?t('reversedPayment'):t('paymentSuccess')}</small><strong className={reversed?'':'profile-earned-value'}>{reversed?'−':'+'}{formatMoney(payment.amount,shop?.country)}</strong></div></div>
          {reversed&&payment.reversalReason&&<small className="subtle">{t('reversalReason')}: {payment.reversalReason}</small>}
        </article>;
      })}</div>}
    </section>
    <h2 style={{marginBottom:0}}>{t('receiptQueue')}</h2>
    {open.length===0?<div className="surface" style={{padding:20}}>{t('noPending')}</div>:open.map(c=><ClaimRow key={c.id} claim={c} shop={shop} t={t}/>)}
  </div>;
}
function readMerchantQrSvg() { return document.querySelector<SVGSVGElement>('#merchant-payment-qr svg'); }
async function downloadMerchantQr(kind:'png'|'pdf',t:(key:string)=>string,shopName:string,shopId:string):Promise<void> {
  try {
    const svg=readMerchantQrSvg();
    if(!svg)throw new Error('QR_NOT_FOUND');
    const markup=new XMLSerializer().serializeToString(svg);
    if(kind==='pdf') {
      const [{jsPDF}]=await Promise.all([import('jspdf'),import('svg2pdf.js')]);
      const pdf=new jsPDF({orientation:'portrait',unit:'pt',format:'a4'});
      const svgElement=new DOMParser().parseFromString(markup,'image/svg+xml').documentElement as unknown as SVGSVGElement;
      const size=260;
      const vectorPdf=pdf as typeof pdf & {svg:(element:SVGSVGElement,options:{x:number;y:number;width:number;height:number})=>Promise<unknown>};
      await vectorPdf.svg(svgElement,{x:(595.28-size)/2,y:90,width:size,height:size});
      await document.fonts?.load('700 64px Changa',shopName);
      const nameCanvas=document.createElement('canvas');
      nameCanvas.width=2000;nameCanvas.height=180;
      const nameContext=nameCanvas.getContext('2d');
      if(!nameContext)throw new Error('PDF_TEXT_RENDER_FAILED');
      nameContext.clearRect(0,0,nameCanvas.width,nameCanvas.height);
      nameContext.fillStyle='#241307';
      nameContext.font='700 64px Changa, sans-serif';
      nameContext.textAlign='center';
      nameContext.textBaseline='middle';
      nameContext.direction='rtl';
      nameContext.fillText(shopName,nameCanvas.width/2,nameCanvas.height/2,1900);
      pdf.addImage(nameCanvas.toDataURL('image/png'),'PNG',60,365,475,43);
      pdf.setFontSize(12);
      pdf.text(`${t('merchantId')}: ${shopId}`,595.28/2,430,{align:'center'});
      pdf.save('cashback-shop-qr.pdf');
      return;
    }
    const blob=new Blob([markup],{type:'image/svg+xml;charset=utf-8'});
    const url=URL.createObjectURL(blob);
    const image=new Image();
    image.onload=()=>{const canvas=document.createElement('canvas');canvas.width=1200;canvas.height=1200;const context=canvas.getContext('2d');if(!context){URL.revokeObjectURL(url);alert(t('qrExportError'));return;}context.fillStyle='#ffffff';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(image,0,0,canvas.width,canvas.height);URL.revokeObjectURL(url);canvas.toBlob(png=>{if(!png){alert(t('qrExportError'));return;}const downloadUrl=URL.createObjectURL(png);const link=document.createElement('a');link.href=downloadUrl;link.download='cashback-shop-qr.png';link.click();window.setTimeout(()=>URL.revokeObjectURL(downloadUrl),1000);},'image/png');};
    image.onerror=()=>{URL.revokeObjectURL(url);alert(t('qrExportError'));};image.src=url;
  } catch { alert(t('qrExportError')); }
}
function printMerchantQr(t:(key:string)=>string,shopName:string,shopId:string) {
  const svg=readMerchantQrSvg();
  if(!svg){alert(t('qrExportError'));return;}
  const popup=window.open('','_blank','width=520,height=640');
  if(!popup){alert(t('qrExportError'));return;}
  popup.document.open();
  popup.document.write('<!doctype html><html><head><meta charset="utf-8"><title>CASH BACK</title><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Changa:wght@400;700&display=swap"><style>body{font-family:Changa,sans-serif;display:grid;place-items:center;min-height:95vh;color:#28190f}.sheet{text-align:center}.sheet svg{width:300px;height:300px}.id{font:14px monospace;margin-top:18px}</style></head><body></body></html>');
  popup.document.close();
  const sheet=popup.document.createElement('main');
  sheet.className='sheet';
  sheet.append(svg.cloneNode(true));
  const name=popup.document.createElement('h1');
  name.textContent=shopName;
  name.style.fontSize='22px';
  const id=popup.document.createElement('div');
  id.className='id';
  id.textContent=`${t('merchantId')}: ${shopId}`;
  sheet.append(name);
  sheet.append(id);
  popup.document.body.append(sheet);
  const closeAfterPrint=()=>{popup.close();};
  popup.addEventListener('afterprint',closeAfterPrint,{once:true});
  let printed=false;
  const printNow=()=>{if(!printed&&!popup.closed){printed=true;popup.focus();popup.print();}};
  void popup.document.fonts?.ready.then(printNow);
  window.setTimeout(printNow,1500);
  window.setTimeout(()=>{if(!popup.closed)popup.close();},20000);
}
function Metric({label,value,icon}:{label:string;value:string;icon:ReactNode}) { return <div className="surface" style={{padding:17}}><div style={{color:'hsl(var(--primary))'}}>{icon}</div><strong style={{fontSize:27,display:'block'}}>{value}</strong><span className="subtle">{label}</span></div>; }
function AdminDashboard({merchants,claims,state,t,lang,reason,setReason,decideShop,decideClaim,rate,setRate,saveRate,saveCategories,reversePayment,reversalPending,notice,error}:{merchants:Merchant[];claims:Claim[];state:Session['state'];t:(s:string)=>string;lang:Lang;reason:string;setReason:(s:string)=>void;decideShop:(m:Merchant,a:boolean)=>void;decideClaim:(c:Claim,a:boolean)=>void;rate:string;setRate:(s:string)=>void;saveRate:()=>void;saveCategories:(categories:string[])=>void;reversePayment:(id:string,reason:string)=>Promise<void>;reversalPending:boolean;notice:string;error:string}) {
  const configuredCategories=state.categories||[...browseCategories];
  const [selectedCategories,setSelectedCategories]=useState<string[]>(configuredCategories);
  useEffect(()=>setSelectedCategories(configuredCategories),[configuredCategories.join('|')]);
  const [receiptSearch,setReceiptSearch]=useState('');
  const newMerchants=merchants.filter(m=>m.status==='pending');const newClaims=claims.filter(c=>c.status==='pending');
  const receiptHistory=claims.slice().sort((a,b)=>timestampOf(b.created||b.date)-timestampOf(a.created||a.date)).filter(claim=>{
    const shop=merchants.find(m=>m.id===claim.mid);
    const customer=state.customers?.find(entry=>entry.id===claim.cid);
    return `${claim.invoiceNumber||''} ${claim.id} ${shop?.name||''} ${customer?.name||''}`.toLowerCase().includes(receiptSearch.trim().toLowerCase());
  });
  return <div style={{maxWidth:1000,margin:'18px auto',display:'grid',gap:20}}>
    {error&&<div role="alert" className="surface" style={{padding:12,color:'hsl(var(--destructive))'}}>{error}</div>}
    {notice&&<div role="status" className="surface" style={{padding:12}}>{notice}</div>}
    <PageTitle icon={<ShieldCheck/>} title={t('adminDashboard')} eyebrow={t('merchantQueue')}/>
    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(170px,1fr))',gap:12}}>
      <Metric label={t('merchantQueue')} value={String(newMerchants.length)} icon={<Store/>}/>
      <Metric label={t('receiptQueue')} value={String(newClaims.length)} icon={<ReceiptText/>}/>
      <Metric label={t('customers')} value={String(state.customers?.length||0)} icon={<UserRound/>}/>
    </div>
     <PaymentReversalList payments={state.cbpays||[]} merchants={merchants} customers={state.customers||[]} lang={lang} t={t} reversePayment={reversePayment} pending={reversalPending}/>
    <section className="surface" style={{padding:18}}>
      <strong>{t('adminSettings')} · {t('rate')}</strong>
      <div style={{display:'flex',gap:9,marginTop:10}}>
        <input className="field" type="number" min="0" max="100" step=".1" value={rate||String(state.settings?.cashback||0)} onChange={e=>setRate(e.target.value)} data-testid="input-admin-rate"/>
        <button className="btn btn-primary" onClick={saveRate} data-testid="button-admin-save-rate"><Percent size={17}/>{t('save')}</button>
      </div>
    </section>
    <section className="surface" style={{padding:18,display:'grid',gap:12}}>
      <div><strong>{t('categoriesManager')}</strong><p className="subtle" style={{margin:'4px 0 0'}}>{t('categoriesHint')}</p></div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))',gap:8}}>
        {browseCategories.map(category=><label key={category} className="surface" style={{padding:'10px 12px',display:'flex',alignItems:'center',gap:8,cursor:'pointer'}}>
          <input type="checkbox" checked={selectedCategories.includes(category)} onChange={event=>setSelectedCategories(current=>event.target.checked?[...current,category]:current.filter(item=>item!==category))} data-testid={`toggle-category-${category}`}/>
          <span>{t(`cat_${category}`)}</span>
        </label>)}
      </div>
      {!selectedCategories.length&&<small role="alert" className="subtle">{t('categoriesAtLeastOne')}</small>}
      <button className="btn btn-primary" disabled={!selectedCategories.length} onClick={()=>saveCategories(selectedCategories)} data-testid="button-save-categories"><Check size={17}/>{t('save')}</button>
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
          <div><strong>{shop?.name||t('merchantId')}</strong><div className="subtle">{c.invoiceNumber||c.date||'—'} · {formatMoney(c.amount,shop?.country)}</div><div className="subtle">{t('receiptCustomer')}: {state.customers?.find(customer=>customer.id===c.cid)?.name||c.cid} · {t('submittedAt')}: {c.created?new Date(c.created).toLocaleString(lang==='ar'?'ar-DZ':lang==='fr'?'fr-FR':'en'):'—'}{c.submitIp?` · ${t('submittedIp')}: ${c.submitIp}`:''}</div>{c.possibleDuplicate&&<strong style={{color:'hsl(var(--destructive))',fontSize:13}}>{t('possibleDuplicate')}</strong>}</div>
          {c.photoId&&<MediaImage id={c.photoId} alt={t('receipt')} style={{width:'100%',maxHeight:280,objectFit:'contain',background:'hsl(var(--muted))',borderRadius:12}}/>}
          <Field label={t('rejectionReason')} value={reason} onChange={setReason} testId={`input-reason-receipt-${c.id}`}/>
          <div style={{display:'flex',gap:9}}>
            <button className="btn btn-primary" onClick={()=>decideClaim(c,true)} data-testid={`button-approve-receipt-${c.id}`}><Check size={17}/>{t('approve')}</button>
            <button className="btn btn-outline" onClick={()=>decideClaim(c,false)} data-testid={`button-reject-receipt-${c.id}`}><X size={17}/>{t('decline')}</button>
          </div>
        </div>;
      })}
    </ReviewList>
    <ReviewList title={t('allReceipts')} empty={claims.length===0?t('noReceipts'):''}>
      <input className="field" value={receiptSearch} onChange={event=>setReceiptSearch(event.target.value)} placeholder={t('searchReceipts')} aria-label={t('searchReceipts')} data-testid="input-search-receipts"/>
      {receiptHistory.length===0?<div className="surface" style={{padding:16}}>{t('noReceipts')}</div>:receiptHistory.map(claim=>{
        const shop=merchants.find(m=>m.id===claim.mid);
        const customer=state.customers?.find(entry=>entry.id===claim.cid);
        const label=claim.status==='approved'?t('approved'):claim.status==='rejected'?t('rejected'):claim.status==='cancelled'?t('cancelled'):t('pending');
        return <article className="surface" key={claim.id} data-testid={`history-receipt-${claim.id}`} style={{padding:14,display:'grid',gap:8}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:10,flexWrap:'wrap'}}>
            <strong>{shop?.name||t('merchantId')}</strong><span className="status-pill">{label}</span>
          </div>
          <div className="subtle">{claim.invoiceNumber||claim.date||'—'} · {formatMoney(claim.amount,shop?.country)} · {t('receiptCustomer')}: {customer?.name||claim.cid}</div>
          <div className="subtle">{t('submittedAt')}: {claim.created?new Date(claim.created).toLocaleString(lang==='ar'?'ar-DZ':lang==='fr'?'fr-FR':'en'):'—'}{claim.submitIp?` · ${t('submittedIp')}: ${claim.submitIp}`:''}</div>
          {claim.possibleDuplicate&&<strong style={{color:'hsl(var(--destructive))',fontSize:13}}>{t('possibleDuplicate')}</strong>}
          {claim.photoId&&<MediaImage id={claim.photoId} alt={t('receipt')} style={{width:'100%',maxHeight:240,objectFit:'contain',background:'hsl(var(--muted))',borderRadius:12}}/>}
          {claim.reason&&<p className="subtle" style={{margin:0}}>{t('reason')}: {claim.reason}</p>}
        </article>;
      })}
    </ReviewList>
  </div>;
}
function PaymentReversalList({payments,merchants,customers,lang,t,reversePayment,pending}:{payments:NonNullable<Session['state']['cbpays']>;merchants:Merchant[];customers:NonNullable<Session['state']['customers']>;lang:Lang;t:(key:string)=>string;reversePayment:(id:string,reason:string)=>Promise<void>;pending:boolean}) {
  const [editingId,setEditingId]=useState('');
  const [reason,setReason]=useState('');
  const [error,setError]=useState('');
  const history=payments.filter(payment=>payment.method==='qr'&&(payment.status==='done'||payment.status==='approved'||payment.status==='reversed')).slice().sort((a,b)=>timestampOf(b.at)-timestampOf(a.at));
  const confirm=async(payment:{id:string})=>{
    if(reason.trim().length<3){setError(t('reasonRequired'));return;}
    if(!window.confirm(t('confirmReversePrompt')))return;
    setError('');
    try{await reversePayment(payment.id,reason.trim());setEditingId('');setReason('');}
    catch{setError(t('genericError'));}
  };
  return <section className="surface payment-audit-section">
    <div className="payment-audit-heading"><div><span className="qr-eyebrow">{t('adminDashboard')}</span><h2>{t('completedPayments')}</h2></div><span className="payment-audit-count">{history.length}</span></div>
    {history.length===0?<div className="payment-audit-empty"><RotateCcw size={22}/><span>{t('noCompletedPayments')}</span></div>:<div className="payment-audit-list">{history.map(payment=>{
      const merchant=merchants.find(item=>item.id===payment.mid);
      const customer=customers.find(item=>item.id===payment.cid);
      return <article className="payment-audit-row" key={payment.id} data-testid={`payment-audit-${payment.id}`}>
        <div className="payment-audit-main"><div className="payment-audit-mark"><Banknote size={18}/></div><div className="payment-audit-copy"><strong>{merchant?.name||t('merchantId')}</strong><small>{customer?.name||payment.cid} · {payment.at?new Date(timestampOf(payment.at)).toLocaleString(lang==='ar'?'ar-DZ':lang==='fr'?'fr-FR':'en'): '—'}</small><code dir="ltr">{payment.reference||payment.id}</code></div><div className="payment-audit-amount"><small>{t('paymentAmount')}</small><strong>{formatMoney(payment.amount,merchant?.country)}</strong></div></div>
        {payment.status==='reversed'&&<small className="subtle">{t('reversedPayment')}{payment.reversalReason?` · ${payment.reversalReason}`:''}</small>}
        {payment.status==='done'&& (editingId===payment.id?<div className="payment-reversal-form"><label><span>{t('reversalReason')}</span><textarea className="field" rows={2} value={reason} onChange={event=>setReason(event.target.value)} maxLength={300} data-testid={`input-reversal-reason-${payment.id}`}/></label><small className="subtle">{t('confirmReversePrompt')}</small>{error&&<small role="alert" className="payment-inline-error">{error}</small>}<div className="payment-reversal-actions"><button type="button" className="btn btn-outline" onClick={()=>{setEditingId('');setReason('');setError('');}}>{t('close')}</button><button type="button" className="btn btn-primary payment-reverse-button" disabled={pending||reason.trim().length<3} onClick={()=>void confirm(payment)} data-testid={`button-confirm-reversal-${payment.id}`}><RotateCcw size={16}/>{pending?t('reversalPending'):t('reversalConfirm')}</button></div></div>:<button type="button" className="btn btn-outline payment-reverse-open" onClick={()=>{setEditingId(payment.id);setReason('');setError('');}} data-testid={`button-reverse-payment-${payment.id}`}><RotateCcw size={16}/>{t('reversePayment')}</button>)}
      </article>;
    })}</div>}
  </section>;
}
function ReviewList({title,empty,children}:{title:string;empty:string;children:ReactNode}) { return <section style={{display:'grid',gap:12}}><h2 style={{margin:0}}>{title}</h2>{empty?<div className="surface" style={{padding:22,textAlign:'center'}}><FileCheck2 size={26} color="hsl(var(--primary))"/><p className="subtle">{empty}</p></div>:children}</section>; }
function Dialog({title,children,close,closeLabel}:{title:string;children:ReactNode;close:()=>void;closeLabel:string}) { return <div className="dialog-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)close()}}><section className="dialog-panel" role="dialog" aria-modal="true" aria-label={title}><header style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}><h2 style={{margin:0,fontSize:23}}>{title}</h2><button onClick={close} className="btn btn-outline" style={{padding:8,minHeight:38}} aria-label={closeLabel} data-testid="button-close-dialog"><X size={17}/></button></header>{children}</section></div>; }
function Router() { return <AppInner/>; }
function App() { return <QueryClientProvider client={queryClient}><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/,'')}><Router/></WouterRouter></QueryClientProvider>; }
export default App;
