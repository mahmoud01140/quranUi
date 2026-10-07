import { useState } from 'react';
import { motion } from 'framer-motion';
import Navbar from './Navbar';
import Sidebar from './Sidebar';
import MobileBottomNav from './MobileBottomNav';
import useNotifications from '../../hooks/useNotifications';

const pageVariants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.25, ease: 'easeOut' } },
  exit: { opacity: 0, y: -8, transition: { duration: 0.2 } },
};

export default function PageLayout({ children, className = '' }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  useNotifications();

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#FBF7EE' }}>
      <Navbar onMenuClick={() => setSidebarOpen(true)} />
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <main className="lg:mr-64 pt-16 pb-28 lg:pb-8 flex-1">
        <motion.div
          variants={pageVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          className={`page-container ${className}`}
        >
          {children}
        </motion.div>
      </main>

      <MobileBottomNav />
    </div>
  );
}
