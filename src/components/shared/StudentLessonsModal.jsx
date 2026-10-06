import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BookOpen, X, Pencil, Award, MessageCircle, Trash2,
  CheckCircle, Plus,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { formatDateAr } from '../../utils/helpers';
import { HQ } from '../halaqa/primitives';
import LoadingSpinner from './LoadingSpinner';
import ConfirmModal from './ConfirmModal';

/* مودال دروس الطالب الفورية — نفس التجربة في كل صفحات الأدمن:
   عرض الدروس + تعديل المصادر + إنشاء اختبار + دخول المناقشة + حذف الدرس.
   user: كائن الطالب أو null (null = مغلق) | discussionBase: مسار المناقشات (admin/teacher) */

const selectStyle = {
  padding: '10px 14px', borderRadius: 12, border: `1px solid ${HQ.LINE}`,
  background: HQ.PAPER, fontSize: 14, color: HQ.INK, fontFamily: 'inherit', minHeight: 48,
};

const blankQuestion = () => ({
  text: '', type: 'mcq', options: ['', '', '', ''],
  correctAnswer: 0, correctAnswerBool: true, correctAnswerText: '',
});

export default function StudentLessonsModal({ user, onClose, discussionBase = '/admin' }) {
  const navigate = useNavigate();
  const [lessons, setLessons] = useState([]);
  const [lessonsLoading, setLessonsLoading] = useState(false);
  const [editingLessonId, setEditingLessonId] = useState(null);
  const [lessonEditForm, setLessonEditForm] = useState({ title: '', description: '', resources: '', videoUrl: '' });
  const [savingLessonId, setSavingLessonId] = useState(null);

  // Delete lesson confirm
  const [deleteLessonConfirm, setDeleteLessonConfirm] = useState(null);
  const [deletingLessonId, setDeletingLessonId] = useState(null);

  // Per-lesson exam creation modal
  const [examModalLesson, setExamModalLesson] = useState(null);
  const [examForm, setExamForm] = useState({ title: '', passingScore: 60, questions: [] });
  const [savingExam, setSavingExam] = useState(false);

  useEffect(() => {
    if (!user) return;
    setLessons([]);
    setEditingLessonId(null);
    setExamModalLesson(null);
    setDeleteLessonConfirm(null);
    setLessonsLoading(true);
    api.get(`/study-plans/student/${user._id}/full`)
      .then(res => {
        const list = res.data?.plan?.customLessons || [];
        setLessons([...list].reverse()); // الأحدث أولاً
      })
      .catch(() => toast.error('تعذر جلب دروس الطالب'))
      .finally(() => setLessonsLoading(false));
  }, [user?._id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!user) return null;

  const startEditLesson = (lesson) => {
    setEditingLessonId(lesson._id);
    setLessonEditForm({
      title: lesson.title || '',
      description: lesson.description || '',
      resources: lesson.resources || '',
      videoUrl: lesson.videoUrl || '',
    });
  };

  const handleSaveLessonEdit = async () => {
    if (!editingLessonId) return;
    setSavingLessonId(editingLessonId);
    try {
      await api.put(
        `/study-plans/student/${user._id}/lessons/${editingLessonId}`,
        lessonEditForm
      );
      toast.success('تم حفظ تعديل الدرس والمصادر بنجاح ✅');
      setLessons(prev => prev.map(l =>
        l._id === editingLessonId ? { ...l, ...lessonEditForm } : l
      ));
      setEditingLessonId(null);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'خطأ في حفظ الدرس');
    } finally {
      setSavingLessonId(null);
    }
  };

  const handleDeleteLesson = async () => {
    if (!deleteLessonConfirm) return;
    const lessonId = deleteLessonConfirm._id;
    setDeletingLessonId(lessonId);
    try {
      const res = await api.delete(
        `/study-plans/student/${user._id}/lessons/${lessonId}`
      );
      toast.success(res.data?.message || 'تم حذف الدرس بنجاح');
      setLessons(prev => prev.filter(l => l._id !== lessonId));
      setDeleteLessonConfirm(null);
      if (editingLessonId === lessonId) setEditingLessonId(null);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'خطأ في حذف الدرس');
    } finally {
      setDeletingLessonId(null);
    }
  };

  const openExamModal = (lesson) => {
    setExamModalLesson(lesson);
    setExamForm({
      title: `اختبار: ${lesson.title || 'الحصة'}`,
      passingScore: 60,
      questions: [blankQuestion()],
    });
  };

  const updateExamQuestion = (idx, field, value) => {
    setExamForm(prev => {
      const questions = prev.questions.map((q, i) => {
        if (i !== idx) return q;
        const next = { ...q, [field]: value };
        if (field === 'type' && value !== 'mcq') next.options = [];
        if (field === 'type' && value === 'mcq' && !next.options?.length) next.options = ['', '', '', ''];
        return next;
      });
      return { ...prev, questions };
    });
  };

  const updateExamOption = (qi, oi, value) => {
    setExamForm(prev => {
      const questions = prev.questions.map((q, i) => {
        if (i !== qi) return q;
        const options = [...(q.options || [])];
        options[oi] = value;
        return { ...q, options };
      });
      return { ...prev, questions };
    });
  };

  const handleSaveLessonExam = async () => {
    if (!examModalLesson) return;
    const title = examForm.title?.trim();
    if (!title) return toast.error('أدخل عنوان الاختبار');
    const validQuestions = (examForm.questions || []).filter(q => q.text?.trim());
    if (!validQuestions.length) return toast.error('أضف سؤالاً واحداً على الأقل');
    for (const q of validQuestions) {
      if (q.type === 'mcq' && (q.options || []).filter(o => o?.trim()).length < 2) {
        return toast.error('سؤال الاختيار من متعدد يحتاج خيارين على الأقل');
      }
    }
    setSavingExam(true);
    try {
      // 1. إنشاء الامتحان فردياً للطالب وربطه بالحصة
      const payload = {
        title,
        type: 'lesson',
        targetType: 'individual',
        targetStudent: user._id,
        lessonId: examModalLesson._id,
        lessonTitle: examModalLesson.title,
        passingScore: Number(examForm.passingScore) || 60,
        questions: validQuestions.map((q, i) => ({
          questionNumber: i + 1,
          text: q.text.trim(),
          type: q.type,
          options: q.type === 'mcq' ? q.options.filter(o => o?.trim()) : [],
          correctAnswer: q.type === 'mcq' ? Number(q.correctAnswer) || 0 : undefined,
          correctAnswerBool: q.type === 'true_false' ? q.correctAnswerBool !== false : undefined,
          correctAnswerText: q.type === 'written' ? (q.correctAnswerText?.trim() || '') : undefined,
          points: 1,
        })),
      };
      const res = await api.post('/exams', payload);
      const newExam = res.data?.exam;
      // 2. ربط الامتحان بالحصة ليظهر للطالب في الحصص السابقة
      await api.put(
        `/study-plans/student/${user._id}/lessons/${examModalLesson._id}`,
        { exam: newExam._id }
      );
      setLessons(prev => prev.map(l =>
        l._id === examModalLesson._id ? { ...l, exam: newExam } : l
      ));
      toast.success('تم إنشاء الاختبار وربطه بالحصة — سيظهر للطالب في الحصص السابقة ✅');
      setExamModalLesson(null);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'خطأ في إنشاء الاختبار');
    } finally {
      setSavingExam(false);
    }
  };

  const openLessonDiscussion = (lessonId) => {
    navigate(`${discussionBase}/lessons/${lessonId}/discussion`);
  };

  return (
    <>
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
        <div style={{ background: HQ.SURFACE, borderRadius: 20, padding: 24, maxWidth: 640, width: '100%', border: `1px solid ${HQ.LINE}`, boxShadow: '0 10px 30px rgba(0,0,0,0.2)', maxHeight: '90vh', overflowY: 'auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: HQ.INK, display: 'flex', alignItems: 'center', gap: 8 }}>
              <BookOpen size={18} color={HQ.MENTOR} /> الدروس الفورية للطالب
            </h3>
            <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: HQ.MUTED }}>
              <X size={20} />
            </button>
          </div>

          <p style={{ margin: '0 0 16px', fontSize: 14, color: HQ.MUTED }}>
            الطالب: <strong>{user.firstName} {user.lastName}</strong> ({user.email})
            {lessons.length > 0 && ` — ${lessons.length} درس`}
          </p>

          {lessonsLoading ? (
            <div style={{ textAlign: 'center', padding: 32 }}>
              <LoadingSpinner size="md" text="جارٍ جلب الدروس..." />
            </div>
          ) : lessons.length === 0 ? (
            <div style={{ background: HQ.PAPER, border: `1px solid ${HQ.LINE}`, borderRadius: 14, padding: 24, textAlign: 'center' }}>
              <BookOpen size={32} color={HQ.LINE} style={{ margin: '0 auto 8px' }} />
              <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: HQ.INK }}>لا توجد دروس فورية بعد</p>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: HQ.MUTED }}>ابدأ بثاً مباشراً مع الطالب ليُنشأ أول درس تلقائياً.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {lessons.map(lesson => {
                const isEditing = editingLessonId === lesson._id;
                return (
                  <div key={lesson._id} style={{ background: HQ.PAPER, border: `1px solid ${HQ.LINE}`, borderRadius: 14, padding: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, flexWrap: 'wrap' }}>
                      <div style={{ flex: 1, minWidth: 200 }}>
                        <p style={{ margin: '0 0 2px', fontSize: 14, fontWeight: 900, color: HQ.INK }}>
                          {lesson.lessonNumber ? `الدرس ${lesson.lessonNumber}: ` : ''}{lesson.title}
                        </p>
                        <p style={{ margin: 0, fontSize: 12, color: HQ.MUTED }}>
                          {lesson.createdAt ? formatDateAr(lesson.createdAt) : ''} · الحالة: {lesson.status === 'completed' ? 'مكتمل' : lesson.status === 'in_progress' ? 'جارٍ' : 'بانتظار'}
                          {lesson.resources ? ' · يوجد مصادر مرفقة' : ' · بدون مصادر'}
                          {lesson.exam ? ` · الاختبار: ${lesson.exam.title || 'مرتبط'}` : ' · بدون اختبار'}
                        </p>
                      </div>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          onClick={() => isEditing ? setEditingLessonId(null) : startEditLesson(lesson)}
                          className="hq-action"
                          style={{ background: HQ.SURFACE, border: `1px solid ${HQ.LINE}`, color: HQ.INK, padding: '0 12px', fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 5 }}
                        >
                          <Pencil size={14} /> {isEditing ? 'إغلاق التعديل' : 'تعديل المصادر'}
                        </button>
                        <button
                          type="button"
                          onClick={() => openExamModal(lesson)}
                          className="hq-action"
                          style={{ background: '#F8EDD3', border: '1px solid #D9A441', color: '#7C5A12', padding: '0 12px', fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 5 }}
                          title="إنشاء اختبار لهذه الحصة يظهر للطالب في الحصص السابقة"
                        >
                          <Award size={14} /> {lesson.exam ? 'استبدال الاختبار' : 'إنشاء اختبار'}
                        </button>
                        <button
                          type="button"
                          onClick={() => openLessonDiscussion(lesson._id)}
                          className="hq-action"
                          style={{ background: '#E2EFE7', border: 'none', color: '#0F5940', padding: '0 12px', fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 5 }}
                        >
                          <MessageCircle size={14} /> دخول المناقشة
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteLessonConfirm(lesson)}
                          disabled={deletingLessonId === lesson._id}
                          className="hq-action"
                          style={{ background: '#FDECEC', border: '1px solid #E8B4B4', color: '#C2410C', padding: '0 12px', fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 5, opacity: deletingLessonId === lesson._id ? 0.6 : 1 }}
                          title="حذف هذا الدرس نهائياً من خطة الطالب"
                        >
                          {deletingLessonId === lesson._id ? <LoadingSpinner size="sm" /> : <><Trash2 size={14} /> حذف</>}
                        </button>
                      </div>
                    </div>

                    {isEditing && (
                      <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${HQ.LINE}`, display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <label style={{ fontSize: 12, fontWeight: 800, color: HQ.INK }}>
                          عنوان الدرس
                          <input
                            type="text"
                            value={lessonEditForm.title}
                            onChange={e => setLessonEditForm(p => ({ ...p, title: e.target.value }))}
                            style={{ ...selectStyle, width: '100%', marginTop: 4 }}
                          />
                        </label>
                        <label style={{ fontSize: 12, fontWeight: 800, color: HQ.INK }}>
                          المصادر والروابط
                          <textarea
                            value={lessonEditForm.resources}
                            onChange={e => setLessonEditForm(p => ({ ...p, resources: e.target.value }))}
                            rows={2}
                            placeholder="روابط ملفات، مصحف، مراجع..."
                            style={{ ...selectStyle, width: '100%', marginTop: 4, minHeight: 64, paddingTop: 8, resize: 'vertical' }}
                          />
                        </label>
                        <label style={{ fontSize: 12, fontWeight: 800, color: HQ.INK }}>
                          رابط الفيديو
                          <input
                            type="url"
                            value={lessonEditForm.videoUrl}
                            onChange={e => setLessonEditForm(p => ({ ...p, videoUrl: e.target.value }))}
                            placeholder="https://..."
                            style={{ ...selectStyle, width: '100%', marginTop: 4, direction: 'ltr' }}
                          />
                        </label>
                        <label style={{ fontSize: 12, fontWeight: 800, color: HQ.INK }}>
                          ملاحظات الدرس
                          <textarea
                            value={lessonEditForm.description}
                            onChange={e => setLessonEditForm(p => ({ ...p, description: e.target.value }))}
                            rows={2}
                            style={{ ...selectStyle, width: '100%', marginTop: 4, minHeight: 56, paddingTop: 8, resize: 'vertical' }}
                          />
                        </label>
                        <button
                          type="button"
                          onClick={handleSaveLessonEdit}
                          disabled={savingLessonId === lesson._id}
                          className="hq-action"
                          style={{ background: HQ.MENTOR, color: '#fff', fontSize: 14 }}
                        >
                          {savingLessonId === lesson._id ? <LoadingSpinner size="sm" /> : 'حفظ التعديل'}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Delete lesson confirm */}
      <ConfirmModal
        open={Boolean(deleteLessonConfirm)}
        title="حذف الدرس؟"
        message={deleteLessonConfirm ? `حذف "${deleteLessonConfirm.title || 'الدرس'}" نهائياً من خطة الطالب؟ سيُعاد ترقيم الدروس المتبقية. لا يمكن التراجع.` : ''}
        confirmLabel="حذف نهائي"
        danger
        busy={deletingLessonId === deleteLessonConfirm?._id}
        onConfirm={handleDeleteLesson}
        onClose={() => setDeleteLessonConfirm(null)}
      />

      {/* Per-lesson exam creation modal */}
      {examModalLesson && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: HQ.SURFACE, borderRadius: 20, padding: 24, maxWidth: 640, width: '100%', border: `1px solid ${HQ.LINE}`, boxShadow: '0 10px 30px rgba(0,0,0,0.25)', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: HQ.INK, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Award size={18} color="#B45309" /> اختبار جديد للحصة
              </h3>
              <button type="button" onClick={() => setExamModalLesson(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: HQ.MUTED }}>
                <X size={20} />
              </button>
            </div>

            <p style={{ margin: '0 0 16px', fontSize: 13, color: HQ.MUTED }}>
              الحصة: <strong>{examModalLesson.title}</strong> · الطالب: <strong>{user.firstName} {user.lastName}</strong>
              <span style={{ display: 'block', marginTop: 4 }}>سيظهر الاختبار للطالب في الحصص السابقة فور إنشائه.</span>
            </p>

            <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
              <label style={{ flex: 3, minWidth: 220, fontSize: 12, fontWeight: 800, color: HQ.INK }}>
                عنوان الاختبار *
                <input
                  type="text"
                  value={examForm.title}
                  onChange={e => setExamForm(p => ({ ...p, title: e.target.value }))}
                  style={{ ...selectStyle, width: '100%', marginTop: 4 }}
                />
              </label>
              <label style={{ flex: 1, minWidth: 110, fontSize: 12, fontWeight: 800, color: HQ.INK }}>
                درجة النجاح %
                <input
                  type="number" min={0} max={100}
                  value={examForm.passingScore}
                  onChange={e => setExamForm(p => ({ ...p, passingScore: e.target.value }))}
                  style={{ ...selectStyle, width: '100%', marginTop: 4 }}
                />
              </label>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 14 }}>
              {examForm.questions.map((q, qi) => (
                <div key={qi} style={{ background: HQ.PAPER, border: `1px solid ${HQ.LINE}`, borderRadius: 14, padding: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <strong style={{ fontSize: 13, color: HQ.INK }}>السؤال {qi + 1}</strong>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <select
                        value={q.type}
                        onChange={e => updateExamQuestion(qi, 'type', e.target.value)}
                        style={{ ...selectStyle, minHeight: 44, fontSize: 12, padding: '0 8px' }}
                      >
                        <option value="mcq">اختيار من متعدد</option>
                        <option value="true_false">صح / خطأ</option>
                        <option value="written">مقالي</option>
                      </select>
                      {examForm.questions.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setExamForm(p => ({ ...p, questions: p.questions.filter((_, i) => i !== qi) }))}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#C2410C', display: 'inline-flex', padding: 6 }}
                          title="حذف السؤال"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </div>

                  <input
                    type="text"
                    value={q.text}
                    onChange={e => updateExamQuestion(qi, 'text', e.target.value)}
                    placeholder="نص السؤال..."
                    style={{ ...selectStyle, width: '100%', marginBottom: 8 }}
                  />

                  {q.type === 'mcq' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {(q.options || []).map((opt, oi) => (
                        <div key={oi} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          <button
                            type="button"
                            onClick={() => updateExamQuestion(qi, 'correctAnswer', oi)}
                            title={q.correctAnswer === oi ? 'الإجابة الصحيحة' : 'تحديد كإجابة صحيحة'}
                            style={{
                              width: 36, height: 36, flex: 'none', borderRadius: 10, cursor: 'pointer',
                              border: `2px solid ${q.correctAnswer === oi ? HQ.MENTOR : HQ.LINE}`,
                              background: q.correctAnswer === oi ? HQ.MENTOR : 'transparent',
                              color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            }}
                          >
                            {q.correctAnswer === oi && <CheckCircle size={15} />}
                          </button>
                          <input
                            type="text"
                            value={opt}
                            onChange={e => updateExamOption(qi, oi, e.target.value)}
                            placeholder={`الخيار ${oi + 1}`}
                            style={{ ...selectStyle, flex: 1 }}
                          />
                        </div>
                      ))}
                      <p style={{ margin: 0, fontSize: 11, color: HQ.MUTED }}>اضغط الدائرة الخضراء لتحديد الإجابة الصحيحة.</p>
                    </div>
                  )}

                  {q.type === 'true_false' && (
                    <div style={{ display: 'flex', gap: 8 }}>
                      {[true, false].map(val => (
                        <button
                          key={String(val)}
                          type="button"
                          onClick={() => updateExamQuestion(qi, 'correctAnswerBool', val)}
                          style={{
                            flex: 1, minHeight: 44, borderRadius: 10, cursor: 'pointer', fontSize: 13, fontWeight: 800,
                            border: `2px solid ${q.correctAnswerBool === val ? HQ.MENTOR : HQ.LINE}`,
                            background: q.correctAnswerBool === val ? '#E2EFE7' : HQ.SURFACE,
                            color: q.correctAnswerBool === val ? '#0F5940' : HQ.MUTED,
                          }}
                        >
                          {val ? 'صحيح' : 'خطأ'}
                        </button>
                      ))}
                    </div>
                  )}

                  {q.type === 'written' && (
                    <input
                      type="text"
                      value={q.correctAnswerText}
                      onChange={e => updateExamQuestion(qi, 'correctAnswerText', e.target.value)}
                      placeholder="الإجابة النموذجية (اختياري)"
                      style={{ ...selectStyle, width: '100%' }}
                    />
                  )}
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setExamForm(p => ({ ...p, questions: [...p.questions, blankQuestion()] }))}
              className="hq-action"
              style={{ width: '100%', background: HQ.PAPER, border: `1px dashed ${HQ.MENTOR}`, color: HQ.MENTOR, fontSize: 14, marginBottom: 12 }}
            >
              <Plus size={16} /> إضافة سؤال
            </button>

            <div className="m-modal-actions" style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                onClick={() => setExamModalLesson(null)}
                className="hq-action"
                style={{ flex: 1, background: HQ.PAPER, border: `1px solid ${HQ.LINE}`, color: HQ.INK, fontSize: 14 }}
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleSaveLessonExam}
                disabled={savingExam}
                className="hq-action"
                style={{ flex: 2, background: HQ.MENTOR, color: '#fff', fontSize: 14 }}
              >
                {savingExam ? <LoadingSpinner size="sm" /> : <><Award size={16} /> إنشاء وربط الاختبار بالحصة</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
