import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, MotionConfig } from 'framer-motion';
import {
  ChevronRight, ChevronLeft, Send, Mic, MicOff, CheckCircle, Clock,
  AlertCircle, BookOpen, VolumeX, Play, Pause,
  SkipForward, SkipBack, Repeat, Loader2, Check, X, Lock, Info, Star,
} from 'lucide-react';
import toast from 'react-hot-toast';
import ConfirmModal from '../../components/shared/ConfirmModal';
import Navbar from '../../components/shared/Navbar';
import useExamStore from '../../store/examStore';
import useAuthStore from '../../store/authStore';
import useQuranAudio, { RECITERS } from '../../hooks/useQuranAudio';
import LoadingSpinner from '../../components/shared/LoadingSpinner';
import api from '../../services/api';
import '../../components/halaqa/halaqa.css';
import { HQ } from '../../components/halaqa/primitives';

/* Exam room — calm and focused. Same questions, answers, recording,
   audio and submit logic as before; only the visual layer changed. */

const TYPE_LABEL = { mcq: 'اختياري', true_false: 'صح / خطأ', written: 'كتابي', recitation: 'شفهي' };

export default function TakeExamPage() {
  const { examId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const {
    currentExam, setCurrentExam, answers, writtenAnswers,
    setAnswer, setWrittenAnswer, addOralRecording, oralRecordings,
    currentQuestion, nextQuestion, prevQuestion,
    submitWrittenExam, isSubmitting, resetExam,
  } = useExamStore();

  const [loading, setLoading] = useState(true);
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState(null);
  const [recording, setRecording] = useState(false);
  const [recordedQuestions, setRecordedQuestions] = useState({});
  const [timeLeft, setTimeLeft] = useState(null);
  const [recitationFailed, setRecitationFailed] = useState(false);
  const autoSubmitRef = useRef(false);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);

  // Quran Interactive state
  const [quranVerses, setQuranVerses] = useState([]);
  const [loadingVerses, setLoadingVerses] = useState(false);
  const [quranMode, setQuranMode] = useState({}); // { [questionIndex]: 'practice' | 'quiz' }
  const [showQuranPanel, setShowQuranPanel] = useState(true);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);

  // Quran Audio hook
  const audio = useQuranAudio();
  const {
    isPlaying, currentVerseIndex, isLoadingAudio,
    loadSurahAudio, playVerse, playAll, pause, resume, togglePlayPause,
    stop: stopAudio, nextVerse, prevVerse,
    reciter, changeReciter, audioProgress,
  } = audio;

  useEffect(() => {
    const load = async () => {
      try {
        // القائمة الموحدة تكفي للنظام الفردي (فردي/مستوى) — ثم احتياطي المجموعة عند وجودها فقط
        let exam = null;
        try {
          const assignedRes = await api.get('/exams/student/assigned');
          exam = (assignedRes.data.exams || []).find(e => e._id === examId);
        } catch (_) {}
        if (!exam) {
          const groupId = user?.group?._id || user?.group;
          if (groupId) {
            const res = await api.get(`/exams/group/${groupId}`);
            exam = (res.data.exams || []).find(e => e._id === examId);
          }
        }
        if (!exam) {
          toast.error('لم يتم العثور على الامتحان');
          navigate('/student/exams');
          return;
        }
        setCurrentExam(exam);

        // Initialize modes from question defaults
        const modes = {};
        exam.questions?.forEach((q, i) => {
          if (q.type === 'recitation') {
            modes[i] = q.mode || 'practice';
          }
        });
        setQuranMode(modes);
      } catch {
        toast.error('خطأ في تحميل الامتحان');
        navigate('/student/exams');
      } finally {
        setLoading(false);
      }
    };
    resetExam();
    load();
    return () => { resetExam(); stopAudio(); };
  }, [examId]);

  // Exam timer — auto-submit exactly once when time runs out
  useEffect(() => {
    if (currentExam?.duration && timeLeft === null) {
      setTimeLeft(currentExam.duration * 60);
    }
  }, [currentExam, timeLeft]);

  useEffect(() => {
    if (timeLeft === null || timeLeft <= 0) return;
    const t = setInterval(() => setTimeLeft((v) => v - 1), 1000);
    return () => clearInterval(t);
  }, [timeLeft]);

  useEffect(() => {
    if (timeLeft === 0 && !autoSubmitRef.current && !submitted && currentExam) {
      autoSubmitRef.current = true;
      toast('انتهى الوقت وتم تسليم الامتحان تلقائياً');
      handleSubmit(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft]);

  // Load Quran verses & audio when switching to a recitation question
  const q = currentExam?.questions?.[currentQuestion];
  const total = currentExam?.questions?.length || 0;
  const isLast = currentQuestion === total - 1;

  useEffect(() => {
    if (q?.type === 'recitation' && q.surahNumber) {
      fetchQuranVerses(q.surahNumber, q.fromVerse, q.toVerse);
      loadSurahAudio(q.surahNumber, reciter);
    } else {
      setQuranVerses([]);
      stopAudio();
    }
  }, [currentQuestion, q?.surahNumber, q?.type, reciter]);

  const fetchQuranVerses = useCallback(async (surahNum, from, to) => {
    setLoadingVerses(true);
    try {
      const res = await fetch(`https://api.alquran.cloud/v1/surah/${surahNum}`);
      const data = await res.json();
      if (data.code === 200) {
        let ayahs = data.data.ayahs || [];
        if (from && to) {
          ayahs = ayahs.filter(a => a.numberInSurah >= from && a.numberInSurah <= to);
        } else if (from) {
          ayahs = ayahs.filter(a => a.numberInSurah >= from);
        }
        setQuranVerses(ayahs);
      }
    } catch {
      setQuranVerses([]);
    }
    setLoadingVerses(false);
  }, []);

  const startRecording = async (questionId) => {
    try {
      // Recording forces quiz mode: the reference text/audio is hidden
      // so the recitation is from memory.
      setQuranMode(p => ({ ...p, [currentQuestion]: 'quiz' }));
      try { stopAudio(); } catch (_) {}
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      chunksRef.current = [];
      const mr = new MediaRecorder(stream);
      mr.ondataavailable = e => chunksRef.current.push(e.data);
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(blob);
        addOralRecording(questionId, blob, url);
        setRecordedQuestions(p => ({ ...p, [questionId]: url }));
        stream.getTracks().forEach(t => t.stop());
      };
      mr.start();
      mediaRecorderRef.current = mr;
      setRecording(true);
    } catch {
      toast.error('لا يمكن الوصول للميكروفون');
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setRecording(false);
  };

  const submitRecitationOnly = async (resultId) => {
    const recitationRecs = oralRecordings.filter(r => r.audioBlob);
    if (recitationRecs.length === 0 || !resultId) return true;
    const formData = new FormData();
    formData.append('examResultId', resultId);
    recitationRecs.forEach((rec, idx) => {
      formData.append('recordings', rec.audioBlob, `rec-${idx}.webm`);
      if (rec.questionId) formData.append(`questionId_${idx}`, rec.questionId);
    });
    await api.post(`/exams/${examId}/submit-recitation`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return true;
  };

  const handleSubmit = async (auto = false) => {
    if (!auto) {
      // أسئلة التسميع تتطلب تسجيلاً — وإلا علقت النتيجة بلا مراجعة
      const recQs = (currentExam?.questions || []).filter(q => q.type === 'recitation');
      const recordedIds = new Set((oralRecordings || []).filter(r => r.audioBlob).map(r => String(r.questionId)));
      const missingRec = recQs.filter(q => !recordedIds.has(String(q._id)));
      if (missingRec.length) {
        toast.error(`سجل تلاوتك الصوتية لجميع أسئلة التسميع أولاً (متبقٍ ${missingRec.length})`);
        return;
      }
      if (!showSubmitConfirm) { setShowSubmitConfirm(true); return; }
      setShowSubmitConfirm(false);
    }
    try {
      stopAudio();
      const res = await submitWrittenExam(examId);

      // Recitation audio is a second request — a failure must not silently
      // lose the recordings, so it gets its own error state + retry.
      try {
        await submitRecitationOnly(res?._id);
        setRecitationFailed(false);
      } catch (_) {
        setRecitationFailed(true);
        toast.error('سُلّمت الإجابات الكتابية، لكن تعذر رفع التسجيلات الصوتية — أعد المحاولة من شاشة النتيجة');
      }

      setResult(res);
      setSubmitted(true);
    } catch (err) {
      autoSubmitRef.current = false;
      toast.error(err?.response?.data?.message || 'خطأ في التسليم');
    }
  };

  const handleRetryRecitation = async () => {
    if (!result?._id) return;
    try {
      await submitRecitationOnly(result._id);
      setRecitationFailed(false);
      toast.success('تم رفع التسجيلات الصوتية بنجاح');
    } catch (_) {
      toast.error('تعذر الرفع مجدداً — تحقق من الاتصال وحاول مرة أخرى');
    }
  };

  const currentMode = quranMode[currentQuestion] || 'practice';
  const toggleMode = () => {
    setQuranMode(p => ({
      ...p,
      [currentQuestion]: currentMode === 'practice' ? 'quiz' : 'practice',
    }));
  };

  const sheet = { background: HQ.SURFACE, border: `1px solid ${HQ.LINE}`, borderRadius: 18 };

  if (loading) return (
    <div className="halaqa" style={{ background: HQ.PAPER, minHeight: '100vh', color: HQ.INK }} dir="rtl">
      <Navbar />
      <div className="pt-24 flex justify-center"><LoadingSpinner size="lg" /></div>
    </div>
  );

  if (submitted && result) {
    const hasRecitation = currentExam?.questions?.some(q => q.type === 'recitation');
    const score = result.totalPercentage ?? result.writtenPercentage ?? 0;
    const passed = result.isPassed;
    const tone = hasRecitation
      ? { bg: HQ.PAPER, fg: HQ.MUTED, Icon: Clock, title: 'تم تسليم تقييم الدرس' }
      : passed
      ? { bg: '#E2EFE7', fg: HQ.MENTOR, Icon: CheckCircle, title: 'أحسنت! إنجاز ممتاز' }
      : { bg: HQ.SURFACE, fg: '#C2410C', Icon: AlertCircle, title: 'تم التسليم بنجاح' };
    return (
      <div className="halaqa" style={{ background: HQ.PAPER, minHeight: '100vh', color: HQ.INK }} dir="rtl">
        <Navbar />
        <div className="pt-16 flex items-center justify-center min-h-screen p-4">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}
            className="max-w-md w-full text-center" style={{ ...sheet, padding: 32 }}>
            <span aria-hidden className="flex items-center justify-center mx-auto mb-6"
              style={{ width: 80, height: 80, borderRadius: 20, background: tone.bg, border: `1px solid ${HQ.LINE}` }}>
              <tone.Icon size={38} color={tone.fg} />
            </span>
            <h2 className="font-extrabold mb-2" style={{ fontSize: '1.5rem', color: HQ.INK }}>{tone.title}</h2>

            {/* Earned points — real result data only */}
            {result.xpEarned > 0 && (
              <div className="my-4 p-3 flex items-center justify-center gap-2"
                style={{ background: '#E2EFE7', borderRadius: 12 }}>
                <Star size={17} color={HQ.MENTOR} aria-hidden />
                <span className="text-sm font-bold" style={{ color: '#0F5940' }}>
                  النقاط المكتسبة: +{result.xpEarned} XP
                </span>
              </div>
            )}

            {recitationFailed && (
              <div role="alert" className="my-4 p-3" style={{ background: HQ.PAPER, border: '1px solid #C2410C', borderRadius: 12 }}>
                <p className="text-sm font-bold mb-2" style={{ color: '#C2410C' }}>
                  تعذر رفع تسجيلاتك الصوتية — إجاباتك الكتابية محفوظة.
                </p>
                <button type="button" onClick={handleRetryRecitation}
                  className="hq-action" style={{ background: '#C2410C', color: '#fff', padding: '0 20px', fontSize: 14, width: '100%' }}>
                  إعادة محاولة رفع التسجيلات
                </button>
              </div>
            )}

            {hasRecitation ? (
              <p className="text-sm mb-6" style={{ color: HQ.MUTED }}>سيتم مراجعة تسجيلاتك الصوتية وإبداء الملاحظات من قبل المعلم</p>
            ) : (
              <div className="mb-6">
                <div className="font-extrabold mb-2" style={{ fontSize: '2rem', color: passed ? HQ.MENTOR : '#C2410C' }}>{score}%</div>
                <p className="text-sm" style={{ color: HQ.MUTED }}>درجة التقييم: {currentExam?.passingScore || 60}%</p>
              </div>
            )}
            <button type="button" onClick={() => navigate('/student/exams')}
              className="hq-action" style={{ background: HQ.MENTOR, color: '#fff', padding: '0 24px', fontSize: 15, width: '100%' }}>
              العودة للاختبارات والتقييمات
            </button>
          </motion.div>
        </div>
      </div>
    );
  }

  if (!currentExam || !q) return null;

  const SURAH_NAMES = [
    'الفاتحة', 'البقرة', 'آل عمران', 'النساء', 'المائدة', 'الأنعام', 'الأعراف', 'الأنفال',
    'التوبة', 'يونس', 'هود', 'يوسف', 'الرعد', 'إبراهيم', 'الحجر', 'النحل', 'الإسراء',
    'الكهف', 'مريم', 'طه', 'الأنبياء', 'الحج', 'المؤمنون', 'النور', 'الفرقان', 'الشعراء',
    'النمل', 'القصص', 'العنكبوت', 'الروم', 'لقمان', 'السجدة', 'الأحزاب', 'سبأ', 'فاطر',
    'يس', 'الصافات', 'ص', 'الزمر', 'غافر', 'فصلت', 'الشورى', 'الزخرف', 'الدخان',
    'الجاثية', 'الأحقاف', 'محمد', 'الفتح', 'الحجرات', 'ق', 'الذاريات', 'الطور', 'النجم',
    'القمر', 'الرحمن', 'الواقعة', 'الحديد', 'المجادلة', 'الحشر', 'الممتحنة', 'الصف',
    'الجمعة', 'المنافقون', 'التغابن', 'الطلاق', 'التحريم', 'الملك', 'القلم', 'الحاقة',
    'المعارج', 'نوح', 'الجن', 'المزمل', 'المدثر', 'القيامة', 'الإنسان', 'المرسلات',
    'النبأ', 'النازعات', 'عبس', 'التكوير', 'الانفطار', 'المطففين', 'الانشقاق', 'البروج',
    'الطارق', 'الأعلى', 'الغاشية', 'الفجر', 'البلد', 'الشمس', 'الليل', 'الضحى', 'الشرح',
    'التين', 'العلق', 'القدر', 'البينة', 'الزلزلة', 'العاديات', 'القارعة', 'التكاثر',
    'العصر', 'الهمزة', 'الفيل', 'قريش', 'الماعون', 'الكوثر', 'الكافرون', 'النصر',
    'المسد', 'الإخلاص', 'الفلق', 'الناس',
  ];

  const surahName = q.surahNumber ? SURAH_NAMES[q.surahNumber - 1] || `سورة ${q.surahNumber}` : '';

  const optBase = {
    width: '100%', textAlign: 'right', minHeight: 56, padding: '12px 16px',
    borderRadius: 12, border: `2px solid ${HQ.LINE}`, background: HQ.SURFACE,
    color: HQ.INK, fontWeight: 500, fontSize: 16, cursor: 'pointer',
    display: 'flex', alignItems: 'center',
  };

  return (
    <MotionConfig reducedMotion="user">
      <div className="halaqa" style={{ background: HQ.PAPER, minHeight: '100vh', color: HQ.INK }} dir="rtl">
        <Navbar />
        <div className="pt-16 min-h-screen flex flex-col">
          {/* Progress bar */}
          <div style={{ background: HQ.SURFACE, borderBottom: `1px solid ${HQ.LINE}`, padding: '10px 16px' }}>
            <div className="max-w-4xl mx-auto">
              <div className="flex justify-between items-center mb-2" style={{ flexWrap: 'wrap', gap: 8 }}>
                <span className="text-sm font-bold truncate" style={{ color: HQ.INK, maxWidth: 140 }}>{currentExam.title}</span>
                <div className="flex items-center gap-2" style={{ flexWrap: 'wrap' }}>
                  {timeLeft !== null && (
                    <span role="timer" aria-label="الوقت المتبقي للامتحان"
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.8125rem', fontWeight: 800,
                        padding: '4px 12px', borderRadius: 9999, fontVariantNumeric: 'tabular-nums',
                        background: timeLeft < 120 ? '#C2410C' : HQ.PAPER, color: timeLeft < 120 ? '#fff' : HQ.INK,
                      }}>
                      <Clock size={13} aria-hidden />
                      {String(Math.floor(timeLeft / 60)).padStart(2, '0')}:{String(timeLeft % 60).padStart(2, '0')}
                    </span>
                  )}
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', fontSize: '0.8125rem', fontWeight: 700,
                    padding: '4px 12px', borderRadius: 9999, background: '#E2EFE7', color: '#0F5940',
                  }}>
                    {TYPE_LABEL[q.type] || q.type}
                  </span>
                  <span className="text-sm font-semibold" style={{ color: HQ.MUTED, fontVariantNumeric: 'tabular-nums' }}>
                    {currentQuestion + 1} / {total}
                  </span>
                </div>
              </div>
              <div style={{ height: 8, background: HQ.LINE, borderRadius: 9999, overflow: 'hidden' }}
                role="progressbar" aria-valuenow={Math.round(((currentQuestion + 1) / total) * 100)}
                aria-valuemin={0} aria-valuemax={100} aria-label="تقدم الامتحان">
                <div style={{ height: '100%', background: HQ.MENTOR, borderRadius: 9999, width: `${((currentQuestion + 1) / total) * 100}%` }} />
              </div>
            </div>
          </div>

          {/* Question Content */}
          <div className="flex-1 p-3 sm:p-4">
            <div className="max-w-4xl mx-auto">
              <AnimatePresence mode="wait">
                <motion.div key={currentQuestion}
                  initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }}
                  transition={{ duration: 0.2 }}>

                  {/* Main Question Card */}
                  <div className="p-4 sm:p-8 mb-4" style={sheet}>
                    <h2 className="font-bold mb-4 sm:mb-6" style={{ fontSize: '1.25rem', color: HQ.INK, lineHeight: 1.8 }}>
                      {q.type === 'recitation' && q.arabicText
                        ? <span className="hq-quran" style={{ fontSize: 22 }}>{q.arabicText}</span>
                        : (q.text || q.arabicText)}
                    </h2>

                    {/* MCQ Options */}
                    {q.type === 'mcq' && (
                      <div className="space-y-3" role="group" aria-label="خيارات الإجابة">
                        {(q.options || []).map((opt, i) => {
                          const sel = answers[currentQuestion] === i;
                          return (
                            <button key={i} type="button" onClick={() => setAnswer(currentQuestion, i)}
                              aria-pressed={sel}
                              style={{
                                ...optBase,
                                borderColor: sel ? HQ.MENTOR : HQ.LINE,
                                background: sel ? '#E2EFE7' : HQ.SURFACE,
                                fontWeight: sel ? 700 : 500,
                              }}>
                              <span aria-hidden style={{
                                width: 28, height: 28, borderRadius: 8, marginLeft: 12, flex: 'none',
                                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '0.8125rem', fontWeight: 800,
                                background: sel ? HQ.MENTOR : HQ.PAPER, color: sel ? '#fff' : HQ.MUTED,
                              }}>
                                {String.fromCharCode(65 + i)}
                              </span>
                              <span className="text-sm sm:text-base">{opt}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {/* True / False */}
                    {q.type === 'true_false' && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 my-2" role="group" aria-label="اختر صحيح أو خطأ">
                        {[
                          { value: true, label: 'صحيح (صح)', Icon: Check },
                          { value: false, label: 'خطأ', Icon: X },
                        ].map((item) => {
                          const sel = answers[currentQuestion] === item.value;
                          return (
                            <button
                              key={String(item.value)}
                              type="button"
                              onClick={() => setAnswer(currentQuestion, item.value)}
                              aria-pressed={sel}
                              style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
                                minHeight: 64, padding: 16, borderRadius: 12, cursor: 'pointer',
                                fontWeight: 700, fontSize: '1.25rem',
                                border: `2px solid ${sel ? HQ.MENTOR : HQ.LINE}`,
                                background: sel ? '#E2EFE7' : HQ.SURFACE,
                                color: sel ? '#0F5940' : HQ.INK,
                              }}
                            >
                              <item.Icon size={24} strokeWidth={2.5} aria-hidden />
                              <span>{item.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {/* Written (fill-in) */}
                    {q.type === 'written' && (
                      <div>
                        <label htmlFor={`take-written-${currentQuestion}`} className="text-sm font-bold mb-2 block" style={{ color: HQ.INK }}>أكمل الإجابة:</label>
                        <input
                          id={`take-written-${currentQuestion}`}
                          value={writtenAnswers[currentQuestion] || ''}
                          onChange={e => setWrittenAnswer(currentQuestion, e.target.value)}
                          className="w-full text-base"
                          style={{
                            minHeight: 48, background: HQ.SURFACE, color: HQ.INK,
                            border: `1px solid ${HQ.LINE}`, borderRadius: 12, padding: '12px 16px',
                          }}
                          placeholder="اكتب إجابتك هنا..."
                          dir="rtl"
                        />
                      </div>
                    )}

                    {/* Recitation - Recording Area */}
                    {q.type === 'recitation' && (
                      <div className="space-y-4 sm:space-y-5">
                        {/* Mode Toggle */}
                        <div className="flex items-center justify-center gap-1.5 p-1.5 rounded-2xl max-w-md mx-auto"
                          role="group" aria-label="وضع السؤال"
                          style={{ background: HQ.PAPER, border: `1px solid ${HQ.LINE}` }}>
                          <button type="button" onClick={() => setQuranMode(p => ({ ...p, [currentQuestion]: 'practice' }))}
                            aria-pressed={currentMode === 'practice'}
                            className="flex-1 text-sm font-bold"
                            style={{
                              minHeight: 44, padding: '8px 12px', borderRadius: 12, border: 'none', cursor: 'pointer',
                              background: currentMode === 'practice' ? HQ.MENTOR : 'transparent',
                              color: currentMode === 'practice' ? '#fff' : HQ.MUTED,
                            }}>
                            التدرب والاستماع
                          </button>
                          <button type="button" onClick={() => { try { stopAudio(); } catch (_) {} setQuranMode(p => ({ ...p, [currentQuestion]: 'quiz' })); }}
                            aria-pressed={currentMode === 'quiz'}
                            className="flex-1 text-sm font-bold"
                            style={{
                              minHeight: 44, padding: '8px 12px', borderRadius: 12, border: 'none', cursor: 'pointer',
                              background: currentMode === 'quiz' ? HQ.INK : 'transparent',
                              color: currentMode === 'quiz' ? '#fff' : HQ.MUTED,
                            }}>
                            وضع التسميع
                          </button>
                        </div>
                        <p className="text-center" style={{ fontSize: '0.8125rem', color: HQ.MUTED }}>
                          عند بدء التسجيل يُخفى النص تلقائياً — التسميع من الحفظ.
                        </p>

                        {q.instruction && (
                          <div className="p-3.5 sm:p-4 text-right" style={{ background: HQ.PAPER, border: `1px solid ${HQ.LINE}`, borderRadius: 12 }}>
                            <p className="text-sm font-bold mb-1 flex items-center gap-2" style={{ color: HQ.INK }}>
                              <Info size={15} color={HQ.MUTED} aria-hidden /> التعليمات:
                            </p>
                            <p className="text-sm" style={{ color: HQ.MUTED }}>{q.instruction}</p>
                          </div>
                        )}

                        {/* Recording Controls */}
                        <div className="flex flex-col items-center gap-3 sm:gap-4 p-4 sm:p-6"
                          style={{ background: HQ.PAPER, border: `1px solid ${HQ.LINE}`, borderRadius: 18 }}>
                          {recordedQuestions[q._id] && (
                            <div className="w-full max-w-md">
                              <p className="text-sm font-bold mb-2 text-center flex items-center justify-center gap-2" style={{ color: HQ.MENTOR }}>
                                <CheckCircle size={16} aria-hidden /> تم تسجيل صوتك بنجاح. استمع للتسجيل:
                              </p>
                              <audio controls src={recordedQuestions[q._id]} className="w-full rounded-xl" />
                            </div>
                          )}
                          <button
                            type="button"
                            onClick={() => recording ? stopRecording() : startRecording(q._id)}
                            aria-label={recording ? 'إيقاف التسجيل' : 'بدء التسجيل'}
                            aria-pressed={recording}
                            className={recording ? 'animate-pulse' : ''}
                            style={{
                              width: 88, height: 88, borderRadius: 9999, border: 'none', cursor: 'pointer',
                              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                              background: recording ? '#C2410C' : HQ.MENTOR, color: '#fff',
                            }}>
                            {recording ? <MicOff size={36} aria-hidden /> : <Mic size={36} aria-hidden />}
                          </button>
                          <p className="text-sm font-bold text-center flex items-center gap-2" style={{ color: HQ.MUTED }}>
                            {recording && <span aria-hidden style={{ width: 9, height: 9, borderRadius: 9999, background: '#C2410C' }} />}
                            {recording ? 'جارٍ التسجيل... انقر للإيقاف' : recordedQuestions[q._id] ? 'انقر لإعادة تسجيل صوتك' : 'انقر على الميكروفون لبدء التسجيل'}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* ═══ Integrated Quran Panel (for recitation questions) ═══ */}
                  {q.type === 'recitation' && q.surahNumber && (
                    <motion.div
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                      style={{ ...sheet, padding: 0 }}>
                      {/* Quran Panel Header */}
                      <div className="px-4 py-3 sm:px-6 sm:py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                        style={{ borderBottom: `1px solid ${HQ.LINE}` }}>
                        <div className="flex items-center gap-3">
                          <span aria-hidden className="flex items-center justify-center flex-none"
                            style={{
                              width: 40, height: 40, borderRadius: 12,
                              background: currentMode === 'practice' ? HQ.MENTOR : HQ.PAPER, color: currentMode === 'practice' ? '#fff' : HQ.MUTED,
                            }}>
                            {currentMode === 'practice' ? <BookOpen size={19} /> : <Lock size={19} />}
                          </span>
                          <div>
                            <h3 className="font-bold text-sm" style={{ color: HQ.INK }}>
                              {currentMode === 'practice' ? 'المصحف التفاعلي' : 'وضع التسميع'}
                            </h3>
                            <p style={{ fontSize: '0.8125rem', color: HQ.MUTED }}>
                              سورة {surahName} — الآيات {q.fromVerse || 1} إلى {q.toVerse || '...'}
                            </p>
                          </div>
                        </div>

                        {/* Reciter Selector (practice mode only) */}
                        {currentMode === 'practice' && (
                          <select value={reciter} onChange={e => changeReciter(e.target.value)}
                            aria-label="اختيار القارئ"
                            className="text-sm font-medium w-full sm:w-auto"
                            style={{ minHeight: 44, border: `1px solid ${HQ.LINE}`, background: HQ.SURFACE, color: HQ.INK, borderRadius: 12, padding: '8px 12px' }}>
                            {RECITERS.map(r => (
                              <option key={r.id} value={r.id}>{r.name}</option>
                            ))}
                          </select>
                        )}
                      </div>

                      {/* Practice Mode: Show verses + audio controls */}
                      {currentMode === 'practice' ? (
                        <div className="p-3 sm:p-5 space-y-4">
                          {/* Audio Player Controls */}
                          <div className="p-3 sm:p-4" style={{ background: HQ.PAPER, borderRadius: 12 }}>
                            <div className="flex items-center justify-center gap-3 mb-3">
                              <button type="button" onClick={prevVerse}
                                className="hq-action" style={{ background: 'transparent', color: HQ.MENTOR, minWidth: 48 }}
                                aria-label="الآية السابقة">
                                <SkipForward size={20} aria-hidden />
                              </button>
                              <button type="button" onClick={togglePlayPause}
                                aria-label={isPlaying ? 'إيقاف مؤقت' : 'تشغيل'}
                                style={{
                                  width: 56, height: 56, borderRadius: 9999, border: 'none', cursor: 'pointer',
                                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                  background: HQ.MENTOR, color: '#fff',
                                }}>
                                {isLoadingAudio ? (
                                  <Loader2 size={22} className="animate-spin" aria-hidden />
                                ) : isPlaying ? (
                                  <Pause size={22} aria-hidden />
                                ) : (
                                  <Play size={22} aria-hidden />
                                )}
                              </button>
                              <button type="button" onClick={nextVerse}
                                className="hq-action" style={{ background: 'transparent', color: HQ.MENTOR, minWidth: 48 }}
                                aria-label="الآية التالية">
                                <SkipBack size={20} aria-hidden />
                              </button>
                            </div>
                            {/* Progress bar */}
                            <div style={{ height: 6, background: HQ.LINE, borderRadius: 9999, overflow: 'hidden' }}>
                              <div style={{ height: '100%', background: HQ.MENTOR, borderRadius: 9999, width: `${audioProgress}%` }} />
                            </div>
                            <div className="flex justify-between mt-2">
                              <span style={{ fontSize: '0.8125rem', color: HQ.MUTED, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                                {currentVerseIndex >= 0 ? `آية ${currentVerseIndex + 1}` : 'اضغط تشغيل للبدء'}
                              </span>
                              <button type="button" onClick={() => q.fromVerse ? playVerse(q.fromVerse) : playAll(1)}
                                className="font-bold flex items-center gap-1"
                                style={{ fontSize: '0.8125rem', color: HQ.MENTOR, background: 'none', border: 'none', cursor: 'pointer', minHeight: 44 }}>
                                <Repeat size={13} aria-hidden /> تشغيل من البداية
                              </button>
                            </div>
                          </div>

                          {/* Quran Verses Display */}
                          <div className="p-4 sm:p-5"
                            style={{ background: HQ.PAPER, borderRadius: 12, maxHeight: 300, overflowY: 'auto' }}>
                            {loadingVerses ? (
                              <div className="flex justify-center py-8">
                                <Loader2 size={24} color={HQ.MENTOR} className="animate-spin" aria-hidden />
                              </div>
                            ) : quranVerses.length === 0 ? (
                              <p className="text-center text-sm py-6" style={{ color: HQ.MUTED }}>لا توجد آيات لعرضها</p>
                            ) : (
                              <div className="hq-quran text-right" dir="rtl" style={{ fontSize: 20, lineHeight: 2.5 }}>
                                {quranVerses.map((verse) => {
                                  const verseIdx = verse.numberInSurah - 1;
                                  const isActive = currentVerseIndex === verseIdx;
                                  return (
                                    <span
                                      key={verse.number}
                                      data-verse-index={verseIdx}
                                      onClick={() => playVerse(verse.numberInSurah)}
                                      style={{
                                        cursor: 'pointer', borderRadius: 8, padding: '2px 4px', display: 'inline',
                                        background: isActive ? '#E2EFE7' : 'transparent',
                                        outline: isActive ? `2px solid ${HQ.MENTOR}` : 'none',
                                        color: isActive ? '#0F5940' : HQ.INK,
                                        fontWeight: isActive ? 700 : 400,
                                      }}>
                                      {verse.text}
                                      <span style={{
                                        fontSize: '0.8125rem', fontWeight: 800, margin: '0 4px',
                                        fontFamily: 'Tajawal, sans-serif',
                                        color: isActive ? HQ.MENTOR : HQ.MUTED,
                                      }}>
                                        ﴿{verse.numberInSurah}﴾
                                      </span>
                                    </span>
                                  );
                                })}
                              </div>
                            )}
                          </div>

                          <p className="text-center font-medium" style={{ fontSize: '0.8125rem', color: HQ.MUTED }}>
                            اضغط على أي آية للاستماع إليها — ثم سجّل تلاوتك بالضغط على الميكروفون
                          </p>
                        </div>
                      ) : (
                        /* Quiz Mode: Hidden text */
                        <div className="p-6 sm:p-8 text-center">
                          <span aria-hidden className="flex items-center justify-center mx-auto mb-4"
                            style={{ width: 64, height: 64, borderRadius: 9999, background: HQ.PAPER }}>
                            <VolumeX size={28} color={HQ.MUTED} />
                          </span>
                          <p className="text-sm font-bold mb-1" style={{ color: HQ.INK }}>تم حجب النص القرآني وتعطيل التلاوة المرجعية</p>
                          <p className="mb-3" style={{ fontSize: '0.8125rem', color: HQ.MUTED }}>قم بتسجيل التلاوة من حفظك عن ظهر قلب</p>
                          <p style={{ fontSize: '0.8125rem', color: HQ.MUTED }}>
                            سورة {surahName} — الآيات {q.fromVerse || 1} إلى {q.toVerse || '...'}
                          </p>
                        </div>
                      )}
                    </motion.div>
                  )}

                </motion.div>
              </AnimatePresence>

              {/* Navigation Buttons */}
              <div className="flex gap-2 sm:gap-3 mt-4 sm:mt-6 pb-6">
                <button type="button" onClick={() => { stopAudio(); prevQuestion(); }} disabled={currentQuestion === 0}
                  className="hq-action flex-1 text-sm" style={{ background: 'transparent', color: HQ.MUTED }}>
                  <ChevronRight size={16} aria-hidden /> السابق
                </button>
                {isLast ? (
                  <button type="button" onClick={() => handleSubmit(false)} disabled={isSubmitting}
                    className="hq-action flex-1 text-sm" style={{ background: HQ.MENTOR, color: '#fff', opacity: isSubmitting ? 0.6 : 1 }}>
                    {isSubmitting ? <LoadingSpinner size="sm" color="white" /> : <><Send size={15} aria-hidden /> تسليم الامتحان</>}
                  </button>
                ) : (
                  <button type="button" onClick={() => { stopAudio(); nextQuestion(); }}
                    className="hq-action flex-1 text-sm" style={{ background: HQ.MENTOR, color: '#fff' }}>
                    التالي <ChevronLeft size={16} aria-hidden />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Submit confirm */}
      <ConfirmModal
        open={showSubmitConfirm}
        title="تسليم الامتحان؟"
        message="بعد التسليم لن تتمكن من تعديل إجاباتك."
        confirmLabel="تسليم"
        onConfirm={() => handleSubmit(false)}
        onClose={() => setShowSubmitConfirm(false)}
      />
    </MotionConfig>
  );
}
