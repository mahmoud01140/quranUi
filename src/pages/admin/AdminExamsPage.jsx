import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText, Plus, Search, Trash2, Eye, BarChart2,
  Target, GraduationCap, X, Check,
  UserCheck, BookOpen, Send,
} from 'lucide-react';
import toast from 'react-hot-toast';
import PageLayout from '../../components/shared/PageLayout';
import useAuthStore from '../../store/authStore';
import useExamStore from '../../store/examStore';
import LoadingSpinner from '../../components/shared/LoadingSpinner';
import api from '../../services/api';
import QURAN_SURAHS from '../../utils/quranData';
import { formatDateAr } from '../../utils/helpers';
import '../../components/halaqa/halaqa.css';
import { HQ, HqBadge } from '../../components/halaqa/primitives';

/* بنك الامتحانات — مخزن مستقل بلا مجموعات:
   إنشاء امتحان بنك غير مرتبط بشيء (مخفي عن الطلاب)، ثم وضعه
   على حصة من الخطة الفردية لطالب معين أو إسناده مباشرة له. */

const FILTERS = [
  { id: 'all', label: 'الكل', icon: FileText },
  { id: 'bank', label: 'البنك (غير مُسند)', icon: BookOpen },
  { id: 'individual', label: 'فردية مُسندة', icon: Target },
  { id: 'level', label: 'امتحانات المستويات', icon: GraduationCap },
];

const LEVEL_LABELS = {
  foundation: 'المستوى التأسيسي',
  memorization: 'الحفظ والإتقان',
  teacher_prep: 'إعداد معلمين',
  senior: 'كبار السن',
  all: 'جميع المستويات',
};

const QUESTION_TYPES = [
  { value: 'mcq', label: 'اختيار من متعدد' },
  { value: 'true_false', label: 'صح / خطأ' },
  { value: 'written', label: 'كتابي' },
  { value: 'recitation', label: 'شفهي / تسميع' },
];

const EMPTY_Q = {
  type: 'mcq', text: '', options: ['', '', '', ''], correctAnswer: 0,
  correctAnswerBool: true, correctAnswerText: '', points: 1, instruction: '',
  surahNumber: '', fromVerse: '', toVerse: '', mode: 'practice',
};

const targetOf = (exam) => exam.targetType || 'bank';

/* غلاف مودال موحد: dialog دلالي + إغلاق بالـ Escape + إغلاق بالنقر خارج البطاقة */
function Modal({ title, onClose, children, maxWidth = 560, labelledBy }) {
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 16 }}>
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

export default function AdminExamsPage() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const { adminExams, fetchAdminAllExams, deleteGroupExam, createBankExam, assignExamToLesson, isLoading } = useExamStore();
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [deletingId, setDeletingId] = useState(null);
  const [confirmDeleteModal, setConfirmDeleteModal] = useState(null);

  // إنشاء امتحان بنك
  const [showCreate, setShowCreate] = useState(false);
  const [savingCreate, setSavingCreate] = useState(false);
  const [bankForm, setBankForm] = useState({ title: '', duration: 30, passingScore: 60, questions: [{ ...EMPTY_Q }] });

  // وضع امتحان على حصة طالب
  const [assignExam, setAssignExam] = useState(null);
  const [students, setStudents] = useState([]);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [studentQuery, setStudentQuery] = useState('');
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [planLessons, setPlanLessons] = useState([]);
  const [lessonsLoading, setLessonsLoading] = useState(false);
  const [selectedLessonId, setSelectedLessonId] = useState('');
  const [assigning, setAssigning] = useState(false);

  useEffect(() => {
    fetchAdminAllExams();
  }, []);

  const handleDelete = async (examId) => {
    setDeletingId(examId);
    try {
      await deleteGroupExam(examId);
      toast.success('تم حذف الامتحان بنجاح');
      setConfirmDeleteModal(null);
      fetchAdminAllExams();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'تعذر حذف الامتحان');
    } finally {
      setDeletingId(null);
    }
  };

  const counts = useMemo(() => ({
    all: adminExams.length,
    bank: adminExams.filter(e => targetOf(e) === 'bank').length,
    individual: adminExams.filter(e => e.targetType === 'individual').length,
    level: adminExams.filter(e => e.targetType === 'level').length,
  }), [adminExams]);

  const filteredExams = useMemo(() => {
    return adminExams.filter((exam) => {
      if (selectedFilter !== 'all' && targetOf(exam) !== selectedFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const titleMatch = exam.title?.toLowerCase().includes(q);
        const studentMatch = exam.targetStudent &&
          `${exam.targetStudent.firstName} ${exam.targetStudent.lastName} ${exam.targetStudent.email || ''}`.toLowerCase().includes(q);
        const lessonMatch = exam.lessonTitle?.toLowerCase().includes(q);
        return titleMatch || studentMatch || lessonMatch;
      }
      return true;
    });
  }, [adminExams, selectedFilter, searchQuery]);

  /* ── إنشاء امتحان بنك ── */
  const updateQ = (idx, fieldName, val) => {
    setBankForm(f => {
      const qs = [...f.questions];
      qs[idx] = { ...qs[idx], [fieldName]: val };
      if (fieldName === 'type') {
        qs[idx].options = val === 'mcq' ? ['', '', '', ''] : [];
      }
      return { ...f, questions: qs };
    });
  };

  const updateOption = (qi, oi, val) => {
    setBankForm(f => {
      const qs = [...f.questions];
      const opts = [...(qs[qi].options || [])];
      opts[oi] = val;
      qs[qi] = { ...qs[qi], options: opts };
      return { ...f, questions: qs };
    });
  };

  const handleCreateBank = async () => {
    if (!bankForm.title.trim()) return toast.error('أدخل عنوان الامتحان');
    if (!bankForm.questions.length) return toast.error('أضف سؤالاً واحداً على الأقل');
    if (bankForm.questions.some(q => !q.text.trim())) return toast.error('أكمل نص جميع الأسئلة');
    if (bankForm.questions.some(q => q.type === 'mcq' && q.options.some(o => !o.trim()))) {
      return toast.error('أكمل نص جميع خيارات أسئلة الاختيار');
    }
    setSavingCreate(true);
    try {
      await createBankExam({
        title: bankForm.title.trim(),
        type: 'lesson',
        duration: Number(bankForm.duration) || 30,
        passingScore: Number(bankForm.passingScore) || 60,
        allowRetries: true,
        questions: bankForm.questions.map(q => ({
          ...q,
          surahNumber: q.surahNumber ? Number(q.surahNumber) : undefined,
          fromVerse: q.fromVerse ? Number(q.fromVerse) : undefined,
          toVerse: q.toVerse ? Number(q.toVerse) : undefined,
        })),
      });
      toast.success('تم حفظ الامتحان في البنك — مخفي عن الطلاب حتى يُسند');
      setShowCreate(false);
      setBankForm({ title: '', duration: 30, passingScore: 60, questions: [{ ...EMPTY_Q }] });
      fetchAdminAllExams();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'خطأ في حفظ الامتحان');
    } finally {
      setSavingCreate(false);
    }
  };

  /* ── وضع امتحان على حصة طالب ── */
  const openAssign = async (exam) => {
    setAssignExam(exam);
    setStudentQuery('');
    setSelectedStudent(null);
    setPlanLessons([]);
    setSelectedLessonId('');
    setStudentsLoading(true);
    try {
      const res = await api.get('/users/students/list');
      setStudents(res.data.students || []);
    } catch {
      toast.error('تعذر جلب قائمة الطلاب');
      setStudents([]);
    } finally {
      setStudentsLoading(false);
    }
  };

  const pickStudent = async (student) => {
    setSelectedStudent(student);
    setSelectedLessonId('');
    setLessonsLoading(true);
    try {
      const res = await api.get(`/study-plans/student/${student._id}/full`);
      setPlanLessons(res.data.plan?.customLessons || []);
    } catch {
      toast.error('تعذر جلب الخطة الفردية للطالب');
      setPlanLessons([]);
    } finally {
      setLessonsLoading(false);
    }
  };

  const handleAssign = async () => {
    if (!assignExam || !selectedStudent) return;
    setAssigning(true);
    try {
      await assignExamToLesson(assignExam._id, {
        studentId: selectedStudent._id,
        lessonId: selectedLessonId || undefined,
      });
      toast.success(
        selectedLessonId
          ? `تم وضع الامتحان على حصة الطالب ${selectedStudent.firstName} ${selectedStudent.lastName}`
          : `تم إسناد الامتحان مباشرة للطالب ${selectedStudent.firstName} ${selectedStudent.lastName}`
      );
      setAssignExam(null);
      fetchAdminAllExams();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'خطأ في إسناد الامتحان');
    } finally {
      setAssigning(false);
    }
  };

  const visibleStudents = useMemo(() => {
    const q = studentQuery.trim().toLowerCase();
    if (!q) return students.slice(0, 30);
    return students.filter(s =>
      `${s.firstName || ''} ${s.lastName || ''} ${s.email || ''}`.toLowerCase().includes(q)
    ).slice(0, 30);
  }, [students, studentQuery]);

  const panel = {
    background: HQ.SURFACE, border: `1px solid ${HQ.LINE}`, borderRadius: 18, padding: 20,
  };
  const field = {
    width: '100%', minHeight: 48, background: HQ.SURFACE, color: HQ.INK,
    border: `1px solid ${HQ.LINE}`, borderRadius: 12, padding: '12px 16px',
    fontSize: 15, fontFamily: 'inherit', boxSizing: 'border-box',
  };
  const lbl = { fontSize: 13, fontWeight: 800, color: HQ.INK, marginBottom: 6, display: 'block' };
  const iconBtn = {
    minWidth: 44, minHeight: 44, borderRadius: 12, border: `1px solid ${HQ.LINE}`, background: HQ.SURFACE,
    color: HQ.MUTED, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  };

  const targetBadge = (exam) => {
    const t = targetOf(exam);
    if (t === 'bank') return <HqBadge tone="neutral">بنك — بانتظار الوضع</HqBadge>;
    if (t === 'individual') return <HqBadge tone="mentor">فردي مُسند</HqBadge>;
    return <HqBadge tone="guide">مستوى ({LEVEL_LABELS[exam.level] || 'عام'})</HqBadge>;
  };

  return (
    <PageLayout>
      <div className="halaqa" style={{ maxWidth: 1000, margin: '0 auto', paddingBottom: 48 }}>
        {/* Header — بلا صف إحصائيات */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: HQ.INK, margin: '0 0 4px' }}>
              بنك الامتحانات
            </h1>
            <p style={{ fontSize: 14, color: HQ.MUTED, margin: 0 }}>
              امتحانات مستقلة في البنك، تُسند لطالب على حصة من خطته الفردية أو مباشرة
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="hq-action m-full"
            style={{ background: HQ.MENTOR, color: '#fff', fontSize: 14, padding: '0 20px' }}
          >
            <Plus size={17} aria-hidden />
            <span>امتحان بنك جديد</span>
          </button>
        </div>

        {/* Filter and Search Bar */}
        <div style={{ ...panel, padding: 16, marginBottom: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="hq-tabs" role="tablist" aria-label="تصفية الامتحانات" style={{ display: 'flex', width: '100%' }}>
              {FILTERS.map((f) => {
                const Icon = f.icon;
                const isActive = selectedFilter === f.id;
                return (
                  <button
                    key={f.id}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => setSelectedFilter(f.id)}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'inherit' }}
                  >
                    <Icon size={14} aria-hidden />
                    <span>{f.label}</span>
                    <span style={{
                      fontSize: 12, fontWeight: 900, borderRadius: 9999, padding: '1px 8px',
                      background: isActive ? 'rgba(255,255,255,0.25)' : HQ.MENTOR_WASH,
                      color: isActive ? '#fff' : HQ.MENTOR_DEEP, fontVariantNumeric: 'tabular-nums',
                    }}>
                      {counts[f.id]}
                    </span>
                  </button>
                );
              })}
            </div>
            <div style={{ position: 'relative' }}>
              <Search size={15} color={HQ.MUTED} aria-hidden style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label="بحث بعنوان الامتحان أو الطالب أو الحصة"
                placeholder="ابحث بعنوان الامتحان أو الطالب أو الحصة..."
                style={{ ...field, paddingRight: 40 }}
              />
            </div>
          </div>
        </div>

        {/* Exams List */}
        {isLoading ? (
          <div style={{ padding: '64px 0', textAlign: 'center' }}>
            <LoadingSpinner size="lg" text="جارٍ تحميل بنك الامتحانات..." />
          </div>
        ) : filteredExams.length === 0 ? (
          <div style={{ ...panel, padding: 48, textAlign: 'center' }}>
            <span aria-hidden style={{
              width: 64, height: 64, borderRadius: 18, background: HQ.MENTOR_WASH, color: HQ.MENTOR,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px',
            }}>
              <FileText size={30} />
            </span>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: HQ.INK, margin: '0 0 4px' }}>
              {adminExams.length === 0 ? 'البنك فارغ — أنشئ أول امتحان' : 'لا توجد امتحانات مطابقة للبحث'}
            </h3>
            <p style={{ fontSize: 14, color: HQ.MUTED, margin: '0 0 20px' }}>
              امتحان البنك مستقل تماماً ومخفي عن الطلاب حتى تضعه على حصة أو تسنده مباشرة.
            </p>
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className="hq-action"
              style={{ background: HQ.MENTOR, color: '#fff', fontSize: 14, padding: '0 20px', margin: '0 auto' }}
            >
              <Plus size={15} aria-hidden />
              <span>امتحان بنك جديد</span>
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
            {filteredExams.map((exam) => {
              const isBank = targetOf(exam) === 'bank';
              return (
                <div key={exam._id} style={{ ...panel, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 12 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
                      {targetBadge(exam)}
                      <span style={{ fontSize: '0.8125rem', color: HQ.MUTED }}>
                        {formatDateAr(exam.createdAt)}
                      </span>
                    </div>

                    {exam.targetType === 'individual' && exam.targetStudent && (
                      <div style={{ marginBottom: 10, padding: 10, display: 'flex', alignItems: 'center', gap: 10, background: HQ.PAPER, borderRadius: 12 }}>
                        <span aria-hidden style={{
                          width: 32, height: 32, fontSize: 13, fontWeight: 800, flex: 'none', borderRadius: 9999,
                          background: HQ.MENTOR_WASH, color: HQ.MENTOR_DEEP,
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          {exam.targetStudent.firstName?.[0] || 'ط'}
                        </span>
                        <div style={{ minWidth: 0 }}>
                          <p style={{ fontSize: 13, fontWeight: 800, color: HQ.INK, margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {exam.targetStudent.firstName} {exam.targetStudent.lastName}
                          </p>
                          {exam.lessonTitle && (
                            <p style={{ fontSize: 12, color: HQ.MUTED, margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              على حصة: {exam.lessonTitle}
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    <h3 style={{ fontWeight: 800, fontSize: 16, color: HQ.INK, margin: '0 0 8px' }}>
                      {exam.title}
                    </h3>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, padding: '10px 0', marginBottom: 10, textAlign: 'center', borderTop: `1px solid ${HQ.LINE}`, borderBottom: `1px solid ${HQ.LINE}` }}>
                      <div>
                        <span style={{ display: 'block', fontSize: 12, color: HQ.MUTED }}>الأسئلة</span>
                        <span style={{ fontSize: 13, fontWeight: 800, color: HQ.INK, fontVariantNumeric: 'tabular-nums' }}>{exam.questions?.length || 0}</span>
                      </div>
                      <div>
                        <span style={{ display: 'block', fontSize: 12, color: HQ.MUTED }}>المدة</span>
                        <span style={{ fontSize: 13, fontWeight: 800, color: HQ.INK, fontVariantNumeric: 'tabular-nums' }}>{exam.duration} د</span>
                      </div>
                      <div>
                        <span style={{ display: 'block', fontSize: 12, color: HQ.MUTED }}>النجاح</span>
                        <span style={{ fontSize: 13, fontWeight: 800, color: HQ.INK, fontVariantNumeric: 'tabular-nums' }}>{exam.passingScore}%</span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12, borderRadius: 12, padding: 10, marginBottom: isBank ? 0 : 4, background: HQ.PAPER, color: HQ.MUTED }}>
                      <span>التسليمات: <strong style={{ color: HQ.INK, fontVariantNumeric: 'tabular-nums' }}>{exam.submissionsCount || 0}</strong></span>
                      <span>متوسط الدرجة: <strong style={{ color: HQ.MENTOR, fontVariantNumeric: 'tabular-nums' }}>{exam.averageScore || 0}%</strong></span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {isBank ? (
                      <button
                        type="button"
                        onClick={() => openAssign(exam)}
                        className="hq-action"
                        style={{ flex: 1, background: HQ.MENTOR, color: '#fff', fontSize: 13 }}
                      >
                        <Send size={14} aria-hidden />
                        <span>وضع للطالب</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => navigate(`/admin/exams/${exam._id}/results`)}
                        className="hq-action"
                        style={{ flex: 1, background: HQ.MENTOR, color: '#fff', fontSize: 13 }}
                      >
                        <BarChart2 size={14} aria-hidden />
                        <span>عرض النتائج</span>
                      </button>
                    )}
                    {user?.role === 'admin' && (
                      <button
                        type="button"
                        onClick={() => navigate(`/student/exams/${exam._id}/take`)}
                        title="معاينة كطالب"
                        aria-label={`معاينة ${exam.title} كطالب`}
                        style={iconBtn}
                      >
                        <Eye size={16} aria-hidden />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteModal(exam)}
                      title="حذف الامتحان"
                      aria-label={`حذف ${exam.title}`}
                      style={{ ...iconBtn, color: HQ.ERROR, borderColor: HQ.ERROR }}
                    >
                      <Trash2 size={16} aria-hidden />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── نافذة إنشاء امتحان بنك ── */}
        {showCreate && (
          <Modal title="امتحان بنك جديد" onClose={() => setShowCreate(false)} maxWidth={640} labelledBy="bank-create-title">
            <p style={{ margin: '0 0 16px', fontSize: 13, color: HQ.MUTED, lineHeight: 1.8 }}>
              مستقل تماماً — بلا طالب ولا مستوى، ومخفي عن الطلاب حتى تضعه على حصة أو تسنده.
            </p>
            <div style={{ marginBottom: 12 }}>
              <label htmlFor="bank-title" style={lbl}>عنوان الامتحان *</label>
              <input id="bank-title" type="text" value={bankForm.title}
                onChange={e => setBankForm(f => ({ ...f, title: e.target.value }))}
                placeholder="مثال: تقييم الحفظ — الجزء الأول" style={field} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
              <div>
                <label htmlFor="bank-duration" style={lbl}>المدة بالدقائق</label>
                <input id="bank-duration" type="number" min={5} value={bankForm.duration}
                  onChange={e => setBankForm(f => ({ ...f, duration: e.target.value }))} style={{ ...field, fontVariantNumeric: 'tabular-nums' }} />
              </div>
              <div>
                <label htmlFor="bank-passing" style={lbl}>درجة النجاح %</label>
                <input id="bank-passing" type="number" min={0} max={100} value={bankForm.passingScore}
                  onChange={e => setBankForm(f => ({ ...f, passingScore: e.target.value }))} style={{ ...field, fontVariantNumeric: 'tabular-nums' }} />
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <h4 style={{ margin: 0, fontSize: 15, fontWeight: 900, color: HQ.INK }}>
                الأسئلة ({bankForm.questions.length})
              </h4>
              <span style={{ fontSize: 12, color: HQ.MUTED }}>المجموع: {bankForm.questions.reduce((s, q) => s + (Number(q.points) || 1), 0)} درجات</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 12 }}>
              {bankForm.questions.map((q, qi) => (
                <div key={qi} style={{ background: HQ.PAPER, border: `1px solid ${HQ.LINE}`, borderRadius: 14, padding: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 900, color: HQ.MENTOR, fontVariantNumeric: 'tabular-nums' }}>س{qi + 1}</span>
                    <select value={q.type} onChange={e => updateQ(qi, 'type', e.target.value)}
                      aria-label={`نوع السؤال ${qi + 1}`} style={{ ...field, minHeight: 44, fontSize: 13, flex: 1 }}>
                      {QUESTION_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                    <button type="button" onClick={() => setBankForm(f => ({ ...f, questions: f.questions.filter((_, i) => i !== qi) }))}
                      disabled={bankForm.questions.length <= 1} aria-label={`حذف السؤال ${qi + 1}`}
                      style={{ ...iconBtn, minWidth: 44, color: HQ.ERROR, opacity: bankForm.questions.length <= 1 ? 0.4 : 1 }}>
                      <X size={16} />
                    </button>
                  </div>
                  <input type="text" value={q.text} onChange={e => updateQ(qi, 'text', e.target.value)}
                    placeholder="نص السؤال..." aria-label={`نص السؤال ${qi + 1}`}
                    style={{ ...field, minHeight: 44, fontSize: 14, marginBottom: 8 }} />
                  {q.type === 'mcq' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {q.options.map((opt, oi) => (
                        <div key={oi} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          <button type="button" onClick={() => updateQ(qi, 'correctAnswer', oi)}
                            aria-pressed={q.correctAnswer === oi} aria-label={`تعليم الخيار ${oi + 1} كإجابة صحيحة`}
                            style={{
                              width: 44, height: 44, borderRadius: 9999, flex: 'none', cursor: 'pointer',
                              border: `2px solid ${q.correctAnswer === oi ? HQ.MENTOR : HQ.LINE}`,
                              background: q.correctAnswer === oi ? HQ.MENTOR : 'transparent', color: '#fff',
                              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            }}>
                            {q.correctAnswer === oi && <Check size={18} strokeWidth={3.5} />}
                          </button>
                          <input type="text" value={opt} onChange={e => updateOption(qi, oi, e.target.value)}
                            placeholder={`الخيار ${oi + 1}`} aria-label={`الخيار ${oi + 1} للسؤال ${qi + 1}`}
                            style={{ ...field, minHeight: 44, fontSize: 14, flex: 1 }} />
                        </div>
                      ))}
                    </div>
                  )}
                  {q.type === 'true_false' && (
                    <div style={{ display: 'flex', gap: 8 }}>
                      {[true, false].map(v => (
                        <button key={String(v)} type="button" onClick={() => updateQ(qi, 'correctAnswerBool', v)}
                          aria-pressed={q.correctAnswerBool === v}
                          style={{
                            flex: 1, minHeight: 48, borderRadius: 12, cursor: 'pointer', fontSize: 14, fontWeight: 800, fontFamily: 'inherit',
                            border: `2px solid ${q.correctAnswerBool === v ? HQ.MENTOR : HQ.LINE}`,
                            background: q.correctAnswerBool === v ? HQ.MENTOR : HQ.SURFACE,
                            color: q.correctAnswerBool === v ? '#fff' : HQ.MUTED,
                          }}>
                          {v ? 'صح' : 'خطأ'}
                        </button>
                      ))}
                    </div>
                  )}
                  {q.type === 'written' && (
                    <input type="text" value={q.correctAnswerText} onChange={e => updateQ(qi, 'correctAnswerText', e.target.value)}
                      placeholder="الإجابة النموذجية (للتصحيح)" aria-label={`الإجابة النموذجية للسؤال ${qi + 1}`}
                      style={{ ...field, minHeight: 44, fontSize: 14 }} />
                  )}
                  {q.type === 'recitation' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <input type="text" value={q.instruction} onChange={e => updateQ(qi, 'instruction', e.target.value)}
                        placeholder="تعليم التسميع (مثال: سمّع من قوله تعالى...)" aria-label={`تعليم التسميع للسؤال ${qi + 1}`}
                        style={{ ...field, minHeight: 44, fontSize: 14 }} />
                      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 8 }}>
                        <select value={q.surahNumber} onChange={e => updateQ(qi, 'surahNumber', e.target.value)}
                          aria-label={`السورة للسؤال ${qi + 1}`} style={{ ...field, minHeight: 44, fontSize: 13 }}>
                          <option value="">السورة...</option>
                          {QURAN_SURAHS.map(s => <option key={s.number} value={s.number}>{s.number} — {s.name}</option>)}
                        </select>
                        <input type="number" min={1} value={q.fromVerse} onChange={e => updateQ(qi, 'fromVerse', e.target.value)}
                          placeholder="من آية" aria-label={`من آية للسؤال ${qi + 1}`} style={{ ...field, minHeight: 44, fontSize: 13 }} />
                        <input type="number" min={1} value={q.toVerse} onChange={e => updateQ(qi, 'toVerse', e.target.value)}
                          placeholder="إلى آية" aria-label={`إلى آية للسؤال ${qi + 1}`} style={{ ...field, minHeight: 44, fontSize: 13 }} />
                      </div>
                    </div>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                    <label htmlFor={`bank-points-${qi}`} style={{ fontSize: 12, fontWeight: 700, color: HQ.MUTED }}>الدرجة:</label>
                    <input id={`bank-points-${qi}`} type="number" min={1} value={q.points}
                      onChange={e => updateQ(qi, 'points', Number(e.target.value) || 1)}
                      style={{ ...field, minHeight: 44, fontSize: 13, width: 90 }} />
                  </div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
              {QUESTION_TYPES.map(t => (
                <button key={t.value} type="button"
                  onClick={() => setBankForm(f => ({ ...f, questions: [...f.questions, { ...EMPTY_Q, type: t.value }] }))}
                  className="hq-action" style={{ background: HQ.PAPER, border: `1px solid ${HQ.LINE}`, color: HQ.INK, fontSize: 13, padding: '0 14px', flex: '1 1 auto' }}>
                  <Plus size={14} /> {t.label}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" onClick={() => setShowCreate(false)} disabled={savingCreate} className="hq-action"
                style={{ flex: 1, background: HQ.PAPER, border: `1px solid ${HQ.LINE}`, color: HQ.INK, fontSize: 14 }}>
                إلغاء
              </button>
              <button type="button" onClick={handleCreateBank} disabled={savingCreate} className="hq-action"
                style={{ flex: 1, background: HQ.MENTOR, color: '#fff', fontSize: 14, opacity: savingCreate ? 0.6 : 1 }}>
                {savingCreate ? 'جارٍ الحفظ...' : 'حفظ في البنك'}
              </button>
            </div>
          </Modal>
        )}

        {/* ── نافذة وضع الامتحان على حصة طالب ── */}
        {assignExam && (
          <Modal title={`وضع: ${assignExam.title}`} onClose={() => setAssignExam(null)} maxWidth={560} labelledBy="assign-title">
            <div style={{ marginBottom: 12 }}>
              <span style={{ display: 'block', fontSize: 13, fontWeight: 800, color: HQ.INK, marginBottom: 6 }}>
                1 — اختر الطالب
              </span>
              <div style={{ position: 'relative', marginBottom: 8 }}>
                <Search size={15} color={HQ.MUTED} aria-hidden style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)' }} />
                <input type="text" value={studentQuery} onChange={e => setStudentQuery(e.target.value)}
                  placeholder="ابحث بالاسم أو البريد..." aria-label="بحث عن طالب"
                  style={{ ...field, paddingRight: 40, minHeight: 48 }} />
              </div>
              {studentsLoading ? (
                <p style={{ fontSize: 13, color: HQ.MUTED }}>جارٍ جلب الطلاب...</p>
              ) : (
                <div role="listbox" aria-label="قائمة الطلاب" style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 220, overflowY: 'auto' }}>
                  {visibleStudents.map(s => {
                    const active = selectedStudent?._id === s._id;
                    return (
                      <button key={s._id} type="button" role="option" aria-selected={active}
                        onClick={() => pickStudent(s)} className="hq-action"
                        style={{
                          justifyContent: 'flex-start', background: active ? HQ.MENTOR_WASH : HQ.SURFACE,
                          border: `1px solid ${active ? HQ.MENTOR : HQ.LINE}`, color: HQ.INK, fontSize: 14, padding: '8px 12px', minHeight: 52,
                        }}>
                        <UserCheck size={16} color={active ? HQ.MENTOR_DEEP : HQ.MUTED} />
                        <span style={{ flex: 1, textAlign: 'right' }}>{s.firstName} {s.lastName}</span>
                        {active && <Check size={16} color={HQ.MENTOR} />}
                      </button>
                    );
                  })}
                  {visibleStudents.length === 0 && (
                    <p style={{ fontSize: 13, color: HQ.MUTED }}>لا طلاب مطابقون للبحث.</p>
                  )}
                </div>
              )}
            </div>

            {selectedStudent && (
              <div style={{ marginBottom: 16 }}>
                <span style={{ display: 'block', fontSize: 13, fontWeight: 800, color: HQ.INK, marginBottom: 6 }}>
                  2 — اختر الحصة من خطته الفردية
                </span>
                {lessonsLoading ? (
                  <p style={{ fontSize: 13, color: HQ.MUTED }}>جارٍ جلب حصص الخطة الفردية...</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 240, overflowY: 'auto' }}>
                    <button type="button" onClick={() => setSelectedLessonId('')}
                      aria-pressed={selectedLessonId === ''}
                      className="hq-action"
                      style={{
                        justifyContent: 'flex-start', fontSize: 14, minHeight: 52, padding: '8px 12px',
                        background: selectedLessonId === '' ? HQ.MENTOR_WASH : HQ.SURFACE,
                        border: `1px solid ${selectedLessonId === '' ? HQ.MENTOR : HQ.LINE}`, color: HQ.INK,
                      }}>
                      <Send size={15} color={selectedLessonId === '' ? HQ.MENTOR_DEEP : HQ.MUTED} />
                      <span style={{ flex: 1, textAlign: 'right' }}>إسناد مباشر بدون حصة</span>
                      {selectedLessonId === '' && <Check size={16} color={HQ.MENTOR} />}
                    </button>
                    {planLessons.map(l => {
                      const active = selectedLessonId === l._id;
                      const hasExam = Boolean(l.exam);
                      return (
                        <button key={l._id} type="button" onClick={() => setSelectedLessonId(l._id)}
                          aria-pressed={active} className="hq-action"
                          style={{
                            justifyContent: 'flex-start', fontSize: 14, minHeight: 52, padding: '8px 12px',
                            background: active ? HQ.MENTOR_WASH : HQ.SURFACE,
                            border: `1px solid ${active ? HQ.MENTOR : HQ.LINE}`, color: HQ.INK,
                          }}>
                          <BookOpen size={15} color={active ? HQ.MENTOR_DEEP : HQ.MUTED} />
                          <span style={{ flex: 1, textAlign: 'right', minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {l.title}
                            {hasExam && <span style={{ color: HQ.WARNING }}> (عليها امتحان — سيُستبدل)</span>}
                          </span>
                          {active && <Check size={16} color={HQ.MENTOR} />}
                        </button>
                      );
                    })}
                    {planLessons.length === 0 && (
                      <p style={{ fontSize: 13, color: HQ.MUTED }}>
                        لا حصص في خطته الفردية بعد — يمكنك الإسناد المباشر، وسيظهر الامتحان في «المطلوب منك» لديه.
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" onClick={() => setAssignExam(null)} disabled={assigning} className="hq-action"
                style={{ flex: 1, background: HQ.PAPER, border: `1px solid ${HQ.LINE}`, color: HQ.INK, fontSize: 14 }}>
                إلغاء
              </button>
              <button type="button" onClick={handleAssign} disabled={assigning || !selectedStudent} className="hq-action"
                style={{ flex: 1, background: HQ.MENTOR, color: '#fff', fontSize: 14, opacity: (assigning || !selectedStudent) ? 0.6 : 1 }}>
                {assigning ? 'جارٍ الوضع...' : 'تأكيد الوضع للطالب'}
              </button>
            </div>
          </Modal>
        )}

        {/* ── تأكيد الحذف ── */}
        {confirmDeleteModal && (
          <Modal title="تأكيد حذف الامتحان" onClose={() => setConfirmDeleteModal(null)} maxWidth={440} labelledBy="del-title">
            <p style={{ margin: '0 0 20px', fontSize: 14, color: HQ.MUTED, textAlign: 'center', lineHeight: 1.8 }}>
              هل أنت متأكد من حذف <strong style={{ color: HQ.INK }}>«{confirmDeleteModal.title}»</strong>؟
              سيتم حذف نتائج الطلاب المرتبطة به.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                onClick={() => handleDelete(confirmDeleteModal._id)}
                disabled={deletingId === confirmDeleteModal._id}
                className="hq-action"
                style={{ flex: 1, background: HQ.ERROR, color: '#fff', fontSize: 14, opacity: deletingId === confirmDeleteModal._id ? 0.6 : 1 }}
              >
                {deletingId === confirmDeleteModal._id ? 'جارٍ الحذف...' : 'نعم، احذف'}
              </button>
              <button
                type="button"
                onClick={() => setConfirmDeleteModal(null)}
                disabled={deletingId === confirmDeleteModal._id}
                className="hq-action"
                style={{ flex: 1, background: HQ.PAPER, border: `1px solid ${HQ.LINE}`, color: HQ.INK, fontSize: 14 }}
              >
                إلغاء
              </button>
            </div>
          </Modal>
        )}
      </div>
    </PageLayout>
  );
}
