import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, MotionConfig } from 'framer-motion';
import { Clock, ChevronLeft, Check, X, Mic, Square, CheckCircle, RotateCcw, Volume2, Upload, FileAudio } from 'lucide-react';
import toast from 'react-hot-toast';
import useAuthStore from '../../store/authStore';
import useExamStore from '../../store/examStore';
import useMediaRecorder from '../../hooks/useMediaRecorder';
import LoadingSpinner from '../../components/shared/LoadingSpinner';
import ConfirmModal from '../../components/shared/ConfirmModal';
import { formatCountdown } from '../../utils/helpers';
import './Onboarding.css';

/* ─── Inline recorder for a single oral question (Mic recording OR File upload) ─── */
function RecitationRecorder({ questionIndex, questionId, onSaved }) {
  const { addOralRecording } = useExamStore();
  const {
    isRecording, duration, audioUrl: recAudioUrl, audioBlob: recAudioBlob, error: recError,
    startRecording, stopRecording, resetRecording: resetMediaRecorder,
  } = useMediaRecorder();

  const [fileAudioBlob, setFileAudioBlob] = useState(null);
  const [fileAudioUrl, setFileAudioUrl] = useState(null);
  const [fileName, setFileName] = useState('');
  const [saved, setSaved] = useState(false);
  const fileInputRef = useRef(null);

  const activeAudioUrl = fileAudioUrl || recAudioUrl;
  const activeAudioBlob = fileAudioBlob || recAudioBlob;

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('audio/')) {
      toast.error('يرجى اختيار ملف صوتي صالح (MP3, WAV, M4A, إلخ)');
      return;
    }
    resetMediaRecorder();
    setSaved(false);
    setFileAudioBlob(file);
    setFileName(file.name);
    const objUrl = URL.createObjectURL(file);
    setFileAudioUrl(objUrl);
    toast.success(`تم اختيار ملف: ${file.name}`);
  };

  const handleSave = () => {
    if (!activeAudioBlob) return;
    addOralRecording(questionId || `recitation-q-${questionIndex}`, activeAudioBlob, activeAudioUrl);
    setSaved(true);
    if (onSaved) onSaved();
    toast.success('تم حفظ التسجيل وسيُرسل للإدارة مع تسليم الامتحان');
  };

  const handleRedo = () => {
    setSaved(false);
    setFileAudioBlob(null);
    setFileAudioUrl(null);
    setFileName('');
    resetMediaRecorder();
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="flex flex-col items-center gap-4 w-full">
      {/* Record / Stop Button & Upload Option */}
      {!saved && !activeAudioUrl && (
        <div className="flex flex-col items-center gap-4 w-full">
          <div className="relative">
            {isRecording && (
              <div className="absolute inset-0 rounded-full animate-record opacity-50 pointer-events-none" aria-hidden />
            )}
            <button
              type="button"
              onClick={isRecording ? stopRecording : startRecording}
              className={`onb-record${isRecording ? ' rec' : ''} relative z-10 cursor-pointer`}
              aria-label={isRecording ? 'إيقاف التسجيل' : 'بدء التسجيل'}
              aria-pressed={isRecording}
            >
              {isRecording
                ? <Square className="w-8 h-8 text-white fill-white" aria-hidden />
                : <Mic className="w-8 h-8 text-white" aria-hidden />
              }
            </button>
          </div>

          {/* Live timer while recording */}
          {isRecording && (
            <div
              className="flex items-center gap-2 font-bold text-lg"
              style={{ color: '#C2410C', fontVariantNumeric: 'tabular-nums' }}
              role="timer"
              aria-label="مدة التسجيل"
            >
              <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#C2410C' }} aria-hidden />
              {formatCountdown(duration)}
            </div>
          )}

          {/* Direct Stop Button during recording */}
          {isRecording && (
            <button
              type="button"
              onClick={stopRecording}
              className="text-sm flex items-center gap-2 py-2.5 px-6 rounded-xl font-extrabold text-white cursor-pointer z-10 transition-transform active:scale-95 shadow-md"
              style={{ background: '#DC2626', border: 'none' }}
            >
              <Square className="w-4 h-4 fill-white text-white" aria-hidden />
              <span>إيقاف التسجيل وحفظ الصوت</span>
            </button>
          )}

          {/* Status text */}
          <p className="text-sm font-medium text-center" style={{ color: '#756E85' }}>
            {isRecording
              ? 'جارٍ التسجيل... اضغط المربع أو الزر أعلاه لإيقاف التسجيل'
              : 'اضغط الميكروفون لتسجيل تلاوتك بصوتك'}
          </p>

          {/* Mic permission error */}
          {recError && (
            <p
              role="alert"
              className="text-sm px-4 py-2 rounded-xl w-full text-center"
              style={{ color: '#C2410C', background: '#FFF', border: '1px solid #C2410C' }}
            >
              {recError}
            </p>
          )}

          {/* File Upload Alternative */}
          {!isRecording && (
            <div className="w-full pt-2 flex flex-col items-center">
              <span className="text-xs text-muted-foreground mb-2" style={{ color: '#756E85' }}>— أو يمكنك رفع ملف صوتي جاهز من جهازك —</span>
              <input
                ref={fileInputRef}
                type="file"
                accept="audio/*"
                onChange={handleFileUpload}
                className="hidden"
                id={`oral-upload-${questionIndex}`}
              />
              <label
                htmlFor={`oral-upload-${questionIndex}`}
                className="onb-ghost cursor-pointer text-xs flex items-center gap-2 py-2 px-4 rounded-xl border border-dashed hover:bg-emerald-50 transition-colors"
                style={{ borderColor: '#177B58', color: '#177B58' }}
              >
                <Upload className="w-4 h-4" aria-hidden />
                <span>رفع ملف صوتي (MP3 / WAV / M4A)</span>
              </label>
            </div>
          )}
        </div>
      )}

      {/* Audio preview + save / redo — shown after recording or file selection & before saving */}
      {activeAudioUrl && !isRecording && !saved && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="w-full space-y-3"
        >
          <div className="rounded-xl p-3" style={{ background: '#F8F5FF', border: '1px solid #C4B5D0' }}>
            <p className="text-xs font-bold mb-2 flex items-center justify-between gap-1" style={{ color: '#756E85' }}>
              <span className="flex items-center gap-1.5">
                {fileAudioBlob ? <FileAudio className="w-4 h-4 text-emerald-600" /> : <Volume2 className="w-3.5 h-3.5" />}
                {fileAudioBlob ? `الملف الصوتي: ${fileName}` : 'استمع للتسجيل قبل الحفظ:'}
              </span>
            </p>
            <audio src={activeAudioUrl} controls className="w-full rounded-xl" />
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={handleRedo} className="onb-ghost flex-1 text-sm">
              <RotateCcw className="w-4 h-4" aria-hidden />
              إعادة التسجيل / الرفع
            </button>
            <button type="button" onClick={handleSave} className="onb-btn flex-1 text-sm">
              <CheckCircle className="w-4 h-4" aria-hidden />
              حفظ التسجيل
            </button>
          </div>
        </motion.div>
      )}

      {/* Saved — allow redo */}
      {saved && (
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="w-full space-y-3"
        >
          <div className="rounded-xl p-3" style={{ background: '#E2EFE7', border: '1px solid #177B58' }}>
            <div className="flex items-center justify-between mb-2">
              <span className="flex items-center gap-2 font-bold text-sm" style={{ color: '#177B58' }}>
                <CheckCircle className="w-5 h-5" aria-hidden />
                {fileAudioBlob ? `تم حفظ الملف: ${fileName}` : 'تم حفظ التسجيل الصوتي بنجاح'}
              </span>
            </div>
            {activeAudioUrl && <audio src={activeAudioUrl} controls className="w-full rounded-xl" />}
          </div>
          <button type="button" onClick={handleRedo} className="onb-ghost w-full text-sm">
            <RotateCcw className="w-4 h-4" aria-hidden />
            إعادة التسجيل أو تغيير الملف
          </button>
        </motion.div>
      )}
    </div>
  );
}

export default function WrittenExamPage() {
  const { user, updateUser } = useAuthStore();
  const {
    currentExam, fetchPlacementExam, setAnswer, answers,
    oralRecordings, submitWrittenExam, submitOralExam, isLoading, isSubmitting,
    placementCompleted, placementResult
  } = useExamStore();
  const navigate = useNavigate();
  const [currentQ, setCurrentQ] = useState(0);
  const [timeLeft, setTimeLeft] = useState(null);
  const autoSubmittedRef = useRef(false);
  // Track which recitation questions have been recorded
  const [recitationSaved, setRecitationSaved] = useState({});
  const [submitConfirm, setSubmitConfirm] = useState(null); // null | 'recitation' | 'incomplete'

  const regType = user?.registrationType || 'student';

  // Check if exam has recitation questions
  const hasRecitationQuestions = currentExam?.questions?.some(q => q.type === 'recitation');

  useEffect(() => {
    fetchPlacementExam(regType);
  }, [regType]);

  // Redirect if already completed
  useEffect(() => {
    if (placementCompleted && placementResult) {
      navigate('/onboarding/result', { state: { resultId: placementResult._id }, replace: true });
    }
  }, [placementCompleted, placementResult, navigate]);

  useEffect(() => {
    if (currentExam?.duration) {
      setTimeLeft(currentExam.duration * 60);
    }
  }, [currentExam]);

  useEffect(() => {
    if (timeLeft === null || timeLeft <= 0) return;
    const timer = setInterval(() => setTimeLeft((t) => t - 1), 1000);
    return () => clearInterval(timer);
  }, [timeLeft]);

  const handleAnswer = (qIdx, aIdx) => {
    setAnswer(qIdx, aIdx);
  };

  const doSubmit = async () => {
    const result = await submitWrittenExam(currentExam._id);

    // If there are oral recordings, submit them directly
    const hasInlineRecordings = hasRecitationQuestions && oralRecordings.length > 0;
    if (hasInlineRecordings) {
      try {
        await submitOralExam(currentExam._id, result._id);
      } catch (err) {
        console.error('Oral upload error:', err);
      }
    }

    // Mark placement exam as taken in local state
    updateUser({ placementExamTaken: true });
    try {
      localStorage.removeItem(`survey_answers_${user?._id}_${regType}`);
      localStorage.removeItem(`oral_pending_${user?._id}`);
      localStorage.removeItem(`oral_context_${user?._id}`);
    } catch (_) {}

    toast.success('تم تسليم الامتحان بنجاح!');
    navigate('/onboarding/result', { state: { resultId: result._id } });
  };

  // Answered = MCQ/true-false choices + saved recitation recordings
  const isAnswered = (idx) => {
    const q = currentExam?.questions?.[idx];
    if (q?.type === 'recitation') return !!recitationSaved[idx];
    return answers[idx] !== undefined;
  };

  const handleSubmit = async (auto = false) => {
    if (!auto) {
      const answeredCount = (currentExam?.questions || []).filter((_, idx) => isAnswered(idx)).length;
      if (answeredCount < (currentExam?.questions?.length || 0)) {
        // Check specifically for unrecorded recitation questions
        const unrecordedRecitations = (currentExam?.questions || []).filter(
          (q, idx) => q.type === 'recitation' && !recitationSaved[idx]
        );
        setSubmitConfirm(unrecordedRecitations.length > 0 ? 'recitation' : 'incomplete');
        return;
      }
    }
    try {
      await doSubmit();
    } catch (err) {
      autoSubmittedRef.current = false;
      const msg = err?.response?.data?.message || 'خطأ في التسليم. حاول مجدداً.';
      toast.error(msg);
    }
  };

  // Auto-submit exactly once when the timer runs out
  useEffect(() => {
    if (timeLeft === 0 && !autoSubmittedRef.current && currentExam && !placementCompleted) {
      autoSubmittedRef.current = true;
      toast('انتهى الوقت وتم تسليم الامتحان تلقائياً');
      handleSubmit(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft]);

  if (isLoading) return (
    <div className="onb" dir="rtl">
      <div className="onb-center">
        <LoadingSpinner size="lg" text="جارٍ تحميل الامتحان..." />
      </div>
    </div>
  );

  if (placementCompleted) return null; // Will redirect via useEffect

  if (!currentExam) return (
    <div className="onb" dir="rtl">
      <div className="onb-center">
        <p style={{ color: '#756E85', marginBottom: 16 }}>الامتحان غير متاح حالياً</p>
        <div className="flex gap-3 justify-center">
          <button type="button" onClick={() => fetchPlacementExam(regType)} className="onb-btn">
            إعادة المحاولة
          </button>
          <button type="button" onClick={() => navigate('/student/quran')} className="onb-ghost">
            تصفح المصحف ريثما تُحل المشكلة
          </button>
        </div>
      </div>
    </div>
  );

  const question = currentExam.questions[currentQ];
  const totalQ = currentExam.questions.length;
  const progress = ((currentQ + 1) / totalQ) * 100;
  const mm = Math.floor((timeLeft || 0) / 60).toString().padStart(2, '0');
  const ss = ((timeLeft || 0) % 60).toString().padStart(2, '0');
  const urgent = timeLeft !== null && timeLeft < 120;

  return (
    <MotionConfig reducedMotion="user">
      <div className="onb" dir="rtl">
        <div className="max-w-2xl mx-auto px-4 py-8">
          {/* Header */}
          <div className="mb-6">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div>
                <span className="onb-badge">الخطوة 3 من 5 — الامتحان التحريري</span>
                <p className="text-sm mt-1" style={{ color: '#756E85' }}>{currentExam.title}</p>
              </div>
              {timeLeft !== null && (
                <span className={`onb-timer${urgent ? ' urgent' : ''}`} role="timer" aria-label={`الوقت المتبقي ${mm} دقيقة و${ss} ثانية`}>
                  <Clock className="w-4 h-4" aria-hidden />
                  {mm}:{ss}
                </span>
              )}
            </div>
            <div className="onb-progress" role="progressbar" aria-valuenow={Math.round(progress)} aria-valuemin={0} aria-valuemax={100} aria-label="تقدم الامتحان">
              <span style={{ width: `${progress}%` }} />
            </div>
            <p className="mt-1 text-center" style={{ fontSize: '0.8125rem', color: '#756E85' }}>
              السؤال {currentQ + 1} من {totalQ} — إجابة {(currentExam?.questions || []).filter((_, idx) => isAnswered(idx)).length} من {totalQ}
            </p>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={currentQ}
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.2 }}
            >
              <div className="onb-card">
                <div className="flex items-start gap-3 mb-6">
                  <span className="onb-num" style={{ width: 36, height: 36, fontSize: '1rem' }} aria-hidden>
                    {currentQ + 1}
                  </span>
                  <div>
                    {question.arabicText && (
                      <p className="onb-quran" style={{ textAlign: 'right', marginBottom: 8 }}>{question.arabicText}</p>
                    )}
                    {question.text !== question.arabicText && (
                      <p className="font-medium" style={{ color: '#2A2438' }}>{question.text}</p>
                    )}
                  </div>
                </div>

                {/* True/False Question */}
                {question.type === 'true_false' ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4" role="group" aria-label="اختر صحيح أو خطأ">
                    {[
                      { value: true, label: 'صحيح (صح)', Icon: Check },
                      { value: false, label: 'خطأ', Icon: X },
                    ].map((item) => {
                      const isSelected = answers[currentQ] === item.value;

                      return (
                        <button
                          key={String(item.value)}
                          type="button"
                          onClick={() => handleAnswer(currentQ, item.value)}
                          aria-pressed={isSelected}
                          className="onb-opt"
                          style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            gap: 12, padding: 24, fontWeight: 700, fontSize: '1.25rem',
                            ...(isSelected
                            ? { borderColor: '#177B58', background: '#E2EFE7', color: '#0F5940' }
                            : undefined),
                          }}
                        >
                          <item.Icon size={26} strokeWidth={2.5} aria-hidden />
                          <span>{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                ) : question.type === 'recitation' ? (
                  /* Oral Question — inline audio recording or file upload */
                  <div className="space-y-4">
                    <div className="flex items-start gap-3 rounded-2xl p-3 mb-2" style={{ background: '#E2EFE7', border: '1px solid #177B58' }}>
                      <Mic className="w-5 h-5 flex-none mt-0.5" style={{ color: '#177B58' }} aria-hidden />
                      <div>
                        <p className="font-bold text-sm" style={{ color: '#0F5940' }}>
                          سؤال شفهي — سجّل تلاوتك بصوتك
                        </p>
                        <p className="text-xs mt-0.5" style={{ color: '#177B58' }}>
                          سيستمع المشرف إلى تسجيلك ويقيّم مستواك. اضغط الميكروفون للبدء.
                        </p>
                      </div>
                    </div>
                    {question.instruction && (
                      <p className="text-sm font-medium text-center" style={{ color: '#2A2438' }}>
                        {question.instruction}
                      </p>
                    )}
                    <RecitationRecorder
                      key={question._id || `q-${currentQ}`}
                      questionIndex={currentQ}
                      questionId={question._id}
                      onSaved={() => setRecitationSaved(prev => ({ ...prev, [currentQ]: true }))}
                    />
                  </div>
                ) : (
                  /* MCQ Options */
                  <div className="space-y-3" role="group" aria-label="خيارات الإجابة">
                    {(question.options || []).map((opt, i) => {
                      const isSelected = answers[currentQ] === i;

                      return (
                        <button
                          key={i}
                          type="button"
                          onClick={() => handleAnswer(currentQ, i)}
                          aria-pressed={isSelected}
                          className="onb-opt"
                          style={isSelected
                            ? { borderColor: '#177B58', background: '#E2EFE7', color: '#0F5940', fontWeight: 700 }
                            : undefined}
                        >
                          <span className="flex items-center gap-3">
                            <span aria-hidden className={`onb-radio${isSelected ? ' on' : ''}`} />
                            {opt}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Navigation */}
          <div className="flex items-center justify-between mt-6">
            <button onClick={() => setCurrentQ((c) => Math.max(0, c - 1))} disabled={currentQ === 0}
              className="onb-ghost">
              السابق
            </button>
            {currentQ < totalQ - 1 ? (
              <button onClick={() => setCurrentQ((c) => c + 1)} className="onb-btn">
                السؤال التالي
                <ChevronLeft className="w-4 h-4" aria-hidden />
              </button>
            ) : (
              <button onClick={() => handleSubmit(false)} disabled={isSubmitting} className="onb-btn">
                {isSubmitting ? <LoadingSpinner size="sm" color="white" /> : (
                  <>
                    تسليم الامتحان
                    <Check className="w-4 h-4" aria-hidden />
                  </>
                )}
              </button>
            )}
          </div>

          {/* Question dots */}
          <div className="flex flex-wrap gap-2 justify-center mt-6" role="group" aria-label="التنقل بين الأسئلة">
            {currentExam.questions.map((q, i) => (
              <button key={i} onClick={() => setCurrentQ(i)}
                aria-label={`السؤال ${i + 1}${isAnswered(i) ? ' (تمت الإجابة)' : ''}${q.type === 'recitation' ? ' (شفهي)' : ''}`}
                aria-current={i === currentQ ? 'true' : undefined}
                className={`onb-dot${i === currentQ ? ' now' : isAnswered(i) ? ' ans' : ''}${q.type === 'recitation' ? ' oral' : ''}`}
              >
                {q.type === 'recitation' ? 'شفهي' : i + 1}
              </button>
            ))}
          </div>
          </div>
        </div>

        {/* Submit confirm */}
        <ConfirmModal
          open={Boolean(submitConfirm)}
          title="تسليم الامتحان؟"
          message={submitConfirm === 'recitation'
            ? 'لديك أسئلة شفهية لم تسجل لها صوتاً بعد. يمكنك التسجيل لاحقاً في صفحة الامتحان الشفهي.'
            : 'لم تجب على جميع الأسئلة. يمكنك التسليم وستُحتسب الإجابات الفارغة خاطئة.'}
          confirmLabel="تسليم"
          onConfirm={async () => { setSubmitConfirm(null); await doSubmit(); }}
          onClose={() => setSubmitConfirm(null)}
        />
      </MotionConfig>
  );
}

