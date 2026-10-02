import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, MotionConfig } from 'framer-motion';
import {
  FileText, Plus, Search, Filter, Trash2, Eye, BarChart2,
  Users, User, Target, GraduationCap, Award, Clock, Sparkles,
  AlertCircle, ChevronLeft, CheckCircle2, RotateCcw,
} from 'lucide-react';
import toast from 'react-hot-toast';
import PageLayout from '../../components/shared/PageLayout';
import useAuthStore from '../../store/authStore';
import useExamStore from '../../store/examStore';
import LoadingSpinner from '../../components/shared/LoadingSpinner';
import { formatDateAr } from '../../utils/helpers';
import '../../components/halaqa/halaqa.css';
import { HQ } from '../../components/halaqa/primitives';

/* Exam bank — filters, metrics and cards. Same data, search,
   delete flow and destinations as before; visual only. */

const TARGET_FILTERS = [
  { id: 'all', label: 'كافة الامتحانات', icon: FileText },
  { id: 'group', label: 'امتحانات المجموعات', icon: Users },
  { id: 'individual', label: 'امتحانات فردية', icon: Target },
  { id: 'level', label: 'امتحانات المستويات', icon: GraduationCap },
];

const LEVEL_LABELS = {
  foundation: 'المستوى التأسيسي',
  memorization: 'الحفظ والإتقان',
  teacher_prep: 'إعداد معلمين',
  senior: 'كبار السن',
  all: 'جميع المستويات',
};

export default function AdminExamsPage() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const { adminExams, fetchAdminAllExams, deleteGroupExam, isLoading } = useExamStore();
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [deletingId, setDeletingId] = useState(null);
  const [confirmDeleteModal, setConfirmDeleteModal] = useState(null);

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

  const filteredExams = useMemo(() => {
    return adminExams.filter((exam) => {
      // Type filter
      if (selectedFilter !== 'all') {
        const t = exam.targetType || 'group';
        if (t !== selectedFilter) return false;
      }
      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const titleMatch = exam.title?.toLowerCase().includes(q);
        const groupMatch = exam.group?.name?.toLowerCase().includes(q);
        const studentMatch = exam.targetStudent &&
          `${exam.targetStudent.firstName} ${exam.targetStudent.lastName} ${exam.targetStudent.email}`.toLowerCase().includes(q);
        return titleMatch || groupMatch || studentMatch;
      }
      return true;
    });
  }, [adminExams, selectedFilter, searchQuery]);

  // Metrics
  const stats = useMemo(() => {
    const total = adminExams.length;
    const groupCount = adminExams.filter(e => (e.targetType || 'group') === 'group').length;
    const individualCount = adminExams.filter(e => e.targetType === 'individual').length;
    const levelCount = adminExams.filter(e => e.targetType === 'level').length;
    const totalSubmissions = adminExams.reduce((sum, e) => sum + (e.submissionsCount || 0), 0);
    return { total, groupCount, individualCount, levelCount, totalSubmissions };
  }, [adminExams]);

  const panel = {
    background: HQ.SURFACE, border: `1px solid ${HQ.LINE}`, borderRadius: 18, padding: 20,
  };
  const emptyBox = {
    background: HQ.SURFACE, border: `1px solid ${HQ.LINE}`, borderRadius: 18,
    padding: 48, textAlign: 'center',
  };
  const iconBtn = {
    minWidth: 44, minHeight: 44, borderRadius: 12, border: `1px solid ${HQ.LINE}`, background: HQ.SURFACE,
    color: HQ.MUTED, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  };

  const metrics = [
    { label: 'إجمالي الامتحانات', value: stats.total, sub: `${stats.totalSubmissions} تسليم وحل مسجل`, Icon: FileText },
    { label: 'امتحانات المجموعات', value: stats.groupCount, sub: 'موجهة لحلقات كاملة', Icon: Users },
    { label: 'امتحانات فردية للطلاب', value: stats.individualCount, sub: 'مخصصة لكل طالب', Icon: Target },
    { label: 'امتحانات المستويات', value: stats.levelCount, sub: 'تسكين وتثبيت عام', Icon: GraduationCap },
  ];

  return (
    <MotionConfig reducedMotion="user">
      <PageLayout>
        <div className="halaqa space-y-6 pb-12" style={{ maxWidth: 1000, margin: '0 auto' }}>
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: HQ.INK, margin: '0 0 4px' }}>
                بنك الامتحانات
              </h1>
              <p className="text-sm" style={{ color: HQ.MUTED, margin: 0 }}>
                إدارة امتحانات المستويات، الامتحانات العامة للحلقات، والامتحانات الفردية الموجهة للطلاب
              </p>
            </div>

            <button
              type="button"
              onClick={() => navigate('/teacher/create-exam')}
              className="hq-action m-full"
              style={{ background: HQ.MENTOR, color: '#fff', fontSize: 14, padding: '0 20px' }}
            >
              <Plus size={17} aria-hidden />
              <span>إنشاء امتحان جديد</span>
            </button>
          </div>

          {/* Metrics Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4" aria-label="ملخص الامتحانات">
            {metrics.map((m, i) => (
              <motion.div
                key={m.label}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: i * 0.05 }}
                className="p-5"
                style={{ ...panel, display: 'flex', alignItems: 'center', gap: 12 }}
              >
                <span aria-hidden style={{
                  width: 48, height: 48, borderRadius: 14, background: '#E2EFE7', color: HQ.MENTOR,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flex: 'none',
                }}>
                  <m.Icon size={22} />
                </span>
                <span>
                  <span className="block font-black" style={{ fontSize: '1.5rem', color: HQ.INK, fontVariantNumeric: 'tabular-nums' }}>{m.value}</span>
                  <span className="block text-xs font-bold" style={{ color: HQ.MUTED }}>{m.label}</span>
                  <span className="block text-xs font-semibold" style={{ color: HQ.MENTOR }}>{m.sub}</span>
                </span>
              </motion.div>
            ))}
          </div>

          {/* Filter and Search Bar */}
          <div className="p-4 space-y-3" style={panel}>
            <div className="flex flex-col md:flex-row items-center justify-between gap-3">
              {/* Filter Tabs */}
              <div className="flex flex-wrap items-center gap-1.5 p-1 w-full md:w-auto" role="group" aria-label="تصفية حسب النوع"
                style={{ background: HQ.PAPER, borderRadius: 12 }}>
                {TARGET_FILTERS.map((f) => {
                  const Icon = f.icon;
                  const isActive = selectedFilter === f.id;
                  return (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setSelectedFilter(f.id)}
                      aria-pressed={isActive}
                      className="flex items-center gap-1.5 px-3 text-xs font-bold"
                      style={{
                        minHeight: 44, borderRadius: 8, border: 'none', cursor: 'pointer',
                        background: isActive ? HQ.MENTOR : 'transparent',
                        color: isActive ? '#fff' : HQ.MUTED,
                      }}
                    >
                      <Icon size={14} aria-hidden />
                      <span>{f.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Search Input */}
              <div className="relative w-full md:w-72">
                <Search size={15} color={HQ.MUTED} aria-hidden className="absolute right-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  aria-label="بحث بعنوان الامتحان أو الطالب"
                  placeholder="ابحث بعنوان الامتحان أو الطالب..."
                  className="text-sm pr-10 w-full focus:border-[#177B58] focus:outline-none"
                  style={{
                    minHeight: 48, background: HQ.SURFACE, color: HQ.INK,
                    border: `1px solid ${HQ.LINE}`, borderRadius: 12, padding: '12px 40px 12px 16px',
                  }}
                />
              </div>
            </div>
          </div>

          {/* Exams List */}
          {isLoading ? (
            <div className="py-16 text-center">
              <LoadingSpinner size="lg" text="جارٍ تحميل بنك الامتحانات..." />
            </div>
          ) : filteredExams.length === 0 ? (
            <div style={emptyBox}>
              <span aria-hidden style={{
                width: 64, height: 64, borderRadius: 18, background: '#E2EFE7', color: HQ.MENTOR,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px',
              }}>
                <FileText size={30} />
              </span>
              <h3 className="font-bold" style={{ fontSize: '1.25rem', color: HQ.INK, margin: '0 0 4px' }}>لا توجد امتحانات مطابقة للبحث</h3>
              <p className="text-sm mb-5" style={{ color: HQ.MUTED }}>
                لم يتم العثور على امتحانات ضمن هذا التصنيف، يمكنك إضافة امتحان جديد بكل سهولة.
              </p>
              <button
                type="button"
                onClick={() => navigate('/teacher/create-exam')}
                className="hq-action"
                style={{ background: HQ.MENTOR, color: '#fff', fontSize: 14, padding: '0 20px', margin: '0 auto' }}
              >
                <Plus size={15} aria-hidden />
                <span>إنشاء أول امتحان</span>
              </button>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredExams.map((exam) => {
                const target = exam.targetType || 'group';
                return (
                  <motion.div
                    key={exam._id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                    className="p-5 flex flex-col justify-between"
                    style={panel}
                  >
                    <div>
                      {/* Top Row: Badges */}
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: 6,
                          padding: '4px 12px', borderRadius: 9999, fontSize: '0.8125rem', fontWeight: 800,
                          background: HQ.PAPER, color: HQ.INK, border: `1px solid ${HQ.LINE}`,
                        }}>
                          {target === 'individual' ? (
                            <><Target size={13} color={HQ.MENTOR} aria-hidden /> امتحان فردي لطالب</>
                          ) : target === 'level' ? (
                            <><GraduationCap size={13} color={HQ.MENTOR} aria-hidden /> امتحان مستوى ({LEVEL_LABELS[exam.level] || 'عام'})</>
                          ) : (
                            <><Users size={13} color={HQ.MENTOR} aria-hidden /> امتحان مجموعة {exam.group?.name ? `(${exam.group.name})` : ''}</>
                          )}
                        </span>

                        <span style={{ fontSize: '0.8125rem', color: HQ.MUTED, flex: 'none' }}>
                          {formatDateAr(exam.createdAt)}
                        </span>
                      </div>

                      {/* Individual Student Info if target individual */}
                      {target === 'individual' && exam.targetStudent && (
                        <div className="mb-3 p-2.5 flex items-center gap-2.5" style={{ background: HQ.PAPER, borderRadius: 12 }}>
                          <span aria-hidden className="avatar-circle"
                            style={{
                              width: 32, height: 32, fontSize: 12, flex: 'none',
                              background: '#E2EFE7', color: '#0F5940',
                            }}>
                            {exam.targetStudent.firstName?.[0] || 'ط'}
                          </span>
                          <div className="min-w-0">
                            <p className="text-xs font-bold truncate" style={{ color: HQ.INK, margin: 0 }}>
                              الطالب: {exam.targetStudent.firstName} {exam.targetStudent.lastName}
                            </p>
                            <p className="truncate" style={{ fontSize: '0.8125rem', color: HQ.MUTED, margin: 0 }}>
                              {exam.targetStudent.email}
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Exam Title */}
                      <h3 className="font-bold text-base mb-2" style={{ color: HQ.INK }}>
                        {exam.title}
                      </h3>

                      {/* Exam Specs */}
                      <div className="grid grid-cols-3 gap-2 py-3 my-3 text-center" style={{ borderTop: `1px solid ${HQ.LINE}`, borderBottom: `1px solid ${HQ.LINE}` }}>
                        <div>
                          <span className="block" style={{ fontSize: '0.8125rem', color: HQ.MUTED }}>الأسئلة</span>
                          <span className="text-xs font-bold" style={{ color: HQ.INK, fontVariantNumeric: 'tabular-nums' }}>{exam.questions?.length || 0}</span>
                        </div>
                        <div>
                          <span className="block" style={{ fontSize: '0.8125rem', color: HQ.MUTED }}>المدة</span>
                          <span className="text-xs font-bold" style={{ color: HQ.INK, fontVariantNumeric: 'tabular-nums' }}>{exam.duration} د</span>
                        </div>
                        <div>
                          <span className="block" style={{ fontSize: '0.8125rem', color: HQ.MUTED }}>النجاح</span>
                          <span className="text-xs font-bold" style={{ color: HQ.INK, fontVariantNumeric: 'tabular-nums' }}>{exam.passingScore}%</span>
                        </div>
                      </div>

                      {/* Submission Stats */}
                      <div className="flex items-center justify-between text-xs rounded-xl p-2.5 mb-4" style={{ background: HQ.PAPER }}>
                        <div className="flex items-center gap-1.5" style={{ color: HQ.MUTED }}>
                          <BarChart2 size={15} color={HQ.MENTOR} aria-hidden />
                          <span>التسليمات:</span>
                          <strong style={{ color: HQ.INK, fontVariantNumeric: 'tabular-nums' }}>{exam.submissionsCount || 0}</strong>
                        </div>
                        <div className="flex items-center gap-1.5" style={{ color: HQ.MUTED }}>
                          <span>متوسط الدرجة:</span>
                          <strong style={{ color: HQ.MENTOR, fontVariantNumeric: 'tabular-nums' }}>{exam.averageScore || 0}%</strong>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => navigate(`/admin/exams/${exam._id}/results`)}
                        className="hq-action"
                        style={{ flex: 1, background: HQ.MENTOR, color: '#fff', fontSize: '0.8125rem' }}
                      >
                        <BarChart2 size={14} aria-hidden />
                        <span>عرض النتائج</span>
                      </button>

                      {/* معاينة كطالب: متاحة للأدمن فقط (مسار الطالب يرفض المعلم) */}
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
                        style={{ ...iconBtn, color: '#C2410C', borderColor: '#C2410C' }}
                      >
                        <Trash2 size={16} aria-hidden />
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}

          {/* Delete Confirmation Modal */}
          <AnimatePresence>
            {confirmDeleteModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  onClick={() => deletingId !== confirmDeleteModal._id && setConfirmDeleteModal(null)}
                  className="fixed inset-0"
                  style={{ background: 'rgba(42,36,56,0.55)' }}
                />
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 12 }}
                  transition={{ duration: 0.2 }}
                  role="dialog" aria-modal="true" aria-label="تأكيد حذف الامتحان"
                  className="max-w-md w-full z-10 relative space-y-4"
                  style={{ ...panel, padding: 24 }}
                >
                  <span aria-hidden style={{
                    width: 48, height: 48, borderRadius: 14, background: HQ.PAPER, color: '#C2410C',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto',
                  }}>
                    <Trash2 size={23} />
                  </span>
                  <div className="text-center">
                    <h3 className="font-bold" style={{ fontSize: '1.25rem', color: HQ.INK, margin: '0 0 4px' }}>تأكيد حذف الامتحان</h3>
                    <p className="text-sm" style={{ color: HQ.MUTED, margin: 0 }}>
                      هل أنت متأكد من رغبتك في حذف امتحان{' '}
                      <span className="font-bold" style={{ color: HQ.INK }}>&quot;{confirmDeleteModal.title}&quot;</span>؟
                      سيتم حذف نتائج الطلاب المرتبطة به.
                    </p>
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => handleDelete(confirmDeleteModal._id)}
                      disabled={deletingId === confirmDeleteModal._id}
                      className="hq-action"
                      style={{ flex: 1, background: '#C2410C', color: '#fff', fontSize: 14, opacity: deletingId === confirmDeleteModal._id ? 0.6 : 1 }}
                    >
                      {deletingId === confirmDeleteModal._id ? 'جارٍ الحذف...' : 'نعم، احذف'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteModal(null)}
                      disabled={deletingId === confirmDeleteModal._id}
                      className="hq-action"
                      style={{ flex: 1, background: HQ.PAPER, color: HQ.INK, fontSize: 14 }}
                    >
                      إلغاء
                    </button>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>
        </div>
      </PageLayout>
    </MotionConfig>
  );
}
