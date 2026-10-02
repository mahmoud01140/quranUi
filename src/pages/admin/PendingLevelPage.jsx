import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, RotateCcw, Radio, Calendar, X, Clock, ClipboardList, CheckCircle, Download } from 'lucide-react';
import toast from 'react-hot-toast';
import PageLayout from '../../components/shared/PageLayout';
import api from '../../services/api';
import { downloadStudentReport } from '../../utils/studentReport';
import { getLevelLabel, formatDateAr, formatTime12Ar } from '../../utils/helpers';
import LoadingSpinner from '../../components/shared/LoadingSpinner';
import SessionTimePicker from '../../components/shared/SessionTimePicker';
import '../../components/halaqa/halaqa.css';
import { HQ, HqAvatar, HqBadge } from '../../components/halaqa/primitives';

const WEEK_DAYS = ['السبت', 'الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة'];

/* قسم بانتظار تحديد المستوى والجدولة — فقط الطلاب الذين لم يُحدد
   مستواهم أو مواعيدهم أو اعتمادهم بعد، مع كل أدوات الحسم في مكان واحد. */

const isWaiting = (u) =>
  u.role === 'student' &&
  (u.isApproved === false || !u.assignedLevel || !(u.scheduleDays?.length));

export default function PendingLevelPage() {
  const navigate = useNavigate();
  const [students, setStudents] = useState([]);
  const [allStudents, setAllStudents] = useState([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [actingId, setActingId] = useState(null);

  // Schedule modal
  const [scheduleUser, setScheduleUser] = useState(null);
  const [scheduleForm, setScheduleForm] = useState({ assignedLevel: 'foundation', scheduleDays: [], sessionTime: '18:00' });

  // Review modal (survey + oral audio)
  const [reviewUser, setReviewUser] = useState(null);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewData, setReviewData] = useState({ surveyAnswers: [], audioList: [], writtenPercentage: null });

  // Live modal (title + optional sources)
  const [liveUser, setLiveUser] = useState(null);
  const [liveForm, setLiveForm] = useState({ title: '', resources: '', description: '' });
  const [reportId, setReportId] = useState(null);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setIsLoading(true);
    setLoadFailed(false);
    try {
      const res = await api.get('/users', { params: { role: 'student', limit: 200 } });
      const all = res.data.users || [];
      setAllStudents(all);
      setStudents(all.filter(isWaiting));
    } catch {
      setLoadFailed(true);
      toast.error('خطأ في جلب البيانات');
    } finally { setIsLoading(false); }
  };

  const missingOf = (u) => {
    const m = [];
    if (u.isApproved === false) m.push('بانتظار الاعتماد');
    if (!u.assignedLevel) m.push('بدون مستوى');
    if (!(u.scheduleDays?.length)) m.push('بدون جدولة');
    return m;
  };

  // ── Schedule ──
  const openSchedule = (u) => {
    setScheduleUser(u);
    setScheduleForm({
      assignedLevel: u.assignedLevel || 'foundation',
      scheduleDays: Array.isArray(u.scheduleDays) && u.scheduleDays.length ? u.scheduleDays : ['السبت', 'الثلاثاء'],
      sessionTime: u.sessionTime || '18:00',
    });
  };

  const toggleDay = (day) => {
    setScheduleForm(prev => ({
      ...prev,
      scheduleDays: prev.scheduleDays.includes(day)
        ? prev.scheduleDays.filter(d => d !== day)
        : [...prev.scheduleDays, day],
    }));
  };

  const handleSaveSchedule = async () => {
    if (!scheduleUser) return;
    if (!scheduleForm.scheduleDays.length) return toast.error('حدد يوماً واحداً على الأقل');
    const clashes = scheduleConflicts(scheduleUser._id, scheduleForm.scheduleDays, scheduleForm.sessionTime);
    if (clashes.length) {
      const c = clashes[0];
      const day = (c.scheduleDays || []).find(d => scheduleForm.scheduleDays.includes(d));
      return toast.error(`تعارض في الموعد: الطالب ${c.firstName} ${c.lastName} محجوز يوم ${day} الساعة ${formatTime12Ar(c.sessionTime)} — اختر وقتاً آخر`);
    }
    setActingId(scheduleUser._id);
    try {
      await api.put(`/users/${scheduleUser._id}/approve`, scheduleForm);
      toast.success('تم حفظ المستوى والمواعيد واعتماد الطالب بنجاح');
      setScheduleUser(null);
      await fetchData();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'خطأ في الحفظ');
    } finally { setActingId(null); }
  };

  // نفس اليوم + نفس الساعة والدقيقة لطالب آخر نشط → تعارض
  const scheduleConflicts = (excludeId, days, time) => {
    if (!time || !days?.length) return [];
    return allStudents.filter(u =>
      u._id !== excludeId &&
      u.isActive !== false &&
      (u.scheduleDays || []).some(d => days.includes(d)) &&
      u.sessionTime === time
    );
  };

  // ── Review (survey + oral audio) ──
  const openReview = async (u) => {
    setReviewUser(u);
    setReviewLoading(true);
    setReviewData({ surveyAnswers: [], audioList: [], writtenPercentage: null });
    try {
      const res = await api.get(`/exams/results/student/${u._id}`).catch(() => null);
      const results = res?.data?.results || [];
      let placement = null;
      for (const r of results) {
        const isPlacement = r.examType === 'placement' || r.examType === 'oral' || r.exam?.type === 'placement';
        if (!isPlacement) continue;
        if (!placement || (!placement.oralRecordings?.length && r.oralRecordings?.length)) placement = r;
      }
      let surveyAnswers = placement?.surveyAnswers || [];
      if (!surveyAnswers.length && Array.isArray(u.surveyAnswers)) surveyAnswers = u.surveyAnswers;
      const audioSet = new Set();
      (placement?.oralRecordings || []).forEach(rec => { if (rec?.audioUrl) audioSet.add(rec.audioUrl); });
      (u.oralExamRecordings || []).forEach(url => { if (url) audioSet.add(url); });
      setReviewData({
        surveyAnswers,
        audioList: [...audioSet],
        writtenPercentage: placement?.writtenPercentage ?? u.placementExamScore ?? null,
      });
    } catch {
      toast.error('تعذر جلب ملف المراجعة');
    } finally { setReviewLoading(false); }
  };

  // ── Live ──
  const handleDownloadReport = async (u) => {
    setReportId(u._id);
    try {
      await downloadStudentReport(u);
      toast.success('تم تجهيز التقرير — اطبعه أو احفظه PDF');
    } catch {
      toast.error('تعذر تجهيز التقرير');
    } finally { setReportId(null); }
  };
  const handleConfirmLive = async () => {
    if (!liveUser) return;
    const u = liveUser;
    setActingId(u._id);
    try {
      const payload = {};
      if (liveForm.title?.trim()) payload.title = liveForm.title.trim();
      if (liveForm.resources?.trim()) payload.resources = liveForm.resources.trim();
      if (liveForm.description?.trim()) payload.description = liveForm.description.trim();
      const res = await api.post(`/live/student/${u._id}/start`, payload);
      toast.success('تم إنشاء الدرس وبدء البث المباشر مع الطالب');
      setLiveUser(null);
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
      toast.error(err?.response?.data?.message || 'خطأ في بدء البث المباشر');
    } finally { setActingId(null); }
  };

  const selectStyle = {
    background: HQ.SURFACE, border: `1px solid ${HQ.LINE}`, borderRadius: 12,
    padding: '0 12px', minHeight: 48, fontSize: 14, color: HQ.INK, fontFamily: 'inherit',
  };

  const filtered = students
    .filter(u => {
      if (search && !`${u.firstName} ${u.lastName} ${u.email}`.includes(search)) return false;
      return true;
    })
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

  return (
    <PageLayout>
      <div className="halaqa" style={{ maxWidth: 860, margin: '0 auto' }}>
        <h1 style={{ margin: '0 0 4px', fontSize: 26, fontWeight: 900, color: HQ.INK }}>بانتظار تحديد المستوى والجدولة</h1>
        <p style={{ margin: '0 0 16px', fontSize: 14, color: HQ.MUTED }}>
          {students.length} طالب بانتظار الحسم — راجع ملفه، حدد مستواه ومواعيده، أو ابدأ بثاً مباشراً معه
        </p>

        <div style={{ position: 'relative', marginBottom: 16 }}>
          <Search size={16} color={HQ.MUTED} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="بحث بالاسم أو البريد..." aria-label="بحث عن طالب"
            style={{ ...selectStyle, width: '100%', paddingRight: 38 }} />
        </div>

        {isLoading ? (
          <div aria-label="جارٍ التحميل">
            <div className="hq-skeleton" style={{ height: 76, width: '100%', marginBottom: 10 }} />
            <div className="hq-skeleton" style={{ height: 76, width: '100%' }} />
          </div>
        ) : loadFailed && filtered.length === 0 ? (
          <div style={{ background: HQ.SURFACE, border: `1px solid ${HQ.LINE}`, borderRadius: 18, padding: 40, textAlign: 'center' }} role="alert">
            <p style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 900, color: HQ.INK }}>تعذّر تحميل البيانات</p>
            <button type="button" onClick={fetchData} className="hq-action" style={{ background: HQ.MENTOR, color: '#fff', padding: '0 24px', fontSize: 15 }}>
              <RotateCcw size={16} /> إعادة المحاولة
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ background: HQ.SURFACE, border: `1px solid ${HQ.LINE}`, borderRadius: 18, padding: 40, textAlign: 'center' }}>
            <CheckCircle size={40} color={HQ.MENTOR} style={{ margin: '0 auto 12px' }} />
            <p style={{ margin: 0, fontSize: 16, fontWeight: 800, color: HQ.INK }}>لا يوجد طلاب بانتظار تحديد المستوى 🎉</p>
            <p style={{ margin: '4px 0 0', fontSize: 14, color: HQ.MUTED }}>كل الطلاب محددي المستوى ومجدولي المواعيد</p>
          </div>
        ) : (
          <ol style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {filtered.map(u => (
              <li key={u._id} style={{ background: HQ.SURFACE, border: `1px solid ${HQ.LINE}`, borderRadius: 18, marginBottom: 12, padding: 16 }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                  <HqAvatar firstName={u.firstName} lastName={u.lastName} size={48} />
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 2 }}>
                      <strong style={{ fontSize: 16, color: HQ.INK }}>{u.firstName} {u.lastName}</strong>
                      {missingOf(u).map(m => <HqBadge key={m} tone="gold">{m}</HqBadge>)}
                      {u.assignedLevel && <HqBadge tone="mentor">{getLevelLabel(u.assignedLevel)}</HqBadge>}
                    </div>
                    <p style={{ margin: 0, fontSize: 13, color: HQ.MUTED, direction: 'ltr', textAlign: 'right', overflowWrap: 'anywhere', maxWidth: '100%' }}>{u.email}</p>
                    <p style={{ margin: '4px 0 0', fontSize: 13, color: HQ.MUTED }}>
                      {u.placementExamScore !== undefined ? `الاختبار التحريري: ${u.placementExamScore}% · ` : ''}
                      التسجيلات الشفهية: {u.oralExamRecordings?.length || 0} · {formatDateAr(u.createdAt)}
                    </p>
                    {u.scheduleDays?.length > 0 && (
                      <p style={{ margin: '4px 0 0', fontSize: 13, color: HQ.MENTOR, fontWeight: 700 }}>
                        <Clock size={13} style={{ display: 'inline', verticalAlign: -2 }} /> {u.scheduleDays.join('، ')} {u.sessionTime ? `(الساعة ${formatTime12Ar(u.sessionTime)})` : ''}
                      </p>
                    )}
                  </div>
                  <div className="m-student-actions" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', width: '100%', marginTop: 8 }}>
                    <button type="button" onClick={() => openReview(u)} className="hq-action"
                      style={{ background: '#FBF7EE', border: '1px solid #B45309', color: '#B45309', padding: '0 14px', fontSize: 14, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <ClipboardList size={16} /> ملف المراجعة
                    </button>
                    <button type="button" onClick={() => openSchedule(u)} disabled={actingId === u._id} className="hq-action"
                      style={{ background: HQ.PAPER, border: `1px solid ${HQ.LINE}`, color: HQ.INK, padding: '0 14px', fontSize: 14, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <Calendar size={16} /> تحديد المستوى والجدولة
                    </button>
                    <button type="button" onClick={() => { setLiveUser(u); setLiveForm({ title: '', resources: '', description: '' }); }}
                      disabled={actingId === u._id} className="hq-action m-primary"
                      style={{ background: HQ.MENTOR, color: '#fff', padding: '0 14px', fontSize: 14, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <Radio size={16} /> بدء بث مباشر
                    </button>
                    <button type="button" onClick={() => handleDownloadReport(u)}
                      disabled={reportId === u._id} className="hq-action"
                      style={{ background: HQ.PAPER, border: `1px solid ${HQ.LINE}`, color: HQ.INK, padding: '0 14px', fontSize: 14, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      {reportId === u._id ? <LoadingSpinner size="sm" /> : <><Download size={16} /> تقرير</>}
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        )}

        {/* Schedule modal */}
        {scheduleUser && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
            <div style={{ background: HQ.SURFACE, borderRadius: 20, padding: 24, maxWidth: 500, width: '100%', border: `1px solid ${HQ.LINE}`, maxHeight: '90vh', overflowY: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: HQ.INK }}>تحديد المستوى والجدولة والاعتماد</h3>
                <button type="button" onClick={() => setScheduleUser(null)} aria-label="إغلاق" style={{ background: 'none', border: 'none', cursor: 'pointer', color: HQ.MUTED }}><X size={20} /></button>
              </div>
              <p style={{ margin: '0 0 16px', fontSize: 14, color: HQ.MUTED }}>
                الطالب: <strong>{scheduleUser.firstName} {scheduleUser.lastName}</strong>
              </p>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 800, color: HQ.INK, marginBottom: 6 }}>المستوى المعتمد</label>
                <select value={scheduleForm.assignedLevel} onChange={e => setScheduleForm(p => ({ ...p, assignedLevel: e.target.value }))} style={{ ...selectStyle, width: '100%' }}>
                  <option value="foundation">المستوى التأسيسي</option>
                  <option value="memorization">مستوى الحفظ والتجويد</option>
                  <option value="teacher_prep">إعداد معلمين</option>
                  <option value="senior">كبار السن</option>
                </select>
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 800, color: HQ.INK, marginBottom: 8 }}>أيام البث الأسبوعية</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {WEEK_DAYS.map(day => {
                    const selected = scheduleForm.scheduleDays.includes(day);
                    return (
                      <button key={day} type="button" onClick={() => toggleDay(day)}
                        style={{ padding: '8px 14px', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', border: `1px solid ${selected ? HQ.MENTOR : HQ.LINE}`, background: selected ? HQ.MENTOR : HQ.PAPER, color: selected ? '#fff' : HQ.INK }}>
                        {day}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 800, color: HQ.INK, marginBottom: 6 }}>ساعة البث</label>
                <SessionTimePicker
                  value={scheduleForm.sessionTime}
                  onChange={v => setScheduleForm(p => ({ ...p, sessionTime: v }))}
                />
                {scheduleUser && scheduleConflicts(scheduleUser._id, scheduleForm.scheduleDays, scheduleForm.sessionTime).length > 0 && (
                  <div role="alert" style={{ marginTop: 8, background: '#FDECEC', border: '1px solid #C2410C', borderRadius: 12, padding: '10px 14px', fontSize: 13, fontWeight: 700, color: '#C2410C', lineHeight: 1.8 }}>
                    ⛔ هذا الموعد محجوز:
                    {scheduleConflicts(scheduleUser._id, scheduleForm.scheduleDays, scheduleForm.sessionTime).slice(0, 3).map(c => {
                      const day = (c.scheduleDays || []).find(d => scheduleForm.scheduleDays.includes(d));
                      return <span key={c._id} style={{ display: 'block' }}>• {c.firstName} {c.lastName} — يوم {day} الساعة {formatTime12Ar(c.sessionTime)}</span>;
                    })}
                    اختر يوماً أو وقتاً آخر.
                  </div>
                )}
              </div>
              <div className="m-modal-actions" style={{ display: 'flex', gap: 10 }}>
                <button type="button" onClick={() => setScheduleUser(null)} className="hq-action" style={{ flex: 1, background: HQ.PAPER, border: `1px solid ${HQ.LINE}`, color: HQ.INK, fontSize: 14 }}>إلغاء</button>
                <button type="button" onClick={handleSaveSchedule} disabled={actingId === scheduleUser._id} className="hq-action" style={{ flex: 1, background: HQ.MENTOR, color: '#fff', fontSize: 14 }}>
                  {actingId === scheduleUser._id ? <LoadingSpinner size="sm" /> : 'حفظ واعتماد الطالب'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Review modal */}
        {reviewUser && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
            <div style={{ background: HQ.SURFACE, borderRadius: 20, padding: 24, maxWidth: 600, width: '100%', border: `1px solid ${HQ.LINE}`, maxHeight: '90vh', overflowY: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: HQ.INK }}>ملف مراجعة الطالب</h3>
                <button type="button" onClick={() => setReviewUser(null)} aria-label="إغلاق" style={{ background: 'none', border: 'none', cursor: 'pointer', color: HQ.MUTED }}><X size={20} /></button>
              </div>
              <p style={{ margin: '0 0 16px', fontSize: 14, color: HQ.MUTED }}>
                <strong>{reviewUser.firstName} {reviewUser.lastName}</strong>
                {reviewData.writtenPercentage !== null && reviewData.writtenPercentage !== undefined && (
                  <> · التحريري: <strong style={{ color: HQ.MENTOR }}>{reviewData.writtenPercentage}%</strong></>
                )}
              </p>
              {reviewLoading ? (
                <div style={{ textAlign: 'center', padding: 32 }}><LoadingSpinner size="md" text="جارٍ الجلب..." /></div>
              ) : (
                <>
                  <h4 style={{ margin: '0 0 8px', fontSize: 15, fontWeight: 900, color: HQ.INK }}>إجابات الاستبيان ({reviewData.surveyAnswers.length})</h4>
                  {reviewData.surveyAnswers.length === 0 ? (
                    <p style={{ margin: '0 0 16px', fontSize: 13, color: HQ.MUTED }}>لا توجد إجابات مسجلة.</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                      {reviewData.surveyAnswers.map((sa, idx) => (
                        <div key={idx} style={{ background: HQ.PAPER, border: `1px solid ${HQ.LINE}`, borderRadius: 12, padding: '10px 14px' }}>
                          <p style={{ margin: '0 0 2px', fontSize: 12, fontWeight: 700, color: HQ.MUTED }}>س{idx + 1}: {sa.questionText || 'سؤال الاستبيان'}</p>
                          <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: HQ.INK }}>{sa.answerText || sa.answer || '—'}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  <h4 style={{ margin: '0 0 8px', fontSize: 15, fontWeight: 900, color: HQ.INK }}>التسجيلات الشفهية ({reviewData.audioList.length})</h4>
                  {reviewData.audioList.length === 0 ? (
                    <p style={{ margin: '0 0 16px', fontSize: 13, color: HQ.MUTED }}>لا توجد تسجيلات.</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                      {reviewData.audioList.map((url, idx) => (
                        <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 10, background: HQ.PAPER, border: `1px solid ${HQ.LINE}`, borderRadius: 12, padding: '8px 12px', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 13, fontWeight: 800, color: HQ.INK }}>التسجيل {idx + 1}</span>
                          <audio src={url} controls style={{ height: 36, flex: 1, minWidth: 220 }} />
                        </div>
                      ))}
                    </div>
                  )}
                  <button type="button" onClick={() => { const u = reviewUser; setReviewUser(null); openSchedule(u); }} className="hq-action"
                    style={{ width: '100%', background: HQ.MENTOR, color: '#fff', fontSize: 15 }}>
                    <Calendar size={16} /> تحديد المستوى والجدولة لهذا الطالب
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* Live modal */}
        {liveUser && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
            <div style={{ background: HQ.SURFACE, borderRadius: 20, padding: 24, maxWidth: 500, width: '100%', border: `1px solid ${HQ.LINE}`, maxHeight: '90vh', overflowY: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: HQ.INK }}>بدء بث مباشر ودرس فوري</h3>
                <button type="button" onClick={() => setLiveUser(null)} aria-label="إغلاق" style={{ background: 'none', border: 'none', cursor: 'pointer', color: HQ.MUTED }}><X size={20} /></button>
              </div>
              <p style={{ margin: '0 0 16px', fontSize: 14, color: HQ.MUTED }}>
                الطالب: <strong>{liveUser.firstName} {liveUser.lastName}</strong>
              </p>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 800, color: HQ.INK, marginBottom: 6 }}>اسم الدرس (اختياري)</label>
                <input type="text" value={liveForm.title} onChange={e => setLiveForm(p => ({ ...p, title: e.target.value }))} placeholder="مثال: تلاوة سورة البقرة" style={{ ...selectStyle, width: '100%' }} />
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 800, color: HQ.INK, marginBottom: 6 }}>المصادر (اختياري)</label>
                <textarea value={liveForm.resources} onChange={e => setLiveForm(p => ({ ...p, resources: e.target.value }))} rows={3} style={{ ...selectStyle, width: '100%', minHeight: 80, paddingTop: 10, resize: 'vertical' }} />
              </div>
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 800, color: HQ.INK, marginBottom: 6 }}>ملاحظات (اختياري)</label>
                <textarea value={liveForm.description} onChange={e => setLiveForm(p => ({ ...p, description: e.target.value }))} rows={2} style={{ ...selectStyle, width: '100%', minHeight: 64, paddingTop: 10, resize: 'vertical' }} />
              </div>
              <div className="m-modal-actions" style={{ display: 'flex', gap: 10 }}>
                <button type="button" onClick={() => setLiveUser(null)} className="hq-action" style={{ flex: 1, background: HQ.PAPER, border: `1px solid ${HQ.LINE}`, color: HQ.INK, fontSize: 14 }}>إلغاء</button>
                <button type="button" onClick={handleConfirmLive} disabled={actingId === liveUser._id} className="hq-action" style={{ flex: 1, background: HQ.MENTOR, color: '#fff', fontSize: 14 }}>
                  {actingId === liveUser._id ? <LoadingSpinner size="sm" /> : <><Radio size={16} /> بدء البث وإنشاء الدرس</>}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </PageLayout>
  );
}
