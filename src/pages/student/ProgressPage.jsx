import { useState, useEffect, useCallback } from 'react';
import {
  BookOpen, RotateCcw,
  AlertCircle, CheckCircle2,
} from 'lucide-react';
import PageLayout from '../../components/shared/PageLayout';
import useAuthStore from '../../store/authStore';
import { getJuzPercentage, getLevelLabel, formatDateAr, timeAgoAr, getSmartDateLabel } from '../../utils/helpers';
import api from '../../services/api';
import toast from 'react-hot-toast';
import '../../components/halaqa/halaqa.css';
import { KhatmRing, RingSkeleton, NodeSkeleton, HqBadge, HQ } from '../../components/halaqa/primitives';
import JourneyNode, { HqActionLink } from '../../components/halaqa/JourneyNode';

const JUZ = Array.from({ length: 30 }, (_, i) => i + 1);

export default function ProgressPage() {
  const { user } = useAuthStore();

  const [lessons, setLessons] = useState([]);
  const [studyPlan, setStudyPlan] = useState(null);
  const [weakPoints, setWeakPoints] = useState([]);
  const [nextSession, setNextSession] = useState(null);
  const [liveNow, setLiveNow] = useState(false);
  const [hasAttendedLive, setHasAttendedLive] = useState(false);
  const [pendingExams, setPendingExams] = useState(null);
  const [juzOpen, setJuzOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);

  const myId = user?._id?.toString();

  const loadAll = useCallback(async () => {
    setLoading(true);
    setLoadFailed(false);
    let ok = 0;
    const settle = async (fn) => {
      try { await fn(); ok++; } catch (_) {}
    };
    await Promise.all([
      settle(async () => {
        const res = await api.get('/exams/weak-points/my');
        setWeakPoints(res.data.weakPoints || []);
      }),
      settle(async () => {
        // Individual plan first, group plan as legacy fallback
        const indRes = await api.get(`/study-plans/student/${user?._id}/full`).catch(() => null);
        if (indRes?.data?.plan?.customLessons) {
          setStudyPlan(indRes.data.plan);
          setLessons(indRes.data.plan.customLessons);
          return;
        }
        const groupId = user?.group?._id || user?.group;
        if (!groupId) { setStudyPlan(null); setLessons([]); return; }
        const res = await api.get(`/study-plans/group/${groupId}/full`);
        setStudyPlan(res.data.plan || null);
        setLessons(res.data.plan?.customLessons || []);
      }),
      settle(async () => {
        // My own 1-on-1 sessions history
        const res = await api.get('/live/mine').catch(() => null);
        const sessions = res?.data?.sessions || [];
        const live = sessions.find(s => s.status === 'live');
        setLiveNow(Boolean(live));
        setNextSession(live || null);
        // Real attendance: my id in attendees or in present/late records
        if (myId) {
          const attended = sessions.some(s => {
            const inAttendees = (s.attendees || []).some(a => ((a.student?._id || a.student)?.toString()) === myId);
            const inRecords = (s.attendanceRecords || []).some(r =>
              ((r.student?._id || r.student)?.toString()) === myId && (r.status === 'present' || r.status === 'late'));
            return inAttendees || inRecords;
          });
          setHasAttendedLive(attended);
        }
      }),
      settle(async () => {
        const res = await api.get('/exams/student/assigned');
        const list = res.data.exams || res.data.assignedExams || res.data || [];
        const arr = Array.isArray(list) ? list : [];
        setPendingExams(arr.filter(e => !e.isCompleted).length);
      }),
    ]);
    if (ok === 0) setLoadFailed(true);
    setLoading(false);
  }, [myId, user?._id]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const handleMarkMastered = async (id) => {
    try {
      await api.put(`/exams/weak-points/${id}`, { status: 'mastered' });
      setWeakPoints(prev => prev.map(w => (w._id === id ? { ...w, status: 'mastered' } : w)));
      toast.success('أحسنت! سُجّلت الآية كمراجَعة بنجاح');
    } catch {
      toast.error('حدث خطأ أثناء التحديث');
    }
  };

  const completedJuz = studyPlan?.quranCompletionPlan?.completedJuz || [];
  const juzPct = getJuzPercentage(completedJuz);
  const completedLessons = user?.completedLessons?.length || 0;
  const totalLessons = lessons.length;
  const curriculumPct = totalLessons ? Math.round((completedLessons / totalLessons) * 100) : 0;
  const openWeak = weakPoints.filter(w => w.status !== 'mastered');
  // Tasks counts are only trustworthy once the exams fetch resolved —
  // a 0 from a failed request must never read as "done".
  const tasksKnown = pendingExams !== null;

  /* Sequential status: the first non-completed node is current (individual system: no groups) */
  const done = {
    registration: true,
    placement: Boolean(user?.placementExamTaken),
    level: Boolean(user?.assignedLevel),
    curriculum: totalLessons > 0 && completedLessons >= totalLessons,
    live: hasAttendedLive,
    tasks: tasksKnown && pendingExams === 0,
    khatm: juzPct >= 100,
  };
  const order = ['placement', 'level', 'curriculum', 'live', 'tasks', 'khatm'];
  const currentKey = order.find(k => !done[k]);
  const st = (key) => {
    if (done[key]) return 'completed';
    if (key === currentKey) return 'current';
    if (key === 'level') return 'locked';
    return 'upcoming';
  };

  const sheet = {
    background: HQ.PAPER, border: `1px solid ${HQ.LINE}`, borderRadius: 18,
    padding: 'clamp(16px, 3vw, 32px)',
  };

  return (
    <PageLayout>
      <div className="halaqa" style={{ ...sheet, maxWidth: 820, margin: '0 auto' }}>
        {loading ? (
          <div aria-label="جارٍ تحميل رحلتك">
            <div style={{ display: 'flex', gap: 20, alignItems: 'center', marginBottom: 24, flexWrap: 'wrap' }}>
              <RingSkeleton size={150} />
              <div style={{ flex: 1, minWidth: 200 }}>
                <div className="hq-skeleton" style={{ height: 24, width: '55%', marginBottom: 10 }} />
                <div className="hq-skeleton" style={{ height: 14, width: '80%' }} />
              </div>
            </div>
            <NodeSkeleton /><NodeSkeleton /><NodeSkeleton /><NodeSkeleton />
          </div>
        ) : loadFailed ? (
          <div style={{ textAlign: 'center', padding: '48px 16px' }} role="alert">
            <AlertCircle size={40} color={HQ.MUTED} style={{ margin: '0 auto 12px' }} />
            <h1 style={{ fontSize: 24, fontWeight: 800, color: HQ.INK, margin: '0 0 8px' }}>تعذّر تحميل رحلتك</h1>
            <p style={{ color: HQ.MUTED, fontSize: 15, margin: '0 0 20px' }}>تحقق من الاتصال ثم حاول مرة أخرى — بياناتك محفوظة.</p>
            <button type="button" onClick={loadAll} className="hq-action"
              style={{ background: HQ.MENTOR, color: '#fff', padding: '0 24px', fontSize: 15 }}>
              <RotateCcw size={17} /> إعادة المحاولة
            </button>
          </div>
        ) : (
          <>
            {/* ── Journey head: greeting + the single living ring ── */}
            <header style={{ display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
              <KhatmRing pct={juzPct} done={completedJuz.length} total={30} size={168} />
              <div style={{ flex: 1, minWidth: 220 }}>
                <p style={{ margin: 0, fontSize: 14, color: HQ.MUTED }}>أين أنا في رحلتي؟</p>
                <h1 style={{ margin: '4px 0 8px', fontSize: 32, fontWeight: 800, color: HQ.INK }}>
                  أهلًا {user?.firstName || 'بك'}
                </h1>
                <HqBadge tone={user?.assignedLevel ? 'mentor' : 'neutral'}>
                  {user?.assignedLevel ? `مستواك: ${getLevelLabel(user.assignedLevel)}` : 'بانتظار تحديد المستوى'}
                </HqBadge>
              </div>
            </header>

            <div className="hq-thread" style={{ marginTop: 16 }}>
              {/* 1. Registration */}
              <JourneyNode index={1} title="التسجيل" status="completed"
                proof={user?.createdAt ? `أُنشئ حسابك في ${formatDateAr(user.createdAt)}` : 'حسابك منشأ ومفعّل'} />

              {/* 2. Placement */}
              <JourneyNode index={2} title="تحديد المستوى" status={st('placement')}
                proof={user?.placementExamTaken ? `نتيجتك: ${user?.placementExamScore ?? '—'}%` : 'امتحان قصير يحدد مستواك الحقيقي'}
                action={!done.placement && (
                  <HqActionLink to="/onboarding/type">ابدأ تحديد المستوى</HqActionLink>
                )} />

              {/* 3. Level */}
              <JourneyNode index={3} title="المستوى" status={st('level')}
                proof={user?.assignedLevel ? getLevelLabel(user.assignedLevel) : 'ستتاح بعد اعتماد نتيجة تحديد المستوى'} />

              {/* 4. Curriculum + embedded skills & flagged review */}
              <JourneyNode index={4} title="المنهج" status={st('curriculum')}
                proof={totalLessons ? `${completedLessons} من ${totalLessons} درسًا (${curriculumPct}%)` : 'ستظهر حصصك هنا بعد أول بث مباشر مع معلمك'}
                action={
                  <HqActionLink to="/student/curriculum" primary={st('curriculum') === 'current'}>تابع حصصك</HqActionLink>
                }>
                {openWeak.length > 0 && (
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 700, color: HQ.MUTED, margin: '0 0 8px' }}>
                      آيات علّمها معلمك للمراجعة ({openWeak.length})
                    </p>
                    <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                      {openWeak.slice(0, 3).map(wp => (
                        <li key={wp._id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '8px 0', borderTop: `1px solid ${HQ.LINE}`, fontSize: 14 }}>
                          <span style={{ color: HQ.INK, fontWeight: 700 }}>{wp.surahName} — الآية {wp.fromVerse}</span>
                          <button type="button" onClick={() => handleMarkMastered(wp._id)}
                            style={{ minHeight: 44, padding: '0 16px', borderRadius: 12, border: 'none', background: HQ.MENTOR, color: '#fff', fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>
                            راجعتها
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </JourneyNode>

              {/* 5. Live */}
              <JourneyNode index={5} title="الحصة المباشرة" status={liveNow ? 'current' : st('live')}
                proof={hasAttendedLive
                  ? 'حضرت حصصاً مباشرة — واصل الحضور'
                  : liveNow ? 'حصة جارية الآن — معلمك بانتظارك' : nextSession?.scheduledAt ? `الحصة القادمة: ${getSmartDateLabel(nextSession.scheduledAt)}` : 'تُعلن حصتك القادمة حسب جدولك — تُحتسب بعد أول حضور لك'}
                action={(liveNow || nextSession) && (
                  <HqActionLink to="/student/live" primary={liveNow}>
                    {liveNow ? 'انضم الآن' : 'صفحة الحصة'}
                  </HqActionLink>
                )} />

              {/* 6. Exams */}
              <JourneyNode index={6} title="الاختبارات" status={tasksKnown ? st('tasks') : 'upcoming'}
                proof={!tasksKnown
                  ? 'جارٍ تحميل مهامك...'
                  : (pendingExams || 0) > 0
                  ? `${pendingExams} اختبارًا بانتظارك`
                  : 'لا معلّق عليك الآن — أحسنت'}
                action={tasksKnown && (pendingExams || 0) > 0 && (
                  <span style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <HqActionLink to="/student/exams">الاختبارات</HqActionLink>
                  </span>
                )} />

              {/* 7. Khatm — JuzMap lives ONLY here */}
              <JourneyNode index={7} title="الختمة" status={st('khatm')}
                proof={`${completedJuz.length} من 30 جزءًا`}>
                <button type="button" onClick={() => setJuzOpen(o => !o)} aria-expanded={juzOpen}
                  style={{ minHeight: 48, padding: '0 20px', borderRadius: 12, border: `1px solid ${HQ.LINE}`, background: HQ.SURFACE, color: HQ.INK, fontWeight: 800, fontSize: 14, cursor: 'pointer', width: '100%' }}>
                  {juzOpen ? 'إخفاء خريطة الأجزاء' : 'عرض خريطة الأجزاء الثلاثين'}
                </button>
                {juzOpen && (
                  <div style={{ marginTop: 12 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 8 }} role="list" aria-label="خريطة الأجزاء">
                      {JUZ.map(j => {
                        const isDone = completedJuz.includes(j);
                        return (
                          <span key={j} role="listitem"
                            aria-label={`الجزء ${j}: ${isDone ? 'مكتمل' : 'لم يبدأ'}`}
                            style={{
                              aspectRatio: '1', borderRadius: 12, display: 'inline-flex',
                              alignItems: 'center', justifyContent: 'center',
                              fontWeight: 800, fontSize: 14,
                              background: isDone ? HQ.MENTOR : HQ.SURFACE,
                              color: isDone ? '#fff' : HQ.MUTED,
                              border: `1px solid ${isDone ? HQ.MENTOR : HQ.LINE}`,
                            }}>
                            {isDone ? <CheckCircle2 size={16} /> : j}
                          </span>
                        );
                      })}
                    </div>
                    <p style={{ fontSize: 13, color: HQ.MUTED, margin: '8px 0 0' }}>
                      <BookOpen size={13} style={{ verticalAlign: -2 }} /> اللون حالة فقط: الأخضر مكتمل، والباقي بانتظار دورك.
                    </p>
                  </div>
                )}
              </JourneyNode>
            </div>
          </>
        )}
      </div>
    </PageLayout>
  );
}
