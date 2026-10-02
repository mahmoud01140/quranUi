import { useState, useEffect } from 'react';
import {
  Users, Clock, Plus, Trash2, AlertCircle, CheckCircle2, XCircle,
  Calendar, MessageSquare, Mail, RotateCcw,
} from 'lucide-react';
import PageLayout from '../../components/shared/PageLayout';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { timeAgoAr, getLevelLabel } from '../../utils/helpers';
import Pagination from '../../components/shared/Pagination';
import usePagination from '../../hooks/usePagination';
import '../../components/halaqa/halaqa.css';
import { HQ, HqAvatar } from '../../components/halaqa/primitives';

/* لوحة ولي الأمر — how is my child, and what needs me.
   A decision summary, never a copy of the student dashboard.
   Same endpoints, linking, pagination, and WhatsApp contact. */

const STATUS_TONE = {
  present: { label: 'حاضر', color: HQ.MENTOR },
  late: { label: 'متأخر', color: '#B45309' },
  absent: { label: 'غائب', color: '#C2410C' },
  excused: { label: 'معذور', color: '#4A3F6B' },
  in_progress: { label: 'الحصة جارية', color: HQ.MENTOR },
};

export default function ParentDashboard() {
  const [children, setChildren] = useState([]);
  const [selectedChildId, setSelectedChildId] = useState(null);
  const [childProgress, setChildProgress] = useState(null);
  const [loadingProgress, setLoadingProgress] = useState(false);
  const [loadingChildren, setLoadingChildren] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);

  const recordsPagination = usePagination(childProgress?.recentRecords || [], 5);

  // Link child states (logic unchanged)
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [childEmail, setChildEmail] = useState('');
  const [linking, setLinking] = useState(false);

  // Unlink states (logic unchanged)
  const [confirmUnlinkId, setConfirmUnlinkId] = useState(null);
  const [unlinking, setUnlinking] = useState(false);

  useEffect(() => {
    fetchChildren();
  }, []);

  useEffect(() => {
    if (selectedChildId) {
      fetchChildProgress(selectedChildId);
    } else {
      setChildProgress(null);
    }
  }, [selectedChildId]);

  const fetchChildren = async () => {
    setLoadingChildren(true);
    setLoadFailed(false);
    try {
      const res = await api.get('/parents/children');
      const kids = res.data.children || [];
      setChildren(kids);
      if (kids.length > 0 && !selectedChildId) {
        setSelectedChildId(kids[0]._id);
      }
    } catch {
      setLoadFailed(true);
      toast.error('خطأ في جلب بيانات الأبناء المربوطين');
    } finally {
      setLoadingChildren(false);
    }
  };

  const fetchChildProgress = async (childId) => {
    setLoadingProgress(true);
    try {
      const res = await api.get(`/parents/children/${childId}/progress`);
      setChildProgress(res.data);
    } catch {
      toast.error('خطأ في جلب تقرير تقدم الابن');
    } finally {
      setLoadingProgress(false);
    }
  };

  const handleLinkChild = async (e) => {
    e.preventDefault();
    if (!childEmail.trim()) return;
    setLinking(true);
    try {
      const res = await api.post('/parents/children', { childEmail: childEmail.trim() });
      toast.success(res.data.message || 'تم ربط الابن بنجاح!');
      setChildEmail('');
      setLinkModalOpen(false);
      const kids = [...children, res.data.child];
      setChildren(kids);
      setSelectedChildId(res.data.child._id);
    } catch (error) {
      toast.error(error?.response?.data?.message || 'خطأ في ربط الابن');
    } finally {
      setLinking(false);
    }
  };

  const handleUnlinkChild = async () => {
    if (!confirmUnlinkId) return;
    setUnlinking(true);
    try {
      await api.delete(`/parents/children/${confirmUnlinkId}`);
      toast.success('تم إلغاء ربط الابن بنجاح');
      const updatedKids = children.filter(k => k._id !== confirmUnlinkId);
      setChildren(updatedKids);
      if (updatedKids.length > 0) {
        setSelectedChildId(updatedKids[0]._id);
      } else {
        setSelectedChildId(null);
      }
      setConfirmUnlinkId(null);
    } catch {
      toast.error('خطأ في إلغاء ربط الابن');
    } finally {
      setUnlinking(false);
    }
  };

  // Weekly activity bars from approved records (same math, calm bars)
  const weekDays = (() => {
    const localeDays = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      let mem = 0, rev = 0;
      (childProgress?.recentRecords || []).forEach(record => {
        if (new Date(record.date).toDateString() === d.toDateString() && record.status === 'approved') {
          if (record.activityType === 'memorization') mem += record.versesCount || 0;
          else if (record.activityType === 'review') rev += record.versesCount || 0;
        }
      });
      days.push({ day: localeDays[d.getDay()], mem, rev });
    }
    return days;
  })();
  const weekMax = Math.max(1, ...weekDays.map(d => Math.max(d.mem, d.rev)));

  const selectedChild = children.find(k => k._id === selectedChildId);
  const today = childProgress?.attendance?.todaySession;
  const todayTone = today ? (STATUS_TONE[today.attendanceStatus] || (today.sessionStatus === 'live' ? STATUS_TONE.in_progress : null)) : null;
  const latestTeacherNote =
    childProgress?.recentRecords?.find(r => r.teacherNotes)?.teacherNotes ||
    childProgress?.examResults?.find(r => r.teacherNotes)?.teacherNotes || '';

  const inputStyle = {
    width: '100%', padding: '12px 14px', borderRadius: 12, border: `1px solid ${HQ.LINE}`,
    background: HQ.SURFACE, fontSize: 14, color: HQ.INK, fontFamily: 'inherit', minHeight: 48,
  };

  return (
    <PageLayout>
      <div className="halaqa" style={{ maxWidth: 860, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 26, fontWeight: 900, color: HQ.INK }}>متابعة الأبناء</h1>
            <p style={{ margin: '4px 0 0', fontSize: 14, color: HQ.MUTED }}>كيف حال ابنك؟ وماذا يحتاج الآن؟</p>
          </div>
          <button type="button" onClick={() => setLinkModalOpen(true)} className="hq-action"
            style={{ background: HQ.MENTOR, color: '#fff', padding: '0 18px', fontSize: 14, flex: 'none' }}>
            <Plus size={17} /> ربط ابن جديد
          </button>
        </div>

        {loadingChildren ? (
          <div aria-label="جارٍ تحميل الأبناء">
            <div className="hq-skeleton" style={{ height: 64, width: '100%', marginBottom: 10 }} />
            <div className="hq-skeleton" style={{ height: 200, width: '100%' }} />
          </div>
        ) : loadFailed && children.length === 0 ? (
          <div style={{ background: HQ.SURFACE, border: `1px solid ${HQ.LINE}`, borderRadius: 18, padding: 40, textAlign: 'center' }} role="alert">
            <p style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 900, color: HQ.INK }}>تعذّر التحميل</p>
            <p style={{ margin: '0 0 20px', fontSize: 14, color: HQ.MUTED }}>تحقق من الاتصال ثم حاول مرة أخرى.</p>
            <button type="button" onClick={fetchChildren} className="hq-action" style={{ background: HQ.MENTOR, color: '#fff', padding: '0 24px', fontSize: 15 }}>
              <RotateCcw size={16} /> إعادة المحاولة
            </button>
          </div>
        ) : children.length === 0 ? (
          <div style={{ background: HQ.SURFACE, border: `1px solid ${HQ.LINE}`, borderRadius: 18, padding: '48px 24px', textAlign: 'center', maxWidth: 560, margin: '0 auto' }}>
            <Users size={44} color={HQ.LINE} style={{ margin: '0 auto 12px' }} />
            <h2 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 900, color: HQ.INK }}>اربط حساب ابنك أولًا</h2>
            <p style={{ margin: '0 0 20px', fontSize: 14, color: HQ.MUTED, lineHeight: 1.8 }}>
              أدخل البريد الإلكتروني الذي سجّل به ابنك في المنصة لمتابعة حضوره وتقدمه ونتائجه.
            </p>
            <button type="button" onClick={() => setLinkModalOpen(true)} className="hq-action"
              style={{ background: HQ.MENTOR, color: '#fff', padding: '0 32px', fontSize: 16 }}>
              <Plus size={18} /> ربط حساب الابن
            </button>
          </div>
        ) : (
          <>
            {/* Child selector */}
            <div role="tablist" aria-label="اختيار الابن" style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 8, marginBottom: 12 }} className="no-scrollbar">
              {children.map((kid) => {
                const active = selectedChildId === kid._id;
                return (
                  <button key={kid._id} type="button" role="tab" aria-selected={active}
                    onClick={() => setSelectedChildId(kid._id)}
                    style={{
                      flex: 'none', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
                      background: active ? HQ.SURFACE : 'transparent',
                      border: active ? `2px solid ${HQ.MENTOR}` : `1px solid ${HQ.LINE}`,
                      borderRadius: 14, padding: '8px 14px 8px 8px', minHeight: 60,
                    }}>
                    <HqAvatar firstName={kid.firstName} lastName={kid.lastName} size={40} />
                    <span style={{ textAlign: 'right' }}>
                      <strong style={{ display: 'block', fontSize: 15, color: HQ.INK }}>{kid.firstName} {kid.lastName}</strong>
                      <span style={{ display: 'block', fontSize: 12, color: HQ.MUTED }}>{getLevelLabel(kid.assignedLevel)}</span>
                    </span>
                  </button>
                );
              })}
            </div>

            {loadingProgress || !childProgress ? (
              <div aria-label="جارٍ تحميل تقرير الابن">
                <div className="hq-skeleton" style={{ height: 140, width: '100%', marginBottom: 10 }} />
                <div className="hq-skeleton" style={{ height: 64, width: '100%' }} />
              </div>
            ) : (
              <>
                {/* 1. How is my child now */}
                <section aria-label={`حال ${selectedChild?.firstName || 'الابن'} الآن`}
                  style={{ background: HQ.SURFACE, border: `1px solid ${HQ.LINE}`, borderRadius: 18, padding: 20, marginBottom: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                    <HqAvatar firstName={selectedChild?.firstName} lastName={selectedChild?.lastName} size={52} />
                    <div>
                      <h2 style={{ margin: 0, fontSize: 20, fontWeight: 900, color: HQ.INK }}>
                        {selectedChild?.firstName} {selectedChild?.lastName}
                      </h2>
                      <p style={{ margin: 0, fontSize: 13, color: HQ.MUTED }}>
                        {getLevelLabel(selectedChild?.assignedLevel)}
                        {todayTone ? ` · ${todayTone.label} اليوم` : ''}
                      </p>
                    </div>
                  </div>

                  {today && (
                    <p role="status" style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '0 0 12px', fontSize: 14, fontWeight: 800, color: todayTone?.color || HQ.INK }}>
                      {today.attendanceStatus === 'present' ? <CheckCircle2 size={17} />
                        : today.attendanceStatus === 'absent' ? <XCircle size={17} />
                        : <Clock size={17} />}
                      حصة اليوم ({today.title}): {todayTone?.label || 'قيد المتابعة'}
                      {today.notes ? ` — ملاحظة المعلم: ${today.notes}` : ''}
                    </p>
                  )}

                  <div className="hq-facts" style={{ marginBottom: latestTeacherNote ? 12 : 0 }}>
                    <span><strong>{(childProgress.stats?.totalVersesMemorized || 0) + (childProgress.stats?.totalVersesReviewed || 0)}</strong> <span>آية هذا الأسبوع</span></span>
                    <span><strong>{childProgress.attendance?.rate || 0}%</strong> <span>حضور ({childProgress.attendance?.attendedClasses || 0} من {childProgress.attendance?.totalClasses || 0})</span></span>
                  </div>

                  {latestTeacherNote && (
                    <p style={{ margin: 0, fontSize: 14, color: HQ.INK, background: HQ.PAPER, border: `1px solid ${HQ.LINE}`, borderRadius: 12, padding: '10px 14px' }}>
                      <strong>آخر كلمة من المعلم:</strong> {latestTeacherNote}
                    </p>
                  )}

                  {childProgress.alerts?.length > 0 && (
                    <div style={{ marginTop: 12 }}>
                      {childProgress.alerts.map((alert, idx) => (
                        <p key={idx} role="alert" style={{
                          margin: '0 0 8px', fontSize: 14, fontWeight: 700, padding: '10px 14px',
                          borderRadius: 12, background: HQ.PAPER,
                          border: `1px solid ${alert.severity === 'danger' ? '#C2410C' : '#B45309'}`,
                          color: alert.severity === 'danger' ? '#C2410C' : '#B45309',
                        }}>
                          <strong>{alert.title}: </strong>{alert.message}
                        </p>
                      ))}
                    </div>
                  )}
                </section>

                {/* 2. Weekly activity — calm bars, no analytics */}
                <section aria-label="نشاط الأسبوع"
                  style={{ background: HQ.SURFACE, border: `1px solid ${HQ.LINE}`, borderRadius: 18, padding: 20, marginBottom: 16 }}>
                  <h2 style={{ margin: '0 0 12px', fontSize: 17, fontWeight: 800, color: HQ.INK }}>نشاط الأسبوع (المعتمد)</h2>
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, height: 110 }} role="img"
                    aria-label={weekDays.map(d => `${d.day}: حفظ ${d.mem} ومراجعة ${d.rev}`).join('، ')}>
                    {weekDays.map((d, i) => (
                      <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, height: '100%', justifyContent: 'flex-end' }}>
                        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 76 }}>
                          <span style={{ width: 10, borderRadius: 5, background: HQ.MENTOR, height: `${Math.round((d.mem / weekMax) * 76)}px`, minHeight: d.mem ? 4 : 0 }} />
                          <span style={{ width: 10, borderRadius: 5, background: '#4A3F6B', height: `${Math.round((d.rev / weekMax) * 76)}px`, minHeight: d.rev ? 4 : 0 }} />
                        </div>
                        <span style={{ fontSize: 11, color: HQ.MUTED }}>{d.day}</span>
                      </div>
                    ))}
                  </div>
                  <p style={{ margin: '8px 0 0', fontSize: 12, color: HQ.MUTED }}>
                    <span style={{ color: HQ.MENTOR, fontWeight: 800 }}>■</span> حفظ
                    <span style={{ color: '#4A3F6B', fontWeight: 800, marginRight: 8 }}>■</span> مراجعة
                  </p>
                </section>

                {/* 3. Attendance history */}
                <section aria-label="سجل الحضور"
                  style={{ background: HQ.SURFACE, border: `1px solid ${HQ.LINE}`, borderRadius: 18, padding: 20, marginBottom: 16 }}>
                  <h2 style={{ margin: '0 0 8px', fontSize: 17, fontWeight: 800, color: HQ.INK }}>الحضور الأخير</h2>
                  {!childProgress.attendance?.history?.length ? (
                    <p style={{ fontSize: 14, color: HQ.MUTED, margin: 0 }}>لا سجل حضور بعد.</p>
                  ) : (
                    <ol style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                      {childProgress.attendance.history.slice(0, 5).map((session, idx) => {
                        const tone = STATUS_TONE[session.status] || STATUS_TONE.excused;
                        return (
                          <li key={idx} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderTop: idx ? `1px solid ${HQ.LINE}` : 'none' }}>
                            <span aria-hidden style={{ width: 10, height: 10, borderRadius: 9999, background: tone.color, flex: 'none' }} />
                            <span style={{ flex: 1, minWidth: 0 }}>
                              <strong style={{ display: 'block', fontSize: 14, color: HQ.INK, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{session.title}</strong>
                              <span style={{ display: 'block', fontSize: 12, color: HQ.MUTED }}>
                                <Calendar size={11} style={{ verticalAlign: -1 }} /> {new Date(session.date).toLocaleDateString('ar-EG', { day: 'numeric', month: 'short' })}
                                {session.notes ? ` · ${session.notes}` : ''}
                              </span>
                            </span>
                            <span style={{ fontSize: 13, fontWeight: 800, color: tone.color, flex: 'none' }}>{tone.label}</span>
                          </li>
                        );
                      })}
                    </ol>
                  )}
                </section>

                {/* 4. Exams */}
                <section aria-label="الاختبارات"
                  style={{ background: HQ.SURFACE, border: `1px solid ${HQ.LINE}`, borderRadius: 18, padding: 20, marginBottom: 16 }}>
                  <h2 style={{ margin: '0 0 8px', fontSize: 17, fontWeight: 800, color: HQ.INK }}>الاختبارات</h2>
                  {!childProgress.examResults?.length ? (
                    <p style={{ fontSize: 14, color: HQ.MUTED, margin: 0 }}>لا اختبارات مسجلة بعد.</p>
                  ) : (
                    <>
                      {(childProgress.examResults || []).slice(0, 4).map((result) => (
                        <div key={result._id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderTop: `1px solid ${HQ.LINE}` }}>
                          <span style={{ flex: 1, minWidth: 0 }}>
                            <strong style={{ display: 'block', fontSize: 14, color: HQ.INK, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {result.exam?.title || 'امتحان مستوى'}
                            </strong>
                            <span style={{ display: 'block', fontSize: 12, color: HQ.MUTED }}>
                              {result.status !== 'reviewed' ? 'قيد تصحيح المعلم' : result.isPassed ? `ناجح (${result.totalPercentage || 0}%)` : `يحتاج مراجعة (${result.totalPercentage || 0}%)`}
                              {result.oralScore !== undefined ? ` · الشفهي ${result.oralScore}/100` : ''}
                            </span>
                          </span>
                          {result.teacherNotes && (
                            <span style={{ fontSize: 12, color: HQ.MUTED, maxWidth: '45%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {result.teacherNotes}
                            </span>
                          )}
                        </div>
                      ))}
                    </>
                  )}
                  <a href="https://wa.me/?text=السلام%20عليكم%20أود%20الاستفسار%20عن%20مستوى%20ابني%20في%20الحلقة"
                    target="_blank" rel="noreferrer" className="hq-action"
                    style={{ width: '100%', background: HQ.PAPER, border: `1px solid ${HQ.LINE}`, color: HQ.INK, fontSize: 14, marginTop: 12, textDecoration: 'none' }}>
                    <MessageSquare size={16} color={HQ.MENTOR} /> تواصل مع الإدارة والمعلم
                  </a>
                </section>

                {/* 5. Recent records */}
                <section aria-label="سجل الحفظ الأخير"
                  style={{ background: HQ.SURFACE, border: `1px solid ${HQ.LINE}`, borderRadius: 18, padding: 20, marginBottom: 16 }}>
                  <h2 style={{ margin: '0 0 8px', fontSize: 17, fontWeight: 800, color: HQ.INK }}>سجل الحفظ الأخير</h2>
                  {!childProgress.recentRecords?.length ? (
                    <p style={{ fontSize: 14, color: HQ.MUTED, margin: 0 }}>لا سجلات حفظ بعد.</p>
                  ) : (
                    <>
                      <ol style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                        {recordsPagination.paginatedItems.map((record) => (
                          <li key={record._id} style={{ padding: '10px 0', borderTop: `1px solid ${HQ.LINE}`, fontSize: 14 }}>
                            <strong style={{ color: HQ.INK }}>سورة {record.surahName} · الآيات {record.fromVerse}-{record.toVerse}</strong>
                            <span style={{ display: 'block', fontSize: 12, color: HQ.MUTED, marginTop: 2 }}>
                              {record.activityType === 'memorization' ? 'حفظ جديد' : record.activityType === 'review' ? 'مراجعة' : 'تجويد'}
                              {' · '}{record.status === 'approved' ? 'معتمد' : record.status === 'pending' ? 'قيد المراجعة' : 'يحتاج مراجعة'}
                              {' · '}{timeAgoAr(record.date)}
                            </span>
                            {record.teacherNotes && (
                              <span style={{ display: 'block', fontSize: 13, color: HQ.INK, marginTop: 4 }}>ملاحظة المعلم: {record.teacherNotes}</span>
                            )}
                          </li>
                        ))}
                      </ol>
                      <Pagination
                        currentPage={recordsPagination.currentPage}
                        totalPages={recordsPagination.totalPages}
                        totalItems={recordsPagination.totalItems}
                        pageSize={recordsPagination.pageSize}
                        onPageChange={recordsPagination.setCurrentPage}
                        onPageSizeChange={recordsPagination.setPageSize}
                        showPageSize={true}
                        pageSizeOptions={[3, 5, 10, 20]}
                        itemName="سجل حفظ"
                        className="mt-4"
                      />
                    </>
                  )}
                </section>

                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button type="button" onClick={() => setConfirmUnlinkId(childProgress.student._id)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700, color: '#C2410C', display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 44, padding: '0 12px' }}>
                    <Trash2 size={15} /> إلغاء ربط {childProgress.student.firstName}
                  </button>
                </div>
              </>
            )}
          </>
        )}
      </div>

      {/* Link modal — same fields and POST */}
      {linkModalOpen && (
        <div dir="rtl" style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: 'rgba(12,12,29,0.72)' }}>
          <div role="dialog" aria-modal="true" aria-label="ربط حساب الابن"
            style={{ background: HQ.SURFACE, borderRadius: 18, padding: 24, width: '100%', maxWidth: 420, border: `1px solid ${HQ.LINE}` }}>
            <h3 style={{ margin: '0 0 4px', fontSize: 19, fontWeight: 900, color: HQ.INK }}>ربط حساب الابن</h3>
            <p style={{ margin: '0 0 16px', fontSize: 13, color: HQ.MUTED, lineHeight: 1.8 }}>
              أدخل البريد الإلكتروني الذي سجّل به ابنك في المنصة لمطابقة الحسابين.
            </p>
            <form onSubmit={handleLinkChild}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 800, color: HQ.INK, marginBottom: 6 }} htmlFor="link-email">
                البريد الإلكتروني للابن *
              </label>
              <div style={{ position: 'relative', marginBottom: 16 }}>
                <Mail size={16} color={HQ.MUTED} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)' }} />
                <input id="link-email" type="email" required value={childEmail}
                  onChange={(e) => setChildEmail(e.target.value)}
                  placeholder="student@quran.com" dir="ltr"
                  style={{ width: '100%', padding: '12px 38px 12px 12px', borderRadius: 12, border: `1px solid ${HQ.LINE}`, background: HQ.SURFACE, fontSize: 14, color: HQ.INK, fontFamily: 'inherit', minHeight: 48 }} />
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="submit" disabled={linking || !childEmail.trim()} className="hq-action"
                  style={{ flex: 1, background: HQ.MENTOR, color: '#fff', fontSize: 15, opacity: (linking || !childEmail.trim()) ? 0.5 : 1 }}>
                  {linking ? 'جارٍ الربط...' : 'تأكيد الربط'}
                </button>
                <button type="button" onClick={() => { setLinkModalOpen(false); setChildEmail(''); }} className="hq-action"
                  style={{ flex: 1, background: HQ.PAPER, border: `1px solid ${HQ.LINE}`, color: HQ.INK, fontSize: 15 }}>
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Unlink confirm — same DELETE */}
      {confirmUnlinkId && (
        <div dir="rtl" style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: 'rgba(12,12,29,0.72)' }}>
          <div role="dialog" aria-modal="true" aria-label="تأكيد إلغاء الربط"
            style={{ background: HQ.SURFACE, borderRadius: 18, padding: 24, width: '100%', maxWidth: 380, border: `1px solid ${HQ.LINE}`, textAlign: 'center' }}>
            <AlertCircle size={36} color="#C2410C" style={{ margin: '0 auto 12px' }} />
            <h3 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 900, color: HQ.INK }}>إلغاء ربط الحساب؟</h3>
            <p style={{ margin: '0 0 20px', fontSize: 13, color: HQ.MUTED, lineHeight: 1.8 }}>
              لن تتمكن من متابعة أدائه أو تلقي التنبيهات الخاصة به.
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" onClick={handleUnlinkChild} disabled={unlinking} className="hq-action"
                style={{ flex: 1, background: '#C2410C', color: '#fff', fontSize: 14, opacity: unlinking ? 0.5 : 1 }}>
                {unlinking ? 'جارٍ الإلغاء...' : 'نعم، إلغاء الربط'}
              </button>
              <button type="button" onClick={() => setConfirmUnlinkId(null)} className="hq-action"
                style={{ flex: 1, background: HQ.PAPER, border: `1px solid ${HQ.LINE}`, color: HQ.INK, fontSize: 14 }}>
                تراجع
              </button>
            </div>
          </div>
        </div>
      )}
    </PageLayout>
  );
}
