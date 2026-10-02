import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, CheckCircle, Trash2, RotateCcw, Radio, Calendar, X, Clock, BookOpen, MessageCircle, Pencil, ClipboardList, Award, Plus, Download } from 'lucide-react';
import toast from 'react-hot-toast';
import PageLayout from '../../components/shared/PageLayout';
import useAuthStore from '../../store/authStore';
import api from '../../services/api';
import { getLevelLabel, formatDateAr, formatTime12Ar } from '../../utils/helpers';
import LoadingSpinner from '../../components/shared/LoadingSpinner';
import ConfirmModal from '../../components/shared/ConfirmModal';
import SessionTimePicker from '../../components/shared/SessionTimePicker';
import Pagination from '../../components/shared/Pagination';
import '../../components/halaqa/halaqa.css';
import { HQ, HqAvatar, HqBadge } from '../../components/halaqa/primitives';
import { downloadStudentReport } from '../../utils/studentReport';

const WEEK_DAYS = ['السبت', 'الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة'];

const ROLE_OPTIONS = [
  { value: 'student', label: 'طالب' },
  { value: 'teacher', label: 'معلم' },
  { value: 'parent', label: 'ولي أمر' },
  { value: 'admin', label: 'مدير' },
];

const ROLE_LABEL = { admin: 'مدير', teacher: 'معلم', parent: 'ولي أمر', student: 'طالب' };
const ROLE_TONE = { admin: 'gold', teacher: 'guide', parent: 'neutral', student: 'mentor' };

export default function UsersManagement() {
  const { user: me } = useAuthStore();
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [actingId, setActingId] = useState(null);
  const [reportId, setReportId] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  // ترقيم خادمي حقيقي
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [scheduleMap, setScheduleMap] = useState([]);

  // Scheduling modal state
  const [scheduleModalUser, setScheduleModalUser] = useState(null);
  const [liveModalUser, setLiveModalUser] = useState(null);
  const [liveForm, setLiveForm] = useState({ title: '', resources: '', description: '' });

  // Student instant-lessons modal state
  const [lessonsModalUser, setLessonsModalUser] = useState(null);
  const [lessonsLoading, setLessonsLoading] = useState(false);
  const [lessons, setLessons] = useState([]);
  const [editingLessonId, setEditingLessonId] = useState(null);
  const [lessonEditForm, setLessonEditForm] = useState({ title: '', description: '', resources: '', videoUrl: '' });
  const [savingLessonId, setSavingLessonId] = useState(null);

  // Student review file modal (survey + oral audio for level determination)
  const [reviewUser, setReviewUser] = useState(null);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewData, setReviewData] = useState({ surveyAnswers: [], audioList: [], writtenScore: null, writtenPercentage: null, status: null });

  // Per-lesson exam creation modal
  const [examModalLesson, setExamModalLesson] = useState(null);
  const [examForm, setExamForm] = useState({ title: '', passingScore: 60, questions: [] });
  const [savingExam, setSavingExam] = useState(false);

  const blankQuestion = () => ({
    text: '', type: 'mcq', options: ['', '', '', ''],
    correctAnswer: 0, correctAnswerBool: true, correctAnswerText: '',
  });
  const [scheduleForm, setScheduleForm] = useState({
    assignedLevel: 'foundation',
    scheduleDays: [],
    sessionTime: '18:00',
  });

  useEffect(() => {
    fetchData();
    // خريطة المواعيد الكاملة لفحص التعارض الفوري (مرة واحدة)
    api.get('/users/schedule-map').then(res => {
      setScheduleMap(res.data.students || []);
    }).catch(() => {});
  }, []);

  // بحث خادمي بمهلة لتقليل الطلبات أثناء الكتابة
  useEffect(() => {
    const t = setTimeout(() => {
      setCurrentPage(1);
      fetchData(1, pageSize);
    }, 450);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  useEffect(() => {
    setCurrentPage(1);
    fetchData(1, pageSize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roleFilter, statusFilter]);

  useEffect(() => {
    fetchData(currentPage, pageSize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, pageSize]);

  const fetchData = async (page = currentPage, size = pageSize) => {
    setIsLoading(true);
    setLoadFailed(false);
    try {
      const params = { page, limit: size };
      if (roleFilter) params.role = roleFilter;
      // backend statuses: pending/active/inactive — '' means all
      if (statusFilter) params.status = statusFilter;
      if (search.trim()) params.search = search.trim();
      const [res, pendingRes] = await Promise.all([
        api.get('/users', { params }),
        api.get('/users', { params: { status: 'pending', limit: 1 } }),
      ]);
      setUsers(res.data.users || []);
      setTotalItems(res.data.total || 0);
      setTotalPages(res.data.pages || 1);
      setPendingCount(pendingRes.data.total || 0);
    } catch {
      setLoadFailed(true);
      toast.error('خطأ في جلب البيانات');
    }
    finally { setIsLoading(false); }
  };

  const handleStartLive = (u) => {
    setLiveModalUser(u);
    setLiveForm({ title: '', resources: '', description: '' });
  };

  const handleConfirmLive = async () => {
    if (!liveModalUser) return;
    const u = liveModalUser;
    setActingId(u._id);
    try {
      const payload = {};
      if (liveForm.title?.trim()) payload.title = liveForm.title.trim();
      if (liveForm.resources?.trim()) payload.resources = liveForm.resources.trim();
      if (liveForm.description?.trim()) payload.description = liveForm.description.trim();
      const res = await api.post(`/live/student/${u._id}/start`, payload);
      toast.success('تم إنشاء الدرس وبدء البث المباشر مع الطالب');
      setLiveModalUser(null);
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
    } finally {
      setActingId(null);
    }
  };

  const openScheduleModal = (u) => {
    setScheduleModalUser(u);
    setScheduleForm({
      assignedLevel: u.assignedLevel || 'foundation',
      scheduleDays: Array.isArray(u.scheduleDays) && u.scheduleDays.length ? u.scheduleDays : ['السبت', 'الثلاثاء'],
      sessionTime: u.sessionTime || '18:00',
    });
  };

  // ── دروس الطالب الفورية (المنشأة من البث المباشر) ──
  const openLessonsModal = async (u) => {
    setLessonsModalUser(u);
    setLessons([]);
    setEditingLessonId(null);
    setLessonsLoading(true);
    try {
      const res = await api.get(`/study-plans/student/${u._id}/full`);
      const list = res.data?.plan?.customLessons || [];
      setLessons([...list].reverse()); // الأحدث أولاً
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
    if (!lessonsModalUser || !editingLessonId) return;
    setSavingLessonId(editingLessonId);
    try {
      await api.put(
        `/study-plans/student/${lessonsModalUser._id}/lessons/${editingLessonId}`,
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

  // تحميل تقرير الطالب (حضور + امتحانات) للطباعة/الحفظ
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

  // ── ملف مراجعة الطالب: الاستبيان + التسجيلات الصوتية الشفهية ──
  const openReviewModal = async (u) => {
    setReviewUser(u);
    setReviewLoading(true);
    setReviewData({ surveyAnswers: [], audioList: [], writtenScore: null, writtenPercentage: null, status: null });
    try {
      const res = await api.get(`/exams/results/student/${u._id}`).catch(() => null);
      const results = res?.data?.results || [];
      // نتيجة التحديد (الأولوية لمن لديه تسجيلات شفهية)
      let placement = null;
      for (const r of results) {
        const isPlacement = r.examType === 'placement' || r.examType === 'oral' || r.exam?.type === 'placement';
        if (!isPlacement) continue;
        if (!placement || (!placement.oralRecordings?.length && r.oralRecordings?.length)) placement = r;
      }
      // إجابات الاستبيان: من النتيجة أولاً ثم من بيانات المستخدم
      let surveyAnswers = placement?.surveyAnswers || [];
      if (!surveyAnswers.length && Array.isArray(u.surveyAnswers)) surveyAnswers = u.surveyAnswers;
      // التسجيلات الصوتية: من النتيجة + بيانات المستخدم (بدون تكرار)
      const audioSet = new Set();
      (placement?.oralRecordings || []).forEach(rec => { if (rec?.audioUrl) audioSet.add(rec.audioUrl); });
      (u.oralExamRecordings || []).forEach(url => { if (url) audioSet.add(url); });
      setReviewData({
        surveyAnswers,
        audioList: [...audioSet],
        writtenScore: placement?.writtenScore ?? null,
        writtenPercentage: placement?.writtenPercentage ?? u.placementExamScore ?? null,
        status: placement?.status || null,
      });
    } catch {
      toast.error('تعذر جلب ملف المراجعة');
    } finally {
      setReviewLoading(false);
    }
  };

  const openScheduleFromReview = () => {
    if (!reviewUser) return;
    const u = reviewUser;
    setReviewUser(null);
    openScheduleModal(u);
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
    if (!lessonsModalUser || !examModalLesson) return;
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
      // 1. إنشاء الامتحان فردياً للطالب وربطه بالحصة
      const payload = {
        title,
        type: 'lesson',
        targetType: 'individual',
        targetStudent: lessonsModalUser._id,
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
      // 2. ربط الامتحان بالحصة ليظهر للطالب في الحصص السابقة
      await api.put(
        `/study-plans/student/${lessonsModalUser._id}/lessons/${examModalLesson._id}`,
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

  const toggleScheduleDay = (day) => {
    setScheduleForm(prev => {
      const exists = prev.scheduleDays.includes(day);
      return {
        ...prev,
        scheduleDays: exists
          ? prev.scheduleDays.filter(d => d !== day)
          : [...prev.scheduleDays, day],
      };
    });
  };

  const handleSaveSchedule = async () => {
    if (!scheduleModalUser) return;
    if (!scheduleForm.scheduleDays.length) {
      return toast.error('يرجى تحديد يوم واحد على الأقل للبث');
    }
    // منع محلي فوري: نفس اليوم والساعة محجوزان لطالب آخر
    const clashes = scheduleConflicts(scheduleModalUser._id, scheduleForm.scheduleDays, scheduleForm.sessionTime);
    if (clashes.length) {
      const c = clashes[0];
      const day = (c.scheduleDays || []).find(d => scheduleForm.scheduleDays.includes(d));
      return toast.error(`تعارض في الموعد: الطالب ${c.firstName} ${c.lastName} محجوز يوم ${day} الساعة ${formatTime12Ar(c.sessionTime)} — اختر وقتاً آخر`);
    }
    setActingId(scheduleModalUser._id);
    try {
      await api.put(`/users/${scheduleModalUser._id}/approve`, scheduleForm);
      toast.success('تم حفظ المستوى والمواعيد واعتماد الطالب بنجاح');
      setScheduleModalUser(null);
      await fetchData();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'خطأ في حفظ المواعيد');
    } finally {
      setActingId(null);
    }
  };

  // نفس اليوم + نفس الساعة والدقيقة لطالب آخر نشط → تعارض (من الخريطة الكاملة)
  const scheduleConflicts = (excludeId, days, time) => {
    if (!time || !days?.length) return [];
    return scheduleMap.filter(u =>
      u._id !== excludeId &&
      (u.scheduleDays || []).some(d => days.includes(d)) &&
      u.sessionTime === time
    );
  };

  const isSelf = (u) => me?._id && u._id === me._id;

  // مودالا التأكيد (الدور والحذف)
  const [roleConfirm, setRoleConfirm] = useState(null); // { user, newRole, roleLabel }
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const handleRoleChange = async () => {
    if (!roleConfirm) return;
    const { user: u, newRole, roleLabel } = roleConfirm;
    setRoleConfirm(null);
    setActingId(u._id);
    try {
      await api.put(`/users/${u._id}`, { role: newRole });
      toast.success(`تم تغيير الدور إلى ${roleLabel}`);
      await fetchData();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'خطأ في تغيير الدور');
    }
    finally { setActingId(null); }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    const u = deleteConfirm;
    setDeleteConfirm(null);
    setActingId(u._id);
    try {
      await api.delete(`/users/${u._id}`);
      toast.success('تم حذف المستخدم نهائياً');
      await fetchData();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'خطأ في الحذف');
    }
    finally { setActingId(null); }
  };

  const statusOf = (u) => {
    if (u.isActive === false) return { key: 'inactive', label: 'معطل', tone: 'neutral' };
    if (u.role === 'student' && !u.isApproved) return { key: 'pending', label: 'بانتظار الاعتماد', tone: 'gold' };
    return { key: 'active', label: 'نشط', tone: 'mentor' };
  };

  const selectStyle = {
    background: HQ.SURFACE, border: `1px solid ${HQ.LINE}`, borderRadius: 12,
    padding: '0 12px', minHeight: 48, fontSize: 14, color: HQ.INK, fontFamily: 'inherit',
  };

  return (
    <PageLayout>
      <div className="halaqa" style={{ maxWidth: 860, margin: '0 auto' }}>
        <h1 style={{ margin: '0 0 4px', fontSize: 26, fontWeight: 900, color: HQ.INK }}>المستخدمون</h1>
        <p style={{ margin: '0 0 16px', fontSize: 14, color: HQ.MUTED }}>
          {totalItems} مستخدم مسجل{pendingCount ? ` · ${pendingCount} بانتظار الاعتماد` : ''} — قبول، تغيير أدوار، وحذف نهائي من مكان واحد
        </p>

        {/* Search & filters */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
            <Search size={16} color={HQ.MUTED} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)' }} />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="بحث بالاسم أو البريد..." aria-label="بحث عن مستخدم"
              style={{ ...selectStyle, width: '100%', paddingRight: 38 }} />
          </div>
          <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)} aria-label="تصفية بالدور" style={{ ...selectStyle, minWidth: 140 }}>
            <option value="">جميع الأدوار</option>
            <option value="student">الطلاب</option>
            <option value="teacher">المعلمون</option>
            <option value="parent">أولياء الأمور</option>
            <option value="admin">المديرون</option>
          </select>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} aria-label="تصفية بالحالة" style={{ ...selectStyle, minWidth: 140 }}>
            <option value="">جميع الحالات</option>
            <option value="pending">بانتظار الاعتماد</option>
            <option value="active">نشط</option>
            <option value="inactive">معطل</option>
          </select>
        </div>

        {isLoading ? (
          <div aria-label="جارٍ تحميل المستخدمين">
            <div className="hq-skeleton" style={{ height: 76, width: '100%', marginBottom: 10 }} />
            <div className="hq-skeleton" style={{ height: 76, width: '100%', marginBottom: 10 }} />
            <div className="hq-skeleton" style={{ height: 76, width: '100%' }} />
          </div>
        ) : loadFailed && users.length === 0 ? (
          <div style={{ background: HQ.SURFACE, border: `1px solid ${HQ.LINE}`, borderRadius: 18, padding: 40, textAlign: 'center' }} role="alert">
            <p style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 900, color: HQ.INK }}>تعذّر تحميل البيانات</p>
            <p style={{ margin: '0 0 20px', fontSize: 14, color: HQ.MUTED }}>تحقق من الاتصال ثم حاول مرة أخرى.</p>
            <button type="button" onClick={fetchData} className="hq-action" style={{ background: HQ.MENTOR, color: '#fff', padding: '0 24px', fontSize: 15 }}>
              <RotateCcw size={16} /> إعادة المحاولة
            </button>
          </div>
        ) : users.length === 0 ? (
          <div style={{ background: HQ.SURFACE, border: `1px solid ${HQ.LINE}`, borderRadius: 18, padding: 40, textAlign: 'center' }}>
            <CheckCircle size={40} color={HQ.MENTOR} style={{ margin: '0 auto 12px' }} />
            <p style={{ margin: 0, fontSize: 16, fontWeight: 800, color: HQ.INK }}>لا نتائج مطابقة للبحث</p>
          </div>
        ) : (
          <>
            <ol style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {users.map((u) => {
                const st = statusOf(u);
                const self = isSelf(u);
                return (
                  <li key={u._id} style={{ background: HQ.SURFACE, border: `1px solid ${HQ.LINE}`, borderRadius: 18, marginBottom: 12, padding: 16 }}>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                      <HqAvatar firstName={u.firstName} lastName={u.lastName} size={48} />
                      <div style={{ flex: 1, minWidth: 200 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 2 }}>
                          <strong style={{ fontSize: 16, color: HQ.INK }}>{u.firstName} {u.lastName}</strong>
                          <HqBadge tone={ROLE_TONE[u.role] || 'neutral'}>{ROLE_LABEL[u.role] || u.role}</HqBadge>
                          {u.assignedLevel && <HqBadge tone="mentor">{getLevelLabel(u.assignedLevel)}</HqBadge>}
                          <HqBadge tone={st.tone}>{st.label}</HqBadge>
                          {self && <HqBadge tone="gold">حسابك</HqBadge>}
                        </div>
                        <p style={{ margin: 0, fontSize: 13, color: HQ.MUTED, direction: 'ltr', textAlign: 'right', overflowWrap: 'anywhere', maxWidth: '100%' }}>{u.email}</p>
                        <p style={{ margin: '4px 0 0', fontSize: 13, color: HQ.MUTED }}>
                          {u.country ? `${u.country} · ` : ''}
                          {u.placementExamScore !== undefined ? `الاختبار: ${u.placementExamScore}% · ` : ''}
                          {formatDateAr(u.createdAt)}
                        </p>
                        {u.role === 'student' && (
                          <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', fontSize: 13, color: HQ.INK }}>
                            <Clock size={14} color={HQ.MENTOR} />
                            <span style={{ fontWeight: 800 }}>مواعيد البث:</span>
                            {u.scheduleDays?.length ? (
                              <span style={{ color: HQ.MENTOR, fontWeight: 700 }}>
                                {u.scheduleDays.join('، ')} {u.sessionTime ? `(الساعة ${formatTime12Ar(u.sessionTime)})` : ''}
                              </span>
                            ) : (
                              <span style={{ color: HQ.MUTED }}>لم تُجدول المواعيد بعد</span>
                            )}
                          </div>
                        )}
                      </div>
                      {/* Actions — primary first, the rest behind "المزيد" */}
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', width: '100%', marginTop: 8 }}>
                        {u.role === 'student' && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleStartLive(u)}
                              disabled={actingId === u._id}
                              className="hq-action"
                              style={{ background: HQ.MENTOR, color: '#fff', padding: '0 14px', fontSize: 14, display: 'inline-flex', alignItems: 'center', gap: 6 }}
                              title="بدء بث مباشر وتوليد درس فوري لهذا الطالب"
                            >
                              <Radio size={16} /> بدء بث مباشر مع الطالب
                            </button>
                            <button
                              type="button"
                              onClick={() => openScheduleModal(u)}
                              disabled={actingId === u._id}
                              className="hq-action"
                              style={{ background: HQ.PAPER, border: `1px solid ${HQ.LINE}`, color: HQ.INK, padding: '0 14px', fontSize: 14, display: 'inline-flex', alignItems: 'center', gap: 6 }}
                              title="تحديد المستوى وجدولة أيام وساعة البث"
                            >
                              <Calendar size={16} /> تحديد المستوى والجدولة
                            </button>
                          </>
                        )}
                        <button
                          type="button"
                          onClick={() => setExpandedId(expandedId === u._id ? null : u._id)}
                          aria-expanded={expandedId === u._id}
                          className="hq-action"
                          style={{ background: HQ.PAPER, border: `1px solid ${HQ.LINE}`, color: HQ.MUTED, padding: '0 14px', fontSize: 14 }}
                        >
                          {expandedId === u._id ? 'إخفاء' : 'المزيد ···'}
                        </button>
                      </div>
                      {expandedId === u._id && (
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', width: '100%', marginTop: 8, paddingTop: 8, borderTop: `1px dashed ${HQ.LINE}` }}>
                          {u.role === 'student' && (
                            <>
                              <button
                                type="button"
                                onClick={() => openLessonsModal(u)}
                                className="hq-action"
                                style={{ background: HQ.PAPER, border: `1px solid ${HQ.MENTOR}`, color: HQ.MENTOR, padding: '0 14px', fontSize: 14, display: 'inline-flex', alignItems: 'center', gap: 6 }}
                                title="عرض الدروس الفورية المنشأة من البث المباشر — تعديل المصادر ودخول المناقشة"
                              >
                                <BookOpen size={16} /> دروس الطالب
                              </button>
                              <button
                                type="button"
                                onClick={() => openReviewModal(u)}
                                className="hq-action"
                                style={{ background: '#FBF7EE', border: '1px solid #B45309', color: '#B45309', padding: '0 14px', fontSize: 14, display: 'inline-flex', alignItems: 'center', gap: 6 }}
                                title="عرض إجابات الاستبيان والاستماع للتسجيلات الشفهية قبل تحديد المستوى"
                              >
                                <ClipboardList size={16} /> ملف المراجعة
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDownloadReport(u)}
                                disabled={reportId === u._id}
                                className="hq-action"
                                style={{ background: HQ.PAPER, border: `1px solid ${HQ.LINE}`, color: HQ.INK, padding: '0 14px', fontSize: 14, display: 'inline-flex', alignItems: 'center', gap: 6 }}
                                title="تحميل تقرير الطالب (الحضور ونتائج الامتحانات) للطباعة أو الحفظ"
                              >
                                {reportId === u._id ? <LoadingSpinner size="sm" /> : <><Download size={16} /> تقرير</>}
                              </button>
                            </>
                          )}
                          <select value={u.role}
                            onChange={(e) => {
                              const newRole = e.target.value;
                              if (!newRole || newRole === u.role) return;
                              setRoleConfirm({
                                user: u,
                                newRole,
                                roleLabel: ROLE_OPTIONS.find(r => r.value === newRole)?.label || newRole,
                              });
                            }}
                            disabled={self || actingId === u._id}
                            aria-label={`دور ${u.firstName}`}
                            title={self ? 'لا يمكنك تغيير دور حسابك الخاص' : 'تغيير الدور'}
                            style={{ ...selectStyle, minWidth: 130, opacity: self ? 0.5 : 1 }}>
                            {ROLE_OPTIONS.map(r => (
                              <option key={r.value} value={r.value}>{r.label}</option>
                            ))}
                          </select>
                          <button type="button" onClick={() => setDeleteConfirm(u)}
                            disabled={self || actingId === u._id}
                            aria-label={`حذف ${u.firstName} نهائياً`}
                            title={self ? 'لا يمكنك حذف حسابك الخاص' : 'حذف نهائي — لا يمكن التراجع'}
                            className="hq-action" style={{ background: HQ.PAPER, border: '1px solid #C2410C', color: '#C2410C', padding: '0 14px', fontSize: 14, opacity: self ? 0.5 : 1 }}>
                            {actingId === u._id ? <LoadingSpinner size="sm" /> : <><Trash2 size={16} /> حذف نهائي</>}
                          </button>
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={totalItems}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
              onPageSizeChange={(s) => { setPageSize(s); setCurrentPage(1); }}
              showPageSize={true}
              pageSizeOptions={[5, 10, 20, 50]}
              itemName="مستخدم"
              className="pt-2"
            />
          </>
        )}

        {/* Schedule & Approval Modal */}
        {scheduleModalUser && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
            <div style={{ background: HQ.SURFACE, borderRadius: 20, padding: 24, maxWidth: 500, width: '100%', border: `1px solid ${HQ.LINE}`, boxShadow: '0 10px 30px rgba(0,0,0,0.2)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: HQ.INK }}>
                  جدولة مواعيد البث واعتماد الطالب
                </h3>
                <button type="button" onClick={() => setScheduleModalUser(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: HQ.MUTED }}>
                  <X size={20} />
                </button>
              </div>

              <p style={{ margin: '0 0 16px', fontSize: 14, color: HQ.MUTED }}>
                الطالب: <strong>{scheduleModalUser.firstName} {scheduleModalUser.lastName}</strong> ({scheduleModalUser.email})
              </p>

              {/* Level */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 800, color: HQ.INK, marginBottom: 6 }}>
                  المستوى المعتمد
                </label>
                <select
                  value={scheduleForm.assignedLevel}
                  onChange={e => setScheduleForm(p => ({ ...p, assignedLevel: e.target.value }))}
                  style={{ ...selectStyle, width: '100%' }}
                >
                  <option value="foundation">المستوى التأسيسي</option>
                  <option value="memorization">مستوى الحفظ والتجويد</option>
                  <option value="teacher_prep">إعداد معلمين</option>
                  <option value="senior">كبار السن</option>
                </select>
              </div>

              {/* Days */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 800, color: HQ.INK, marginBottom: 8 }}>
                  أيام البث الأسبوعية المحددة للطالب
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {WEEK_DAYS.map(day => {
                    const selected = scheduleForm.scheduleDays.includes(day);
                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() => toggleScheduleDay(day)}
                        style={{
                          padding: '8px 14px',
                          borderRadius: 10,
                          fontSize: 13,
                          fontWeight: 700,
                          cursor: 'pointer',
                          border: `1px solid ${selected ? HQ.MENTOR : HQ.LINE}`,
                          background: selected ? HQ.MENTOR : HQ.PAPER,
                          color: selected ? '#fff' : HQ.INK,
                          transition: 'all 0.2s',
                        }}
                      >
                        {day}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Hour — 12h picker */}
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 800, color: HQ.INK, marginBottom: 6 }}>
                  ساعة بدء البث المباشر
                </label>
                <SessionTimePicker
                  value={scheduleForm.sessionTime}
                  onChange={v => setScheduleForm(p => ({ ...p, sessionTime: v }))}
                />
                {scheduleModalUser && scheduleConflicts(scheduleModalUser._id, scheduleForm.scheduleDays, scheduleForm.sessionTime).length > 0 && (
                  <div role="alert" style={{ marginTop: 8, background: '#FDECEC', border: '1px solid #C2410C', borderRadius: 12, padding: '10px 14px', fontSize: 13, fontWeight: 700, color: '#C2410C', lineHeight: 1.8 }}>
                    ⛔ هذا الموعد محجوز:
                    {scheduleConflicts(scheduleModalUser._id, scheduleForm.scheduleDays, scheduleForm.sessionTime).slice(0, 3).map(c => {
                      const day = (c.scheduleDays || []).find(d => scheduleForm.scheduleDays.includes(d));
                      return <span key={c._id} style={{ display: 'block' }}>• {c.firstName} {c.lastName} — يوم {day} الساعة {formatTime12Ar(c.sessionTime)}</span>;
                    })}
                    اختر يوماً أو وقتاً آخر.
                  </div>
                )}
              </div>

              <div className="m-modal-actions" style={{ display: 'flex', gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setScheduleModalUser(null)}
                  className="hq-action"
                  style={{ flex: 1, background: HQ.PAPER, border: `1px solid ${HQ.LINE}`, color: HQ.INK, fontSize: 14 }}
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  onClick={handleSaveSchedule}
                  disabled={actingId === scheduleModalUser._id}
                  className="hq-action"
                  style={{ flex: 1, background: HQ.MENTOR, color: '#fff', fontSize: 14 }}
                >
                  {actingId === scheduleModalUser._id ? <LoadingSpinner size="sm" /> : 'حفظ المواعيد واعتماد الطالب'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Start Live + Instant Lesson Modal */}
        {liveModalUser && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
            <div style={{ background: HQ.SURFACE, borderRadius: 20, padding: 24, maxWidth: 500, width: '100%', border: `1px solid ${HQ.LINE}`, boxShadow: '0 10px 30px rgba(0,0,0,0.2)', maxHeight: '90vh', overflowY: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: HQ.INK, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Radio size={18} color={HQ.MENTOR} /> بدء بث مباشر ودرس فوري
                </h3>
                <button type="button" onClick={() => setLiveModalUser(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: HQ.MUTED }}>
                  <X size={20} />
                </button>
              </div>

              <p style={{ margin: '0 0 16px', fontSize: 14, color: HQ.MUTED }}>
                الطالب: <strong>{liveModalUser.firstName} {liveModalUser.lastName}</strong> ({liveModalUser.email})
              </p>

              {/* Lesson title */}
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 800, color: HQ.INK, marginBottom: 6 }}>
                  اسم الدرس <span style={{ color: HQ.MUTED, fontWeight: 500 }}>(اختياري — يُولّد تلقائياً إذا تُرك فارغاً)</span>
                </label>
                <input
                  type="text"
                  value={liveForm.title}
                  onChange={e => setLiveForm(p => ({ ...p, title: e.target.value }))}
                  placeholder="مثال: تلاوة سورة البقرة — أحكام المد"
                  style={{ ...selectStyle, width: '100%' }}
                />
              </div>

              {/* Sources — optional */}
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 800, color: HQ.INK, marginBottom: 6 }}>
                  المصادر <span style={{ color: HQ.MUTED, fontWeight: 500 }}>(اختياري)</span>
                </label>
                <textarea
                  value={liveForm.resources}
                  onChange={e => setLiveForm(p => ({ ...p, resources: e.target.value }))}
                  placeholder="روابط ملفات، مصحف، مراجع تجويد... (سطر لكل مصدر)"
                  rows={3}
                  style={{ ...selectStyle, width: '100%', minHeight: 80, paddingTop: 10, paddingBottom: 10, resize: 'vertical', lineHeight: 1.6 }}
                />
                <p style={{ margin: '4px 0 0', fontSize: 12, color: HQ.MUTED }}>تُحفظ مع الدرس الفوري وتظهر للطالب في منهجه.</p>
              </div>

              {/* Notes — optional */}
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 800, color: HQ.INK, marginBottom: 6 }}>
                  ملاحظات للدرس <span style={{ color: HQ.MUTED, fontWeight: 500 }}>(اختياري)</span>
                </label>
                <textarea
                  value={liveForm.description}
                  onChange={e => setLiveForm(p => ({ ...p, description: e.target.value }))}
                  placeholder="توجيهات أو نقاط التركيز في هذه الجلسة..."
                  rows={2}
                  style={{ ...selectStyle, width: '100%', minHeight: 64, paddingTop: 10, paddingBottom: 10, resize: 'vertical', lineHeight: 1.6 }}
                />
              </div>

              <div className="m-modal-actions" style={{ display: 'flex', gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setLiveModalUser(null)}
                  className="hq-action"
                  style={{ flex: 1, background: HQ.PAPER, border: `1px solid ${HQ.LINE}`, color: HQ.INK, fontSize: 14 }}
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  onClick={handleConfirmLive}
                  disabled={actingId === liveModalUser._id}
                  className="hq-action"
                  style={{ flex: 1, background: HQ.MENTOR, color: '#fff', fontSize: 14 }}
                >
                  {actingId === liveModalUser._id ? <LoadingSpinner size="sm" /> : <><Radio size={16} /> بدء البث وإنشاء الدرس</>}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Student Instant Lessons Modal */}
        {lessonsModalUser && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
            <div style={{ background: HQ.SURFACE, borderRadius: 20, padding: 24, maxWidth: 640, width: '100%', border: `1px solid ${HQ.LINE}`, boxShadow: '0 10px 30px rgba(0,0,0,0.2)', maxHeight: '90vh', overflowY: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: HQ.INK, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <BookOpen size={18} color={HQ.MENTOR} /> الدروس الفورية للطالب
                </h3>
                <button type="button" onClick={() => { setLessonsModalUser(null); setEditingLessonId(null); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: HQ.MUTED }}>
                  <X size={20} />
                </button>
              </div>

              <p style={{ margin: '0 0 16px', fontSize: 14, color: HQ.MUTED }}>
                الطالب: <strong>{lessonsModalUser.firstName} {lessonsModalUser.lastName}</strong> ({lessonsModalUser.email})
                {lessons.length > 0 && ` — ${lessons.length} درس`}
              </p>

              {lessonsLoading ? (
                <div style={{ textAlign: 'center', padding: 32 }}>
                  <LoadingSpinner size="md" text="جارٍ جلب الدروس..." />
                </div>
              ) : lessons.length === 0 ? (
                <div style={{ background: HQ.PAPER, border: `1px solid ${HQ.LINE}`, borderRadius: 14, padding: 24, textAlign: 'center' }}>
                  <BookOpen size={32} color={HQ.LINE} style={{ margin: '0 auto 8px' }} />
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: HQ.INK }}>لا توجد دروس فورية بعد</p>
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

        {/* Student Review File Modal: survey + oral audio + level decision */}
        {reviewUser && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
            <div style={{ background: HQ.SURFACE, borderRadius: 20, padding: 24, maxWidth: 640, width: '100%', border: `1px solid ${HQ.LINE}`, boxShadow: '0 10px 30px rgba(0,0,0,0.2)', maxHeight: '90vh', overflowY: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: HQ.INK, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <ClipboardList size={18} color="#B45309" /> ملف مراجعة الطالب
                </h3>
                <button type="button" onClick={() => setReviewUser(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: HQ.MUTED }}>
                  <X size={20} />
                </button>
              </div>

              <p style={{ margin: '0 0 4px', fontSize: 14, color: HQ.MUTED }}>
                الطالب: <strong>{reviewUser.firstName} {reviewUser.lastName}</strong> ({reviewUser.email})
              </p>
              {reviewData.writtenPercentage !== null && reviewData.writtenPercentage !== undefined && (
                <p style={{ margin: '0 0 16px', fontSize: 14, color: HQ.INK }}>
                  درجة الامتحان التحريري: <strong style={{ color: HQ.MENTOR }}>{reviewData.writtenPercentage}%</strong>
                  {reviewData.writtenScore !== null && reviewData.writtenScore !== undefined && ` (الدرجة: ${reviewData.writtenScore})`}
                </p>
              )}
              {!(reviewData.writtenPercentage !== null && reviewData.writtenPercentage !== undefined) && (
                <div style={{ height: 16 }} />
              )}

              {reviewLoading ? (
                <div style={{ textAlign: 'center', padding: 32 }}>
                  <LoadingSpinner size="md" text="جارٍ جلب ملف المراجعة..." />
                </div>
              ) : (
                <>
                  {/* Survey answers */}
                  <h4 style={{ margin: '0 0 8px', fontSize: 15, fontWeight: 900, color: HQ.INK }}>
                    إجابات الاستبيان ({reviewData.surveyAnswers.length})
                  </h4>
                  {reviewData.surveyAnswers.length === 0 ? (
                    <p style={{ margin: '0 0 16px', fontSize: 13, color: HQ.MUTED }}>لا توجد إجابات استبيان مسجلة لهذا الطالب.</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                      {reviewData.surveyAnswers.map((sa, idx) => (
                        <div key={idx} style={{ background: HQ.PAPER, border: `1px solid ${HQ.LINE}`, borderRadius: 12, padding: '10px 14px' }}>
                          <p style={{ margin: '0 0 2px', fontSize: 12, fontWeight: 700, color: HQ.MUTED }}>
                            س{idx + 1}: {sa.questionText || sa.questionId || 'سؤال الاستبيان'}
                          </p>
                          <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: HQ.INK }}>
                            {sa.answerText || sa.answer || '—'}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Oral recordings */}
                  <h4 style={{ margin: '0 0 8px', fontSize: 15, fontWeight: 900, color: HQ.INK }}>
                    التسجيلات الصوتية للامتحان الشفهي ({reviewData.audioList.length})
                  </h4>
                  {reviewData.audioList.length === 0 ? (
                    <p style={{ margin: '0 0 16px', fontSize: 13, color: HQ.MUTED }}>لم يرفع الطالب أي تسجيل شفهي بعد.</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                      {reviewData.audioList.map((url, idx) => (
                        <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, background: HQ.PAPER, border: `1px solid ${HQ.LINE}`, borderRadius: 12, padding: '8px 12px', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 13, fontWeight: 800, color: HQ.INK }}>التسجيل {idx + 1}</span>
                          <audio src={url} controls style={{ height: 36, flex: 1, minWidth: 220 }} />
                        </div>
                      ))}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={openScheduleFromReview}
                    className="hq-action"
                    style={{ width: '100%', background: HQ.MENTOR, color: '#fff', fontSize: 15 }}
                  >
                    <Calendar size={16} /> تحديد المستوى والجدولة لهذا الطالب
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* Per-lesson exam creation modal */}
        {examModalLesson && lessonsModalUser && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
            <div style={{ background: HQ.SURFACE, borderRadius: 20, padding: 24, maxWidth: 640, width: '100%', border: `1px solid ${HQ.LINE}`, boxShadow: '0 10px 30px rgba(0,0,0,0.25)', maxHeight: '90vh', overflowY: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: HQ.INK, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Award size={18} color="#B45309" /> اختبار جديد للحصة
                </h3>
                <button type="button" onClick={() => setExamModalLesson(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: HQ.MUTED }}>
                  <X size={20} />
                </button>
              </div>

              <p style={{ margin: '0 0 16px', fontSize: 13, color: HQ.MUTED }}>
                الحصة: <strong>{examModalLesson.title}</strong> · الطالب: <strong>{lessonsModalUser.firstName} {lessonsModalUser.lastName}</strong>
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
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#C2410C', display: 'inline-flex', padding: 6 }}
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
                              {q.correctAnswer === oi && <CheckCircle size={15} />}
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

        {/* Role change confirm */}
        <ConfirmModal
          open={Boolean(roleConfirm)}
          title="تغيير الدور؟"
          message={roleConfirm ? `تغيير دور ${roleConfirm.user.firstName} ${roleConfirm.user.lastName} إلى "${roleConfirm.roleLabel}"؟` : ''}
          confirmLabel="تغيير"
          busy={actingId === roleConfirm?.user._id}
          onConfirm={handleRoleChange}
          onClose={() => setRoleConfirm(null)}
        />

        {/* Delete confirm */}
        <ConfirmModal
          open={Boolean(deleteConfirm)}
          title="حذف نهائي؟"
          message={deleteConfirm ? `حذف ${deleteConfirm.firstName} ${deleteConfirm.lastName} نهائياً؟ لا يمكن التراجع عن هذا الإجراء.` : ''}
          confirmLabel="حذف نهائي"
          danger
          busy={actingId === deleteConfirm?._id}
          onConfirm={handleDelete}
          onClose={() => setDeleteConfirm(null)}
        />
      </div>
    </PageLayout>
  );
}
