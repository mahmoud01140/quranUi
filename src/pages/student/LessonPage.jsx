import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowRight, BookOpen, Video, Award, PenTool, Lock,
  FileText, Plus, Trash2, Check, ChevronLeft, ChevronRight, MessageCircle,
} from 'lucide-react';

import Navbar from '../../components/shared/Navbar';
import Sidebar from '../../components/shared/Sidebar';
import MobileBottomNav from '../../components/shared/MobileBottomNav';
import VideoPlayer, { isVideoUrl } from '../../components/shared/VideoPlayer';
import LessonContent from '../../components/shared/LessonContent';
import LessonResources from '../../components/shared/LessonResources';
import useAuthStore from '../../store/authStore';
import useLessonProgress from '../../hooks/useLessonProgress';
import api from '../../services/api';
import { LESSON_TYPES_AR } from '../../utils/constants';
import toast from 'react-hot-toast';
import '../../components/halaqa/halaqa.css';
import { HQ } from '../../components/halaqa/primitives';

/* الدرس — the learning content is the center. One calm column:
   title → progress steps → video → explanation → resources → quiz → notes → nav.
   Same quiz bank, scoring, notes, and completion logic; only hierarchy changed. */

/* ── Quiz Question Bank (content unchanged) ── */
const QUESTIONS_BANK = {
  tajweed: [
    { q: "ما هو عدد حروف الإظهار الحلقي؟", options: ["3 حروف", "4 حروف", "6 حروف", "8 حروف"], answer: 2 },
    { q: "أي من الحروف التالية يعتبر من حروف الإدغام بغنة؟", options: ["الياء والميم", "الراء واللام", "الهمزة والهاء", "الخاء والغين"], answer: 0 },
    { q: "الإقلاب هو قلب النون الساكنة أو التنوين ميماً مخفاة عند ملاقاة حرف واحد هو:", options: ["الميم (م)", "الباء (ب)", "الواو (و)", "الهمزة (أ)"], answer: 1 },
    { q: "ما هو حكم النون الساكنة في قوله تعالى ﴿ مِن قَبۡلِ ﴾؟", options: ["إظهار حلقي", "إدغام بغنة", "إقلاب", "إخفاء حقيقي"], answer: 3 },
    { q: "ما هو مخرج الغنة الرئيسي في أحكام التجويد؟", options: ["الجوف", "الحلق", "الخيشوم", "الشفتان"], answer: 2 },
  ],
  memorization: [
    { q: "ما هو المعنى الاصطلاحي لـ 'ترتيل القرآن'؟", options: ["القراءة السريعة دون تدبر", "تلاوة القرآن بتمهل وتدبر مع إعطاء كل حرف حقه ومخرجه", "تلاوة القرآن فقط في الصلاة", "حفظ السور دون معرفة معانيها"], answer: 1 },
    { q: "كم عدد صفحات الجزء الواحد في مصحف المدينة النبوية المعتاد؟", options: ["10 صفحات", "15 صفحة", "20 صفحة", "30 صفحة"], answer: 2 },
    { q: "ما هي الطريقة الأفضل لتثبيت الحفظ القديم وتفادي النسيان؟", options: ["الحفظ الجديد باستمرار", "المراجعة التراكمية اليومية (الورد اليومي)", "الاستماع فقط دون قراءة", "المراجعة مرة كل شهر"], answer: 1 },
    { q: "البسملة مشروعة ومطلوبة في أوائل السور جميعها عند البدء، عدا سورة:", options: ["سورة التوبة", "سورة يونس", "سورة الكهف", "سورة الرحمن"], answer: 0 },
    { q: "ما هو الفضل الأكبر لحافظ القرآن في الآخرة؟", options: ["يقال له اقرأ وارتقِ ورتل كما كنت ترتل في الدنيا", "يلبس والداه تاج الوقار", "يكون مع السفرة الكرام البررة", "كل ما سبق صحيح"], answer: 3 },
  ],
  default: [
    { q: "من آداب تلاوة القرآن الكريم الأساسية:", options: ["الوضوء واستحضار النية", "الإنصات والتدبر عند السماع", "تحسين الصوت بالتلاوة", "كل ما سبق صحيح"], answer: 3 },
    { q: "مرتبة قراءة القرآن بتوسط وسرعة معتدلة مع مراعاة الأحكام تسمى:", options: ["الترتيل", "التدوير", "الحدر", "التحقيق"], answer: 1 },
    { q: "الاستعاذة عند البدء بتلاوة القرآن الكريم حكمها:", options: ["مستحبة ومطلوبة", "محرمة", "مكروهة", "مباحة فقط"], answer: 0 },
    { q: "كم عدد سور القرآن الكريم بالكامل؟", options: ["110 سورة", "112 سورة", "114 سورة", "120 سورة"], answer: 2 },
    { q: "السورة التي تعدل تلاوتها ثلث القرآن الكريم هي سورة:", options: ["سورة الفاتحة", "سورة يس", "سورة الكهف", "سورة الإخلاص"], answer: 3 },
  ]
};

export default function LessonPage() {
  const { lessonId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [studyPlan, setStudyPlan] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Notes state (localStorage logic unchanged)
  const [personalNotes, setPersonalNotes] = useState([]);
  const [newNote, setNewNote] = useState('');

  // Quiz state (logic unchanged)
  const [quizStarted, setQuizStarted] = useState(false);
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [selectedOption, setSelectedOption] = useState(null);
  const [showAnswerResult, setShowAnswerResult] = useState(false);
  const [score, setScore] = useState(0);
  const [quizFinished, setQuizFinished] = useState(false);

  // Lesson steps tracker (logic unchanged)
  const { toggleStep, isStepDone, allDone } = useLessonProgress();

  // Load lesson details and personal notes
  useEffect(() => {
    const fetchPlanAndNotes = async () => {
      setIsLoading(true);
      try {
        if (user?._id) {
          const indRes = await api.get(`/study-plans/student/${user._id}/full`).catch(() => null);
          if (indRes?.data?.plan?.customLessons?.some(l => l._id?.toString() === lessonId)) {
            setStudyPlan(indRes.data.plan);
            setIsLoading(false);
            return;
          }
        }
        const groupId = user?.group?._id || user?.group;
        if (groupId) {
          const res = await api.get(`/study-plans/group/${groupId}/full`);
          setStudyPlan(res.data.plan);
        }
      } catch (err) {
        console.error("Error fetching study plan", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPlanAndNotes();

    const savedNotes = localStorage.getItem(`lesson_notes_${lessonId}`);
    if (savedNotes) {
      try {
        setPersonalNotes(JSON.parse(savedNotes));
      } catch (e) {
        console.error(e);
      }
    } else {
      setPersonalNotes([]);
    }

    setQuizStarted(false);
    setCurrentQuestionIdx(0);
    setSelectedOption(null);
    setShowAnswerResult(false);
    setScore(0);
    setQuizFinished(false);
  }, [lessonId, user]);

  // Save notes to localStorage (unchanged)
  const saveNotes = (updated) => {
    setPersonalNotes(updated);
    localStorage.setItem(`lesson_notes_${lessonId}`, JSON.stringify(updated));
  };

  const handleAddNote = () => {
    if (!newNote.trim()) return;
    const note = { id: Date.now().toString(), text: newNote.trim(), createdAt: Date.now() };
    const updated = [note, ...personalNotes];
    saveNotes(updated);
    setNewNote('');
    toast.success('تم حفظ الملاحظة');
  };

  const handleDeleteNote = (id) => {
    const filtered = personalNotes.filter(n => n.id !== id);
    saveNotes(filtered);
    toast.success('تم حذف الملاحظة');
  };

  // Find active lesson and sibling navigation lessons (logic unchanged)
  const { currentLesson, prevLesson, nextLesson, isUnlocked } = useMemo(() => {
    if (!studyPlan?.customLessons?.length) {
      return { currentLesson: null, prevLesson: null, nextLesson: null, isUnlocked: false };
    }
    const lessons = studyPlan.customLessons;
    const activeIndex = lessons.findIndex(l => l._id === lessonId);

    if (activeIndex === -1) {
      return { currentLesson: null, prevLesson: null, nextLesson: null, isUnlocked: false };
    }

    const current = lessons[activeIndex];
    const prev = activeIndex > 0 ? lessons[activeIndex - 1] : null;
    const next = activeIndex < lessons.length - 1 ? lessons[activeIndex + 1] : null;

    let unlocked = true;
    if (activeIndex > 0 && prev) {
      const prevSteps = [
        { key: 'readMaterial' },
        ...(isVideoUrl(prev.resources) ? [{ key: 'watchedVideo' }] : []),
        { key: 'exercises' },
        { key: 'exam' }
      ];
      const prevIdStr = prev._id?.toString();
      const prevDone = (user?.completedLessons || []).some(id => id?.toString() === prevIdStr)
        || prev.status === 'completed'
        || allDone(prev._id, prevSteps) || allDone(prevIdStr, prevSteps);
      unlocked = prevDone;
    }

    return { currentLesson: current, prevLesson: prev, nextLesson: next, isUnlocked: unlocked };
  }, [studyPlan, lessonId, user, allDone]);

  // Quiz questions selection (unchanged)
  const quizQuestions = useMemo(() => {
    if (!currentLesson) return [];
    return QUESTIONS_BANK[currentLesson.type] || QUESTIONS_BANK.default;
  }, [currentLesson]);

  // Auto mark backend completion when lesson is finished (unchanged)
  const markCompleteBackend = async (lid) => {
    try {
      await api.put(`/curriculum/complete-lesson/${lid}`);
    } catch {}
  };

  const handleQuizAnswerSubmit = () => {
    if (selectedOption === null) return;
    setShowAnswerResult(true);
    const correct = quizQuestions[currentQuestionIdx].answer === selectedOption;
    if (correct) setScore(s => s + 1);
  };

  const handleQuizNextQuestion = () => {
    setSelectedOption(null);
    setShowAnswerResult(false);
    if (currentQuestionIdx < quizQuestions.length - 1) {
      setCurrentQuestionIdx(idx => idx + 1);
    } else {
      setQuizFinished(true);
      const finalScore = score + (quizQuestions[currentQuestionIdx].answer === selectedOption ? 1 : 0);
      if (finalScore >= 4) {
        if (!isStepDone(lessonId, 'exam')) {
          toggleStep(lessonId, 'exam');
          toast.success('أحسنت! اجتزت اختبار الدرس وسُجّل تقدمك', { duration: 4000 });
          const steps = [
            { key: 'readMaterial' },
            ...(isVideoUrl(currentLesson.resources) ? [{ key: 'watchedVideo' }] : []),
            { key: 'exercises' },
            { key: 'exam' }
          ];
          const allDoneAfter = steps.every(s => s.key === 'exam' ? true : isStepDone(lessonId, s.key));
          if (allDoneAfter) markCompleteBackend(lessonId);
        }
      }
    }
  };

  const handleRetakeQuiz = () => {
    setQuizStarted(false);
    setCurrentQuestionIdx(0);
    setSelectedOption(null);
    setShowAnswerResult(false);
    setScore(0);
    setQuizFinished(false);
  };

  const shell = (children, label) => (
    <div className="halaqa" style={{ minHeight: '100vh', background: HQ.PAPER }}>
      <Navbar onMenuClick={() => setSidebarOpen(true)} />
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <main className="lg:mr-64" style={{ paddingTop: 64, paddingBottom: 88 }}>
        <div style={{ maxWidth: 760, margin: '0 auto', padding: '24px 16px' }} aria-label={label}>
          {children}
        </div>
      </main>
      <MobileBottomNav />
    </div>
  );

  if (isLoading) {
    return shell(
      <>
        <div className="hq-skeleton" style={{ height: 14, width: '30%', marginBottom: 12 }} />
        <div className="hq-skeleton" style={{ height: 30, width: '70%', marginBottom: 8 }} />
        <div className="hq-skeleton" style={{ height: 14, width: '45%', marginBottom: 20 }} />
        <div className="hq-skeleton" style={{ height: 220, width: '100%', marginBottom: 16 }} />
        <div className="hq-skeleton" style={{ height: 120, width: '100%' }} />
      </>,
      'جارٍ تحميل الدرس'
    );
  }

  if (!currentLesson) {
    return shell(
      <div style={{ background: HQ.SURFACE, border: `1px solid ${HQ.LINE}`, borderRadius: 18, padding: 48, textAlign: 'center' }}>
        <h2 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 900, color: HQ.INK }}>عذرًا، الدرس غير موجود</h2>
        <p style={{ color: HQ.MUTED, fontSize: 14, margin: '0 0 20px' }}>ربما تم حذف هذا الدرس أو تغيير مكانه في خطة الدراسة.</p>
        <Link to="/student/curriculum" className="hq-action" style={{ background: HQ.MENTOR, color: '#fff', padding: '0 24px', fontSize: 15, textDecoration: 'none' }}>
          <ArrowRight size={17} /> العودة إلى المنهج
        </Link>
      </div>,
      'الدرس غير موجود'
    );
  }

  const hasVideo = isVideoUrl(currentLesson.resources);
  const steps = [
    { key: 'readMaterial', label: 'قرأت المادة', icon: BookOpen },
    ...(hasVideo ? [{ key: 'watchedVideo', label: 'شاهدت الفيديو', icon: Video }] : []),
    { key: 'exercises', label: 'حللت التمارين', icon: PenTool },
    { key: 'exam', label: 'اجتزت الاختبار', icon: Award }
  ];
  const stepsDone = steps.filter(s => isStepDone(lessonId, s.key)).length;
  // Next-lesson gate: the CURRENT lesson must be done (backend or all steps),
  // not merely unlocked.
  const currentDone =
    (user?.completedLessons || []).some(id => id?.toString() === currentLesson._id?.toString()) ||
    currentLesson.status === 'completed' ||
    allDone(lessonId, steps);
  const canGoNext = isUnlocked && currentDone;

  return shell(
    <>
      {/* Breadcrumb */}
      <div className="m-crumb" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, gap: 8, flexWrap: 'wrap' }}>
        <Link to="/student/curriculum" style={{ fontSize: 14, color: HQ.MENTOR, fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 4, textDecoration: 'none' }}>
          <ArrowRight size={16} /> المنهج
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Link to={`/student/lessons/${lessonId}/discussion`}
            style={{ fontSize: 13, color: HQ.MENTOR, fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 6, textDecoration: 'none', background: '#E2EFE7', borderRadius: 9999, padding: '8px 14px', minHeight: 44 }}>
            <MessageCircle size={15} /> نقاش هذا الدرس
          </Link>
          <span style={{ fontSize: 13, fontWeight: 700, color: HQ.MUTED }}>الدرس {currentLesson.lessonNumber}</span>
        </div>
      </div>

      {/* Locked notice — human language */}
      {!isUnlocked && (
        <div role="note" style={{ marginBottom: 16, background: HQ.SURFACE, border: `1px solid ${HQ.LINE}`, borderRadius: 12, padding: 12, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <Lock size={18} color="#B45309" style={{ flex: 'none', marginTop: 2 }} />
          <div>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: HQ.INK }}>هذا الدرس سيُتاح بعد إتمام الدرس السابق</p>
            <p style={{ margin: '2px 0 0', fontSize: 13, color: HQ.MUTED }}>أتمم مراحل الدرس السابق واجتز اختباره لفتح هذا الدرس.</p>
          </div>
        </div>
      )}

      {/* Title: what am I learning */}
      <h1 style={{ margin: '0 0 4px', fontSize: 26, fontWeight: 900, color: HQ.INK }}>{currentLesson.title}</h1>
      <p style={{ margin: '0 0 16px', fontSize: 14, color: HQ.MUTED }}>
        {LESSON_TYPES_AR[currentLesson.type] || currentLesson.type}
        {currentLesson.duration ? ` · ${currentLesson.duration} دقيقة` : ''}
        {currentLesson.isLiveRequired ? ' · يتطلب حضور حصة مباشرة' : ''}
        {` · ${stepsDone}/${steps.length} مراحل`}
      </p>

      {/* Steps: the clear primary mechanism (exam is quiz-gated) */}
      <div className="m-steps" style={{ display: 'flex', gap: 8, marginBottom: 20 }} role="group" aria-label="مراحل إكمال الدرس">
        {steps.map(s => {
          const done = isStepDone(lessonId, s.key);
          const Icon = s.icon;
          const quizGated = s.key === 'exam' && !done;
          return (
            <button key={s.key} type="button" aria-pressed={done} disabled={!isUnlocked}
              title={quizGated ? 'تُفتح باجتياز الاختبار السريع أدناه (4 من 5)' : s.label}
              onClick={() => {
                if (s.key === 'exam' && !isStepDone(lessonId, 'exam')) {
                  toast.error('اجتز الاختبار السريع أدناه (4 من 5) لفتح هذه الخطوة');
                  document.getElementById('lesson-quiz')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  return;
                }
                const wasDone = done;
                toggleStep(lessonId, s.key);
                if (!wasDone) {
                  toast.success(`أتممت: ${s.label}`);
                  const doneAfter = steps.every(st => st.key === s.key ? true : isStepDone(lessonId, st.key));
                  if (doneAfter) markCompleteBackend(lessonId);
                }
              }}
              style={{
                flex: 1, minWidth: 0, minHeight: 60, cursor: isUnlocked ? 'pointer' : 'default',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4,
                background: done ? '#E2EFE7' : HQ.SURFACE,
                border: `1px solid ${done ? HQ.MENTOR : HQ.LINE}`,
                borderRadius: 12, padding: 8, opacity: !isUnlocked && !done ? 0.55 : 1,
              }}>
              <span style={{
                width: 28, height: 28, borderRadius: 9999,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                background: done ? HQ.MENTOR : HQ.SURFACE, color: done ? '#fff' : HQ.MUTED,
                border: `1px solid ${done ? HQ.MENTOR : HQ.LINE}`,
              }}>
                {done ? <Check size={14} strokeWidth={3} /> : <Icon size={14} />}
              </span>
              <span style={{ fontSize: 13, fontWeight: 700, color: done ? HQ.MENTOR : HQ.MUTED, textAlign: 'center', lineHeight: 1.5 }}>
                {s.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Content first: video, then explanation */}
      {hasVideo && (
        <div style={{ marginBottom: 20 }}>
          <VideoPlayer url={currentLesson.resources} title={currentLesson.title} />
        </div>
      )}
      <div style={{ marginBottom: 20 }}>
        <LessonContent content={currentLesson.description} />
      </div>

      {/* Resources */}
      <div style={{ marginBottom: 20 }}>
        <LessonResources resources={currentLesson.resources} title={currentLesson.title} lessonId={currentLesson._id} />
      </div>

      {/* Quiz — same bank, scoring, and pass rule */}
      <section id="lesson-quiz" aria-label="الاختبار السريع للدرس" style={{ background: HQ.SURFACE, border: `1px solid ${HQ.LINE}`, borderRadius: 18, padding: 16, marginBottom: 20 }}>
        <h2 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 800, color: HQ.INK, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Award size={18} color={HQ.MENTOR} /> اختبر نفسك
        </h2>
        <p style={{ fontSize: 13, color: HQ.MUTED, margin: '0 0 12px' }}>
          أسئلة مراجعة عامة على نوع هذا الدرس — النجاح من 4 يفتح خطوة الاختبار أعلاه.
        </p>
        {!quizStarted ? (
          <div>
            <p style={{ fontSize: 14, color: HQ.MUTED, margin: '0 0 12px' }}>
              5 أسئلة سريعة على هذا الدرس — النجاح من 4.
            </p>
            <button type="button" onClick={() => setQuizStarted(true)} className="hq-action"
              style={{ background: HQ.MENTOR, color: '#fff', padding: '0 24px', fontSize: 15, width: '100%' }}>
              ابدأ الاختبار
            </button>
          </div>
        ) : quizFinished ? (
          <div style={{ textAlign: 'center', padding: '8px 0' }}>
            <p style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 900, color: score >= 4 ? HQ.MENTOR : HQ.INK }}>
              {score >= 4 ? 'أحسنت! اجتزت الاختبار' : 'لم توفَّق هذه المرة — حاول مجددًا'}
            </p>
            <p style={{ margin: '0 0 16px', fontSize: 14, color: HQ.MUTED }}>
              أجبت صحيحًا عن {score} من 5 ({score * 20}%)
            </p>
            <button type="button" onClick={handleRetakeQuiz} className="hq-action"
              style={{ background: score >= 4 ? HQ.PAPER : HQ.MENTOR, color: score >= 4 ? HQ.INK : '#fff', border: score >= 4 ? `1px solid ${HQ.LINE}` : 'none', padding: '0 24px', fontSize: 15, width: '100%' }}>
              {score >= 4 ? 'إغلاق' : 'إعادة المحاولة'}
            </button>
          </div>
        ) : (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: HQ.MUTED, marginBottom: 8 }}>
              <span>السؤال {currentQuestionIdx + 1} من {quizQuestions.length}</span>
              <span style={{ fontWeight: 800, color: HQ.INK }}>الصحيح: {score}</span>
            </div>
            <div style={{ height: 6, borderRadius: 9999, background: HQ.LINE, overflow: 'hidden', marginBottom: 12 }} role="img" aria-label={`التقدم في الاختبار: سؤال ${currentQuestionIdx + 1} من ${quizQuestions.length}`}>
              <div style={{ height: '100%', width: `${((currentQuestionIdx + 1) / quizQuestions.length) * 100}%`, background: HQ.MENTOR }} />
            </div>
            <p style={{ fontSize: 15, fontWeight: 800, color: HQ.INK, lineHeight: 1.8, margin: '0 0 12px' }}>
              {quizQuestions[currentQuestionIdx]?.q}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
              {quizQuestions[currentQuestionIdx]?.options.map((opt, oIdx) => {
                const isSelected = selectedOption === oIdx;
                const isCorrectAnswer = quizQuestions[currentQuestionIdx].answer === oIdx;
                let bg = HQ.SURFACE, border = HQ.LINE, fg = HQ.INK;
                if (showAnswerResult) {
                  if (isCorrectAnswer) { bg = '#E2EFE7'; border = HQ.MENTOR; }
                  else if (isSelected) { bg = HQ.PAPER; border = '#C2410C'; fg = '#C2410C'; }
                  else { bg = HQ.PAPER; border = HQ.LINE; fg = HQ.MUTED; }
                } else if (isSelected) { bg = '#E2EFE7'; border = HQ.MENTOR; }
                return (
                  <button key={oIdx} type="button" disabled={showAnswerResult} onClick={() => setSelectedOption(oIdx)}
                    style={{
                      width: '100%', textAlign: 'right', padding: 12, borderRadius: 12,
                      border: `1.5px solid ${border}`, background: bg, color: fg,
                      fontSize: 14, fontWeight: isSelected || (showAnswerResult && isCorrectAnswer) ? 800 : 500,
                      cursor: showAnswerResult ? 'default' : 'pointer', minHeight: 48,
                      display: 'flex', alignItems: 'center', gap: 10,
                    }}>
                    <span aria-hidden style={{
                      flex: 'none', width: 26, height: 26, borderRadius: 9999,
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 13, fontWeight: 800,
                      background: (showAnswerResult && isCorrectAnswer) || (!showAnswerResult && isSelected) ? HQ.MENTOR : HQ.PAPER,
                      color: (showAnswerResult && isCorrectAnswer) || (!showAnswerResult && isSelected) ? '#fff' : HQ.MUTED,
                      border: `1px solid ${HQ.LINE}`,
                    }}>{oIdx + 1}</span>
                    {opt}
                  </button>
                );
              })}
            </div>
            {!showAnswerResult ? (
              <button type="button" onClick={handleQuizAnswerSubmit} disabled={selectedOption === null} className="hq-action"
                style={{ background: HQ.MENTOR, color: '#fff', padding: '0 24px', fontSize: 15, width: '100%', opacity: selectedOption === null ? 0.45 : 1 }}>
                تحقق من الإجابة
              </button>
            ) : (
              <button type="button" onClick={handleQuizNextQuestion} className="hq-action"
                style={{ background: HQ.INK, color: '#fff', padding: '0 24px', fontSize: 15, width: '100%' }}>
                {currentQuestionIdx === quizQuestions.length - 1 ? 'عرض النتيجة' : 'السؤال التالي'}
                <ChevronLeft size={16} />
              </button>
            )}
          </div>
        )}
      </section>

      {/* Notes — delete always visible, never hover-only */}
      <section aria-label="ملاحظاتي" style={{ background: HQ.SURFACE, border: `1px solid ${HQ.LINE}`, borderRadius: 18, padding: 16, marginBottom: 20 }}>
        <h2 style={{ margin: '0 0 12px', fontSize: 18, fontWeight: 800, color: HQ.INK, display: 'flex', alignItems: 'center', gap: 8 }}>
          <FileText size={18} color={HQ.MENTOR} /> ملاحظاتي
        </h2>
        <p style={{ fontSize: 12, color: HQ.MUTED, margin: '0 0 12px' }}>
          ملاحظاتك محفوظة على هذا الجهاز فقط ولا يراها المعلم.
        </p>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <input type="text" placeholder="فائدة سريعة من الدرس..." value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddNote()}
            aria-label="ملاحظة جديدة"
            style={{ flex: 1, minWidth: 0, background: HQ.PAPER, border: `1px solid ${HQ.LINE}`, borderRadius: 12, padding: '0 14px', minHeight: 48, fontSize: 14, color: HQ.INK, fontFamily: 'inherit' }} />
          <button type="button" onClick={handleAddNote} aria-label="حفظ الملاحظة"
            style={{ flex: 'none', width: 48, height: 48, borderRadius: 12, border: 'none', background: HQ.MENTOR, color: '#fff', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
            <Plus size={19} />
          </button>
        </div>
        {personalNotes.length ? (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {personalNotes.map((note) => (
              <li key={note.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '10px 0', borderTop: `1px solid ${HQ.LINE}` }}>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 14, color: HQ.INK, lineHeight: 1.8, overflowWrap: 'break-word' }}>{note.text}</span>
                  <span style={{ display: 'block', fontSize: 12, color: HQ.MUTED }}>
                    {new Date(note.createdAt).toLocaleDateString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </span>
                <button type="button" onClick={() => handleDeleteNote(note.id)} aria-label="حذف الملاحظة"
                  style={{ flex: 'none', width: 44, height: 44, borderRadius: 12, border: 'none', background: 'none', color: HQ.MUTED, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Trash2 size={16} />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p style={{ fontSize: 13, color: HQ.MUTED, margin: 0 }}>لا ملاحظات بعد — سجّل أول فائدة من هذا الدرس.</p>
        )}
      </section>

      {/* Prev / Next */}
      <nav aria-label="التنقل بين الدروس" style={{ display: 'flex', gap: 12 }}>
        {prevLesson ? (
          <button type="button" onClick={() => navigate(`/student/lessons/${prevLesson._id}`)}
            style={{ flex: 1, minHeight: 60, background: HQ.SURFACE, border: `1px solid ${HQ.LINE}`, borderRadius: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', textAlign: 'right' }}>
            <ChevronRight size={20} color={HQ.MUTED} style={{ flex: 'none' }} />
            <span style={{ minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 12, color: HQ.MUTED, fontWeight: 700 }}>السابق</span>
              <span style={{ display: 'block', fontSize: 14, fontWeight: 800, color: HQ.INK, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{prevLesson.title}</span>
            </span>
          </button>
        ) : <span style={{ flex: 1 }} />}
        {nextLesson ? (
          <button type="button" onClick={() => canGoNext && navigate(`/student/lessons/${nextLesson._id}`)} disabled={!canGoNext}
            style={{
              flex: 1, minHeight: 60, borderRadius: 14, cursor: canGoNext ? 'pointer' : 'not-allowed',
              display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', textAlign: 'right',
              background: canGoNext ? HQ.MENTOR : HQ.PAPER,
              border: canGoNext ? 'none' : `1px solid ${HQ.LINE}`,
              color: canGoNext ? '#fff' : HQ.MUTED, opacity: canGoNext ? 1 : 0.7,
            }}>
            <span style={{ minWidth: 0, flex: 1 }}>
              <span style={{ display: 'block', fontSize: 12, fontWeight: 700, opacity: 0.85 }}>
                {canGoNext ? 'التالي' : 'التالي — سيُتاح بعد إتمام هذا الدرس'}
              </span>
              <span style={{ display: 'block', fontSize: 14, fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{nextLesson.title}</span>
            </span>
            <ChevronLeft size={20} style={{ flex: 'none' }} />
          </button>
        ) : <span style={{ flex: 1 }} />}
      </nav>
    </>
  );
}
