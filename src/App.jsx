import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useEffect, Suspense, lazy } from 'react';
import { AnimatePresence } from 'framer-motion';
import useAuthStore from './store/authStore';

// Shared
import ProtectedRoute from './components/shared/ProtectedRoute';
import LoadingSpinner from './components/shared/LoadingSpinner';
import ScrollToTop from './components/shared/ScrollToTop';

// Dev-only: floating panel to fill survey & exam with test data (tree-shaken in production)
const DevTestPanel = import.meta.env.DEV
  ? lazy(() => import('./components/dev/DevTestPanel'))
  : () => null;

// Pages — lazy loaded (code-split per route)
const LandingPage = lazy(() => import('./pages/LandingPage'));
const LoginPage = lazy(() => import('./pages/auth/LoginPage'));
const RegisterPage = lazy(() => import('./pages/auth/RegisterPage'));
const ForgotPasswordPage = lazy(() => import('./pages/auth/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('./pages/auth/ResetPasswordPage'));

// Onboarding
const RegistrationTypePage = lazy(() => import('./pages/onboarding/RegistrationTypePage'));
const SurveyPage = lazy(() => import('./pages/onboarding/SurveyPage'));
const WrittenExamPage = lazy(() => import('./pages/onboarding/WrittenExamPage'));
const OralExamPage = lazy(() => import('./pages/onboarding/OralExamPage'));
const ResultPage = lazy(() => import('./pages/onboarding/ResultPage'));
const WaitingApprovalPage = lazy(() => import('./pages/onboarding/WaitingApprovalPage'));
const StudentScheduleBookingPage = lazy(() => import('./pages/onboarding/StudentScheduleBookingPage'));

// Student
const StudentDashboard = lazy(() => import('./pages/student/StudentDashboard'));

const LiveClassPage = lazy(() => import('./pages/student/LiveClassPage'));
const CurriculumPage = lazy(() => import('./pages/student/CurriculumPage'));
const ProgressPage = lazy(() => import('./pages/student/ProgressPage'));
const TakeExamPage = lazy(() => import('./pages/student/TakeExamPage'));
const LessonDiscussionPage = lazy(() => import('./pages/student/LessonDiscussionPage'));
const StudentResourcesPage = lazy(() => import('./pages/student/StudentResourcesPage'));
const LessonPage = lazy(() => import('./pages/student/LessonPage'));
const QuranViewerPage = lazy(() => import('./pages/student/QuranViewerPage'));
const SubscriptionPage = lazy(() => import('./pages/student/SubscriptionPage'));
const StudentDiscussionPage = lazy(() => import('./pages/student/StudentDiscussionPage'));

// Teacher
const TeacherDashboard = lazy(() => import('./pages/teacher/TeacherDashboard'));

const LiveBroadcastPage = lazy(() => import('./pages/teacher/LiveBroadcastPage'));
const TeacherReviewCenterPage = lazy(() => import('./pages/teacher/TeacherReviewCenterPage'));
const CreateExamPage = lazy(() => import('./pages/teacher/CreateExamPage'));

// Admin
const TodayDashboardPage = lazy(() => import('./pages/admin/TodayDashboardPage'));
const AdminOnboardingSettingsPage = lazy(() => import('./pages/admin/AdminOnboardingSettingsPage'));
const AdminPaymentsPage = lazy(() => import('./pages/admin/AdminPaymentsPage'));
const UsersManagement = lazy(() => import('./pages/admin/UsersManagement'));
const PendingLevelPage = lazy(() => import('./pages/admin/PendingLevelPage'));
const SessionsSchedulePage = lazy(() => import('./pages/admin/SessionsSchedulePage'));
const ReportsPage = lazy(() => import('./pages/admin/ReportsPage'));
const AdminExamsPage = lazy(() => import('./pages/admin/AdminExamsPage'));
const AdminExamResultsPage = lazy(() => import('./pages/admin/AdminExamResultsPage'));
const AdminResourcesPage = lazy(() => import('./pages/admin/AdminResourcesPage'));
const AdminDiscussionsPage = lazy(() => import('./pages/admin/AdminDiscussionsPage'));
const NotificationSettingsPage = lazy(() => import('./pages/admin/NotificationSettingsPage'));

// Parent
const ParentDashboard = lazy(() => import('./pages/parent/ParentDashboard'));

export default function App() {
  const { checkAuth, isCheckingAuth, user } = useAuthStore();
  const location = useLocation();

  useEffect(() => {
    checkAuth();
  }, []);

  if (isCheckingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#FBF7EE' }}>
        <LoadingSpinner size="lg" text="جارٍ التحقق من الجلسة..." />
      </div>
    );
  }

  return (
    <>
      <ScrollToTop />
      {import.meta.env.DEV && <Suspense fallback={null}><DevTestPanel /></Suspense>}
      <AnimatePresence mode="wait">
        <Suspense fallback={
          <div className="min-h-screen flex items-center justify-center">
            <LoadingSpinner size="md" text="جارٍ التحميل..." />
          </div>
        }>
          <Routes location={location} key={location.pathname}>
            {/* Public */}
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={user ? <Navigate to={getDashboardPath(user)} /> : <LoginPage />} />
            <Route path="/register" element={user ? <Navigate to={getDashboardPath(user)} /> : <RegisterPage />} />
            <Route path="/forgot-password" element={user ? <Navigate to={getDashboardPath(user)} /> : <ForgotPasswordPage />} />
            {/* Reset link must always render — the user is typically logged in when clicking it */}
            <Route path="/reset-password/:token" element={<ResetPasswordPage />} />

            {/* Waiting approval — user took exam but awaiting review */}
            <Route path="/waiting-approval" element={
              <ProtectedRoute>
                <WaitingApprovalPage />
              </ProtectedRoute>
            } />

            {/* Onboarding — requires auth, guarded against re-entry if exam taken */}
            <Route path="/onboarding/type" element={<ProtectedRoute><RegistrationTypePage /></ProtectedRoute>} />
            <Route path="/onboarding/survey" element={<ProtectedRoute><SurveyPage /></ProtectedRoute>} />
            <Route path="/onboarding/written-exam" element={<ProtectedRoute><WrittenExamPage /></ProtectedRoute>} />
            <Route path="/onboarding/oral-exam" element={<ProtectedRoute><OralExamPage /></ProtectedRoute>} />
            <Route path="/onboarding/result" element={<ProtectedRoute><ResultPage /></ProtectedRoute>} />
            <Route path="/onboarding/schedule" element={<ProtectedRoute><StudentScheduleBookingPage /></ProtectedRoute>} />

            {/* Student routes */}
            <Route path="/student" element={<ProtectedRoute role="student"><StudentDashboard /></ProtectedRoute>} />
            <Route path="/student/group" element={<Navigate to="/student/curriculum" replace />} />
            <Route path="/student/live" element={<ProtectedRoute role="student"><LiveClassPage /></ProtectedRoute>} />
            <Route path="/student/curriculum" element={<ProtectedRoute role="student"><CurriculumPage /></ProtectedRoute>} />
            <Route path="/student/exams" element={<ProtectedRoute role="student"><Navigate to="/student?tab=exams" replace /></ProtectedRoute>} />
            <Route path="/student/progress" element={<ProtectedRoute role="student"><ProgressPage /></ProtectedRoute>} />
            <Route path="/student/subscription" element={<ProtectedRoute role="student"><SubscriptionPage /></ProtectedRoute>} />
            <Route path="/student/homework" element={<ProtectedRoute role="student"><Navigate to="/student?tab=exams" replace /></ProtectedRoute>} />
            <Route path="/student/exams/:examId/take" element={<ProtectedRoute role="student"><TakeExamPage /></ProtectedRoute>} />
            <Route path="/student/discussion" element={<ProtectedRoute role="student"><StudentDiscussionPage /></ProtectedRoute>} />
            <Route path="/student/lessons/:lessonId/discussion" element={<Navigate to="/student/discussion" replace />} />
            <Route path="/student/daily-tracker" element={<ProtectedRoute role="student"><Navigate to="/student?tab=wird" replace /></ProtectedRoute>} />
            <Route path="/student/resources" element={<ProtectedRoute role="student"><StudentResourcesPage /></ProtectedRoute>} />
            <Route path="/student/quran" element={<ProtectedRoute role="student"><QuranViewerPage /></ProtectedRoute>} />
            <Route path="/student/lessons/:lessonId" element={<ProtectedRoute role="student"><LessonPage /></ProtectedRoute>} />

            {/* Teacher routes */}
            <Route path="/teacher" element={<ProtectedRoute role="teacher"><TeacherDashboard /></ProtectedRoute>} />
            <Route path="/teacher/groups" element={<Navigate to="/teacher" replace />} />
            <Route path="/teacher/broadcast" element={<BroadcastRedirect />} />
            <Route path="/teacher/review" element={<ProtectedRoute role={['teacher', 'admin']}><TeacherReviewCenterPage /></ProtectedRoute>} />
            <Route path="/teacher/homework" element={<ProtectedRoute role="teacher"><Navigate to="/teacher/review" replace /></ProtectedRoute>} />
            <Route path="/teacher/recordings" element={<ProtectedRoute role="teacher"><Navigate to="/teacher/review" replace /></ProtectedRoute>} />
            <Route path="/teacher/create-exam" element={<ProtectedRoute role="teacher"><CreateExamPage /></ProtectedRoute>} />
            <Route path="/teacher/lessons/:lessonId/discussion" element={<ProtectedRoute role="teacher"><LessonDiscussionPage /></ProtectedRoute>} />
            <Route path="/teacher/resources" element={<ProtectedRoute role="teacher"><StudentResourcesPage /></ProtectedRoute>} />

            {/* Admin routes — لوحة اليوم هي البداية */}
            <Route path="/admin" element={<ProtectedRoute role="admin"><TodayDashboardPage /></ProtectedRoute>} />
            <Route path="/admin/today" element={<Navigate to="/admin" replace />} />
            <Route path="/admin/review" element={<ProtectedRoute role="admin"><Navigate to="/admin/users" replace /></ProtectedRoute>} />
            <Route path="/admin/onboarding-settings" element={<ProtectedRoute role="admin"><AdminOnboardingSettingsPage /></ProtectedRoute>} />
            <Route path="/admin/notifications" element={<ProtectedRoute role="admin"><NotificationSettingsPage /></ProtectedRoute>} />
            <Route path="/admin/payments" element={<ProtectedRoute role="admin"><AdminPaymentsPage /></ProtectedRoute>} />
            <Route path="/admin/users" element={<ProtectedRoute role="admin"><UsersManagement /></ProtectedRoute>} />
            <Route path="/admin/pending" element={<ProtectedRoute role="admin"><PendingLevelPage /></ProtectedRoute>} />
            <Route path="/admin/schedule" element={<ProtectedRoute role="admin"><SessionsSchedulePage /></ProtectedRoute>} />
            <Route path="/admin/groups" element={<Navigate to="/admin/users" replace />} />
            <Route path="/admin/assign" element={<Navigate to="/admin/users" replace />} />
            <Route path="/admin/reports" element={<ProtectedRoute role="admin"><ReportsPage /></ProtectedRoute>} />
            <Route path="/admin/live" element={<ProtectedRoute role={['admin', 'teacher']}><LiveBroadcastPage /></ProtectedRoute>} />
            <Route path="/admin/groups/:groupId/curriculum" element={<Navigate to="/admin/users" replace />} />
            <Route path="/admin/exams" element={<ProtectedRoute role="admin"><AdminExamsPage /></ProtectedRoute>} />
            <Route path="/admin/exams/:examId/results" element={<ProtectedRoute role="admin"><AdminExamResultsPage /></ProtectedRoute>} />
            <Route path="/teacher/exams" element={<ProtectedRoute role="teacher"><AdminExamsPage /></ProtectedRoute>} />
            <Route path="/admin/discussions" element={<ProtectedRoute role="admin"><AdminDiscussionsPage /></ProtectedRoute>} />
            <Route path="/admin/lessons/:lessonId/discussion" element={<Navigate to="/admin/discussions" replace />} />
            <Route path="/admin/resources" element={<ProtectedRoute role="admin"><AdminResourcesPage /></ProtectedRoute>} />

            {/* Parent routes */}
            <Route path="/parent" element={<ProtectedRoute role="parent"><ParentDashboard /></ProtectedRoute>} />

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </AnimatePresence>
    </>
  );
}


/* مسار /teacher/broadcast المحذوف → تحويلة آمنة للمسار الموحد مع تمرير الـ state */
function BroadcastRedirect() {
  const location = useLocation();
  return <Navigate to="/admin/live" replace state={location.state} />;
}

function getDashboardPath(user) {
  if (!user) return '/login';
  if (user.role === 'admin') return '/admin';
  if (user.role === 'teacher') return '/teacher';
  if (user.role === 'parent') return '/parent';

  // Student flow: check if placement exam was taken
  if (user.placementExamTaken) {
    if (!user.sessionTime || !user.scheduleDays?.length) return '/onboarding/schedule';
    return '/student';
  }

  // New user — hasn't taken exam yet
  if (!user.assignedLevel) return '/onboarding/type';
  return '/student';
}
