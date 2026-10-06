import { useState, useEffect } from 'react';
import {
  Users, Clock, Plus, Trash2, AlertCircle, CheckCircle2, XCircle,
  Calendar, MessageSquare, Mail, CreditCard, BookOpen, Award,
  Sparkles, ChevronRight, Phone, ShieldCheck, Upload, Check, Info
} from 'lucide-react';
import PageLayout from '../../components/shared/PageLayout';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { timeAgoAr, getLevelLabel, formatCountdown } from '../../utils/helpers';
import '../../components/halaqa/halaqa.css';
import { HQ, HqAvatar, HqBadge } from '../../components/halaqa/primitives';
import { uploadDirectToCloudinary } from '../../utils/cloudinaryUpload';

const STATUS_TONE = {
  present: { label: 'حاضر اليوم ✅', color: HQ.MENTOR, bg: '#E2EFE7' },
  late: { label: 'متأخر ⏳', color: '#B45309', bg: '#FEF3C7' },
  absent: { label: 'غائب اليوم ❌', color: '#C2410C', bg: '#FEE2E2' },
  excused: { label: 'معذور 📝', color: '#4A3F6B', bg: '#EDE9FF' },
  in_progress: { label: 'الحصة جارية الآن 🟢', color: HQ.MENTOR, bg: '#DCFCE7' },
  not_started: { label: 'لم تبدأ الحصة بعد', color: HQ.MUTED, bg: HQ.PAPER },
};

const DAY_LABELS = {
  saturday: 'السبت',
  sunday: 'الأحد',
  monday: 'الإثنين',
  tuesday: 'الثلاثاء',
  wednesday: 'الأربعاء',
  thursday: 'الخميس',
  friday: 'الجمعة',
};

export default function ParentDashboard() {
  const [children, setChildren] = useState([]);
  const [selectedChildId, setSelectedChildId] = useState(null);
  const [childProgress, setChildProgress] = useState(null);
  const [loadingProgress, setLoadingProgress] = useState(false);
  const [loadingChildren, setLoadingChildren] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);

  // Link child states
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [linkMode, setLinkMode] = useState('code'); // 'code' | 'email'
  const [linkCode, setLinkCode] = useState('');
  const [childEmail, setChildEmail] = useState('');
  const [childPhone, setChildPhone] = useState('');
  const [linking, setLinking] = useState(false);

  // Unlink states
  const [confirmUnlinkId, setConfirmUnlinkId] = useState(null);
  const [unlinking, setUnlinking] = useState(false);

  // Parent Payment for Child states
  const [payModalOpen, setPayModalOpen] = useState(false);
  const [paymentConfig, setPaymentConfig] = useState(null);
  const [billingCycle, setBillingCycle] = useState('monthly');
  const [paymentMethod, setPaymentMethod] = useState('vodafone_cash');
  const [senderPhone, setSenderPhone] = useState('');
  const [senderName, setSenderName] = useState('');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [receiptFile, setReceiptFile] = useState(null);
  const [receiptPreviewUrl, setReceiptPreviewUrl] = useState('');
  const [submittingPayment, setSubmittingPayment] = useState(false);

  useEffect(() => {
    fetchChildren();
    fetchPaymentConfig();
  }, []);

  useEffect(() => {
    if (selectedChildId) {
      fetchChildProgress(selectedChildId);
    } else {
      setChildProgress(null);
    }
  }, [selectedChildId]);

  const fetchChildren = async () => {
    setLoadingChildren(true);
    setLoadFailed(false);
    try {
      const res = await api.get('/parents/children');
      const kids = res.data.children || [];
      setChildren(kids);
      if (kids.length > 0 && !selectedChildId) {
        setSelectedChildId(kids[0]._id);
      }
    } catch {
      setLoadFailed(true);
      toast.error('خطأ في جلب بيانات الأبناء المربوطين');
    } finally {
      setLoadingChildren(false);
    }
  };

  const fetchPaymentConfig = async () => {
    try {
      const res = await api.get('/payments/public-config');
      setPaymentConfig(res.data);
    } catch {
      // Ignore config error
    }
  };

  const fetchChildProgress = async (childId) => {
    setLoadingProgress(true);
    try {
      const res = await api.get(`/parents/children/${childId}/progress`);
      setChildProgress(res.data);
    } catch {
      toast.error('خطأ في جلب تقرير تقدم الابن');
    } finally {
      setLoadingProgress(false);
    }
  };

  const handleLinkChild = async (e) => {
    e.preventDefault();
    if (linkMode === 'code' && !linkCode.trim()) {
      toast.error('يرجى إدخال رمز الربط المكون من 6 أرقام');
      return;
    }
    if (linkMode === 'email' && !childEmail.trim()) {
      toast.error('يرجى إدخال البريد الإلكتروني للابن');
      return;
    }
    setLinking(true);
    try {
      const payload = linkMode === 'code'
        ? { linkCode: linkCode.trim() }
        : { childEmail: childEmail.trim(), childPhone: childPhone.trim() || undefined };

      const res = await api.post('/parents/children', payload);
      toast.success(res.data.message || 'تم ربط الابن بنجاح!');
      setLinkCode('');
      setChildEmail('');
      setChildPhone('');
      setLinkModalOpen(false);
      const kids = [...children, res.data.child];
      setChildren(kids);
      setSelectedChildId(res.data.child._id);
    } catch (error) {
      toast.error(error?.response?.data?.message || 'خطأ في ربط الابن');
    } finally {
      setLinking(false);
    }
  };

  const handleUnlinkChild = async () => {
    if (!confirmUnlinkId) return;
    setUnlinking(true);
    try {
      await api.delete(`/parents/children/${confirmUnlinkId}`);
      toast.success('تم إلغاء ربط الابن بنجاح');
      const updatedKids = children.filter(k => k._id !== confirmUnlinkId);
      setChildren(updatedKids);
      if (updatedKids.length > 0) {
        setSelectedChildId(updatedKids[0]._id);
      } else {
        setSelectedChildId(null);
      }
      setConfirmUnlinkId(null);
    } catch {
      toast.error('خطأ في إلغاء ربط الابن');
    } finally {
      setUnlinking(false);
    }
  };

  // Payment for child submit handler
  const handleReceiptChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setReceiptFile(file);
      setReceiptPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handlePayForChildSubmit = async (e) => {
    e.preventDefault();
    if (!receiptFile) {
      toast.error('يرجى إرفاق صورة إيصال التحويل');
      return;
    }
    setSubmittingPayment(true);
    try {
      // Browser → Cloudinary مباشرة (السيرفر يستقبل JSON فقط، ليس بايتات الملف)
      const basePayload = {
        studentId: selectedChildId,
        billingCycle,
        method: paymentMethod,
        senderPhone: senderPhone.trim(),
        senderName: senderName.trim(),
        referenceNumber: referenceNumber.trim(),
        notes: paymentNotes.trim(),
      };

      // Browser → Cloudinary مباشرة — الإيصال لا يمر بالسيرفر أبداً
      const direct = await uploadDirectToCloudinary(receiptFile, { kind: 'receipt' });
      await api.post('/payments/submit', {
        ...basePayload,
        receiptUrl: direct.url,
        receiptPublicId: direct.publicId,
        receiptResourceType: direct.resourceType,
      });

      toast.success('تم إرسال إيصال الاشتراك بنجاح للإدارة للتدقيق والتفعيل!');
      setPayModalOpen(false);
      setReceiptFile(null);
      setReceiptPreviewUrl('');
      setReferenceNumber('');
      setSenderPhone('');
      setSenderName('');
      // Refresh child progress
      if (selectedChildId) fetchChildProgress(selectedChildId);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'حدث خطأ أثناء إرسال إيصال السداد');
    } finally {
      setSubmittingPayment(false);
    }
  };

  const selectedChild = children.find(k => k._id === selectedChildId);
  const today = childProgress?.attendance?.todaySession;
  const todayTone = today ? (STATUS_TONE[today.attendanceStatus] || (today.sessionStatus === 'live' ? STATUS_TONE.in_progress : STATUS_TONE.not_started)) : null;

  // Plan pricing
  const basePrice = paymentConfig?.plan?.priceEGP || 250;
  const planName = paymentConfig?.plan?.name || 'الاشتراك الشهري في الحلقات';
  const calculateCyclePrice = (cycle) => {
    if (cycle === 'quarterly') {
      const discount = paymentConfig?.plan?.quarterlyDiscountPercent || 10;
      return Math.round(basePrice * 3 * (1 - discount / 100));
    }
    if (cycle === 'annual') {
      const discount = paymentConfig?.plan?.annualDiscountPercent || 20;
      return Math.round(basePrice * 12 * (1 - discount / 100));
    }
    return basePrice;
  };

  const scheduleDaysArabic = (selectedChild?.scheduleDays || []).map(d => DAY_LABELS[d.toLowerCase()] || d).join(' • ');

  return (
    <PageLayout>
      <div className="halaqa" style={{ maxWidth: 860, margin: '0 auto', paddingBottom: 32 }}>

        {/* ── Page Header ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900, color: HQ.INK }}>متابعة الأبناء</h1>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: HQ.MUTED }}>متابعة فورية للحضور، الورد القرآني، واشتراكات الحلقات</p>
          </div>
          <button
            type="button"
            onClick={() => setLinkModalOpen(true)}
            className="hq-action"
            style={{ background: HQ.MENTOR, color: '#fff', padding: '0 16px', fontSize: 14, flex: 'none' }}
          >
            <Plus size={16} /> ربط ابن جديد
          </button>
        </div>

        {/* ── Loading / Empty States ── */}
        {loadingChildren ? (
          <div>
            <div className="hq-skeleton" style={{ height: 60, width: '100%', marginBottom: 12 }} />
            <div className="hq-skeleton" style={{ height: 220, width: '100%' }} />
          </div>
        ) : loadFailed && children.length === 0 ? (
          <div style={{ background: HQ.SURFACE, border: `1px solid ${HQ.LINE}`, borderRadius: 18, padding: 36, textAlign: 'center' }}>
            <AlertCircle size={36} color="#C2410C" style={{ margin: '0 auto 12px' }} />
            <h3 style={{ margin: '0 0 6px', fontSize: 18, fontWeight: 900, color: HQ.INK }}>تعذر تحميل بيانات الأبناء</h3>
            <p style={{ margin: '0 0 16px', fontSize: 13, color: HQ.MUTED }}>تأكد من اتصالك بالإنترنت ثم حاول مجدداً.</p>
            <button type="button" onClick={fetchChildren} className="hq-action" style={{ background: HQ.MENTOR, color: '#fff' }}>
              إعادة المحاولة
            </button>
          </div>
        ) : children.length === 0 ? (
          <div style={{ background: HQ.SURFACE, border: `1px solid ${HQ.LINE}`, borderRadius: 18, padding: 48, textAlign: 'center' }}>
            <Users size={44} color={HQ.MENTOR} style={{ margin: '0 auto 12px' }} />
            <h2 style={{ fontSize: 20, fontWeight: 900, color: HQ.INK, margin: '0 0 8px' }}>لم يتم ربط أي ابن بحسابك بعد</h2>
            <p style={{ color: HQ.MUTED, fontSize: 14, margin: '0 0 24px', lineHeight: 1.8 }}>
              اربط حساب ابنك المسجل في المنصة لمتابعة حضوره اليومي مع المعلم والورد القرآني ونتائج الاختبارات.
            </p>
            <button type="button" onClick={() => setLinkModalOpen(true)} className="hq-action" style={{ background: HQ.MENTOR, color: '#fff', fontSize: 15, margin: '0 auto' }}>
              <Plus size={17} /> ربط حساب الابن الآن
            </button>
          </div>
        ) : (
          <>
            {/* ── Children Selector Tabs ── */}
            <div role="tablist" aria-label="اختيار الابن" style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 6, marginBottom: 16 }} className="no-scrollbar">
              {children.map((kid) => {
                const active = selectedChildId === kid._id;
                return (
                  <button
                    key={kid._id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setSelectedChildId(kid._id)}
                    style={{
                      flex: 'none', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
                      background: active ? HQ.SURFACE : 'transparent',
                      border: active ? `2px solid ${HQ.MENTOR}` : `1px solid ${HQ.LINE}`,
                      borderRadius: 14, padding: '8px 16px 8px 10px', minHeight: 56,
                    }}
                  >
                    <HqAvatar firstName={kid.firstName} lastName={kid.lastName} size={38} />
                    <span style={{ textAlign: 'right' }}>
                      <strong style={{ display: 'block', fontSize: 14, color: HQ.INK }}>{kid.firstName} {kid.lastName}</strong>
                      <span style={{ display: 'block', fontSize: 11, color: HQ.MUTED }}>{getLevelLabel(kid.assignedLevel)}</span>
                    </span>
                  </button>
                );
              })}
            </div>

            {loadingProgress || !childProgress ? (
              <div>
                <div className="hq-skeleton" style={{ height: 160, width: '100%', marginBottom: 12 }} />
                <div className="hq-skeleton" style={{ height: 120, width: '100%' }} />
              </div>
            ) : (
              <>
                {/* ── 1. بطاقة حال الابن اليوم بلمحة واحدة ── */}
                <section
                  aria-label="حال الابن اليوم"
                  style={{ background: HQ.SURFACE, border: `1px solid ${HQ.LINE}`, borderRadius: 18, padding: 20, marginBottom: 16 }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <HqAvatar firstName={selectedChild?.firstName} lastName={selectedChild?.lastName} size={50} />
                      <div>
                        <h2 style={{ margin: 0, fontSize: 19, fontWeight: 900, color: HQ.INK }}>
                          {selectedChild?.firstName} {selectedChild?.lastName}
                        </h2>
                        <p style={{ margin: '2px 0 0', fontSize: 13, color: HQ.MUTED }}>
                          المستوى: <strong>{getLevelLabel(selectedChild?.assignedLevel)}</strong>
                          {scheduleDaysArabic ? ` · مواعيده: ${scheduleDaysArabic}` : ''}
                          {selectedChild?.sessionTime ? ` الساعة ${selectedChild.sessionTime}` : ''}
                        </p>
                      </div>
                    </div>

                    {/* Today Session Status Badge */}
                    {todayTone && (
                      <span
                        style={{
                          fontSize: 13, fontWeight: 800, color: todayTone.color, background: todayTone.bg,
                          padding: '6px 14px', borderRadius: 9999, display: 'inline-flex', alignItems: 'center', gap: 6
                        }}
                      >
                        {todayTone.label}
                      </span>
                    )}
                  </div>

                  {/* Attendance facts */}
                  <div className="hq-facts" style={{ marginBottom: childProgress.latestTeacherNote ? 14 : 0 }}>
                    <span>
                      <strong>{childProgress.attendance?.rate ?? 100}%</strong>
                      <span>نسبة الحضور ({childProgress.attendance?.attendedClasses || 0} من {childProgress.attendance?.totalClasses || 0} جلسة)</span>
                    </span>
                    <span>
                      <strong>{childProgress.todayTask?.overallStatus === 'completed' || childProgress.todayTask?.overallStatus === 'reviewed' ? 'مكتمل' : 'قيد الإنجاز'}</strong>
                      <span>ورد اليوم</span>
                    </span>
                    <span>
                      <strong>{childProgress.student?.points || 0}</strong>
                      <span>نقطة تميز</span>
                    </span>
                  </div>

                  {/* Latest Teacher Note */}
                  {childProgress.latestTeacherNote && (
                    <div style={{ margin: '14px 0 0', fontSize: 13, color: HQ.INK, background: HQ.PAPER, border: `1px solid ${HQ.LINE}`, borderRadius: 12, padding: '12px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 800, color: HQ.MENTOR, marginBottom: 4 }}>
                        <MessageSquare size={15} />
                        <span>كلمة المعلم وتوجيهه للابن:</span>
                      </div>
                      <p style={{ margin: 0, lineHeight: 1.7 }}>{childProgress.latestTeacherNote}</p>
                    </div>
                  )}

                  {/* Alerts */}
                  {childProgress.alerts?.length > 0 && (
                    <div style={{ marginTop: 14 }}>
                      {childProgress.alerts.map((alert, idx) => (
                        <div
                          key={idx}
                          role="alert"
                          style={{
                            margin: '0 0 8px', fontSize: 13, fontWeight: 700, padding: '10px 14px',
                            borderRadius: 12, background: alert.severity === 'danger' ? '#FEF2F2' : '#FFFBEB',
                            border: `1px solid ${alert.severity === 'danger' ? '#FCA5A5' : '#FCD34D'}`,
                            color: alert.severity === 'danger' ? '#B91C1C' : '#92400E',
                            display: 'flex', alignItems: 'center', gap: 8,
                          }}
                        >
                          <AlertCircle size={16} style={{ flex: 'none' }} />
                          <span><strong>{alert.title} </strong>{alert.message}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                {/* ── 2. بطاقة الورد القرآني لليوم ── */}
                <section
                  aria-label="الورد القرآني"
                  style={{ background: HQ.SURFACE, border: `1px solid ${HQ.LINE}`, borderRadius: 18, padding: 20, marginBottom: 16 }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <BookOpen size={18} color={HQ.MENTOR} />
                      <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: HQ.INK }}>الورد القرآني لليوم</h3>
                    </div>
                    {childProgress.todayTask && (
                      <span style={{ fontSize: 12, color: HQ.MUTED }}>
                        {new Date(childProgress.todayTask.date || childProgress.todayTask.createdAt).toLocaleDateString('ar-EG', { weekday: 'short', day: 'numeric', month: 'short' })}
                      </span>
                    )}
                  </div>

                  {!childProgress.todayTask ? (
                    <div style={{ textAlign: 'center', padding: '24px 16px', background: HQ.PAPER, borderRadius: 12, border: `1px dashed ${HQ.LINE}` }}>
                      <p style={{ margin: 0, fontSize: 14, color: HQ.MUTED }}>
                        لم يحدد المعلم ورداً لليوم بعد، يتم تحديث الورد أثناء أو بعد الحلقة المباشرة.
                      </p>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {/* الحفظ الجديد */}
                      {childProgress.todayTask.newHifz?.surahName && (
                        <div style={{ background: HQ.PAPER, border: `1px solid ${HQ.LINE}`, borderRadius: 12, padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                          <div>
                            <span style={{ display: 'inline-block', fontSize: 11, fontWeight: 800, color: HQ.MENTOR, background: '#E2EFE7', padding: '2px 8px', borderRadius: 6, marginBottom: 4 }}>
                              الحفظ الجديد (السبق)
                            </span>
                            <h4 style={{ margin: 0, fontSize: 15, fontWeight: 900, color: HQ.INK }}>
                              سورة {childProgress.todayTask.newHifz.surahName} · الآيات ({childProgress.todayTask.newHifz.fromVerse} - {childProgress.todayTask.newHifz.toVerse})
                            </h4>
                          </div>
                          <span style={{ fontSize: 12, fontWeight: 700, color: childProgress.todayTask.newHifz.status === 'reviewed' ? HQ.MENTOR : '#B45309' }}>
                            {childProgress.todayTask.newHifz.status === 'reviewed' ? '✅ تم التسميع والإتقان' : '⏳ قيد الحفظ والتسميع'}
                            {childProgress.todayTask.newHifz.score !== undefined && childProgress.todayTask.newHifz.score !== null && ` · الدرجة: ${childProgress.todayTask.newHifz.score}%`}
                          </span>
                        </div>
                      )}

                      {/* المراجعة القريبة */}
                      {childProgress.todayTask.nearRevision?.surahName && (
                        <div style={{ background: HQ.PAPER, border: `1px solid ${HQ.LINE}`, borderRadius: 12, padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                          <div>
                            <span style={{ display: 'inline-block', fontSize: 11, fontWeight: 800, color: '#4A3F6B', background: '#EDE9FF', padding: '2px 8px', borderRadius: 6, marginBottom: 4 }}>
                              المراجعة القريبة (السبقي)
                            </span>
                            <h4 style={{ margin: 0, fontSize: 15, fontWeight: 900, color: HQ.INK }}>
                              سورة {childProgress.todayTask.nearRevision.surahName} · الآيات ({childProgress.todayTask.nearRevision.fromVerse} - {childProgress.todayTask.nearRevision.toVerse})
                            </h4>
                          </div>
                          <span style={{ fontSize: 12, fontWeight: 700, color: childProgress.todayTask.nearRevision.status === 'reviewed' ? HQ.MENTOR : '#B45309' }}>
                            {childProgress.todayTask.nearRevision.status === 'reviewed' ? '✅ مراجعة معتمدة' : '⏳ قيد المراجعة'}
                            {childProgress.todayTask.nearRevision.score !== undefined && childProgress.todayTask.nearRevision.score !== null && ` · الدرجة: ${childProgress.todayTask.nearRevision.score}%`}
                          </span>
                        </div>
                      )}

                      {/* المراجعة البعيدة والتمكين */}
                      {childProgress.todayTask.cumulativeRevision?.surahName && (
                        <div style={{ background: HQ.PAPER, border: `1px solid ${HQ.LINE}`, borderRadius: 12, padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                          <div>
                            <span style={{ display: 'inline-block', fontSize: 11, fontWeight: 800, color: '#BA7517', background: '#FEF3E2', padding: '2px 8px', borderRadius: 6, marginBottom: 4 }}>
                              التثبيت والتمكين (المحكم)
                            </span>
                            <h4 style={{ margin: 0, fontSize: 15, fontWeight: 900, color: HQ.INK }}>
                              سورة {childProgress.todayTask.cumulativeRevision.surahName} · الآيات ({childProgress.todayTask.cumulativeRevision.fromVerse} - {childProgress.todayTask.cumulativeRevision.toVerse})
                            </h4>
                          </div>
                          <span style={{ fontSize: 12, fontWeight: 700, color: childProgress.todayTask.cumulativeRevision.status === 'reviewed' ? HQ.MENTOR : '#B45309' }}>
                            {childProgress.todayTask.cumulativeRevision.status === 'reviewed' ? '✅ تم التثبيت' : '⏳ قيد التثبيت'}
                            {childProgress.todayTask.cumulativeRevision.score !== undefined && childProgress.todayTask.cumulativeRevision.score !== null && ` · الدرجة: ${childProgress.todayTask.cumulativeRevision.score}%`}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </section>

                {/* ── 3. بطاقة الاشتراك والدفع المباشر للابن ── */}
                <section
                  aria-label="حالة الاشتراك والدفع"
                  style={{ background: HQ.SURFACE, border: `1px solid ${HQ.LINE}`, borderRadius: 18, padding: 20, marginBottom: 16 }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <CreditCard size={18} color={HQ.MENTOR} />
                      <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: HQ.INK }}>حالة الاشتراك والرسوم</h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => setPayModalOpen(true)}
                      className="hq-action"
                      style={{ background: HQ.MENTOR, color: '#fff', fontSize: 13, padding: '0 16px' }}
                    >
                      <CreditCard size={15} /> سداد / تجديد الاشتراك
                    </button>
                  </div>

                  <div style={{ background: HQ.PAPER, border: `1px solid ${HQ.LINE}`, borderRadius: 14, padding: 16, marginBottom: 14 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                      <div>
                        <span style={{ fontSize: 12, color: HQ.MUTED, display: 'block' }}>حالة الحساب الحالية:</span>
                        <strong style={{ fontSize: 16, color: childProgress.subscription?.isExpired ? '#C2410C' : HQ.INK }}>
                          {childProgress.subscription?.isExpired ? 'الاشتراك منتهي' : childProgress.subscription?.isTrial ? 'فترة تجريبية مجانية' : 'اشتراك شهري نشط'}
                        </strong>
                      </div>
                      <div style={{ textAlign: 'left' }}>
                        <span style={{ fontSize: 12, color: HQ.MUTED, display: 'block' }}>المتبقي:</span>
                        <strong style={{ fontSize: 16, color: childProgress.subscription?.daysRemaining <= 3 ? '#C2410C' : HQ.MENTOR }}>
                          {childProgress.subscription?.daysRemaining ?? 0} يوم
                        </strong>
                      </div>
                    </div>
                  </div>

                  {/* Recent Payments History */}
                  <h4 style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 800, color: HQ.INK }}>سجل المدفوعات الأخير</h4>
                  {!childProgress.recentPayments?.length ? (
                    <p style={{ fontSize: 13, color: HQ.MUTED, margin: 0 }}>لا توجد مدفوعات مسجلة بعد لهذا الطالب.</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {childProgress.recentPayments.map((p) => (
                        <div
                          key={p._id}
                          style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '8px 12px', background: HQ.PAPER, borderRadius: 10, border: `1px solid ${HQ.LINE}`, fontSize: 13
                          }}
                        >
                          <div>
                            <strong style={{ color: HQ.INK }}>{p.amount} جنيه مصري</strong>
                            <span style={{ color: HQ.MUTED, marginRight: 8, fontSize: 12 }}>
                              · {p.method === 'vodafone_cash' ? 'فودافون كاش' : 'انستاباي'}
                              {p.referenceNumber ? ` · رقم العملية: ${p.referenceNumber}` : ''}
                            </span>
                          </div>
                          <span
                            style={{
                              fontSize: 11, fontWeight: 800, padding: '2px 8px', borderRadius: 6,
                              background: p.status === 'approved' ? '#DCFCE7' : p.status === 'rejected' ? '#FEE2E2' : '#FEF3C7',
                              color: p.status === 'approved' ? '#15803D' : p.status === 'rejected' ? '#991B1B' : '#92400E'
                            }}
                          >
                            {p.status === 'approved' ? 'معتمد ومفعّل' : p.status === 'rejected' ? 'مرفوض' : 'قيد المراجعة'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                {/* ── 4. بطاقة الاختبارات وتحديد المستوى ── */}
                <section
                  aria-label="الاختبارات وتحديد المستوى"
                  style={{ background: HQ.SURFACE, border: `1px solid ${HQ.LINE}`, borderRadius: 18, padding: 20, marginBottom: 16 }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                    <Award size={18} color={HQ.MENTOR} />
                    <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: HQ.INK }}>الاختبارات والتقييمات</h3>
                  </div>

                  {!childProgress.examResults?.length ? (
                    <p style={{ fontSize: 13, color: HQ.MUTED, margin: 0 }}>لا توجد اختبارات مسجلة بعد.</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {childProgress.examResults.map((r) => (
                        <div
                          key={r._id}
                          style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
                            padding: '10px 14px', background: HQ.PAPER, borderRadius: 12, border: `1px solid ${HQ.LINE}`, flexWrap: 'wrap'
                          }}
                        >
                          <div>
                            <strong style={{ fontSize: 14, color: HQ.INK, display: 'block' }}>
                              {r.exam?.title || (r.examType === 'placement' ? 'امتحان تحديد المستوى' : 'اختبار قرآني')}
                            </strong>
                            <span style={{ fontSize: 12, color: HQ.MUTED }}>
                              {r.status !== 'reviewed' ? 'قيد مراجعة وتصحيح المعلم' : r.isPassed ? `ناجح (${r.totalPercentage || 0}%)` : `يحتاج تمكين (${r.totalPercentage || 0}%)`}
                              {r.submittedAt ? ` · ${new Date(r.submittedAt).toLocaleDateString('ar-EG', { day: 'numeric', month: 'short' })}` : ''}
                            </span>
                          </div>
                          {r.teacherNotes && (
                            <span style={{ fontSize: 12, color: HQ.MUTED, maxWidth: '50%', textAlign: 'left' }}>
                              ملاحظة: {r.teacherNotes}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                {/* ── 5. بطاقة المعلم والتواصل السريع ── */}
                <section
                  aria-label="المعلم والتواصل"
                  style={{ background: HQ.SURFACE, border: `1px solid ${HQ.LINE}`, borderRadius: 18, padding: 20, marginBottom: 16 }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <Phone size={18} color={HQ.MENTOR} />
                      <div>
                        <strong style={{ display: 'block', fontSize: 14, color: HQ.INK }}>معلم الحلقة والمتابعة</strong>
                        <span style={{ fontSize: 12, color: HQ.MUTED }}>
                          {childProgress.student?.teacher ? `${childProgress.student.teacher.firstName} ${childProgress.student.teacher.lastName}` : 'معلم معتمد من المنصة'}
                        </span>
                      </div>
                    </div>
                    <a
                      href="https://wa.me/?text=السلام%20عليكم%20معلمنا%20الفاضل،%20أود%20الاستفسار%20عن%20مستوى%20ابني%20في%20الحلقة"
                      target="_blank"
                      rel="noreferrer"
                      className="hq-action"
                      style={{ background: HQ.PAPER, border: `1px solid ${HQ.LINE}`, color: HQ.INK, fontSize: 13, textDecoration: 'none' }}
                    >
                      <MessageSquare size={15} color={HQ.MENTOR} /> تواصل عبر الواتساب
                    </a>
                  </div>
                </section>

                {/* Unlink child button */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 8 }}>
                  <button
                    type="button"
                    onClick={() => setConfirmUnlinkId(selectedChild._id)}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer', fontSize: 13,
                      fontWeight: 700, color: '#C2410C', display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 44, padding: '0 12px'
                    }}
                  >
                    <Trash2 size={15} /> إلغاء ربط {selectedChild.firstName} من حسابي
                  </button>
                </div>
              </>
            )}
          </>
        )}
      </div>

      {/* ── Modal 1: Link Child ── */}
      {linkModalOpen && (
        <div dir="rtl" style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: 'rgba(12,12,29,0.72)' }}>
          <div role="dialog" aria-modal="true" aria-label="ربط حساب الابن" style={{ background: HQ.SURFACE, borderRadius: 18, padding: 24, width: '100%', maxWidth: 430, border: `1px solid ${HQ.LINE}` }}>
            <h3 style={{ margin: '0 0 4px', fontSize: 19, fontWeight: 900, color: HQ.INK }}>ربط حساب الابن</h3>
            <p style={{ margin: '0 0 16px', fontSize: 13, color: HQ.MUTED, lineHeight: 1.7 }}>
              اختر طريقة الربط الأنسب لك لمتابعة حضور ابنك والورد القرآني فوراً.
            </p>

            {/* Mode Tabs */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 18 }}>
              <button
                type="button"
                onClick={() => setLinkMode('code')}
                style={{
                  padding: '9px 10px', borderRadius: 10, cursor: 'pointer', textAlign: 'center', fontSize: 13, fontWeight: 800,
                  border: linkMode === 'code' ? `2px solid ${HQ.MENTOR}` : `1px solid ${HQ.LINE}`,
                  background: linkMode === 'code' ? '#E2EFE7' : HQ.PAPER,
                  color: linkMode === 'code' ? HQ.MENTOR_DEEP : HQ.INK
                }}
              >
                ⚡ رمز الربط (الأسرع)
              </button>
              <button
                type="button"
                onClick={() => setLinkMode('email')}
                style={{
                  padding: '9px 10px', borderRadius: 10, cursor: 'pointer', textAlign: 'center', fontSize: 13, fontWeight: 800,
                  border: linkMode === 'email' ? `2px solid ${HQ.MENTOR}` : `1px solid ${HQ.LINE}`,
                  background: linkMode === 'email' ? '#E2EFE7' : HQ.PAPER,
                  color: linkMode === 'email' ? HQ.MENTOR_DEEP : HQ.INK
                }}
              >
                ✉️ بالبريد الإلكتروني
              </button>
            </div>

            <form onSubmit={handleLinkChild}>
              {linkMode === 'code' ? (
                <div style={{ marginBottom: 18 }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 800, color: HQ.INK, marginBottom: 6 }} htmlFor="link-code">
                    رمز ربط ولي الأمر (6 أرقام) *
                  </label>
                  <input
                    id="link-code"
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    required
                    value={linkCode}
                    onChange={(e) => setLinkCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="مثال: 748920"
                    dir="ltr"
                    style={{
                      width: '100%', padding: '12px 14px', borderRadius: 12, border: `2px solid ${HQ.LINE}`,
                      background: HQ.PAPER, fontSize: 22, fontWeight: 900, color: HQ.MENTOR_DEEP, textAlign: 'center',
                      letterSpacing: '0.35em', minHeight: 52
                    }}
                  />
                  <p style={{ margin: '8px 0 0', fontSize: 12, color: HQ.MUTED, lineHeight: 1.6 }}>
                    💡 يجد الابن هذا الرمز في لوحة تحكم حسابه، أو يمكنه إرساله لك بنقرة واحدة عبر الواتساب.
                  </p>
                </div>
              ) : (
                <>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 800, color: HQ.INK, marginBottom: 6 }} htmlFor="link-email">
                    البريد الإلكتروني للابن *
                  </label>
                  <div style={{ position: 'relative', marginBottom: 12 }}>
                    <Mail size={16} color={HQ.MUTED} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)' }} />
                    <input
                      id="link-email"
                      type="email"
                      required
                      value={childEmail}
                      onChange={(e) => setChildEmail(e.target.value)}
                      placeholder="student@quran.com"
                      dir="ltr"
                      style={{ width: '100%', padding: '12px 38px 12px 12px', borderRadius: 12, border: `1px solid ${HQ.LINE}`, background: HQ.SURFACE, fontSize: 14, color: HQ.INK, minHeight: 48 }}
                    />
                  </div>

                  <label style={{ display: 'block', fontSize: 13, fontWeight: 800, color: HQ.INK, marginBottom: 6 }} htmlFor="link-phone">
                    رقم هاتف الابن المسجل (اختياري للتحقق الإضافي)
                  </label>
                  <div style={{ position: 'relative', marginBottom: 16 }}>
                    <Phone size={16} color={HQ.MUTED} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)' }} />
                    <input
                      id="link-phone"
                      type="tel"
                      value={childPhone}
                      onChange={(e) => setChildPhone(e.target.value)}
                      placeholder="010xxxxxxxx"
                      dir="ltr"
                      style={{ width: '100%', padding: '12px 38px 12px 12px', borderRadius: 12, border: `1px solid ${HQ.LINE}`, background: HQ.SURFACE, fontSize: 14, color: HQ.INK, minHeight: 48 }}
                    />
                  </div>
                </>
              )}

              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="submit"
                  disabled={linking || (linkMode === 'code' ? !linkCode.trim() : !childEmail.trim())}
                  className="hq-action"
                  style={{
                    flex: 1, background: HQ.MENTOR, color: '#fff', fontSize: 14,
                    opacity: (linking || (linkMode === 'code' ? !linkCode.trim() : !childEmail.trim())) ? 0.5 : 1
                  }}
                >
                  {linking ? 'جارٍ الربط...' : 'تأكيد الربط'}
                </button>
                <button
                  type="button"
                  onClick={() => { setLinkModalOpen(false); setLinkCode(''); setChildEmail(''); setChildPhone(''); }}
                  className="hq-action"
                  style={{ flex: 1, background: HQ.PAPER, border: `1px solid ${HQ.LINE}`, color: HQ.INK, fontSize: 14 }}
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal 2: Pay For Child (سداد اشتراك الابن) ── */}
      {payModalOpen && selectedChild && (
        <div dir="rtl" style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: 'rgba(12,12,29,0.72)', overflowY: 'auto' }}>
          <div role="dialog" aria-modal="true" aria-label="سداد اشتراك الابن" style={{ background: HQ.SURFACE, borderRadius: 18, padding: 24, width: '100%', maxWidth: 480, border: `1px solid ${HQ.LINE}`, maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ margin: '0 0 4px', fontSize: 19, fontWeight: 900, color: HQ.INK }}>
              سداد اشتراك: {selectedChild.firstName} {selectedChild.lastName}
            </h3>
            <p style={{ margin: '0 0 16px', fontSize: 13, color: HQ.MUTED }}>
              اختر مدة الاشتراك وطريقة التحويل ثم أرفق صورة الإيصال ليتم التفعيل الفوري.
            </p>

            <form onSubmit={handlePayForChildSubmit}>
              {/* Duration selection */}
              <label style={{ display: 'block', fontSize: 13, fontWeight: 800, color: HQ.INK, marginBottom: 8 }}>
                مدة الاشتراك المطلوبة
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 16 }}>
                {[
                  { key: 'monthly', label: 'شهر واحد', price: calculateCyclePrice('monthly') },
                  { key: 'quarterly', label: '3 شهور', price: calculateCyclePrice('quarterly') },
                  { key: 'annual', label: 'سنة كاملة', price: calculateCyclePrice('annual') },
                ].map(cycle => (
                  <button
                    key={cycle.key}
                    type="button"
                    onClick={() => setBillingCycle(cycle.key)}
                    style={{
                      padding: '10px 8px', borderRadius: 12, textAlign: 'center', cursor: 'pointer',
                      border: billingCycle === cycle.key ? `2px solid ${HQ.MENTOR}` : `1px solid ${HQ.LINE}`,
                      background: billingCycle === cycle.key ? '#E2EFE7' : HQ.PAPER,
                    }}
                  >
                    <strong style={{ display: 'block', fontSize: 13, color: HQ.INK }}>{cycle.label}</strong>
                    <span style={{ fontSize: 12, fontWeight: 800, color: HQ.MENTOR }}>{cycle.price} ج.م</span>
                  </button>
                ))}
              </div>

              {/* Payment Method */}
              <label style={{ display: 'block', fontSize: 13, fontWeight: 800, color: HQ.INK, marginBottom: 8 }}>
                طريقة التحويل
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('vodafone_cash')}
                  style={{
                    padding: '10px 8px', borderRadius: 12, textAlign: 'center', cursor: 'pointer',
                    border: paymentMethod === 'vodafone_cash' ? `2px solid ${HQ.MENTOR}` : `1px solid ${HQ.LINE}`,
                    background: paymentMethod === 'vodafone_cash' ? '#E2EFE7' : HQ.PAPER,
                    fontSize: 13, fontWeight: 800, color: HQ.INK
                  }}
                >
                  فودافون كاش
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('instapay')}
                  style={{
                    padding: '10px 8px', borderRadius: 12, textAlign: 'center', cursor: 'pointer',
                    border: paymentMethod === 'instapay' ? `2px solid ${HQ.MENTOR}` : `1px solid ${HQ.LINE}`,
                    background: paymentMethod === 'instapay' ? '#E2EFE7' : HQ.PAPER,
                    fontSize: 13, fontWeight: 800, color: HQ.INK
                  }}
                >
                  انستاباي (InstaPay)
                </button>
              </div>

              {/* Instructions box */}
              <div style={{ background: HQ.PAPER, border: `1px solid ${HQ.LINE}`, borderRadius: 12, padding: 12, fontSize: 12, color: HQ.INK, marginBottom: 16, lineHeight: 1.7 }}>
                {paymentMethod === 'vodafone_cash' ? (
                  <>
                    <strong>رقم التحويل (فودافون كاش): </strong>
                    <code style={{ direction: 'ltr', display: 'inline-block', fontWeight: 800, color: HQ.MENTOR }}>
                      {paymentConfig?.methods?.vodafoneCash?.numbers?.[0] || '01012345678'}
                    </code>
                    <br />
                    <span>حوّل المبلغ المحدد ({calculateCyclePrice(billingCycle)} ج.م) ثم التقط لقطة شاشة للإيصال.</span>
                  </>
                ) : (
                  <>
                    <strong>عنوان الدفع (انستاباي): </strong>
                    <code style={{ direction: 'ltr', display: 'inline-block', fontWeight: 800, color: HQ.MENTOR }}>
                      {paymentConfig?.methods?.instaPay?.address || 'quran-academy@instapay'}
                    </code>
                    <br />
                    <span>حوّل المبلغ المحدد ({calculateCyclePrice(billingCycle)} ج.م) ثم التقط لقطة شاشة للإيصال.</span>
                  </>
                )}
              </div>

              {/* Receipt File */}
              <label style={{ display: 'block', fontSize: 13, fontWeight: 800, color: HQ.INK, marginBottom: 6 }}>
                صورة إيصال التحويل *
              </label>
              <div style={{ marginBottom: 14 }}>
                <input
                  type="file"
                  id="parent-receipt-upload"
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  onChange={handleReceiptChange}
                  style={{ display: 'none' }}
                />
                <label
                  htmlFor="parent-receipt-upload"
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    border: `1.5px dashed ${receiptFile ? HQ.MENTOR : HQ.LINE}`, borderRadius: 12,
                    padding: 14, background: HQ.PAPER, cursor: 'pointer', textAlign: 'center'
                  }}
                >
                  {receiptPreviewUrl ? (
                    <img src={receiptPreviewUrl} alt="الإيصال" style={{ maxHeight: 110, borderRadius: 8, marginBottom: 8 }} />
                  ) : (
                    <Upload size={22} color={HQ.MENTOR} style={{ marginBottom: 6 }} />
                  )}
                  <span style={{ fontSize: 13, fontWeight: 700, color: HQ.INK }}>
                    {receiptFile ? receiptFile.name : 'اضغط لاختيار صورة الإيصال من جهازك'}
                  </span>
                </label>
              </div>

              {/* Sender Name / Phone / Ref */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: HQ.INK, marginBottom: 4 }}>
                    رقم هاتف المحوّل
                  </label>
                  <input
                    type="tel"
                    value={senderPhone}
                    onChange={(e) => setSenderPhone(e.target.value)}
                    placeholder="010xxxxxxxx"
                    style={{ width: '100%', padding: '10px', borderRadius: 10, border: `1px solid ${HQ.LINE}`, background: HQ.SURFACE, fontSize: 13, color: HQ.INK }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: HQ.INK, marginBottom: 4 }}>
                    رقم العملية (إن وجد)
                  </label>
                  <input
                    type="text"
                    value={referenceNumber}
                    onChange={(e) => setReferenceNumber(e.target.value)}
                    placeholder="Ref #12345"
                    style={{ width: '100%', padding: '10px', borderRadius: 10, border: `1px solid ${HQ.LINE}`, background: HQ.SURFACE, fontSize: 13, color: HQ.INK }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                <button
                  type="submit"
                  disabled={submittingPayment || !receiptFile}
                  className="hq-action"
                  style={{ flex: 1, background: HQ.MENTOR, color: '#fff', fontSize: 14, opacity: (submittingPayment || !receiptFile) ? 0.5 : 1 }}
                >
                  {submittingPayment ? 'جارٍ الإرسال...' : `إرسال سداد (${calculateCyclePrice(billingCycle)} ج.م)`}
                </button>
                <button
                  type="button"
                  onClick={() => { setPayModalOpen(false); setReceiptFile(null); setReceiptPreviewUrl(''); }}
                  className="hq-action"
                  style={{ flex: 1, background: HQ.PAPER, border: `1px solid ${HQ.LINE}`, color: HQ.INK, fontSize: 14 }}
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal 3: Unlink Confirm ── */}
      {confirmUnlinkId && (
        <div dir="rtl" style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: 'rgba(12,12,29,0.72)' }}>
          <div role="dialog" aria-modal="true" aria-label="تأكيد إلغاء الربط" style={{ background: HQ.SURFACE, borderRadius: 18, padding: 24, width: '100%', maxWidth: 380, border: `1px solid ${HQ.LINE}`, textAlign: 'center' }}>
            <AlertCircle size={36} color="#C2410C" style={{ margin: '0 auto 12px' }} />
            <h3 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 900, color: HQ.INK }}>إلغاء ربط الحساب؟</h3>
            <p style={{ margin: '0 0 20px', fontSize: 13, color: HQ.MUTED, lineHeight: 1.8 }}>
              لن تتمكن بعد الآن من متابعة حضور وورد واشتراك هذا الابن.
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={handleUnlinkChild}
                disabled={unlinking}
                className="hq-action"
                style={{ flex: 1, background: '#C2410C', color: '#fff', fontSize: 14, opacity: unlinking ? 0.5 : 1 }}
              >
                {unlinking ? 'جارٍ الإلغاء...' : 'نعم، إلغاء الربط'}
              </button>
              <button
                type="button"
                onClick={() => setConfirmUnlinkId(null)}
                className="hq-action"
                style={{ flex: 1, background: HQ.PAPER, border: `1px solid ${HQ.LINE}`, color: HQ.INK, fontSize: 14 }}
              >
                تراجع
              </button>
            </div>
          </div>
        </div>
      )}
    </PageLayout>
  );
}
