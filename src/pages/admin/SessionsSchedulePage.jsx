import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { RotateCcw, Radio, CheckCircle, BookOpen } from 'lucide-react';
import toast from 'react-hot-toast';
import PageLayout from '../../components/shared/PageLayout';
import WirdAssignModal from '../../components/shared/WirdAssignModal';
import api from '../../services/api';
import { getLevelLabel, formatTime12Ar } from '../../utils/helpers';
import LoadingSpinner from '../../components/shared/LoadingSpinner';
import '../../components/halaqa/halaqa.css';
import { HQ, HqAvatar, HqBadge } from '../../components/halaqa/primitives';

/* مواعيد الحصص — كل الطلاب المجدولين مرتبين حسب اليوم والساعة،
   والحصة التي حان موعدها مميزة، مع زر بدء بث فوري. */

const WEEK_DAYS = ['السبت', 'الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة'];
const JS_DAY_TO_AR = { 0: 'الأحد', 1: 'الاثنين', 2: 'الثلاثاء', 3: 'الأربعاء', 4: 'الخميس', 5: 'الجمعة', 6: 'السبت' };
const SESSION_WINDOW_MIN = 60; // الحصة تُعتبر حانية لمدة ساعة من بدايتها

const toMinutes = (t) => {
  if (!t || typeof t !== 'string') return null;
  const [h, m] = t.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
};

export default function SessionsSchedulePage() {
  const navigate = useNavigate();
  const [students, setStudents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [startingId, setStartingId] = useState(null);
  const [wirdUser, setWirdUser] = useState(null);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => { fetchData(); }, []);

  // إعادة تقييم "حان الموعد" كل دقيقة
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(id);
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    setLoadFailed(false);
    try {
      const res = await api.get('/users', { params: { role: 'student', limit: 200 } });
      setStudents((res.data.users || []).filter(u =>
        u.isActive !== false && (u.scheduleDays?.length) && u.sessionTime
      ));
    } catch {
      setLoadFailed(true);
      toast.error('خطأ في جلب البيانات');
    } finally { setIsLoading(false); }
  };

  const todayName = JS_DAY_TO_AR[now.getDay()];
  const nowMin = now.getHours() * 60 + now.getMinutes();

  // أيام الأسبوع بدءاً من اليوم، وكل يوم حصصه مرتبة بالساعة
  const days = useMemo(() => {
    const startIdx = WEEK_DAYS.indexOf(todayName);
    const ordered = WEEK_DAYS.slice(startIdx).concat(WEEK_DAYS.slice(0, startIdx));
    return ordered.map((day, dayOffset) => {
      const entries = [];
      students.forEach(u => {
        if ((u.scheduleDays || []).includes(day)) {
          const mins = toMinutes(u.sessionTime);
          if (mins === null) return;
          let status = 'future';
          if (dayOffset === 0) {
            if (nowMin >= mins && nowMin < mins + SESSION_WINDOW_MIN) status = 'now';
            else if (nowMin < mins) status = 'upcoming';
            else status = 'passed';
          }
          entries.push({ student: u, mins, status });
        }
      });
      entries.sort((a, b) => a.mins - b.mins);
      return { day, dayOffset, entries };
    });
  }, [students, todayName, nowMin]);

  const nowList = days[0]?.entries.filter(e => e.status === 'now') || [];
  const todayUpcoming = days[0]?.entries.filter(e => e.status === 'upcoming') || [];

  const handleQuickStart = async (u) => {
    setStartingId(u._id);
    try {
      const res = await api.post(`/live/student/${u._id}/start`, {});
      toast.success(`انطلق البث مع ${u.firstName}`);
      navigate('/admin/live', {
        state: {
          sessionId: res.data.session._id,
          studentId: u._id,
          studentName: `${u.firstName} ${u.lastName}`,
          lessonId: res.data.lessonId,
          lessonTitle: res.data.session.title,
          isIndividual: true,
        },
      });
    } catch (err) {
      toast.error(err?.response?.data?.message || 'خطأ في بدء البث');
    } finally { setStartingId(null); }
  };

  const statusBadge = (status) => {
    if (status === 'now') return <HqBadge tone="mentor">🟢 حان موعدها الآن</HqBadge>;
    if (status === 'upcoming') return <HqBadge tone="gold">اليوم</HqBadge>;
    if (status === 'passed') return <HqBadge tone="neutral">انتهت اليوم</HqBadge>;
    return null;
  };

  return (
    <PageLayout>
      <div className="halaqa" style={{ maxWidth: 860, margin: '0 auto' }}>
        <h1 style={{ margin: '0 0 4px', fontSize: 26, fontWeight: 900, color: HQ.INK }}>مواعيد الحصص</h1>
        <p style={{ margin: '0 0 16px', fontSize: 14, color: HQ.MUTED }}>
          اليوم: {todayName} · {nowList.length ? `${nowList.length} حصة حان موعدها الآن` : todayUpcoming.length ? `القادمة اليوم الساعة ${formatTime12Ar(todayUpcoming[0].student.sessionTime)}` : 'لا حصص متبقية اليوم'}
        </p>

        {isLoading ? (
          <div aria-label="جارٍ التحميل">
            <div className="hq-skeleton" style={{ height: 76, width: '100%', marginBottom: 10 }} />
            <div className="hq-skeleton" style={{ height: 76, width: '100%' }} />
          </div>
        ) : loadFailed ? (
          <div style={{ background: HQ.SURFACE, border: `1px solid ${HQ.LINE}`, borderRadius: 18, padding: 40, textAlign: 'center' }} role="alert">
            <p style={{ margin: '0 0 20px', fontSize: 16, fontWeight: 800, color: HQ.INK }}>تعذّر تحميل البيانات</p>
            <button type="button" onClick={fetchData} className="hq-action" style={{ background: HQ.MENTOR, color: '#fff', padding: '0 24px', fontSize: 15 }}>
              <RotateCcw size={16} /> إعادة المحاولة
            </button>
          </div>
        ) : students.length === 0 ? (
          <div style={{ background: HQ.SURFACE, border: `1px solid ${HQ.LINE}`, borderRadius: 18, padding: 40, textAlign: 'center' }}>
            <CheckCircle size={40} color={HQ.MUTED} style={{ margin: '0 auto 12px' }} />
            <p style={{ margin: 0, fontSize: 16, fontWeight: 800, color: HQ.INK }}>لا توجد حصص مجدولة بعد</p>
            <p style={{ margin: '4px 0 0', fontSize: 14, color: HQ.MUTED }}>جدول مواعيد الطلاب من صفحة بانتظار تحديد المستوى</p>
          </div>
        ) : (
          days.filter(d => d.entries.length).map(d => (
            <section key={d.day} aria-label={`حصص يوم ${d.day}`} style={{ marginBottom: 20 }}>
              <h2 style={{ margin: '0 0 8px', fontSize: 17, fontWeight: 900, color: HQ.INK, display: 'flex', alignItems: 'center', gap: 8 }}>
                {d.dayOffset === 0 ? `اليوم (${d.day})` : d.day}
                <span style={{ fontSize: 12, fontWeight: 700, color: HQ.MUTED }}>{d.entries.length} {d.entries.length === 1 ? 'حصة' : 'حصص'}</span>
              </h2>
              <ol style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {d.entries.map(({ student: u, status }) => {
                  const isNow = status === 'now';
                  const dimmed = status === 'passed';
                  return (
                    <li key={`${u._id}-${d.day}`}
                      style={{
                        background: isNow ? '#E2EFE7' : HQ.SURFACE,
                        border: `2px solid ${isNow ? HQ.MENTOR : HQ.LINE}`,
                        borderRadius: 18, marginBottom: 10, padding: 14,
                        opacity: dimmed ? 0.6 : 1,
                      }}>
                      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                        <HqAvatar firstName={u.firstName} lastName={u.lastName} size={44} />
                        <div style={{ flex: 1, minWidth: 180 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <strong style={{ fontSize: 16, color: HQ.INK }}>{u.firstName} {u.lastName}</strong>
                            {statusBadge(status)}
                          </div>
                          <p style={{ margin: '2px 0 0', fontSize: 13, color: HQ.MUTED }}>
                            الساعة <strong style={{ color: isNow ? '#0F5940' : HQ.INK, fontSize: 15 }}>{formatTime12Ar(u.sessionTime)}</strong>
                            {u.assignedLevel ? ` · ${getLevelLabel(u.assignedLevel)}` : ''}
                          </p>
                        </div>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          <button type="button" onClick={() => handleQuickStart(u)} disabled={startingId === u._id}
                            className="hq-action"
                            style={{ background: isNow ? HQ.MENTOR : HQ.PAPER, color: isNow ? '#fff' : HQ.MENTOR, border: isNow ? 'none' : `1.5px solid ${HQ.MENTOR}`, padding: '0 16px', fontSize: 14, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                            {startingId === u._id ? <LoadingSpinner size="sm" /> : <><Radio size={16} /> {isNow ? 'ابدأ البث الآن' : 'بدء بث'}</>}
                          </button>
                          <button type="button" onClick={() => setWirdUser(u)}
                            className="hq-action"
                            style={{ background: HQ.PAPER, border: `1px solid ${HQ.LINE}`, color: HQ.INK, padding: '0 16px', fontSize: 14, display: 'inline-flex', alignItems: 'center', gap: 6 }}
                            title="إعطاء ورد للطالب">
                            <BookOpen size={16} /> الورد
                          </button>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </section>
          ))
        )}

        {/* Wird assignment (shared modal) */}
        <WirdAssignModal
          open={Boolean(wirdUser)}
          studentId={wirdUser?._id}
          studentName={wirdUser ? `${wirdUser.firstName} ${wirdUser.lastName}` : ''}
          onClose={() => setWirdUser(null)}
        />
      </div>
    </PageLayout>
  );
}
