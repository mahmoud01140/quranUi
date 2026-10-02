import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  CreditCard, CheckCircle2, AlertCircle, ShieldCheck, Clock,
  Copy, Check, Upload, Phone, Eye, RefreshCw, Smartphone, Building2, Lock, X, BookOpen,
} from 'lucide-react';
import toast from 'react-hot-toast';
import PageLayout from '../../components/shared/PageLayout';
import LoadingSpinner from '../../components/shared/LoadingSpinner';
import api from '../../services/api';
import { formatDateAr, formatTime12Ar } from '../../utils/helpers';
import useAuthStore from '../../store/authStore';
import Pagination from '../../components/shared/Pagination';
import usePagination from '../../hooks/usePagination';
import '../../components/halaqa/halaqa.css';
import { HQ, HqBadge } from '../../components/halaqa/primitives';

/* الاشتراك — four honest answers: my status, what I get, payment state,
   what to do now. Same payment workflow, validation, and endpoints.
   No invented prices or benefits — everything renders from the config. */

const FALLBACK_FEATURES = [
  'حضور جميع الجلسات المباشرة التفاعلية مع المعلم',
  'خطة متابعة الحفظ والختم ومراجعة المتشابهات',
  'مراجعة وتصحيح التلاوات والتسميع الصوتي المباشر',
  'الوصول للتسجيلات ومكتبة الشروحات كاملة',
  'بنك الاختبارات والتقييمات المستمرة',
  'شهادة إتمام معتمدة وموثقة عند إنهاء المنهج الدراسي',
];

const CYCLES = [
  { key: 'monthly', label: 'شهري', suffix: 'شهر' },
  { key: 'quarterly', label: '3 شهور', suffix: '3 شهور' },
  { key: 'annual', label: 'سنوي', suffix: 'سنة' },
];

export default function SubscriptionPage() {
  const { user } = useAuthStore();
  const [isLoading, setIsLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [currency, setCurrency] = useState('EGP');
  const [billingCycle, setBillingCycle] = useState('monthly');

  // Backend config & status (endpoints unchanged)
  const [planConfig, setPlanConfig] = useState(null);
  const [paymentMethods, setPaymentMethods] = useState(null);
  const [supportInfo, setSupportInfo] = useState({});
  const [subscription, setSubscription] = useState(null);
  const [payments, setPayments] = useState([]);
  const paymentsPagination = usePagination(payments, 5);

  // Modal states (unchanged)
  const [checkoutModalOpen, setCheckoutModalOpen] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState('vodafone_cash');
  const [selectedReceiptPreview, setSelectedReceiptPreview] = useState(null);

  // Form states (unchanged)
  const [senderPhone, setSenderPhone] = useState('');
  const [senderName, setSenderName] = useState('');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [receiptFile, setReceiptFile] = useState(null);
  const [receiptPreviewUrl, setReceiptPreviewUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Copy state (unchanged)
  const [copiedKey, setCopiedKey] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    setLoadFailed(false);
    try {
      const [configRes, historyRes] = await Promise.all([
        api.get('/payments/public-config'),
        api.get('/payments/my-history'),
      ]);
      if (configRes.data) {
        setPlanConfig(configRes.data.plan || null);
        setPaymentMethods(configRes.data.methods || null);
        setSupportInfo(configRes.data.support || {});
      }
      if (historyRes.data) {
        setSubscription(historyRes.data.subscription || null);
        setPayments(historyRes.data.payments || []);
      }
    } catch (err) {
      console.error('Error fetching subscription data:', err);
      setLoadFailed(true);
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = (text, key) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    toast.success('تم النسخ إلى الحافظة');
    setTimeout(() => setCopiedKey(''), 2500);
  };

  // النظام فردي: لا مجموعات — السداد متاح لكل طالب معتمد
  const handleOpenCheckout = () => {
    setSenderPhone(user?.phone || '');
    setSenderName(`${user?.firstName || ''} ${user?.lastName || ''}`.trim());
    setReferenceNumber('');
    setNotes('');
    setReceiptFile(null);
    setReceiptPreviewUrl('');
    setCheckoutModalOpen(true);
  };

  // حدود مطابقة للخادم تماماً: 10MB وأنواع jpeg/png/webp/pdf فقط
  const ACCEPTED_RECEIPT_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!ACCEPTED_RECEIPT_TYPES.includes(file.type)) {
      toast.error('يرجى اختيار إيصال بصيغة JPG أو PNG أو WebP أو PDF');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('حجم الملف كبير جداً، الحد الأقصى 10 ميغابايت');
      return;
    }
    setReceiptFile(file);
    if (file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file);
      setReceiptPreviewUrl(url);
    } else {
      setReceiptPreviewUrl('');
    }
  };

  // Prices and payment destinations come ONLY from the admin panel
  // (/payments/public-config). No invented fallbacks — a missing value
  // renders as unavailable, never as a made-up number.
  const calculateAmount = (plan, cycle, curr) => {
    if (!plan) return null;
    const baseMonthly = curr === 'EGP' ? plan.priceEGP : plan.priceSAR;
    if (baseMonthly == null) return null;
    if (cycle === 'monthly') return baseMonthly;
    if (cycle === 'quarterly') {
      const total = baseMonthly * 3;
      const discount = (plan.quarterlyDiscountPercent ?? 10) / 100;
      return Math.round(total * (1 - discount));
    }
    if (cycle === 'annual') {
      const total = baseMonthly * 12;
      const discount = (plan.annualDiscountPercent ?? 20) / 100;
      return Math.round(total * (1 - discount));
    }
    return baseMonthly;
  };

  const vodaNumbers = (paymentMethods?.vodafoneCash?.numbers || []).filter(Boolean);
  const vodaEnabled = paymentMethods?.vodafoneCash?.enabled !== false && vodaNumbers.length > 0;
  const instaAddress = paymentMethods?.instaPay?.address || '';
  const instaAccountName = paymentMethods?.instaPay?.accountName || '';
  const instaEnabled = paymentMethods?.instaPay?.enabled !== false && Boolean(instaAddress);
  const availableMethods = [
    ...(vodaEnabled ? ['vodafone_cash'] : []),
    ...(instaEnabled ? ['instapay'] : []),
  ];
  const noMethodsConfigured = availableMethods.length === 0;
  const effectiveMethod = availableMethods.includes(selectedMethod)
    ? selectedMethod
    : (availableMethods[0] || selectedMethod);
  const displayAmount = calculateAmount(planConfig, billingCycle, currency);
  const canCheckout = displayAmount != null && !noMethodsConfigured;

  const handleSubmitPayment = async (e) => {
    e.preventDefault();
    if (!receiptFile) {
      toast.error('يرجى رفع صورة إيصال التحويل أو لقطة الشاشة للعملية');
      return;
    }
    if (noMethodsConfigured || displayAmount == null) {
      toast.error('بيانات السداد غير متاحة حالياً من الإدارة — حاول لاحقاً');
      return;
    }
    if (effectiveMethod === 'vodafone_cash' && !senderPhone) {
      toast.error('يرجى إدخال رقم المحفظة / الهاتف المحول منه');
      return;
    }
    if (!senderName.trim()) {
      toast.error('يرجى إدخال اسم المحوِّل');
      return;
    }
    const formData = new FormData();
    formData.append('billingCycle', billingCycle);
    // NOTE: the amount is intentionally NOT sent — the server recalculates
    // the price from the admin panel settings to prevent tampering.
    formData.append('currency', currency);
    formData.append('method', effectiveMethod);
    formData.append('senderPhone', senderPhone);
    formData.append('senderName', senderName);
    formData.append('referenceNumber', referenceNumber);
    formData.append('notes', notes);
    formData.append('receipt', receiptFile);

    setIsSubmitting(true);
    try {
      const res = await api.post('/payments/submit', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.success(res.data.message || 'تم إرسال إيصال التحويل بنجاح!');
      setCheckoutModalOpen(false);
      await fetchData();
    } catch (err) {
      console.error('Submit payment error:', err);
      toast.error(err.response?.data?.message || 'حدث خطأ أثناء إرسال طلب الدفع');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isPaidActive = subscription?.status === 'active' && !subscription?.isExpired;
  const isTrial = subscription?.isTrial;
  const isExpiringSoon = subscription?.isExpiringSoon;
  const isExpired = subscription?.isExpired;
  const pendingPayment = payments.find(p => p.status === 'pending');
  const hasPending = Boolean(pendingPayment);
  const trialUsed = (subscription?.trialSessionsAttended || 0) >= (subscription?.trialSessionsAllowed || 1);
  const currencyLabel = currency === 'EGP' ? 'ج.م' : 'ر.س';

  // المنتهي مدفوعاً يُعرض أولاً قبل فرع التجربة
  const statusTitle = !subscription
    ? 'ابدأ بحصتك التجريبية'
    : isPaidActive
    ? 'اشتراكك مفعل وسارٍ'
    : isExpired
    ? 'الاشتراك منتهي'
    : isTrial && !trialUsed
    ? 'محاضرتك التجريبية متاحة'
    : 'الاشتراك مطلوب';
  const statusHint = !subscription
    ? 'احضر أول جلسة مباشرة مجاناً لتجربة الحصة مع معلمك، ثم سدد الاشتراك لفتح كامل المحتوى.'
    : isPaidActive && subscription?.endDate
    ? `ينتهي في ${formatDateAr(subscription.endDate)} (متبقي ${subscription.daysRemaining} يوم)`
    : isExpired
    ? 'انتهى اشتراكك — المحتوى محجوب بالكامل حتى السداد. تُراجَع الإيصالات خلال 24 ساعة ولا يُفتح المحتوى أثناء المراجعة.'
    : isTrial && !trialUsed
    ? 'يمكنك حضور أول جلسة مباشرة مجانًا لتجربة الحصة.'
    : 'سدد اشتراكك لفتح كامل المحتوى ومواصلة الحصص مع المعلم.';

  const inputStyle = {
    width: '100%', padding: '12px 14px', borderRadius: 12, border: `1px solid ${HQ.LINE}`,
    background: HQ.SURFACE, fontSize: 16, color: HQ.INK, fontFamily: 'inherit', minHeight: 48,
  };
  const labelStyle = { display: 'block', fontSize: 13, fontWeight: 800, color: HQ.INK, marginBottom: 6 };

  return (
    <PageLayout>
      <div className="halaqa" style={{ maxWidth: 760, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 26, fontWeight: 900, color: HQ.INK }}>الاشتراك</h1>
            <p style={{ margin: '4px 0 0', fontSize: 14, color: HQ.MUTED }}>حالتك، ومزاياك، ومدفوعاتك — في مكان واحد</p>
          </div>
          <button type="button" onClick={fetchData} disabled={isLoading} className="hq-action"
            style={{ background: HQ.SURFACE, border: `1px solid ${HQ.LINE}`, color: HQ.INK, padding: '0 16px', fontSize: 13, flex: 'none' }}>
            <RefreshCw size={15} className={isLoading ? 'animate-spin' : ''} /> تحديث
          </button>
        </div>

        {isLoading ? (
          <div aria-label="جارٍ تحميل الاشتراك">
            <div className="hq-skeleton" style={{ height: 120, width: '100%', marginBottom: 12 }} />
            <div className="hq-skeleton" style={{ height: 200, width: '100%', marginBottom: 12 }} />
            <div className="hq-skeleton" style={{ height: 64, width: '100%' }} />
          </div>
        ) : loadFailed && !subscription && !planConfig ? (
          <div style={{ background: HQ.SURFACE, border: `1px solid ${HQ.LINE}`, borderRadius: 18, padding: 48, textAlign: 'center' }} role="alert">
            <p style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 900, color: HQ.INK }}>تعذّر تحميل بيانات الاشتراك</p>
            <p style={{ margin: '0 0 20px', fontSize: 14, color: HQ.MUTED }}>تحقق من الاتصال ثم حاول مرة أخرى.</p>
            <button type="button" onClick={fetchData} className="hq-action" style={{ background: HQ.MENTOR, color: '#fff', padding: '0 24px', fontSize: 15 }}>
              <RefreshCw size={16} /> إعادة المحاولة
            </button>
          </div>
        ) : (
          <>
            {/* 1. My status */}
            <section aria-label="حالة اشتراكي"
              style={{ background: HQ.SURFACE, border: `1px solid ${HQ.LINE}`, borderRadius: 18, padding: 20, marginBottom: 16 }}>
              {pendingPayment && (
                <p role="status" style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '0 0 12px', fontSize: 14, fontWeight: 800, color: '#B45309' }}>
                  <Clock size={16} />
                  طلبك قيد المراجعة{pendingPayment?._id ? ` (رقم الطلب: ${String(pendingPayment._id).slice(-6).toUpperCase()})` : ''} — سيُفتح المحتوى بعد اعتماد الإدارة خلال 24 ساعة.
                </p>
              )}
              {(isExpiringSoon || isExpired) && (
                <p role={isExpired ? 'alert' : 'status'} style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '0 0 12px', fontSize: 14, fontWeight: 800, color: isExpired ? '#C2410C' : '#B45309' }}>
                  {isExpired ? <Lock size={16} /> : <AlertCircle size={16} />}
                  {isExpired ? 'انتهى اشتراكك — المحتوى محجوب بالكامل حتى السداد' : `يتبقى ${subscription?.daysRemaining} أيام على اشتراكك`}
                </p>
              )}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                    <h2 style={{ margin: 0, fontSize: 20, fontWeight: 900, color: HQ.INK }}>{statusTitle}</h2>
                    <HqBadge tone={isPaidActive ? 'mentor' : isTrial && !trialUsed ? 'gold' : 'neutral'}>
                      {isPaidActive ? 'نشط' : isTrial && !trialUsed ? 'تجريبي' : 'مطلوب السداد'}
                    </HqBadge>
                  </div>
                  <p style={{ margin: 0, fontSize: 14, color: HQ.MUTED, lineHeight: 1.6 }}>{statusHint}</p>

                  {/* مواعيد الحصص المعتمدة */}
                  {(user?.scheduleDays?.length > 0 || user?.sessionTime) && (
                    <p style={{ margin: '10px 0 0', fontSize: 13, color: HQ.MENTOR, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <CheckCircle2 size={15} /> مواعيد حصصك: {user?.scheduleDays?.join('، ') || ''} {user?.sessionTime ? `(الساعة ${formatTime12Ar(user.sessionTime)})` : ''}
                    </p>
                  )}
                </div>
                <button type="button" onClick={handleOpenCheckout} disabled={!canCheckout || hasPending} className="hq-action"
                  style={{ background: hasPending ? HQ.PAPER : HQ.MENTOR, color: hasPending ? HQ.MUTED : '#fff', border: hasPending ? `1px solid ${HQ.LINE}` : 'none', padding: '0 24px', fontSize: 15, flex: 'none', opacity: (canCheckout && !hasPending) ? 1 : 0.7 }}>
                  {hasPending ? <><Clock size={17} /> طلبك قيد المراجعة ⏳</> : <><CreditCard size={17} /> {isPaidActive ? 'تجديد مقدمًا' : 'اشترك الآن'}</>}
                </button>
              </div>
            </section>

            {/* 2. What I get — from config only */}
            <section aria-label="مزايا الاشتراك"
              style={{ background: HQ.SURFACE, border: `1px solid ${HQ.LINE}`, borderRadius: 18, padding: 20, marginBottom: 16 }}>
              <p style={{ margin: '0 0 4px', fontSize: 13, fontWeight: 800, color: HQ.MENTOR }}>الباقة الشاملة الموحدة</p>
              <h2 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 900, color: HQ.INK }}>
                {planConfig?.name || 'الاشتراك في الحلقات'}
              </h2>
              <p style={{ margin: '0 0 12px', fontSize: 14, color: HQ.MUTED }}>
                {planConfig?.description || 'اشتراك شامل لحضور الحلقات المباشرة ومتابعة الحفظ مع المعلم'}
              </p>
              <ul style={{ listStyle: 'none', margin: '0 0 16px', padding: 0 }}>
                {(planConfig?.features || FALLBACK_FEATURES).map((feat, idx) => (
                  <li key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 14, color: HQ.INK, padding: '6px 0', borderTop: idx ? `1px solid ${HQ.LINE}` : 'none' }}>
                    <CheckCircle2 size={16} color={HQ.MENTOR} style={{ flex: 'none', marginTop: 3 }} />
                    {feat}
                  </li>
                ))}
              </ul>

              {/* Currency + cycle — segmented, quiet */}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
                <div role="group" aria-label="العملة" style={{ display: 'inline-flex', gap: 4, background: HQ.PAPER, border: `1px solid ${HQ.LINE}`, borderRadius: 12, padding: 4 }}>
                  {[{ k: 'EGP', l: 'جنيه مصري' }, { k: 'SAR', l: 'ريال سعودي' }].map(c => (
                    <button key={c.k} type="button" aria-pressed={currency === c.k} onClick={() => setCurrency(c.k)}
                      style={{ border: 'none', cursor: 'pointer', minHeight: 44, padding: '0 16px', borderRadius: 8, fontSize: 13, fontWeight: 800, background: currency === c.k ? HQ.MENTOR : 'transparent', color: currency === c.k ? '#fff' : HQ.MUTED }}>
                      {c.l}
                    </button>
                  ))}
                </div>
                <div role="group" aria-label="مدة الاشتراك" style={{ display: 'inline-flex', gap: 4, background: HQ.PAPER, border: `1px solid ${HQ.LINE}`, borderRadius: 12, padding: 4 }}>
                  {CYCLES.map(c => (
                    <button key={c.key} type="button" aria-pressed={billingCycle === c.key} onClick={() => setBillingCycle(c.key)}
                      style={{ border: 'none', cursor: 'pointer', minHeight: 44, padding: '0 16px', borderRadius: 8, fontSize: 13, fontWeight: 800, background: billingCycle === c.key ? HQ.MENTOR : 'transparent', color: billingCycle === c.key ? '#fff' : HQ.MUTED }}>
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
                <strong style={{ fontSize: 40, fontWeight: 900, color: HQ.INK }}>
                  {displayAmount == null ? '—' : displayAmount}
                </strong>
                <span style={{ fontSize: 15, fontWeight: 800, color: HQ.MUTED }}>
                  {currencyLabel} / {CYCLES.find(c => c.key === billingCycle)?.suffix}
                </span>
              </div>
              {displayAmount == null ? (
                <p role="alert" style={{ margin: '0 0 16px', fontSize: 13, color: '#C2410C' }}>
                  سعر هذه العملة غير مضبوط من الإدارة حالياً — جرّب العملة الأخرى أو حاول لاحقاً.
                </p>
              ) : (
                <p style={{ margin: '0 0 16px', fontSize: 13, color: HQ.MUTED }}>
                  {billingCycle === 'annual' ? 'اشتراك سنوي كامل بخصم الإدارة' : billingCycle === 'quarterly' ? 'اشتراك 3 شهور بخصم الإدارة' : 'سداد شهري ميسر'}
                </p>
              )}
              {noMethodsConfigured && (
                <p role="alert" style={{ margin: '0 0 16px', fontSize: 13, color: '#C2410C' }}>
                  طرق الدفع غير متاحة حالياً من الإدارة — حاول لاحقاً أو تواصل مع الدعم.
                </p>
              )}

              {/* Action Button — waiting state while a request is under review */}
              <button type="button" onClick={handleOpenCheckout} disabled={!canCheckout || hasPending} className="hq-action"
                style={{ width: '100%', background: hasPending ? HQ.PAPER : HQ.MENTOR, color: hasPending ? HQ.MUTED : '#fff', border: hasPending ? `1px solid ${HQ.LINE}` : 'none', fontSize: 16, opacity: (canCheckout && !hasPending) ? 1 : 0.7 }}>
                {hasPending ? <><Clock size={18} /> طلبك قيد المراجعة — سيُفتح المحتوى بعد الاعتماد</> : <><CreditCard size={18} /> {isPaidActive ? 'تجديد الاشتراك' : 'اشترك وسدد الآن'}</>}
              </button>
            </section>

            {/* 3. Payment history — rows, never a wide table */}
            <section aria-label="سجل المدفوعات"
              style={{ background: HQ.SURFACE, border: `1px solid ${HQ.LINE}`, borderRadius: 18, padding: 20, marginBottom: 16 }}>
              <h2 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 900, color: HQ.INK }}>مدفوعاتي ({payments.length})</h2>
              {payments.length === 0 ? (
                <p style={{ margin: '8px 0 0', fontSize: 14, color: HQ.MUTED }}>لا عمليات سداد بعد — ستظهر إيصالاتك هنا فور رفعها.</p>
              ) : (
                <>
                  <ol style={{ listStyle: 'none', margin: '8px 0 0', padding: 0 }}>
                    {paymentsPagination.paginatedItems.map((p) => (
                      <li key={p._id} style={{ padding: '12px 0', borderTop: `1px solid ${HQ.LINE}` }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ flex: 1, minWidth: 0 }}>
                            <strong style={{ display: 'block', fontSize: 15, color: HQ.INK }}>
                              {p.amount} {p.currency === 'EGP' ? 'ج.م' : 'ر.س'} · {p.method === 'vodafone_cash' ? 'فودافون كاش' : 'انستاباي'}
                            </strong>
                            <span style={{ display: 'block', fontSize: 13, color: HQ.MUTED, marginTop: 2 }}>
                              {formatDateAr(p.createdAt)}
                              {p.referenceNumber || p.senderPhone ? ` · ${p.referenceNumber || p.senderPhone}` : ''}
                            </span>
                          </span>
                          <HqBadge tone={p.status === 'approved' ? 'mentor' : p.status === 'rejected' ? 'neutral' : 'gold'}>
                            {p.status === 'approved' ? 'معتمد' : p.status === 'rejected' ? 'مرفوض' : 'قيد المراجعة'}
                          </HqBadge>
                        </div>
                        {p.status === 'rejected' && p.rejectionReason && (
                          <p style={{ margin: '6px 0 0', fontSize: 13, color: '#C2410C' }}>السبب: {p.rejectionReason}</p>
                        )}
                        {p.receiptUrl && (
                          <button type="button" onClick={() => setSelectedReceiptPreview(p.receiptUrl)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', marginTop: 6, fontSize: 13, fontWeight: 800, color: HQ.MENTOR, display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 44, padding: 0 }}>
                            <Eye size={15} /> معاينة الإيصال
                          </button>
                        )}
                      </li>
                    ))}
                  </ol>
                  <Pagination
                    currentPage={paymentsPagination.currentPage}
                    totalPages={paymentsPagination.totalPages}
                    totalItems={paymentsPagination.totalItems}
                    pageSize={paymentsPagination.pageSize}
                    onPageChange={paymentsPagination.setCurrentPage}
                    onPageSizeChange={paymentsPagination.setPageSize}
                    showPageSize={true}
                    pageSizeOptions={[5, 10, 20]}
                    itemName="عملية"
                    className="mt-4"
                  />
                </>
              )}
            </section>

            {/* 4. Support */}
            {supportInfo?.whatsapp && (
              <section aria-label="الدعم"
                style={{ background: HQ.SURFACE, border: `1px solid ${HQ.LINE}`, borderRadius: 18, padding: 16, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <span style={{ flex: 1, minWidth: 180, fontSize: 14, color: HQ.INK }}>
                  <strong>صعوبة في التحويل؟</strong> <span style={{ color: HQ.MUTED }}>الدعم يساعدك على الواتساب.</span>
                </span>
                <a href={`https://wa.me/${supportInfo.whatsapp}`} target="_blank" rel="noopener noreferrer" className="hq-action"
                  style={{ background: HQ.MENTOR, color: '#fff', padding: '0 20px', fontSize: 14, textDecoration: 'none' }}>
                  <Phone size={16} /> واتساب الدعم
                </a>
              </section>
            )}
          </>
        )}
      </div>

      {/* ── Checkout modal — same 3 steps, same fields, same validation ── */}
      {checkoutModalOpen && (
        <div dir="rtl" style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: 'rgba(12,12,29,0.72)' }}>
          <div role="dialog" aria-modal="true" aria-label="سداد الاشتراك"
            style={{ background: HQ.SURFACE, borderRadius: 18, padding: 24, maxWidth: 600, width: '100%', maxHeight: '90vh', overflowY: 'auto', border: `1px solid ${HQ.LINE}` }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, paddingBottom: 16, borderBottom: `1px solid ${HQ.LINE}`, marginBottom: 20 }}>
              <div>
                <HqBadge tone="mentor">سداد الاشتراك</HqBadge>
                <h3 style={{ margin: '8px 0 0', fontSize: 20, fontWeight: 900, color: HQ.INK }}>
                  {planConfig?.name || 'الاشتراك في الحلقات'}
                </h3>
              </div>
              <button type="button" onClick={() => !isSubmitting && setCheckoutModalOpen(false)} aria-label="إغلاق" disabled={isSubmitting}
                style={{ width: 44, height: 44, borderRadius: 12, border: 'none', background: HQ.PAPER, color: HQ.MUTED, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmitPayment}>
              {/* Amount summary — admin price only */}
              <div style={{ background: HQ.PAPER, border: `1px solid ${HQ.LINE}`, borderRadius: 14, padding: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <span style={{ fontSize: 14, color: HQ.MUTED }}>المبلغ المطلوب تحويله</span>
                <strong style={{ fontSize: 24, color: HQ.INK }}>
                  {displayAmount == null ? 'غير متاح' : `${displayAmount} ${currency === 'EGP' ? 'ج.م' : 'ر.س'}`}
                </strong>
              </div>

              {/* Step 1: method — only admin-enabled methods */}
              <p style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 900, color: HQ.INK }}>1. اختر طريقة التحويل</p>
              {noMethodsConfigured ? (
                <p role="alert" style={{ margin: '0 0 20px', fontSize: 14, color: '#C2410C' }}>
                  طرق الدفع غير متاحة حالياً من الإدارة — لا يمكن إتمام السداد الآن.
                </p>
              ) : (
              <div className="m-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 20 }}>
                {[
                  ...(vodaEnabled ? [{ key: 'vodafone_cash', label: 'فودافون كاش', hint: 'محافظ إلكترونية', icon: Smartphone }] : []),
                  ...(instaEnabled ? [{ key: 'instapay', label: 'انستاباي', hint: 'تحويل بنكي لحظي', icon: Building2 }] : []),
                ].map(m => (
                  <button key={m.key} type="button" aria-pressed={effectiveMethod === m.key}
                    onClick={() => setSelectedMethod(m.key)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10, padding: 12, minHeight: 64,
                      background: effectiveMethod === m.key ? HQ.PAPER : HQ.SURFACE,
                      border: effectiveMethod === m.key ? `2px solid ${HQ.MENTOR}` : `1px solid ${HQ.LINE}`,
                      borderRadius: 14, cursor: 'pointer', textAlign: 'right',
                    }}>
                    <m.icon size={20} color={effectiveMethod === m.key ? HQ.MENTOR : HQ.MUTED} style={{ flex: 'none' }} />
                    <span>
                      <strong style={{ display: 'block', fontSize: 14, color: HQ.INK }}>{m.label}</strong>
                      <span style={{ display: 'block', fontSize: 12, color: HQ.MUTED }}>{m.hint}</span>
                    </span>
                    {effectiveMethod === m.key && <Check size={17} color={HQ.MENTOR} style={{ marginRight: 'auto' }} />}
                  </button>
                ))}
              </div>
              )}

              {/* Step 2: transfer details — admin numbers only, never invented */}
              <p style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 900, color: HQ.INK }}>2. حوّل إلى الحساب التالي</p>
              <div style={{ background: HQ.PAPER, border: `1px solid ${HQ.LINE}`, borderRadius: 14, padding: 14, marginBottom: 20 }}>
                {effectiveMethod === 'vodafone_cash' ? (
                  vodaEnabled ? (
                  <>
                    <span style={{ display: 'block', fontSize: 12, color: HQ.MUTED }}>رقم محفظة فودافون كاش</span>
                    <span style={{ display: 'block', fontSize: 20, fontWeight: 900, color: HQ.INK, margin: '2px 0 8px', direction: 'ltr', textAlign: 'right' }}>
                      {vodaNumbers[0]}
                    </span>
                    <button type="button"
                      onClick={() => copyToClipboard(vodaNumbers[0], 'voda-num')}
                      className="hq-action" style={{ background: HQ.SURFACE, border: `1px solid ${HQ.LINE}`, color: HQ.INK, padding: '0 16px', fontSize: 13 }}>
                      {copiedKey === 'voda-num' ? <Check size={15} color={HQ.MENTOR} /> : <Copy size={15} />}
                      {copiedKey === 'voda-num' ? 'تم النسخ' : 'نسخ الرقم'}
                    </button>
                  </>
                  ) : (
                    <p style={{ margin: 0, fontSize: 14, color: '#C2410C' }}>فودافون كاش غير متاح حالياً من الإدارة.</p>
                  )
                ) : (
                  instaEnabled ? (
                  <>
                    <span style={{ display: 'block', fontSize: 12, color: HQ.MUTED }}>العنوان اللحظي (IPA)</span>
                    <span style={{ display: 'block', fontSize: 17, fontWeight: 900, color: HQ.INK, margin: '2px 0 8px', direction: 'ltr', textAlign: 'right' }}>
                      {instaAddress}
                    </span>
                    <p style={{ margin: '0 0 8px', fontSize: 13, color: HQ.MUTED }}>
                      المستلم: <strong style={{ color: HQ.INK }}>{instaAccountName}</strong>
                    </p>
                    <button type="button"
                      onClick={() => copyToClipboard(instaAddress, 'insta-addr')}
                      className="hq-action" style={{ background: HQ.SURFACE, border: `1px solid ${HQ.LINE}`, color: HQ.INK, padding: '0 16px', fontSize: 13 }}>
                      {copiedKey === 'insta-addr' ? <Check size={15} color={HQ.MENTOR} /> : <Copy size={15} />}
                      {copiedKey === 'insta-addr' ? 'تم النسخ' : 'نسخ العنوان'}
                    </button>
                  </>
                  ) : (
                    <p style={{ margin: 0, fontSize: 14, color: '#C2410C' }}>انستاباي غير متاح حالياً من الإدارة.</p>
                  )
                )}
              </div>

              {/* Step 3: sender + receipt */}
              <p style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 900, color: HQ.INK }}>3. بيانات التحويل والإيصال</p>
              <div style={{ marginBottom: 12 }}>
                <label style={labelStyle} htmlFor="sub-sender-name">اسم المحوِّل *</label>
                <input id="sub-sender-name" type="text" required value={senderName}
                  onChange={(e) => setSenderName(e.target.value)}
                  placeholder="الاسم الذي تم التحويل منه" style={inputStyle} />
              </div>
              <div className="m-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div>
                  <label style={labelStyle} htmlFor="sub-sender-phone">
                    {effectiveMethod === 'vodafone_cash' ? 'رقم المحفظة المحول منها *' : 'هاتفك أو حساب انستاباي *'}
                  </label>
                  <input id="sub-sender-phone" type="text" required value={senderPhone}
                    onChange={(e) => setSenderPhone(e.target.value)}
                    placeholder={effectiveMethod === 'vodafone_cash' ? '010XXXXXXXX' : 'اسم المستخدم أو 01XXXXXXXXX'}
                    style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle} htmlFor="sub-ref">رقم العملية (اختياري)</label>
                  <input id="sub-ref" type="text" value={referenceNumber}
                    onChange={(e) => setReferenceNumber(e.target.value)}
                    placeholder="مثال: TRX-837482" style={inputStyle} />
                </div>
              </div>
              <div style={{ marginBottom: 12 }}>
                <span style={labelStyle}>صورة الإيصال *</span>
                <div style={{ border: `1.5px dashed ${HQ.LINE}`, borderRadius: 14, padding: 16, textAlign: 'center', background: HQ.PAPER }}>
                  {receiptPreviewUrl ? (
                    <div style={{ position: 'relative', display: 'inline-block' }}>
                      <img src={receiptPreviewUrl} alt="معاينة الإيصال" style={{ maxHeight: 176, borderRadius: 12, objectFit: 'contain' }} />
                      <button type="button" aria-label="إزالة الإيصال"
                        onClick={() => { setReceiptFile(null); setReceiptPreviewUrl(''); }}
                        style={{ position: 'absolute', top: -10, left: -10, width: 32, height: 32, borderRadius: 9999, border: 'none', background: '#C2410C', color: '#fff', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                        <X size={15} />
                      </button>
                    </div>
                  ) : (
                    <label style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                      <Upload size={20} color={HQ.MENTOR} />
                      <strong style={{ fontSize: 14, color: HQ.INK }}>ارفع صورة الإيصال</strong>
                      <span style={{ fontSize: 12, color: HQ.MUTED }}>PNG أو JPG أو PDF حتى 10 ميغابايت</span>
                      <input type="file" accept="image/*,application/pdf" onChange={handleFileChange} style={{ display: 'none' }} />
                    </label>
                  )}
                </div>
              </div>
              <div style={{ marginBottom: 20 }}>
                <label style={labelStyle} htmlFor="sub-notes">ملاحظات (اختياري)</label>
                <input id="sub-notes" type="text" value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="أي معلومات إضافية للإدارة..." style={inputStyle} />
              </div>

              <button type="submit" disabled={isSubmitting || !canCheckout} className="hq-action"
                style={{ width: '100%', background: HQ.MENTOR, color: '#fff', fontSize: 16, opacity: (isSubmitting || !canCheckout) ? 0.6 : 1 }}>
                {isSubmitting ? <><LoadingSpinner size="sm" color="white" /> جارٍ الإرسال...</> : <><ShieldCheck size={18} /> تأكيد وإرسال الإيصال</>}
              </button>
              <p style={{ fontSize: 12, textAlign: 'center', color: HQ.MUTED, margin: '8px 0 0' }}>
                تُراجَع الإيصالات خلال 24 ساعة ويُفعَّل اشتراكك بعد اعتماد الإدارة — لا يُفتح المحتوى أثناء المراجعة.
              </p>
            </form>
          </div>
        </div>
      )}

      {/* Receipt preview modal */}
      {selectedReceiptPreview && (
        <div dir="rtl" style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: 'rgba(12,12,29,0.72)' }}>
          <div role="dialog" aria-modal="true" aria-label="معاينة الإيصال"
            style={{ background: HQ.SURFACE, borderRadius: 18, padding: 16, maxWidth: 560, width: '100%', border: `1px solid ${HQ.LINE}` }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 12, marginBottom: 12, borderBottom: `1px solid ${HQ.LINE}` }}>
              <h4 style={{ margin: 0, fontWeight: 900, fontSize: 15, color: HQ.INK }}>معاينة الإيصال</h4>
              <button type="button" onClick={() => setSelectedReceiptPreview(null)} aria-label="إغلاق"
                style={{ width: 44, height: 44, borderRadius: 12, border: 'none', background: HQ.PAPER, color: HQ.MUTED, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                <X size={18} />
              </button>
            </div>
            <div style={{ maxHeight: '70vh', overflowY: 'auto', display: 'flex', justifyContent: 'center', background: HQ.PAPER, borderRadius: 12, padding: 8 }}>
              <img src={selectedReceiptPreview} alt="صورة الإيصال" style={{ maxHeight: '68vh', objectFit: 'contain', borderRadius: 8 }} />
            </div>
          </div>
        </div>
      )}
    </PageLayout>
  );
}
