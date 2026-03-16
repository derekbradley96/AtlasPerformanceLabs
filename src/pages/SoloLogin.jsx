/**
 * Redirect wrapper: sends to unified auth screen with personal login.
 * Production auth flow is unified through /auth. Legacy role-select pages are DEV/demo only.
 */
import React from 'react';
import { Navigate } from 'react-router-dom';

export default function SoloLogin() {
  return <Navigate to="/auth?mode=login&account=personal" replace />;
}
