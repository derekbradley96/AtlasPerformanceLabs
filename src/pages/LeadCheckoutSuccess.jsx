import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle } from 'lucide-react';
import Button from '@/ui/Button';
import { colors, spacing } from '@/ui/tokens';
import { createClientStub } from '@/lib/clientStubStore';
import { invokeSupabaseFunction } from '@/lib/supabaseApi';

const LEAD_CHECKOUT_PENDING_KEY = 'lead_checkout_pending';

function isSupabaseConfigured() {
  const url = typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL;
  return !!(url && typeof url === 'string' && url.trim() !== '');
}

export default function LeadCheckoutSuccess() {
  const [searchParams] = useSearchParams();
  const [converted, setConverted] = useState(false);
  const sessionId = searchParams.get('session_id');

  useEffect(() => {
    if (converted) return;
    const pendingRaw = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(LEAD_CHECKOUT_PENDING_KEY) : null;
    const pending = pendingRaw ? (() => { try { return JSON.parse(pendingRaw); } catch { return null; } })() : null;

    if (sessionId && isSupabaseConfigured()) {
      invokeSupabaseFunction('atlas-lead-convert', { session_id: sessionId })
        .then(() => setConverted(true))
        .catch(() => setConverted(true));
      return;
    }
    if (!sessionId && pending && pending.uid) {
      try {
        createClientStub({
          trainerId: pending.uid,
          fullName: pending.name || pending.email || 'New client',
          email: pending.email || '',
          leadId: 'lead-checkout',
        });
        sessionStorage.removeItem(LEAD_CHECKOUT_PENDING_KEY);
      } catch (_) {}
      setConverted(true);
      return;
    }
    setConverted(true);
  }, [sessionId, converted]);

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-6"
      style={{ background: colors.bg, color: colors.text }}
    >
      <CheckCircle size={48} style={{ color: colors.success, marginBottom: spacing[16] }} />
      <h1 className="text-xl font-semibold mb-2">Payment successful</h1>
      <p className="text-sm mb-6 text-center" style={{ color: colors.muted }}>
        Your coach will be in touch. Check your email for confirmation.
      </p>
      <Link to="/">
        <Button variant="primary">Done</Button>
      </Link>
    </div>
  );
}
