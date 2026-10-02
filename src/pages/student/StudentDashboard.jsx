import { useState, useEffect, useRef } from 'react';
import {
  BookOpen, Check, Play, ChevronLeft, RotateCcw, Sparkles,
  CheckCircle, FileText, Award, CalendarCheck,
} from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import PageLayout from '../../components/shared/PageLayout';
import useAuthStore from '../../store/authStore';

import useLiveStore from '../../store/liveStore';
import useExamStore from '../../store/examStore';
import {
  getLevelLabel, formatDateAr, getSmartDateLabel, formatTime12Ar,
} from '../../utils/helpers';
import api from '../../services/api';
import useSocket from '../../hooks/useSocket';
import toast from 'react-hot-toast';
import '../../components/halaqa/halaqa.css';
import { HQ, HqBadge } from '../../components/halaqa/primitives';
import { HqActionLink } from '../../components/halaqa/JourneyNode';

function useCountdown(targetDate) {
  const [timeLeft, setTimeLeft] = useState(0);
  useEffect(() => {
    if (!targetDate) return;
    const tick = () => {
      const diff = Math.floor((new Date(targetDate) - new Date()) / 1000);
      setTimeLeft(diff > 0 ? diff : 0);
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [targetDate]);
  return timeLeft;
}

const PORTIONS = [
  { key: 'newHifz', label: 'الحفظ الجديد' },
  { key: 'nearRevision', label: 'الماضي القريب' },
  { key: 'cumulativeRevision', label: 'الماضي البعيد' },
];

function portionName(p) {
  if (!p) return '';
  if (p.surahName) return `سورة ${p.surahName}${p.fromVerse ? ` — الآيات ${p.fromVerse} إلى ${p.toVerse}` : ''}`;
  return '';
}

function examKind(exam) {
  if (exam.questions?.some(q => q.type === 'recitation')) return 'امتحان شفهي وتسميع';
  if (exam.questions?.some(q => q.type === 'written')) return 'امتحان تحريري';
  return 'تقييم شامل';
}

export default function StudentDashboard() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'all';

  const { user } = useAuthStore();
  const { sessions, fetchSessions } = useLiveStore();
  const { availableExams, results, fetchAvailableExams, fetchMyResults } = useExamStore();

  const [dailyTask, setDailyTask] = useState(null);
  const [subscription, setSubscription] = useState(null);
  const [activeLiveSession, setActiveLiveSession] = useState(null);
  const [ready, setReady] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);


  const myId = user?._id?.toString();
  const loadingRef = useRef(false);

  useSocket({
    'live-started': () => {
      api.get('/live/active/me').then(res => {
        if (res.data?.session) setActiveLiveSession(res.data.session);
      }).catch(() => {});
    },
    'broadcast-started': () => {
      api.get('/live/active/me').then(res => {
        if (res.data?.session) setActiveLiveSession(res.data.session);
      }).catch(() => {});
    },
    'broadcast-ended': () => {
      setActiveLiveSession(null);
    },
  });

  const loadLocal = () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setReady(false);
    setLoadFailed(false);
    let ok = 0;
    const settle = async (fn) => { try { await fn(); ok++; } catch (_) {} };
    Promise.all([
      settle(async () => {
        const res = await api.get('/daily-tasks/today');
        setDailyTask(res.data.task || null);
      }),
      settle(async () => {
        const res = await api.get('/live/active/me').catch(() => null);
        if (res?.data?.session) {
          setActiveLiveSession(res.data.session);
        } else {
          setActiveLiveSession(null);
        }
      }),
      settle(async () => {
        await fetchAvailableExams(null, myId);
        await fetchMyResults(myId);
      }),
      settle(async () => {
        const res = await api.get('/payments/my-history');
        setSubscription(res.data?.subscription || null);
      }),
    ]).then(() => {
      if (ok === 0) setLoadFailed(true);
      setReady(true);
      loadingRef.current = false;
    });
  };

  useEffect(() => {
    loadLocal();
    const interval = setInterval(() => {
      api.get('/live/active/me').then(res => {
        if (res.data?.session) {
          setActiveLiveSession(res.data.session);
        } else {
          setActiveLiveSession(null);
        }
      }).catch(() => {});
    }, 15000);
    return () => clearInterval(interval);
  }, [myId]);

  const handleTabChange = (key) => {
    setSearchParams(key === 'all' ? {} : { tab: key });
  };

  const handleTogglePortion = async (portion) => {
    if (!dailyTask?._id) return;
    const currentStatus = dailyTask[portion]?.status;
    const newStatus = currentStatus === 'completed' ? 'pending' : 'completed';
    try {
      const res = await api.put(`/daily-tasks/${dailyTask._id}/portion`, { portion, status: newStatus });
      setDailyTask(res.data.task);
      if (newStatus === 'completed') toast.success('بارك الله فيك! تم إنجاز هذا الجزء من الورد');
    } catch {
      toast.error('حدث خطأ في تحديث حالة الورد');
    }
  };

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'صباح الخير' : hour < 18 ? 'مساء الخير' : 'مساء النور';

  const liveSession = activeLiveSession || sessions.find(s => s.status === 'live');
  const upcomingSession = liveSession || sessions.find(s => s.status === 'scheduled');
  const timeLeft = useCountdown(upcomingSession?.status === 'scheduled' ? upcomingSession.scheduledAt : null);
  // Format seconds as countdown text
  const formatCountdownAr = (secs) => {
    if (!secs || secs <= 0) return '';
    const d = Math.floor(secs / 86400);
    const h = Math.floor((secs % 86400) / 3600);
    const m = Math.floor((secs % 3600) / 60);
    if (d > 0) return `متبقٍ ${d} يوم و${h} ساعة`;
    if (h > 0) return `متبقٍ ${h} ساعة و${m} دقيقة`;
    return `متبقٍ ${m} دقيقة`;
  };
  const timeLeftText = formatCountdownAr(timeLeft);

  const pendingPortions = PORTIONS.filter(p => dailyTask?.[p.key] && dailyTask[p.key].status !== 'completed');

  // Pending exams
  const pendingExams = (availableExams || []).filter(e => !e.isCompleted);

  // Total pending tasks count for badges
  const totalPendingCount = pendingPortions.length + pendingExams.length;

  /* Ordered primary candidate */
  const candidates = [];
  if (liveSession) {
    candidates.push({ kind: 'live', label: 'انضم للحصة المباشرة الآن', hint: liveSession.title || 'جلسة بث مباشر خاصة مع المعلم', to: '/student/live', live: true });
  }
  if (pendingExams[0]) candidates.push({ kind: 'exam', label: `ابدأ: ${pendingExams[0].title}`, hint: `${pendingExams[0].questions?.length || 0} أسئلة`, examId: pendingExams[0]._id });
  if (pendingPortions.length) candidates.push({ kind: 'wird', label: `أكمل وردك اليومي (${pendingPortions.length} متبقٍ)`, hint: portionName(dailyTask[pendingPortions[0].key]), tab: 'wird' });
  if (upcomingSession && upcomingSession.status === 'scheduled') candidates.push({ kind: 'upcoming', label: 'الحصة القادمة', hint: `${getSmartDateLabel(upcomingSession.scheduledAt)}${timeLeftText ? ` · ${timeLeftText}` : ''}`, to: '/student/live' });
  candidates.push({ kind: 'curriculum', label: 'تابع منهجك', hint: 'دروسك ومقررك الدراسي', to: '/student/curriculum' });
  if (!liveSession && !pendingExams.length && !pendingPortions.length) {
    candidates.push({ kind: 'quran', label: 'تصفح المصحف المكرر', hint: 'راجع وردك وتلاوتك', to: '/student/quran' });
  }
  const [primary, next] = candidates;

  const primaryAction = primary?.examId ? (
    <button type="button" onClick={() => navigate(`/student/exams/${primary.examId}/take`)} className="hq-action" style={{ background: HQ.MENTOR, color: '#fff', padding: '0 32px', fontSize: 16, width: '100%' }}>
      <Play size={18} /> {primary.label}
    </button>
  ) : primary?.tab ? (
    <button type="button" onClick={() => handleTabChange(primary.tab)} className="hq-action" style={{ background: HQ.MENTOR, color: '#fff', padding: '0 32px', fontSize: 16, width: '100%' }}>
      <BookOpen size={18} /> {primary.label}
    </button>
  ) : primary ? (
    <HqActionLink to={primary.to}>{primary.label}</HqActionLink>
  ) : null;

  const sheet = { background: HQ.SURFACE, border: `1px solid ${HQ.LINE}`, borderRadius: 18, padding: 'clamp(16px, 3vw, 28px)' };
  const h2 = { margin: '0 0 4px', fontSize: 18, fontWeight: 800, color: HQ.INK };

  const tabsConfig = [
    { key: 'all', label: 'الكل', count: totalPendingCount },
    { key: 'wird', label: 'الورد اليومي', count: pendingPortions.length },
    { key: 'exams', label: 'الاختبارات والتقييمات', count: pendingExams.length },
  ];

  return (
    <PageLayout>
      <div className="halaqa" style={{ ...sheet, maxWidth: 780, margin: '0 auto' }}>
        {!ready ? (
          <div aria-label="جارٍ تحميل مهامك اليومية">
            <div className="hq-skeleton" style={{ height: 24, width: '40%', marginBottom: 16 }} />
            <div className="hq-skeleton" style={{ height: 56, width: '100%', marginBottom: 16 }} />
            <div className="hq-skeleton" style={{ height: 48, width: '100%', marginBottom: 16 }} />
            <div className="hq-skeleton" style={{ height: 120, width: '100%', marginBottom: 12 }} />
            <div className="hq-skeleton" style={{ height: 120, width: '100%' }} />
          </div>
        ) : loadFailed ? (
          <div style={{ textAlign: 'center', padding: '48px 16px' }} role="alert">
            <h1 style={{ fontSize: 24, fontWeight: 800, color: HQ.INK, margin: '0 0 8px' }}>تعذّر تحميل المطلوب منك</h1>
            <p style={{ color: HQ.MUTED, fontSize: 15, margin: '0 0 20px' }}>تحقق من الاتصال بالإنترنت ثم حاول مرة أخرى.</p>
            <button type="button" onClick={loadLocal} className="hq-action" style={{ background: HQ.MENTOR, color: '#fff', padding: '0 24px', fontSize: 15 }}>
              <RotateCcw size={17} /> إعادة المحاولة
            </button>
          </div>
        ) : (
          <>
            {/* Header Greeting */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}>
              <div>
                <p style={{ margin: 0, fontSize: 14, color: HQ.MUTED }}>{greeting} يا {user?.firstName || 'طالبنا'}</p>
                <h1 className="m-dash-title" style={{ margin: '2px 0 0', fontSize: 28, fontWeight: 900, color: HQ.INK }}>
                  المطلوب منك اليوم
                </h1>
              </div>
              <button
                type="button"
                onClick={loadLocal}
                title="تحديث المهام"
                aria-label="تحديث المهام"
                className="hq-action"
                style={{ background: HQ.SURFACE, border: `1px solid ${HQ.LINE}`, color: HQ.INK, padding: '0 14px', fontSize: 13, flex: 'none' }}
              >
                <RotateCcw size={15} /> <span className="m-hide-sm">تحديث</span>
              </button>
            </div>

            {/* Student Individual Schedule or Onboarding Card */}
            {(user?.scheduleDays?.length > 0 || user?.sessionTime) ? (
              <div className="m-sched-card" style={{ background: HQ.MENTOR_WASH, border: `1px solid ${HQ.MENTOR}`, borderRadius: 16, padding: '16px 18px', marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, flexWrap: 'wrap' }}>
                  <span style={{ width: 42, height: 42, borderRadius: 12, background: HQ.SURFACE, border: `1px solid ${HQ.MENTOR}`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
                    <CalendarCheck size={22} color={HQ.MENTOR} />
                  </span>
                  <div style={{ flex: 1, minWidth: 220 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                      <strong style={{ fontSize: 16, color: HQ.MENTOR_DEEP }}>
                        مستواك المعتمد: {user?.assignedLevel ? getLevelLabel(user.assignedLevel) : 'محدد من الإدارة'}
                      </strong>
                      <HqBadge tone="mentor">جلسات مباشرة فردية</HqBadge>
                    </div>
                    <p style={{ margin: '4px 0 0', fontSize: 14, color: HQ.MENTOR_DEEP, lineHeight: 1.8, fontWeight: 600 }}>
                      مواعيد البث المباشر المحددة لك: {user.scheduleDays?.join('، ') || 'أيام محددة'}
                      {user.sessionTime ? ` — الساعة ${formatTime12Ar(user.sessionTime)}` : ''}
                    </p>
                    <p className="m-hide-sm" style={{ margin: '4px 0 0', fontSize: 13, color: HQ.MENTOR, lineHeight: 1.8 }}>
                      يبدأ المعلم البث المباشر معك في الموعد المحدد، وستظهر لك الحصة مباشرة هنا لمتابعة التسميع وتلقي الدرس.
                    </p>
                    <div className="m-hide-sm" style={{ display: 'flex', gap: 12, marginTop: 10 }}>
                      <Link to="/student/curriculum" style={{ fontSize: 13, fontWeight: 800, color: HQ.MENTOR_DEEP, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        عرض الدروس والمقرر الدراسي <ChevronLeft size={15} />
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ background: HQ.SURFACE, border: `1px solid ${HQ.LINE}`, borderRadius: 16, padding: '16px 18px', marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, flexWrap: 'wrap' }}>
                  <span style={{ width: 42, height: 42, borderRadius: 12, background: HQ.MENTOR_WASH, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
                    <Sparkles size={20} color={HQ.MENTOR} />
                  </span>
                  <div style={{ flex: 1, minWidth: 220 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                      <strong style={{ fontSize: 16, color: HQ.INK }}>
                        مستواك: {user?.assignedLevel ? getLevelLabel(user.assignedLevel) : 'بانتظار الاعتماد وتحديد المواعيد'}
                      </strong>
                      <HqBadge tone="neutral">بانتظار اعتماد الإدارة للمواعيد</HqBadge>
                    </div>
                    <p style={{ margin: 0, fontSize: 13, color: HQ.MUTED, lineHeight: 1.8 }}>
                      فريق الإشراف يقوم بمراجعة مستواك واعتماد أيام وساعة الجلسات المباشرة الفردية الخاصة بك.
                    </p>
                    <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                      <Link to="/waiting-approval" style={{ fontSize: 13, fontWeight: 800, color: HQ.MENTOR, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        متابعة حالة الاعتماد <ChevronLeft size={15} />
                      </Link>
                      <span style={{ color: HQ.LINE }} aria-hidden>|</span>
                      <Link to="/student/quran" style={{ fontSize: 13, fontWeight: 700, color: HQ.INK }}>
                        تصفح المصحف المكرر
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Primary Urgent Action (e.g. Live now or urgent exam) */}
            {primary && (
              <section aria-label="خطوتي الآن" style={{ marginBottom: 20 }}>
                {primary.live && (
                  <p style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '0 0 8px', fontSize: 14, fontWeight: 800, color: HQ.MENTOR }}>
                    <span className="hq-live-dot" aria-hidden /> {primary.hint}
                  </p>
                )}
                {!primary.live && primary.hint && (
                  <p style={{ margin: '0 0 8px', fontSize: 14, color: HQ.MUTED }}>{primary.hint}</p>
                )}
                {primaryAction}
              </section>
            )}

            {/* Next step hint */}
            {next && (
              <section aria-label="التالي" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: HQ.MUTED, marginBottom: 20 }}>
                <span style={{ fontWeight: 800, color: HQ.INK, flex: 'none' }}>التالي:</span>
                <span style={{ flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{next.label}</span>
                {next.to && <Link to={next.to} aria-label={`انتقال: ${next.label}`} style={{ color: HQ.MENTOR, display: 'inline-flex', flex: 'none' }}><ChevronLeft size={18} /></Link>}
                {next.tab && <button type="button" onClick={() => handleTabChange(next.tab)} style={{ background: 'none', border: 'none', color: HQ.MENTOR, cursor: 'pointer', padding: 0 }}><ChevronLeft size={18} /></button>}
              </section>
            )}

            {/* ═══════════════════════════════════════════════════
                UNIFIED TASKS HUB — Tabs System
                ═══════════════════════════════════════════════════ */}
            <section id="today-tasks" aria-label="مركز المهام اليومية" style={{ marginBottom: 28 }}>
              {/* Tabs Bar — shared hq-tabs pattern */}
              <div
                className="hq-tabs"
                role="tablist"
                aria-label="أقسام المهام المطلوبة"
                style={{ display: 'flex', width: '100%', marginBottom: 16 }}
              >
                {tabsConfig.map(t => {
                  const isActive = activeTab === t.key;
                  return (
                    <button
                      key={t.key}
                      role="tab"
                      aria-selected={isActive}
                      onClick={() => handleTabChange(t.key)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        fontFamily: 'inherit',
                      }}
                    >
                      {t.label}
                      {t.count > 0 && (
                        <span style={{
                          fontSize: 12,
                          fontWeight: 900,
                          borderRadius: 9999,
                          padding: '1px 8px',
                          background: isActive ? 'rgba(255,255,255,0.25)' : HQ.MENTOR_WASH,
                          color: isActive ? '#fff' : HQ.MENTOR_DEEP,
                          fontVariantNumeric: 'tabular-nums',
                        }}>
                          {t.count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* ── TAB 1: ALL PENDING (نظرة شاملة لكافة المهام) ── */}
              {activeTab === 'all' && (
                <div>
                  {totalPendingCount === 0 ? (
                    <div style={{ background: HQ.SURFACE, border: `1px solid ${HQ.LINE}`, borderRadius: 16, padding: 36, textAlign: 'center' }}>
                      <CheckCircle size={44} color={HQ.MENTOR} style={{ margin: '0 auto 10px' }} />
                      <h3 style={{ fontSize: 18, fontWeight: 900, color: HQ.INK, margin: '0 0 6px' }}>
                        أحسنت! أتممت جميع المهام المطلوبة منك اليوم
                      </h3>
                      <p style={{ fontSize: 14, color: HQ.MUTED, margin: 0 }}>
                        لا توجد اختبارات أو أوراد معلقة. يمكنك تصفح المصحف أو مراجعة محفوظاتك.
                      </p>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {/* Daily portions */}
                      {PORTIONS.filter(p => dailyTask?.[p.key]).map(p => {
                        const portion = dailyTask[p.key];
                        const isDone = portion.status === 'completed';
                        return (
                          <div
                            key={p.key}
                            style={{
                              background: HQ.SURFACE,
                              border: `1px solid ${isDone ? HQ.MENTOR : HQ.LINE}`,
                              borderRadius: 14,
                              padding: '12px 16px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 12,
                            }}
                          >
                            <button
                              type="button"
                              onClick={() => handleTogglePortion(p.key)}
                              aria-label={isDone ? `تعليم ${p.label} كمتبقٍ` : `تعليم ${p.label} كمنجز`}
                              aria-pressed={isDone}
                              style={{
                                width: 48, height: 48, borderRadius: 9999,
                                border: `2px solid ${isDone ? HQ.MENTOR : HQ.LINE}`,
                                background: isDone ? HQ.MENTOR : 'transparent',
                                color: '#fff',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                flex: 'none',
                              }}
                            >
                              {isDone && <Check size={20} strokeWidth={3.5} />}
                            </button>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                <strong style={{ fontSize: 15, color: HQ.INK }}>{p.label}</strong>
                                <span style={{ fontSize: 12, color: HQ.MUTED, background: HQ.PAPER, padding: '2px 8px', borderRadius: 6 }}>
                                  الورد اليومي
                                </span>
                              </div>
                              <span style={{ fontSize: 13, color: HQ.MUTED }}>
                                {portionName(portion) || 'ورد مخصص من المعلم'}
                              </span>
                            </div>
                            <span style={{ fontSize: 13, fontWeight: 800, color: isDone ? HQ.MENTOR : HQ.WARNING, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                              {isDone ? (<><Check size={14} strokeWidth={3.5} /> منجز</>) : 'متبقٍ'}
                            </span>
                          </div>
                        );
                      })}

                      {/* Pending exams */}
                      {pendingExams.map(ex => (
                        <div
                          key={ex._id}
                          style={{
                            background: HQ.SURFACE,
                            border: `1px solid ${HQ.LINE}`,
                            borderRadius: 14,
                            padding: '12px 16px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 12,
                          }}
                        >
                           <span style={{ width: 34, height: 34, borderRadius: 10, background: HQ.MENTOR_WASH, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
                             <FileText size={18} color={HQ.MENTOR} />
                           </span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <strong style={{ display: 'block', fontSize: 15, color: HQ.INK }}>
                              {ex.title}
                            </strong>
                            <span style={{ fontSize: 12, color: HQ.MUTED }}>
                              {examKind(ex)} · {ex.questions?.length || 0} أسئلة{ex.duration ? ` · ${ex.duration} دقيقة` : ''}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => navigate(`/student/exams/${ex._id}/take`)}
                            className="hq-action"
                            style={{ background: HQ.MENTOR, color: '#fff', padding: '0 18px', fontSize: 13, flex: 'none' }}
                          >
                            <Play size={14} /> ابدأ
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ── TAB 2: DAILY WIRD (الورد اليومي وسجل التسميع) ── */}
              {activeTab === 'wird' && (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: 16, fontWeight: 900, color: HQ.INK }}>وردك القرآني لليوم</h3>
                      <p style={{ margin: '2px 0 0', fontSize: 13, color: HQ.MUTED }}>
                        علّم الأجزاء التي أتممت قراءتها وحفظها اليوم بنفسك
                      </p>
                    </div>
                  </div>

                  {!dailyTask ? (
                    <div style={{ background: HQ.SURFACE, border: `1px solid ${HQ.LINE}`, borderRadius: 16, padding: 32, textAlign: 'center', marginBottom: 20 }}>
                      <BookOpen size={36} color={HQ.MUTED} style={{ margin: '0 auto 8px' }} />
                      <p style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 800, color: HQ.INK }}>لا ورد محدد لليوم بعد</p>
                      <p style={{ margin: 0, fontSize: 13, color: HQ.MUTED }}>يحدد معلمك وردك ومقدار الحفظ في الحلقة القادمة.</p>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
                      {PORTIONS.filter(p => dailyTask[p.key]).map(p => {
                        const portion = dailyTask[p.key];
                        const isDone = portion.status === 'completed';
                        return (
                          <div
                            key={p.key}
                            style={{
                              background: HQ.SURFACE,
                              border: `1px solid ${isDone ? HQ.MENTOR : HQ.LINE}`,
                              borderRadius: 14,
                              padding: 16,
                              display: 'flex',
                              alignItems: 'center',
                              gap: 14,
                            }}
                          >
                            <button
                              type="button"
                              onClick={() => handleTogglePortion(p.key)}
                              aria-pressed={isDone}
                              aria-label={isDone ? `تعليم ${p.label} كمتبقٍ` : `تعليم ${p.label} كمنجز`}
                              style={{
                                width: 48, height: 48, borderRadius: 9999,
                                border: `2px solid ${isDone ? HQ.MENTOR : HQ.LINE}`,
                                background: isDone ? HQ.MENTOR : 'transparent',
                                color: '#fff',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                flex: 'none',
                              }}
                            >
                              {isDone && <Check size={18} strokeWidth={3.5} />}
                            </button>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                                <strong style={{ fontSize: 16, color: HQ.INK }}>{p.label}</strong>
                                {isDone && <HqBadge tone="mentor">مكتمل</HqBadge>}
                              </div>
                              <p style={{ margin: 0, fontSize: 14, color: HQ.MUTED }}>
                                {portionName(portion) || 'المحدد من معلمك'}
                              </p>
                            </div>
                            <Link
                              to={portion?.surahNumber && portion?.fromVerse && portion?.toVerse
                                ? `/student/quran?surah=${portion.surahNumber}&from=${portion.fromVerse}&to=${portion.toVerse}`
                                : '/student/quran'}
                              title={portion?.surahNumber ? 'الانتقال للآيات المطلوبة مظللة في المصحف' : undefined}
                              style={{ fontSize: 13, fontWeight: 800, color: HQ.MENTOR, textDecoration: 'none', background: HQ.PAPER, padding: '6px 12px', borderRadius: 8, border: `1px solid ${HQ.LINE}`, minHeight: 48, display: 'inline-flex', alignItems: 'center' }}
                            >
                              افتح المصحف
                            </Link>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* ── TAB 3: EXAMS (الاختبارات الشفهية والتحريرية) ── */}
              {activeTab === 'exams' && (
                <div>
                  <div style={{ marginBottom: 14 }}>
                    <h3 style={{ margin: 0, fontSize: 16, fontWeight: 900, color: HQ.INK }}>
                      الاختبارات والامتحانات الشفهية ({pendingExams.length} متاحة)
                    </h3>
                    <p style={{ margin: '2px 0 0', fontSize: 13, color: HQ.MUTED }}>
                      امتحانات التجويد والحفظ الشفهية والتحريرية لقياس مستوى إتقانك للقرآن
                    </p>
                  </div>

                  {pendingExams.length === 0 ? (
                    <div style={{ background: HQ.SURFACE, border: `1px solid ${HQ.LINE}`, borderRadius: 16, padding: 36, textAlign: 'center', marginBottom: 24 }}>
                      <Award size={36} color={HQ.MENTOR} style={{ margin: '0 auto 8px' }} />
                      <p style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 800, color: HQ.INK }}>لا توجد اختبارات معلقة عليك الآن</p>
                      <p style={{ margin: 0, fontSize: 13, color: HQ.MUTED }}>ستظهر هنا الاختبارات المرحلية وامتحانات الأجزاء التي يحددها معلمك.</p>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
                      {pendingExams.map((exam, i) => {
                        const required = i === 0;
                        return (
                          <div
                            key={exam._id}
                            style={{
                              background: required ? HQ.MENTOR_WASH : HQ.SURFACE,
                              border: `1px solid ${required ? HQ.MENTOR : HQ.LINE}`,
                              borderRadius: 16,
                              padding: 16,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: 14,
                              flexWrap: 'wrap',
                            }}
                          >
                            <div style={{ flex: 1, minWidth: 200 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 3 }}>
                                <strong style={{ fontSize: 16, color: required ? HQ.MENTOR_DEEP : HQ.INK }}>
                                  {exam.title}
                                </strong>
                                {required && <HqBadge tone="mentor">مطلوب الآن</HqBadge>}
                              </div>
                              <p style={{ margin: 0, fontSize: 13, color: HQ.MUTED }}>
                                {examKind(exam)} · {exam.questions?.length || 0} أسئلة{exam.duration ? ` · ${exam.duration} دقيقة` : ''}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => navigate(`/student/exams/${exam._id}/take`)}
                              className="hq-action"
                              style={{ background: HQ.MENTOR, color: '#fff', padding: '0 24px', fontSize: 14, flex: 'none' }}
                            >
                              <Play size={16} /> ابدأ الاختبار الآن
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Previous Results Section */}
                  {results?.length > 0 && (
                    <div style={{ paddingTop: 20, borderTop: `1px solid ${HQ.LINE}` }}>
                      <h4 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 900, color: HQ.INK }}>
                        نتائج ودرجات اختباراتي السابقة ({results.length})
                      </h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {results.map(res => (
                          <div
                            key={res._id}
                            style={{
                              background: HQ.SURFACE,
                              border: `1px solid ${HQ.LINE}`,
                              borderRadius: 12,
                              padding: '12px 14px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: 12,
                            }}
                          >
                            <div>
                              <strong style={{ display: 'block', fontSize: 14, color: HQ.INK }}>
                                {res.exam?.title || 'اختبار تقييم'}
                              </strong>
                              <span style={{ fontSize: 12, color: HQ.MUTED }}>
                                {formatDateAr(res.createdAt)}
                              </span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ fontSize: 15, fontWeight: 900, color: HQ.MENTOR }}>
                                {res.score !== undefined ? `${res.score}%` : 'تم التدقيق'}
                              </span>
                              <HqBadge tone={res.status === 'passed' || (res.score !== undefined && res.score >= 60) ? 'mentor' : 'neutral'}>
                                {res.status === 'passed' || (res.score !== undefined && res.score >= 60) ? 'ناجح' : 'مكتمل'}
                              </HqBadge>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </section>

            {/* Next Majlis / Class Info */}
            <section aria-label="المجلس القادم" style={{ background: HQ.SURFACE, border: `1px solid ${HQ.LINE}`, borderRadius: 16, padding: 18, marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <div>
                  <span style={{ fontSize: 12, fontWeight: 800, color: HQ.MENTOR, display: 'block', marginBottom: 2 }}>
                    الحلقة المباشرة القادمة
                  </span>
                  <strong style={{ fontSize: 16, color: HQ.INK, display: 'flex', alignItems: 'center', gap: 8 }}>
                    {upcomingSession ? upcomingSession.title : 'لا توجد جلسة مجدولة قريباً'}
                    {upcomingSession?.status === 'live' && <span className="hq-live-dot" aria-hidden />}
                  </strong>
                  {upcomingSession && (
                    <p style={{ margin: '4px 0 0', fontSize: 13, color: HQ.MUTED }}>
                      {upcomingSession.teacher ? `مع ${upcomingSession.teacher.firstName || ''} ${upcomingSession.teacher.lastName || ''}`.trim() : 'حصتك الفردية المباشرة'}
                      {upcomingSession.status === 'scheduled' && upcomingSession.scheduledAt ? ` · ${getSmartDateLabel(upcomingSession.scheduledAt)}${timeLeftText ? ` · ${timeLeftText}` : ''}` : ''}
                    </p>
                  )}
                </div>
                {upcomingSession && (
                  <HqActionLink to="/student/live" primary={upcomingSession.status === 'live'}>
                    {upcomingSession.status === 'live' ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                        دخول الحلقة الآن <span className="hq-live-dot" aria-hidden />
                      </span>
                    ) : 'غرفة الحلقة'}
                  </HqActionLink>
                )}
              </div>
            </section>

            {/* Curriculum link */}
            <div style={{ textAlign: 'center', padding: '8px 0' }}>
              <Link to="/student/curriculum" style={{ fontSize: 14, fontWeight: 800, color: HQ.MENTOR, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                الانتقال إلى الحصص السابقة <ChevronLeft size={16} />
              </Link>
            </div>
          </>
        )}
      </div>
    </PageLayout>
  );
}
