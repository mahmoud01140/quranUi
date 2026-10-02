import { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import useAuthStore from '../../store/authStore';
import api from '../../services/api';
import { isSubscriptionBlocked } from '../../utils/helpers';
import LoadingSpinner from './LoadingSpinner';

// Pages where an expired/unsubscribed student is still allowed:
// paying, waiting for review/group, or finishing the mandatory placement.
const SUB_ALLOWLIST = ['/student/subscription', '/waiting-approval', '/onboarding'];

// Short-lived cache so every student navigation doesn't refetch billing status.
let subCache = { userId: null, at: 0, blocked: false };
const SUB_TTL_MS = 60_000;

export default function ProtectedRoute({ children, role }) {
  const { user, isCheckingAuth } = useAuthStore();
  const location = useLocation();
  const [subCheck, setSubCheck] = useState({ checking: true, blocked: false });

  const isStudentRoute = location.pathname.startsWith('/student');
  const isOnboardingRoute = location.pathname.startsWith('/onboarding');
  const isWaitingRoute = location.pathname === '/waiting-approval';
  const isSubExempt =
    SUB_ALLOWLIST.some((p) => location.pathname === p || location.pathname.startsWith(`${p}/`));

  const needsSubCheck =
    !!user &&
    user.role === 'student' &&
    !!user.assignedLevel &&
    isStudentRoute &&
    !isSubExempt;

  useEffect(() => {
    let cancelled = false;
    if (!needsSubCheck) {
      setSubCheck({ checking: false, blocked: false });
      return undefined;
    }
    const now = Date.now();
    if (subCache.userId === user._id && now - subCache.at < SUB_TTL_MS) {
      setSubCheck({ checking: false, blocked: subCache.blocked });
      return undefined;
    }
    setSubCheck((s) => ({ ...s, checking: true }));
    api.get('/payments/my-history')
      .then((res) => {
        if (cancelled) return;
        const blocked = isSubscriptionBlocked(res.data?.subscription);
        subCache = { userId: user._id, at: Date.now(), blocked };
        setSubCheck({ checking: false, blocked });
      })
      .catch(() => {
        // Fail-open: never lock the student out because billing status failed to load.
        if (!cancelled) setSubCheck({ checking: false, blocked: false });
      });
    return () => { cancelled = true; };
  }, [needsSubCheck, user?._id, location.pathname]);

  if (isCheckingAuth || (needsSubCheck && subCheck.checking && subCache.userId !== user?._id)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;

  // Role check — admin can access everything, role can be string or array
  const isRoleAllowed = !role || user.role === 'admin' || (
    Array.isArray(role) ? role.includes(user.role) : user.role === role
  );
  if (!isRoleAllowed) {
    const paths = { student: '/student', teacher: '/teacher', admin: '/admin', parent: '/parent' };
    return <Navigate to={paths[user.role] || '/'} replace />;
  }

  if (user.role === 'student') {
    // 1. Full subscription block: expired or trial-consumed students can only
    //    pay, wait, or finish placement — everything else is locked.
    if (needsSubCheck && (subCheck.blocked || subCache.blocked)) {
      return <Navigate to="/student/subscription" replace />;
    }

    // 2. Placement order enforcement.
    if (!user.placementExamTaken) {
      if (isStudentRoute || isWaitingRoute) {
        return <Navigate to="/onboarding/type" replace />;
      }
      if (location.pathname === '/onboarding/result' || location.pathname === '/waiting-approval') {
        return <Navigate to="/onboarding/type" replace />;
      }
      return children;
    }

    // 3. Written done but level not confirmed yet → waiting room
    //    (oral-exam return is allowed so the mandatory oral can be completed).
    const isOralRoute = location.pathname === '/onboarding/oral-exam';
    const isResultRoute = location.pathname === '/onboarding/result';
    const oralPending =
      typeof localStorage !== 'undefined' &&
      localStorage.getItem(`oral_pending_${user._id}`) === '1';
    if (isOnboardingRoute && !isOralRoute && !isResultRoute && user.placementExamTaken) {
      if (user.assignedLevel) {
        return <Navigate to="/student" replace />;
      }
      return <Navigate to="/waiting-approval" replace />;
    }
    if (isOralRoute && user.assignedLevel && !oralPending) {
      return <Navigate to="/student" replace />;
    }
    if (isStudentRoute && !user.assignedLevel && !isSubExempt) {
      return <Navigate to="/waiting-approval" replace />;
    }
  }

  return children;
}
