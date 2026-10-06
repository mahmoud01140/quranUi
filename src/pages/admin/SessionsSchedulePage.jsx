import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { RotateCcw, Radio, CheckCircle, Check, BookOpen, X, MessageCircle, Pencil, Award, Plus, Trash2, Download, CreditCard } from 'lucide-react';
import toast from 'react-hot-toast';
import PageLayout from '../../components/shared/PageLayout';
import WirdAssignModal from '../../components/shared/WirdAssignModal';
import { downloadStudentReport } from '../../utils/studentReport';
import api from '../../services/api';
import { getLevelLabel, formatDateAr, formatTime12Ar, getSubscriptionInfo } from '../../utils/helpers';
import { notifySubscriptionWarning, fetchSubscriptionWarning, isBlockingWarning } from '../../utils/subscriptionWarning';
import ConfirmModal from '../../components/shared/ConfirmModal';
import LoadingSpinner from '../../components/shared/LoadingSpinner';
import PhoneChip from '../../components/shared/PhoneChip';
import '../../components/halaqa/halaqa.css';
import { HQ, HqAvatar, HqBadge } from '../../components/halaqa/primitives';

/* مواعيد الحصص — كل الطلاب المجدولين مرتبين حسب اليوم والساعة،
   والحصة التي حان موعدها مميزة، مع زر بدء بث فوري. */

const WEEK_DAYS = ['السبت', 'الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة'];
const JS_DAY_TO_AR = { 0: 'الأحد', 1: 'الاثنين', 2: 'الثلاثاء', 3: 'الأربعاء', 4: 'الخميس', 5: 'الجمعة', 6: 'السبت' };
const SESSION_WINDOW_MIN = 60; // الحصة تُعتبر حانية لمدة ساعة من بدايتها

const toMinutes = (t) => {
  if (!t || typeof t !== 'string') return null;
  const [h, m] = t.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
};

export default function SessionsSchedulePage() {
  const navigate = useNavigate();
  const [students, setStudents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [startingId, setStartingId] = useState(null);
  // Pre-start subscription confirm: { u, warning } — null when idle
  const [subConfirm, setSubConfirm] = useState(null);
  const [wirdUser, setWirdUser] = useState(null);
  const [reportId, setReportId] = useState(null);
  const [activateUser, setActivateUser] = useState(null);
  const [activateDays, setActivateDays] = useState(30);
  const [now, setNow] = useState(() => new Date());

  // Student lessons modal (full: view + edit sources + exam + discussion)
  const [lessonsUser, setLessonsUser] = useState(null);
  const [lessonsLoading, setLessonsLoading] = useState(false);
  const [lessons, setLessons] = useState([]);
  const [editingLessonId, setEditingLessonId] = useState(null);
  const [lessonEditForm, setLessonEditForm] = useState({ title: '', description: '', resources: '', videoUrl: '' });
  const [savingLessonId, setSavingLessonId] = useState(null);

  // Per-lesson exam creation modal
  const [examModalLesson, setExamModalLesson] = useState(null);
  const [examForm, setExamForm] = useState({ title: '', passingScore: 60, questions: [] });
  const [savingExam, setSavingExam] = useState(false);

  const blankQuestion = () => ({
    text: '', type: 'mcq', options: ['', '', '', ''],
    correctAnswer: 0, correctAnswerBool: true, correctAnswerText: '',
  });

  const selectStyle = {
    background: HQ.SURFACE, border: `1px solid ${HQ.LINE}`, borderRadius: 12,
    padding: '0 12px', minHeight: 48, fontSize: 14, color: HQ.INK, fontFamily: 'inherit',
  };

  useEffect(() => { fetchData(); }, []);

  // إعادة تقييم "حان الموعد" كل دقيقة
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(id);
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    setLoadFailed(false);
    try {
      const res = await api.get('/users', { params: { role: 'student', limit: 200 } });
      setStudents((res.data.users || []).filter(u =>
        u.isActive !== false && (u.scheduleDays?.length) && u.sessionTime
      ));
    } catch {
      setLoadFailed(true);
      toast.error('خطأ في جلب البيانات');
    } finally { setIsLoading(false); }
  };

  const todayName = JS_DAY_TO_AR[now.getDay()];
  const nowMin = now.getHours() * 60 + now.getMinutes();

  // أيام الأسبوع بدءاً من اليوم، وكل يوم حصصه مرتبة بالساعة
  const days = useMemo(() => {
    const startIdx = WEEK_DAYS.indexOf(todayName);
    const ordered = WEEK_DAYS.slice(startIdx).concat(WEEK_DAYS.slice(0, startIdx));
    return ordered.map((day, dayOffset) => {
      const entries = [];
      students.forEach(u => {
        if ((u.scheduleDays || []).includes(day)) {
          const mins = toMinutes(u.sessionTime);
          if (mins === null) return;
          let status = 'future';
          if (dayOffset === 0) {
            if (nowMin >= mins && nowMin < mins + SESSION_WINDOW_MIN) status = 'now';
            else if (nowMin < mins) status = 'upcoming';
            else status = 'passed';
          }
          entries.push({ student: u, mins, status });
        }
      });
      entries.sort((a, b) => a.mins - b.mins);
      return { day, dayOffset, entries };
    });
  }, [students, todayName, nowMin]);

  const nowList = days[0]?.entries.filter(e => e.status === 'now') || [];
  const todayUpcoming = days[0]?.entries.filter(e => e.status === 'upcoming') || [];

  // Pre-start subscription check: expired/unsubscribed students require
  // explicit confirmation ("هل تريد الاستمرار؟") before the broadcast starts.
  const handleQuickStart = async (u) => {
    if (startingId) return;
    const warning = await fetchSubscriptionWarning(u._id);
    if (isBlockingWarning(warning)) {
      setSubConfirm({ u, warning });
      return;
    }
    if (warning) notifySubscriptionWarning(warning); // expiring_soon: info only
    await doStartLive(u);
  };

  const doStartLive = async (u) => {
    setStartingId(u._id);
    try {
      const res = await api.post(`/live/student/${u._id}/start`, {});
      toast.success(`انطلق البث مع ${u.firstName}`);
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
      toast.error(err?.response?.data?.message || 'خطأ في بدء البث');
    } finally { setStartingId(null); }
  };

  // ── دروس الطالب (عرض + تعديل مصادر + اختبار + مناقشة) ──
  const openLessonsModal = async (u) => {
    setLessonsUser(u);
    setLessons([]);
    setEditingLessonId(null);
    setLessonsLoading(true);
    try {
      const res = await api.get(`/study-plans/student/${u._id}/full`);
      const list = res.data?.plan?.customLessons || [];
      setLessons([...list].reverse());
    } catch {
      toast.error('تعذر جلب دروس الطالب');
    } finally {
      setLessonsLoading(false);
    }
  };

  const startEditLesson = (lesson) => {
    setEditingLessonId(lesson._id);
    setLessonEditForm({
      title: lesson.title || '',
      description: lesson.description || '',
      resources: lesson.resources || '',
      videoUrl: lesson.videoUrl || '',
    });
  };

  const handleSaveLessonEdit = async () => {
    if (!lessonsUser || !editingLessonId) return;
    setSavingLessonId(editingLessonId);
    try {
      await api.put(
        `/study-plans/student/${lessonsUser._id}/lessons/${editingLessonId}`,
        lessonEditForm
      );
      toast.success('تم حفظ تعديل الدرس والمصادر بنجاح ✅');
      setLessons(prev => prev.map(l =>
        l._id === editingLessonId ? { ...l, ...lessonEditForm } : l
      ));
      setEditingLessonId(null);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'خطأ في حفظ الدرس');
    } finally {
      setSavingLessonId(null);
    }
  };

  const openLessonDiscussion = (lessonId) => {
    navigate(`/admin/lessons/${lessonId}/discussion`);
  };

  const handleDownloadReport = async (u) => {
    setReportId(u._id);
    try {
      await downloadStudentReport(u);
      toast.success('تم تجهيز التقرير — اطبعه أو احفظه PDF');
    } catch {
      toast.error('تعذر تجهيز التقرير');
    } finally {
      setReportId(null);
    }
  };

  // ── إنشاء اختبار لحصة معينة وربطه بها ──
  const openExamModal = (lesson) => {
    setExamModalLesson(lesson);
    setExamForm({
      title: `اختبار: ${lesson.title || 'الحصة'}`,
      passingScore: 60,
      questions: [blankQuestion()],
    });
  };

  const updateExamQuestion = (idx, field, value) => {
    setExamForm(prev => {
      const questions = prev.questions.map((q, i) => {
        if (i !== idx) return q;
        const next = { ...q, [field]: value };
        if (field === 'type' && value !== 'mcq') next.options = [];
        if (field === 'type' && value === 'mcq' && !next.options?.length) next.options = ['', '', '', ''];
        return next;
      });
      return { ...prev, questions };
    });
  };

  const updateExamOption = (qi, oi, value) => {
    setExamForm(prev => {
      const questions = prev.questions.map((q, i) => {
        if (i !== qi) return q;
        const options = [...(q.options || [])];
        options[oi] = value;
        return { ...q, options };
      });
      return { ...prev, questions };
    });
  };

  const handleSaveLessonExam = async () => {
    if (!lessonsUser || !examModalLesson) return;
    const title = examForm.title?.trim();
    if (!title) return toast.error('أدخل عنوان الاختبار');
    const validQuestions = (examForm.questions || []).filter(q => q.text?.trim());
    if (!validQuestions.length) return toast.error('أضف سؤالاً واحداً على الأقل');
    for (const q of validQuestions) {
      if (q.type === 'mcq' && (q.options || []).filter(o => o?.trim()).length < 2) {
        return toast.error('سؤال الاختيار من متعدد يحتاج خيارين على الأقل');
      }
    }
    setSavingExam(true);
    try {
      const payload = {
        title,
        type: 'lesson',
        targetType: 'individual',
        targetStudent: lessonsUser._id,
        lessonId: examModalLesson._id,
        lessonTitle: examModalLesson.title,
        passingScore: Number(examForm.passingScore) || 60,
        questions: validQuestions.map((q, i) => ({
          questionNumber: i + 1,
          text: q.text.trim(),
          type: q.type,
          options: q.type === 'mcq' ? q.options.filter(o => o?.trim()) : [],
          correctAnswer: q.type === 'mcq' ? Number(q.correctAnswer) || 0 : undefined,
          correctAnswerBool: q.type === 'true_false' ? q.correctAnswerBool !== false : undefined,
          correctAnswerText: q.type === 'written' ? (q.correctAnswerText?.trim() || '') : undefined,
          points: 1,
        })),
      };
      const res = await api.post('/exams', payload);
      const newExam = res.data?.exam;
      await api.put(
        `/study-plans/student/${lessonsUser._id}/lessons/${examModalLesson._id}`,
        { exam: newExam._id }
      );
      setLessons(prev => prev.map(l =>
        l._id === examModalLesson._id ? { ...l, exam: newExam } : l
      ));
      toast.success('تم إنشاء الاختبار وربطه بالحصة — سيظهر للطالب في الحصص السابقة ✅');
      setExamModalLesson(null);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'خطأ في إنشاء الاختبار');
    } finally {
      setSavingExam(false);
    }
  };

  // ── تفعيل الاشتراك يدوياً بدون سداد ──
  const handleManualActivate = async () => {
    if (!activateUser) return;
    setStartingId(activateUser._id);
    try {
      const res = await api.post(`/payments/admin/activate/${activateUser._id}`, { durationDays: activateDays });
      toast.success(res.data?.message || 'تم تفعيل الاشتراك بنجاح');
      setActivateUser(null);
      await fetchData();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'خطأ في التفعيل اليدوي');
    } finally {
      setStartingId(null);
    }
  };

  const statusBadge = (status) => {
    if (status === 'now') return <HqBadge tone="mentor">🟢 حان موعدها الآن</HqBadge>;
    if (status === 'upcoming') return <HqBadge tone="gold">اليوم</HqBadge>;
    if (status === 'passed') return <HqBadge tone="neutral">انتهت اليوم</HqBadge>;
    return null;
  };

  return (
    <PageLayout>
      <div className="halaqa" style={{ maxWidth: 860, margin: '0 auto' }}>
        <h1 style={{ margin: '0 0 4px', fontSize: 26, fontWeight: 900, color: HQ.INK }}>مواعيد الحصص</h1>
        <p style={{ margin: '0 0 16px', fontSize: 14, color: HQ.MUTED }}>
          اليوم: {todayName} · {nowList.length ? `${nowList.length} حصة حان موعدها الآن` : todayUpcoming.length ? `القادمة اليوم الساعة ${formatTime12Ar(todayUpcoming[0].student.sessionTime)}` : 'لا حصص متبقية اليوم'}
        </p>

        {isLoading ? (
          <div aria-label="جارٍ التحميل">
            <div className="hq-skeleton" style={{ height: 76, width: '100%', marginBottom: 10 }} />
            <div className="hq-skeleton" style={{ height: 76, width: '100%' }} />
          </div>
        ) : loadFailed ? (
          <div style={{ background: HQ.SURFACE, border: `1px solid ${HQ.LINE}`, borderRadius: 18, padding: 40, textAlign: 'center' }} role="alert">
            <p style={{ margin: '0 0 20px', fontSize: 16, fontWeight: 800, color: HQ.INK }}>تعذّر تحميل البيانات</p>
            <button type="button" onClick={fetchData} className="hq-action" style={{ background: HQ.MENTOR, color: '#fff', padding: '0 24px', fontSize: 15 }}>
              <RotateCcw size={16} /> إعادة المحاولة
            </button>
          </div>
        ) : students.length === 0 ? (
          <div style={{ background: HQ.SURFACE, border: `1px solid ${HQ.LINE}`, borderRadius: 18, padding: 40, textAlign: 'center' }}>
            <CheckCircle size={40} color={HQ.MUTED} style={{ margin: '0 auto 12px' }} />
            <p style={{ margin: 0, fontSize: 16, fontWeight: 800, color: HQ.INK }}>لا توجد حصص مجدولة بعد</p>
            <p style={{ margin: '4px 0 0', fontSize: 14, color: HQ.MUTED }}>جدول مواعيد الطلاب من صفحة بانتظار تحديد المستوى</p>
          </div>
        ) : (
          days.filter(d => d.entries.length).map(d => (
            <section key={d.day} aria-label={`حصص يوم ${d.day}`} style={{ marginBottom: 20 }}>
              <h2 style={{ margin: '0 0 8px', fontSize: 17, fontWeight: 900, color: HQ.INK, display: 'flex', alignItems: 'center', gap: 8 }}>
                {d.dayOffset === 0 ? `اليوم (${d.day})` : d.day}
                <span style={{ fontSize: 12, fontWeight: 700, color: HQ.MUTED }}>{d.entries.length} {d.entries.length === 1 ? 'حصة' : 'حصص'}</span>
              </h2>
              <ol style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {d.entries.map(({ student: u, status }) => {
                  const isNow = status === 'now';
                  const dimmed = status === 'passed';
                  const subInfo = getSubscriptionInfo(u.subscription);
                  return (
                    <li key={`${u._id}-${d.day}`}
                      style={{
                        background: isNow ? '#E2EFE7' : HQ.SURFACE,
                        border: `2px solid ${isNow ? HQ.MENTOR : HQ.LINE}`,
                        borderRadius: 18, marginBottom: 10, padding: 14,
                        opacity: dimmed ? 0.6 : 1,
                      }}>
                      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                        <HqAvatar firstName={u.firstName} lastName={u.lastName} size={44} />
                        <div style={{ flex: 1, minWidth: 180 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <strong style={{ fontSize: 16, color: HQ.INK }}>{u.firstName} {u.lastName}</strong>
                            {statusBadge(status)}
                            <HqBadge tone={subInfo.tone}>{subInfo.label}{subInfo.days !== null ? ` · ${subInfo.days} يوم` : ''}</HqBadge>
                          </div>
                          <p style={{ margin: '2px 0 0', fontSize: 13, color: HQ.MUTED, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <span>الساعة <strong style={{ color: isNow ? '#0F5940' : HQ.INK, fontSize: 15 }}>{formatTime12Ar(u.sessionTime)}</strong>
                            {u.assignedLevel ? ` · ${getLevelLabel(u.assignedLevel)}` : ''}</span>
                            <PhoneChip phone={u.phone} />
                          </p>
                        </div>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          <button type="button" onClick={() => handleQuickStart(u)} disabled={startingId === u._id}
                            className="hq-action"
                            style={{ background: isNow ? HQ.MENTOR : HQ.PAPER, color: isNow ? '#fff' : HQ.MENTOR, border: isNow ? 'none' : `1.5px solid ${HQ.MENTOR}`, padding: '0 16px', fontSize: 14, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                            {startingId === u._id ? <LoadingSpinner size="sm" /> : <><Radio size={16} /> {isNow ? 'ابدأ البث الآن' : 'بدء بث'}</>}
                          </button>
                          <button type="button" onClick={() => setWirdUser(u)}
                            className="hq-action"
                            style={{ background: HQ.PAPER, border: `1px solid ${HQ.LINE}`, color: HQ.INK, padding: '0 16px', fontSize: 14, display: 'inline-flex', alignItems: 'center', gap: 6 }}
                            title="إعطاء ورد للطالب">
                            <BookOpen size={16} /> الورد
                          </button>
                          <button type="button" onClick={() => openLessonsModal(u)}
                            className="hq-action"
                            style={{ background: HQ.PAPER, border: `1px solid ${HQ.MENTOR}`, color: HQ.MENTOR, padding: '0 16px', fontSize: 14, display: 'inline-flex', alignItems: 'center', gap: 6 }}
                            title="عرض دروس الطالب — تعديل المصادر وإنشاء اختبار ودخول المناقشة">
                            <BookOpen size={16} /> دروس الطالب
                          </button>
                          <button type="button" onClick={() => handleDownloadReport(u)}
                            disabled={reportId === u._id}
                            className="hq-action"
                            style={{ background: HQ.PAPER, border: `1px solid ${HQ.LINE}`, color: HQ.INK, padding: '0 16px', fontSize: 14, display: 'inline-flex', alignItems: 'center', gap: 6 }}
                            title="تحميل تقرير الطالب للطباعة أو الحفظ">
                            {reportId === u._id ? <LoadingSpinner size="sm" /> : <><Download size={16} /> تقرير</>}
                          </button>
                          <button type="button" onClick={() => { setActivateUser(u); setActivateDays(30); }}
                            disabled={startingId === u._id}
                            className="hq-action"
                            style={{ background: '#E2EFE7', border: 'none', color: '#0F5940', padding: '0 16px', fontSize: 14, display: 'inline-flex', alignItems: 'center', gap: 6 }}
                            title="تفعيل الاشتراك لهذا الطالب يدوياً بدون سداد">
                            <CreditCard size={16} /> تفعيل الاشتراك
                          </button>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </section>
          ))
        )}

        {/* Manual subscription activation */}
        {activateUser && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
            <div style={{ background: HQ.SURFACE, borderRadius: 20, padding: 24, maxWidth: 440, width: '100%', border: `1px solid ${HQ.LINE}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: HQ.INK, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <CreditCard size={18} color={HQ.MENTOR} /> تفعيل الاشتراك يدوياً
                </h3>
                <button type="button" onClick={() => setActivateUser(null)} aria-label="إغلاق" style={{ background: 'none', border: 'none', cursor: 'pointer', color: HQ.MUTED, minWidth: 40, minHeight: 40 }}>
                  <X size={20} />
                </button>
              </div>
              <p style={{ margin: '0 0 16px', fontSize: 14, color: HQ.MUTED }}>
                الطالب: <strong>{activateUser.firstName} {activateUser.lastName}</strong>
                <span style={{ display: 'block', marginTop: 4 }}>تفعيل بدون سداد — يُشعَر الطالب فوراً.</span>
              </p>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 800, color: HQ.INK, marginBottom: 8 }}>مدة التفعيل</label>
              <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                {[30, 90, 365].map(d => (
                  <button key={d} type="button" onClick={() => setActivateDays(d)}
                    style={{ flex: 1, minHeight: 48, borderRadius: 12, cursor: 'pointer', fontSize: 13, fontWeight: 800, border: `2px solid ${activateDays === d ? HQ.MENTOR : HQ.LINE}`, background: activateDays === d ? HQ.MENTOR : HQ.SURFACE, color: activateDays === d ? '#fff' : HQ.MUTED, fontVariantNumeric: 'tabular-nums' }}>
                    {d === 365 ? 'سنة' : `${d} يوم`}
                  </button>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button type="button" onClick={() => setActivateUser(null)} className="hq-action" style={{ flex: 1, background: HQ.PAPER, border: `1px solid ${HQ.LINE}`, color: HQ.INK, fontSize: 14 }}>إلغاء</button>
                <button type="button" onClick={handleManualActivate} disabled={startingId === activateUser._id} className="hq-action" style={{ flex: 1, background: HQ.MENTOR, color: '#fff', fontSize: 14, opacity: startingId === activateUser._id ? 0.6 : 1 }}>
                  {startingId === activateUser._id ? 'جارٍ التفعيل...' : 'تأكيد التفعيل'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Wird assignment (shared modal) */}
        <WirdAssignModal
          open={Boolean(wirdUser)}
          studentId={wirdUser?._id}
          studentName={wirdUser ? `${wirdUser.firstName} ${wirdUser.lastName}` : ''}
          onClose={() => setWirdUser(null)}
        />

        {/* Student lessons modal (view + edit sources + exam + discussion) */}
        {lessonsUser && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
            <div style={{ background: HQ.SURFACE, borderRadius: 20, padding: 24, maxWidth: 640, width: '100%', border: `1px solid ${HQ.LINE}`, boxShadow: '0 10px 30px rgba(0,0,0,0.2)', maxHeight: '90vh', overflowY: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: HQ.INK, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <BookOpen size={18} color={HQ.MENTOR} /> دروس الطالب
                </h3>
                <button type="button" onClick={() => { setLessonsUser(null); setEditingLessonId(null); }} aria-label="إغلاق" style={{ background: 'none', border: 'none', cursor: 'pointer', color: HQ.MUTED }}>
                  <X size={20} />
                </button>
              </div>

              <p style={{ margin: '0 0 16px', fontSize: 14, color: HQ.MUTED }}>
                الطالب: <strong>{lessonsUser.firstName} {lessonsUser.lastName}</strong>
                {lessons.length > 0 && ` — ${lessons.length} درس`}
              </p>

              {lessonsLoading ? (
                <div style={{ textAlign: 'center', padding: 32 }}>
                  <LoadingSpinner size="md" text="جارٍ جلب الدروس..." />
                </div>
              ) : lessons.length === 0 ? (
                <div style={{ background: HQ.PAPER, border: `1px solid ${HQ.LINE}`, borderRadius: 14, padding: 24, textAlign: 'center' }}>
                  <BookOpen size={32} color={HQ.LINE} style={{ margin: '0 auto 8px' }} />
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: HQ.INK }}>لا توجد دروس بعد</p>
                  <p style={{ margin: '4px 0 0', fontSize: 13, color: HQ.MUTED }}>ابدأ بثاً مباشراً مع الطالب ليُنشأ أول درس تلقائياً.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {lessons.map(lesson => {
                    const isEditing = editingLessonId === lesson._id;
                    return (
                      <div key={lesson._id} style={{ background: HQ.PAPER, border: `1px solid ${HQ.LINE}`, borderRadius: 14, padding: 14 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, flexWrap: 'wrap' }}>
                          <div style={{ flex: 1, minWidth: 200 }}>
                            <p style={{ margin: '0 0 2px', fontSize: 14, fontWeight: 900, color: HQ.INK }}>
                              {lesson.lessonNumber ? `الدرس ${lesson.lessonNumber}: ` : ''}{lesson.title}
                            </p>
                            <p style={{ margin: 0, fontSize: 12, color: HQ.MUTED }}>
                              {lesson.createdAt ? formatDateAr(lesson.createdAt) : ''} · الحالة: {lesson.status === 'completed' ? 'مكتمل' : lesson.status === 'in_progress' ? 'جارٍ' : 'بانتظار'}
                              {lesson.resources ? ' · يوجد مصادر مرفقة' : ' · بدون مصادر'}
                              {lesson.exam ? ` · الاختبار: ${lesson.exam.title || 'مرتبط'}` : ' · بدون اختبار'}
                            </p>
                          </div>
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            <button
                              type="button"
                              onClick={() => isEditing ? setEditingLessonId(null) : startEditLesson(lesson)}
                              className="hq-action"
                              style={{ background: HQ.SURFACE, border: `1px solid ${HQ.LINE}`, color: HQ.INK, padding: '0 12px', fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 5 }}
                            >
                              <Pencil size={14} /> {isEditing ? 'إغلاق التعديل' : 'تعديل المصادر'}
                            </button>
                            <button
                              type="button"
                              onClick={() => openExamModal(lesson)}
                              className="hq-action"
                              style={{ background: '#F8EDD3', border: '1px solid #D9A441', color: '#7C5A12', padding: '0 12px', fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 5 }}
                              title="إنشاء اختبار لهذه الحصة يظهر للطالب في الحصص السابقة"
                            >
                              <Award size={14} /> {lesson.exam ? 'استبدال الاختبار' : 'إنشاء اختبار'}
                            </button>
                            <button
                              type="button"
                              onClick={() => openLessonDiscussion(lesson._id)}
                              className="hq-action"
                              style={{ background: '#E2EFE7', border: 'none', color: '#0F5940', padding: '0 12px', fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 5 }}
                            >
                              <MessageCircle size={14} /> دخول المناقشة
                            </button>
                          </div>
                        </div>

                        {isEditing && (
                          <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${HQ.LINE}`, display: 'flex', flexDirection: 'column', gap: 10 }}>
                            <label style={{ fontSize: 12, fontWeight: 800, color: HQ.INK }}>
                              عنوان الدرس
                              <input
                                type="text"
                                value={lessonEditForm.title}
                                onChange={e => setLessonEditForm(p => ({ ...p, title: e.target.value }))}
                                style={{ ...selectStyle, width: '100%', marginTop: 4 }}
                              />
                            </label>
                            <label style={{ fontSize: 12, fontWeight: 800, color: HQ.INK }}>
                              المصادر والروابط
                              <textarea
                                value={lessonEditForm.resources}
                                onChange={e => setLessonEditForm(p => ({ ...p, resources: e.target.value }))}
                                rows={2}
                                placeholder="روابط ملفات، مصحف، مراجع..."
                                style={{ ...selectStyle, width: '100%', marginTop: 4, minHeight: 64, paddingTop: 8, resize: 'vertical' }}
                              />
                            </label>
                            <label style={{ fontSize: 12, fontWeight: 800, color: HQ.INK }}>
                              رابط الفيديو
                              <input
                                type="url"
                                value={lessonEditForm.videoUrl}
                                onChange={e => setLessonEditForm(p => ({ ...p, videoUrl: e.target.value }))}
                                placeholder="https://..."
                                style={{ ...selectStyle, width: '100%', marginTop: 4, direction: 'ltr' }}
                              />
                            </label>
                            <label style={{ fontSize: 12, fontWeight: 800, color: HQ.INK }}>
                              ملاحظات الدرس
                              <textarea
                                value={lessonEditForm.description}
                                onChange={e => setLessonEditForm(p => ({ ...p, description: e.target.value }))}
                                rows={2}
                                style={{ ...selectStyle, width: '100%', marginTop: 4, minHeight: 56, paddingTop: 8, resize: 'vertical' }}
                              />
                            </label>
                            <button
                              type="button"
                              onClick={handleSaveLessonEdit}
                              disabled={savingLessonId === lesson._id}
                              className="hq-action"
                              style={{ background: HQ.MENTOR, color: '#fff', fontSize: 14 }}
                            >
                              {savingLessonId === lesson._id ? <LoadingSpinner size="sm" /> : 'حفظ التعديل'}
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Per-lesson exam creation modal */}
        {examModalLesson && lessonsUser && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
            <div style={{ background: HQ.SURFACE, borderRadius: 20, padding: 24, maxWidth: 640, width: '100%', border: `1px solid ${HQ.LINE}`, boxShadow: '0 10px 30px rgba(0,0,0,0.25)', maxHeight: '90vh', overflowY: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: HQ.INK, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Award size={18} color="#B45309" /> اختبار جديد للحصة
                </h3>
                <button type="button" onClick={() => setExamModalLesson(null)} aria-label="إغلاق" style={{ background: 'none', border: 'none', cursor: 'pointer', color: HQ.MUTED }}>
                  <X size={20} />
                </button>
              </div>

              <p style={{ margin: '0 0 16px', fontSize: 13, color: HQ.MUTED }}>
                الحصة: <strong>{examModalLesson.title}</strong> · الطالب: <strong>{lessonsUser.firstName} {lessonsUser.lastName}</strong>
                <span style={{ display: 'block', marginTop: 4 }}>سيظهر الاختبار للطالب في الحصص السابقة فور إنشائه.</span>
              </p>

              <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
                <label style={{ flex: 3, minWidth: 220, fontSize: 12, fontWeight: 800, color: HQ.INK }}>
                  عنوان الاختبار *
                  <input
                    type="text"
                    value={examForm.title}
                    onChange={e => setExamForm(p => ({ ...p, title: e.target.value }))}
                    style={{ ...selectStyle, width: '100%', marginTop: 4 }}
                  />
                </label>
                <label style={{ flex: 1, minWidth: 110, fontSize: 12, fontWeight: 800, color: HQ.INK }}>
                  درجة النجاح %
                  <input
                    type="number" min={0} max={100}
                    value={examForm.passingScore}
                    onChange={e => setExamForm(p => ({ ...p, passingScore: e.target.value }))}
                    style={{ ...selectStyle, width: '100%', marginTop: 4 }}
                  />
                </label>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 14 }}>
                {examForm.questions.map((q, qi) => (
                  <div key={qi} style={{ background: HQ.PAPER, border: `1px solid ${HQ.LINE}`, borderRadius: 14, padding: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <strong style={{ fontSize: 13, color: HQ.INK }}>السؤال {qi + 1}</strong>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <select
                          value={q.type}
                          onChange={e => updateExamQuestion(qi, 'type', e.target.value)}
                          style={{ ...selectStyle, minHeight: 44, fontSize: 12, padding: '0 8px' }}
                        >
                          <option value="mcq">اختيار من متعدد</option>
                          <option value="true_false">صح / خطأ</option>
                          <option value="written">مقالي</option>
                        </select>
                        {examForm.questions.length > 1 && (
                          <button
                            type="button"
                            onClick={() => setExamForm(p => ({ ...p, questions: p.questions.filter((_, i) => i !== qi) }))}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#C2410C', display: 'inline-flex', padding: 6, minWidth: 44, minHeight: 44 }}
                            title="حذف السؤال"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </div>

                    <input
                      type="text"
                      value={q.text}
                      onChange={e => updateExamQuestion(qi, 'text', e.target.value)}
                      placeholder="نص السؤال..."
                      style={{ ...selectStyle, width: '100%', marginBottom: 8 }}
                    />

                    {q.type === 'mcq' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {(q.options || []).map((opt, oi) => (
                          <div key={oi} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                            <button
                              type="button"
                              onClick={() => updateExamQuestion(qi, 'correctAnswer', oi)}
                              title={q.correctAnswer === oi ? 'الإجابة الصحيحة' : 'تحديد كإجابة صحيحة'}
                              style={{
                                width: 36, height: 36, flex: 'none', borderRadius: 10, cursor: 'pointer',
                                border: `2px solid ${q.correctAnswer === oi ? HQ.MENTOR : HQ.LINE}`,
                                background: q.correctAnswer === oi ? HQ.MENTOR : 'transparent',
                                color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                              }}
                            >
                              {q.correctAnswer === oi && <Check size={15} strokeWidth={3.5} />}
                            </button>
                            <input
                              type="text"
                              value={opt}
                              onChange={e => updateExamOption(qi, oi, e.target.value)}
                              placeholder={`الخيار ${oi + 1}`}
                              style={{ ...selectStyle, flex: 1 }}
                            />
                          </div>
                        ))}
                        <p style={{ margin: 0, fontSize: 11, color: HQ.MUTED }}>اضغط الدائرة الخضراء لتحديد الإجابة الصحيحة.</p>
                      </div>
                    )}

                    {q.type === 'true_false' && (
                      <div style={{ display: 'flex', gap: 8 }}>
                        {[true, false].map(val => (
                          <button
                            key={String(val)}
                            type="button"
                            onClick={() => updateExamQuestion(qi, 'correctAnswerBool', val)}
                            style={{
                              flex: 1, minHeight: 44, borderRadius: 10, cursor: 'pointer', fontSize: 13, fontWeight: 800,
                              border: `2px solid ${q.correctAnswerBool === val ? HQ.MENTOR : HQ.LINE}`,
                              background: q.correctAnswerBool === val ? '#E2EFE7' : HQ.SURFACE,
                              color: q.correctAnswerBool === val ? '#0F5940' : HQ.MUTED,
                            }}
                          >
                            {val ? 'صحيح' : 'خطأ'}
                          </button>
                        ))}
                      </div>
                    )}

                    {q.type === 'written' && (
                      <input
                        type="text"
                        value={q.correctAnswerText}
                        onChange={e => updateExamQuestion(qi, 'correctAnswerText', e.target.value)}
                        placeholder="الإجابة النموذجية (اختياري)"
                        style={{ ...selectStyle, width: '100%' }}
                      />
                    )}
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={() => setExamForm(p => ({ ...p, questions: [...p.questions, blankQuestion()] }))}
                className="hq-action"
                style={{ width: '100%', background: HQ.PAPER, border: `1px dashed ${HQ.MENTOR}`, color: HQ.MENTOR, fontSize: 14, marginBottom: 12 }}
              >
                <Plus size={16} /> إضافة سؤال
              </button>

              <div className="m-modal-actions" style={{ display: 'flex', gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setExamModalLesson(null)}
                  className="hq-action"
                  style={{ flex: 1, background: HQ.PAPER, border: `1px solid ${HQ.LINE}`, color: HQ.INK, fontSize: 14 }}
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  onClick={handleSaveLessonExam}
                  disabled={savingExam}
                  className="hq-action"
                  style={{ flex: 2, background: HQ.MENTOR, color: '#fff', fontSize: 14 }}
                >
                  {savingExam ? <LoadingSpinner size="sm" /> : <><Award size={16} /> إنشاء وربط الاختبار بالحصة</>}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Pre-start subscription confirm: expired/unsubscribed student */}
        <ConfirmModal
          open={Boolean(subConfirm)}
          title="هل تريد الاستمرار في البث؟"
          message={subConfirm?.warning?.message || ''}
          confirmLabel="نعم، ابدأ البث"
          cancelLabel="تراجع"
          danger
          busy={startingId === subConfirm?.u?._id}
          onConfirm={() => {
            const s = subConfirm;
            setSubConfirm(null);
            if (s) doStartLive(s.u);
          }}
          onClose={() => setSubConfirm(null)}
        />
      </div>
    </PageLayout>
  );
}
