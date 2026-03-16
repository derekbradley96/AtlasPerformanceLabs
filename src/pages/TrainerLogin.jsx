/**
 * Redirect wrapper: sends to unified auth screen with coach login.
 * Production auth flow is unified through /auth. Legacy role-select pages are DEV/demo only.
 */
import React from 'react';
import { Navigate } from 'react-router-dom';

export default function TrainerLogin() {
  return <Navigate to="/auth?mode=login&account=coach" replace />;
}
