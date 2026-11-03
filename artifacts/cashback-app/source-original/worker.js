// مولّد تلقائياً من cashback.html (server/build_ledger.py). لا تعدّله يدوياً.
const MGR_PHONE = '0946563895';
function makeEngine(stateJson, idQueue) {
  const RQ = Array.isArray(idQueue) ? idQueue.slice() : [];
  const USED = new Set(); const RLOG = [];
  const RND = () => { let v = RQ.length ? RQ.shift() : Math.random(); if (!(typeof v === 'number' && v >= 0 && v < 1)) v = Math.random(); RLOG.push(v); return v; };
  const MGR_PHONE = '0946563895';
const r2 = x => Math.round(x * 100) / 100;
const uid = p => { let v; do { v = p + RND().toString(36).slice(2, 9); } while (USED.has(v)); USED.add(v); return v; };
const find = (arr, id, msg) => { const x = arr.find(a => a.id === id); if (!x) throw new Error(msg); return x; };
const log = (actor, action, detail) => S.audit.unshift({ t: Date.now(), actor, action, detail: String(detail ?? '') });
const cbExp = () => (S.settings.cbpayMin || 10) * 60000;
const cbOf = (c, mid) => (c.cbm && c.cbm[mid]) || 0;
const cbSum = c => r2(Object.values(c.cbm || {}).reduce((a, x) => a + x, 0));
const freeBal = c => Math.max(0, r2(c.wallet - cbSum(c)));
const cbAdd = (c, mid, v) => { c.cbm = c.cbm || {}; const n = r2((c.cbm[mid] || 0) + v); if (n > 0.004) c.cbm[mid] = n; else delete c.cbm[mid]; };
const cbLive = t => t.status === 'pending' && Date.now() - t.at <= cbExp();

const initial = () => ({
  settings: { commission: 6, cashback: 4, invoiceMinutes: 15, claimHours: 24, autoApprove: true, minTopup: 50, minPayout: 10, refBonus: 1, refMin: 20, cancelMin: 30, minSettle: 20, cbpayMin: 10 }, notes: [], payouts: [],
  platform: 0,
  merchants: [{ id: 'm1', name: 'مطعم الأصيل', cat: 'restaurants', status: 'active', barPrefix: '', barLen: 0, digital: 0, funded: 0, real: 0, bank: 0, bankName: '', bankAccount: '' }],
  customers: [{ id: 'c1', name: 'أحمد', wallet: 0 }],
  topups: [], invoices: [], txns: [], audit: [], banks: [], claims: [], cbpays: [], settles: []
});

const normPhone = p => {
  const raw = String(p || '').trim().replace(/[\u0660-\u0669]/g, x => (x.charCodeAt(0) - 1632));
  let d = raw.replace(/\D/g, ''); const plus = raw.startsWith('+') || d.startsWith('00');
  if (d.startsWith('00')) d = d.slice(2);
  if (/^218(9[1-4]\d{7})$/.test(d)) return '0' + d.slice(3);              // ليبي بصيغة دولية
  if (!plus && /^09[1-4]\d{7}$/.test(d)) return d;                        // ليبي محلي
  if (!plus && /^9[1-4]\d{7}$/.test(d)) return '0' + d;
  if (d.length < 8 || d.length > 15) return '';                             // أي رقم آخر (جزائري أو غيره)
  return plus ? '+' + d : d;
};
const notify = (to, text) => { (S.notes = S.notes || []).unshift({ id: uid('n'), to, text, t: Date.now(), read: false }); if (S.notes.length > 300) S.notes.length = 300; };
const hashStr = s => { let x = 5381; for (let i = 0; i < s.length; i += 7) x = ((x << 5) + x + s.charCodeAt(i)) | 0; return (x >>> 0) + ':' + s.length; };

const L = {
  addMerchant(name, cat, phone, id) {
    if (!name.trim()) throw new Error('اكتب اسم المحل');
    const ph = normPhone(phone);
    if (!ph) throw new Error('اكتب رقم هاتف صحيح (مثال 0921234567 أو +213555123456)');
    if (S.merchants.some(x => x.phone === ph)) throw new Error('رقم الهاتف مستخدم لمحل آخر');
    const m = { id: id || uid('m'), name: name.trim(), phone: ph, cat: cat || 'shops', status: 'pending', barPrefix: '', barLen: 0, digital: 0, funded: 0, real: 0, bank: 0, bankName: '', bankAccount: '' };
    S.merchants.push(m); log('system', 'تسجيل تاجر', m.name); notify('admin', 'تاجر جديد بانتظار التفعيل: ' + m.name); return m;
  },
  addCustomer(name, phone, id, refId) {
    if (!name.trim()) throw new Error('اكتب الاسم');
    const ph = normPhone(phone);
    if (!ph) throw new Error('اكتب رقم هاتف صحيح (مثال 0921234567 أو +213555123456)');
    if (S.customers.some(x => x.phone === ph)) throw new Error('رقم الهاتف مستخدم لحساب آخر');
    const c = { id: id || uid('c'), name: name.trim(), phone: ph, wallet: 0 };
    if (refId && refId !== c.id && S.customers.some(x => x.id === refId)) c.ref = refId;
    S.customers.push(c); log('system', 'تسجيل زبون', c.name); return c;
  },
  setMerchantLoc(mid, lat, lng) {
    const m = find(S.merchants, mid, 'تاجر غير موجود');
    if (lat === null) { delete m.lat; delete m.lng; log(mid, 'مسح موقع المحل', ''); return; }
    lat = Number(lat); lng = Number(lng);
    if (!isFinite(lat) || !isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) throw new Error('الموقع غير صحيح');
    m.lat = Math.round(lat * 1e4) / 1e4; m.lng = Math.round(lng * 1e4) / 1e4; log(mid, 'تحديد موقع المحل', '');
  },
  setMerchantCat(mid, cat) {
    const m = find(S.merchants, mid, 'تاجر غير موجود');
    if (cat) m.cat = cat;
    log(mid, 'تحديث نوع النشاط', m.cat);
  },
  requestTopup(mid, amount, ref, photo) {
    amount = Number(amount);
    if (!(amount > 0)) throw new Error('المبلغ غير صحيح');
    const minT = S.settings.minTopup || 0;
    if (amount < minT) throw new Error('أقل مبلغ للشحن ' + minT + ' د.ل');
    const m = find(S.merchants, mid, 'تاجر غير موجود');
    ref = String(ref || '').trim();
    if (!S.settings.topAcct) throw new Error('المدير لم يضف حساب الشحن بعد. حاول لاحقاً');
    if (!photo) throw new Error('صوّر إيصال التحويل البنكي أولاً');
    if (ref && ref.length < 4) throw new Error('رقم العملية قصير. اتركه فاضي أو اكتبه كامل');
    if (ref && S.topups.some(x => x.status !== 'rejected' && String(x.ref || '').toLowerCase() === ref.toLowerCase())) throw new Error('رقم العملية هذا مستخدم من قبل');
    const t = { id: uid('t'), mid, amount, ref, phone: m.phone || '', status: 'pending', at: Date.now() };
    if (photo) {
      const ph = hashStr(photo);
      if (S.topups.some(x => x.status !== 'rejected' && x.ph === ph)) throw new Error('هذي الصورة مستخدمة في طلب شحن سابق');
      t.photo = photo; t.ph = ph; t.bank = true;
    }
    S.topups.unshift(t); log(mid, 'طلب شحن', amount); notify('admin', `طلب شحن جديد: ${m.name} • ${amount} د.ل${ref ? ' (عملية ' + ref + ')' : ' (إيصال بنكي)'}`); return t;
  },
  approveTopup(id) {
    const t = find(S.topups, id, 'الطلب غير موجود');
    if (t.status !== 'pending') throw new Error('الطلب تمت معالجته');
    const m = find(S.merchants, t.mid, 'تاجر غير موجود');
    m.digital = r2(m.digital + t.amount); m.funded = r2((m.funded || 0) + t.amount);
    t.status = 'approved';
    log('admin', 'موافقة شحن', `${m.name} ${t.amount} (عملية ${t.ref || '-'})`);
    notify(m.id, `تمت الموافقة على شحنك ${t.amount} د.ل. رصيدك الآن ${m.digital} د.ل`);
  },
  rejectTopup(id) {
    const t = find(S.topups, id, 'الطلب غير موجود');
    if (t.status !== 'pending') throw new Error('الطلب تمت معالجته');
    t.status = 'rejected'; log('admin', 'رفض شحن', `${t.mid} ${t.amount}`); notify(t.mid, `تم رفض طلب الشحن ${t.amount} د.ل. تواصل مع المدير`);
  },
  requestPayout(cid, amount) {
    const c = find(S.customers, cid, 'زبون غير موجود');
    amount = Number(amount);
    if (!(amount > 0)) throw new Error('المبلغ غير صحيح');
    const mn = S.settings.minPayout || 0;
    if (amount < mn) throw new Error('أقل مبلغ للتحويل ' + mn + ' د.ل');
    if (amount > freeBal(c)) throw new Error('التحويل متاح من رصيد المكافآت فقط. كاش باك كل محل يُصرف في نفس المحل');
    if (S.payouts.some(x => x.cid === cid && x.status === 'pending')) throw new Error('عندك طلب تحويل قيد المراجعة، استنى لين يتم');
    c.wallet = r2(c.wallet - amount);
    const t = { id: uid('p'), cid, amount, phone: c.phone || '', status: 'pending', at: Date.now() };
    S.payouts.unshift(t); log(cid, 'طلب تحويل رصيد', amount); notify('admin', `طلب تحويل رصيد: ${c.name} • ${amount} د.ل إلى ${c.phone}`); return t;
  },
  approvePayout(id) {
    const t = find(S.payouts, id, 'الطلب غير موجود');
    if (t.status !== 'pending') throw new Error('الطلب تمت معالجته');
    t.status = 'done'; log('admin', 'تحويل رصيد لزبون', `${t.phone} ${t.amount}`); notify(t.cid, `تم تحويل ${t.amount} د.ل رصيد ليبيانا لرقمك ${t.phone}`);
  },
  rejectPayout(id) {
    const t = find(S.payouts, id, 'الطلب غير موجود');
    if (t.status !== 'pending') throw new Error('الطلب تمت معالجته');
    const c = find(S.customers, t.cid, 'زبون غير موجود');
    c.wallet = r2(c.wallet + t.amount); t.status = 'rejected'; log('admin', 'رفض تحويل رصيد', `${t.phone} ${t.amount}`); notify(t.cid, `تم رفض طلب التحويل ${t.amount} د.ل ورجع لمحفظتك`);
  },
  // ===== دفع بالكاش باك عند التاجر + سحب مع الشركة =====
  requestCbPay(cid, mid, amount) {
    const c = find(S.customers, cid, 'زبون غير موجود'), m = find(S.merchants, mid, 'اختر المحل');
    amount = r2(Number(amount));
    if (!(amount > 0)) throw new Error('المبلغ غير صحيح');
    if (m.status !== 'active') throw new Error('هذا المحل غير مفعّل');
    if (amount > r2(cbOf(c, mid) + freeBal(c))) throw new Error('رصيدك عند ' + m.name + ' هو ' + r2(cbOf(c, mid) + freeBal(c)) + ' د.ل فقط. كاش باك كل محل يُصرف في نفس المحل');
    if (S.cbpays.some(x => x.cid === cid && cbLive(x))) throw new Error('عندك طلب دفع بانتظار التاجر');
    // دفع فوري بدون موافقة التاجر: ينخصم من رصيد الزبون عند هذا المحل ويصير كاش باك مستلم للتاجر
    cbAdd(c, mid, -Math.min(cbOf(c, mid), amount));
    c.wallet = r2(c.wallet - amount); m.cbIn = r2((m.cbIn || 0) + amount);
    const now = Date.now(), t = { id: uid('b'), cid, mid, amount, status: 'done', at: now, done: now };
    S.cbpays.unshift(t); log(cid, 'دفع بكاش باك', `${m.name} ${amount}`);
    notify(mid, `استلمت دفعة كاش باك ${amount} د.ل من ${c.name}`);
    notify(cid, `تم الدفع ${amount} د.ل من كاش باك عند ${m.name}. رصيدك ${c.wallet} د.ل`); return t;
  },
  cancelCbPay(id, cid) {
    const t = find(S.cbpays, id, 'الطلب غير موجود');
    if (t.cid !== cid) throw new Error('غير مسموح');
    if (t.status !== 'pending') throw new Error('الطلب تمت معالجته');
    t.status = 'canceled'; log(cid, 'إلغاء طلب دفع بكاش باك', t.amount);
  },
  reviewCbPay(id, ok, mid) {
    const t = find(S.cbpays, id, 'الطلب غير موجود');
    if (t.mid !== mid) throw new Error('غير مسموح');
    if (t.status !== 'pending') throw new Error('الطلب تمت معالجته');
    const m = find(S.merchants, t.mid, 'تاجر غير موجود'), c = find(S.customers, t.cid, 'زبون غير موجود');
    if (!ok) { t.status = 'rejected'; log(m.id, 'رفض دفع بكاش باك', t.amount); notify(c.id, `${m.name} رفض طلب الدفع بكاش باك ${t.amount} د.ل`); return; }
    if (!cbLive(t)) throw new Error('انتهت مدة الطلب. اطلب من الزبون يرسل طلب جديد');
    if (r2(cbOf(c, m.id) + freeBal(c)) < t.amount) throw new Error('رصيد الزبون عند محلك غير كافٍ الآن');
    cbAdd(c, m.id, -Math.min(cbOf(c, m.id), t.amount));
    c.wallet = r2(c.wallet - t.amount); m.cbIn = r2((m.cbIn || 0) + t.amount);
    t.status = 'done'; t.done = Date.now();
    log(m.id, 'قبول دفع بكاش باك', `${c.name} ${t.amount}`);
    notify(c.id, `تم الدفع ${t.amount} د.ل من كاش باك عند ${m.name}. رصيدك ${c.wallet} د.ل`);
    return t;
  },
  setTopBank(o) {
    const bank = String(o.bank || '').trim(), holder = String(o.holder || '').trim(), acct = String(o.acct || '').trim();
    if (!bank && !holder && !acct) { S.settings.topBank = S.settings.topHolder = S.settings.topAcct = ''; log('admin', 'إلغاء حساب الشحن البنكي', ''); return; }
    if (!bank || !holder || acct.length < 6) throw new Error('اكتب اسم المصرف واسم صاحب الحساب ورقم الحساب');
    S.settings.topBank = bank; S.settings.topHolder = holder; S.settings.topAcct = acct;
    log('admin', 'تعديل حساب الشحن البنكي', bank + ' ****' + acct.slice(-4));
  },
  setMinSettle(v) {
    v = Number(v);
    if (!(v >= 0)) throw new Error('الحد الأدنى للسحب غير صحيح');
    S.settings.minSettle = v; log('admin', 'تعديل أقل مبلغ للسحب', v);
  },
  requestSettle(mid, o) {
    const m = find(S.merchants, mid, 'تاجر غير موجود');
    if (S.settles.some(x => x.mid === mid && x.status === 'pending')) throw new Error('عندك طلب سحب قيد المراجعة');
    const items = S.cbpays.filter(x => x.mid === mid && x.status === 'done' && !x.sid);
    const sum = r2(items.reduce((a, x) => a + x.amount, 0));
    const min = S.settings.minSettle || 0;
    if (!items.length || sum <= 0) throw new Error('ما عندك كاش باك مستلم للسحب');
    if (sum < min) throw new Error('أقل مبلغ للسحب ' + min + ' د.ل');
    const bank = String(o.bank || '').trim(), acct = String(o.acct || '').trim(), holder = String(o.holder || '').trim();
    if (!bank || acct.length < 6 || !holder) throw new Error('اكتب اسم المصرف ورقم الحساب واسم صاحب الحساب');
    const no = 'S' + String(S.settles.length + 1).padStart(4, '0');
    const t = { id: uid('s'), no, mid, amount: sum, items: items.map(x => x.id), bank, acct, holder, status: 'pending', at: Date.now() };
    items.forEach(x => { x.sid = t.id; });
    m.cbIn = Math.max(0, r2((m.cbIn || 0) - sum));
    m.payBank = bank; m.payAcct = acct; m.payName = holder;
    S.settles.unshift(t); log(mid, 'طلب سحب', `${no} ${sum}`);
    notify('admin', `طلب سحب ${no}: ${m.name} • ${sum} د.ل`); return t;
  },
  // تحويل الكاش باك المستلم إلى محفظة الشحن (رصيد تدفع منه العمولات) بدل سحبه للبنك
  cbToWallet(mid) {
    const m = find(S.merchants, mid, 'تاجر غير موجود');
    const items = S.cbpays.filter(x => x.mid === mid && x.status === 'done' && !x.sid);
    const sum = r2(items.reduce((a, x) => a + x.amount, 0));
    if (!items.length || sum <= 0) throw new Error('ما عندك كاش باك مستلم للتحويل');
    items.forEach(x => { x.sid = 'W' + Date.now(); });
    m.cbIn = Math.max(0, r2((m.cbIn || 0) - sum)); m.digital = r2(m.digital + sum);
    log(mid, 'تحويل كاش باك لمحفظة الشحن', sum); notify(mid, `تم تحويل ${sum} د.ل من الكاش باك المستلم إلى محفظتك. رصيدك الآن ${m.digital} د.ل`); return sum;
  },
  approveSettle(id, ref) {
    const t = find(S.settles, id, 'الطلب غير موجود');
    if (t.status !== 'pending') throw new Error('الطلب تمت معالجته');
    ref = String(ref || '').trim();
    if (ref.length < 4) throw new Error('اكتب رقم/مرجع التحويل البنكي');
    t.status = 'paid'; t.ref = ref; t.paidAt = Date.now();
    log('admin', 'سحب مدفوعة', `${t.no} ${t.amount} (مرجع ${ref})`);
    notify(t.mid, `تم تحويل ${t.amount} د.ل لحسابك البنكي (سحب ${t.no}، مرجع ${ref})`);
  },
  rejectSettle(id) {
    const t = find(S.settles, id, 'الطلب غير موجود');
    if (t.status !== 'pending') throw new Error('الطلب تمت معالجته');
    const m = find(S.merchants, t.mid, 'تاجر غير موجود');
    t.status = 'rejected'; m.cbIn = r2((m.cbIn || 0) + t.amount);
    t.items.forEach(i => { const x = S.cbpays.find(y => y.id === i); if (x) x.sid = null; });
    log('admin', 'رفض سحب', `${t.no} ${t.amount}`);
    notify(t.mid, `تم رفض طلب السحب ${t.no} ورجع المبلغ ${t.amount} د.ل لرصيد كاش باك المستلم`);
  },
  canDelete(role, eid) {
    if (role === 'customer') {
      const c = find(S.customers, eid, 'الحساب غير موجود');
      if (c.wallet >= 0.01) throw new Error('رصيدك ' + c.wallet + ' د.ل. اصرفه عند المحلات (المحفظة ← ادفع بالكاش باك) ثم احذف');
      if (S.payouts.some(x => x.cid === eid && x.status === 'pending')) throw new Error('عندك طلب تحويل قيد المراجعة، استنى لين يتم');
      if (S.cbpays.some(x => x.cid === eid && cbLive(x))) throw new Error('عندك طلب دفع بكاش باك بانتظار التاجر');
      if (S.claims.some(x => x.cid === eid && x.status === 'pending')) throw new Error('عندك فاتورة قيد المراجعة، استنى لين تنتهي');
    } else {
      const m = find(S.merchants, eid, 'الحساب غير موجود');
      if (m.digital >= 0.01) throw new Error('رصيد محفظتك ' + m.digital + ' د.ل. تواصل مع المدير لسحب الرصيد قبل الحذف');
      if ((m.cbIn || 0) >= 0.01 || S.settles.some(x => x.mid === eid && x.status === 'pending')) throw new Error('عندك كاش باك مستلم أو سحب قيد المراجعة. اطلب السحب واستلمها قبل الحذف');
      if (S.topups.some(x => x.mid === eid && x.status === 'pending')) throw new Error('عندك طلب شحن قيد المراجعة');
      if (S.claims.some(x => x.mid === eid && x.status === 'pending')) throw new Error('فيه فواتير زبائن قيد المراجعة على محلك');
    }
  },
  deleteAccount(role, eid) {
    L.canDelete(role, eid);
    if (role === 'customer') {
      S.customers = S.customers.filter(x => x.id !== eid);
      S.claims = S.claims.filter(x => x.cid !== eid);
      S.payouts = S.payouts.filter(x => x.cid !== eid);
    } else {
      S.merchants = S.merchants.filter(x => x.id !== eid);
      S.topups = S.topups.filter(x => x.mid !== eid);
    }
    S.notes = (S.notes || []).filter(n => n.to !== eid);
    log('system', 'حذف حساب', role === 'customer' ? 'زبون' : 'تاجر');
  },
  createInvoice(mid, amount) {
    amount = Number(amount);
    if (!(amount > 0)) throw new Error('المبلغ غير صحيح');
    find(S.merchants, mid, 'تاجر غير موجود');
    let code; do { code = String(Math.floor(100000 + RND() * 900000)); } while (S.invoices.some(i => i.code === code));
    const inv = { id: uid('inv'), code, mid, amount, exp: Date.now() + S.settings.invoiceMinutes * 60000, used: false };
    S.invoices.unshift(inv); log(mid, 'إنشاء فاتورة', `${code} / ${amount}`); return inv;
  },
  // طلب كاش باك بفاتورة مصورة. منع التكرار: نفس المحل + نفس رقم الفاتورة، أو نفس المحل + نفس الباركود.
  submitClaim(cid, o) {
    const c = find(S.customers, cid, 'زبون غير موجود');
    const m = find(S.merchants, o.mid, 'اختر محل من القائمة. الكاش باك فقط من المحلات المسجلة في التطبيق.');
    if (m.status !== 'active') throw new Error('هذا المحل مش مفعّل في التطبيق. الكاش باك فقط من المحلات المسجلة والمفعّلة.');
    const norm = s => String(s || '').trim().toLowerCase().replace(/\s+/g, '');
    const no = String(o.no || '').trim(), bar = String(o.barcode || '').trim(), amount = Number(o.amount);
    if (!no) throw new Error('اكتب رقم الفاتورة');
    if (!o.date || !o.time) throw new Error('اكتب تاريخ الفاتورة وساعتها');
    if (!bar) throw new Error('اكتب رقم الباركود المطبوع تحت الخطوط');
    if (!(amount > 0)) throw new Error('المبلغ غير صحيح');
    if (!o.photo) throw new Error('صوّر الفاتورة أولاً');
    const bp = (m.barPrefix || '').toLowerCase(), bl = Number(m.barLen) || 0;
    if ((bp && !bar.toLowerCase().startsWith(bp)) || (bl && bar.length !== bl)) throw new Error('الباركود ما يطابق فواتير هذا المحل. تأكد إنك اخترت المحل الصحيح.');
    const at = new Date(o.date + 'T' + o.time).getTime();
    if (isNaN(at)) throw new Error('التاريخ أو الساعة غير صحيحة');
    if (at > Date.now() + 5 * 60000) throw new Error('تاريخ الفاتورة في المستقبل');
    const hours = S.settings.claimHours || 24;
    if (Date.now() - at > hours * 3600000) throw new Error(`انتهت مدة المطالبة (${hours} ساعة من وقت الفاتورة)`);
    if (S.claims.some(x => x.mid === m.id && x.status !== 'rejected' && (norm(x.no) === norm(no) || norm(x.barcode) === norm(bar)))) throw new Error('هذي الفاتورة مسجلة من قبل');
    const ph = hashStr(o.photo);
    if (S.claims.some(x => x.status !== 'rejected' && x.ph === ph)) throw new Error('هذي الصورة مستخدمة في فاتورة سابقة');
    const maxDaily = S.settings.maxDaily || 5, maxInv = S.settings.maxInvoice || 2000;
    if (S.claims.filter(x => x.cid === c.id && x.status !== 'rejected' && x.created > Date.now() - 86400000).length >= maxDaily) throw new Error(`وصلت للحد اليومي (${maxDaily} فواتير في 24 ساعة)`);
    const cl = { id: uid('cl'), mid: m.id, cid: c.id, no, barcode: bar, date: o.date, time: o.time, at, amount, photo: o.photo, ph, status: 'pending', created: Date.now() };
    let review = '';
    if (!(bp || bl)) review = 'لم تُضبط شروط الباركود لهذا المحل';
    else if (amount > maxInv) review = `المبلغ أكبر من ${maxInv} د.ل`;
    else if (S.settings.autoApprove === false) review = 'اعتماد المدير مفعّل';
    if (review) { cl.review = review; notify('admin', `فاتورة بانتظار المراجعة: ${c.name} • ${m.name} • ${amount} د.ل`); notify(c.id, `فاتورتك من ${m.name} قيد المراجعة`); } else L.settleClaim(cl);
    S.claims.unshift(cl); log(c.id, 'طلب كاش باك بفاتورة', `${m.name} #${no} / ${amount}`); return cl;
  },
  // إلغاء عملية خاطئة: يسمح للتاجر خلال مدة قصيرة، ويرجع كل شيء كما كان
  cancelTx(mid, id) {
    const i = S.txns.findIndex(x => x.id === id && x.mid === mid); if (i < 0) throw new Error('العملية غير موجودة');
    const tx = S.txns[i], lim = S.settings.cancelMin || 0;
    if (Date.now() - tx.t > lim * 60000) throw new Error('انتهت مدة الإلغاء (' + lim + ' دقيقة). تواصل مع المدير');
    const m = find(S.merchants, mid, 'تاجر غير موجود'), c = S.customers.find(x => x.id === tx.cid);
    if (!c) throw new Error('حساب الزبون محذوف. تواصل مع المدير');
    const b = tx.refb || 0, inv = b ? S.customers.find(x => x.id === c.ref) : null;
    if (tx.method === 'wallet') {
      if (m.digital < tx.amount) throw new Error('رصيد محفظتك أقل من مبلغ العملية');
      m.digital = r2(m.digital - tx.amount); c.wallet = r2(c.wallet + tx.amount);
    } else {
      const mg = r2(tx.fee - tx.cashback);
      if (cbOf(c, mid) < tx.cashback || freeBal(c) < b) throw new Error('الزبون صرف جزء من الكاش باك. تواصل مع المدير');
      if (inv && freeBal(inv) < b) throw new Error('مكافأة الدعوة انصرفت. تواصل مع المدير');
      if (S.platform < mg + b * 2) throw new Error('تعذر الإلغاء الآن. تواصل مع المدير');
      m.digital = r2(m.digital + tx.fee); S.platform = r2(S.platform - mg); c.wallet = r2(c.wallet - tx.cashback); cbAdd(c, mid, -tx.cashback);
      if (b) { c.wallet = r2(c.wallet - b); if (inv) { inv.wallet = r2(inv.wallet - b); inv.refEarn = r2(Math.max(0, (inv.refEarn || 0) - b)); } S.platform = r2(S.platform + b * 2); c.refPaid = false; }
    }
    if (tx.cl) { const cl = S.claims.find(x => x.id === tx.cl); if (cl) { cl.status = 'cancelled'; cl.cashback = 0; } }
    S.txns.splice(i, 1);
    notify(c.id, `تم إلغاء عملية ${tx.amount} د.ل من ${m.name} وتم عكس الكاش باك`); notify('admin', `إلغاء عملية: ${m.name} • ${tx.amount} د.ل`);
    log(mid, 'إلغاء عملية', `${c.name} ${tx.amount}`);
  },
  // مكافأة الدعوة: أول عملية للمدعو (بحد أدنى) تعطي كل من الداعي والمدعو مكافأة من محفظة المدير
  refReward(c, amount) {
    const b = S.settings.refBonus || 0;
    if (!b || !c.ref || c.refPaid || amount < (S.settings.refMin || 0)) return 0;
    const inv = S.customers.find(x => x.id === c.ref);
    if (!inv || S.platform < b * 2) return 0;
    c.refPaid = true; S.platform = r2(S.platform - b * 2);
    inv.wallet = r2(inv.wallet + b); c.wallet = r2(c.wallet + b); inv.refEarn = r2((inv.refEarn || 0) + b);
    notify(inv.id, `صاحبك ${c.name} اشترى أول مرة. نزلت لك مكافأة دعوة ${b} د.ل`); notify(c.id, `مكافأة دعوة ${b} د.ل نزلت في رصيدك`);
    log('system', 'مكافأة دعوة', `${inv.name} ← ${c.name} ${b}`); return b;
  },
  // اعتماد الفاتورة: ينقص رقمي المحل بقيمة الفاتورة، والكاش باك من محفظة CASH BACK إلى محفظة الزبون
  settleClaim(cl) {
    const m = find(S.merchants, cl.mid, 'تاجر غير موجود'), c = find(S.customers, cl.cid, 'زبون غير موجود');
    const fee = r2(cl.amount * S.settings.commission / 100), cb = r2(cl.amount * S.settings.cashback / 100), mg = r2(fee - cb);
    if (m.digital < fee) throw new Error('رصيد المحل غير كافٍ لدفع العمولة، لازم يشحن محفظته');
    const was = m.digital;
    m.digital = r2(m.digital - fee); S.platform = r2(S.platform + mg); c.wallet = r2(c.wallet + cb); cbAdd(c, m.id, cb);
    cl.status = 'approved'; cl.cashback = cb;
    notify(c.id, `نزل في رصيدك كاش باك ${cb} د.ل من ${m.name}`); notify(m.id, `عملية جديدة ${cl.amount} د.ل (عمولة ${fee} د.ل)`);
    if (was > 20 && m.digital <= 20) notify(m.id, 'رصيدك قارب على الانتهاء، اشحن محفظتك');
    const tx = { id: uid('x'), t: Date.now(), mid: m.id, cid: c.id, amount: cl.amount, cashback: cb, fee, method: 'claim' };
    tx.cl = cl.id; S.txns.unshift(tx); tx.refb = L.refReward(c, cl.amount); log('system', 'كاش باك بفاتورة', `${m.name} #${cl.no} / ${cl.amount} كاش باك ${cb}`); return tx;
  },
  reviewClaim(id, ok) {
    const cl = find(S.claims, id, 'الطلب غير موجود');
    if (cl.status !== 'pending') throw new Error('الطلب تمت معالجته');
    if (ok) { const tx = L.settleClaim(cl); log('admin', 'اعتماد فاتورة', `${cl.no} / ${cl.amount}`); return tx; }
    cl.status = 'rejected'; log('admin', 'رفض فاتورة', `${cl.no} / ${cl.amount}`); notify(cl.cid, `تم رفض فاتورتك رقم ${cl.no}`); return true;
  },
  setAutoApprove(on) { S.settings.autoApprove = !!on; log('admin', 'اعتماد الفواتير', on ? 'تلقائي' : 'مراجعة المدير'); },
  setBarcodeFormat(mid, prefix, len) {
    const m = find(S.merchants, mid, 'تاجر غير موجود');
    prefix = String(prefix || '').trim(); len = String(len || '').trim();
    if (prefix && !/^[A-Za-z0-9-]{1,12}$/.test(prefix)) throw new Error('البادئة حروف وأرقام فقط (حتى 12)');
    if (len && !/^\d{1,20}$/.test(len)) throw new Error('الطول لازم يكون رقم');
    m.barPrefix = prefix; m.barLen = len ? Number(len) : 0;
    log('admin', 'شروط باركود المحل', `${m.name}: ${prefix || '-'} / ${m.barLen || '-'}`);
  },
  setMerchantStatus(mid) {
    const m = find(S.merchants, mid, 'تاجر غير موجود');
    m.status = m.status === 'active' ? 'suspended' : 'active';
    notify(m.id, m.status === 'active' ? 'تم تفعيل حسابك، تقدر تستقبل الزبائن' : 'تم إيقاف حسابك، تواصل مع المدير');
    log('admin', m.status === 'active' ? 'تفعيل محل' : 'إيقاف محل', m.name);
  },
  setLimits(maxInvoice, maxDaily) {
    maxInvoice = Number(maxInvoice); maxDaily = Number(maxDaily);
    if (!(maxInvoice > 0) || !(maxDaily >= 1)) throw new Error('الحدود غير صحيحة');
    S.settings.maxInvoice = maxInvoice; S.settings.maxDaily = Math.floor(maxDaily);
    log('admin', 'تعديل الحدود', `${maxInvoice} د.ل / ${S.settings.maxDaily} فواتير`);
  },
  setClaimHours(hh) {
    hh = Number(hh);
    if (!(hh > 0 && hh <= 720)) throw new Error('مدة المطالبة لازم تكون بين 1 و720 ساعة');
    S.settings.claimHours = hh; log('admin', 'تعديل مدة المطالبة', hh + ' ساعة');
  },
  checkInvoice(code) {
    const inv = S.invoices.find(i => i.code === code);
    if (!inv) throw new Error('كود الفاتورة غير صحيح');
    if (inv.used) throw new Error('الفاتورة مدفوعة من قبل');
    if (Date.now() > inv.exp) throw new Error('انتهت صلاحية الفاتورة');
    return inv;
  },
  // method: 'card' (كاش باك للزبون) أو 'wallet' (دفع من رصيد محفظة الزبون، بدون كاش باك)
  payInvoice(code, cid, method = 'card') {
    const inv = L.checkInvoice(code);
    const m = find(S.merchants, inv.mid, 'تاجر غير موجود');
    const c = find(S.customers, cid, 'زبون غير موجود');
    let cb = 0, fee = 0;
    if (method === 'wallet') {
      throw new Error('غير متاح');
      if (c.wallet < inv.amount) throw new Error('رصيد محفظتك غير كافٍ لهذه الفاتورة');
      c.wallet = r2(c.wallet - inv.amount); m.digital = r2(m.digital + inv.amount);
      notify(m.id, `استلمت ${inv.amount} د.ل من محفظة زبون`);
    } else {
      fee = r2(inv.amount * S.settings.commission / 100); cb = r2(inv.amount * S.settings.cashback / 100);
      if (m.digital < fee) throw new Error('رصيد التاجر غير كافٍ لدفع العمولة، لازم يشحن محفظته');
      const was = m.digital;
      m.digital = r2(m.digital - fee); S.platform = r2(S.platform + r2(fee - cb)); c.wallet = r2(c.wallet + cb); cbAdd(c, m.id, cb);
      notify(c.id, `نزل في رصيدك كاش باك ${cb} د.ل من ${m.name}`); notify(m.id, `عملية جديدة ${inv.amount} د.ل (عمولة ${fee} د.ل)`);
      if (was > 20 && m.digital <= 20) notify(m.id, 'رصيدك قارب على الانتهاء، اشحن محفظتك');
    }
    inv.used = true;
    const tx = { id: uid('x'), t: Date.now(), mid: m.id, cid, amount: inv.amount, cashback: cb, fee, method };
    S.txns.unshift(tx); if (method !== 'wallet') tx.refb = L.refReward(c, inv.amount); log(cid, 'دفع فاتورة', `${m.name} ${inv.amount} (${method === 'wallet' ? 'محفظة' : 'بطاقة'}) كاش باك ${cb}`); return tx;
  },
  addBank(o) {
    if (!o.name.trim() || !o.number.trim()) throw new Error('اسم البنك ورقم الحساب مطلوبين');
    const b = { id: uid('b'), name: o.name.trim(), holder: o.holder.trim(), number: o.number.trim(), kind: o.kind, hasKey: !!o.hasKey, status: 'غير مربوط' };
    S.banks.push(b); log('admin', 'إضافة حساب بنكي', `${b.name} ****${b.number.slice(-4)}`); return b;
  },
  linkBank(id) {
    const b = find(S.banks, id, 'الحساب غير موجود');
    if (!b.hasKey) throw new Error('أدخل مفتاح الربط (API Key) أولاً');
    b.status = 'مربوط (تجريبي)'; log('admin', 'ربط حساب بنكي', b.name);
  },
  removeBank(id) {
    const b = find(S.banks, id, 'الحساب غير موجود');
    S.banks = S.banks.filter(x => x.id !== id); log('admin', 'حذف حساب بنكي', b.name);
  },
  setMinTopup(v) {
    v = Number(v);
    if (!(v >= 0)) throw new Error('الحد الأدنى للشحن غير صحيح');
    S.settings.minTopup = v; log('admin', 'الحد الأدنى للشحن', v + ' د.ل');
  },
  readNotes(id) { (S.notes || []).forEach(n => { if (n.to === id) n.read = true; }); },
  setRates(c, k) {
    c = Number(c); k = Number(k);
    if (!(c >= 0) || !(k >= 0) || k > c) throw new Error('النسب غير صحيحة (الكاش باك لازم ما يزيد عن العمولة)');
    S.settings.commission = c; S.settings.cashback = k; log('admin', 'تعديل النسب', `${c}% / ${k}%`);
  }
};

/* ---------- مكان بوابة الدفع (فاضي حالياً) ----------
   لما تتوفر وثائق البوابة نملأ charge و refund هنا فقط.
   الربط الحقيقي لازم يتم من خادم، مش من المتصفح، لأن المفاتيح السرية ما تنحط في صفحة ويب. */
const paymentProvider = {
  name: 'غير مربوط',
  async charge({ amount, invoiceCode, customerId }) {
    return { ok: true, reference: 'MOCK-' + Date.now(), mock: true };
  },
  async refund({ reference, amount }) {
    return { ok: false, error: 'الاسترجاع غير مفعّل بعد' };
  }
};

/* ---------- التخزين على هذا الجهاز ---------- */
const KEY = 'cashback_web_v1';
let S = initial();
const norm = () => {
  if (!S.claims) S.claims = [];
  if (!S.notes) S.notes = [];
  if (!S.payouts) S.payouts = [];
  if (!S.cbpays) S.cbpays = [];
  if (!S.settles) S.settles = [];
  if (S.settings.minSettle === undefined) S.settings.minSettle = 20;
  if (S.settings.cbpayMin === undefined) S.settings.cbpayMin = 10;
  if (S.settings.minPayout === undefined) S.settings.minPayout = 10;
  if (S.settings.minTopup === undefined) S.settings.minTopup = 50;
  if (S.settings.refBonus === undefined) S.settings.refBonus = 1;
  if (S.settings.refMin === undefined) S.settings.refMin = 20;
  if (S.settings.cancelMin === undefined) S.settings.cancelMin = 30;
  S.merchants.forEach(m => { if (!m.cat) m.cat = m.id === 'm1' ? 'restaurants' : 'shops'; if (!m.status) m.status = 'active'; if (m.barLen === undefined) { m.barLen = 0; m.barPrefix = ''; } if (typeof m.cbIn !== 'number') m.cbIn = 0; });
  S.customers.forEach(c => { if (c.cbm) return; c.cbm = {}; const earn = {}; (S.txns || []).forEach(t => { if (t.cid === c.id && t.cashback > 0) earn[t.mid] = (earn[t.mid] || 0) + t.cashback; }); (S.cbpays || []).forEach(x => { if (x.cid === c.id && x.status === 'done') earn[x.mid] = (earn[x.mid] || 0) - x.amount; }); let left = c.wallet; Object.keys(earn).forEach(mid => { const v = Math.min(r2(earn[mid]), left); if (v > 0.004) { c.cbm[mid] = r2(v); left = r2(left - v); } }); });
};
norm();
  const load = json => { S = JSON.parse(json); norm(); (JSON.stringify(S).match(/"id":"([^"]+)"/g) || []).forEach(x => USED.add(x.slice(6, -1))); };
  const dump = () => JSON.stringify(S, (k, v) => k === 'photo' ? undefined : v);
  if (stateJson) load(stateJson); else { S = initial(); norm(); }
  const takeRand = () => RLOG.splice(0, RLOG.length);
  const setRand = arr => { RQ.length = 0; (arr || []).forEach(x => RQ.push(x)); };
  return { L, load, dump, setRand, takeRand, getS: () => S, initial };
}

// CASH BACK API — Cloudflare Worker
// يتحقق من هوية المستخدم (Firebase ID token) وينفذ عمليات الحسابات على السيرفر بدل المتصفح.

const PROJECT = 'studio-5817063024-c14a2';
const ADMIN_EMAIL = 'imadbenhamouda509@gmail.com';
const ORIGINS = ['https://imadbehamoda-glitch.github.io'];
const MAX_JSON = 950000;

/* ---------- صلاحيات العمليات ---------- */
const ADMIN_ONLY = new Set(['approveTopup', 'rejectTopup', 'approvePayout', 'rejectPayout', 'setTopBank', 'setMinSettle', 'approveSettle', 'rejectSettle', 'reviewClaim', 'setAutoApprove', 'setMerchantStatus', 'setLimits', 'setClaimHours', 'addBank', 'linkBank', 'removeBank', 'setMinTopup', 'setRates', '__replace']);
// عملية المستخدم: رقم الوسيط الذي لازم يساوي هوية صاحب الحساب
const MERCHANT_ARG = { requestTopup: 0, requestSettle: 0, setBarcodeFormat: 0, setMerchantLoc: 0, setMerchantCat: 0, createInvoice: 0, cancelTx: 0, cbToWallet: 0, reviewCbPay: 2 };
const CUSTOMER_ARG = { requestPayout: 0, requestCbPay: 0, submitClaim: 0, cancelCbPay: 1, payInvoice: 1 };

class HttpError extends Error { constructor(status, msg) { super(msg); this.status = status; } }

function authorize(profile, m, a) {
  if (typeof m !== 'string' || !Array.isArray(a)) throw new HttpError(400, 'طلب غير صالح');
  const admin = profile.role === 'admin';
  if (admin) { if (m === '__replace' || ADMIN_ONLY.has(m) || m in MERCHANT_ARG || m in CUSTOMER_ARG || m === 'readNotes' || m === 'deleteAccount') return; throw new HttpError(403, 'عملية غير مسموحة'); }
  if (m === 'readNotes') { if (a[0] === profile.eid) return; throw new HttpError(403, 'غير مسموح'); }
  if (m === 'deleteAccount') { if (a[0] === profile.role && a[1] === profile.eid) return; throw new HttpError(403, 'غير مسموح'); }
  if (profile.role === 'merchant' && m in MERCHANT_ARG) { if (a[MERCHANT_ARG[m]] === profile.eid) return; throw new HttpError(403, 'غير مسموح'); }
  if (profile.role === 'customer' && m in CUSTOMER_ARG) { if (a[CUSTOMER_ARG[m]] === profile.eid) return; throw new HttpError(403, 'غير مسموح'); }
  throw new HttpError(403, 'عملية غير مسموحة لحسابك');
}

/* ---------- تنفيذ العمليات (دالة نقية قابلة للاختبار) ---------- */
function applyCalls(stateJson, profile, calls) {
  if (!Array.isArray(calls) || !calls.length || calls.length > 20) throw new HttpError(400, 'طلب غير صالح');
  const eng = makeEngine(stateJson, []);
  for (const c of calls) {
    if (!c || typeof c.m !== 'string' || !Array.isArray(c.a) || c.a.length > 8) throw new HttpError(400, 'طلب غير صالح');
    authorize(profile, c.m, c.a);
    if (c.m === '__replace') {
      const j = c.a[0];
      if (typeof j !== 'string' || j.length > MAX_JSON) throw new HttpError(400, 'ملف غير صالح');
      let o; try { o = JSON.parse(j); } catch (e) { throw new HttpError(400, 'ملف غير صالح'); }
      if (!o || !Array.isArray(o.merchants) || !Array.isArray(o.customers) || !o.settings) throw new HttpError(400, 'ملف غير صالح');
      eng.load(j); continue;
    }
    if (typeof eng.L[c.m] !== 'function') throw new HttpError(400, 'عملية غير معروفة');
    eng.setRand(Array.isArray(c.r) ? c.r.slice(0, 60) : []);
    try { eng.L[c.m](...c.a); }
    catch (e) { throw new HttpError(400, (e && e.message) || 'فشلت العملية'); }
  }
  const json = eng.dump();
  if (json.length > MAX_JSON) throw new HttpError(413, 'حجم البيانات تجاوز الحد');
  return json;
}

function applyRegister(stateJson, body) {
  const role = body && body.role, name = String((body && body.name) || '').trim();
  if (role !== 'customer' && role !== 'merchant') throw new HttpError(400, 'نوع الحساب غير صالح');
  if (!name || name.length > 100) throw new HttpError(400, 'الاسم غير صالح');
  const cat = String((body && body.cat) || 'shops').slice(0, 30);
  const ref = /^[\w-]{3,40}$/.test(String((body && body.ref) || '')) ? body.ref : '';
  const eng = makeEngine(stateJson, []);
  let ent;
  try { ent = role === 'customer' ? eng.L.addCustomer(name, body.phone, undefined, ref) : eng.L.addMerchant(name, cat, body.phone); }
  catch (e) { throw new HttpError(400, (e && e.message) || 'فشل التسجيل'); }
  return { json: eng.dump(), eid: ent.id, role, name };
}

/* ---------- Base64 / JWT ---------- */
const b64uToBytes = s => { s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; const bin = atob(s); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; };
const bytesToB64u = b => { let s = ''; new Uint8Array(b).forEach(x => s += String.fromCharCode(x)); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
const strToB64u = s => bytesToB64u(new TextEncoder().encode(s));
const jsonPart = s => JSON.parse(new TextDecoder().decode(b64uToBytes(s)));

let jwksCache = { t: 0, keys: null };
async function getJwks(fetchFn) {
  if (jwksCache.keys && Date.now() - jwksCache.t < 3600e3) return jwksCache.keys;
  const r = await fetchFn('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com');
  if (!r.ok) throw new HttpError(503, 'تعذر التحقق من الهوية');
  const j = await r.json(); jwksCache = { t: Date.now(), keys: j.keys }; return j.keys;
}
async function verifyIdToken(token, fetchFn = fetch, project = PROJECT) {
  const parts = String(token || '').split('.');
  if (parts.length !== 3) throw new HttpError(401, 'غير مسجّل');
  let h, c;
  try { h = jsonPart(parts[0]); c = jsonPart(parts[1]); } catch (e) { throw new HttpError(401, 'غير مسجّل'); }
  if (h.alg !== 'RS256' || !h.kid) throw new HttpError(401, 'غير مسجّل');
  const keys = await getJwks(fetchFn);
  const jwk = keys.find(k => k.kid === h.kid);
  if (!jwk) throw new HttpError(401, 'غير مسجّل');
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64uToBytes(parts[2]), new TextEncoder().encode(parts[0] + '.' + parts[1]));
  if (!ok) throw new HttpError(401, 'غير مسجّل');
  const now = Math.floor(Date.now() / 1000);
  if (c.aud !== project || c.iss !== 'https://securetoken.google.com/' + project || !c.sub || typeof c.sub !== 'string' || c.exp <= now || c.iat > now + 300) throw new HttpError(401, 'انتهت الجلسة، سجّل الدخول من جديد');
  return { uid: c.sub, email: String(c.email || '').toLowerCase() };
}

/* ---------- Firestore (REST) بمفتاح الخدمة ---------- */
let tokCache = { t: 0, v: null };
async function accessToken(env, fetchFn) {
  if (tokCache.v && Date.now() < tokCache.t) return tokCache.v;
  let sa; try { sa = JSON.parse(env.SA_KEY); } catch (e) { throw new HttpError(500, 'إعداد السيرفر ناقص'); }
  const pem = sa.private_key.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  const key = await crypto.subtle.importKey('pkcs8', b64uToBytes(pem.replace(/\+/g, '-').replace(/\//g, '_')), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const iat = Math.floor(Date.now() / 1000);
  const head = strToB64u(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim = strToB64u(JSON.stringify({ iss: sa.client_email, scope: 'https://www.googleapis.com/auth/datastore', aud: 'https://oauth2.googleapis.com/token', iat, exp: iat + 3600 }));
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(head + '.' + claim));
  const r = await fetchFn('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: 'grant_type=' + encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer') + '&assertion=' + head + '.' + claim + '.' + bytesToB64u(sig) });
  if (!r.ok) throw new HttpError(500, 'فشل اتصال السيرفر بقاعدة البيانات');
  const j = await r.json(); tokCache = { v: j.access_token, t: Date.now() + (j.expires_in - 120) * 1000 };
  return tokCache.v;
}
const DB = 'projects/' + PROJECT + '/databases/(default)/documents';
const REST = 'https://firestore.googleapis.com/v1/' + DB;
async function fsGet(env, fetchFn, path) {
  const r = await fetchFn(REST + '/' + path, { headers: { authorization: 'Bearer ' + await accessToken(env, fetchFn) } });
  if (r.status === 404) return null;
  if (!r.ok) throw new HttpError(500, 'خطأ قراءة قاعدة البيانات');
  return r.json();
}
async function fsCommit(env, fetchFn, writes) {
  const r = await fetchFn(REST + ':commit', { method: 'POST', headers: { authorization: 'Bearer ' + await accessToken(env, fetchFn), 'content-type': 'application/json' }, body: JSON.stringify({ writes }) });
  if (r.status === 409 || r.status === 400 && (await r.clone().text()).includes('FAILED_PRECONDITION')) return false;
  if (!r.ok) throw new HttpError(500, 'خطأ كتابة قاعدة البيانات');
  return true;
}
const stateWrite = (json, rev, updateTime) => ({
  update: { name: DB + '/cashback/state', fields: { json: { stringValue: json }, rev: { integerValue: String(rev) }, t: { integerValue: String(Date.now()) } } },
  currentDocument: updateTime ? { updateTime } : { exists: false }
});

async function loadProfile(env, fetchFn, user) {
  if (user.email === ADMIN_EMAIL) return { role: 'admin' };
  const d = await fsGet(env, fetchFn, 'users/' + user.uid);
  if (!d || !d.fields) throw new HttpError(403, 'حسابك غير مكتمل');
  const f = d.fields, role = f.role && f.role.stringValue, eid = f.eid && f.eid.stringValue;
  if ((role !== 'customer' && role !== 'merchant') || !eid) throw new HttpError(403, 'حسابك غير مكتمل');
  return { role, eid };
}

/* ---------- المسارات ---------- */
async function handle(request, env, fetchFn = fetch) {
  const url = new URL(request.url), origin = request.headers.get('origin') || '';
  const okOrigin = ORIGINS.includes(origin) || /^http:\/\/localhost(:\d+)?$/.test(origin);
  const cors = { 'access-control-allow-origin': okOrigin ? origin : ORIGINS[0], 'access-control-allow-headers': 'authorization, content-type', 'access-control-allow-methods': 'POST, GET, OPTIONS', 'vary': 'origin' };
  const send = (status, obj) => new Response(JSON.stringify(obj), { status, headers: { ...cors, 'content-type': 'application/json; charset=utf-8' } });
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (request.method === 'GET') return send(200, { ok: true, name: 'cashback-api' });
  if (request.method !== 'POST' || (url.pathname !== '/act' && url.pathname !== '/register')) return send(404, { error: 'غير موجود' });
  try {
    if (!okOrigin) throw new HttpError(403, 'مصدر غير مسموح');
    const len = Number(request.headers.get('content-length') || 0);
    if (len > 3e6) throw new HttpError(413, 'الطلب كبير');
    const auth = request.headers.get('authorization') || '';
    const user = await verifyIdToken(auth.replace(/^Bearer\s+/i, ''), fetchFn);
    const body = await request.json();
    for (let attempt = 0; attempt < 5; attempt++) {
      const sd = await fsGet(env, fetchFn, 'cashback/state');
      const cur = sd && sd.fields ? { json: sd.fields.json.stringValue, rev: Number(sd.fields.rev.integerValue), ut: sd.updateTime } : { json: null, rev: 0, ut: null };
      if (url.pathname === '/register') {
        if (user.email === ADMIN_EMAIL) throw new HttpError(403, 'غير مسموح');
        const ex = await fsGet(env, fetchFn, 'users/' + user.uid);
        if (ex) throw new HttpError(409, 'الحساب مسجّل من قبل');
        const r = applyRegister(cur.json, body);
        const writes = [stateWrite(r.json, cur.rev + 1, cur.ut), { update: { name: DB + '/users/' + user.uid, fields: { role: { stringValue: r.role }, eid: { stringValue: r.eid }, name: { stringValue: r.name } } }, currentDocument: { exists: false } }];
        if (await fsCommit(env, fetchFn, writes)) return send(200, { ok: true, rev: cur.rev + 1, eid: r.eid });
        continue;
      }
      const profile = await loadProfile(env, fetchFn, user);
      const json = applyCalls(cur.json, profile, body.calls);
      if (await fsCommit(env, fetchFn, [stateWrite(json, cur.rev + 1, cur.ut)])) return send(200, { ok: true, rev: cur.rev + 1 });
    }
    throw new HttpError(409, 'ازدحام، أعد المحاولة');
  } catch (e) {
    if (e instanceof HttpError) return send(e.status, { error: e.message });
    return send(500, { error: 'خطأ في السيرفر' });
  }
}
export default { fetch: (req, env) => handle(req, env) };
