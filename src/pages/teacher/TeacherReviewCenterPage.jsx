import { useState, useEffect } from 'react';
import { motion, AnimatePresence, MotionConfig } from 'framer-motion';
import { CheckCircle, Users, ChevronDown, ChevronLeft, MessageSquare, Clock, Plus, X, Star, Volume2, FileText, Download, Video, Link as LinkIcon, ShieldCheck, Check, Pin } from 'lucide-react';
import toast from 'react-hot-toast';
import PageLayout from '../../components/shared/PageLayout';
import useAuthStore from '../../store/authStore';
import api from '../../services/api';
import LoadingSpinner from '../../components/shared/LoadingSpinner';
import { formatDateAr, getInitials, getAvatarColor } from '../../utils/helpers';
import QURAN_SURAHS from '../../utils/quranData';
import Pagination from '../../components/shared/Pagination';
import usePagination from '../../hooks/usePagination';
import '../../components/halaqa/halaqa.css';
import { HQ } from '../../components/halaqa/primitives';

/* Review center — the teacher's operational desk. Same tabs, fetches,
   ratings, reviews and modals as before; only the visual layer changed. */

const field = {
  width: '100%', minHeight: 48, background: HQ.SURFACE, color: HQ.INK,
  border: `1px solid ${HQ.LINE}`, borderRadius: 12, padding: '12px 16px',
  fontSize: 14, fontFamily: 'inherit',
};

export default function TeacherReviewCenterPage() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';
  const [activeTab, setActiveTab] = useState('oral_exams');

  // State for Oral Exams
  const [pendingExams, setPendingExams] = useState([]);
  const [isLoadingExams, setIsLoadingExams] = useState(true);
  const [reviewingExamId, setReviewingExamId] = useState(null);
  const [examScores, setExamScores] = useState({});
  const [examNotes, setExamNotes] = useState({});
  const [examLevels, setExamLevels] = useState({});
  const [examApprovals, setExamApprovals] = useState({});
  const [flaggedVerseForms, setFlaggedVerseForms] = useState({});
  const [submittingExam, setSubmittingExam] = useState(false);

  // State for Recordings
  const [recordings, setRecordings] = useState([]);
  const [sessionsWithoutRecording, setSessionsWithoutRecording] = useState([]);
  const [isLoadingRecordings, setIsLoadingRecordings] = useState(!isAdmin);
  const [showAddRecordingModal, setShowAddRecordingModal] = useState(false);
  const [addRecordingForm, setAddRecordingForm] = useState({ sessionId: '', url: '' });
  const [savingRecording, setSavingRecording] = useState(false);

  const pendingExamsPagination = usePagination(pendingExams, 5);
  const recordingsPagination = usePagination(recordings, 8);

  useEffect(() => {
    if (isAdmin) return;
    if (user?.role === 'admin') {
      fetchAllGroups();
    } else {
      fetchAllGroups({ teacher: user?._id });
    }
  }, [isAdmin, user?._id]);

  const myGroups = user?.role === 'admin'
    ? groups
    : groups.filter(g => g.teacher?._id === user?._id || g.teacher === user?._id);

  // 1. Fetch Recordings Data when groups load (only for teachers)
  useEffect(() => {
    if (isAdmin) {
      setIsLoadingRecordings(false);
      return;
    }
    if (!myGroups.length) {
      setIsLoadingRecordings(false);
      return;
    }

    const fetchRecordings = async () => {
      try {
        const rawSessions = await Promise.all(
          myGroups.map(g =>
            api.get(`/live/group/${g._id}`)
              .then(r => (r.data.sessions || []).map(s => ({ ...s, groupName: g.name })))
              .catch(() => [])
          )
        );

        const allRecordingsPromises = myGroups.map(g =>
          api.get(`/recordings/group/${g._id}`).then(r => r.data.recordings || []).catch(() => [])
        );

        const allRecordings = (await Promise.all(allRecordingsPromises)).flat();
        const allSessionsList = rawSessions.flat();

        const recordedSessionIds = new Set(allRecordings.map(r => r.session?._id));
        setRecordings(allRecordings.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
        setSessionsWithoutRecording(allSessionsList.filter(s => s.status === 'ended' && !recordedSessionIds.has(s._id)));
      } catch (_) {
      } finally {
        setIsLoadingRecordings(false);
      }
    };

    fetchRecordings();
  }, [groups]);

  // 2. Fetch Pending Oral Exams
  useEffect(() => {
    const fetchPendingExams = async () => {
      try {
        const res = await api.get('/exams/results/pending-review');
        setPendingExams(res.data.results || []);
      } catch (_) {
      } finally {
        setIsLoadingExams(false);
      }
    };
    fetchPendingExams();
  }, []);

  // Handlers for Oral Exams
  const handleReviewExam = async (resultId) => {
    const oralScore = examScores[resultId];
    if (oralScore === undefined || oralScore === '') { toast.error('أدخل درجة التقييم الشفهي (0-100)'); return; }
    setSubmittingExam(true);
    try {
      const flaggedItem = flaggedVerseForms[resultId];
      const flaggedVerses = (flaggedItem && flaggedItem.surahNumber && flaggedItem.verseNumber)
        ? [{
            surahNumber: parseInt(flaggedItem.surahNumber),
            surahName: QURAN_SURAHS.find(s => s.number === parseInt(flaggedItem.surahNumber))?.name || `سورة ${flaggedItem.surahNumber}`,
            verseNumber: parseInt(flaggedItem.verseNumber),
            errorType: flaggedItem.errorType || 'hifz',
            notes: flaggedItem.notes || '',
          }]
        : [];

      await api.put(`/exams/results/${resultId}/review`, {
        oralScore: parseInt(oralScore),
        teacherNotes: examNotes[resultId] || '',
        flaggedVerses,
        ...(examLevels[resultId] ? { assignedLevel: examLevels[resultId] } : {}),
        isApproved: examApprovals[resultId] !== false,
      });
      toast.success('تم اعتماد التقييم الشفهي بنجاح وتحديث بيانات الطالب!');
      setReviewingExamId(null);
      setPendingExams(prev => prev.filter(r => r._id !== resultId));
    } catch { toast.error('خطأ في التقييم'); }
    finally { setSubmittingExam(false); }
  };

  // Handlers for Recordings
  const handleSaveRecording = async () => {
    if (!addRecordingForm.sessionId) { toast.error('اختر الجلسة'); return; }
    if (!addRecordingForm.url) { toast.error('أدخل رابط التسجيل'); return; }

    setSavingRecording(true);
    try {
      const res = await api.post('/recordings', addRecordingForm);
      setRecordings([res.data.recording, ...recordings]);
      setSessionsWithoutRecording(prev => prev.filter(s => s._id !== addRecordingForm.sessionId));
      setShowAddRecordingModal(false);
      setAddRecordingForm({ sessionId: '', url: '' });
      toast.success('تمت إضافة التسجيل بنجاح');
    } catch {
      toast.error('حدث خطأ أثناء حفظ التسجيل');
    } finally {
      setSavingRecording(false);
    }
  };

  const panel = {
    background: HQ.SURFACE, border: `1px solid ${HQ.LINE}`, borderRadius: 18, padding: 20,
  };
  const emptyBox = {
    background: HQ.SURFACE, border: `1px solid ${HQ.LINE}`, borderRadius: 18,
    padding: 48, textAlign: 'center',
  };
  const iconBtn = {
    minWidth: 44, minHeight: 44, borderRadius: 12, border: 'none', background: 'transparent',
    color: HQ.MUTED, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  };
  const primaryBtn = {
    minHeight: 48, padding: '12px 20px', borderRadius: 12, border: 'none',
    background: HQ.MENTOR, color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
  };
  const ghostBtn = {
    minHeight: 48, padding: '12px 20px', borderRadius: 12, border: 'none', background: 'transparent',
    color: HQ.MUTED, fontWeight: 800, fontSize: 14, cursor: 'pointer',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
  };

  const renderStars = (value, onPick, disabled) => (
    <div className="flex items-center gap-1" role="radiogroup" aria-label="التقييم من 5">
      {[1, 2, 3, 4, 5].map((star) => (
        <button key={star} type="button" disabled={disabled}
          role="radio" aria-checked={star === value} aria-label={`${star} من 5`}
          onClick={() => onPick && onPick(star)}
          style={{ minWidth: 40, minHeight: 40, border: 'none', background: 'none', cursor: disabled ? 'default' : 'pointer', padding: 8 }}>
          <Star size={19} aria-hidden color={star <= value ? '#D9A441' : HQ.LINE}
            fill={star <= value ? '#D9A441' : 'none'} />
        </button>
      ))}
    </div>
  );

  return (
    <MotionConfig reducedMotion="user">
      <PageLayout>
        <div className="halaqa" style={{ maxWidth: 960, margin: '0 auto' }}>
          {/* Header */}
          <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: HQ.INK, margin: '0 0 4px' }}>
                {isAdmin ? 'تصحيح الامتحانات الشفهية' : 'مركز التصحيح والمراجعة'}
              </h1>
                <p className="text-sm" style={{ color: HQ.MUTED, margin: 0 }}>
                  {isAdmin
                    ? 'تصحيح ومراجعة التلاوات الشفهية وتحديد المستويات واعتماد نتائج الاختبارات للطلاب'
                    : 'مراجعة التلاوات الشفهية وتدقيق التسجيلات في مكان واحد'}
                </p>
            </div>
            {!isAdmin && activeTab === 'recordings' && (
              <button type="button" onClick={() => setShowAddRecordingModal(true)} className="m-full" style={{ ...primaryBtn, flex: 'none' }}>
                <Plus size={16} aria-hidden /> إضافة تسجيل فيديو
              </button>
            )}
          </div>

          {/* Navigation Tabs (Only for teachers; admin focuses solely on oral exams) */}
          {!isAdmin ? (
            <div className="hq-tabs" role="tablist" aria-label="أقسام المراجعة"
              style={{ display: 'flex', width: '100%', marginBottom: 24, overflowX: 'auto' }}>
              {[
                { key: 'oral_exams', label: `الاختبارات الشفهية (${pendingExams.length})`, Icon: Volume2, alert: pendingExams.length > 0 },
                { key: 'recordings', label: `تسجيلات الجلسات (${recordings.length})`, Icon: Video },
              ].map(t => (
                <button
                  key={t.key}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === t.key}
                  onClick={() => setActiveTab(t.key)}
                  style={{ flex: '1 0 auto', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, whiteSpace: 'nowrap' }}>
                  <t.Icon size={16} aria-hidden />
                  {t.label}
                  {t.alert && (
                    <span aria-label={`${pendingExams.length} بانتظار التصحيح`} style={{
                      display: 'inline-flex', alignItems: 'center', padding: '2px 10px', borderRadius: 9999,
                      background: '#E2EFE7', color: '#0F5940', fontSize: '0.8125rem', fontWeight: 800,
                    }}>
                      {pendingExams.length}
                    </span>
                  )}
                </button>
              ))}
            </div>
          ) : (
            <div className="mb-6 flex items-center justify-between p-4 rounded-2xl" style={{ background: HQ.SURFACE, border: `1px solid ${HQ.LINE}` }}>
              <div className="flex items-center gap-3">
                <div style={{ width: 40, height: 40, borderRadius: 12, background: '#E2EFE7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Volume2 size={20} color="#0F5940" aria-hidden />
                </div>
                <div>
                  <h2 className="font-bold text-sm" style={{ color: HQ.INK, margin: 0 }}>الاختبارات الشفهية والتلاوات المسجلة</h2>
                  <p className="text-xs" style={{ color: HQ.MUTED, margin: 0 }}>مراجعة تسجيلات الطلاب واعتماد الدرجات ونقاط الضعف</p>
                </div>
              </div>
              <span style={{
                display: 'inline-flex', alignItems: 'center', padding: '4px 14px', borderRadius: 9999,
                background: pendingExams.length > 0 ? '#E2EFE7' : HQ.PAPER,
                color: pendingExams.length > 0 ? '#0F5940' : HQ.MUTED,
                fontSize: '0.8125rem', fontWeight: 800,
              }}>
                {pendingExams.length} بانتظار التصحيح
              </span>
            </div>
          )}
          {/* ─── TAB 2: Oral Exam Reviews ─── */}
          {activeTab === 'oral_exams' && (
            isLoadingExams ? (
              <div className="flex justify-center py-16"><LoadingSpinner size="lg" /></div>
            ) : pendingExams.length === 0 ? (
              <div style={emptyBox}>
                <CheckCircle size={52} color={HQ.MENTOR} style={{ margin: '0 auto 12px' }} aria-hidden />
                <p className="font-bold" style={{ color: HQ.MUTED, margin: 0 }}>لا توجد اختبارات شفهية بانتظار التصحيح حالياً</p>
              </div>
            ) : (
              <div>
                <div className="space-y-4">
                  {pendingExamsPagination.paginatedItems.map((result) => (
                  <div key={result._id} className="overflow-hidden p-5" style={panel}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <span aria-hidden className="avatar-circle"
                          style={{
                            width: 40, height: 40, fontSize: 14, flex: 'none',
                            backgroundColor: getAvatarColor(`${result.student?.firstName}${result.student?.lastName}`),
                          }}>
                          {getInitials(result.student?.firstName, result.student?.lastName)}
                        </span>
                        <div className="min-w-0">
                          <h3 className="font-bold" style={{ color: HQ.INK, margin: 0 }}>{result.student?.firstName} {result.student?.lastName}</h3>
                          <p className="text-xs" style={{ color: HQ.MUTED, margin: 0, fontVariantNumeric: 'tabular-nums' }}>
                            التحريري: {result.writtenPercentage || 0}% · {formatDateAr(result.createdAt)}
                          </p>
                        </div>
                      </div>
                      <button type="button" onClick={() => setReviewingExamId(reviewingExamId === result._id ? null : result._id)}
                        style={{ ...primaryBtn, minHeight: 44, fontSize: '0.8125rem', flex: 'none' }}>
                        <Star size={15} aria-hidden /> {reviewingExamId === result._id ? 'إخفاء' : 'تصحيح شفهي'}
                      </button>
                    </div>

                    {/* Written Answers Breakdown */}
                    {result.writtenAnswers?.length > 0 && result.exam?.questions?.length > 0 && (
                      <div className="mt-4 pt-3 space-y-2" style={{ borderTop: `1px solid ${HQ.LINE}` }}>
                        <p className="text-xs font-bold flex items-center gap-1.5 mb-2" style={{ color: HQ.MUTED }}>
                          <FileText size={14} color={HQ.MENTOR} aria-hidden />
                          نتائج الأسئلة التحريرية ({result.writtenAnswers.filter(a => a.isCorrect).length}/{result.writtenAnswers.length} صحيحة — {result.writtenPercentage || 0}%):
                        </p>
                        <div className="space-y-1.5">
                          {result.writtenAnswers.map((ans, idx) => {
                            const q = result.exam.questions[idx];
                            if (!q || q.type === 'recitation') return null;
                            return (
                              <div key={idx} className="rounded-lg p-2.5 flex items-start gap-2" style={{ background: ans.isCorrect ? '#E2EFE7' : '#FEF2F2', border: `1px solid ${ans.isCorrect ? '#177B58' : '#EF4444'}22` }}>
                                <span style={{ color: ans.isCorrect ? '#177B58' : '#EF4444', marginTop: 2, flexShrink: 0 }}>
                                  {ans.isCorrect ? <Check size={14} /> : <X size={14} />}
                                </span>
                                <div className="min-w-0 flex-1">
                                  <p className="text-xs font-bold" style={{ color: HQ.INK, margin: 0 }}>
                                    س{idx + 1}: {q.text || q.arabicText || '—'}
                                  </p>
                                  <p className="text-xs mt-0.5" style={{ color: HQ.MUTED, margin: 0 }}>
                                    {q.type === 'mcq' && `الإجابة: ${q.options?.[ans.selectedAnswer] ?? '—'} | الصحيحة: ${q.options?.[q.correctAnswer] ?? '—'}`}
                                    {q.type === 'true_false' && `الإجابة: ${ans.selectedAnswer === true ? 'صحيح' : ans.selectedAnswer === false ? 'خطأ' : '—'} | الصحيحة: ${q.correctAnswerBool ? 'صحيح' : 'خطأ'}`}
                                    {q.type === 'written' && `الإجابة: ${ans.writtenAnswer || '—'}`}
                                  </p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Oral recordings from ExamResult */}
                    {result.oralRecordings?.length > 0 && (
                      <div className="mt-4 pt-3 space-y-3" style={{ borderTop: `1px solid ${HQ.LINE}` }}>
                        <p className="text-xs font-bold flex items-center gap-1.5" style={{ color: HQ.MUTED }}>
                          <Volume2 size={14} color={HQ.MENTOR} aria-hidden />
                          التسجيلات الصوتية المرفوعة من الطالب ({result.oralRecordings.length} تلاوة):
                        </p>
                        {result.oralRecordings.map((rec, j) => {
                          const taskData = result.exam?.oralTasks?.[j];
                          // Try to find the matching recitation question if no oralTask exists
                          const recitationQ = !taskData ? result.exam?.questions?.filter(q => q.type === 'recitation')?.[j] : null;
                          return (
                            <div key={j} className="rounded-xl p-3 space-y-2" style={{ background: HQ.PAPER }}>
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-xs font-bold px-2.5 py-1 rounded-full"
                                  style={{ background: '#E2EFE7', color: '#0F5940' }}>
                                  مهمة {j + 1}: {taskData?.instruction || recitationQ?.instruction || recitationQ?.text || `تلاوة رقم ${j + 1}`}
                                </span>
                              </div>
                              {(taskData?.arabicText || recitationQ?.arabicText) && (
                                <p className="text-sm font-semibold p-2.5 rounded-lg border leading-relaxed" style={{ background: '#fff', borderColor: HQ.LINE, color: '#177B58', direction: 'rtl' }}>
                                  {taskData?.arabicText || recitationQ?.arabicText}
                                </p>
                              )}
                              <audio src={rec.audioUrl} controls className="w-full" style={{ height: 36 }} />
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {reviewingExamId === result._id && (
                      <div className="mt-4 pt-4 space-y-4 rounded-2xl p-4" style={{ borderTop: `1px solid ${HQ.LINE}`, background: HQ.PAPER }}>
                        <div>
                          <label htmlFor={`oral-score-${result._id}`} className="text-xs font-bold mb-1 block" style={{ color: HQ.INK }}>الدرجة الشفهية (من 100)</label>
                          <input id={`oral-score-${result._id}`} type="number" min={0} max={100} value={examScores[result._id] || ''}
                            onChange={e => setExamScores(p => ({ ...p, [result._id]: e.target.value }))}
                            className="text-sm w-36 focus:border-[#177B58] focus:outline-none"
                            style={{ ...field, fontVariantNumeric: 'tabular-nums' }} placeholder="0-100" />
                        </div>
                        {(result.exam?.type === 'placement' || result.examType === 'placement') && (
                          <div>
                            <label htmlFor={`oral-level-${result._id}`} className="text-xs font-bold mb-1 block" style={{ color: HQ.INK }}>
                              المستوى النهائي (تأكيد أو تصحيح المستوى المبدئي)
                            </label>
                            <select id={`oral-level-${result._id}`}
                              value={examLevels[result._id] || ''}
                              onChange={e => setExamLevels(p => ({ ...p, [result._id]: e.target.value }))}
                              className="text-sm focus:border-[#177B58] focus:outline-none" style={{ ...field, minHeight: 44 }}>
                              <option value="">إبقاء المستوى الحالي ({result.student?.assignedLevel
                                ? ({ foundation: 'التأسيس', memorization: 'التحفيظ', teacher_prep: 'إعداد معلم', senior: 'كبار السن' }[result.student.assignedLevel] || result.student.assignedLevel)
                                : 'غير محدد'})</option>
                              <option value="foundation">التأسيس</option>
                              <option value="memorization">التحفيظ</option>
                              <option value="teacher_prep">إعداد معلم</option>
                              <option value="senior">كبار السن</option>
                            </select>
                          </div>
                        )}
                        <div>
                          <label htmlFor={`oral-notes-${result._id}`} className="text-xs font-bold mb-1 block" style={{ color: HQ.INK }}>توجيهات وملاحظات للطالب</label>
                          <textarea id={`oral-notes-${result._id}`} value={examNotes[result._id] || ''} onChange={e => setExamNotes(p => ({ ...p, [result._id]: e.target.value }))}
                            className="text-sm resize-none focus:border-[#177B58] focus:outline-none" style={{ ...field, minHeight: 80 }}
                            placeholder="أدخل الملاحظات والتصويبات..." />
                        </div>

                        {/* Admin approval checkbox */}
                        {isAdmin && !result.student?.isApproved && (
                          <label className="flex items-center gap-2.5 p-3 rounded-xl cursor-pointer" style={{ background: '#E2EFE7', border: '1px solid #177B58' }}>
                            <input
                              type="checkbox"
                              checked={examApprovals[result._id] !== false}
                              onChange={e => setExamApprovals(p => ({ ...p, [result._id]: e.target.checked }))}
                              className="w-4 h-4 text-[#177B58] rounded"
                            />
                            <span className="text-xs font-extrabold" style={{ color: '#0F5940' }}>
                              الموافقة على قبول وتفعيل حساب الطالب فور اعتماد النتيجة
                            </span>
                          </label>
                        )}

                        {/* Weak Point Flagging Box */}
                        <div className="p-3.5 rounded-xl space-y-3" style={{ background: HQ.SURFACE, border: `1px solid ${HQ.LINE}` }}>
                          <p className="text-xs font-bold flex items-center gap-1.5" style={{ color: HQ.INK, margin: 0 }}>
                            <Pin size={14} color={HQ.MENTOR} aria-hidden />
                            إضافة إلى بنك نقاط الضعف والمراجعة لدى الطالب (اختياري):
                          </p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                            <div>
                              <label htmlFor={`flag-surah-${result._id}`} className="font-bold mb-1 block" style={{ color: HQ.MUTED }}>السورة</label>
                              <select
                                id={`flag-surah-${result._id}`}
                                value={flaggedVerseForms[result._id]?.surahNumber || ''}
                                onChange={e => setFlaggedVerseForms(p => ({ ...p, [result._id]: { ...p[result._id], surahNumber: e.target.value } }))}
                                className="text-sm focus:border-[#177B58] focus:outline-none" style={{ ...field, minHeight: 44 }}>
                                <option value="">اختر السورة...</option>
                                {QURAN_SURAHS.map(s => (
                                  <option key={s.number} value={s.number}>{s.number}. {s.name}</option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label htmlFor={`flag-verse-${result._id}`} className="font-bold mb-1 block" style={{ color: HQ.MUTED }}>رقم الآية</label>
                              <input
                                id={`flag-verse-${result._id}`}
                                type="number"
                                min={1}
                                value={flaggedVerseForms[result._id]?.verseNumber || ''}
                                onChange={e => setFlaggedVerseForms(p => ({ ...p, [result._id]: { ...p[result._id], verseNumber: e.target.value } }))}
                                className="text-sm focus:border-[#177B58] focus:outline-none"
                                style={{ ...field, minHeight: 44, fontVariantNumeric: 'tabular-nums' }}
                                placeholder="رقم الآية"
                              />
                            </div>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                            <div>
                              <label htmlFor={`flag-type-${result._id}`} className="font-bold mb-1 block" style={{ color: HQ.MUTED }}>نوع الخطأ</label>
                              <select
                                id={`flag-type-${result._id}`}
                                value={flaggedVerseForms[result._id]?.errorType || 'hifz'}
                                onChange={e => setFlaggedVerseForms(p => ({ ...p, [result._id]: { ...p[result._id], errorType: e.target.value } }))}
                                className="text-sm focus:border-[#177B58] focus:outline-none" style={{ ...field, minHeight: 44 }}>
                                <option value="hifz">خطأ في الحفظ والنسيان</option>
                                <option value="tajweed">ملاحظة تجويدية</option>
                                <option value="tashkeel">خطأ في التشكيل والضبط</option>
                              </select>
                            </div>
                            <div>
                              <label htmlFor={`flag-note-${result._id}`} className="font-bold mb-1 block" style={{ color: HQ.MUTED }}>تنبيه خاص بالآية</label>
                              <input
                                id={`flag-note-${result._id}`}
                                type="text"
                                value={flaggedVerseForms[result._id]?.notes || ''}
                                onChange={e => setFlaggedVerseForms(p => ({ ...p, [result._id]: { ...p[result._id], notes: e.target.value } }))}
                                className="text-sm focus:border-[#177B58] focus:outline-none" style={{ ...field, minHeight: 44 }}
                                placeholder="مثل: إظهار الإخفاء هنا"
                              />
                            </div>
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <button type="button" onClick={() => handleReviewExam(result._id)} disabled={submittingExam}
                            style={{ ...primaryBtn, flex: 1, opacity: submittingExam ? 0.6 : 1 }}>
                            {submittingExam ? <LoadingSpinner size="sm" color="white" /> : 'حفظ التقييم الشفهي وإرسال التنبيهات'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <Pagination
                currentPage={pendingExamsPagination.currentPage}
                totalPages={pendingExamsPagination.totalPages}
                totalItems={pendingExamsPagination.totalItems}
                pageSize={pendingExamsPagination.pageSize}
                onPageChange={pendingExamsPagination.setCurrentPage}
                onPageSizeChange={pendingExamsPagination.setPageSize}
                showPageSize={true}
                pageSizeOptions={[3, 5, 10, 20]}
                itemName="اختبار شفهي"
                className="mt-6"
              />
            </div>
          )
        )}

          {/* ─── TAB 3: Recordings (Teachers only) ─── */}
          {!isAdmin && activeTab === 'recordings' && (
            isLoadingRecordings ? (
              <div className="flex justify-center py-16"><LoadingSpinner size="lg" /></div>
            ) : (
              <div style={panel} className="overflow-hidden">
                {recordings.length === 0 ? (
                  <p className="py-8 text-center font-bold" style={{ color: HQ.MUTED, margin: 0 }}>لا توجد تسجيلات مرفوعة بعد</p>
                ) : (
                  <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                    {recordingsPagination.paginatedItems.map((rec, i) => (
                      <li key={rec._id} style={{ padding: '12px 0', borderTop: i === 0 ? 'none' : `1px solid ${HQ.LINE}` }}>
                        <div className="flex items-center justify-between gap-3 flex-wrap">
                          <div className="min-w-0">
                            <p className="font-bold" style={{ color: HQ.INK, margin: 0 }}>{rec.session?.title || 'جلسة مباشرة'}</p>
                            <p className="text-sm" style={{ color: HQ.MUTED, margin: 0 }}>
                              {rec.session?.scheduledAt ? formatDateAr(rec.session.scheduledAt, 'dd MMMM yyyy') : '--'}
                            </p>
                          </div>
                          <div className="flex items-center gap-3 flex-none">
                            <a href={rec.url} target="_blank" rel="noopener noreferrer"
                              className="font-bold flex items-center gap-1"
                              style={{ color: HQ.MENTOR, fontSize: 14, minHeight: 44, display: 'inline-flex', alignItems: 'center' }}>
                              <LinkIcon size={15} aria-hidden /> مشاهدة التسجيل
                            </a>
                            <span className="text-xs font-bold px-2.5 py-1 flex items-center gap-1"
                              style={{ background: '#E2EFE7', color: '#0F5940', borderRadius: 8 }}>
                              <ShieldCheck size={13} aria-hidden /> منشور للطلاب
                            </span>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}

                <div className="pt-4 mt-4" style={{ borderTop: `1px solid ${HQ.LINE}` }}>
                  <Pagination
                    currentPage={recordingsPagination.currentPage}
                    totalPages={recordingsPagination.totalPages}
                    totalItems={recordingsPagination.totalItems}
                    pageSize={recordingsPagination.pageSize}
                    onPageChange={recordingsPagination.setCurrentPage}
                    onPageSizeChange={recordingsPagination.setPageSize}
                    showPageSize={true}
                    pageSizeOptions={[4, 8, 16, 32]}
                    itemName="تسجيل"
                  />
                </div>
              </div>
            )
          )}

        {/* ─── Modals ─── */}
        <AnimatePresence>
          {showAddRecordingModal && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(42,36,56,0.55)' }}>
              <div className="w-full" role="dialog" aria-modal="true" aria-label="إضافة تسجيل جلسة"
                style={{ ...panel, maxWidth: 560, maxHeight: '90dvh', overflowY: 'auto' }}>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-extrabold" style={{ fontSize: '1.25rem', color: HQ.INK, margin: 0 }}>إضافة تسجيل جلسة</h2>
                  <button type="button" onClick={() => setShowAddRecordingModal(false)} aria-label="إغلاق" style={iconBtn}>
                    <X size={19} aria-hidden />
                  </button>
                </div>
                <div className="space-y-3">
                  <div>
                    <label htmlFor="rec-session" className="text-xs font-bold mb-1 block" style={{ color: HQ.INK }}>الجلسة المنتهية *</label>
                    <select id="rec-session" value={addRecordingForm.sessionId} onChange={e => setAddRecordingForm(p => ({ ...p, sessionId: e.target.value }))}
                      className="text-sm focus:border-[#177B58] focus:outline-none" style={field}>
                      <option value="">— اختر الجلسة —</option>
                      {sessionsWithoutRecording.map(s => <option key={s._id} value={s._id}>{s.title} ({s.groupName})</option>)}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="rec-url" className="text-xs font-bold mb-1 block" style={{ color: HQ.INK }}>رابط التسجيل (Youtube, Drive, Zoom) *</label>
                    <input id="rec-url" type="url" value={addRecordingForm.url} onChange={e => setAddRecordingForm(p => ({ ...p, url: e.target.value }))}
                      placeholder="https://..." className="text-sm focus:border-[#177B58] focus:outline-none"
                      style={{ ...field, direction: 'ltr', textAlign: 'left' }} dir="ltr" />
                  </div>
                </div>
                <div className="flex gap-2 mt-5">
                  <button type="button" onClick={() => setShowAddRecordingModal(false)} style={{ ...ghostBtn, flex: 1 }}>إلغاء</button>
                  <button type="button" onClick={handleSaveRecording} disabled={savingRecording || !addRecordingForm.sessionId || !addRecordingForm.url}
                    style={{ ...primaryBtn, flex: 1, opacity: (savingRecording || !addRecordingForm.sessionId || !addRecordingForm.url) ? 0.55 : 1 }}>
                    {savingRecording ? <LoadingSpinner size="sm" color="white" /> : 'نشر الفيديو'}
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        </div>
      </PageLayout>
    </MotionConfig>
  );
}
