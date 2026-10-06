import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Radio, Calendar, X, Clock, Check, Eye,
  ClipboardList, BookOpen, CreditCard, Video,
  RefreshCw, AlertTriangle, CalendarCheck2, CircleCheck,
  Inbox, ChevronLeft,
} from 'lucide-react';
import toast from 'react-hot-toast';
import PageLayout from '../../components/shared/PageLayout';
import api from '../../services/api';
import { getLevelLabel, formatDateAr, formatTime12Ar, timeAgoAr } from '../../utils/helpers';
import { resolveSurveyAnswer } from '../../utils/surveyDisplay';
import { notifySubscriptionWarning, fetchSubscriptionWarning, isBlockingWarning } from '../../utils/subscriptionWarning';
import ConfirmModal from '../../components/shared/ConfirmModal';
import StudentLessonsModal from '../../components/shared/StudentLessonsModal';
import LoadingSpinner from '../../components/shared/LoadingSpinner';
import PhoneChip from '../../components/shared/PhoneChip';
import SessionTimePicker from '../../components/shared/SessionTimePicker';
import WirdAssignModal from '../../components/shared/WirdAssignModal';
import '../../components/halaqa/halaqa.css';
import { HQ, HqAvatar, HqBadge } from '../../components/halaqa/primitives';

/* لوحة اليوم — صفحة بداية الأدمن: حصص اليوم + اشتراكات منتظرة + طلاب منتظرون،
   كلها بإجراءات داخلية (بث/ورد/جدولة/مراجعة/قبول/رفض) دون مغادرة الصفحة. */

const WEEK_DAYS = ['السبت', 'الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة'];
const JS_DAY_TO_AR = { 0: 'الأحد', 1: 'الاثنين', 2: 'الثلاثاء', 3: 'الأربعاء', 4: 'الخميس', 5: 'الجمعة', 6: 'السبت' };
const SESSION_WINDOW_MIN = 60;
const PREVIEW_LIMIT = 5;

const toMinutes = (t) => {
  if (!t || typeof t !== 'string') return null;
  const [h, m] = t.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
};

const isWaiting = (u) =>
  u.role === 'student' &&
  (u.isApproved === false || !u.assignedLevel || !(u.scheduleDays?.length));

/* غلاف مودال موحد: dialog دلالي + إغلاق بالـ Escape + إغلاق بالنقر خارج البطاقة */
function Modal({ title, onClose, children, maxWidth = 500, labelledBy }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(12,12,29,0.55)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
    >
      <div
        role="dialog" aria-modal="true" aria-labelledby={labelledBy}
        style={{ background: HQ.SURFACE, borderRadius: 20, padding: 24, maxWidth, width: '100%', border: `1px solid ${HQ.LINE}`, maxHeight: '90vh', overflowY: 'auto' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          <h3 id={labelledBy} style={{ margin: 0, fontSize: 18, fontWeight: 900, color: HQ.INK }}>{title}</h3>
          <button type="button" onClick={onClose} aria-label="إغلاق النافذة" className="hq-action"
            style={{ background: HQ.PAPER, border: `1px solid ${HQ.LINE}`, color: HQ.MUTED, minWidth: 44, minHeight: 44, padding: 0 }}>
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function EmptyState({ icon: Icon, title, hint, actionLabel, onAction }) {
  return (
    <div style={{ background: HQ.SURFACE, border: `1px solid ${HQ.LINE}`, borderRadius: 16, padding: 24, textAlign: 'center' }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 48, height: 48, borderRadius: 9999, background: HQ.MENTOR_WASH, marginBottom: 12 }}>
        <Icon size={22} color={HQ.MENTOR} />
      </span>
      <p style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 900, color: HQ.INK }}>{title}</p>
      {hint && <p style={{ margin: '0 0 14px', fontSize: 13, color: HQ.MUTED, lineHeight: 1.8 }}>{hint}</p>}
      {actionLabel && (
        <button type="button" onClick={onAction} className="hq-action"
          style={{ background: HQ.PAPER, border: `1px solid ${HQ.LINE}`, color: HQ.MENTOR, fontSize: 14, padding: '0 20px' }}>
          {actionLabel}
        </button>
      )}
    </div>
  );
}

export default function TodayDashboardPage() {
  const navigate = useNavigate();
  const [now, setNow] = useState(() => new Date());
  const [isLoading, setIsLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [students, setStudents] = useState([]);
  const [payments, setPayments] = useState([]);
  const [paymentsTotal, setPaymentsTotal] = useState(0);
  const [actingId, setActingId] = useState(null);

  // Schedule modal
  const [scheduleUser, setScheduleUser] = useState(null);
  const [scheduleForm, setScheduleForm] = useState({ assignedLevel: 'foundation', scheduleDays: [], sessionTime: '18:00' });

  // Live modal
  const [liveUser, setLiveUser] = useState(null);
  const [liveForm, setLiveForm] = useState({ title: '', resources: '', description: '' });
  // Pre-start subscription confirm: { u, payload, warning } — null when idle
  const [subConfirm, setSubConfirm] = useState(null);

  // Student lessons modal (shared component — same UX as Users section)
  const [lessonsModalUser, setLessonsModalUser] = useState(null);

  // Review modal
  const [reviewUser, setReviewUser] = useState(null);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewData, setReviewData] = useState({ surveyAnswers: [], audioList: [], writtenPercentage: null });

  // Wird modal
  const [wirdUser, setWirdUser] = useState(null);

  // Payment modals
  const [approvePayment, setApprovePayment] = useState(null);
  const [customDays, setCustomDays] = useState(30);
  const [rejectPayment, setRejectPayment] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const fetchAll = useCallback(async (quiet = false) => {
    if (!quiet) { setIsLoading(true); setLoadFailed(false); }
    try {
      const [stuRes, payRes] = await Promise.all([
        api.get('/users/students/list'),
        api.get('/payments/admin/all', { params: { status: 'pending', page: 1, limit: 20 } }),
      ]);
      setStudents(stuRes.data.students || []);
      setPayments(payRes.data.payments || []);
      setPaymentsTotal(payRes.data.pagination?.total ?? payRes.data.stats?.pendingCount ?? (payRes.data.payments || []).length);
      setLoadFailed(false);
      setLastUpdated(new Date());
    } catch {
      if (!quiet) { setLoadFailed(true); } else { /* keep stale data on background refresh */ }
      if (!quiet) toast.error('خطأ في جلب بيانات اليوم');
    } finally {
      if (!quiet) setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(false); }, [fetchAll]);
  useEffect(() => {
    const id = setInterval(() => { setNow(new Date()); fetchAll(true); }, 60000);
    return () => clearInterval(id);
  }, [fetchAll]);

  const todayName = JS_DAY_TO_AR[now.getDay()];
  const nowMin = now.getHours() * 60 + now.getMinutes();

  // حصص اليوم مرتبة زمنياً
  const todaySessions = students
    .filter(u => (u.scheduleDays || []).includes(todayName) && u.sessionTime && toMinutes(u.sessionTime) !== null)
    .map(u => {
      const mins = toMinutes(u.sessionTime);
      const status = (nowMin >= mins && nowMin < mins + SESSION_WINDOW_MIN) ? 'now' : (nowMin < mins ? 'upcoming' : 'passed');
      return { student: u, mins, status };
    })
    .sort((a, b) => a.mins - b.mins);

  const nowCount = todaySessions.filter(e => e.status === 'now').length;
  const waitingSorted = students
    .filter(isWaiting)
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  const waitingList = waitingSorted.slice(0, PREVIEW_LIMIT);
  const waitingTotal = waitingSorted.length;
  const todayExtra = Math.max(0, todaySessions.length - PREVIEW_LIMIT);
  const paymentsExtra = Math.max(0, paymentsTotal - PREVIEW_LIMIT);
  const waitingExtra = Math.max(0, waitingTotal - PREVIEW_LIMIT);

  // ── بدء بث (يفحص الاشتراك أولاً، ويطلب تأكيداً عند انتهائه/غيابه) ──
  const handleConfirmLive = async () => {
    if (!liveUser || actingId) return;
    const u = liveUser;
    const payload = {};
    if (liveForm.title?.trim()) payload.title = liveForm.title.trim();
    if (liveForm.resources?.trim()) payload.resources = liveForm.resources.trim();
    if (liveForm.description?.trim()) payload.description = liveForm.description.trim();
    const warning = await fetchSubscriptionWarning(u._id);
    if (isBlockingWarning(warning)) {
      setSubConfirm({ u, payload, warning });
      return;
    }
    if (warning) notifySubscriptionWarning(warning); // expiring_soon: info only
    await doStartLive(u, payload);
  };

  const doStartLive = async (u, payload) => {
    setActingId(u._id);
    try {
      const res = await api.post(`/live/student/${u._id}/start`, payload);
      toast.success('تم إنشاء الدرس وبدء البث المباشر مع الطالب');
      setLiveUser(null);
      setSubConfirm(null);
      navigate('/admin/live', {
        state: {
          sessionId: res.data.session._id,
          studentId: u._id,
          studentName: `${u.firstName} ${u.lastName}`,
          lessonId: res.data.lessonId,
          lessonTitle: res.data.session.title,
          isIndividual: true,
        },
      });
    } catch (err) {
      toast.error(err?.response?.data?.message || 'خطأ في بدء البث المباشر');
    } finally { setActingId(null); }
  };

  // ── جدولة ──
  const openSchedule = (u) => {
    setScheduleUser(u);
    setScheduleForm({
      assignedLevel: u.assignedLevel || 'foundation',
      scheduleDays: Array.isArray(u.scheduleDays) && u.scheduleDays.length ? u.scheduleDays : ['السبت', 'الثلاثاء'],
      sessionTime: u.sessionTime || '18:00',
    });
  };

  const scheduleConflicts = (excludeId, days, time) => {
    if (!time || !days?.length) return [];
    return students.filter(s =>
      s._id !== excludeId &&
      (s.scheduleDays || []).some(d => days.includes(d)) &&
      s.sessionTime === time
    );
  };

  const handleSaveSchedule = async () => {
    if (!scheduleUser) return;
    if (!scheduleForm.scheduleDays.length) return toast.error('حدد يوماً واحداً على الأقل');
    const clashes = scheduleConflicts(scheduleUser._id, scheduleForm.scheduleDays, scheduleForm.sessionTime);
    if (clashes.length) {
      const c = clashes[0];
      const day = (c.scheduleDays || []).find(d => scheduleForm.scheduleDays.includes(d));
      return toast.error(`تعارض: ${c.firstName} ${c.lastName} محجوز يوم ${day} الساعة ${formatTime12Ar(c.sessionTime)}`);
    }
    setActingId(scheduleUser._id);
    try {
      await api.put(`/users/${scheduleUser._id}/approve`, scheduleForm);
      toast.success('تم حفظ المستوى والمواعيد واعتماد الطالب بنجاح');
      setScheduleUser(null);
      await fetchAll(true);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'خطأ في الحفظ');
    } finally { setActingId(null); }
  };

  // ── مراجعة ──
  const openReview = async (u) => {
    setReviewUser(u);
    setReviewLoading(true);
    setReviewData({ surveyAnswers: [], audioList: [], writtenPercentage: null });
    try {
      const [userRes, examRes] = await Promise.all([
        api.get(`/users/${u._id}`).catch(() => null),
        api.get(`/exams/results/student/${u._id}`).catch(() => null),
      ]);
      const full = userRes?.data?.user || u;
      const results = examRes?.data?.results || [];
      let placement = null;
      for (const r of results) {
        const isPlacement = r.examType === 'placement' || r.examType === 'oral' || r.exam?.type === 'placement';
        if (!isPlacement) continue;
        if (!placement || (!placement.oralRecordings?.length && r.oralRecordings?.length)) placement = r;
      }
      let surveyAnswers = placement?.surveyAnswers || [];
      if (!surveyAnswers.length && Array.isArray(full.surveyAnswers)) surveyAnswers = full.surveyAnswers;
      const audioSet = new Set();
      (placement?.oralRecordings || []).forEach(rec => { if (rec?.audioUrl) audioSet.add(rec.audioUrl); });
      (full.oralExamRecordings || []).forEach(url => { if (url) audioSet.add(url); });
      setReviewData({
        surveyAnswers,
        audioList: [...audioSet],
        writtenPercentage: placement?.writtenPercentage ?? full.placementExamScore ?? null,
      });
    } catch {
      toast.error('تعذر جلب ملف المراجعة');
    } finally { setReviewLoading(false); }
  };

  // ── اشتراكات ──
  const handleApprove = async () => {
    if (!approvePayment) return;
    setActionLoading(true);
    try {
      const res = await api.post(`/payments/admin/${approvePayment._id}/approve`, { customDurationDays: customDays });
      toast.success(res.data?.message || 'تم الاعتماد والتفعيل بنجاح!');
      setApprovePayment(null);
      await fetchAll(true);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'خطأ في الاعتماد');
    } finally { setActionLoading(false); }
  };

  const handleReject = async () => {
    if (!rejectPayment) return;
    if (!rejectReason.trim()) return toast.error('يرجى ذكر سبب الرفض');
    setActionLoading(true);
    try {
      const res = await api.post(`/payments/admin/${rejectPayment._id}/reject`, { reason: rejectReason });
      toast.success(res.data?.message || 'تم الرفض وإشعار الطالب');
      setRejectPayment(null);
      setRejectReason('');
      await fetchAll(true);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'خطأ في الرفض');
    } finally { setActionLoading(false); }
  };

  const selectStyle = {
    background: HQ.SURFACE, border: `1px solid ${HQ.LINE}`, borderRadius: 12,
    padding: '0 12px', minHeight: 48, fontSize: 14, color: HQ.INK, fontFamily: 'inherit',
    boxSizing: 'border-box',
  };

  const statCard = (label, value, tone, targetId, hint) => (
    <button type="button" onClick={() => scrollTo(targetId)}
      aria-label={`${label}: ${value} — اضغط للانتقال إلى القسم`}
      style={{ flex: '1 1 0', minWidth: 140, background: HQ.SURFACE, border: `1px solid ${HQ.LINE}`, borderRadius: 18, padding: '14px 16px', minHeight: 88, cursor: 'pointer', textAlign: 'right', fontFamily: 'inherit', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 2 }}>
      <span className="m-stat-num" style={{ display: 'block', margin: 0, fontSize: 28, fontWeight: 900, color: tone, fontVariantNumeric: 'tabular-nums', lineHeight: 1.2 }}>{value}</span>
      <span style={{ display: 'block', margin: 0, fontSize: 13, fontWeight: 700, color: HQ.MUTED }}>{label}</span>
      {hint ? <span style={{ display: 'block', margin: '2px 0 0', fontSize: 12, fontWeight: 700, color: HQ.MENTOR }}>عرض القسم</span> : null}
    </button>
  );

  const scrollTo = (id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1');
    el.focus({ preventScroll: true });
  };

  const sectionHead = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 8 };
  const h2Style = { margin: 0, fontSize: 18, fontWeight: 900, color: HQ.INK, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' };
  const ghostBtn = { background: HQ.PAPER, border: `1px solid ${HQ.LINE}`, color: HQ.MENTOR, fontSize: 13, padding: '0 14px', display: 'inline-flex', alignItems: 'center', gap: 6, textDecoration: 'none' };
  const rowCard = (highlight) => ({
    background: highlight ? HQ.MENTOR_WASH : HQ.SURFACE,
    border: `1px solid ${highlight ? HQ.MENTOR : HQ.LINE}`,
    borderRadius: 16, marginBottom: 10, padding: 12,
  });

  return (
    <PageLayout>
      <div className="halaqa m-page-pad" style={{ maxWidth: 860, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 4 }}>
          <div style={{ flex: '1 1 220px', minWidth: 0 }}>
            <h1 style={{ margin: '0 0 4px', fontSize: 26, fontWeight: 900, color: HQ.INK, lineHeight: 1.4 }}>لوحة اليوم</h1>
            <p style={{ margin: 0, fontSize: 14, color: HQ.MUTED, lineHeight: 1.8 }}>
              {todayName} · {formatDateAr(now, 'd MMMM yyyy')} · شغل اليوم كله من هنا: حصص واشتراكات وطلاب منتظرون
            </p>
          </div>
          <button type="button" onClick={() => fetchAll(false)} disabled={isLoading} className="hq-action"
            aria-label="تحديث بيانات اليوم"
            style={{ background: HQ.SURFACE, border: `1px solid ${HQ.LINE}`, color: HQ.MENTOR, fontSize: 13, padding: '0 14px', opacity: isLoading ? 0.6 : 1, flex: 'none' }}>
            <RefreshCw size={15} /> تحديث
          </button>
        </div>
        {lastUpdated && !isLoading && !loadFailed && (
          <p style={{ margin: '0 0 16px', fontSize: 12, color: HQ.MUTED }}>
            آخر تحديث: {formatTime12Ar(`${String(lastUpdated.getHours()).padStart(2, '0')}:${String(lastUpdated.getMinutes()).padStart(2, '0')}`)} · يتحدث تلقائياً كل دقيقة
          </p>
        )}
        {(isLoading || (!isLoading && !loadFailed)) && lastUpdated === null && !isLoading ? null : null}

        {isLoading ? (
          <div aria-label="جارٍ التحميل">
            <div className="hq-skeleton" style={{ height: 90, width: '100%', marginBottom: 12 }} />
            <div className="hq-skeleton" style={{ height: 120, width: '100%', marginBottom: 12 }} />
            <div className="hq-skeleton" style={{ height: 120, width: '100%' }} />
          </div>
        ) : loadFailed ? (
          <div role="alert" style={{ background: HQ.SURFACE, border: `1px solid ${HQ.LINE}`, borderRadius: 18, padding: 32, textAlign: 'center' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 48, height: 48, borderRadius: 9999, background: HQ.ERROR_WASH, marginBottom: 12 }}>
              <AlertTriangle size={22} color={HQ.ERROR} />
            </span>
            <p style={{ margin: '0 0 4px', fontSize: 17, fontWeight: 900, color: HQ.INK }}>تعذّر تحميل بيانات اليوم</p>
            <p style={{ margin: '0 0 20px', fontSize: 14, color: HQ.MUTED }}>تحقق من الاتصال ثم حاول مرة أخرى — لن تضيع أي بيانات محفوظة.</p>
            <button type="button" onClick={() => fetchAll(false)} className="hq-action" style={{ background: HQ.MENTOR, color: '#fff', padding: '0 24px', fontSize: 15 }}>
              <RefreshCw size={16} /> إعادة المحاولة
            </button>
          </div>
        ) : (
          <>
            {/* Stat cards */}
            <div role="navigation" aria-label="أقسام اليوم" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
              {statCard('حصص اليوم', todaySessions.length, nowCount ? HQ.MENTOR : HQ.INK, 'today-sessions', true)}
              {statCard('اشتراكات منتظرة', paymentsTotal, paymentsTotal ? HQ.WARNING : HQ.INK, 'today-payments', true)}
              {statCard('طلاب منتظرون', waitingTotal, waitingTotal ? HQ.WARNING : HQ.INK, 'today-waiting', true)}
            </div>

            {/* Today's sessions */}
            <section id="today-sessions" aria-label="حصص اليوم" style={{ marginBottom: 24, scrollMarginTop: 84 }}>
              <div style={sectionHead}>
                <h2 style={h2Style}>
                  حصص اليوم ({todaySessions.length})
                  {nowCount > 0 && (
                    <HqBadge tone="mentor">
                      <span className="hq-live-dot" aria-hidden style={{ background: HQ.MENTOR }} />
                      {nowCount} حان موعدها
                    </HqBadge>
                  )}
                </h2>
                <button type="button" onClick={() => navigate('/admin/schedule')} className="hq-action" style={ghostBtn}>
                  <Video size={15} /> كل المواعيد
                </button>
              </div>
              {todaySessions.length === 0 ? (
                <EmptyState icon={CalendarCheck2} title="لا حصص مجدولة اليوم"
                  hint="جدول اليوم فارغ — راجع مواعيد الأسبوع أو جدوِل طالباً منتظراً."
                  actionLabel="فتح جدول المواعيد" onAction={() => navigate('/admin/schedule')} />
              ) : (
                <>
                  <ol style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                    {todaySessions.slice(0, PREVIEW_LIMIT).map(({ student: u, status }) => {
                      const isNow = status === 'now';
                      const isPassed = status === 'passed';
                      return (
                        <li key={u._id} style={rowCard(isNow)} aria-current={isNow ? 'true' : undefined}>
                          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                            <HqAvatar firstName={u.firstName} lastName={u.lastName} size={40} ring={isNow} />
                            <div style={{ flex: 1, minWidth: 150 }}>
                              <strong style={{ fontSize: 15, color: HQ.INK }}>{u.firstName} {u.lastName}</strong>
                              <p style={{ margin: '2px 0 0', fontSize: 13, color: HQ.MUTED, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                <span>الساعة <strong style={{ color: isNow ? HQ.MENTOR_DEEP : HQ.INK }}>{formatTime12Ar(u.sessionTime)}</strong></span>
                                {u.assignedLevel ? <HqBadge tone="guide">{getLevelLabel(u.assignedLevel)}</HqBadge> : <HqBadge tone="neutral">بدون مستوى</HqBadge>}
                                {isNow
                                  ? <HqBadge tone="mentor">تُبث الآن</HqBadge>
                                  : isPassed ? <HqBadge tone="neutral">انتهت</HqBadge> : <HqBadge tone="neutral">قادمة</HqBadge>}
                              </p>
                            </div>
                            <div className="m-today-actions" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                              <button type="button" onClick={() => { setLiveUser(u); setLiveForm({ title: '', resources: '', description: '' }); }}
                                disabled={actingId === u._id} className="hq-action m-primary"
                                aria-label={isNow ? `ابدأ البث الآن مع ${u.firstName} ${u.lastName}` : `بدء بث مع ${u.firstName} ${u.lastName}`}
                                style={{ background: HQ.MENTOR, color: '#fff', padding: '0 14px', fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 5, opacity: actingId === u._id ? 0.6 : 1 }}>
                                <Radio size={15} /> {isNow ? 'ابدأ الآن' : 'بدء بث'}
                              </button>
                              <button type="button" onClick={() => setWirdUser(u)} className="hq-action"
                                aria-label={`تعيين الورد لـ ${u.firstName} ${u.lastName}`}
                                style={{ background: HQ.PAPER, border: `1px solid ${HQ.LINE}`, color: HQ.INK, padding: '0 14px', fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                                <BookOpen size={15} /> الورد
                              </button>
                              <button type="button" onClick={() => setLessonsModalUser(u)} className="hq-action"
                                aria-label={`عرض دروس ${u.firstName} ${u.lastName}`}
                                style={{ background: HQ.SURFACE, border: `1px solid ${HQ.LINE}`, color: HQ.MENTOR, padding: '0 14px', fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 5, fontWeight: 800 }}>
                                <ClipboardList size={15} /> الدروس
                              </button>
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                  {todayExtra > 0 && (
                    <button type="button" onClick={() => navigate('/admin/schedule')} className="hq-action"
                      style={{ width: '100%', background: HQ.SURFACE, border: `1px dashed ${HQ.LINE}`, color: HQ.MENTOR, fontSize: 14, marginTop: 2 }}>
                      + {todayExtra} حصص أخرى — عرض كل المواعيد <ChevronLeft size={15} />
                    </button>
                  )}
                </>
              )}
            </section>

            {/* Pending payments */}
            <section id="today-payments" aria-label="اشتراكات منتظرة" style={{ marginBottom: 24, scrollMarginTop: 84 }}>
              <div style={sectionHead}>
                <h2 style={h2Style}>اشتراكات منتظرة ({paymentsTotal})</h2>
                <button type="button" onClick={() => navigate('/admin/payments')} className="hq-action" style={ghostBtn}>
                  <CreditCard size={15} /> كل المدفوعات
                </button>
              </div>
              {payments.length === 0 ? (
                <EmptyState icon={CircleCheck} title="لا طلبات معلقة"
                  hint="كل الاشتراكات مُعالجة — لا شيء يحتاج اعتماداً الآن."
                  actionLabel="عرض سجل المدفوعات" onAction={() => navigate('/admin/payments')} />
              ) : (
                <>
                  <ol style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                    {payments.slice(0, PREVIEW_LIMIT).map(p => (
                      <li key={p._id} style={rowCard(false)}>
                        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                          <HqAvatar firstName={p.user?.firstName} lastName={p.user?.lastName} size={40} />
                          <div style={{ flex: 1, minWidth: 150 }}>
                            <strong style={{ fontSize: 15, color: HQ.INK }}>{p.user?.firstName} {p.user?.lastName}</strong>
                            <p style={{ margin: '2px 0 0', fontSize: 13, color: HQ.MUTED, fontVariantNumeric: 'tabular-nums' }}>
                              {p.amount} ج.م · {p.method === 'vodafone_cash' ? 'فودافون كاش' : 'انستاباي'}
                              {p.createdAt ? ` · ${formatDateAr(p.createdAt)}` : ''}
                            </p>
                          </div>
                          <div className="m-today-actions" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            {p.receiptUrl && (
                              <a href={p.receiptUrl} target="_blank" rel="noreferrer" className="hq-action"
                                aria-label={`عرض إيصال ${p.user?.firstName} ${p.user?.lastName}`}
                                style={{ background: HQ.PAPER, border: `1px solid ${HQ.LINE}`, color: HQ.INK, fontSize: 13, padding: '0 14px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                                <Eye size={15} /> الإيصال
                              </a>
                            )}
                            <button type="button" onClick={() => { setApprovePayment(p); setCustomDays(30); }}
                              className="hq-action" aria-label={`قبول دفعة ${p.user?.firstName} ${p.user?.lastName}`}
                              style={{ background: HQ.MENTOR, color: '#fff', fontSize: 13, padding: '0 14px', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                              <Check size={15} /> قبول
                            </button>
                            <button type="button" onClick={() => { setRejectPayment(p); setRejectReason(''); }}
                              className="hq-action" aria-label={`رفض دفعة ${p.user?.firstName} ${p.user?.lastName}`}
                              style={{ background: HQ.PAPER, border: `1px solid ${HQ.ERROR}`, color: HQ.ERROR, fontSize: 13, padding: '0 14px', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                              <X size={15} /> رفض
                            </button>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ol>
                  {paymentsExtra > 0 && (
                    <button type="button" onClick={() => navigate('/admin/payments')} className="hq-action"
                      style={{ width: '100%', background: HQ.SURFACE, border: `1px dashed ${HQ.LINE}`, color: HQ.MENTOR, fontSize: 14, marginTop: 2 }}>
                      + {paymentsExtra} طلبات أخرى — عرض كل المدفوعات <ChevronLeft size={15} />
                    </button>
                  )}
                </>
              )}
            </section>

            {/* Waiting students */}
            <section id="today-waiting" aria-label="طلاب منتظرون" style={{ marginBottom: 8, scrollMarginTop: 84 }}>
              <div style={sectionHead}>
                <h2 style={h2Style}>طلاب منتظرون ({waitingTotal})</h2>
                <button type="button" onClick={() => navigate('/admin/pending')} className="hq-action" style={ghostBtn}>
                  <Clock size={15} /> الكل
                </button>
              </div>
              {waitingList.length === 0 ? (
                <EmptyState icon={Inbox} title="لا يوجد منتظرون"
                  hint="كل الطلاب مسكّنون في مستويات ومواعيد — عمل موفق."
                  actionLabel="عرض كل الطلاب" onAction={() => navigate('/admin/users')} />
              ) : (
                <>
                  <ol style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                    {waitingList.map(u => {
                      const reason = u.isApproved === false ? 'بانتظار الاعتماد' : !u.assignedLevel ? 'بدون مستوى' : 'بدون جدولة';
                      return (
                        <li key={u._id} style={rowCard(false)}>
                          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                            <HqAvatar firstName={u.firstName} lastName={u.lastName} size={40} />
                            <div style={{ flex: 1, minWidth: 150 }}>
                              <strong style={{ fontSize: 15, color: HQ.INK }}>{u.firstName} {u.lastName}</strong>
                              <p style={{ margin: '2px 0 0', fontSize: 13, color: HQ.MUTED, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                <HqBadge tone={u.isApproved === false ? 'mentor' : 'neutral'}>{reason}</HqBadge>
                                {u.placementExamScore !== undefined && u.placementExamScore !== null
                                  ? <span style={{ fontVariantNumeric: 'tabular-nums' }}>التحريري {u.placementExamScore}%</span>
                                  : null}
                                {u.createdAt ? <span>· منذ {timeAgoAr(u.createdAt)}</span> : null}
                                <PhoneChip phone={u.phone} />
                              </p>
                            </div>
                            <div className="m-today-actions" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                              <button type="button" onClick={() => openReview(u)} className="hq-action"
                                aria-label={`مراجعة ملف ${u.firstName} ${u.lastName}`}
                                style={{ background: HQ.WARNING_WASH, border: `1px solid ${HQ.WARNING}`, color: HQ.WARNING, fontSize: 13, padding: '0 14px', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                                <ClipboardList size={15} /> مراجعة
                              </button>
                              <button type="button" onClick={() => openSchedule(u)} disabled={actingId === u._id} className="hq-action m-primary"
                                aria-label={`جدولة ${u.firstName} ${u.lastName}`}
                                style={{ background: HQ.MENTOR, color: '#fff', fontSize: 13, padding: '0 14px', display: 'inline-flex', alignItems: 'center', gap: 5, opacity: actingId === u._id ? 0.6 : 1 }}>
                                <Calendar size={15} /> جدولة
                              </button>
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                  {waitingExtra > 0 && (
                    <button type="button" onClick={() => navigate('/admin/pending')} className="hq-action"
                      style={{ width: '100%', background: HQ.SURFACE, border: `1px dashed ${HQ.LINE}`, color: HQ.MENTOR, fontSize: 14, marginTop: 2 }}>
                      + {waitingExtra} طلاب آخرون — عرض الكل <ChevronLeft size={15} />
                    </button>
                  )}
                </>
              )}
            </section>
          </>
        )}

        {/* Schedule modal */}
        {scheduleUser && (
          <Modal title="تحديد المستوى والجدولة" onClose={() => setScheduleUser(null)} labelledBy="sched-title">
            <p id="sched-title" style={{ margin: '0 0 16px', fontSize: 14, color: HQ.MUTED }}>
              الطالب: <strong style={{ color: HQ.INK }}>{scheduleUser.firstName} {scheduleUser.lastName}</strong>
            </p>
            <div style={{ marginBottom: 14 }}>
              <label htmlFor="sched-level" style={{ display: 'block', fontSize: 13, fontWeight: 800, color: HQ.INK, marginBottom: 6 }}>المستوى المعتمد</label>
              <select id="sched-level" value={scheduleForm.assignedLevel} onChange={e => setScheduleForm(p => ({ ...p, assignedLevel: e.target.value }))} style={{ ...selectStyle, width: '100%' }}>
                <option value="foundation">المستوى التأسيسي</option>
                <option value="memorization">مستوى الحفظ والتجويد</option>
                <option value="teacher_prep">إعداد معلمين</option>
                <option value="senior">كبار السن</option>
              </select>
            </div>
            <div style={{ marginBottom: 14 }}>
              <span id="sched-days-label" style={{ display: 'block', fontSize: 13, fontWeight: 800, color: HQ.INK, marginBottom: 8 }}>أيام البث</span>
              <div role="group" aria-labelledby="sched-days-label" style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {WEEK_DAYS.map(day => {
                  const selected = scheduleForm.scheduleDays.includes(day);
                  return (
                    <button key={day} type="button" aria-pressed={selected}
                      onClick={() => setScheduleForm(p => ({ ...p, scheduleDays: p.scheduleDays.includes(day) ? p.scheduleDays.filter(d => d !== day) : [...p.scheduleDays, day] }))}
                      style={{ padding: '8px 14px', minHeight: 44, borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', border: `1px solid ${selected ? HQ.MENTOR : HQ.LINE}`, background: selected ? HQ.MENTOR : HQ.PAPER, color: selected ? '#fff' : HQ.INK, fontFamily: 'inherit' }}>
                      {day}
                    </button>
                  );
                })}
              </div>
            </div>
            <div style={{ marginBottom: 14 }}>
              <span id="sched-time-label" style={{ display: 'block', fontSize: 13, fontWeight: 800, color: HQ.INK, marginBottom: 6 }}>ساعة البث (12 ساعة)</span>
              <div role="group" aria-labelledby="sched-time-label">
                <SessionTimePicker value={scheduleForm.sessionTime} onChange={v => setScheduleForm(p => ({ ...p, sessionTime: v }))} />
              </div>
              {(() => {
                const clashes = scheduleConflicts(scheduleUser._id, scheduleForm.scheduleDays, scheduleForm.sessionTime);
                if (!clashes.length) return null;
                return (
                  <div role="alert" style={{ marginTop: 8, background: HQ.ERROR_WASH, border: `1px solid ${HQ.ERROR}`, borderRadius: 12, padding: '10px 14px', fontSize: 13, fontWeight: 700, color: HQ.ERROR, lineHeight: 1.8 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><AlertTriangle size={15} /> هذا الموعد محجوز:</span>
                    {clashes.slice(0, 3).map(c => {
                      const day = (c.scheduleDays || []).find(d => scheduleForm.scheduleDays.includes(d));
                      return <span key={c._id} style={{ display: 'block' }}>• {c.firstName} {c.lastName} — يوم {day} الساعة {formatTime12Ar(c.sessionTime)}</span>;
                    })}
                    اختر وقتاً آخر.
                  </div>
                );
              })()}
            </div>
            <div className="m-modal-actions" style={{ display: 'flex', gap: 10 }}>
              <button type="button" onClick={() => setScheduleUser(null)} className="hq-action" style={{ flex: 1, background: HQ.PAPER, border: `1px solid ${HQ.LINE}`, color: HQ.INK, fontSize: 14 }}>إلغاء</button>
              <button type="button" onClick={handleSaveSchedule} disabled={actingId === scheduleUser._id} className="hq-action" style={{ flex: 1, background: HQ.MENTOR, color: '#fff', fontSize: 14, opacity: actingId === scheduleUser._id ? 0.6 : 1 }}>
                {actingId === scheduleUser._id ? 'جارٍ الحفظ...' : 'حفظ واعتماد الطالب'}
              </button>
            </div>
          </Modal>
        )}

        {/* Live modal */}
        {liveUser && (
          <Modal title="بدء بث مباشر ودرس فوري" onClose={() => setLiveUser(null)} labelledBy="live-title">
            <p style={{ margin: '0 0 16px', fontSize: 14, color: HQ.MUTED }}>
              الطالب: <strong style={{ color: HQ.INK }}>{liveUser.firstName} {liveUser.lastName}</strong>
              {liveUser.sessionTime ? <> · موعده {formatTime12Ar(liveUser.sessionTime)}</> : null}
            </p>
            <div style={{ marginBottom: 14 }}>
              <label htmlFor="live-title-input" style={{ display: 'block', fontSize: 13, fontWeight: 800, color: HQ.INK, marginBottom: 6 }}>اسم الدرس (اختياري)</label>
              <input id="live-title-input" type="text" value={liveForm.title} onChange={e => setLiveForm(p => ({ ...p, title: e.target.value }))} placeholder="مثال: مراجعة سورة الملك" style={{ ...selectStyle, width: '100%' }} />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label htmlFor="live-desc-input" style={{ display: 'block', fontSize: 13, fontWeight: 800, color: HQ.INK, marginBottom: 6 }}>ملاحظات الدرس (اختياري)</label>
              <textarea id="live-desc-input" value={liveForm.description} onChange={e => setLiveForm(p => ({ ...p, description: e.target.value }))} rows={2} placeholder="ما سيُغطى في هذا اللقاء..." style={{ ...selectStyle, width: '100%', minHeight: 64, paddingTop: 10, resize: 'vertical' }} />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label htmlFor="live-res-input" style={{ display: 'block', fontSize: 13, fontWeight: 800, color: HQ.INK, marginBottom: 6 }}>المصادر (اختياري)</label>
              <textarea id="live-res-input" value={liveForm.resources} onChange={e => setLiveForm(p => ({ ...p, resources: e.target.value }))} rows={2} placeholder="روابط أو صفحات مطلوبة..." style={{ ...selectStyle, width: '100%', minHeight: 64, paddingTop: 10, resize: 'vertical' }} />
            </div>
            <div className="m-modal-actions" style={{ display: 'flex', gap: 10 }}>
              <button type="button" onClick={() => setLiveUser(null)} className="hq-action" style={{ flex: 1, background: HQ.PAPER, border: `1px solid ${HQ.LINE}`, color: HQ.INK, fontSize: 14 }}>إلغاء</button>
              <button type="button" onClick={handleConfirmLive} disabled={actingId === liveUser._id} className="hq-action" style={{ flex: 1, background: HQ.MENTOR, color: '#fff', fontSize: 14, opacity: actingId === liveUser._id ? 0.6 : 1 }}>
                {actingId === liveUser._id ? 'جارٍ البدء...' : 'بدء البث وإنشاء الدرس'}
              </button>
            </div>
          </Modal>
        )}

        {/* Review modal */}
        {reviewUser && (
          <Modal title="ملف مراجعة الطالب" onClose={() => setReviewUser(null)} maxWidth={600} labelledBy="review-title">
            <p style={{ margin: '0 0 16px', fontSize: 14, color: HQ.MUTED }}>
              <strong style={{ color: HQ.INK }}>{reviewUser.firstName} {reviewUser.lastName}</strong>
              {reviewData.writtenPercentage !== null && reviewData.writtenPercentage !== undefined && (
                <> · التحريري: <strong style={{ color: HQ.MENTOR }}>{reviewData.writtenPercentage}%</strong></>
              )}
            </p>
            {reviewLoading ? (
              <div style={{ textAlign: 'center', padding: 32 }}><LoadingSpinner size="md" text="جارٍ الجلب..." /></div>
            ) : (
              <>
                <h4 style={{ margin: '0 0 8px', fontSize: 15, fontWeight: 900, color: HQ.INK }}>إجابات الاستبيان ({reviewData.surveyAnswers.length})</h4>
                {reviewData.surveyAnswers.length === 0 ? (
                  <p style={{ margin: '0 0 16px', fontSize: 13, color: HQ.MUTED }}>لا توجد إجابات مسجلة.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                    {reviewData.surveyAnswers.map((sa, idx) => {
                      const resolved = resolveSurveyAnswer(sa, idx, reviewUser?.registrationType);
                      return (
                        <div key={idx} style={{ background: HQ.PAPER, border: `1px solid ${HQ.LINE}`, borderRadius: 12, padding: '10px 14px' }}>
                          <p style={{ margin: '0 0 2px', fontSize: 12, fontWeight: 700, color: HQ.MUTED }}>س{idx + 1}: {resolved.questionText}</p>
                          <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: HQ.INK }}>{resolved.answerText}</p>
                        </div>
                      );
                    })}
                  </div>
                )}
                <h4 style={{ margin: '0 0 8px', fontSize: 15, fontWeight: 900, color: HQ.INK }}>التسجيلات الشفهية ({reviewData.audioList.length})</h4>
                {reviewData.audioList.length === 0 ? (
                  <p style={{ margin: '0 0 16px', fontSize: 13, color: HQ.MUTED }}>لا توجد تسجيلات.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                    {reviewData.audioList.map((url, idx) => (
                      <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 10, background: HQ.PAPER, border: `1px solid ${HQ.LINE}`, borderRadius: 12, padding: '8px 12px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 13, fontWeight: 800, color: HQ.INK }}>التسجيل {idx + 1}</span>
                        <audio src={url} controls style={{ height: 36, flex: 1, minWidth: 220 }} />
                      </div>
                    ))}
                  </div>
                )}
                <button type="button" onClick={() => { const u = reviewUser; setReviewUser(null); openSchedule(u); }} className="hq-action"
                  style={{ width: '100%', background: HQ.MENTOR, color: '#fff', fontSize: 15 }}>
                  <Calendar size={16} /> تحديد المستوى والجدولة لهذا الطالب
                </button>
              </>
            )}
          </Modal>
        )}

        {/* Wird modal (shared) */}
        <WirdAssignModal
          open={Boolean(wirdUser)}
          studentId={wirdUser?._id}
          studentName={wirdUser ? `${wirdUser.firstName} ${wirdUser.lastName}` : ''}
          onClose={() => setWirdUser(null)}
        />

        {/* Approve payment modal */}
        {approvePayment && (
          <Modal title="اعتماد الدفعة وتفعيل الاشتراك" onClose={() => setApprovePayment(null)} maxWidth={440} labelledBy="approve-title">
            <p style={{ margin: '0 0 16px', fontSize: 14, color: HQ.MUTED }}>
              الطالب: <strong style={{ color: HQ.INK }}>{approvePayment.user?.firstName} {approvePayment.user?.lastName}</strong> · {approvePayment.amount} ج.م
            </p>
            <span id="approve-days-label" style={{ display: 'block', fontSize: 13, fontWeight: 800, color: HQ.INK, marginBottom: 8 }}>مدة التفعيل بالأيام</span>
            <div role="group" aria-labelledby="approve-days-label" style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              {[30, 90, 365].map(d => (
                <button key={d} type="button" onClick={() => setCustomDays(d)} aria-pressed={customDays === d}
                  style={{ flex: 1, minHeight: 48, borderRadius: 12, cursor: 'pointer', fontSize: 13, fontWeight: 800, border: `2px solid ${customDays === d ? HQ.MENTOR : HQ.LINE}`, background: customDays === d ? HQ.MENTOR : HQ.SURFACE, color: customDays === d ? '#fff' : HQ.MUTED, fontVariantNumeric: 'tabular-nums', fontFamily: 'inherit' }}>
                  {d === 365 ? 'سنة' : `${d} يوم`}
                </button>
              ))}
            </div>
            <div className="m-modal-actions" style={{ display: 'flex', gap: 10 }}>
              <button type="button" onClick={() => setApprovePayment(null)} disabled={actionLoading} className="hq-action" style={{ flex: 1, background: HQ.PAPER, border: `1px solid ${HQ.LINE}`, color: HQ.INK, fontSize: 14 }}>إلغاء</button>
              <button type="button" onClick={handleApprove} disabled={actionLoading} className="hq-action" style={{ flex: 1, background: HQ.MENTOR, color: '#fff', fontSize: 14, opacity: actionLoading ? 0.6 : 1 }}>
                {actionLoading ? 'جارٍ الاعتماد...' : 'تأكيد القبول والتفعيل'}
              </button>
            </div>
          </Modal>
        )}

        {/* Pre-start subscription confirm: expired/unsubscribed student */}
        <ConfirmModal
          open={Boolean(subConfirm)}
          title="هل تريد الاستمرار في البث؟"
          message={subConfirm?.warning?.message || ''}
          confirmLabel="نعم، ابدأ البث"
          cancelLabel="تراجع"
          danger
          busy={actingId === subConfirm?.u?._id}
          onConfirm={() => {
            const s = subConfirm;
            setSubConfirm(null);
            if (s) doStartLive(s.u, s.payload);
          }}
          onClose={() => setSubConfirm(null)}
        />

        {/* Reject payment modal */}
        {rejectPayment && (
          <Modal title="رفض الدفعة" onClose={() => setRejectPayment(null)} maxWidth={440} labelledBy="reject-title">
            <p style={{ margin: '0 0 16px', fontSize: 14, color: HQ.MUTED }}>
              الطالب: <strong style={{ color: HQ.INK }}>{rejectPayment.user?.firstName} {rejectPayment.user?.lastName}</strong>
            </p>
            <label htmlFor="reject-reason" style={{ display: 'block', fontSize: 13, fontWeight: 800, color: HQ.INK, marginBottom: 6 }}>سبب الرفض (يصل للطالب) *</label>
            <textarea id="reject-reason" value={rejectReason} onChange={e => setRejectReason(e.target.value)} rows={3} placeholder="مثال: الإيصال غير واضح — أعد الرفع بصورة أوضح"
              style={{ ...selectStyle, width: '100%', minHeight: 80, paddingTop: 10, resize: 'vertical', marginBottom: 16 }} />
            <div className="m-modal-actions" style={{ display: 'flex', gap: 10 }}>
              <button type="button" onClick={() => setRejectPayment(null)} disabled={actionLoading} className="hq-action" style={{ flex: 1, background: HQ.PAPER, border: `1px solid ${HQ.LINE}`, color: HQ.INK, fontSize: 14 }}>إلغاء</button>
              <button type="button" onClick={handleReject} disabled={actionLoading} className="hq-action" style={{ flex: 1, background: HQ.ERROR, color: '#fff', fontSize: 14, opacity: actionLoading ? 0.6 : 1 }}>
                {actionLoading ? 'جارٍ الرفض...' : 'تأكيد الرفض'}
              </button>
            </div>
          </Modal>
        )}

        {/* Student lessons modal (shared component — same UX as Users section) */}
        <StudentLessonsModal user={lessonsModalUser} onClose={() => setLessonsModalUser(null)} />
      </div>
    </PageLayout>
  );
}
