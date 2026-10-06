import { SURVEY_QUESTIONS } from './constants';

/* حلّ إجابة استبيان مخزنة إلى نصوص قابلة للعرض في مودالات المراجعة.
   - السجلات الجديدة تحمل questionText/answerText مباشرة.
   - السجلات القديمة تحمل فهارس فقط (questionIndex/selectedOption) —
     تُحلّ من ثوابت الأسئلة حسب نوع التسجيل، فيظهر النص الصحيح
     دون أي ترحيل لقاعدة البيانات. */

export function resolveSurveyAnswer(sa, idx = 0, regType) {
  const storedQ =
    typeof sa?.questionText === 'string' && sa.questionText.trim()
      ? sa.questionText.trim()
      : null;
  const storedA =
    typeof sa?.answerText === 'string' && sa.answerText.trim()
      ? sa.answerText.trim()
      : typeof sa?.answer === 'string' && sa.answer.trim()
        ? sa.answer.trim()
        : null;
  if (storedQ && storedA) return { questionText: storedQ, answerText: storedA };

  const list = SURVEY_QUESTIONS[regType] || SURVEY_QUESTIONS.student;
  const qi = Number.isInteger(sa?.questionIndex) ? sa.questionIndex : idx;
  const q = Array.isArray(list) ? list[qi] : null;
  const optIdx = Number.isInteger(sa?.selectedOption) ? sa.selectedOption : -1;

  return {
    questionText: storedQ || q?.text || 'سؤال الاستبيان',
    answerText: storedA || q?.options?.[optIdx] || '—',
  };
}

export default resolveSurveyAnswer;
