import React from 'react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { useAuth } from '@/lib/AuthContext';

export default function OnboardingGate({ children }) {
  const { isDemoMode, role, isAdminBypass, user } = useAuth();
  const navigate = useNavigate();
  const isDev = import.meta.env.DEV;

  if (isDemoMode) return children;
  if (role && role !== 'admin') return children;
  if (isAdminBypass) return children;

  const userRole = user?.user_type ?? user?.role;
  const hasRole = !!userRole;
  const loading = false;

  if (!hasRole && !isDev) {
    navigate(createPageUrl('OnboardingRole'), { replace: true });
    return (
      <div className="min-h-screen bg-atlas-bg flex flex-col items-center justify-center gap-4 text-atlas-text p-6">
        <h1 className="text-xl font-semibold">Atlas Performance Labs</h1>
        <p className="text-slate-400 text-center">Choose your role to continue.</p>
        <button
          type="button"
          onClick={() => navigate(createPageUrl('OnboardingRole'), { replace: true })}
          className="px-4 py-2 bg-atlas-accent hover:bg-atlas-accent/90 rounded-lg text-white font-medium"
        >
          Choose role
        </button>
      </div>
    );
  }

  return children;
}