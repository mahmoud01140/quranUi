import { useState, useEffect } from 'react';
import { motion, AnimatePresence, MotionConfig } from 'framer-motion';
import {
  Plus, Trash2, Save, BookOpen, FileText, Mic, PenLine, ChevronDown, ChevronUp,
  Copy, CheckCircle, AlertCircle, Book,
  Clock, Award, RotateCcw, Users, User, Target, GraduationCap, Check, X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import PageLayout from '../../components/shared/PageLayout';
import useGroupStore from '../../store/groupStore';
import useExamStore from '../../store/examStore';
import LoadingSpinner from '../../components/shared/LoadingSpinner';
import api from '../../services/api';
import QURAN_SURAHS from '../../utils/quranData';
import '../../components/halaqa/halaqa.css';
import { HQ } from '../../components/halaqa/primitives';

/* Exam builder — operational calm. Same targets, questions, payloads
   and validation as before; only the visual layer changed. */

const QUESTION_TYPES = [
  { value: 'mcq', label: 'اختيار من متعدد', Icon: CheckCircle },
  { value: 'true_false', label: 'صح / خطأ', Icon: Check },
  { value: 'written', label: 'إكمال / كتابي', Icon: PenLine },
  { value: 'recitation', label: 'شفهي / تسميع', Icon: Mic },
];

const LEVEL_TONES = {
  foundation: { wash: '#E2EFE7', fg: '#0F5940', border: '#177B58' },
  memorization: { wash: '#ECE9F4', fg: '#4A3F6B', border: '#4A3F6B' },
  teacher_prep: { wash: '#ECE9F4', fg: '#4A3F6B', border: '#4A3F6B' },
  senior: { wash: '#FBF7EE', fg: '#2A2438', border: '#2A2438' },
  all: { wash: '#FBF7EE', fg: '#2A2438', border: '#2A2438' },
};

const LEVEL_OPTIONS = [
  { value: 'foundation', label: 'المستوى التأسيسي', desc: 'تأسيس القراءة وأحكام التجويد' },
  { value: 'memorization', label: 'مستوى الحفظ والإتقان', desc: 'حفظ وتثبيت القرآن الكريم' },
  { value: 'teacher_prep', label: 'إعداد معلمين', desc: 'تأهيل الإجازات والإتقان المتقدم' },
  { value: 'senior', label: 'فئة كبار السن', desc: 'تيسير التلاوة والمدارسة' },
  { value: 'all', label: 'جميع المستويات (عام)', desc: 'امتحان موجه لكافة الطلاب بالأكاديمية' },
];

const EMPTY_Q = {
  type: 'mcq', text: '', options: ['', '', '', ''], correctAnswer: 0,
  correctAnswerBool: true, correctAnswerText: '', points: 1, instruction: '',
  surahNumber: '', fromVerse: '', toVerse: '', mode: 'practice',
};

const field = {
  width: '100%', minHeight: 48, background: HQ.SURFACE, color: HQ.INK,
  border: `1px solid ${HQ.LINE}`, borderRadius: 12, padding: '12px 16px',
  fontSize: 16, fontFamily: 'inherit',
};

export default function CreateExamPage() {
  const { groups, fetchAllGroups } = useGroupStore();
  const { createGroupExam } = useExamStore();
  const [saving, setSaving] = useState(false);
  const [expandedQ, setExpandedQ] = useState(0);

  // Target & Group & Student selection
  const [targetType, setTargetType] = useState('group'); // 'group' | 'individual' | 'level'
  const [targetStudentId, setTargetStudentId] = useState('');
  const [selectedLevel, setSelectedLevel] = useState('foundation');
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [selectedLessonId, setSelectedLessonId] = useState('');
  const [lessons, setLessons] = useState([]);
  const [loadingLessons, setLoadingLessons] = useState(false);
  const [groupStudents, setGroupStudents] = useState([]);
  const [loadingStudents, setLoadingStudents] = useState(false);

  const [exam, setExam] = useState({
    title: '',
    duration: 30,
    passingScore: 60,
    allowRetries: true,
    questions: [{ ...EMPTY_Q }],
  });

  useEffect(() => {
    fetchAllGroups();
  }, []);

  // Load students when group changes
  useEffect(() => {
    if (!selectedGroupId) {
      setGroupStudents([]);
      setTargetStudentId('');
      return;
    }
    const currentG = groups.find(g => g._id === selectedGroupId);
    if (currentG && Array.isArray(currentG.students) && currentG.students.length > 0 && typeof currentG.students[0] === 'object') {
      setGroupStudents(currentG.students);
    } else {
      setLoadingStudents(true);
      api.get(`/groups/${selectedGroupId}/students`)
        .then(res => setGroupStudents(res.data.students || []))
        .catch(() => setGroupStudents([]))
        .finally(() => setLoadingStudents(false));
    }
  }, [selectedGroupId, groups]);

  // Load lessons when group changes
  useEffect(() => {
    if (!selectedGroupId) { setLessons([]); setSelectedLessonId(''); return; }
    const loadLessons = async () => {
      setLoadingLessons(true);
      try {
        const res = await api.get(`/study-plans/group/${selectedGroupId}/full`);
        setLessons(res.data.plan?.customLessons || []);
      } catch { setLessons([]); }
      finally { setLoadingLessons(false); }
    };
    loadLessons();
  }, [selectedGroupId]);

  // Auto-set title when lesson is selected
  useEffect(() => {
    if (selectedLessonId) {
      const lesson = lessons.find(l => l._id === selectedLessonId);
      if (lesson && !exam.title) {
        setExam(p => ({ ...p, title: `تقييم: ${lesson.title}` }));
      }
    }
  }, [selectedLessonId]);

  const addQuestion = (type = 'mcq') => {
    const newQ = { ...EMPTY_Q, type };
    setExam(e => ({ ...e, questions: [...e.questions, newQ] }));
    setExpandedQ(exam.questions.length);
  };

  const removeQuestion = (idx) => {
    setExam(e => ({ ...e, questions: e.questions.filter((_, i) => i !== idx) }));
    if (expandedQ >= idx && expandedQ > 0) setExpandedQ(expandedQ - 1);
  };

  const duplicateQuestion = (idx) => {
    const q = { ...exam.questions[idx], options: [...(exam.questions[idx].options || [])] };
    setExam(e => ({ ...e, questions: [...e.questions.slice(0, idx + 1), q, ...e.questions.slice(idx + 1)] }));
    setExpandedQ(idx + 1);
  };

  const updateQ = (idx, fieldName, val) => {
    setExam(e => {
      const qs = [...e.questions];
      qs[idx] = { ...qs[idx], [fieldName]: val };
      // Reset options when switching type
      if (fieldName === 'type') {
        if (val === 'mcq') qs[idx].options = ['', '', '', ''];
        else qs[idx].options = [];
      }
      return { ...e, questions: qs };
    });
  };

  const updateOption = (qi, oi, val) => {
    setExam(e => {
      const qs = [...e.questions];
      const opts = [...(qs[qi].options || [])];
      opts[oi] = val;
      qs[qi] = { ...qs[qi], options: opts };
      return { ...e, questions: qs };
    });
  };

  const moveQuestion = (idx, dir) => {
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= exam.questions.length) return;
    setExam(e => {
      const qs = [...e.questions];
      [qs[idx], qs[newIdx]] = [qs[newIdx], qs[idx]];
      return { ...e, questions: qs };
    });
    setExpandedQ(newIdx);
  };

  const handleSave = async () => {
    if (!exam.title.trim()) { toast.error('أدخل عنوان التقييم / الامتحان'); return; }

    if (targetType === 'group' && !selectedGroupId) {
      toast.error('يرجى اختيار المجموعة');
      return;
    }
    if (targetType === 'individual') {
      if (!selectedGroupId) {
        toast.error('يرجى اختيار المجموعة أولاً');
        return;
      }
      if (!targetStudentId) {
        toast.error('يرجى تحديد الطالب المستهدف');
        return;
      }
    }
    if (targetType === 'level' && !selectedLevel) {
      toast.error('يرجى اختيار المستوى المستهدف');
      return;
    }

    if (exam.questions.length === 0) { toast.error('أضف سؤالاً واحداً على الأقل'); return; }
    if (exam.questions.some(q => !q.text.trim())) { toast.error('أكمل نص جميع الأسئلة'); return; }

    const selectedLesson = lessons.find(l => l._id === selectedLessonId);

    setSaving(true);
    try {
      await createGroupExam({
        title: exam.title,
        type: targetType === 'level' ? 'placement' : (selectedLessonId ? 'lesson' : 'monthly'),
        targetType,
        targetStudent: targetType === 'individual' ? targetStudentId : undefined,
        group: (targetType === 'group' || targetType === 'individual') ? selectedGroupId : undefined,
        level: targetType === 'level' ? selectedLevel : undefined,
        lessonId: selectedLessonId || undefined,
        lessonTitle: selectedLesson?.title || '',
        duration: exam.duration,
        passingScore: exam.passingScore,
        allowRetries: exam.allowRetries,
        questions: exam.questions.map(q => ({
          ...q,
          surahNumber: q.surahNumber ? parseInt(q.surahNumber) : undefined,
          fromVerse: q.fromVerse ? parseInt(q.fromVerse) : undefined,
          toVerse: q.toVerse ? parseInt(q.toVerse) : undefined,
        })),
        totalPoints: exam.questions.reduce((s, q) => s + (q.points || 1), 0),
      });

      const successMsg = targetType === 'individual'
        ? 'تم إسناد الامتحان الفردي للطالب بنجاح!'
        : targetType === 'level'
        ? 'تم نشر امتحان المستوى بنجاح!'
        : 'تم إنشاء امتحان المجموعة بنجاح!';

      toast.success(successMsg);
      // Reset
      setExam({
        title: '', duration: 30, passingScore: 60, allowRetries: true,
        questions: [{ ...EMPTY_Q }],
      });
      setSelectedLessonId('');
      setTargetStudentId('');
      setExpandedQ(0);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'خطأ في حفظ التقييم');
    } finally { setSaving(false); }
  };

  const totalPoints = exam.questions.reduce((s, q) => s + (q.points || 1), 0);
  const questionStats = {
    mcq: exam.questions.filter(q => q.type === 'mcq').length,
    true_false: exam.questions.filter(q => q.type === 'true_false').length,
    written: exam.questions.filter(q => q.type === 'written').length,
    recitation: exam.questions.filter(q => q.type === 'recitation').length,
  };

  const getTypeConfig = (type) => QUESTION_TYPES.find(t => t.value === type) || QUESTION_TYPES[0];

  const panel = {
    background: HQ.SURFACE, border: `1px solid ${HQ.LINE}`, borderRadius: 18, padding: 24,
  };
  const stepNum = {
    flex: 'none', width: 32, height: 32, borderRadius: 12, background: HQ.MENTOR, color: '#fff',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 16,
  };
  const lbl = { fontSize: 14, fontWeight: 700, color: HQ.INK, marginBottom: 6, display: 'block' };
  const lblSm = { fontSize: '0.8125rem', fontWeight: 700, color: HQ.MUTED, marginBottom: 6, display: 'block' };
  const iconBtn = {
    minWidth: 44, minHeight: 44, borderRadius: 12, border: 'none', background: 'transparent',
    color: HQ.MUTED, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  };

  return (
    <MotionConfig reducedMotion="user">
      <PageLayout>
        <div className="halaqa" style={{ maxWidth: 1080, margin: '0 auto' }}>
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <span aria-hidden style={{
                width: 48, height: 48, borderRadius: 14, background: HQ.MENTOR, color: '#fff',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flex: 'none',
              }}>
                <FileText size={24} />
              </span>
              <div>
                <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: HQ.INK, margin: 0 }}>إنشاء نشاط / امتحان جديد</h1>
                <p className="text-sm" style={{ color: HQ.MUTED, margin: 0 }}>إنشاء امتحانات المستوى، امتحانات عامة للمجموعات، أو امتحانات فردية مخصصة للطلاب</p>
              </div>
            </div>
          </div>

          <div className="grid lg:grid-cols-3 gap-6">
            {/* Main Form - 2 cols */}
            <div className="lg:col-span-2 space-y-6">

              {/* Step 1: Target Selection */}
              <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}
                aria-label="تحديد الفئة المستهدفة" style={panel}>
                <div className="flex items-center gap-2 mb-5">
                  <span style={stepNum} aria-hidden>1</span>
                  <div>
                    <h2 className="font-bold" style={{ color: HQ.INK, fontSize: '1rem', margin: 0 }}>تحديد الفئة المستهدفة ونوع الامتحان</h2>
                    <p className="text-xs" style={{ color: HQ.MUTED, margin: 0 }}>اختر توجيه الامتحان لمجموعة، لطالب محدد، أو لمستوى كامل</p>
                  </div>
                </div>

                {/* Target Type Switcher Tabs */}
                <div className="hq-tabs m-tabs-col" role="tablist" aria-label="نوع التوجيه" style={{ display: 'flex', width: '100%', marginBottom: 20 }}>
                  {[
                    { key: 'group', label: 'امتحان لمجموعة', Icon: Users, clear: () => { setSelectedLessonId(''); } },
                    { key: 'individual', label: 'امتحان فردي لطالب', Icon: Target, clear: () => {} },
                    { key: 'level', label: 'امتحان مستوى', Icon: GraduationCap, clear: () => { setSelectedGroupId(''); setSelectedLessonId(''); setTargetStudentId(''); } },
                  ].map(t => (
                    <button
                      key={t.key}
                      type="button"
                      role="tab"
                      aria-selected={targetType === t.key}
                      onClick={() => { setTargetType(t.key); t.clear(); }}
                      style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                      <t.Icon size={16} aria-hidden />
                      <span>{t.label}</span>
                    </button>
                  ))}
                </div>

                {/* Conditional Target UI */}
                {targetType === 'group' && (
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="ce-group" style={lbl}>المجموعة المستهدفة *</label>
                      <div className="relative">
                        <Users size={16} color={HQ.MUTED} aria-hidden className="absolute right-3 top-1/2 -translate-y-1/2" />
                        <select id="ce-group" value={selectedGroupId}
                          onChange={e => { setSelectedGroupId(e.target.value); setSelectedLessonId(''); setExam(p => ({ ...p, title: '' })); }}
                          className="pr-10 focus:border-[#177B58] focus:outline-none" style={field}>
                          <option value="">اختر المجموعة...</option>
                          {groups.map(g => <option key={g._id} value={g._id}>{g.name} ({g.students?.length || 0} طالب)</option>)}
                        </select>
                      </div>
                    </div>
                    <div>
                      <label htmlFor="ce-lesson" style={lbl}>
                        الدرس المرتبط <span className="text-xs font-normal" style={{ color: HQ.MUTED }}>(اختياري)</span>
                      </label>
                      <div className="relative">
                        <BookOpen size={16} color={HQ.MUTED} aria-hidden className="absolute right-3 top-1/2 -translate-y-1/2" />
                        <select id="ce-lesson" value={selectedLessonId}
                          onChange={e => setSelectedLessonId(e.target.value)}
                          disabled={!selectedGroupId || loadingLessons}
                          className="pr-10 focus:border-[#177B58] focus:outline-none disabled:opacity-50" style={field}>
                          <option value="">
                            {loadingLessons ? 'جاري التحميل...' : !selectedGroupId ? 'اختر المجموعة أولاً' : 'امتحان عام للمجموعة (بدون درس محدد)'}
                          </option>
                          {lessons.map(l => <option key={l._id} value={l._id}>{l.lessonNumber}. {l.title}</option>)}
                        </select>
                      </div>
                    </div>
                  </div>
                )}

                {targetType === 'individual' && (
                  <div className="space-y-4">
                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="ce-stu-group" style={lbl}>مجموعة الطالب *</label>
                        <div className="relative">
                          <Users size={16} color={HQ.MUTED} aria-hidden className="absolute right-3 top-1/2 -translate-y-1/2" />
                          <select id="ce-stu-group" value={selectedGroupId}
                            onChange={e => { setSelectedGroupId(e.target.value); setTargetStudentId(''); }}
                            className="pr-10 focus:border-[#177B58] focus:outline-none" style={field}>
                            <option value="">اختر مجموعة الطالب...</option>
                            {groups.map(g => <option key={g._id} value={g._id}>{g.name}</option>)}
                          </select>
                        </div>
                      </div>
                      <div>
                        <label htmlFor="ce-student" style={lbl}>الطالب المستهدف *</label>
                        <div className="relative">
                          <User size={16} color={HQ.MUTED} aria-hidden className="absolute right-3 top-1/2 -translate-y-1/2" />
                          <select id="ce-student" value={targetStudentId}
                            onChange={e => {
                              setTargetStudentId(e.target.value);
                              const st = groupStudents.find(s => s._id === e.target.value);
                              if (st && !exam.title) {
                                setExam(p => ({ ...p, title: `امتحان متابعة فردي: ${st.firstName} ${st.lastName}` }));
                              }
                            }}
                            disabled={!selectedGroupId || loadingStudents}
                            className="pr-10 focus:border-[#177B58] focus:outline-none disabled:opacity-50" style={field}>
                            <option value="">
                              {loadingStudents ? 'جاري تحميل الطلاب...' : !selectedGroupId ? 'اختر المجموعة أولاً' : groupStudents.length === 0 ? 'لا يوجد طلاب في المجموعة' : 'اختر الطالب...'}
                            </option>
                            {groupStudents.map(st => (
                              <option key={st._id} value={st._id}>{st.firstName} {st.lastName} ({st.email || 'طالب'})</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>

                    {targetStudentId && (
                      <div className="flex items-center gap-3 p-3.5" style={{ background: HQ.PAPER, border: `1px solid ${HQ.LINE}`, borderRadius: 12 }}>
                        <span aria-hidden style={{
                          width: 40, height: 40, borderRadius: 12, background: '#E2EFE7', color: HQ.MENTOR,
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flex: 'none',
                        }}>
                          <Target size={19} />
                        </span>
                        <div>
                          <p className="text-sm font-bold" style={{ color: HQ.INK, margin: 0 }}>امتحان مخصص وموجه لهذا الطالب فقط</p>
                          <p className="text-xs" style={{ color: HQ.MUTED, margin: 0 }}>سيظهر للطالب حصراً في مهام يومه بصفحته الرئيسية مع إشعار فوري له.</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {targetType === 'level' && (
                  <div>
                    <label style={lbl} id="ce-level-label">المستوى المستهدف *</label>
                    <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3" role="group" aria-labelledby="ce-level-label">
                      {LEVEL_OPTIONS.map(lvl => {
                        const isSelected = selectedLevel === lvl.value;
                        const tone = LEVEL_TONES[lvl.value];
                        return (
                          <button
                            key={lvl.value}
                            type="button"
                            onClick={() => setSelectedLevel(lvl.value)}
                            aria-pressed={isSelected}
                            className="p-3.5 text-right"
                            style={{
                              borderRadius: 12, cursor: 'pointer',
                              border: `2px solid ${isSelected ? tone.border : HQ.LINE}`,
                              background: isSelected ? tone.wash : HQ.SURFACE,
                            }}>
                            <span className="flex items-center gap-2 mb-1">
                              <span aria-hidden style={{
                                width: 20, height: 20, borderRadius: 9999, flex: 'none', position: 'relative',
                                border: `2px solid ${isSelected ? tone.border : HQ.LINE}`,
                                background: isSelected ? tone.border : HQ.SURFACE,
                              }}>
                                {isSelected && <span aria-hidden style={{
                                  position: 'absolute', inset: 4, borderRadius: 9999, background: '#fff',
                                }} />}
                              </span>
                              <span className="font-bold text-sm" style={{ color: HQ.INK }}>{lvl.label}</span>
                            </span>
                            <span className="text-xs" style={{ color: HQ.MUTED }}>{lvl.desc}</span>
                          </button>
                        );
                      })}
                    </div>
                    <p className="text-xs p-2.5 rounded-xl mt-3 flex items-center gap-1.5"
                      style={{ color: '#0F5940', background: '#E2EFE7' }}>
                      <CheckCircle size={15} aria-hidden className="flex-none" />
                      امتحانات المستوى تظهر لجميع الطلاب المنتمين لهذا المستوى أو كاختبار عام لتحديد المستوى وتثبيت الحفظ.
                    </p>
                  </div>
                )}
              </motion.section>

              {/* Step 2: Exam Settings */}
              <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}
                aria-label="إعدادات التقييم" style={panel}>
                <div className="flex items-center gap-2 mb-5">
                  <span style={stepNum} aria-hidden>2</span>
                  <h2 className="font-bold" style={{ color: HQ.INK, fontSize: '1rem', margin: 0 }}>إعدادات التقييم</h2>
                </div>
                <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="md:col-span-2">
                    <label htmlFor="ce-title" style={lbl}>عنوان التقييم *</label>
                    <input id="ce-title" value={exam.title}
                      onChange={e => setExam(p => ({ ...p, title: e.target.value }))}
                      className="focus:border-[#177B58] focus:outline-none" style={field}
                      placeholder="مثل: تقييم درس أحكام النون الساكنة" />
                  </div>
                  <div>
                    <label htmlFor="ce-duration" style={{ ...lbl, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Clock size={14} aria-hidden /> المدة (دقيقة)
                    </label>
                    <input id="ce-duration" type="number" value={exam.duration} min={5} max={180}
                      onChange={e => setExam(p => ({ ...p, duration: parseInt(e.target.value) || 30 }))}
                      className="focus:border-[#177B58] focus:outline-none" style={{ ...field, fontVariantNumeric: 'tabular-nums' }} />
                  </div>
                  <div>
                    <label htmlFor="ce-pass" style={{ ...lbl, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Award size={14} aria-hidden /> درجة النجاح %
                    </label>
                    <input id="ce-pass" type="number" value={exam.passingScore} min={40} max={100}
                      onChange={e => setExam(p => ({ ...p, passingScore: parseInt(e.target.value) || 60 }))}
                      className="focus:border-[#177B58] focus:outline-none" style={{ ...field, fontVariantNumeric: 'tabular-nums' }} />
                  </div>
                </div>
                <label className="flex items-center gap-3 cursor-pointer mt-4 p-3"
                  style={{ background: HQ.PAPER, border: `1px solid ${HQ.LINE}`, borderRadius: 12 }}>
                  <input type="checkbox" checked={exam.allowRetries}
                    onChange={e => setExam(p => ({ ...p, allowRetries: e.target.checked }))}
                    className="w-4 h-4 rounded" style={{ accentColor: HQ.MENTOR, width: 20, height: 20, flex: 'none' }} />
                  <span>
                    <span className="text-sm font-bold flex items-center gap-1.5" style={{ color: HQ.INK }}>
                      <RotateCcw size={14} color={HQ.MENTOR} aria-hidden /> السماح بإعادة المحاولة
                    </span>
                    <span className="text-xs" style={{ color: HQ.MUTED }}>يمكن للطالب إعادة حل التقييم أكثر من مرة</span>
                  </span>
                </label>
              </motion.section>

              {/* Step 3: Questions */}
              <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}
                aria-label={`الأسئلة (${exam.questions.length})`} className="space-y-4">
                <div className="flex items-center gap-2">
                  <span style={stepNum} aria-hidden>3</span>
                  <h2 className="font-bold" style={{ color: HQ.INK, fontSize: '1rem', margin: 0 }}>الأسئلة ({exam.questions.length})</h2>
                </div>

                <AnimatePresence initial={false}>
                  {exam.questions.map((q, qi) => {
                    const typeConf = getTypeConfig(q.type);
                    const isExpanded = expandedQ === qi;
                    return (
                      <motion.div key={qi}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        style={{
                          background: HQ.SURFACE, borderRadius: 18, overflow: 'hidden',
                          border: `2px solid ${isExpanded ? HQ.MENTOR : HQ.LINE}`,
                        }}>
                        {/* Question Header (always visible) */}
                        <div
                          role="button" tabIndex={0} aria-expanded={isExpanded}
                          onClick={() => setExpandedQ(isExpanded ? -1 : qi)}
                          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setExpandedQ(isExpanded ? -1 : qi); } }}
                          className="flex items-center gap-3 p-4 cursor-pointer"
                          style={{ minHeight: 64 }}>
                          <div className="flex flex-col" style={{ gap: 2 }}>
                            <button type="button" onClick={(e) => { e.stopPropagation(); moveQuestion(qi, -1); }}
                              disabled={qi === 0} aria-label="نقل السؤال لأعلى"
                              style={{ ...iconBtn, minWidth: 32, minHeight: 28, opacity: qi === 0 ? 0.3 : 1 }}>
                              <ChevronUp size={14} aria-hidden />
                            </button>
                            <button type="button" onClick={(e) => { e.stopPropagation(); moveQuestion(qi, 1); }}
                              disabled={qi === exam.questions.length - 1} aria-label="نقل السؤال لأسفل"
                              style={{ ...iconBtn, minWidth: 32, minHeight: 28, opacity: qi === exam.questions.length - 1 ? 0.3 : 1 }}>
                              <ChevronDown size={14} aria-hidden />
                            </button>
                          </div>
                          <span aria-hidden style={{
                            width: 40, height: 40, borderRadius: 12, background: HQ.MENTOR, color: '#fff',
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            fontWeight: 800, fontSize: 15, flex: 'none',
                          }}>
                            {qi + 1}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm truncate" style={{ color: HQ.INK, margin: 0 }}>
                              {q.text || <span style={{ color: HQ.MUTED, fontStyle: 'italic' }}>سؤال بدون نص...</span>}
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                              <span style={{
                                display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.8125rem',
                                padding: '4px 12px', borderRadius: 9999, background: '#E2EFE7', color: '#0F5940', fontWeight: 700,
                              }}>
                                <typeConf.Icon size={13} aria-hidden /> {typeConf.label}
                              </span>
                              <span className="text-xs" style={{ color: HQ.MUTED, fontVariantNumeric: 'tabular-nums' }}>{q.points} نقطة</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 flex-none">
                            <button type="button" onClick={(e) => { e.stopPropagation(); duplicateQuestion(qi); }}
                              style={iconBtn} title="نسخ" aria-label="نسخ السؤال">
                              <Copy size={16} aria-hidden />
                            </button>
                            {exam.questions.length > 1 && (
                              <button type="button" onClick={(e) => { e.stopPropagation(); removeQuestion(qi); }}
                                style={{ ...iconBtn }} className="hover:text-[#C2410C]" title="حذف" aria-label="حذف السؤال">
                                <Trash2 size={16} aria-hidden />
                              </button>
                            )}
                            <motion.span animate={{ rotate: isExpanded ? 180 : 0 }} transition={{ duration: 0.2 }} style={{ display: 'inline-flex' }}>
                              <ChevronDown size={19} color={HQ.MUTED} aria-hidden />
                            </motion.span>
                          </div>
                        </div>

                        {/* Expanded Content */}
                        <AnimatePresence initial={false}>
                          {isExpanded && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2 }}
                              className="overflow-hidden">
                              <div className="px-4 pb-5 space-y-4 pt-4" style={{ borderTop: `1px solid ${HQ.LINE}` }}>
                                {/* Type Selector */}
                                <div>
                                  <span style={lblSm} id={`ce-type-${qi}`}>نوع السؤال</span>
                                  <div className="flex gap-2 flex-wrap" role="group" aria-labelledby={`ce-type-${qi}`}>
                                    {QUESTION_TYPES.map(t => (
                                      <button key={t.value} type="button"
                                        onClick={() => updateQ(qi, 'type', t.value)}
                                        aria-pressed={q.type === t.value}
                                        className="flex items-center gap-2 px-4 text-sm font-bold"
                                        style={{
                                          minHeight: 48, borderRadius: 12, cursor: 'pointer',
                                          border: `2px solid ${q.type === t.value ? HQ.MENTOR : HQ.LINE}`,
                                          background: q.type === t.value ? '#E2EFE7' : HQ.SURFACE,
                                          color: q.type === t.value ? '#0F5940' : HQ.MUTED,
                                        }}>
                                        <t.Icon size={16} aria-hidden /> {t.label}
                                      </button>
                                    ))}
                                  </div>
                                </div>

                                {/* Question Text */}
                                <div>
                                  <label htmlFor={`ce-qtext-${qi}`} style={lblSm}>نص السؤال *</label>
                                  <textarea id={`ce-qtext-${qi}`} value={q.text}
                                    onChange={e => updateQ(qi, 'text', e.target.value)}
                                    className="resize-none focus:border-[#177B58] focus:outline-none" style={{ ...field, minHeight: 80 }}
                                    placeholder={
                                      q.type === 'recitation' ? 'مثال: اقرأ من سورة البقرة الآية 1 إلى الآية 5'
                                      : q.type === 'written' ? 'مثال: أكمل الآية: إياك نعبد و...'
                                      : 'مثال: ما حكم الإدغام في قوله تعالى "من يعمل"؟'
                                    } />
                                </div>

                                {/* Points */}
                                <div className="flex items-center gap-4">
                                  <div className="w-32">
                                    <label htmlFor={`ce-pts-${qi}`} style={lblSm}>النقاط</label>
                                    <input id={`ce-pts-${qi}`} type="number" value={q.points} min={1} max={20}
                                      onChange={e => updateQ(qi, 'points', parseInt(e.target.value) || 1)}
                                      className="text-center focus:border-[#177B58] focus:outline-none"
                                      style={{ ...field, fontVariantNumeric: 'tabular-nums' }} />
                                  </div>
                                </div>

                                {/* MCQ Options */}
                                {q.type === 'mcq' && (
                                  <div className="space-y-2.5">
                                    <span style={lblSm}>الخيارات (اضغط الدائرة لتحديد الإجابة الصحيحة)</span>
                                    {(q.options || ['', '', '', '']).map((opt, oi) => (
                                      <div key={oi} className="flex items-center gap-3 p-3"
                                        style={{
                                          borderRadius: 12, border: `2px solid ${q.correctAnswer === oi ? HQ.MENTOR : HQ.LINE}`,
                                          background: q.correctAnswer === oi ? '#E2EFE7' : HQ.SURFACE,
                                        }}>
                                        <button type="button" onClick={() => updateQ(qi, 'correctAnswer', oi)}
                                          aria-label={`تحديد الخيار ${oi + 1} كإجابة صحيحة`} aria-pressed={q.correctAnswer === oi}
                                          style={{
                                            width: 30, height: 30, borderRadius: 9999, flex: 'none',
                                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                                            border: `2px solid ${q.correctAnswer === oi ? HQ.MENTOR : HQ.LINE}`,
                                            background: q.correctAnswer === oi ? HQ.MENTOR : 'transparent', color: '#fff',
                                          }}>
                                          {q.correctAnswer === oi && <Check size={15} strokeWidth={3.5} aria-hidden />}
                                        </button>
                                        <input value={opt}
                                          onChange={e => updateOption(qi, oi, e.target.value)}
                                          aria-label={`نص الخيار ${oi + 1}`}
                                          className="flex-1 text-sm font-medium focus:outline-none" style={{ background: 'transparent', color: HQ.INK }}
                                          placeholder={`الخيار ${oi + 1}`} />
                                        <span aria-hidden className="text-xs font-bold" style={{ color: HQ.MUTED, width: 20, fontVariantNumeric: 'tabular-nums' }}>{String.fromCharCode(1571 + oi)}</span>
                                      </div>
                                    ))}
                                  </div>
                                )}

                                {/* True / False */}
                                {q.type === 'true_false' && (
                                  <div>
                                    <span style={lblSm}>حدد الإجابة الصحيحة لهذا السؤال:</span>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                      <button
                                        type="button"
                                        onClick={() => updateQ(qi, 'correctAnswerBool', true)}
                                        aria-pressed={q.correctAnswerBool !== false}
                                        className="flex items-center justify-center gap-2.5 font-bold"
                                        style={{
                                          minHeight: 56, padding: '12px 16px', borderRadius: 12, cursor: 'pointer',
                                          border: `2px solid ${q.correctAnswerBool !== false ? HQ.MENTOR : HQ.LINE}`,
                                          background: q.correctAnswerBool !== false ? '#E2EFE7' : HQ.SURFACE,
                                          color: q.correctAnswerBool !== false ? '#0F5940' : HQ.MUTED,
                                        }}
                                      >
                                        <Check size={19} strokeWidth={2.5} aria-hidden />
                                        <span>الإجابة: صحيح (صح)</span>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => updateQ(qi, 'correctAnswerBool', false)}
                                        aria-pressed={q.correctAnswerBool === false}
                                        className="flex items-center justify-center gap-2.5 font-bold"
                                        style={{
                                          minHeight: 56, padding: '12px 16px', borderRadius: 12, cursor: 'pointer',
                                          border: `2px solid ${q.correctAnswerBool === false ? HQ.MENTOR : HQ.LINE}`,
                                          background: q.correctAnswerBool === false ? '#E2EFE7' : HQ.SURFACE,
                                          color: q.correctAnswerBool === false ? '#0F5940' : HQ.MUTED,
                                        }}
                                      >
                                        <X size={19} strokeWidth={2.5} aria-hidden />
                                        <span>الإجابة: خطأ</span>
                                      </button>
                                    </div>
                                  </div>
                                )}

                                {/* Written Answer */}
                                {q.type === 'written' && (
                                  <div>
                                    <label htmlFor={`ce-model-${qi}`} style={lblSm}>الإجابة النموذجية</label>
                                    <input id={`ce-model-${qi}`} value={q.correctAnswerText || ''}
                                      onChange={e => updateQ(qi, 'correctAnswerText', e.target.value)}
                                      className="focus:border-[#177B58] focus:outline-none" style={field}
                                      placeholder="أدخل الإجابة النموذجية للتصحيح التلقائي..." />
                                  </div>
                                )}

                                {/* Recitation - Quran Fields */}
                                {q.type === 'recitation' && (
                                  <div className="p-4 space-y-4" style={{ background: HQ.PAPER, border: `1px solid ${HQ.LINE}`, borderRadius: 12 }}>
                                    <div className="flex items-center gap-2 mb-1">
                                      <Book size={15} color={HQ.MENTOR} aria-hidden />
                                      <span className="text-sm font-bold" style={{ color: HQ.INK }}>إعدادات المصحف التفاعلي</span>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                      <div>
                                        <label htmlFor={`ce-surah-${qi}`} style={lblSm}>السورة</label>
                                        <select id={`ce-surah-${qi}`} value={q.surahNumber || ''}
                                          onChange={e => updateQ(qi, 'surahNumber', e.target.value)}
                                          className="text-sm focus:border-[#177B58] focus:outline-none" style={field}>
                                          <option value="">اختر السورة</option>
                                          {QURAN_SURAHS.map((s) => (
                                            <option key={s.number} value={s.number}>{s.number}. {s.name}</option>
                                          ))}
                                        </select>
                                      </div>
                                      <div>
                                        <label htmlFor={`ce-from-${qi}`} style={lblSm}>من آية</label>
                                        <input id={`ce-from-${qi}`} type="number" value={q.fromVerse || ''} min={1}
                                          onChange={e => updateQ(qi, 'fromVerse', e.target.value)}
                                          className="text-sm focus:border-[#177B58] focus:outline-none" style={{ ...field, fontVariantNumeric: 'tabular-nums' }} placeholder="1" />
                                      </div>
                                      <div>
                                        <label htmlFor={`ce-to-${qi}`} style={lblSm}>إلى آية</label>
                                        <input id={`ce-to-${qi}`} type="number" value={q.toVerse || ''} min={1}
                                          onChange={e => updateQ(qi, 'toVerse', e.target.value)}
                                          className="text-sm focus:border-[#177B58] focus:outline-none" style={{ ...field, fontVariantNumeric: 'tabular-nums' }} placeholder="5" />
                                      </div>
                                    </div>
                                    <div>
                                      <span style={lblSm} id={`ce-mode-${qi}`}>الوضع الافتراضي</span>
                                      <div className="flex gap-2" role="group" aria-labelledby={`ce-mode-${qi}`}>
                                        <button type="button" onClick={() => updateQ(qi, 'mode', 'practice')}
                                          aria-pressed={q.mode === 'practice'}
                                          className="flex-1 text-sm font-bold"
                                          style={{
                                            minHeight: 48, padding: '8px 12px', borderRadius: 12, cursor: 'pointer',
                                            border: `2px solid ${q.mode === 'practice' ? HQ.MENTOR : HQ.LINE}`,
                                            background: q.mode === 'practice' ? '#E2EFE7' : HQ.SURFACE,
                                            color: q.mode === 'practice' ? '#0F5940' : HQ.MUTED,
                                          }}>
                                          تدريب (يرى النص ويسمع)
                                        </button>
                                        <button type="button" onClick={() => updateQ(qi, 'mode', 'quiz')}
                                          aria-pressed={q.mode === 'quiz'}
                                          className="flex-1 text-sm font-bold"
                                          style={{
                                            minHeight: 48, padding: '8px 12px', borderRadius: 12, cursor: 'pointer',
                                            border: `2px solid ${q.mode === 'quiz' ? HQ.MENTOR : HQ.LINE}`,
                                            background: q.mode === 'quiz' ? '#E2EFE7' : HQ.SURFACE,
                                            color: q.mode === 'quiz' ? '#0F5940' : HQ.MUTED,
                                          }}>
                                          تسميع (بدون نص)
                                        </button>
                                      </div>
                                    </div>
                                    <div>
                                      <label htmlFor={`ce-inst-${qi}`} style={lblSm}>تعليمات للطالب</label>
                                      <textarea id={`ce-inst-${qi}`} value={q.instruction || ''}
                                        onChange={e => updateQ(qi, 'instruction', e.target.value)}
                                        className="text-sm resize-none focus:border-[#177B58] focus:outline-none" style={{ ...field, minHeight: 64 }}
                                        placeholder="مثال: اقرأ الآيات بصوت واضح مع مراعاة أحكام التجويد..." />
                                    </div>
                                  </div>
                                )}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>

                {/* Add Question Buttons */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3" role="group" aria-label="إضافة سؤال">
                  {QUESTION_TYPES.map(t => (
                    <button key={t.value} type="button"
                      onClick={() => addQuestion(t.value)}
                      className="flex items-center justify-center gap-2 p-4 text-sm font-bold"
                      style={{
                        minHeight: 56, borderRadius: 12, cursor: 'pointer',
                        border: `2px dashed ${HQ.LINE}`, background: HQ.SURFACE, color: HQ.INK,
                      }}>
                      <Plus size={16} aria-hidden />
                      <span>{t.label}</span>
                    </button>
                  ))}
                </div>
              </motion.section>
            </div>

            {/* Sidebar Stats - 1 col */}
            <div className="space-y-5">
              {/* Summary Card */}
              <motion.aside initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}
                aria-label="ملخص التقييم"
                className="p-6 lg:sticky lg:top-20"
                style={{ background: HQ.SURFACE, border: `1px solid ${HQ.LINE}`, borderRadius: 18 }}>
                <h3 className="font-bold text-sm mb-4 flex items-center gap-2" style={{ color: HQ.INK, marginTop: 0 }}>
                  <FileText size={15} color={HQ.MENTOR} aria-hidden /> ملخص التقييم
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center text-sm">
                    <span style={{ color: HQ.MUTED }}>إجمالي الأسئلة</span>
                    <span className="font-extrabold text-lg" style={{ color: HQ.INK, fontVariantNumeric: 'tabular-nums' }}>{exam.questions.length}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span style={{ color: HQ.MUTED }}>إجمالي النقاط</span>
                    <span className="font-extrabold text-lg" style={{ color: HQ.INK, fontVariantNumeric: 'tabular-nums' }}>{totalPoints}</span>
                  </div>
                  <div className="pt-3 space-y-2" style={{ borderTop: `1px solid ${HQ.LINE}` }}>
                    {[
                      { label: 'اختياري', n: questionStats.mcq },
                      { label: 'صح / خطأ', n: questionStats.true_false },
                      { label: 'كتابي', n: questionStats.written },
                      { label: 'شفهي', n: questionStats.recitation },
                    ].map(r => (
                      <div key={r.label} className="flex justify-between items-center">
                        <span className="text-xs" style={{ color: HQ.MUTED }}>{r.label}</span>
                        <span className="text-xs font-bold px-2 py-0.5"
                          style={{ background: '#E2EFE7', color: '#0F5940', borderRadius: 9999, fontVariantNumeric: 'tabular-nums' }}>{r.n}</span>
                      </div>
                    ))}
                  </div>
                  <div className="pt-3 space-y-2" style={{ borderTop: `1px solid ${HQ.LINE}` }}>
                    <div className="flex justify-between items-center text-sm">
                      <span style={{ color: HQ.MUTED }}>المدة</span>
                      <span className="font-semibold" style={{ color: HQ.INK }}>{exam.duration} دقيقة</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span style={{ color: HQ.MUTED }}>درجة النجاح</span>
                      <span className="font-semibold" style={{ color: HQ.INK }}>{exam.passingScore}%</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span style={{ color: HQ.MUTED }}>إعادة المحاولة</span>
                      <span className="font-semibold" style={{ color: exam.allowRetries ? HQ.MENTOR : '#C2410C' }}>
                        {exam.allowRetries ? 'مسموح' : 'غير مسموح'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Target Type Info in sidebar */}
                <div className="mt-4 p-3 space-y-1 text-xs" style={{ background: HQ.PAPER, borderRadius: 12 }}>
                  <div className="flex justify-between items-center" style={{ color: HQ.MUTED }}>
                    <span>نوع التوجيه:</span>
                    <span className="font-bold" style={{ color: HQ.INK }}>
                      {targetType === 'individual' ? 'امتحان فردي' : targetType === 'level' ? 'امتحان مستوى' : 'امتحان مجموعة'}
                    </span>
                  </div>
                  {targetType === 'individual' && targetStudentId && (
                    <div className="flex justify-between items-center" style={{ color: HQ.MUTED }}>
                      <span>الطالب:</span>
                      <span className="font-bold" style={{ color: HQ.INK }}>
                        {groupStudents.find(s => s._id === targetStudentId)?.firstName} {groupStudents.find(s => s._id === targetStudentId)?.lastName}
                      </span>
                    </div>
                  )}
                  {targetType === 'level' && (
                    <div className="flex justify-between items-center" style={{ color: HQ.MUTED }}>
                      <span>المستوى:</span>
                      <span className="font-bold" style={{ color: HQ.INK }}>
                        {LEVEL_OPTIONS.find(l => l.value === selectedLevel)?.label}
                      </span>
                    </div>
                  )}
                </div>

                {/* Validation */}
                {(!exam.title.trim() ||
                  (targetType === 'group' && !selectedGroupId) ||
                  (targetType === 'individual' && (!selectedGroupId || !targetStudentId)) ||
                  (targetType === 'level' && !selectedLevel) ||
                  exam.questions.some(q => !q.text.trim())) && (
                  <div className="mt-4 p-3" style={{ background: HQ.PAPER, border: `1px solid ${HQ.LINE}`, borderRadius: 12 }}>
                    <div className="flex items-center gap-1.5 mb-1.5" style={{ color: '#B45309' }}>
                      <AlertCircle size={15} aria-hidden />
                      <span className="text-xs font-bold">مطلوب للحفظ:</span>
                    </div>
                    <ul className="space-y-1 text-xs" style={{ color: HQ.INK, margin: 0, paddingInlineStart: 16 }}>
                      {!exam.title.trim() && <li>عنوان التقييم / الامتحان</li>}
                      {targetType === 'group' && !selectedGroupId && <li>اختيار المجموعة</li>}
                      {targetType === 'individual' && !selectedGroupId && <li>اختيار مجموعة الطالب</li>}
                      {targetType === 'individual' && !targetStudentId && <li>تحديد الطالب المستهدف</li>}
                      {targetType === 'level' && !selectedLevel && <li>اختيار المستوى المستهدف</li>}
                      {exam.questions.some(q => !q.text.trim()) && <li>إكمال نص جميع الأسئلة</li>}
                    </ul>
                  </div>
                )}

                {/* Save Button */}
                <button type="button" onClick={handleSave}
                  disabled={
                    saving ||
                    !exam.title.trim() ||
                    (targetType === 'group' && !selectedGroupId) ||
                    (targetType === 'individual' && (!selectedGroupId || !targetStudentId)) ||
                    (targetType === 'level' && !selectedLevel) ||
                    exam.questions.length === 0 ||
                    exam.questions.some(q => !q.text.trim())
                  }
                  className="hq-action w-full mt-5"
                  style={{ background: HQ.MENTOR, color: '#fff', fontSize: 15, opacity: saving ? 0.6 : 1 }}>
                  {saving ? <LoadingSpinner size="sm" color="white" /> : (
                    <><Save size={18} aria-hidden /> حفظ ونشر الامتحان</>
                  )}
                </button>
              </motion.aside>
            </div>
          </div>
        </div>
      </PageLayout>
    </MotionConfig>
  );
}
