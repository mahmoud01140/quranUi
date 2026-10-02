import { NavLink, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  LayoutDashboard, BookOpen, Video, FileText, TrendingUp,
  Users, ClipboardList, BarChart2, BookMarked, Volume2, CreditCard,
} from 'lucide-react';
import useAuthStore from '../../store/authStore';
import '../../components/halaqa/halaqa.css';
import { HQ } from '../../components/halaqa/primitives';

const studentNavItems = [
  { to: '/student', icon: LayoutDashboard, label: 'المطلوب اليوم', end: true },
  { to: '/student/curriculum', icon: BookOpen, label: 'الحصص' },
  { to: '/student/quran', icon: BookMarked, label: 'المصحف' },
  { to: '/student/subscription', icon: CreditCard, label: 'الاشتراك' },
];

const teacherNavItems = [
  { to: '/teacher', icon: LayoutDashboard, label: 'الرئيسية', end: true },
  { to: '/teacher/exams', icon: FileText, label: 'الامتحانات' },
  { to: '/teacher/review', icon: ClipboardList, label: 'التصحيح' },
];

const adminNavItems = [
  { to: '/admin', icon: LayoutDashboard, label: 'الرئيسية', end: true },
  { to: '/admin/pending', icon: ClipboardList, label: 'الانتظار' },
  { to: '/admin/exams', icon: FileText, label: 'الامتحانات' },
  { to: '/admin/users', icon: Users, label: 'الطلاب' },
];

const parentNavItems = [
  { to: '/parent', icon: LayoutDashboard, label: 'الرئيسية', end: true },
];

export default function MobileBottomNav() {
  const { user } = useAuthStore();
  const location = useLocation();

  if (!user) return null;

  // Hide bottom nav during exam taking or onboarding flows for maximum focus
  const isTakingExam = location.pathname.includes('/take') || location.pathname.startsWith('/onboarding');
  if (isTakingExam) return null;
  // Quran page has its own fixed audio player — avoid double fixed bars
  if (location.pathname.startsWith('/student/quran')) return null;

  const items = user.role === 'admin' ? adminNavItems
    : user.role === 'teacher' ? teacherNavItems
    : user.role === 'parent' ? parentNavItems
    : studentNavItems;

  if (items.length <= 1) return null;

  return (
    <nav
      aria-label="شريط التنقل السفلي للهاتف"
      className="halaqa lg:hidden fixed bottom-0 left-0 right-0 z-40"
      style={{
        background: HQ.SURFACE, borderTop: `1px solid ${HQ.LINE}`,
        paddingBottom: 'max(0.35rem, env(safe-area-inset-bottom))', paddingTop: 6, paddingLeft: 8, paddingRight: 8,
      }}
    >
      <div className="flex items-center justify-around max-w-lg mx-auto">
        {items.map((item) => {
          const Icon = item.icon;
          const isItemActive = item.pattern
            ? item.pattern.test(location.pathname)
            : item.end
              ? location.pathname === item.to
              : location.pathname.startsWith(item.to);

          return (
            <NavLink
              key={item.to}
              to={item.to}
              className="relative flex-1 flex flex-col items-center justify-center py-1 px-1 group select-none"
              style={{ minHeight: 56 }}
            >
              <motion.div
                whileTap={{ scale: 0.94 }}
                className="relative flex flex-col items-center justify-center w-full py-1 rounded-2xl"
                style={{
                  color: isItemActive ? HQ.MENTOR : HQ.MUTED,
                  fontWeight: isItemActive ? 800 : 500,
                  background: isItemActive ? '#E2EFE7' : 'transparent',
                }}
              >
                <div className="relative">
                  <Icon size={20} aria-hidden />
                </div>

                <span className="tracking-tight mt-0.5 leading-tight"
                  style={{ fontSize: '0.8125rem', fontWeight: isItemActive ? 800 : 500 }}>
                  {item.label}
                </span>
              </motion.div>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
