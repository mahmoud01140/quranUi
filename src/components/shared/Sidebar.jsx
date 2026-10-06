import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Users, BookOpen, Video, FileText,
  BarChart2, Settings, BookMarked, ClipboardList,
  UserCheck, Book, TrendingUp, ChevronLeft, Sparkles,
  CalendarCheck, FolderOpen, Flame, CreditCard,
  Volume2, MessageSquare,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import useAuthStore from '../../store/authStore';
import { getInitials, getAvatarColor, getLevelLabel } from '../../utils/helpers';
import '../../components/halaqa/halaqa.css';
import { HQ } from '../../components/halaqa/primitives';

const studentLinks = [
  { to: '/student', icon: LayoutDashboard, label: 'المطلوب مني اليوم', end: true },
  { to: '/student/curriculum', icon: BookOpen, label: 'الحصص السابقة' },
  { to: '/student/quran', icon: BookMarked, label: 'المصحف الإلكتروني والمعلم' },
  { to: '/student/discussion', icon: MessageSquare, label: 'المناقشة مع الإدارة' },
  { to: '/student/resources', icon: FolderOpen, label: 'المكتبة التعليمية' },
  { to: '/student/subscription', icon: CreditCard, label: 'الاشتراك' },
];

const teacherLinks = [
  { to: '/teacher', icon: LayoutDashboard, label: 'الرئيسية', end: true },
  { to: '/teacher/review', icon: ClipboardList, label: 'مركز التصحيح والمراجعة' },
  { to: '/teacher/exams', icon: FileText, label: 'بنك وإدارة الامتحانات' },
  { to: '/teacher/resources', icon: FolderOpen, label: 'المكتبة التعليمية' },
];

/* Grouped by function — same routes, no path changes. `section` renders
   a quiet header above the first link of each functional group. */
const adminLinks = [
  { to: '/admin', icon: LayoutDashboard, label: 'لوحة اليوم', end: true },
  { section: 'المحتوى والاختبارات' },
  { to: '/admin/exams', icon: FileText, label: 'بنك وإدارة الامتحانات' },
  { section: 'الإدارة' },
  { to: '/admin/users', icon: Users, label: 'إدارة الطلاب والمستخدمين' },
  { to: '/admin/discussions', icon: MessageSquare, label: 'رسائل واستفسارات الطلاب' },
  { to: '/admin/pending', icon: UserCheck, label: 'بانتظار تحديد المستوى' },
  { to: '/admin/schedule', icon: CalendarCheck, label: 'مواعيد الحصص' },
  { to: '/admin/payments', icon: CreditCard, label: 'الاشتراكات والمدفوعات' },
  { to: '/admin/reports', icon: BarChart2, label: 'كشوف الحضور والغياب' },
  { section: 'النظام' },
  { to: '/admin/resources', icon: FolderOpen, label: 'المكتبة التعليمية' },
  { to: '/admin/onboarding-settings', icon: Settings, label: 'إعدادات تحديد المستوى' },
];

const parentLinks = [
  { to: '/parent', icon: LayoutDashboard, label: 'الرئيسية', end: true },
];

const ROLE_BADGE = {
  admin: { bg: '#ECE9F4', fg: '#4A3F6B' },
  teacher: { bg: '#ECE9F4', fg: '#4A3F6B' },
  parent: { bg: '#F1EDE1', fg: '#756E85' },
  student: { bg: '#E2EFE7', fg: '#0F5940' },
};

export default function Sidebar({ isOpen, onClose }) {
  const { user } = useAuthStore();
  const navigate = useNavigate();

  /* Role navigation: each role sees only its own links.
     Same routes, no permission changes — presentation only. */
  const links = user?.role === 'admin' ? adminLinks
    : user?.role === 'teacher' ? teacherLinks
    : user?.role === 'parent' ? parentLinks
    : studentLinks;

  const roleLabel = user?.role === 'admin' ? 'مدير'
    : user?.role === 'teacher' ? 'معلم'
    : user?.role === 'parent' ? 'ولي أمر'
    : `طالب — ${getLevelLabel(user?.assignedLevel)}`;

  const badge = ROLE_BADGE[user?.role] || ROLE_BADGE.student;

  const sidebarContent = (
    <div className="halaqa flex flex-col h-full" style={{ background: HQ.SURFACE }}>
      {/* User card */}
      <div className="p-5" style={{ borderBottom: `1px solid ${HQ.LINE}` }}>
        <div className="flex items-center gap-3">
          <span
            aria-hidden
            className="avatar-circle"
            style={{
              width: 48, height: 48, fontSize: 17, flex: 'none',
              backgroundColor: getAvatarColor(`${user?.firstName}${user?.lastName}`),
            }}
          >
            {getInitials(user?.firstName, user?.lastName)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-bold leading-tight truncate" style={{ color: HQ.INK }}>
              {user?.firstName} {user?.lastName}
            </p>
            <span className="text-xs mt-1 inline-block"
              style={{ background: badge.bg, color: badge.fg, borderRadius: 9999, padding: '4px 12px', fontWeight: 700 }}>
              {roleLabel}
            </span>
          </div>
        </div>

        {/* Quick stats for student */}
        {user?.role === 'student' && (
          <div className="mt-3 flex items-center justify-between gap-2 rounded-xl px-3 py-2"
            style={{ background: HQ.PAPER, border: `1px solid ${HQ.LINE}` }}>
            <div className="flex items-center gap-1.5">
              <Sparkles size={15} color={HQ.MENTOR} aria-hidden />
              <span className="text-xs font-bold" style={{ color: HQ.MENTOR, fontVariantNumeric: 'tabular-nums' }}>{user?.points || 0} XP</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Flame size={14} color={HQ.MUTED} aria-hidden />
              <span className="text-xs font-bold" style={{ color: HQ.MUTED, fontVariantNumeric: 'tabular-nums' }}>{user?.streak || 0} أيام</span>
            </div>
          </div>
        )}
      </div>

      {/* Nav links */}
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto" aria-label="التنقل الرئيسي">
        {links.map((item, idx) => {
          if (item.section) {
            return (
              <p key={`sec-${idx}`} className="font-bold px-3 pt-4 pb-1" style={{ fontSize: 13, color: HQ.MUTED }}>
                {item.section}
              </p>
            );
          }
          const { to, icon: Icon, label, end } = item;
          return (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={onClose}
            className={({ isActive }) =>
              `sidebar-item group ${isActive ? 'active' : ''}`
            }
          >
            {({ isActive }) => (
              <>
                <span aria-hidden style={{
                  width: 36, height: 36, borderRadius: 12, flex: 'none',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  background: isActive ? HQ.MENTOR : HQ.PAPER,
                  color: isActive ? '#fff' : HQ.MUTED,
                }}>
                  <Icon size={18} />
                </span>
                <span className="truncate">{label}</span>
                {isActive && (
                  <span aria-hidden style={{
                    position: 'absolute', right: 0, width: 4, height: 32,
                    background: HQ.MENTOR, borderRadius: '9999px 0 0 9999px',
                  }} />
                )}
              </>
            )}
          </NavLink>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-4" style={{ borderTop: `1px solid ${HQ.LINE}` }}>
        <div className="rounded-xl p-3 text-center text-white" style={{ background: HQ.MENTOR }}>
          <p className="text-xs font-medium opacity-90" style={{ margin: 0 }}>منصة الحلقة لتحفيظ القرآن الكريم</p>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-64 h-screen fixed right-0 top-16 z-30"
        style={{ background: HQ.SURFACE, borderLeft: `1px solid ${HQ.LINE}` }} aria-label="القائمة الجانبية">
        {sidebarContent}
      </aside>

      {/* Mobile overlay */}
      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="lg:hidden fixed inset-0 z-40"
              style={{ background: 'rgba(42,36,56,0.5)' }}
              onClick={onClose}
            />
            <motion.aside
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className="lg:hidden fixed right-0 top-0 bottom-0 w-72 z-50"
              style={{ background: HQ.SURFACE }}
              aria-label="القائمة الجانبية"
            >
              <div className="h-16 flex items-center justify-between px-4" style={{ borderBottom: `1px solid ${HQ.LINE}` }}>
                <span className="font-bold" style={{ color: HQ.INK }}>القائمة</span>
                <button type="button" onClick={onClose} aria-label="إغلاق القائمة"
                  style={{ minWidth: 44, minHeight: 44, borderRadius: 12, border: 'none', background: 'transparent', color: HQ.MUTED, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                  <ChevronLeft size={19} aria-hidden />
                </button>
              </div>
              {sidebarContent}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
