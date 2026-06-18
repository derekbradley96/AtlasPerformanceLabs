import React from 'react';
import { ADMIN_IMPERSONATE_STORAGE_KEY } from '@/lib/AuthContext';

/**
 * Shown when admin role impersonation is active (localStorage key set in AuthContext).
 * Value is typically a canonical role string (coach | client | personal).
 */
export default function AdminImpersonationBanner() {
  const isImpersonating = Boolean(
    typeof window !== 'undefined' && window.localStorage.getItem(ADMIN_IMPERSONATE_STORAGE_KEY),
  );
  const impersonatedId = isImpersonating
    ? window.localStorage.getItem(ADMIN_IMPERSONATE_STORAGE_KEY)
    : null;

  if (!isImpersonating) return null;

  return (
    <div
      role="alert"
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 999,
        background: '#b45309',
        color: '#fff',
        padding: '6px 12px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        fontSize: 12,
        fontWeight: 500,
        gap: 8,
      }}
    >
      <span>⚠ Admin: Viewing as {impersonatedId}</span>
      <button
        type="button"
        onClick={() => {
          window.localStorage.removeItem(ADMIN_IMPERSONATE_STORAGE_KEY);
          window.location.reload();
        }}
        style={{
          background: 'rgba(255,255,255,0.2)',
          border: 'none',
          color: '#fff',
          borderRadius: 6,
          padding: '2px 8px',
          fontSize: 11,
          cursor: 'pointer',
        }}
      >
        Exit
      </button>
    </div>
  );
}
