import React from 'react';
import { useAuth } from '@/lib/AuthContext';

export default function AuthGuard({ children }) {
  const { isDemoMode, role, isAdminBypass, isAuthenticated, navigateToLogin } = useAuth();

  if (isDemoMode) return children;
  if (role && role !== 'admin') return children;
  if (isAdminBypass) return children;

  if (!isAuthenticated) {
    if (typeof window !== 'undefined') navigateToLogin();
    return (
      <div className="min-h-screen bg-atlas-bg flex flex-col items-center justify-center gap-4 text-atlas-text p-6">
        <h1 className="text-xl font-semibold">Atlas Performance Labs</h1>
        <p className="text-slate-400 text-center">Please sign in to continue.</p>
        <a
          href="/"
          className="px-4 py-2 bg-atlas-accent hover:bg-atlas-accent/90 rounded-lg text-white font-medium"
        >
          Sign in
        </a>
      </div>
    );
  }

  return children;
}