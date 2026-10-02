import { useState, useEffect } from 'react';
import { Video, Bell, Plus, ChevronLeft, RotateCcw, Radio } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import PageLayout from '../../components/shared/PageLayout';
import useAuthStore from '../../store/authStore';
import useNotifications from '../../hooks/useNotifications';
import { getLevelLabel, formatTime12Ar } from '../../utils/helpers';
import api from '../../services/api';
import toast from 'react-hot-toast';
import LoadingSpinner from '../../components/shared/LoadingSpinner';
import '../../components/halaqa/halaqa.css';
import { HQ, HqAvatar, HqBadge } from '../../components/halaqa/primitives';

/* لوحة المعلم — النظام فردي: قائمة الطلاب وبدء البث المباشر معهم. */

export default function TeacherDashboard() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [students, setStudents] = useState([]);
  const [todayStats, setTodayStats] = useState({ pendingReviews: 0, attendanceRate: '—' });
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [startingId, setStartingId] = useState(null);
  useNotifications();

  const loadAll = () => {
    setLoading(true);
    setLoadFailed(false);
    api.get('/users/students/list').then(res => {
      setStudents(res.data.students || []);
    }).catch(() => {});
    fetchStats().finally(() => setLoading(false));
  };

  useEffect(() => {
    loadAll();
  }, []);

  const fetchStats = async () => {
    try {
      const [pendingRes, reportsRes] = await Promise.all([
        api.get(`/exams/results/pending-review?teacherId=${user._id}`),
        api.get('/reports/analytics').catch(() => null),
      ]);
      const attendanceRate = reportsRes?.data?.summary?.attendanceRate;
      setTodayStats({
        pendingReviews: pendingRes.data.results?.length || 0,
        attendanceRate: attendanceRate || '—',
      });
    } catch {
      setLoadFailed(true);
    }
  };

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
    } finally {
      setStartingId(null);
    }
  };

  return (
    <PageLayout>
      <div className="halaqa" style={{ maxWidth: 860, margin: '0 auto' }}>
        <p style={{ margin: 0, fontSize: 14, color: HQ.MUTED }}>يومك التعليمي</p>
        <h1 style={{ margin: '2px 0 16px', fontSize: 32, fontWeight: 800, color: HQ.INK }}>
          أهلًا {user?.firstName || 'أستاذنا'}
        </h1>

        {loading ? (
          <div aria-label="جارٍ تحميل لوحتك">
            <div className="hq-skeleton" style={{ height: 64, width: '100%', marginBottom: 12 }} />
            <div className="hq-skeleton" style={{ height: 64, width: '100%', marginBottom: 12 }} />
            <div className="hq-skeleton" style={{ height: 64, width: '100%' }} />
          </div>
        ) : loadFailed ? (
          <div style={{ background: HQ.SURFACE, border: `1px solid ${HQ.LINE}`, borderRadius: 18, padding: 40, textAlign: 'center' }} role="alert">
            <p style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 900, color: HQ.INK }}>تعذّر تحميل لوحتك</p>
            <p style={{ margin: '0 0 20px', fontSize: 14, color: HQ.MUTED }}>تحقق من الاتصال ثم حاول مرة أخرى.</p>
            <button type="button" onClick={loadAll} className="hq-action" style={{ background: HQ.MENTOR, color: '#fff', padding: '0 24px', fontSize: 15 }}>
              <RotateCcw size={16} /> إعادة المحاولة
            </button>
          </div>
        ) : (
          <>
            {/* Today facts — one quiet line each, never stat tiles */}
            <section aria-label="وضع اليوم"
              style={{ background: HQ.SURFACE, border: `1px solid ${HQ.LINE}`, borderRadius: 18, padding: 16, marginBottom: 16 }}>
              <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', fontSize: 14, marginBottom: todayStats.pendingReviews > 0 ? 12 : 0 }}>
                <span><strong style={{ color: HQ.INK, fontSize: 18 }}>{students.length}</strong> <span style={{ color: HQ.MUTED }}>طالبًا</span></span>
                <span><strong style={{ color: HQ.INK, fontSize: 18 }}>{todayStats.attendanceRate}</strong> <span style={{ color: HQ.MUTED }}>حضور</span></span>
              </div>
              {todayStats.pendingReviews > 0 && (
                <Link to="/teacher/review"
                  style={{ display: 'flex', alignItems: 'center', gap: 10, background: HQ.PAPER, border: `1px solid ${HQ.LINE}`, borderRadius: 12, padding: '12px 14px', textDecoration: 'none', minHeight: 56 }}>
                  <Bell size={18} color="#B45309" style={{ flex: 'none' }} />
                  <span style={{ flex: 1, fontSize: 14, fontWeight: 800, color: HQ.INK }}>
                    {todayStats.pendingReviews} بانتظار مراجعتك
                  </span>
                  <ChevronLeft size={18} color={HQ.MUTED} />
                </Link>
              )}
            </section>

            {/* Primary actions */}
            <section aria-label="إجراءاتك" style={{ marginBottom: 16 }}>
              {[
                { to: '/admin/live', icon: Video, title: 'الغرفة التفاعلية وبدء البث', hint: 'بدء الجلسة الفردية المباشرة مع الطالب', primary: true },
                { to: '/teacher/review', icon: Bell, title: 'مركز المراجعة', hint: 'التسميعات والاختبارات بانتظار التصحيح' },
                { to: '/teacher/create-exam', icon: Plus, title: 'نشاط أو اختبار جديد', hint: 'قيّم طلابك بتكليف جديد' },
              ].map(a => (
                <Link key={a.to + a.title} to={a.to}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none',
                    background: a.primary ? HQ.MENTOR : HQ.SURFACE, color: a.primary ? '#fff' : HQ.INK,
                    border: a.primary ? 'none' : `1px solid ${HQ.LINE}`,
                    borderRadius: 14, padding: '12px 16px', marginBottom: 8, minHeight: 60,
                  }}>
                  <a.icon size={19} style={{ flex: 'none' }} />
                  <span style={{ flex: 1 }}>
                    <strong style={{ display: 'block', fontSize: 15 }}>{a.title}</strong>
                    <span style={{ display: 'block', fontSize: 13, opacity: 0.75 }}>{a.hint}</span>
                  </span>
                  <ChevronLeft size={18} style={{ opacity: 0.6 }} />
                </Link>
              ))}
            </section>

            {/* Students — individual system: start 1-on-1 live directly */}
            <section aria-label={`طلابي (${students.length})`}
              style={{ background: HQ.SURFACE, border: `1px solid ${HQ.LINE}`, borderRadius: 18, padding: 16 }}>
              <h2 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 800, color: HQ.INK }}>
                طلابي ({students.length})
              </h2>
              {students.length === 0 ? (
                <p style={{ fontSize: 14, color: HQ.MUTED, margin: '8px 0 0' }}>لا يوجد طلاب بعد — سيظهر هنا الطلاب المسجلون.</p>
              ) : (
                <ol style={{ listStyle: 'none', margin: '8px 0 0', padding: 0 }}>
                  {students.map((u) => (
                    <li key={u._id} style={{ padding: '12px 0', borderTop: `1px solid ${HQ.LINE}` }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                        <HqAvatar firstName={u.firstName} lastName={u.lastName} size={40} />
                        <div style={{ flex: 1, minWidth: 160 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <strong style={{ fontSize: 15, color: HQ.INK }}>{u.firstName} {u.lastName}</strong>
                            {u.assignedLevel && <HqBadge tone="mentor">{getLevelLabel(u.assignedLevel)}</HqBadge>}
                          </div>
                          {(u.scheduleDays?.length > 0 || u.sessionTime) && (
                            <p style={{ margin: '2px 0 0', fontSize: 13, color: HQ.MUTED }}>
                              {u.scheduleDays?.join('، ') || ''} {u.sessionTime ? `(الساعة ${formatTime12Ar(u.sessionTime)})` : ''}
                            </p>
                          )}
                        </div>
                        <button type="button" onClick={() => handleQuickStart(u)} disabled={startingId === u._id}
                          className="hq-action"
                          style={{ background: HQ.MENTOR, color: '#fff', padding: '0 16px', fontSize: 14, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          {startingId === u._id ? <LoadingSpinner size="sm" /> : <><Radio size={16} /> بدء بث</>}
                        </button>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          </>
        )}
      </div>
    </PageLayout>
  );
}
