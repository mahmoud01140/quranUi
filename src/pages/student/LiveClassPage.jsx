import { useState, useEffect, useRef, useCallback } from 'react';
import {
  PhoneOff, Bell, CheckCircle2, Clock, Lock, CreditCard,
  RefreshCw, BookOpen,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import Navbar from '../../components/shared/Navbar';
import JitsiMeeting from '../../components/shared/JitsiMeeting';
import MushafSharePanel from '../../components/shared/MushafSharePanel';
import useAuthStore from '../../store/authStore';
import useLiveStore from '../../store/liveStore';
import usePolling from '../../hooks/usePolling';
import api from '../../services/api';
import { formatCountdown } from '../../utils/helpers';
import '../../components/halaqa/halaqa.css';
import { HQ, HqBadge } from '../../components/halaqa/primitives';
import { WirdCard, PresenceBar } from '../../components/halaqa/LiveBits';

const POLL_INTERVAL_MS = 10_000;

// بصمة الورد لكشف ورد جديد/محدّث (المعرّف + زمن آخر تعديل من قاعدة البيانات)
const wirdKey = (t) => (t?._id ? `${t._id}:${t.updatedAt || ''}` : '');

export default function LiveClassPage() {
  const { user } = useAuthStore();
  const {
    session, isLive, setSession, setIsLive, joinSession, resetLive,
  } = useLiveStore();

  const [duration, setDuration] = useState(0);
  const [pingActive, setPingActive] = useState(null);
  const [confirmingPong, setConfirmingPong] = useState(false);
  const [subscriptionStatus, setSubscriptionStatus] = useState(null);
  const [accessDeniedInfo, setAccessDeniedInfo] = useState(null);
  const [voluntarilyLeft, setVoluntarilyLeft] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const pollingRef = useRef(null);

  /* الورد اليومي للطالب (يُجلب من مهام اليوم — بدون طابور تسميع) */
  const [myDailyTask, setMyDailyTask] = useState(null);
  const [showWirdCard, setShowWirdCard] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const lastWirdKeyRef = useRef('');

  /* المصحف المشترك من المعلم (استطلاع خفيف بلا قنوات لحظية) */
  const [sharedMushaf, setSharedMushaf] = useState(null);
  const [showSharedMushaf, setShowSharedMushaf] = useState(false);
  const mushafPollingRef = useRef(null);
  const lastMushafKeyRef = useRef('null');

  // Vercel-safe polling replaces socket.io live-started / broadcast-ended / attendance-ping.
  // - No session: GET /active/me every 10s (handled below via pollingRef).
  // - Live session: GET /live/:id every 5s to detect end + roll-call ping (activePing).
  const seenPingRef = useRef(null);
  const pollLiveSession = useCallback(async () => {
    if (!session?._id) return;
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
    try {
      const res = await api.get(`/live/${session._id}`);
      const fresh = res.data?.session;
      if (!fresh) return;
      if (res.data?.subscription) setSubscriptionStatus(res.data.subscription);
      // Broadcast ended on server -> exit live view
      if (fresh.status === 'ended' || fresh.status === 'cancelled') {
        toast('انتهت الجلسة المباشرة');
        resetLive();
        setPingActive(null);
        seenPingRef.current = null;
        return;
      }
      // Roll-call ping via activePing field
      const ping = fresh.activePing;
      if (ping?.pingId && ping?.expiresAt && new Date(ping.expiresAt) > new Date()) {
        if (seenPingRef.current !== ping.pingId) {
          seenPingRef.current = ping.pingId;
          setDrawerOpen(false);
          const remaining = Math.max(1, Math.round((new Date(ping.expiresAt) - new Date()) / 1000));
          setPingActive({
            sessionId: fresh._id,
            pingId: ping.pingId,
            message: ping.message || 'نداء التحقق من التواجد في الحصة!',
            remaining,
          });
          try {
            const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = audioCtx.createOscillator();
            osc.connect(audioCtx.destination);
            osc.frequency.value = 587.33;
            osc.start();
            osc.stop(audioCtx.currentTime + 0.3);
          } catch (_) {}
        }
      } else if (!ping && seenPingRef.current) {
        // Ping expired/cleared without pong — dismiss silently
        seenPingRef.current = null;
      }
    } catch (_) {}
  }, [session?._id, resetLive]);

  const isSessionLiveNow = isLive || session?.status === 'live';
  usePolling(pollLiveSession, isSessionLiveNow ? 5000 : null, [session?._id, isSessionLiveNow]);

  useEffect(() => {
    if (!pingActive) return;
    const interval = setInterval(() => {
      setPingActive(prev => {
        if (!prev) return null;
        if (prev.remaining <= 1) {
          clearInterval(interval);
          return null;
        }
        return { ...prev, remaining: prev.remaining - 1 };
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [pingActive]);

  // الانضمام بوابة العرض: لا جلسة ولا بث على الشاشة قبل نجاحه — يمنع وميض الفيديو قبل الحجب
  const handleJoin = useCallback(async (sessionId) => {
    try {
      await api.put(`/live/${sessionId}/join`);
      joinSession(sessionId);
      setAccessDeniedInfo(null);
      return true;
    } catch (err) {
      if (err.response?.status === 403 && err.response?.data?.accessDenied) {
        setAccessDeniedInfo(err.response.data);
        if (err.response.data?.subscription) {
          setSubscriptionStatus(err.response.data.subscription);
        }
      }
      return false;
    }
  }, [joinSession]);

  const fetchActiveSession = useCallback(async ({ silent = false } = {}) => {
    try {
      const resActive = await api.get('/live/active/me').catch(() => null);
      if (resActive?.data) {
        if (resActive.data.subscription) setSubscriptionStatus(resActive.data.subscription);
        if (resActive.data.session) {
          const liveSession = resActive.data.session;
          const ok = await handleJoin(liveSession._id);
          if (ok) {
            setSession(liveSession);
            setIsLive(true);
            if (!silent) toast.success('هناك حصة مباشرة الآن! جارٍ الانضمام...');
          } else {
            setSession(null);
            setIsLive(false);
          }
          return;
        }
      }
    } catch (_) {}
  }, [handleJoin, setSession, setIsLive]);

  useEffect(() => {
    fetchActiveSession({ silent: true });
  }, [fetchActiveSession]);

  useEffect(() => {
    const isSessionLiveNow = isLive || session?.status === 'live';
    if (isSessionLiveNow) {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
        setIsPolling(false);
      }
      return;
    }
    if (!pollingRef.current) {
      setIsPolling(true);
      pollingRef.current = setInterval(() => {
        fetchActiveSession({ silent: true });
      }, POLL_INTERVAL_MS);
    }
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
        setIsPolling(false);
      }
    };
  }, [isLive, session?.status, fetchActiveSession]);

  useEffect(() => {
    if (isLive || session?.status === 'live') {
      const timer = setInterval(() => setDuration(d => d + 1), 1000);
      return () => clearInterval(timer);
    }
  }, [isLive, session]);

  const handleConfirmAttendance = async () => {
    if (!session?._id) return;
    setConfirmingPong(true);
    try {
      await api.post(`/live/${session._id}/attendance-pong`);
      toast.success('تم تأكيد حضورك في سجل الحصة');
      setPingActive(null);
    } catch (err) {
      toast.error('حدث خطأ في تأكيد الحضور');
    } finally {
      setConfirmingPong(false);
    }
  };

  // جلب الورد اليومي من مهام اليوم (بدون أي اعتماد على طابور التسميع)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get('/daily-tasks/today');
        if (!cancelled) {
          const t = res.data?.task || res.data?.dailyTask || null;
          setMyDailyTask(t);
          if (t) lastWirdKeyRef.current = wirdKey(t);
        }
      } catch (_) {}
    })();
    return () => { cancelled = true; };
  }, []);

  // تحديث الورد لحظياً أثناء البث: المعلم قد يُسند ورداً جديداً mid-session،
  // والطالب لا يعرف إلا بإعادة الجلب — استطلاع خفيف كل 5 ثوانٍ أثناء البث فقط.
  const pollWirdDuringLive = useCallback(async () => {
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
    try {
      const res = await api.get('/daily-tasks/today');
      const t = res.data?.task || res.data?.dailyTask || null;
      const key = wirdKey(t);
      if (key && key !== lastWirdKeyRef.current) {
        lastWirdKeyRef.current = key;
        setMyDailyTask(t);
        setShowWirdCard(true);
        toast.success('وصلك ورد جديد من المعلم 📖');
      } else if (key) {
        // نفس الورد لكن ربما تغيّرت حالته من جهاز آخر — حدّث بصمت
        setMyDailyTask(t);
      }
    } catch (_) {}
  }, []);

  const isWirdPollingLive = isLive || session?.status === 'live';
  usePolling(pollWirdDuringLive, isWirdPollingLive ? 5000 : null, [session?._id, isWirdPollingLive]);

  // استطلاع حالة المصحف المشترك: كل 3 ثوانٍ أثناء البث فقط، ويتوقف مع إخفاء الصفحة
  useEffect(() => {
    const liveNow = isLive || session?.status === 'live';
    if (!session?._id || !liveNow) {
      if (mushafPollingRef.current) {
        clearInterval(mushafPollingRef.current);
        mushafPollingRef.current = null;
      }
      setSharedMushaf(null);
      setShowSharedMushaf(false);
      return;
    }
    const fetchShared = async ({ silent = true } = {}) => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      try {
        const res = await api.get(`/live/${session._id}/mushaf`);
        const m = res.data?.sharedMushaf || null;
        const norm = m && m.sharing && m.surah
          ? { sharing: true, surah: m.surah, from: m.fromVerse || 1, to: m.toVerse || m.fromVerse || 1 }
          : null;
        const key = JSON.stringify(norm);
        if (key !== lastMushafKeyRef.current) {
          lastMushafKeyRef.current = key;
          setSharedMushaf(norm);
          if (!norm) {
            setShowSharedMushaf(false);
          } else if (!silent) {
            toast.success('المعلم يشارك المصحف الآن');
          }
        }
      } catch (_) {}
    };
    fetchShared({ silent: false });
    mushafPollingRef.current = setInterval(() => fetchShared({ silent: true }), 3000);
    return () => {
      if (mushafPollingRef.current) {
        clearInterval(mushafPollingRef.current);
        mushafPollingRef.current = null;
      }
      lastMushafKeyRef.current = 'null';
    };
  }, [isLive, session?._id, session?.status]);

  const markLeftHttp = useCallback((sessionId) => {
    if (!sessionId) return;
    // Best-effort: records attendees.leftAt for duration tracking (replaces socket leave-session)
    api.post(`/live/${sessionId}/leave`).catch(() => {});
  }, []);

  const handleLeave = () => {
    if (session?._id) markLeftHttp(session._id);
    setVoluntarilyLeft(true);
    resetLive();
    setDuration(0);
    setPingActive(null);
    toast('خرجت من الجلسة');
  };

  useEffect(() => {
    const handleBeforeUnload = () => {
      if (session?._id) {
        try {
          const base = (api.defaults?.baseURL || '').replace(/\/$/, '');
          const url = `${base}/live/${session._id}/leave`;
          if (navigator.sendBeacon) {
            const blob = new Blob([JSON.stringify({})], { type: 'application/json' });
            // Authorization header can't be set in sendBeacon; server middleware also accepts cookie/query — best effort
            navigator.sendBeacon(url, blob);
          }
        } catch (_) {}
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      if (session?._id) markLeftHttp(session._id);
    };
  }, [session?._id, markLeftHttp]);

  const handleRejoin = async () => {
    setVoluntarilyLeft(false);
    setAccessDeniedInfo(null);
    await fetchActiveSession({ silent: false });
  };

  const isSessionLive = isLive || session?.status === 'live';

  /* ── LOCKED: trial consumed or subscription expired (same logic, halaqa skin) ── */
  if (accessDeniedInfo || (subscriptionStatus && !subscriptionStatus.canAccessLiveSession && user?.role === 'student')) {
    return (
      <div className="halaqa" style={{ minHeight: '100vh', background: HQ.PAPER }} dir="rtl">
        <Navbar />
        <div style={{ paddingTop: 96, padding: 16, display: 'flex', justifyContent: 'center' }}>
          <div style={{ background: HQ.SURFACE, border: `1px solid ${HQ.LINE}`, borderRadius: 18, padding: 'clamp(24px,5vw,48px)', textAlign: 'center', maxWidth: 520, width: '100%' }}>
            <div style={{ width: 64, height: 64, borderRadius: 18, background: '#F8EDD3', color: '#B45309', margin: '0 auto 20px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Lock size={30} />
            </div>
            <HqBadge tone="gold">
              {subscriptionStatus?.isExpired ? 'انتهت فترة الاشتراك الشهري' : 'أتممت المحاضرة التجريبية الأولى بنجاح'}
            </HqBadge>
            <h2 style={{ fontSize: 24, fontWeight: 900, color: HQ.INK, margin: '12px 0' }}>
              {subscriptionStatus?.isExpired ? 'انتهى اشتراكك — جدده للعودة لحصصك' : 'اشترك لمواصلة حصصك مع معلمك'}
            </h2>
            <p style={{ fontSize: 15, color: HQ.MUTED, lineHeight: 1.8, margin: '0 0 28px' }}>
              {subscriptionStatus?.isExpired
                ? 'انتهت مدة اشتراكك. جدده الآن وستعود لحصصك فور الاعتماد — تُراجَع الإيصالات خلال 24 ساعة.'
                : 'استمتعت بجلستك التجريبية المجانية! اشترك الآن وواصل حصصك مع معلمك دون انقطاع.'}
            </p>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
              <Link to="/student/subscription" className="hq-action" style={{ background: HQ.MENTOR, color: '#fff', padding: '0 32px', fontSize: 15, textDecoration: 'none' }}>
                <CreditCard size={17} /> سداد الاشتراك الشهري
              </Link>
              <Link to="/student" className="hq-action" style={{ background: HQ.PAPER, color: HQ.INK, border: `1px solid ${HQ.LINE}`, padding: '0 24px', fontSize: 15, textDecoration: 'none' }}>
                العودة للرئيسية
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ── LEFT state ── */
  if (voluntarilyLeft && !session) {
    return (
      <div className="halaqa" style={{ minHeight: '100vh', background: HQ.PAPER }} dir="rtl">
        <Navbar />
        <div style={{ paddingTop: 96, padding: 16, display: 'flex', justifyContent: 'center' }}>
          <div style={{ background: HQ.SURFACE, border: `1px solid ${HQ.LINE}`, borderRadius: 18, padding: 'clamp(24px,5vw,48px)', textAlign: 'center', maxWidth: 440, width: '100%' }}>
            <h2 style={{ fontSize: 22, fontWeight: 900, color: HQ.INK, margin: '0 0 8px' }}>غادرت الحصة المباشرة</h2>
            <p style={{ color: HQ.MUTED, fontSize: 14, margin: '0 0 24px' }}>يمكنك العودة في أي وقت ما دام البث مستمرًا.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <button type="button" onClick={handleRejoin} className="hq-action" style={{ background: HQ.MENTOR, color: '#fff', fontSize: 15 }}>
                إعادة الانضمام للحصة
              </button>
              <Link to="/student" className="hq-action" style={{ background: HQ.PAPER, color: HQ.INK, border: `1px solid ${HQ.LINE}`, fontSize: 15, textDecoration: 'none' }}>
                العودة للرئيسية
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ── NO SESSION state ── */
  if (!session) {
    return (
      <div className="halaqa" style={{ minHeight: '100vh', background: HQ.PAPER }} dir="rtl">
        <Navbar />
        <div style={{ paddingTop: 64, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: HQ.SURFACE, border: `1px solid ${HQ.LINE}`, borderRadius: 18, padding: 48, textAlign: 'center', maxWidth: 420, width: '100%' }}>
            <h2 style={{ fontSize: 20, fontWeight: 900, color: HQ.INK, margin: '0 0 8px' }}>لا توجد جلسة مباشرة حاليًا</h2>
            <p style={{ color: HQ.MUTED, fontSize: 14, margin: '0 0 20px' }}>عند بدء المعلم الجلسة ستنضم تلقائيًا خلال ثوانٍ.</p>
            <p style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 13, color: HQ.MENTOR, fontWeight: 700, margin: '0 0 16px' }}>
              <RefreshCw size={14} className={isPolling ? 'animate-spin' : ''} />
              {isPolling ? 'يبحث تلقائيًا كل 10 ثوانٍ...' : 'البحث متوقف مؤقتًا'}
            </p>
            <button type="button" onClick={() => { setVoluntarilyLeft(false); setAccessDeniedInfo(null); fetchActiveSession({ silent: false }); }}
              className="hq-action" style={{ background: HQ.PAPER, border: `1px solid ${HQ.LINE}`, color: HQ.INK, padding: '0 20px', fontSize: 14 }}>
              <RefreshCw size={15} /> تحديث يدوي
            </button>
          </div>
        </div>
      </div>
    );
  }

  const rail = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <WirdCard task={myDailyTask}
        open={showWirdCard} onToggle={() => setShowWirdCard(v => !v)} />
      <PresenceBar state="joined" pinging={Boolean(pingActive)} onOpen={() => setDrawerOpen(true)} />
    </div>
  );

  return (
    <div className="halaqa" dir="rtl"
      style={{ height: '100vh', maxHeight: '100dvh', width: '100%', background: HQ.PAPER, display: 'flex', flexDirection: 'column', overflow: 'hidden', userSelect: 'none' }}>
      {/* Slim paper header — chrome stays paper, only the stage is dark */}
      <header style={{ background: HQ.SURFACE, borderBottom: `1px solid ${HQ.LINE}`, padding: '0 12px', height: 56, flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <span className="hq-live-dot" aria-hidden />
          <strong style={{ fontSize: 15, color: HQ.INK, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '38vw' }}>
            {session?.title || 'الحلقة المباشرة'}
          </strong>
          <span className="hidden md:inline" style={{ fontSize: 12, color: '#15803D', fontWeight: 700, background: '#DCFCE7', padding: '2px 8px', borderRadius: 12 }}>جلسة فردية مباشرة</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 'none' }}>
          {isSessionLive && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: HQ.MUTED, fontWeight: 700 }}>
              <Clock size={14} color={HQ.MENTOR} />{formatCountdown(duration)}
            </span>
          )}
        </div>
      </header>

      {/* Body: stage + rail (desktop) / stage + sheet (mobile) */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', gap: 16, padding: 16, paddingBottom: 8 }}>
        {/* ── Stage: the only dark surface ── */}
        <div className="halaqa-stage hq-stagebox" style={{ flex: 1, minWidth: 0, borderRadius: 18, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ flex: 1, minHeight: 0, borderRadius: 12, overflow: 'hidden', background: '#0C0C1D', position: 'relative' }}>
            {session?._id && (
              <JitsiMeeting
                roomName={session?.liveRoomName || `QuranPlatform_${session._id}`}
                displayName={`${user?.firstName || ''} ${user?.lastName || ''}`.trim() || 'طالب'}
                userEmail={user?.email}
                focusParticipantName={session?.teacher ? `${session.teacher.firstName || ''} ${session.teacher.lastName || ''}`.trim() : ''}
                onLeave={handleLeave}
              />
            )}
          </div>
        </div>

        {/* Desktop rail — visually lighter than the stage */}
        <aside aria-label="لوحات الحلقة" className="hidden lg:block"
          style={{ width: 340, flex: 'none', overflowY: 'auto', paddingBottom: 8 }}>
          {rail}
        </aside>
      </div>

      {/* Mobile bottom sheet — wird / presence */}
      <div className="lg:hidden" style={{
        flex: 'none', background: HQ.SURFACE, borderTop: `1px solid ${HQ.LINE}`,
        borderRadius: '18px 18px 0 0', maxHeight: drawerOpen ? '52dvh' : 'none',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        <button type="button" onClick={() => setDrawerOpen(o => !o)} aria-expanded={drawerOpen}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '8px 16px 6px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, minHeight: 48 }}>
          <span className="hq-grip" aria-hidden />
          <span style={{ fontSize: 13, fontWeight: 800, color: HQ.INK }}>
            {drawerOpen ? 'إخفاء لوحات الحلقة' : 'الورد والحضور'}
          </span>
        </button>
        <div style={{
          display: 'grid', gridTemplateRows: drawerOpen ? '1fr' : '0fr',
          transition: 'grid-template-rows 0.25s ease',
        }}>
          <div style={{ overflow: drawerOpen ? 'auto' : 'hidden', padding: drawerOpen ? '4px 16px 16px' : '0 16px', minHeight: 0 }}>
            {rail}
          </div>
        </div>
      </div>

      {/* Attendance ping — paper alert above the action bar, never floating glass */}
      {pingActive && (
        <div role="alert" className="hq-ping" style={{
          flex: 'none', margin: '8px 16px 0', background: HQ.SURFACE,
          border: `2px solid ${HQ.MENTOR}`, borderRadius: 18,
          display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
        }}>
          <span style={{ width: 44, height: 44, borderRadius: 12, background: HQ.PAPER, color: HQ.MENTOR, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
            <Bell size={22} />
          </span>
          <span style={{ flex: 1, minWidth: 180 }}>
            <strong style={{ display: 'block', fontSize: 15, color: HQ.INK }}>المعلم ينادي الحضور</strong>
            <span style={{ fontSize: 13, color: HQ.MUTED }}>{pingActive.message} — متبقي {pingActive.remaining} ثانية</span>
          </span>
          <button type="button" onClick={handleConfirmAttendance} disabled={confirmingPong}
            className="hq-action m-full" style={{ background: HQ.MENTOR, color: '#fff', padding: '0 24px', fontSize: 15, opacity: confirmingPong ? 0.6 : 1 }}>
            <CheckCircle2 size={17} /> أنا متواجد
          </button>
        </div>
      )}

      {/* Shared mushaf banner from teacher */}
      {sharedMushaf?.sharing && !showSharedMushaf && (
        <div role="status" className="hq-ping" style={{
          flex: 'none', margin: '8px 16px 0', background: '#F8EDD3',
          border: '2px solid #D9A441', borderRadius: 18,
          display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
        }}>
          <span style={{ width: 44, height: 44, borderRadius: 12, background: '#fff', color: '#7C5A12', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
            <BookOpen size={22} />
          </span>
          <span style={{ flex: 1, minWidth: 180 }}>
            <strong style={{ display: 'block', fontSize: 15, color: HQ.INK }}>المعلم يشارك المصحف معك الآن</strong>
            <span style={{ fontSize: 13, color: HQ.MUTED }}>تابع الآيات المظللة لحظة بلحظة</span>
          </span>
          <button type="button" onClick={() => setShowSharedMushaf(true)}
            className="hq-action" style={{ background: HQ.MENTOR, color: '#fff', padding: '0 24px', fontSize: 15 }}>
            <BookOpen size={17} /> عرض المصحف
          </button>
        </div>
      )}

      {/* Fixed bottom action bar — every target ≥48px */}
      <nav aria-label="إجراءات الحصة" className="hq-actionbar"
        style={{ flex: 'none', display: 'flex', gap: 8, padding: '8px 16px', justifyContent: 'center' }}>
        <button type="button" onClick={() => { setDrawerOpen(true); setShowWirdCard(true); }} className="hq-action hq-wird-btn"
          style={{ flex: 1, maxWidth: 180, fontSize: 15, background: HQ.PAPER, border: `1px solid ${HQ.LINE}`, color: HQ.INK }}>
          <BookOpen size={18} /> وردي
        </button>
        <button type="button" onClick={handleLeave} className="hq-action"
          style={{ flex: 1, maxWidth: 180, fontSize: 15, background: '#C2410C', color: '#fff' }}>
          <PhoneOff size={18} /> مغادرة
        </button>
      </nav>

      {/* Shared mushaf overlay sheet */}
      {showSharedMushaf && sharedMushaf?.sharing && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', background: 'rgba(12,12,29,0.55)' }}>
          <div className="halaqa" dir="rtl" style={{
            background: HQ.SURFACE, borderRadius: '20px 20px 0 0', padding: 16,
            width: '100%', maxWidth: 720, height: '82dvh', maxHeight: 640,
            border: `1px solid ${HQ.LINE}`, borderBottom: 'none',
          }}>
            <MushafSharePanel
              range={sharedMushaf}
              onClose={() => setShowSharedMushaf(false)}
              title="مصحف المعلم المشترك"
            />
          </div>
        </div>
      )}
    </div>
  );
}
