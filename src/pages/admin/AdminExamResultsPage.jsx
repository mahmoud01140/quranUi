import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowRight, Mic } from 'lucide-react';
import PageLayout from '../../components/shared/PageLayout';
import useExamStore from '../../store/examStore';
import { formatDateAr } from '../../utils/helpers';
import LoadingSpinner from '../../components/shared/LoadingSpinner';
import SessionTimePicker from '../../components/shared/SessionTimePicker';
import Pagination from '../../components/shared/Pagination';
import usePagination from '../../hooks/usePagination';
import api from '../../services/api';
import toast from 'react-hot-toast';
import '../../components/halaqa/halaqa.css';
import { HQ, HqAvatar, HqBadge } from '../../components/halaqa/primitives';

/* نتائج الامتحان — disciplined table, clear states, same review flow. */

export default function AdminExamResultsPage() {
  const { examId } = useParams();
  const navigate = useNavigate();
  const { examResults, fetchExamResults, isLoading } = useExamStore();
  const [exam, setExam] = useState(null);
  const [reviewModal, setReviewModal] = useState(null);
  const [reviewForm, setReviewForm] = useState({ oralScore: '', teacherNotes: '' });
  const [saving, setSaving] = useState(false);

  const resultsPagination = usePagination(examResults, 10);

  useEffect(() => {
    fetchExamResults(examId);
    api.get(`/exams/group/any`).catch(() => {});
  }, [examId]);

  useEffect(() => {
    if (examResults.length > 0 && examResults[0].exam) {
      setExam(examResults[0].exam);
    }
  }, [examResults]);

  const handleReview = async () => {
    setSaving(true);
    try {
      await api.put(`/exams/results/${reviewModal._id}/review`, {
        oralScore: Number(reviewForm.oralScore),
        teacherNotes: reviewForm.teacherNotes,
        ...(reviewForm.assignedLevel ? { assignedLevel: reviewForm.assignedLevel } : {}),
        scheduleDays: reviewForm.scheduleDays || ['السبت', 'الثلاثاء'],
        sessionTime: reviewForm.sessionTime || '18:00',
        isApproved: true,
      });
      toast.success('تم حفظ التقييم واعتماد الطالب وتحديد المواعيد بنجاح');
      setReviewModal(null);
      fetchExamResults(examId);
    } catch { toast.error('خطأ في الحفظ'); }
    finally { setSaving(false); }
  };

  const passed = examResults.filter(r => r.isPassed).length;
  const failed = examResults.filter(r => !r.isPassed && r.status !== 'pending_oral_review').length;
  const pending = examResults.filter(r => r.status === 'pending_oral_review').length;
  const avgScore = examResults.length
    ? Math.round(examResults.reduce((s, r) => s + (r.totalPercentage || r.writtenPercentage || 0), 0) / examResults.length)
    : 0;

  const inputStyle = {
    width: '100%', padding: '12px 14px', borderRadius: 12, border: `1px solid ${HQ.LINE}`,
    background: HQ.SURFACE, fontSize: 14, color: HQ.INK, fontFamily: 'inherit', minHeight: 48,
  };

  return (
    <PageLayout>
      <div className="halaqa" style={{ maxWidth: 900, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <button type="button" onClick={() => navigate(-1)} aria-label="رجوع"
            style={{ width: 44, height: 44, borderRadius: 12, border: `1px solid ${HQ.LINE}`, background: HQ.SURFACE, color: HQ.MUTED, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
            <ArrowRight size={19} />
          </button>
          <div>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900, color: HQ.INK }}>{exam?.title || 'نتائج الامتحان'}</h1>
            {exam?.lessonTitle && <p style={{ margin: 0, fontSize: 14, color: HQ.MUTED }}>درس: {exam.lessonTitle}</p>}
          </div>
        </div>

        {/* Facts */}
        <div className="hq-facts" style={{ background: HQ.SURFACE, border: `1px solid ${HQ.LINE}`, borderRadius: 18, padding: 16, marginBottom: 16 }}>
          <span><strong>{examResults.length}</strong> <span>متقدم</span></span>
          <span><strong>{passed}</strong> <span>ناجح</span></span>
          <span><strong>{failed}</strong> <span>يحتاج مراجعة</span></span>
          <span><strong>{pending}</strong> <span>قيد المراجعة الشفهية</span></span>
          <span><strong>{avgScore}%</strong> <span>المتوسط</span></span>
        </div>

        {isLoading ? (
          <div aria-label="جارٍ تحميل النتائج">
            <div className="hq-skeleton" style={{ height: 56, width: '100%', marginBottom: 8 }} />
            <div className="hq-skeleton" style={{ height: 56, width: '100%', marginBottom: 8 }} />
            <div className="hq-skeleton" style={{ height: 56, width: '100%' }} />
          </div>
        ) : examResults.length === 0 ? (
          <div style={{ background: HQ.SURFACE, border: `1px solid ${HQ.LINE}`, borderRadius: 18, padding: 48, textAlign: 'center' }}>
            <p style={{ margin: 0, fontSize: 16, fontWeight: 800, color: HQ.INK }}>لم يؤدِ أي طالب هذا الامتحان بعد</p>
          </div>
        ) : (
          <div className="hq-table-wrap">
            <table className="hq-table">
              <thead>
                <tr>
                  <th>الطالب</th>
                  <th style={{ textAlign: 'center' }}>الدرجة</th>
                  <th style={{ textAlign: 'center' }}>الحالة</th>
                  <th style={{ textAlign: 'center' }}>التاريخ</th>
                  <th style={{ textAlign: 'center' }}>إجراء</th>
                </tr>
              </thead>
              <tbody>
                {resultsPagination.paginatedItems.map((result) => {
                  const score = result.totalPercentage ?? result.writtenPercentage ?? 0;
                  const isPending = result.status === 'pending_oral_review';
                  return (
                    <tr key={result._id}>
                      <td data-label="الطالب">
                        <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <HqAvatar firstName={result.student?.firstName} lastName={result.student?.lastName} size={34} />
                          <strong>{result.student?.firstName} {result.student?.lastName}</strong>
                        </span>
                      </td>
                      <td data-label="الدرجة" style={{ textAlign: 'center' }}>
                        <strong style={{ fontSize: 18, color: result.isPassed ? HQ.MENTOR : score > 0 ? '#C2410C' : HQ.MUTED }}>
                          {score > 0 ? `${score}%` : '—'}
                        </strong>
                      </td>
                      <td data-label="الحالة" style={{ textAlign: 'center' }}>
                        {isPending ? <HqBadge tone="gold">قيد المراجعة</HqBadge>
                          : result.isPassed ? <HqBadge tone="mentor">ناجح</HqBadge>
                          : <HqBadge tone="neutral">يحتاج مراجعة</HqBadge>}
                      </td>
                      <td data-label="التاريخ" style={{ textAlign: 'center', fontSize: 13, color: HQ.MUTED, whiteSpace: 'nowrap' }}>
                        {formatDateAr(result.submittedAt)}
                      </td>
                      <td data-label="إجراء" style={{ textAlign: 'center' }}>
                        {result.oralRecordings?.length > 0 && (
                          <button type="button"
                            onClick={() => {
                              setReviewModal(result);
                              setReviewForm({
                                oralScore: result.oralScore ?? '',
                                teacherNotes: result.teacherNotes ?? '',
                                assignedLevel: result.student?.assignedLevel || 'foundation',
                              });
                            }}
                            className="hq-action" style={{ background: HQ.PAPER, border: `1px solid ${HQ.LINE}`, color: HQ.INK, padding: '0 14px', fontSize: 13 }}>
                            <Mic size={14} /> {isPending ? 'مراجعة التسجيل' : 'عرض / تعديل التقييم'}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <Pagination
              currentPage={resultsPagination.currentPage}
              totalPages={resultsPagination.totalPages}
              totalItems={resultsPagination.totalItems}
              pageSize={resultsPagination.pageSize}
              onPageChange={resultsPagination.setCurrentPage}
              onPageSizeChange={resultsPagination.setPageSize}
              showPageSize={true}
              pageSizeOptions={[5, 10, 20, 50]}
              itemName="طالب"
              className="border-t p-4"
              style={{ borderColor: HQ.LINE }}
            />
          </div>
        )}

        {/* Review Modal — same fields and PUT */}
        {reviewModal && (
          <div dir="rtl" style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: 'rgba(12,12,29,0.72)' }}>
            <div role="dialog" aria-modal="true" aria-label="مراجعة التسجيل"
              style={{ background: HQ.SURFACE, borderRadius: 18, padding: 24, width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto', border: `1px solid ${HQ.LINE}` }}>
              <h2 style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 900, color: HQ.INK }}>
                مراجعة تسجيل — {reviewModal.student?.firstName} {reviewModal.student?.lastName}
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                <span style={{ fontSize: 13, fontWeight: 800, color: HQ.MUTED }}>التسجيلات الصوتية</span>
                {reviewModal.oralRecordings?.map((rec, i) => (
                  <div key={i} style={{ background: HQ.PAPER, border: `1px solid ${HQ.LINE}`, borderRadius: 12, padding: 10 }}>
                    <p style={{ margin: '0 0 6px', fontSize: 12, color: HQ.MUTED }}>تسجيل {i + 1}</p>
                    {rec.audioUrl ? (
                      <audio controls src={rec.audioUrl} style={{ width: '100%', height: 36 }} />
                    ) : (
                      <p style={{ margin: 0, fontSize: 12, color: HQ.MUTED }}>حُذف التسجيل تلقائياً لتوفير المساحة 🧹 (التقييم محفوظ)</p>
                    )}
                  </div>
                ))}
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 800, color: HQ.INK, marginBottom: 6 }} htmlFor="rev-score">الدرجة الشفهية (من 100)</label>
                <input id="rev-score" type="number" min="0" max="100" value={reviewForm.oralScore}
                  onChange={e => setReviewForm(p => ({ ...p, oralScore: e.target.value }))}
                  style={inputStyle} placeholder="مثال: 85" />
              </div>
              {(reviewModal.exam?.type === 'placement' || reviewModal.examType === 'placement' || exam?.type === 'placement') && (
                <>
                  <div style={{ marginBottom: 12 }}>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 800, color: HQ.INK, marginBottom: 6 }} htmlFor="rev-level">
                      المستوى المعتمد للطالب
                    </label>
                    <select
                      id="rev-level"
                      value={reviewForm.assignedLevel || 'foundation'}
                      onChange={e => setReviewForm(p => ({ ...p, assignedLevel: e.target.value }))}
                      style={inputStyle}
                    >
                      <option value="foundation">المستوى التأسيسي</option>
                      <option value="memorization">مستوى الحفظ والتجويد</option>
                      <option value="teacher_prep">إعداد معلمين</option>
                      <option value="senior">كبار السن</option>
                    </select>
                  </div>

                  <div style={{ marginBottom: 12 }}>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 800, color: HQ.INK, marginBottom: 6 }}>
                      أيام البث الأسبوعية المحددة للطالب
                    </label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {['السبت', 'الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة'].map(day => {
                        const selected = (reviewForm.scheduleDays || []).includes(day);
                        return (
                          <button
                            key={day}
                            type="button"
                            onClick={() => {
                              const curr = reviewForm.scheduleDays || [];
                              const next = curr.includes(day) ? curr.filter(d => d !== day) : [...curr, day];
                              setReviewForm(p => ({ ...p, scheduleDays: next }));
                            }}
                            style={{
                              padding: '6px 12px',
                              borderRadius: 8,
                              fontSize: 12,
                              fontWeight: 700,
                              cursor: 'pointer',
                              border: `1px solid ${selected ? HQ.MENTOR : HQ.LINE}`,
                              background: selected ? HQ.MENTOR : HQ.PAPER,
                              color: selected ? '#fff' : HQ.INK,
                            }}
                          >
                            {day}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div style={{ marginBottom: 12 }}>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 800, color: HQ.INK, marginBottom: 6 }}>
                      ساعة بدء البث
                    </label>
                    <SessionTimePicker
                      value={reviewForm.sessionTime || '18:00'}
                      onChange={v => setReviewForm(p => ({ ...p, sessionTime: v }))}
                    />
                  </div>
                </>
              )}
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 800, color: HQ.INK, marginBottom: 6 }} htmlFor="rev-notes">ملاحظات وتوجيهات للطالب</label>
                <textarea id="rev-notes" value={reviewForm.teacherNotes}
                  onChange={e => setReviewForm(p => ({ ...p, teacherNotes: e.target.value }))}
                  style={{ ...inputStyle, minHeight: 96, resize: 'vertical', paddingTop: 10 }} placeholder="أضف ملاحظاتك وتوجيهاتك للطالب..." />
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" onClick={() => setReviewModal(null)} className="hq-action" style={{ flex: 1, background: HQ.PAPER, border: `1px solid ${HQ.LINE}`, color: HQ.INK, fontSize: 14 }}>إلغاء</button>
                <button type="button" onClick={handleReview} disabled={saving || !reviewForm.oralScore} className="hq-action"
                  style={{ flex: 1, background: HQ.MENTOR, color: '#fff', fontSize: 14, opacity: (saving || !reviewForm.oralScore) ? 0.5 : 1 }}>
                  {saving ? <LoadingSpinner size="sm" color="white" /> : 'حفظ التقييم واعتماد المواعيد'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </PageLayout>
  );
}
