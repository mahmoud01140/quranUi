import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence, MotionConfig } from 'framer-motion';
import { Mic, Square, CheckCircle, Upload, RotateCcw, Info, Clock, Volume2, ShieldCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import useAuthStore from '../../store/authStore';
import useExamStore from '../../store/examStore';
import useMediaRecorder from '../../hooks/useMediaRecorder';
import LoadingSpinner from '../../components/shared/LoadingSpinner';
import ConfirmModal from '../../components/shared/ConfirmModal';
import { formatCountdown } from '../../utils/helpers';
import './Onboarding.css';

const FALLBACK_TASKS = [
  {
    taskNumber: 1,
    instruction: 'تسميع سورة الفاتحة كاملة بصوت واضح مع مراعاة الترتيل والتجويد',
    arabicText: 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ ﴿١﴾ الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ ﴿٢﴾ الرَّحْمَٰنِ الرَّحِيمِ ﴿٣﴾ مَالِكِ يَوْمِ الدِّينِ ﴿٤﴾ إِيَّاكَ نَعْبُدُ وَإِيَّاكَ نَسْتَعِينُ ﴿٥﴾ اهْدِنَا الصِّرَاطَ الْمُسْتَقِيمَ ﴿٦﴾ صِرَاطَ الَّذِينَ أَنْعَمْتَ عَلَيْهِمْ غَيْرِ الْمَغْضُوبِ عَلَيْهِمْ وَلَا الضَّالِّينَ ﴿٧﴾',
    duration: 60,
  },
  {
    taskNumber: 2,
    instruction: 'قراءة وضبط أحكام التجويد للكلمات القرآنية التالية مع بيان الحركات والمدود',
    arabicText: 'كِتَابٌ أَنزَلْنَاهُ - رَحْمَةً لِّلْعَالَمِينَ - الطَّامَّةُ الْكُبْرَىٰ - قُرْآنٌ مَّجِيدٌ',
    duration: 45,
  },
  {
    taskNumber: 3,
    instruction: 'تلاوة الآية الكريمة مع تطبيق أحكام النون الساكنة والتنوين والمدود',
    arabicText: 'وَمِنَ النَّاسِ مَن يَقُولُ آمَنَّا بِاللَّهِ وَبِالْيَوْمِ الْآخِرِ وَمَا هُم بِمُؤْمِنِينَ',
    duration: 60,
  },
];

export default function OralExamPage() {
  const { user } = useAuthStore();
  const { currentExam, fetchPlacementExam, addOralRecording, submitOralExam, isSubmitting, placementResult, result } = useExamStore();
  const navigate = useNavigate();
  const location = useLocation();
  const { resultId: stateResultId, examId: stateExamId } = location.state || {};

  const storedCtx = (() => {
    try { return JSON.parse(localStorage.getItem(`oral_context_${user?._id}`) || 'null'); }
    catch (_) { return null; }
  })();
  const resultId = stateResultId || storedCtx?.resultId || placementResult?._id || result?._id;
  const contextExamId = stateExamId || storedCtx?.examId || placementResult?.exam || result?.exam;

  useEffect(() => {
    if (!resultId && !currentExam && !placementResult && !result) {
      toast.error('أكمل الامتحان التحريري أولاً قبل الامتحان الشفهي');
      navigate('/onboarding/written-exam', { replace: true });
    }
  }, [resultId, currentExam, placementResult, result, navigate]);

  useEffect(() => {
    if (!currentExam && user?.registrationType) {
      fetchPlacementExam(user.registrationType).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [currentTask, setCurrentTask] = useState(0);
  const [completed, setCompleted] = useState({});
  const [taskSeconds, setTaskSeconds] = useState({});
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);

  const {
    isRecording, duration, audioUrl, audioBlob, error,
    startRecording, stopRecording, resetRecording,
  } = useMediaRecorder();

  const usingFallback = !currentExam?.oralTasks?.length;
  const tasks = currentExam?.oralTasks?.length ? currentExam.oralTasks : FALLBACK_TASKS;

  const task = tasks[currentTask];
  const allCompleted = Object.keys(completed).length === tasks.length;
  const hasUnsavedRecording = Boolean(audioBlob && !completed[currentTask]);

  useEffect(() => {
    if (!isRecording && duration > 0 && audioUrl) {
      setTaskSeconds(prev => ({ ...prev, [currentTask]: duration }));
    }
  }, [isRecording, audioUrl]);

  const handleSaveRecording = () => {
    if (!audioBlob) return;
    addOralRecording(task._id || `task-${currentTask}`, audioBlob, audioUrl);
    setCompleted(prev => ({ ...prev, [currentTask]: true }));
    toast.success('تم حفظ تسجيل المهمة بنجاح وسيُرسل للإدارة');
  };

  const switchTask = (next) => {
    if (next === currentTask) return;
    if (hasUnsavedRecording && !completed[currentTask]) {
      setShowLeaveConfirm(true);
      return;
    }
    doSwitchTask(next);
  };

  const doSwitchTask = (next) => {
    setCurrentTask(next);
    resetRecording();
  };

  const handleSubmitAll = async () => {
    const examId = currentExam?._id || contextExamId;
    if (!examId) {
      toast.error('تعذر تحديد الامتحان. أعد تحميل الصفحة وحاول مجدداً.');
      return;
    }
    if (!tasks.length || Object.keys(completed).length < tasks.length) {
      toast.error('سجل جميع المهام الصوتية أولاً قبل الرفع');
      return;
    }
    const finalResultId = resultId || placementResult?._id || result?._id;
    try {
      await submitOralExam(examId, finalResultId);
      try {
        localStorage.removeItem(`oral_pending_${user?._id}`);
        localStorage.removeItem(`oral_context_${user?._id}`);
      } catch (_) {}
      toast.success('تم رفع التلاوات بنجاح إلى الإدارة للمراجعة والتصحيح!');
      navigate('/onboarding/result', { state: { resultId: finalResultId } });
    } catch {
      toast.error('خطأ في رفع التسجيلات. حاول مجدداً.');
    }
  };

  if (!resultId && !currentExam) return null;

  const completedCount = Object.keys(completed).length;
  const overallProgress = Math.round((completedCount / tasks.length) * 100);

  return (
    <MotionConfig reducedMotion="user">
      <div className="onb" dir="rtl">
        <div className="max-w-2xl mx-auto px-4 py-8">

          {/* Progress */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="onb-badge">الخطوة 4 من 5 — الامتحان الشفهي</span>
              <span className="text-sm font-bold" style={{ color: '#177B58' }}>
                {completedCount}/{tasks.length} مكتملة
              </span>
            </div>
            <div
              className="onb-progress"
              role="progressbar"
              aria-valuenow={overallProgress}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="تقدم الامتحان الشفهي"
            >
              <span style={{ width: `${overallProgress}%`, transition: 'width 0.4s ease' }} />
            </div>
            {usingFallback && (
              <p className="mt-2 text-center" style={{ fontSize: '0.8125rem', color: '#756E85' }}>
                مهام احتياطية — سيخصص المعلم مهامك النهائية عند المراجعة.
              </p>
            )}
          </div>

          {/* Info Banner */}
          <div
            className="flex items-start gap-3 rounded-2xl p-4 mb-6"
            style={{ background: '#E2EFE7', border: '1px solid #177B58' }}
          >
            <ShieldCheck className="w-5 h-5 flex-none mt-0.5" style={{ color: '#177B58' }} aria-hidden />
            <div>
              <p className="font-bold text-sm" style={{ color: '#0F5940' }}>
                تسجيلاتك ترفع مباشرة للمشرف للمراجعة
              </p>
              <p className="text-xs mt-0.5" style={{ color: '#177B58' }}>
                بعد الرفع، سيستمع المشرف إلى تسجيلاتك ويحدد مستواك خلال 24 ساعة وتصلك النتيجة.
              </p>
            </div>
          </div>

          {/* Task tabs */}
          <div
            className="flex gap-2 mb-6 overflow-x-auto pb-2 no-scrollbar"
            role="tablist"
            aria-label="مهام الامتحان الشفهي"
          >
            {tasks.map((t, i) => (
              <button
                key={i}
                role="tab"
                aria-selected={i === currentTask}
                onClick={() => switchTask(i)}
                className={`onb-tab${i === currentTask ? ' on' : completed[i] ? ' done' : ''}`}
              >
                {completed[i]
                  ? <CheckCircle className="w-3.5 h-3.5" aria-hidden />
                  : <span
                      className="w-3.5 h-3.5 rounded-full border-2 inline-block"
                      style={{ borderColor: i === currentTask ? '#177B58' : '#C4B5D0' }}
                      aria-hidden
                    />
                }
                مهمة {i + 1}
              </button>
            ))}
          </div>

          {/* Task Card */}
          <AnimatePresence mode="wait">
            <motion.div
              key={currentTask}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.18 }}
            >
              <div className="onb-card">
                {/* Task header */}
                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-3">
                    <span
                      className="text-xs font-bold px-2.5 py-1 rounded-full"
                      style={{ background: '#E2EFE7', color: '#0F5940' }}
                    >
                      المهمة {currentTask + 1} من {tasks.length}
                    </span>
                    {task.duration && (
                      <span className="flex items-center gap-1 text-xs font-bold" style={{ color: '#756E85' }}>
                        <Clock className="w-3.5 h-3.5" aria-hidden />
                        {task.duration} ثانية مقترحة
                      </span>
                    )}
                  </div>

                  <h3 className="font-extrabold mb-3" style={{ fontSize: '1.2rem', color: '#2A2438' }}>
                    {task.instruction}
                  </h3>

                  {task.arabicText && (
                    <div className="onb-wash">
                      <p className="onb-quran">{task.arabicText}</p>
                    </div>
                  )}
                </div>

                {/* Recording Controls */}
                <div className="flex flex-col items-center gap-5">

                  {/* Record / Stop Button */}
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
                      disabled={completed[currentTask]}
                      style={completed[currentTask] ? { opacity: 0.45, cursor: 'not-allowed' } : undefined}
                    >
                      {isRecording
                        ? <Square className="w-10 h-10 text-white" aria-hidden />
                        : <Mic className="w-10 h-10 text-white" aria-hidden />
                      }
                    </button>
                  </div>

                  {/* Timer */}
                  {isRecording && (
                    <div
                      className="flex items-center gap-2 font-bold text-lg"
                      style={{ color: '#C2410C', fontVariantNumeric: 'tabular-nums' }}
                      role="timer"
                      aria-label="مدة التسجيل الحالية"
                    >
                      <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#C2410C' }} aria-hidden />
                      {formatCountdown(duration)}
                    </div>
                  )}

                  {/* Status text */}
                  <p className="text-sm font-medium" style={{ color: '#756E85' }}>
                    {completed[currentTask]
                      ? 'تم حفظ هذا التسجيل وسيُرفع للمراجعة'
                      : isRecording
                        ? 'جارٍ التسجيل... اضغط مربع الإيقاف للانتهاء'
                        : audioUrl
                          ? 'تم التسجيل — استمع للمراجعة أو أعد التسجيل'
                          : 'اضغط زر الميكروفون للبدء بالتسميع'}
                  </p>

                  {error && (
                    <p
                      role="alert"
                      className="text-sm px-4 py-2 rounded-xl w-full text-center"
                      style={{ color: '#C2410C', background: '#FFF', border: '1px solid #C2410C' }}
                    >
                      {error}
                    </p>
                  )}

                  {/* Audio preview + save/redo */}
                  {audioUrl && !isRecording && !completed[currentTask] && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2 }}
                      className="w-full space-y-3"
                    >
                      <div className="rounded-xl p-3" style={{ background: '#F8F5FF', border: '1px solid #C4B5D0' }}>
                        <p className="text-xs font-bold mb-2 flex items-center gap-1" style={{ color: '#756E85' }}>
                          <Volume2 className="w-3.5 h-3.5" aria-hidden />
                          استمع للتسجيل قبل الحفظ:
                        </p>
                        <audio src={audioUrl} controls className="w-full rounded-xl" />
                        {taskSeconds[currentTask] && (
                          <p className="text-xs mt-1 text-center" style={{ color: '#756E85' }}>
                            مدة التسجيل: {taskSeconds[currentTask]} ثانية
                          </p>
                        )}
                      </div>

                      <div className="flex gap-3">
                        <button onClick={resetRecording} className="onb-ghost flex-1 text-sm">
                          <RotateCcw className="w-4 h-4" aria-hidden />
                          إعادة التسجيل
                        </button>
                        <button onClick={handleSaveRecording} className="onb-btn flex-1 text-sm">
                          <CheckCircle className="w-4 h-4" aria-hidden />
                          حفظ التسجيل
                        </button>
                      </div>
                    </motion.div>
                  )}

                  {/* Completed indicator */}
                  {completed[currentTask] && (
                    <motion.div
                      initial={{ scale: 0.9, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="flex flex-col items-center gap-2 w-full"
                    >
                      <div className="flex items-center gap-2 font-bold" style={{ color: '#177B58' }}>
                        <CheckCircle className="w-5 h-5" aria-hidden />
                        تم حفظ تسجيل هذه المهمة
                      </div>
                      <p className="text-xs text-center" style={{ color: '#756E85' }}>
                        سيستمع إليه المشرف لتقييم مستواك
                      </p>
                      {currentTask < tasks.length - 1 && (
                        <button
                          onClick={() => switchTask(currentTask + 1)}
                          className="onb-btn-outline mt-1 text-sm"
                        >
                          انتقل للمهمة التالية
                        </button>
                      )}
                    </motion.div>
                  )}

                </div>
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Footer / Submit */}
          <div className="mt-6">
            {allCompleted ? (
              <div className="space-y-3">
                <div
                  className="rounded-2xl p-4 flex items-start gap-3"
                  style={{ background: '#E2EFE7', border: '1px solid #177B58' }}
                >
                  <Info className="w-5 h-5 flex-none mt-0.5" style={{ color: '#0F5940' }} aria-hidden />
                  <div>
                    <p className="font-bold text-sm" style={{ color: '#0F5940' }}>
                      أحسنت! جميع المهام مسجلة ({tasks.length}/{tasks.length})
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: '#177B58' }}>
                      اضغط "رفع التسجيلات" لإرسالها للمشرف — ستصلك النتيجة النهائية خلال 24 ساعة.
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleSubmitAll}
                  disabled={isSubmitting}
                  className="onb-btn w-full"
                  style={{ minHeight: 56, fontSize: '1rem' }}
                >
                  {isSubmitting
                    ? <LoadingSpinner size="sm" color="white" />
                    : (
                      <>
                        <Upload className="w-5 h-5" aria-hidden />
                        رفع جميع التسجيلات للمراجعة
                      </>
                    )
                  }
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm" style={{ color: '#756E85' }}>
                  احفظ تسجيل كل مهمة ({completedCount}/{tasks.length}) لتتمكن من الرفع
                </p>
                {currentTask < tasks.length - 1 && !isRecording && (
                  <button
                    onClick={() => switchTask(currentTask + 1)}
                    className="onb-btn-outline flex-none text-sm"
                  >
                    المهمة التالية
                  </button>
                )}
              </div>
            )}
          </div>

        </div>

        {/* Unsaved recording confirm */}
        <ConfirmModal
          open={showLeaveConfirm}
          title="تسجيل غير محفوظ"
          message="لديك تسجيل غير محفوظ لهذه المهمة وسيضيع عند الانتقال."
          confirmLabel="انتقال"
          onConfirm={() => { setShowLeaveConfirm(false); doSwitchTask(currentTask + 1); }}
          onClose={() => setShowLeaveConfirm(false)}
        />
      </div>
    </MotionConfig>
  );
}
