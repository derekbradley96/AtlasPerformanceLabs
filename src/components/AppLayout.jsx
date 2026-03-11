import React from 'react';
import AuthGuard from '@/components/AuthGuard';
import OnboardingGate from '@/components/OnboardingGate';
import BottomNav from '@/components/ui/BottomNav';
import Sidebar from '@/components/ui/Sidebar';
import ActiveWorkoutBar from '@/components/ui/ActiveWorkoutBar';
import { useAuth } from '@/lib/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { invokeSupabaseFunction } from '@/lib/supabaseApi';

export default function AppLayout({ children, currentPageName }) {
  const { user, isLoadingAuth } = useAuth();

  const noShellPages = ['OnboardingRole', 'RoleSelection', 'ClientOnboarding', 'TrainerOnboarding'];
  const showShell = !noShellPages.includes(currentPageName);

  const { data: activeWorkout } = useQuery({
    queryKey: ['active-workout', user?.id],
    queryFn: async () => {
      const { data } = await invokeSupabaseFunction('workout-list', { user_id: user?.id, status: 'in_progress' });
      const list = Array.isArray(data) ? data : [];
      return list[0] || null;
    },
    enabled: !!user?.id && showShell
  });

  const userRole = user?.user_type ?? user?.role ?? 'general';
  const loading = isLoadingAuth;

  if (showShell && loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0B1220] text-white">
        <div className="w-6 h-6 border-2 border-white/20 border-t-blue-500 rounded-full animate-spin" />
      </div>
    );
  }
  const showWorkoutBar = activeWorkout && 
    currentPageName !== 'ActiveWorkout' && 
    currentPageName !== 'WorkoutSummary';

  // If no shell needed, render children directly
  if (!showShell) {
    return <>{children}</>;
  }

  // With full app shell (sidebar + bottom nav)
  return (
    <AuthGuard>
      <OnboardingGate>
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
          {/* Desktop Sidebar */}
          <Sidebar userRole={userRole} />
          
          {/* Main Content */}
          <main className="md:ml-64 pb-24 md:pb-0">
            {children}
          </main>

          {/* Active Workout Bar */}
          {showWorkoutBar && <ActiveWorkoutBar workout={activeWorkout} />}

          {/* Mobile Bottom Nav */}
          <BottomNav userRole={userRole} />
        </div>
      </OnboardingGate>
    </AuthGuard>
  );
}