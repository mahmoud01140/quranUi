import { useState, useEffect } from 'react';
import { motion, AnimatePresence, MotionConfig } from 'framer-motion';
import {
  Settings, HelpCircle, FileCheck2, Plus, Trash2, Save,
  CheckCircle, Book, Clock, Award, Users, GraduationCap,
  HeartHandshake, ChevronDown, ChevronUp, Copy, Check, X,
  RefreshCw, Mic,
} from 'lucide-react';
import toast from 'react-hot-toast';
import PageLayout from '../../components/shared/PageLayout';
import LoadingSpinner from '../../components/shared/LoadingSpinner';
import api from '../../services/api';
import QURAN_SURAHS from '../../utils/quranData';
import '../../components/halaqa/halaqa.css';
import { HQ } from '../../components/halaqa/primitives';

/* Onboarding settings — placement exams and surveys per role.
   Same roles, questions, options and save payloads; visual only. */

const USER_ROLES = [
  { id: 'student', title: 'الطلاب', desc: 'تحديد المستوى واستبيان الطلاب الجدد', Icon: Users, tone: 'mentor' },
  { id: 'teacher', title: 'المعلمون', desc: 'اختبار كفاءة واستبيان المعلمين', Icon: GraduationCap, tone: 'guide' },
  { id: 'senior', title: 'كبار السن', desc: 'استبيان واختبار الفئات الخاصة', Icon: HeartHandshake, tone: 'neutral' },
];

const ROLE_TONE = {
  mentor: { wash: '#E2EFE7', fg: '#0F5940', border: '#177B58' },
  guide: { wash: '#ECE9F4', fg: '#4A3F6B', border: '#4A3F6B' },
  neutral: { wash: '#FBF7EE', fg: '#2A2438', border: '#2A2438' },
};

const QUESTION_TYPES = [
  { value: 'mcq', label: 'اختيار من متعدد', Icon: CheckCircle },
  { value: 'true_false', label: 'صح / خطأ', Icon: Check },
  { value: 'recitation', label: 'تلاوة / شفهي', Icon: Mic },
];

const EMPTY_EXAM_Q = {
  type: 'mcq',
  text: '',
  arabicText: '',
  instruction: '',
  options: ['', '', '', ''],
  correctAnswer: 0,
  correctAnswerBool: true,
  points: 1,
  surahNumber: '',
  fromVerse: '',
  toVerse: '',
  mode: 'practice',
};

const EMPTY_SURVEY_Q = {
  id: '',
  text: '',
  options: ['', '', ''],
};

const field = {
  width: '100%', minHeight: 48, background: HQ.SURFACE, color: HQ.INK,
  border: `1px solid ${HQ.LINE}`, borderRadius: 12, padding: '12px 16px',
  fontSize: 14, fontFamily: 'inherit',
};

export default function AdminOnboardingSettingsPage() {
  const [selectedRole, setSelectedRole] = useState('student');
  const [activeTab, setActiveTab] = useState('placement'); // 'placement' | 'survey'
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Placement Exam state
  const [placementExam, setPlacementExam] = useState({
    title: '',
    duration: 30,
    passingScore: 60,
    questions: [],
    oralTasks: [],
  });

  // Survey state
  const [surveyData, setSurveyData] = useState({
    title: '',
    questions: [],
  });

  // Expanded question indices
  const [expandedExamQ, setExpandedExamQ] = useState(0);

  // Load Data for current selected role
  useEffect(() => {
    fetchData();
  }, [selectedRole]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [examRes, surveyRes] = await Promise.all([
        api.get(`/exams/placement/${selectedRole}`).catch(() => ({ data: { exam: null } })),
        api.get(`/survey/${selectedRole}`).catch(() => ({ data: { survey: null } })),
      ]);

      if (examRes.data?.exam) {
        setPlacementExam({
          title: examRes.data.exam.title || 'امتحان تحديد المستوى',
          duration: examRes.data.exam.duration || 30,
          passingScore: examRes.data.exam.passingScore || 60,
          questions: examRes.data.exam.questions || [],
          oralTasks: examRes.data.exam.oralTasks || [],
        });
      } else {
        setPlacementExam({
          title: `امتحان تحديد المستوى — ${USER_ROLES.find(r => r.id === selectedRole)?.title || ''}`,
          duration: 30,
          passingScore: 60,
          questions: [{ ...EMPTY_EXAM_Q }],
          oralTasks: [],
        });
      }

      if (surveyRes.data?.survey) {
        setSurveyData({
          title: surveyRes.data.survey.title || 'استبيان التسجيل',
          questions: surveyRes.data.survey.questions || [],
        });
      } else {
        setSurveyData({
          title: `استبيان تسجيل ${USER_ROLES.find(r => r.id === selectedRole)?.title || ''}`,
          questions: [],
        });
      }
    } catch (err) {
      toast.error('حدث خطأ في تحميل البيانات');
    } finally {
      setLoading(false);
    }
  };

  // ── Placement Exam Handlers ────────────────────────────────────────────────
  const addExamQuestion = () => {
    setPlacementExam(prev => ({
      ...prev,
      questions: [...prev.questions, { ...EMPTY_EXAM_Q }],
    }));
    setExpandedExamQ(placementExam.questions.length);
  };

  const updateExamQuestion = (idx, fieldName, value) => {
    setPlacementExam(prev => {
      const qList = [...prev.questions];
      qList[idx] = { ...qList[idx], [fieldName]: value };
      return { ...prev, questions: qList };
    });
  };

  const updateExamOption = (qIdx, optIdx, value) => {
    setPlacementExam(prev => {
      const qList = [...prev.questions];
      const opts = [...(qList[qIdx].options || ['', '', '', ''])];
      opts[optIdx] = value;
      qList[qIdx] = { ...qList[qIdx], options: opts };
      return { ...prev, questions: qList };
    });
  };

  const removeExamQuestion = (idx) => {
    setPlacementExam(prev => ({
      ...prev,
      questions: prev.questions.filter((_, i) => i !== idx),
    }));
  };

  const duplicateExamQuestion = (idx) => {
    setPlacementExam(prev => {
      const qToDup = { ...prev.questions[idx] };
      const qList = [...prev.questions];
      qList.splice(idx + 1, 0, qToDup);
      return { ...prev, questions: qList };
    });
  };

  const savePlacementExam = async () => {
    try {
      setSaving(true);
      await api.put(`/exams/admin/placement/${selectedRole}`, placementExam);
      toast.success('تم حفظ امتحان تحديد المستوى بنجاح!');
    } catch (err) {
      toast.error(err.response?.data?.message || 'خطأ في حفظ الامتحان');
    } finally {
      setSaving(false);
    }
  };

  // ── Survey Handlers ────────────────────────────────────────────────────────
  const addSurveyQuestion = () => {
    setSurveyData(prev => ({
      ...prev,
      questions: [
        ...prev.questions,
        { id: `q_${Date.now()}`, text: '', options: ['خيار 1', 'خيار 2'] },
      ],
    }));
  };

  const updateSurveyQuestion = (idx, fieldName, value) => {
    setSurveyData(prev => {
      const qList = [...prev.questions];
      qList[idx] = { ...qList[idx], [fieldName]: value };
      return { ...prev, questions: qList };
    });
  };

  const updateSurveyOption = (qIdx, optIdx, value) => {
    setSurveyData(prev => {
      const qList = [...prev.questions];
      const opts = [...(qList[qIdx].options || [])];
      opts[optIdx] = value;
      qList[qIdx] = { ...qList[qIdx], options: opts };
      return { ...prev, questions: qList };
    });
  };

  const addSurveyOption = (qIdx) => {
    setSurveyData(prev => {
      const qList = [...prev.questions];
      const opts = [...(qList[qIdx].options || []), `خيار جديد`];
      qList[qIdx] = { ...qList[qIdx], options: opts };
      return { ...prev, questions: qList };
    });
  };

  const removeSurveyOption = (qIdx, optIdx) => {
    setSurveyData(prev => {
      const qList = [...prev.questions];
      const opts = (qList[qIdx].options || []).filter((_, i) => i !== optIdx);
      qList[qIdx] = { ...qList[qIdx], options: opts };
      return { ...prev, questions: qList };
    });
  };

  const removeSurveyQuestion = (idx) => {
    setSurveyData(prev => ({
      ...prev,
      questions: prev.questions.filter((_, i) => i !== idx),
    }));
  };

  const saveSurvey = async () => {
    try {
      setSaving(true);
      await api.put(`/survey/admin/${selectedRole}`, surveyData);
      toast.success('تم حفظ أسئلة الاستبيان بنجاح!');
    } catch (err) {
      toast.error(err.response?.data?.message || 'خطأ في حفظ الاستبيان');
    } finally {
      setSaving(false);
    }
  };

  const panel = {
    background: HQ.SURFACE, border: `1px solid ${HQ.LINE}`, borderRadius: 18, padding: 20,
  };
  const lbl = { fontSize: 14, fontWeight: 700, color: HQ.INK, marginBottom: 6, display: 'block' };
  const lblSm = { fontSize: '0.8125rem', fontWeight: 700, color: HQ.MUTED, marginBottom: 6, display: 'block' };
  const iconBtn = {
    minWidth: 44, minHeight: 44, borderRadius: 12, border: 'none', background: 'transparent',
    color: HQ.MUTED, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  };
  const primaryBtn = {
    minHeight: 48, padding: '12px 20px', borderRadius: 12, border: 'none',
    background: HQ.MENTOR, color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
  };

  return (
    <MotionConfig reducedMotion="user">
      <PageLayout>
        <div className="halaqa" style={{ maxWidth: 1000, margin: '0 auto' }}>
          {/* Header */}
          <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <span aria-hidden style={{
                  width: 40, height: 40, borderRadius: 14, background: HQ.MENTOR, color: '#fff',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flex: 'none',
                }}>
                  <Settings size={19} />
                </span>
                <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: HQ.INK, margin: 0 }}>إدارة تحديد المستوى والاستبيانات</h1>
              </div>
              <p className="text-sm" style={{ color: HQ.MUTED, margin: 0 }}>
                تخصيص أسئلة اختبارات تحديد المستوى واستبيانات التسجيل لجميع فئات المستخدمين
              </p>
            </div>

            <button
              type="button"
              onClick={fetchData}
              disabled={loading}
              className="text-xs flex items-center gap-2 self-start md:self-auto"
              style={{
                minHeight: 44, padding: '8px 16px', borderRadius: 12, cursor: 'pointer',
                background: 'transparent', color: HQ.MUTED, border: 'none', fontWeight: 800,
                opacity: loading ? 0.55 : 1,
              }}
            >
              <RefreshCw size={14} aria-hidden className={loading ? 'animate-spin' : ''} />
              تحديث البيانات
            </button>
          </div>

          {/* Role Selection Tabs */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6" role="group" aria-label="فئة المستخدمين">
            {USER_ROLES.map((r) => {
              const isSelected = selectedRole === r.id;
              const tone = ROLE_TONE[r.tone];
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setSelectedRole(r.id)}
                  aria-pressed={isSelected}
                  className="p-4 text-right flex items-center gap-3"
                  style={{
                    borderRadius: 18, cursor: 'pointer',
                    border: `2px solid ${isSelected ? tone.border : HQ.LINE}`,
                    background: isSelected ? tone.wash : HQ.SURFACE,
                  }}
                >
                  <span aria-hidden style={{
                    width: 44, height: 44, borderRadius: 12, flex: 'none',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    background: isSelected ? HQ.SURFACE : HQ.PAPER, color: isSelected ? tone.fg : HQ.MUTED,
                  }}>
                    <r.Icon size={20} />
                  </span>
                  <span className="min-w-0">
                    <span className="font-extrabold text-sm block" style={{ color: HQ.INK }}>
                      {r.title}
                    </span>
                    <span className="text-xs block truncate mt-0.5" style={{ color: HQ.MUTED }}>{r.desc}</span>
                  </span>
                </button>
              );
            })}
          </div>

          {/* Section Switcher (Placement Exam vs Survey) */}
          <div className="flex gap-6 mb-6" role="tablist" aria-label="نوع المحتوى"
            style={{ borderBottom: `1px solid ${HQ.LINE}` }}>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'placement'}
              onClick={() => setActiveTab('placement')}
              className="text-sm font-extrabold flex items-center gap-2"
              style={{
                paddingBottom: 12, background: 'none', border: 'none', cursor: 'pointer', minHeight: 48,
                borderBottom: `2px solid ${activeTab === 'placement' ? HQ.MENTOR : 'transparent'}`,
                color: activeTab === 'placement' ? HQ.MENTOR : HQ.MUTED, marginBottom: -1,
              }}
            >
              <FileCheck2 size={15} aria-hidden />
              امتحان تحديد المستوى ({placementExam.questions?.length || 0} أسئلة)
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'survey'}
              onClick={() => setActiveTab('survey')}
              className="text-sm font-extrabold flex items-center gap-2"
              style={{
                paddingBottom: 12, background: 'none', border: 'none', cursor: 'pointer', minHeight: 48,
                borderBottom: `2px solid ${activeTab === 'survey' ? HQ.MENTOR : 'transparent'}`,
                color: activeTab === 'survey' ? HQ.MENTOR : HQ.MUTED, marginBottom: -1,
              }}
            >
              <HelpCircle size={15} aria-hidden />
              استبيان التسجيل ({surveyData.questions?.length || 0} أسئلة)
            </button>
          </div>

          {loading ? (
            <div className="py-20 flex justify-center">
              <LoadingSpinner size="lg" text="جارٍ جلب إعدادات القسم..." />
            </div>
          ) : activeTab === 'placement' ? (
            <div className="space-y-6">
              {/* General Exam Settings Card */}
              <div style={panel} className="space-y-4">
                <h2 className="font-extrabold flex items-center gap-2" style={{ fontSize: '1rem', color: HQ.INK, margin: 0 }}>
                  <Award size={18} color={HQ.MENTOR} aria-hidden />
                  إعدادات الامتحان الأساسية
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label htmlFor="os-title" style={lblSm}>عنوان الاختبار</label>
                    <input
                      id="os-title"
                      type="text"
                      value={placementExam.title}
                      onChange={e => setPlacementExam(p => ({ ...p, title: e.target.value }))}
                      className="text-sm focus:border-[#177B58] focus:outline-none" style={field}
                      placeholder="مثال: امتحان تحديد المستوى للطلاب"
                    />
                  </div>
                  <div>
                    <label htmlFor="os-dur" style={lblSm}>المدة الزمنية (بالدقائق)</label>
                    <div className="relative">
                      <Clock size={15} color={HQ.MUTED} aria-hidden className="absolute right-3 top-1/2 -translate-y-1/2" />
                      <input
                        id="os-dur"
                        type="number"
                        min={5}
                        max={180}
                        value={placementExam.duration}
                        onChange={e => setPlacementExam(p => ({ ...p, duration: parseInt(e.target.value) || 30 }))}
                        className="text-sm pr-10 focus:border-[#177B58] focus:outline-none"
                        style={{ ...field, fontVariantNumeric: 'tabular-nums' }}
                      />
                    </div>
                  </div>
                  <div>
                    <label htmlFor="os-pass" style={lblSm}>نسبة النجاح للترقية (%)</label>
                    <input
                      id="os-pass"
                      type="number"
                      min={1}
                      max={100}
                      value={placementExam.passingScore}
                      onChange={e => setPlacementExam(p => ({ ...p, passingScore: parseInt(e.target.value) || 60 }))}
                      className="text-sm focus:border-[#177B58] focus:outline-none"
                      style={{ ...field, fontVariantNumeric: 'tabular-nums' }}
                    />
                  </div>
                </div>
              </div>

              {/* Questions Header & Add Button */}
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <h2 className="font-extrabold" style={{ fontSize: '1.25rem', color: HQ.INK, margin: 0 }}>أسئلة امتحان تحديد المستوى</h2>
                  <p className="text-xs" style={{ color: HQ.MUTED, margin: 0 }}>تشمل الأسئلة التحريرية (اختيار من متعدد، صح/خطأ) والأسئلة الشفهية (تلاوة وتسميع صوتي)</p>
                </div>
                <button
                  type="button"
                  onClick={addExamQuestion}
                  style={{ ...primaryBtn, minHeight: 44, fontSize: '0.8125rem' }}
                >
                  <Plus size={15} aria-hidden />
                  إضافة سؤال جديد
                </button>
              </div>

              {/* Questions List */}
              <div className="space-y-4">
                {placementExam.questions.map((q, qi) => {
                  const isExpanded = expandedExamQ === qi;
                  const typeObj = QUESTION_TYPES.find(t => t.value === q.type) || QUESTION_TYPES[0];

                  return (
                    <div
                      key={qi}
                      style={{ ...panel, padding: 0, overflow: 'hidden' }}
                    >
                      {/* Collapsed Header */}
                      <div
                        role="button" tabIndex={0} aria-expanded={isExpanded}
                        onClick={() => setExpandedExamQ(isExpanded ? -1 : qi)}
                        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setExpandedExamQ(isExpanded ? -1 : qi); } }}
                        className="p-4 flex items-center gap-3 cursor-pointer"
                        style={{ minHeight: 64 }}
                      >
                        <span aria-hidden style={{
                          width: 32, height: 32, borderRadius: 12, background: HQ.MENTOR, color: '#fff',
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                          fontWeight: 800, fontSize: '0.8125rem', flex: 'none', fontVariantNumeric: 'tabular-nums',
                        }}>
                          {qi + 1}
                        </span>

                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-sm truncate" style={{ color: HQ.INK, margin: 0 }}>
                            {q.text || q.arabicText || <span style={{ color: HQ.MUTED, fontStyle: 'italic' }}>سؤال جديد...</span>}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <span style={{
                              display: 'inline-flex', alignItems: 'center', gap: 4,
                              fontSize: '0.8125rem', fontWeight: 700, padding: '4px 12px', borderRadius: 9999,
                              background: '#E2EFE7', color: '#0F5940',
                            }}>
                              <typeObj.Icon size={12} aria-hidden /> {typeObj.label}
                            </span>
                            <span style={{ fontSize: '0.8125rem', color: HQ.MUTED, fontVariantNumeric: 'tabular-nums' }}>{q.points || 1} نقطة</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 flex-none">
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); duplicateExamQuestion(qi); }}
                            style={iconBtn}
                            title="نسخ السؤال" aria-label="نسخ السؤال"
                          >
                            <Copy size={15} aria-hidden />
                          </button>
                          {placementExam.questions.length > 1 && (
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); removeExamQuestion(qi); }}
                              style={{ ...iconBtn, color: '#C2410C' }}
                              title="حذف السؤال" aria-label="حذف السؤال"
                            >
                              <Trash2 size={15} aria-hidden />
                            </button>
                          )}
                          <span className="p-1" style={{ color: HQ.MUTED }} aria-hidden>
                            {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                          </span>
                        </div>
                      </div>

                      {/* Expanded Body */}
                      <AnimatePresence initial={false}>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden"
                          >
                            <div className="px-5 pb-5 pt-3 space-y-4" style={{ borderTop: `1px solid ${HQ.LINE}` }}>
                              {/* Type Selector */}
                              <div>
                                <span style={lblSm} id={`os-type-${qi}`}>نوع السؤال</span>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2" role="group" aria-labelledby={`os-type-${qi}`}>
                                  {QUESTION_TYPES.map((t) => (
                                    <button
                                      key={t.value}
                                      type="button"
                                      onClick={() => updateExamQuestion(qi, 'type', t.value)}
                                      aria-pressed={q.type === t.value}
                                      className="text-xs font-bold flex items-center justify-center gap-1.5"
                                      style={{
                                        minHeight: 48, padding: '8px 12px', borderRadius: 12, cursor: 'pointer',
                                        border: `2px solid ${q.type === t.value ? HQ.MENTOR : HQ.LINE}`,
                                        background: q.type === t.value ? '#E2EFE7' : HQ.SURFACE,
                                        color: q.type === t.value ? '#0F5940' : HQ.MUTED,
                                      }}
                                    >
                                      <t.Icon size={14} aria-hidden />
                                      <span>{t.label}</span>
                                    </button>
                                  ))}
                                </div>
                              </div>

                              {/* Question Text */}
                              <div>
                                <label htmlFor={`os-text-${qi}`} style={lblSm}>نص السؤال *</label>
                                <textarea
                                  id={`os-text-${qi}`}
                                  value={q.text || ''}
                                  onChange={e => updateExamQuestion(qi, 'text', e.target.value)}
                                  className="text-sm resize-none focus:border-[#177B58] focus:outline-none"
                                  style={{ ...field, minHeight: 72 }}
                                  placeholder="اكتب نص السؤال هنا..."
                                />
                              </div>

                              {/* Question Points */}
                              <div className="w-32">
                                <label htmlFor={`os-pts-${qi}`} style={lblSm}>الدرجة</label>
                                <input
                                  id={`os-pts-${qi}`}
                                  type="number"
                                  min={1}
                                  max={20}
                                  value={q.points || 1}
                                  onChange={e => updateExamQuestion(qi, 'points', parseInt(e.target.value) || 1)}
                                  className="text-sm text-center focus:border-[#177B58] focus:outline-none"
                                  style={{ ...field, fontVariantNumeric: 'tabular-nums' }}
                                />
                              </div>

                              {/* 1. MCQ OPTIONS */}
                              {q.type === 'mcq' && (
                                <div className="space-y-2.5 p-4" style={{ background: HQ.PAPER, border: `1px solid ${HQ.LINE}`, borderRadius: 12 }}>
                                  <span style={lblSm}>
                                    خيارات الإجابة (اضغط الدائرة لتحديد الإجابة الصحيحة):
                                  </span>
                                  {(q.options || ['', '', '', '']).map((opt, oi) => (
                                    <div key={oi} className="flex items-center gap-2.5">
                                      <button
                                        type="button"
                                        onClick={() => updateExamQuestion(qi, 'correctAnswer', oi)}
                                        aria-label={`تحديد الخيار ${oi + 1} كإجابة صحيحة`} aria-pressed={q.correctAnswer === oi}
                                        style={{
                                          width: 30, height: 30, borderRadius: 9999, flex: 'none',
                                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                                          border: `2px solid ${q.correctAnswer === oi ? HQ.MENTOR : HQ.LINE}`,
                                          background: q.correctAnswer === oi ? HQ.MENTOR : 'transparent', color: '#fff',
                                        }}
                                      >
                                        {q.correctAnswer === oi && <Check size={15} strokeWidth={3.5} aria-hidden />}
                                      </button>
                                      <input
                                        type="text"
                                        value={opt}
                                        onChange={e => updateExamOption(qi, oi, e.target.value)}
                                        aria-label={`نص الخيار ${oi + 1}`}
                                        className="text-sm flex-1 focus:border-[#177B58] focus:outline-none" style={field}
                                        placeholder={`الخيار ${oi + 1}`}
                                      />
                                    </div>
                                  ))}
                                </div>
                              )}

                              {/* 2. TRUE / FALSE */}
                              {q.type === 'true_false' && (
                                <div className="p-4" style={{ background: HQ.PAPER, border: `1px solid ${HQ.LINE}`, borderRadius: 12 }}>
                                  <span style={lblSm}>
                                    الإجابة الصحيحة لهذا السؤال:
                                  </span>
                                  <div className="grid grid-cols-2 gap-3">
                                    <button
                                      type="button"
                                      onClick={() => updateExamQuestion(qi, 'correctAnswerBool', true)}
                                      aria-pressed={q.correctAnswerBool !== false}
                                      className="text-sm font-bold flex items-center justify-center gap-2"
                                      style={{
                                        minHeight: 56, padding: '12px 16px', borderRadius: 12, cursor: 'pointer',
                                        border: `2px solid ${q.correctAnswerBool !== false ? HQ.MENTOR : HQ.LINE}`,
                                        background: q.correctAnswerBool !== false ? '#E2EFE7' : HQ.SURFACE,
                                        color: q.correctAnswerBool !== false ? '#0F5940' : HQ.MUTED,
                                      }}
                                    >
                                      <Check size={17} strokeWidth={2.5} aria-hidden />
                                      <span>صحيح (صح)</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => updateExamQuestion(qi, 'correctAnswerBool', false)}
                                      aria-pressed={q.correctAnswerBool === false}
                                      className="text-sm font-bold flex items-center justify-center gap-2"
                                      style={{
                                        minHeight: 56, padding: '12px 16px', borderRadius: 12, cursor: 'pointer',
                                        border: `2px solid ${q.correctAnswerBool === false ? HQ.MENTOR : HQ.LINE}`,
                                        background: q.correctAnswerBool === false ? '#E2EFE7' : HQ.SURFACE,
                                        color: q.correctAnswerBool === false ? '#0F5940' : HQ.MUTED,
                                      }}
                                    >
                                      <X size={17} strokeWidth={2.5} aria-hidden />
                                      <span>خطأ</span>
                                    </button>
                                  </div>
                                </div>
                              )}


                              {q.type === 'recitation' && (
                                <div className="p-4 space-y-4" style={{ background: HQ.PAPER, border: `1px solid ${HQ.LINE}`, borderRadius: 12 }}>
                                  <div className="flex items-center gap-2">
                                    <Mic size={16} color={HQ.MENTOR} aria-hidden />
                                    <span className="text-xs font-bold" style={{ color: HQ.INK }}>إعدادات سؤال التلاوة والتسميع الشفهي</span>
                                  </div>

                                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    <div>
                                      <label htmlFor={`os-surah-${qi}`} style={lblSm}>السورة</label>
                                      <select
                                        id={`os-surah-${qi}`}
                                        value={q.surahNumber || ''}
                                        onChange={e => updateExamQuestion(qi, 'surahNumber', e.target.value)}
                                        className="text-sm focus:border-[#177B58] focus:outline-none" style={field}
                                      >
                                        <option value="">اختر السورة (اختياري)</option>
                                        {QURAN_SURAHS.map((s) => (
                                          <option key={s.number} value={s.number}>
                                            {s.number}. {s.name}
                                          </option>
                                        ))}
                                      </select>
                                    </div>
                                    <div>
                                      <label htmlFor={`os-from-${qi}`} style={lblSm}>من آية</label>
                                      <input
                                        id={`os-from-${qi}`}
                                        type="number"
                                        min={1}
                                        value={q.fromVerse || ''}
                                        onChange={e => updateExamQuestion(qi, 'fromVerse', e.target.value)}
                                        className="text-sm focus:border-[#177B58] focus:outline-none"
                                        style={{ ...field, fontVariantNumeric: 'tabular-nums' }}
                                      />
                                    </div>
                                    <div>
                                      <label htmlFor={`os-to-${qi}`} style={lblSm}>إلى آية</label>
                                      <input
                                        id={`os-to-${qi}`}
                                        type="number"
                                        min={1}
                                        value={q.toVerse || ''}
                                        onChange={e => updateExamQuestion(qi, 'toVerse', e.target.value)}
                                        className="text-sm focus:border-[#177B58] focus:outline-none"
                                        style={{ ...field, fontVariantNumeric: 'tabular-nums' }}
                                      />
                                    </div>
                                  </div>

                                  <div>
                                    <label htmlFor={`os-inst-${qi}`} style={lblSm}>تعليمات التسميع للطالب (تظهر للطالب مع السؤال)</label>
                                    <input
                                      id={`os-inst-${qi}`}
                                      type="text"
                                      value={q.instruction || ''}
                                      onChange={e => updateExamQuestion(qi, 'instruction', e.target.value)}
                                      className="text-sm focus:border-[#177B58] focus:outline-none"
                                      style={field}
                                      placeholder="مثال: سجّل تلاوتك بصوت واضح مع مراعاة الترتيل وأحكام التجويد"
                                    />
                                  </div>

                                  <div>
                                    <label htmlFor={`os-ar-${qi}`} style={lblSm}>النص القرآني المطلوب تلاوته (اختياري - يظهر للطالب كمرجع أثناء التسجيل)</label>
                                    <textarea
                                      id={`os-ar-${qi}`}
                                      value={q.arabicText || ''}
                                      onChange={e => updateExamQuestion(qi, 'arabicText', e.target.value)}
                                      className="text-sm resize-none focus:border-[#177B58] focus:outline-none"
                                      style={{ ...field, minHeight: 64, direction: 'rtl' }}
                                      placeholder="اكتب الآيات أو الكلمات القرآنية المطلوب تسميعها إذا رغبت في عرضها للطالب..."
                                    />
                                  </div>
                                </div>
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </div>

              {/* Save Bar */}
              <div className="pt-4 flex justify-end">
                <button
                  type="button"
                  onClick={savePlacementExam}
                  disabled={saving}
                  className="hq-action"
                  style={{ background: HQ.MENTOR, color: '#fff', fontSize: 16, padding: '0 32px', opacity: saving ? 0.6 : 1 }}
                >
                  <Save size={18} aria-hidden />
                  {saving ? 'جارٍ الحفظ...' : 'حفظ اختبار تحديد المستوى'}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Survey Title Card */}
              <div style={panel}>
                <label htmlFor="os-survey-title" style={lblSm}>عنوان الاستبيان</label>
                <input
                  id="os-survey-title"
                  type="text"
                  value={surveyData.title}
                  onChange={e => setSurveyData(p => ({ ...p, title: e.target.value }))}
                  className="text-sm focus:border-[#177B58] focus:outline-none" style={field}
                  placeholder="مثال: استبيان تسجيل الطلاب الجدد"
                />
              </div>

              {/* Survey Header & Add Button */}
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <h2 className="font-extrabold" style={{ fontSize: '1.25rem', color: HQ.INK, margin: 0 }}>أسئلة استبيان التسجيل</h2>
                  <p className="text-xs" style={{ color: HQ.MUTED, margin: 0 }}>تظهر للمستخدم عند التسجيل لتحديد أهدافه وتوجيهه للحلقة المناسبة</p>
                </div>
                <button
                  type="button"
                  onClick={addSurveyQuestion}
                  style={{ ...primaryBtn, minHeight: 44, fontSize: '0.8125rem' }}
                >
                  <Plus size={15} aria-hidden />
                  إضافة سؤال استبيان
                </button>
              </div>

              {/* Survey Questions List */}
              <div className="space-y-4">
                {surveyData.questions.map((sq, sqi) => (
                  <div key={sqi} style={{ ...panel, display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold px-2.5 py-1"
                        style={{ background: '#E2EFE7', color: '#0F5940', borderRadius: 8, fontVariantNumeric: 'tabular-nums' }}>
                        سؤال استبيان #{sqi + 1}
                      </span>
                      {surveyData.questions.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeSurveyQuestion(sqi)}
                          style={{ ...iconBtn, color: '#C2410C' }}
                          title="حذف السؤال" aria-label="حذف السؤال"
                        >
                          <Trash2 size={15} aria-hidden />
                        </button>
                      )}
                    </div>

                    <div>
                      <label htmlFor={`os-sq-${sqi}`} style={lblSm}>نص السؤال</label>
                      <input
                        id={`os-sq-${sqi}`}
                        type="text"
                        value={sq.text}
                        onChange={e => updateSurveyQuestion(sqi, 'text', e.target.value)}
                        className="text-sm font-bold focus:border-[#177B58] focus:outline-none" style={field}
                        placeholder="مثال: ما هو هدفك الأساسي من التسجيل؟"
                      />
                    </div>

                    {/* Survey Options */}
                    <div className="space-y-2.5 p-4" style={{ background: HQ.PAPER, border: `1px solid ${HQ.LINE}`, borderRadius: 12 }}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold" style={{ color: HQ.INK }}>خيارات الإجابة</span>
                        <button
                          type="button"
                          onClick={() => addSurveyOption(sqi)}
                          className="text-xs font-bold flex items-center gap-1"
                          style={{ minHeight: 44, padding: '8px 12px', borderRadius: 8, cursor: 'pointer', background: 'none', border: 'none', color: HQ.MENTOR }}
                        >
                          <Plus size={13} aria-hidden />
                          إضافة خيار
                        </button>
                      </div>

                      {(sq.options || []).map((opt, oi) => (
                        <div key={oi} className="flex items-center gap-2">
                          <span className="text-xs font-bold w-5 text-center" style={{ color: HQ.MUTED, fontVariantNumeric: 'tabular-nums' }}>{oi + 1}</span>
                          <input
                            type="text"
                            value={opt}
                            onChange={e => updateSurveyOption(sqi, oi, e.target.value)}
                            aria-label={`نص الخيار ${oi + 1} للسؤال ${sqi + 1}`}
                            className="text-sm flex-1 focus:border-[#177B58] focus:outline-none" style={field}
                            placeholder={`خيار ${oi + 1}`}
                          />
                          {(sq.options || []).length > 2 && (
                            <button
                              type="button"
                              onClick={() => removeSurveyOption(sqi, oi)}
                              style={{ ...iconBtn, minWidth: 44, minHeight: 44, color: '#C2410C' }}
                              aria-label={`حذف الخيار ${oi + 1}`}
                            >
                              <Trash2 size={14} aria-hidden />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Save Bar */}
              <div className="pt-4 flex justify-end">
                <button
                  type="button"
                  onClick={saveSurvey}
                  disabled={saving}
                  className="hq-action"
                  style={{ background: HQ.MENTOR, color: '#fff', fontSize: 16, padding: '0 32px', opacity: saving ? 0.6 : 1 }}
                >
                  <Save size={18} aria-hidden />
                  {saving ? 'جارٍ الحفظ...' : 'حفظ أسئلة الاستبيان'}
                </button>
              </div>
            </div>
          )}
        </div>
      </PageLayout>
    </MotionConfig>
  );
}
