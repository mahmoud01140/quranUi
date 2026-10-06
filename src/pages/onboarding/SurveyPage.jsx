import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, MotionConfig } from 'framer-motion';
import toast from 'react-hot-toast';
import useAuthStore from '../../store/authStore';
import useExamStore from '../../store/examStore';
import { SURVEY_QUESTIONS } from '../../utils/constants';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import api from '../../services/api';
import LoadingSpinner from '../../components/shared/LoadingSpinner';
import './Onboarding.css';

export default function SurveyPage() {
  const { user } = useAuthStore();
  const { setSurveyAnswer, surveyAnswers } = useExamStore();
  const navigate = useNavigate();
  const [currentQ, setCurrentQ] = useState(0);
  const [loading, setLoading] = useState(true);

  const regType = user?.registrationType || 'student';
  const storageKey = `survey_answers_${user?._id || 'guest'}_${regType}`;
  const [questions, setQuestions] = useState(SURVEY_QUESTIONS[regType] || SURVEY_QUESTIONS.student);

  // Restore answers saved on this device so a refresh never wipes the survey
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || '[]');
      if (Array.isArray(saved)) {
        saved.forEach((opt, idx) => {
          if (opt !== undefined && opt !== null) setSurveyAnswer(idx, opt);
        });
      }
    } catch (_) {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  useEffect(() => {
    const fetchSurvey = async () => {
      try {
        setLoading(true);
        const res = await api.get(`/survey/${regType}`);
        if (res.data?.survey?.questions?.length > 0) {
          setQuestions(res.data.survey.questions);
        }
      } catch (err) {
        // Fallback already set from SURVEY_QUESTIONS
      } finally {
        setLoading(false);
      }
    };
    fetchSurvey();
  }, [regType]);

  const question = questions[currentQ] || questions[0];
  const isLast = currentQ === questions.length - 1;
  const selectedOption = surveyAnswers[currentQ];

  const handleSelect = (index) => {
    setSurveyAnswer(currentQ, index);
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || '[]');
      saved[currentQ] = index;
      localStorage.setItem(storageKey, JSON.stringify(saved));
      // نسخة مُثراة بالنصوص تُرسل مع التسليم فيُحفظ السؤال والإجابة نصاً
      // (إصلاح عرض المراجعة — بدل الفهارس الجافة)
      const enrichedKey = `survey_enriched_${user?._id || 'guest'}_${regType}`;
      const enriched = JSON.parse(localStorage.getItem(enrichedKey) || '[]');
      const q = questions[currentQ];
      enriched[currentQ] = {
        questionIndex: currentQ,
        selectedOption: index,
        questionText: q?.text || '',
        answerText: q?.options?.[index] || '',
      };
      localStorage.setItem(enrichedKey, JSON.stringify(enriched));
    } catch (_) {}
  };

  const handleNext = () => {
    if (selectedOption === undefined) {
      toast.error('الرجاء اختيار إجابة');
      return;
    }
    if (isLast) {
      navigate('/onboarding/written-exam');
    } else {
      setCurrentQ((c) => c + 1);
    }
  };

  const handlePrev = () => {
    if (currentQ > 0) setCurrentQ((c) => c - 1);
  };

  const progress = questions.length > 0 ? ((currentQ + 1) / questions.length) * 100 : 100;

  if (loading) {
    return (
      <div className="onb" dir="rtl">
        <div className="onb-center">
          <LoadingSpinner size="lg" text="جارٍ تجهيز الاستبيان..." />
        </div>
      </div>
    );
  }

  return (
    <MotionConfig reducedMotion="user">
      <div className="onb" dir="rtl">
        <div className="max-w-2xl mx-auto px-4 py-12">
          {/* Progress */}
          <div className="mb-8">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="onb-badge">الخطوة 2 من 5 — الاستبيان</span>
              <span style={{ color: '#756E85' }}>السؤال {currentQ + 1} من {questions.length}</span>
            </div>
            <div className="onb-progress" role="progressbar" aria-valuenow={Math.round(progress)} aria-valuemin={0} aria-valuemax={100} aria-label="تقدم الاستبيان">
              <span style={{ width: `${progress}%` }} />
            </div>
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
                {/* Question number */}
                <div className="flex items-center gap-3 mb-6">
                  <span className="onb-num" aria-hidden>{currentQ + 1}</span>
                  <h2 className="font-extrabold" style={{ fontSize: '1.25rem', color: '#2A2438' }}>{question.text}</h2>
                </div>

                {/* Options */}
                <div className="space-y-3" role="group" aria-label={question.text}>
                  {question.options.map((opt, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => handleSelect(i)}
                      aria-pressed={selectedOption === i}
                      className="onb-opt"
                    >
                      <span className="flex items-center gap-3">
                        <span aria-hidden className={`onb-radio${selectedOption === i ? ' on' : ''}`} />
                        {opt}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          </AnimatePresence>

          <div className="flex items-center justify-between mt-6">
            <button onClick={handlePrev} disabled={currentQ === 0}
              className="onb-ghost">
              <ChevronRight className="w-4 h-4" aria-hidden />
              السابق
            </button>
            <button onClick={handleNext} className="onb-btn">
              {isLast ? 'انتقل للامتحان التحريري' : 'التالي'}
              <ChevronLeft className="w-4 h-4" aria-hidden />
            </button>
          </div>
        </div>
      </div>
    </MotionConfig>
  );
}
