import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import RoleSelection from '@/pages/RoleSelection';

export default function OnboardingRole() {
  const { isDemoMode } = useAuth();
  if (isDemoMode) return <Navigate to="/home" replace />;
  return <RoleSelection />;
}