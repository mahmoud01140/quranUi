import { Link, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { LogOut, User, Menu, X, BookOpen, ChevronDown, KeyRound } from 'lucide-react';
import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import useAuthStore from '../../store/authStore';
import NotificationBell from './NotificationBell';
import ChangePasswordModal from './ChangePasswordModal';
import { getInitials, getAvatarColor } from '../../utils/helpers';

export default function Navbar({ onMenuClick }) {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);

  // Track scroll for navbar style change
  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close profile dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (profileOpen && !e.target.closest('.profile-dropdown')) {
        setProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [profileOpen]);

  const handleLogout = async () => {
    await logout();
    toast.success('تم تسجيل الخروج');
    navigate('/login');
  };

  const dashboardPath = user?.role === 'admin' ? '/admin'
    : user?.role === 'teacher' ? '/teacher' : '/student';

  const isLanding = location.pathname === '/';

  const roleLabel = (user?.role === 'admin' || user?.role === 'teacher') ? 'المعلم والمدير' 
    : user?.role === 'parent' ? 'ولي أمر' : 'طالب';

  return (
    <nav className={`fixed top-0 right-0 left-0 z-40 h-16 bg-white border-b border-[#E8E2D4] transition-shadow duration-200 ${
      scrolled
        ? 'shadow-md'
        : ''
    }`}>
      <div className="max-w-7xl mx-auto px-4 h-full flex items-center justify-between relative">
        {/* Logo and Sidebar Toggle */}
        <div className="flex items-center gap-2 sm:gap-3">
          {onMenuClick && (
            <button onClick={onMenuClick} aria-label="فتح القائمة" className="lg:hidden p-3 -mr-2 text-[#756E85] hover:bg-[#FBF7EE] rounded-xl transition-colors" title="فتح القائمة">
              <Menu className="w-5 h-5" />
            </button>
          )}
          <Link to={user ? dashboardPath : '/'} className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 bg-[#177B58] rounded-xl flex items-center justify-center group-hover:bg-[#0F5940] transition-colors duration-200">
              <BookOpen className="w-5 h-5 text-white" />
            </div>
            <div className="hidden sm:block">
              <div className="text-base font-bold text-[#2A2438] leading-tight group-hover:text-[#177B58] transition-colors">منصة الحلقة</div>
              <div className="text-xs text-[#177B58] font-medium">لتحفيظ القرآن الكريم</div>
            </div>
          </Link>
        </div>

        {/* Landing nav links (Desktop) */}
        {isLanding && !user && (
          <div className="hidden md:flex items-center gap-6 text-sm font-medium text-[#756E85]">
            <a href="#journey" className="hover:text-[#177B58] transition-colors relative nav-link-hover">كيف تسير الرحلة</a>
            <a href="#benefits" className="hover:text-[#177B58] transition-colors relative nav-link-hover">ماذا يحصل عليه الطالب</a>
            <a href="#live" className="hover:text-[#177B58] transition-colors relative nav-link-hover">المجلس الحي</a>
          </div>
        )}

        {/* Right side */}
        <div className="flex items-center gap-2 sm:gap-3">
          {user ? (
            <>
              <NotificationBell />

              {/* Profile dropdown */}
              <div className="relative profile-dropdown">
                <button 
                  onClick={() => setProfileOpen(!profileOpen)}
                  className="flex items-center gap-2 py-1.5 px-2 sm:px-3 rounded-xl hover:bg-[#FBF7EE] transition-all duration-200"
                >
                  {user.avatar ? (
                    <img src={user.avatar} alt="" className="w-8 h-8 rounded-full object-cover border-2 border-[#E8E2D4]" />
                  ) : (
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white shadow-sm"
                      style={{ backgroundColor: getAvatarColor(`${user.firstName}${user.lastName}`) }}
                    >
                      {getInitials(user.firstName, user.lastName)}
                    </div>
                  )}
                  <div className="hidden md:block text-right">
                    <span className="text-sm font-semibold text-[#2A2438] block leading-tight">
                      {user.firstName}
                    </span>
                    <span className="text-xs text-[#756E85]">{roleLabel}</span>
                  </div>
                  <ChevronDown className={`w-3.5 h-3.5 text-[#756E85] hidden sm:block transition-transform duration-200 ${profileOpen ? 'rotate-180' : ''}`} />
                </button>

                <AnimatePresence>
                  {profileOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -8, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -8, scale: 0.96 }}
                      transition={{ duration: 0.15 }}
                      className="absolute left-0 mt-2 w-56 bg-white rounded-2xl shadow-xl border border-[#E8E2D4] z-50 overflow-hidden"
                    >
                      {/* Profile header */}
                      <div className="p-4 border-b border-[#E8E2D4] bg-[#FBF7EE]">
                        <p className="font-bold text-[#2A2438] text-sm">{user.firstName} {user.lastName}</p>
                        <p className="text-xs text-[#756E85] mt-0.5 truncate">{user.email}</p>
                      </div>

                      {/* Menu items */}
                      <div className="p-2 space-y-1">
                        <button
                          onClick={() => { setProfileOpen(false); navigate(dashboardPath); }}
                          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-[#2A2438] hover:bg-[#FBF7EE] transition-colors"
                        >
                          <User className="w-4 h-4 text-[#756E85]" />
                          لوحة التحكم
                        </button>
                        <button
                          onClick={() => { setProfileOpen(false); setChangePasswordOpen(true); }}
                          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-[#2A2438] hover:bg-[#FBF7EE] transition-colors"
                        >
                          <KeyRound className="w-4 h-4 text-[#177B58]" />
                          تغيير كلمة المرور
                        </button>
                      </div>

                      {/* Logout */}
                      <div className="p-2 border-t border-[#E8E2D4]">
                        <button
                          onClick={() => { setProfileOpen(false); handleLogout(); }}
                          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-red-500 hover:bg-red-50 transition-colors"
                        >
                          <LogOut className="w-4 h-4" />
                          تسجيل الخروج
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Change Password Modal */}
              <ChangePasswordModal
                isOpen={changePasswordOpen}
                onClose={() => setChangePasswordOpen(false)}
              />

            </>
          ) : (
            <div className="flex items-center gap-2">
              <Link to="/login" className="hidden sm:flex btn-ghost text-sm">دخول</Link>
              <Link to="/register" className="btn-primary text-sm py-2 px-4">تسجيل مجاني</Link>
              
              {/* Landing Page Mobile Menu Toggle */}
              {isLanding && (
                <button 
                  onClick={() => setMenuOpen(!menuOpen)} 
                  aria-label={menuOpen ? 'إغلاق القائمة' : 'فتح القائمة'}
                  aria-expanded={menuOpen}
                  className="md:hidden p-2 -ml-2 text-[#2A2438] hover:bg-[#FBF7EE] rounded-xl"
                >
                  {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Landing Page Mobile Menu Dropdown */}
      {isLanding && !user && menuOpen && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className="md:hidden absolute top-16 left-0 right-0 bg-white border-b border-[#E8E2D4] shadow-lg py-4 px-4 flex flex-col gap-4"
        >
          <a href="#journey" onClick={() => setMenuOpen(false)} className="text-[#2A2438] font-semibold hover:text-[#177B58] transition-colors py-1">كيف تسير الرحلة</a>
          <a href="#benefits" onClick={() => setMenuOpen(false)} className="text-[#2A2438] font-semibold hover:text-[#177B58] transition-colors py-1">ماذا يحصل عليه الطالب</a>
          <a href="#live" onClick={() => setMenuOpen(false)} className="text-[#2A2438] font-semibold hover:text-[#177B58] transition-colors py-1">المجلس الحي</a>
          <Link to="/login" onClick={() => setMenuOpen(false)} className="text-[#2A2438] font-semibold hover:text-[#177B58] transition-colors py-1 sm:hidden">تسجيل الدخول</Link>
        </motion.div>
      )}

    </nav>
  );
}
