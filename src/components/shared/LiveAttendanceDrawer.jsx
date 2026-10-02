import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { UserCheck, Check, X, RefreshCw } from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { getAvatarColor, getInitials } from '../../utils/helpers';
import '../../components/halaqa/halaqa.css';
import { HQ } from '../../components/halaqa/primitives';

/* الحضور المبسط — زر تحضير واحد لكل طالب.
   ضغطة = حاضر، ضغطة ثانية = إلغاء التحضير (غائب). بدون أي تفاصيل إضافية. */

export default function LiveAttendanceDrawer({
  isOpen,
  onClose,
  sessionId,
  sessionTitle,
  groupName,
  singleStudentId,
  singleStudentName,
}) {
  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState([]); // [{ _id, firstName, lastName, present }]
  const [togglingId, setTogglingId] = useState(null);

  useEffect(() => {
    if (isOpen && sessionId) {
      fetchList();
    }
  }, [isOpen, sessionId]);

  const fetchList = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/live/${sessionId}/attendance-sheet`);
      const sheet = res.data.sheet || [];
      if (sheet.length) {
        setStudents(sheet.map(r => ({
          _id: r.student._id,
          firstName: r.student.firstName,
          lastName: r.student.lastName,
          present: r.status === 'present',
        })));
      } else if (singleStudentId) {
        // جلسة فردية: لا يوجد كشف مجموعة — نعرض الطالب وحده
        const [first = '', ...rest] = (singleStudentName || '').split(' ');
        setStudents([{
          _id: singleStudentId,
          firstName: first || 'الطالب',
          lastName: rest.join(' ') || '',
          present: false,
        }]);
      } else {
        setStudents([]);
      }
    } catch {
      // fallback للجلسة الفردية عند فشل جلب الكشف
      if (singleStudentId) {
        const [first = '', ...rest] = (singleStudentName || '').split(' ');
        setStudents([{
          _id: singleStudentId,
          firstName: first || 'الطالب',
          lastName: rest.join(' ') || '',
          present: false,
        }]);
      } else {
        toast.error('تعذر جلب قائمة الحضور');
        setStudents([]);
      }
    } finally {
      setLoading(false);
    }
  };

  // ضغطة واحدة = حاضر، الضغطة الثانية = إلغاء (غائب) — يُحفظ فوراً
  const handleToggle = async (stu) => {
    const nextPresent = !stu.present;
    setTogglingId(stu._id);
    setStudents(prev => prev.map(s =>
      s._id === stu._id ? { ...s, present: nextPresent } : s
    ));
    try {
      await api.put(`/live/${sessionId}/attendance-sheet`, {
        records: [{
          studentId: stu._id,
          status: nextPresent ? 'present' : 'absent',
        }],
        notifyParents: false,
      });
    } catch {
      // التراجع عند الفشل
      setStudents(prev => prev.map(s =>
        s._id === stu._id ? { ...s, present: !nextPresent } : s
      ));
      toast.error('تعذر حفظ الحضور');
    } finally {
      setTogglingId(null);
    }
  };

  const presentCount = students.filter(s => s.present).length;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 z-50"
            style={{ background: 'rgba(42,36,56,0.55)' }}
          />

          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="halaqa fixed inset-y-0 right-0 z-50 w-full flex flex-col overflow-hidden"
            style={{ maxWidth: 420, background: HQ.PAPER }}
            dir="rtl"
            role="dialog" aria-modal="true" aria-label="الحضور"
          >
            {/* Header */}
            <div className="p-4 flex items-center justify-between flex-none"
              style={{ background: HQ.SURFACE, borderBottom: `1px solid ${HQ.LINE}` }}>
              <div className="flex items-center gap-3 min-w-0">
                <span aria-hidden style={{
                  width: 40, height: 40, borderRadius: 14, background: '#E2EFE7', color: HQ.MENTOR,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flex: 'none',
                }}>
                  <UserCheck size={19} />
                </span>
                <div className="min-w-0">
                  <h2 className="font-bold text-base" style={{ color: HQ.INK, margin: 0 }}>
                    الحضور {students.length > 0 && (
                      <span style={{ color: HQ.MENTOR }}>({presentCount}/{students.length})</span>
                    )}
                  </h2>
                  <p className="text-xs" style={{ color: HQ.MUTED, margin: 0 }}>
                    {groupName || singleStudentName || sessionTitle || 'الحصة المباشرة'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="إغلاق الحضور"
                style={{
                  minWidth: 44, minHeight: 44, borderRadius: 12, border: 'none',
                  background: 'transparent', color: HQ.MUTED, cursor: 'pointer',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <X size={19} aria-hidden />
              </button>
            </div>

            {/* List — اسم + زر تحضير واحد فقط */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-16" style={{ color: HQ.MUTED }}>
                  <RefreshCw size={28} color={HQ.MENTOR} className="animate-spin mb-3" aria-hidden />
                  <p className="text-xs font-bold" style={{ margin: 0 }}>جارٍ التحميل...</p>
                </div>
              ) : students.length === 0 ? (
                <p className="text-center text-sm py-12" style={{ color: HQ.MUTED }}>
                  لا يوجد طلاب في هذه الجلسة
                </p>
              ) : (
                students.map(stu => (
                  <div
                    key={stu._id}
                    className="flex items-center justify-between gap-3 p-3 rounded-2xl"
                    style={{
                      background: HQ.SURFACE,
                      border: `1px solid ${stu.present ? HQ.MENTOR : HQ.LINE}`,
                    }}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span aria-hidden className="avatar-circle"
                        style={{
                          width: 40, height: 40, fontSize: 13, flex: 'none',
                          backgroundColor: getAvatarColor(`${stu.firstName}${stu.lastName}`),
                        }}>
                        {getInitials(stu.firstName, stu.lastName)}
                      </span>
                      <p className="font-bold text-sm truncate" style={{ color: HQ.INK, margin: 0 }}>
                        {stu.firstName} {stu.lastName}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleToggle(stu)}
                      disabled={togglingId === stu._id}
                      aria-pressed={stu.present}
                      className="hq-action"
                      style={{
                        minWidth: 110,
                        background: stu.present ? HQ.MENTOR : HQ.PAPER,
                        color: stu.present ? '#fff' : HQ.INK,
                        border: stu.present ? 'none' : `1px solid ${HQ.LINE}`,
                        fontSize: 14,
                        opacity: togglingId === stu._id ? 0.6 : 1,
                      }}
                    >
                      {togglingId === stu._id ? (
                        <RefreshCw size={15} className="animate-spin" aria-hidden />
                      ) : stu.present ? (
                        <><Check size={15} aria-hidden /> حاضر</>
                      ) : (
                        'تحضير'
                      )}
                    </button>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
