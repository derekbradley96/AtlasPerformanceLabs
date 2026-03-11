import React from 'react';
import { Link } from 'react-router-dom';
import Button from '@/ui/Button';
import { colors } from '@/ui/tokens';

export default function LeadCheckoutCancel() {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-6"
      style={{ background: colors.bg, color: colors.text }}
    >
      <h1 className="text-xl font-semibold mb-2">Checkout cancelled</h1>
      <p className="text-sm mb-6 text-center" style={{ color: colors.muted }}>
        You can try again when you’re ready.
      </p>
      <Link to="/">
        <Button variant="secondary">Back</Button>
      </Link>
    </div>
  );
}
