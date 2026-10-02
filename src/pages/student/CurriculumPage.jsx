import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  BookOpen, ExternalLink, Video,
  Award, MessageCircle, Search, ChevronDown,
} from 'lucide-react';
import Navbar from '../../components/shared/Navbar';
import Sidebar from '../../components/shared/Sidebar';
import MobileBottomNav from '../../components/shared/MobileBottomNav';
import useAuthStore from '../../store/authStore';
import api from '../../services/api';
import VideoPlayer, { isVideoUrl } from '../../components/shared/VideoPlayer';
import Pagination from '../../components/shared/Pagination';
import { LESSON_TYPES_AR } from '../../utils/constants';
import { getLevelLabel, formatDateAr } from '../../utils/helpers';
import '../../components/halaqa/halaqa.css';
import { HQ, HqBadge } from '../../components/halaqa/primitives';

/* الحصص السابقة — أرشيف الحصص التي أخذها الطالب مع المعلم.
   كل حصة تعرض اختبارها ومصادرها فقط. */

export default function CurriculumPage() {
  const { user } = useAuthStore();
  const [activeSession, setActiveSession]   = useState(null);
  const [sidebarOpen, setSidebarOpen]       = useState(false);
  const [customLessons, setCustomLessons]   = useState([]);
  const [isLoading, setIsLoading]           = useState(true);
  const [expandedLesson, setExpandedLesson] = useState(null);
  const [query, setQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);

  // الأحدث أولاً (بتاريخ الإنشاء، ثم رقم الحصة)
  const sortedLessons = [...customLessons].sort((a, b) => {
    const da = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const db = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    if (db !== da) return db - da;
    return (b.lessonNumber || 0) - (a.lessonNumber || 0);
  });
  const latestId = sortedLessons[0]?._id?.toString();

  const visibleLessons = sortedLessons.filter(l =>
    !query.trim() || (l.title || '').includes(query.trim())
  );
  const totalPages = Math.max(1, Math.ceil(visibleLessons.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const pagedLessons = visibleLessons.slice((safePage - 1) * pageSize, safePage * pageSize);

  const handleQuery = (v) => {
    setQuery(v);
    setCurrentPage(1);
  };

  /* ── Data fetching ── */
  useEffect(() => {
    const fetch = async () => {
      setIsLoading(true);
      try {
        // Fetch individual study plan (created from direct 1-on-1 sessions)
        if (user?._id) {
          const indPlanRes = await api.get(`/study-plans/student/${user._id}/full`).catch(() => null);
          if (indPlanRes?.data?.plan?.customLessons?.length) {
            setCustomLessons(indPlanRes.data.plan.customLessons);
            setIsLoading(false);
            return;
          }
        }
        setCustomLessons([]);
      } catch {} finally { setIsLoading(false); }
    };
    fetch();

    api.get('/live/active/me').then(res => {
      if (res.data?.session) setActiveSession(res.data.session);
    }).catch(() => {});
  }, [user]);

  const totalLessons = customLessons.length;

  const h2 = { margin: 0, fontSize: 18, fontWeight: 800, color: HQ.INK };

  /* ── Loading: skeleton of the known structure ── */
  if (isLoading) return (
    <div className="halaqa" style={{ minHeight: '100vh', background: HQ.PAPER }}>
      <Navbar onMenuClick={() => setSidebarOpen(true)} />
      <main style={{ paddingTop: 64, paddingBottom: 80 }}>
        <div style={{ maxWidth: 820, margin: '0 auto', padding: '24px 16px' }} aria-label="جارٍ تحميل الحصص السابقة">
          <div className="hq-skeleton" style={{ height: 26, width: '40%', marginBottom: 8 }} />
          <div className="hq-skeleton" style={{ height: 14, width: '65%', marginBottom: 20 }} />
          <div className="hq-skeleton" style={{ height: 64, width: '100%', marginBottom: 12 }} />
          <div className="hq-skeleton" style={{ height: 64, width: '100%', marginBottom: 12 }} />
          <div className="hq-skeleton" style={{ height: 64, width: '100%' }} />
        </div>
      </main>
    </div>
  );

  const hasContent = customLessons.length > 0;

  return (
    <div className="halaqa" style={{ minHeight: '100vh', background: HQ.PAPER }}>
      <Navbar onMenuClick={() => setSidebarOpen(true)} />
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <main className="lg:mr-64 sess-main" style={{ paddingTop: 64, paddingBottom: 88 }}>
        <div style={{ maxWidth: 820, margin: '0 auto', padding: '24px 16px' }}>

          {/* ── Header ── */}
          <p style={{ margin: 0, fontSize: 14, color: HQ.MUTED }}>
            {user?.assignedLevel ? getLevelLabel(user.assignedLevel) : 'الحصص السابقة'}
          </p>
          <h1 style={{ margin: '2px 0 4px', fontSize: 26, fontWeight: 900, color: HQ.INK }}>الحصص السابقة</h1>
          <p style={{ margin: '0 0 16px', fontSize: 14, color: HQ.MUTED }}>
            {hasContent ? `لديك ${totalLessons} من الحصص السابقة` : 'الحصص التي أخذتها مع المعلم'}
          </p>


          {/* ── Live banner (functional, flat) ── */}
          {activeSession && activeSession.status === 'live' && (
            <div role="status" style={{ marginBottom: 20, background: '#C2410C', color: '#fff', borderRadius: 18, padding: 16, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <span className="hq-live-dot" aria-hidden style={{ background: '#fff', animation: 'none', opacity: 1 }} />
              <span style={{ flex: 1, minWidth: 180 }}>
                <strong style={{ display: 'block', fontSize: 15 }}>الحصة منعقدة الآن{activeSession.title ? `: ${activeSession.title}` : ''}</strong>
                <span style={{ fontSize: 13, opacity: 0.9 }}>انضم للتسميع والمشاركة في الحلقة</span>
              </span>
              <Link to="/student/live" className="hq-action" style={{ background: '#fff', color: '#C2410C', padding: '0 20px', fontSize: 14, textDecoration: 'none' }}>
                <Video size={16} /> انضم الآن
              </Link>
            </div>
          )}

              {!hasContent ? (
                <div style={{ background: HQ.SURFACE, border: `1px solid ${HQ.LINE}`, borderRadius: 18, padding: 48, textAlign: 'center' }}>
                  <BookOpen size={44} color={HQ.LINE} style={{ margin: '0 auto 12px' }} />
                  <h2 style={h2}>لا توجد حصص سابقة بعد</h2>
                  <p style={{ color: HQ.MUTED, fontSize: 14, margin: '0 0 20px' }}>ستظهر هنا الحصص التي تأخذها مع المعلم في الجلسات المباشرة</p>
                </div>
              ) : (
                <>
                  {/* ── Sessions list ── */}
                  <h2 style={{ ...h2, marginBottom: 4 }}>الحصص السابقة ({totalLessons})</h2>
                  <div style={{ position: 'relative', margin: '8px 0 12px' }}>
                    <Search size={16} color={HQ.MUTED} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)' }} />
                    <input
                      value={query}
                      onChange={e => handleQuery(e.target.value)}
                      placeholder="ابحث باسم الحصة..."
                      aria-label="بحث في الحصص السابقة"
                      style={{
                        width: '100%', minHeight: 48, background: HQ.SURFACE, color: HQ.INK,
                        border: `1px solid ${HQ.LINE}`, borderRadius: 12, padding: '12px 40px 12px 16px', fontSize: 16,
                      }}
                    />
                  </div>
                  {visibleLessons.length === 0 ? (
                    <p style={{ fontSize: 14, color: HQ.MUTED, textAlign: 'center', padding: '20px 0' }}>لا توجد حصص مطابقة للبحث</p>
                  ) : (
                  <ol className="sess-list sess-grid" style={{ listStyle: 'none', margin: '8px 0 0', padding: 0 }}>
                    {pagedLessons.map((lesson, i) => {
                      const lid         = lesson._id;
                      const lidStr      = lid?.toString();
                      const isExpanded  = expandedLesson === lid;
                      const hasVideo    = isVideoUrl(lesson.resources);
                      const isLatest    = lidStr && lidStr === latestId && !query.trim();
                      const isLiveForThis = activeSession && activeSession.status === 'live' && (activeSession.lessonCovered?.toString() === lidStr || (!activeSession.lessonCovered && lidStr === latestId));

                      return (
                        <li key={lid || i}
                          style={{
                            background: isLatest ? '#E2EFE7' : HQ.SURFACE,
                            border: isLatest ? `2px solid ${HQ.MENTOR}` : `1px solid ${HQ.LINE}`,
                            borderRadius: 18, marginBottom: 12, overflow: 'hidden',
                          }}>
                          {/* Row header — toggle button separate from action links */}
                          <div className="sess-row"
                            style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 14, minHeight: 64 }}
                          >
                            <button
                              type="button"
                              onClick={() => setExpandedLesson(isExpanded ? null : lid)}
                              aria-expanded={isExpanded}
                              aria-label={`${isExpanded ? 'إخفاء' : 'عرض'} تفاصيل ${lesson.title}`}
                              style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0, background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'right', fontFamily: 'inherit' }}
                            >
                              <span aria-hidden
                                style={{
                                  width: 30, height: 30, borderRadius: 9999, flex: 'none',
                                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                  fontSize: 13, fontWeight: 800,
                                  background: 'transparent',
                                  color: HQ.MUTED,
                                  border: `2px solid ${HQ.LINE}`,
                                }}>
                                {(lesson.lessonNumber || '•')}
                              </span>

                              <span style={{ flex: 1, minWidth: 0 }}>
                                <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                  <strong className="sess-title" style={{ fontSize: 16, color: isLatest ? '#0F5940' : HQ.INK }}>
                                    {lesson.title}
                                  </strong>
                                  {isLatest && <HqBadge tone="mentor">أحدث حصة</HqBadge>}
                                  {isLiveForThis && (
                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 800, color: '#C2410C' }}>
                                      <span className="hq-live-dot" aria-hidden /> الحصة الآن
                                    </span>
                                  )}
                                </span>
                                <span style={{ display: 'block', fontSize: 13, color: HQ.MUTED, marginTop: 2 }}>
                                  {lesson.createdAt ? formatDateAr(lesson.createdAt) : ''}
                                  {LESSON_TYPES_AR?.[lesson.type] ? ` · ${LESSON_TYPES_AR[lesson.type]}` : ''}
                                  {lesson.duration ? ` · ${lesson.duration} دقيقة` : ''}
                                  {hasVideo ? ' · فيديو' : ''}
                                </span>
                              </span>
                              <ChevronDown size={18} color={HQ.MUTED} aria-hidden style={{ transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease', flex: 'none' }} />
                            </button>

                            <span className="sess-actions" style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 'none' }}>
                              {isLiveForThis && (
                                <Link to="/student/live" className="hq-action" style={{ background: '#C2410C', color: '#fff', padding: '0 16px', fontSize: 13, textDecoration: 'none' }}>
                                  <Video size={15} /> انضم
                                </Link>
                              )}
                              <Link to={`/student/lessons/${lid}/discussion`} className="hq-action"
                                aria-label={`نقاش ${lesson.title}`}
                                style={{
                                  background: HQ.PAPER, color: HQ.MENTOR,
                                  border: `1.5px solid ${HQ.LINE}`,
                                  padding: '0 16px', fontSize: 13, textDecoration: 'none',
                                }}>
                                <MessageCircle size={15} /> نقاش الحصة
                              </Link>
                            </span>
                          </div>

                          {/* Expanded: exam + sources only */}
                          {isExpanded && (
                            <div style={{ borderTop: `1px solid ${HQ.LINE}`, padding: 14 }}>
                              {lesson.description && (
                                <p style={{ margin: '0 0 12px', fontSize: 14, color: HQ.MUTED, lineHeight: 1.8 }}>{lesson.description}</p>
                              )}

                              {(lesson.videoUrl || hasVideo) && (
                                <div style={{ marginBottom: 12 }}>
                                  <VideoPlayer url={lesson.videoUrl || lesson.resources} title={lesson.title} />
                                </div>
                              )}

                              {lesson.resources && (
                                <div style={{ marginBottom: 12 }}>
                                  <a href={lesson.resources} target="_blank" rel="noreferrer"
                                    className="sess-block-btn"
                                    style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 700, color: HQ.MENTOR, background: '#E2EFE7', borderRadius: 12, padding: '12px 16px', textDecoration: 'none', minHeight: 48 }}>
                                    <ExternalLink size={16} /> فتح مصادر وروابط الحصة
                                  </a>
                                </div>
                              )}

                              {lesson.exam && (
                                <div style={{ marginBottom: 12 }}>
                                  <Link to={`/student/exams/${lesson.exam._id || lesson.exam}/take`}
                                    className="sess-block-btn"
                                    style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 700, color: '#fff', background: HQ.MENTOR, borderRadius: 12, padding: '12px 16px', textDecoration: 'none', minHeight: 48 }}>
                                    <Award size={16} /> دخول اختبار الحصة
                                  </Link>
                                </div>
                              )}

                              {!lesson.resources && !lesson.exam && (
                                <p style={{ margin: 0, fontSize: 14, color: HQ.MUTED }}>لا يوجد اختبار أو مصادر مرفقة بهذه الحصة بعد</p>
                              )}
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ol>
                  )}
                  {visibleLessons.length > 0 && (
                    <Pagination
                      currentPage={safePage}
                      totalPages={totalPages}
                      totalItems={visibleLessons.length}
                      pageSize={pageSize}
                      onPageChange={setCurrentPage}
                      onPageSizeChange={(s) => { setPageSize(s); setCurrentPage(1); }}
                      showPageSize={true}
                      pageSizeOptions={[5, 10, 20]}
                      itemName="حصة"
                      className="pt-2"
                    />
                  )}
                </>
              )}
        </div>
      </main>
      <MobileBottomNav />
    </div>
  );
}
