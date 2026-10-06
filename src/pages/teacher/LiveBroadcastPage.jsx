import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  PhoneOff, UserCheck, BookOpen,
  MessageSquare, X, ClipboardList, Award
} from 'lucide-react';
import toast from 'react-hot-toast';
import Navbar from '../../components/shared/Navbar';
import JitsiMeeting from '../../components/shared/JitsiMeeting';
import LiveAttendanceDrawer from '../../components/shared/LiveAttendanceDrawer';
import useAuthStore from '../../store/authStore';
import useLiveStore from '../../store/liveStore';
import api from '../../services/api';
import { formatCountdown } from '../../utils/helpers';
import ConfirmModal from '../../components/shared/ConfirmModal';
import WirdAssignModal from '../../components/shared/WirdAssignModal';
import PreviousWirdModal from '../../components/shared/PreviousWirdModal';
import RecitationEvalModal from '../../components/shared/RecitationEvalModal';
import MushafSharePanel from '../../components/shared/MushafSharePanel';
import LoadingSpinner from '../../components/shared/LoadingSpinner';
import '../../components/halaqa/halaqa.css';
import { HQ } from '../../components/halaqa/primitives';

/* غرفة البث الفردي — النظام فردي بالكامل: بث 1-on-1 مع طالب واحد.
   تُفتح فقط من زر "بدء بث مباشر" (ينشئ الجلسة والدرس ثم يمرر البيانات). */

export default function LiveBroadcastPage() {
  const { user } = useAuthStore();
  const location = useLocation();
  const navigate = useNavigate();
  const {
    isBroadcasting,
    setIsBroadcasting,
    resetLive,
  } = useLiveStore();

  const [sessionTitle, setSessionTitle] = useState('');
  const [showAttendanceDrawer, setShowAttendanceDrawer] = useState(false);
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [duration, setDuration] = useState(0);
  const [session, setSession] = useState(null);
  const [loadingSession, setLoadingSession] = useState(true);

  // Individual 1-on-1 state (passed from the start-live action)
  const studentId = location.state?.studentId;
  const studentName = location.state?.studentName;
  const indLessonId = location.state?.lessonId;

  // Edit created lesson modal state
  const [showEditLessonModal, setShowEditLessonModal] = useState(false);
  const [lessonForm, setLessonForm] = useState({
    title: '',
    description: '',
    videoUrl: '',
    resources: '',
    exam: '',
  });
  const [availableExams, setAvailableExams] = useState([]);
  const [savingLesson, setSavingLesson] = useState(false);

  // Wird assignment during live (shared modal)
  const [showWirdModal, setShowWirdModal] = useState(false);
  // Previous wird (required recitation) + recitation evaluation
  const [showPrevWirdModal, setShowPrevWirdModal] = useState(false);
  const [showEvalModal, setShowEvalModal] = useState(false);

  // Shared mushaf (teacher-driven, student polls over HTTP)
  const [showMushaf, setShowMushaf] = useState(false);
  const [mushafSharing, setMushafSharing] = useState(false);
  const [mushafRange, setMushafRange] = useState(null);
  const [savingMushaf, setSavingMushaf] = useState(false);

  useEffect(() => {
    api.get('/exams/admin/all').then(res => {
      setAvailableExams(res.data?.exams || []);
    }).catch(() => {});
  }, []);

  // Guard: entry requires an individual live session created beforehand
  useEffect(() => {
    const { sessionId, studentId: sId, studentName: sName, lessonTitle, lessonId } = location.state || {};
    if (!sId || !sessionId) {
      toast.error('ابدأ البث من زر "بدء بث مباشر" بجانب الطالب');
      navigate(user?.role === 'teacher' ? '/teacher' : '/admin/users', { replace: true });
      return;
    }

    setSessionTitle(lessonTitle || `جلسة تلاوة وبث مباشر مع ${sName || 'الطالب'}`);
    setLessonForm(p => ({
      ...p,
      title: lessonTitle || `جلسة تلاوة وبث مباشر مع ${sName || 'الطالب'}`,
    }));

    api.get(`/live/${sessionId}`).then(res => {
      if (res.data?.session) {
        setSession(res.data.session);
        setIsBroadcasting(true);
        // No socket room join — state is HTTP polling (Vercel-safe)
      } else {
        toast.error('تعذر العثور على الجلسة');
        navigate(user?.role === 'teacher' ? '/teacher' : '/admin/users', { replace: true });
      }
    }).catch(() => {
      toast.error('تعذر الاتصال بالجلسة');
      navigate(user?.role === 'teacher' ? '/teacher' : '/admin/users', { replace: true });
    }).finally(() => {
      setLoadingSession(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state]);

  useEffect(() => {
    if (isBroadcasting) {
      const timer = setInterval(() => setDuration(d => d + 1), 1000);
      return () => clearInterval(timer);
    }
  }, [isBroadcasting]);

  const handleEndBroadcast = () => {
    setShowEndConfirm(true);
  };

  const confirmEndBroadcast = async () => {
    setShowEndConfirm(false);
    // PUT /end persists status=ended; students detect via polling (no socket emit needed)
    if (session?._id) {
      await api.put(`/live/${session._id}/end`, {}).catch(() => {});
    }
    setIsBroadcasting(false);
    resetLive();
    toast.success('انتهى البث المباشر');

    if (indLessonId) {
      setShowEditLessonModal(true);
    } else {
      setSession(null);
      setDuration(0);
    }
  };

  const handleSaveLesson = async () => {
    const lId = indLessonId;
    if (!studentId || !lId) {
      toast.error('بيانات الدرس غير مكتملة');
      return;
    }
    setSavingLesson(true);
    try {
      await api.put(`/study-plans/student/${studentId}/lessons/${lId}`, lessonForm);
      toast.success('تم حفظ وتعديل بيانات الدرس وإتاحته للطالب بنجاح ✅');
      setShowEditLessonModal(false);
      navigate(user?.role === 'teacher' ? '/teacher' : '/admin/users');
    } catch (err) {
      toast.error(err?.response?.data?.message || 'خطأ في حفظ الدرس');
    } finally {
      setSavingLesson(false);
    }
  };

  const handleOpenDiscussion = () => {
    const lId = indLessonId;
    if (!lId) { toast.error('لا يوجد درس مرتبط للمناقشة'); return; }
    const base = user?.role === 'admin' ? '/admin' : user?.role === 'teacher' ? '/teacher' : '/student';
    navigate(`${base}/lessons/${lId}/discussion`);
  };

  // إعطاء ورد للطالب أثناء البث — يظهر له في "المطلوب مني" (النافذة مشتركة)
  const openWirdModal = () => {
    if (!studentId) { toast.error('لا يوجد طالب مرتبط بالجلسة'); return; }
    setShowWirdModal(true);
  };

  // المصحف المشترك: فتح اللوحة مع جلب الحالة الحالية
  const openMushaf = async () => {
    if (!session?._id) { toast.error('لا توجد جلسة نشطة'); return; }
    setShowMushaf(true);
    try {
      const res = await api.get(`/live/${session._id}/mushaf`);
      const m = res.data?.sharedMushaf;
      if (m) {
        setMushafSharing(Boolean(m.sharing));
        if (m.surah) setMushafRange({ surah: m.surah, from: m.fromVerse || 1, to: m.toVerse || m.fromVerse || 7 });
      }
    } catch (_) {}
  };

  const pushMushaf = async (payload) => {
    if (!session?._id) return;
    setSavingMushaf(true);
    try {
      const res = await api.put(`/live/${session._id}/mushaf`, payload);
      const m = res.data?.sharedMushaf;
      if (m) {
        setMushafSharing(Boolean(m.sharing));
        if (m.surah) setMushafRange({ surah: m.surah, from: m.fromVerse || 1, to: m.toVerse || m.fromVerse || 7 });
      }
      return true;
    } catch (err) {
      toast.error(err?.response?.data?.message || 'تعذر حفظ المشاركة');
      return false;
    } finally {
      setSavingMushaf(false);
    }
  };

  const handleToggleMushafShare = async () => {
    const r = mushafRange || { surah: 1, from: 1, to: 7 };
    const ok = await pushMushaf({ sharing: !mushafSharing, surah: r.surah, fromVerse: r.from, toVerse: r.to });
    if (ok) toast.success(!mushafSharing ? 'يشارك الطالب المصحف الآن' : 'توقفت مشاركة المصحف');
  };

  const handleMushafNavigate = (r) => {
    pushMushaf({ sharing: mushafSharing, surah: r.surah, fromVerse: r.from, toVerse: r.to });
  };

  // Loading state while joining the session
  if (!isBroadcasting) {
    return (
      <div className="halaqa" style={{ minHeight: '100vh', background: HQ.PAPER }}>
        <Navbar />
        <div style={{ paddingTop: 64, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ textAlign: 'center' }}>
            <div className="hq-skeleton" style={{ width: 40, height: 40, borderRadius: 9999, margin: '0 auto 16px' }} />
            <p style={{ color: HQ.MUTED, fontSize: 14, fontWeight: 700 }}>
              {loadingSession ? 'جارٍ الانضمام لغرفة البث...' : 'جارٍ التحضير...'}
            </p>
          </div>
        </div>


      {/* Edit Created Lesson Modal (after broadcast ends) */}
        {showEditLessonModal && (
          <LessonEditModal
            studentName={studentName}
            lessonForm={lessonForm}
            setLessonForm={setLessonForm}
            availableExams={availableExams}
            savingLesson={savingLesson}
            onClose={() => {
              setShowEditLessonModal(false);
              navigate(user?.role === 'teacher' ? '/teacher' : '/admin/users');
            }}
            onSave={handleSaveLesson}
            onOpenDiscussion={handleOpenDiscussion}
          />
        )}
      </div>
    );
  }

  // Live broadcast view with Jitsi Meet
  return (
    <div className="halaqa" dir="rtl" style={{ height: '100vh', maxHeight: '100dvh', background: HQ.PAPER, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Top bar — paper chrome, the stage below is the only dark area */}
      <div style={{ background: HQ.SURFACE, borderBottom: `1px solid ${HQ.LINE}`, padding: '0 16px', height: 56, flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#C2410C', color: '#fff', padding: '6px 12px', borderRadius: 12, fontSize: 13, fontWeight: 800, flex: 'none' }}>
            <span className="hq-live-dot" aria-hidden />
            بث مباشر
          </span>
          <h1 style={{ color: HQ.INK, fontWeight: 800, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} className="hidden sm:block">{sessionTitle}</h1>
          {studentName && (
            <span className="hidden md:inline-flex" style={{ alignItems: 'center', gap: 4, fontSize: 12, background: '#E2EFE7', color: HQ.MENTOR, padding: '4px 10px', borderRadius: 9999, fontWeight: 700 }}>
              <BookOpen size={12} />
              {studentName}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 'none' }}>
          <span style={{ color: HQ.MUTED, fontSize: 13, fontWeight: 700 }} className="hidden sm:inline">{formatCountdown(duration)}</span>

          {/* Attendance Button */}
          <button
            onClick={() => setShowAttendanceDrawer(true)}
            className="hq-action"
            style={{ background: HQ.PAPER, border: `1px solid ${HQ.LINE}`, color: HQ.INK, padding: '0 14px', fontSize: 13 }}
            title="الحضور"
          >
            <UserCheck size={16} />
            <span className="hidden sm:inline">الحضور</span>
          </button>

          {/* Wird Button */}
          <button
            onClick={openWirdModal}
            className="hq-action"
            style={{ background: HQ.MENTOR, color: '#fff', padding: '0 14px', fontSize: 13 }}
            title="إعطاء ورد للطالب أثناء البث"
          >
            <BookOpen size={16} />
            <span className="hidden sm:inline">الورد</span>
          </button>

          {/* Required recitation (previous wird) Button */}
          <button
            onClick={() => {
              if (!studentId) { toast.error('لا يوجد طالب مرتبط بالجلسة'); return; }
              setShowPrevWirdModal(true);
            }}
            className="hq-action"
            style={{ background: HQ.PAPER, border: `1px solid ${HQ.LINE}`, color: HQ.INK, padding: '0 14px', fontSize: 13 }}
            title="الورد المطلوب تسميعه — آخر ورد أُسند قبل اليوم"
          >
            <ClipboardList size={16} />
            <span className="hidden sm:inline">المطلوب تسميعه</span>
          </button>

          {/* Recitation evaluation Button */}
          <button
            onClick={() => {
              if (!studentId) { toast.error('لا يوجد طالب مرتبط بالجلسة'); return; }
              setShowEvalModal(true);
            }}
            className="hq-action"
            style={{ background: '#F8EDD3', border: '1px solid #D9A441', color: '#7C5A12', padding: '0 14px', fontSize: 13 }}
            title="تقييم تسميع الطالب ووضع ملاحظات تظهر في التقارير"
          >
            <Award size={16} />
            <span className="hidden sm:inline">تقييم التسميع</span>
          </button>

          {/* Shared mushaf Button */}
          <button
            onClick={openMushaf}
            className="hq-action"
            style={{ background: mushafSharing ? HQ.MENTOR : HQ.PAPER, color: mushafSharing ? '#fff' : HQ.INK, border: mushafSharing ? 'none' : `1px solid ${HQ.LINE}`, padding: '0 14px', fontSize: 13 }}
            title="المصحف المشترك مع الطالب"
          >
            <BookOpen size={16} />
            <span className="hidden sm:inline">المصحف{mushafSharing ? ' • مشارَك' : ''}</span>
          </button>

          <button
            onClick={handleEndBroadcast}
            className="hq-action"
            style={{ background: '#C2410C', color: '#fff', padding: '0 14px', fontSize: 13 }}
          >
            <PhoneOff size={16} />
            <span className="hidden sm:inline">إنهاء البث</span>
          </button>
        </div>
      </div>

      {/* Jitsi Meeting Container — the dark stage */}
      <div className="m-stage" style={{ flex: 1, minHeight: 0, padding: 16, paddingTop: 8 }}>
        <div className="halaqa-stage" style={{ height: '100%', borderRadius: 18, overflow: 'hidden', position: 'relative' }}>
          <JitsiMeeting
            roomName={session?.liveRoomName || `QuranPlatform_${session?._id || 'Session'}`}
            displayName={`أ. ${user?.firstName || ''} ${user?.lastName || ''}`}
            userEmail={user?.email || ''}
            isTeacher={true}
            onLeave={handleEndBroadcast}
          />
        </div>
      </div>

      {/* Live Attendance */}
      <LiveAttendanceDrawer
        isOpen={showAttendanceDrawer}
        onClose={() => setShowAttendanceDrawer(false)}
        sessionId={session?._id}
        sessionTitle={sessionTitle}
        singleStudentId={studentId}
        singleStudentName={studentName}
      />

      {/* End broadcast confirm */}
      <ConfirmModal
        open={showEndConfirm}
        title="إنهاء البث المباشر؟"
        message="سيخرج الطالب من الغرفة وتنتهي الجلسة الحالية."
        confirmLabel="إنهاء البث"
        danger
        onConfirm={confirmEndBroadcast}
        onClose={() => setShowEndConfirm(false)}
      />

      {/* Wird assignment (shared modal) */}
      <WirdAssignModal
        open={showWirdModal}
        studentId={studentId}
        studentName={studentName}
        onClose={() => setShowWirdModal(false)}
      />

      {/* Required recitation: previous wird (read-only) */}
      <PreviousWirdModal
        open={showPrevWirdModal}
        studentId={studentId}
        studentName={studentName}
        onClose={() => setShowPrevWirdModal(false)}
      />

      {/* Recitation evaluation + notes (visible in reports & parent) */}
      <RecitationEvalModal
        open={showEvalModal}
        studentId={studentId}
        studentName={studentName}
        onClose={() => setShowEvalModal(false)}
      />

      {/* Shared mushaf overlay sheet */}
      {showMushaf && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9995, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', background: 'rgba(12,12,29,0.55)' }}>
          <div className="halaqa" dir="rtl" style={{
            background: HQ.SURFACE, borderRadius: '20px 20px 0 0', padding: 16,
            width: '100%', maxWidth: 720, height: '82dvh', maxHeight: 640,
            border: `1px solid ${HQ.LINE}`, borderBottom: 'none',
          }}>
            <MushafSharePanel
              interactive
              range={mushafRange}
              sharing={mushafSharing}
              onToggleShare={handleToggleMushafShare}
              onNavigate={handleMushafNavigate}
              onClose={() => setShowMushaf(false)}
              title={`المصحف — ${studentName || 'الطالب'}`}
            />
          </div>
        </div>
      )}

      {/* Edit Created Lesson Modal (after broadcast ends) */}
      {showEditLessonModal && (
        <LessonEditModal
          studentName={studentName}
          lessonForm={lessonForm}
          setLessonForm={setLessonForm}
          availableExams={availableExams}
          savingLesson={savingLesson}
          onClose={() => {
            setShowEditLessonModal(false);
            navigate(user?.role === 'teacher' ? '/teacher' : '/admin/users');
          }}
          onSave={handleSaveLesson}
          onOpenDiscussion={handleOpenDiscussion}
        />
      )}
    </div>
  );
}

function LessonEditModal({ studentName, lessonForm, setLessonForm, availableExams, savingLesson, onClose, onSave, onOpenDiscussion }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: HQ.SURFACE, borderRadius: 20, padding: 24, maxWidth: 580, width: '100%', border: `1px solid ${HQ.LINE}`, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 12px 36px rgba(0,0,0,0.25)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <h3 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 900, color: HQ.INK }}>
              تعديل الدرس المُنْشأ من البث المباشر
            </h3>
            <p style={{ margin: 0, fontSize: 13, color: HQ.MUTED }}>
              تم إنشاء هذا الدرس تلقائياً في قائمة منهج الطالب <strong>{studentName || ''}</strong>. يمكنك الآن إضافة التسجيل والمصادر والاختبارات.
            </p>
          </div>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: HQ.MUTED }}>
            <X size={20} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Lesson Title */}
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 800, color: HQ.INK, marginBottom: 4 }}>
              عنوان الدرس
            </label>
            <input
              type="text"
              value={lessonForm.title}
              onChange={e => setLessonForm(p => ({ ...p, title: e.target.value }))}
              style={{ width: '100%', padding: '10px 14px', borderRadius: 12, border: `1px solid ${HQ.LINE}`, background: HQ.PAPER, fontSize: 14, color: HQ.INK }}
              placeholder="مثال: جلسة تلاوة سورة البقرة وأحكام المد"
            />
          </div>

          {/* Description & Notes */}
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 800, color: HQ.INK, marginBottom: 4 }}>
              ملاحظات وتوجيهات الجلسة
            </label>
            <textarea
              value={lessonForm.description}
              onChange={e => setLessonForm(p => ({ ...p, description: e.target.value }))}
              rows={3}
              style={{ width: '100%', padding: '10px 14px', borderRadius: 12, border: `1px solid ${HQ.LINE}`, background: HQ.PAPER, fontSize: 14, color: HQ.INK, resize: 'vertical' }}
              placeholder="اكتب توجيهاتك للطالب بناءً على ما تم في جلسة البث..."
            />
          </div>

          {/* Video URL */}
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 800, color: HQ.INK, marginBottom: 4 }}>
              رابط تسجيل الفيديو (يوتيوب أو رابط مباشر)
            </label>
            <input
              type="url"
              value={lessonForm.videoUrl}
              onChange={e => setLessonForm(p => ({ ...p, videoUrl: e.target.value }))}
              style={{ width: '100%', padding: '10px 14px', borderRadius: 12, border: `1px solid ${HQ.LINE}`, background: HQ.PAPER, fontSize: 14, color: HQ.INK, direction: 'ltr', textAlign: 'right' }}
              placeholder="https://..."
            />
          </div>

          {/* Resources URL */}
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 800, color: HQ.INK, marginBottom: 4 }}>
              ملفات ومصادر وروابط إضافية
            </label>
            <input
              type="text"
              value={lessonForm.resources}
              onChange={e => setLessonForm(p => ({ ...p, resources: e.target.value }))}
              style={{ width: '100%', padding: '10px 14px', borderRadius: 12, border: `1px solid ${HQ.LINE}`, background: HQ.PAPER, fontSize: 14, color: HQ.INK }}
              placeholder="روابط ملفات تجويد، مصحف، أو مراجع تهم الطالب"
            />
          </div>

          {/* Attach Exam */}
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 800, color: HQ.INK, marginBottom: 4 }}>
              ربط اختبار بهذا الدرس (اختياري)
            </label>
            <select
              value={lessonForm.exam}
              onChange={e => setLessonForm(p => ({ ...p, exam: e.target.value }))}
              style={{ width: '100%', padding: '10px 14px', borderRadius: 12, border: `1px solid ${HQ.LINE}`, background: HQ.PAPER, fontSize: 14, color: HQ.INK }}
            >
              <option value="">بدون اختبار</option>
              {availableExams.map(ex => (
                <option key={ex._id} value={ex._id}>{ex.title} ({ex.questions?.length || 0} سؤال)</option>
              ))}
            </select>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={onSave}
              disabled={savingLesson}
              className="hq-action"
              style={{ flex: 1, minWidth: 160, background: HQ.MENTOR, color: '#fff', fontSize: 14 }}
            >
              {savingLesson ? <LoadingSpinner size="sm" /> : 'حفظ ونشر الدرس للطالب'}
            </button>
            <button
              type="button"
              onClick={onOpenDiscussion}
              className="hq-action"
              style={{ flex: 1, minWidth: 160, background: HQ.PAPER, border: `1px solid ${HQ.LINE}`, color: HQ.INK, fontSize: 14, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
            >
              <MessageSquare size={16} color={HQ.MENTOR} /> فتح مناقشة خاصة للدرس
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
