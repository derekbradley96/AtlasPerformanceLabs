import React from 'react';
import { useNavigate } from 'react-router-dom';
import { CreditCard } from 'lucide-react';
import Card from '@/ui/Card';
import { Button } from '@/components/ui/button';
import { colors, spacing, radii } from '@/ui/tokens';
import { hapticLight } from '@/lib/haptics';

/**
 * Reminder when coach has not connected Stripe for client payouts.
 * @param {{ visible: boolean, compact?: boolean }} props
 */
export default function CoachPayoutSetupBanner({ visible, compact }) {
  const navigate = useNavigate();
  if (!visible) return null;

  return (
    <Card
      style={{
        marginBottom: spacing[12],
        padding: compact ? spacing[12] : spacing[14],
        borderRadius: radii.lg,
        border: `1px solid rgba(245, 158, 11, 0.35)`,
        background: 'rgba(245, 158, 11, 0.08)',
      }}
    >
      <div className={`flex ${compact ? 'flex-col sm:flex-row' : 'flex-col sm:flex-row'} items-stretch sm:items-center gap-3`}>
        <div
          className="shrink-0 rounded-xl flex items-center justify-center"
          style={{ width: 40, height: 40, background: 'rgba(255,255,255,0.08)' }}
        >
          <CreditCard size={20} style={{ color: colors.warning }} aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-semibold" style={{ color: colors.text }}>
            You&apos;re not set up to receive payments yet
          </p>
          <p className="text-[12px] mt-1 leading-relaxed" style={{ color: colors.muted }}>
            Connect Stripe under Billing &amp; payouts to get paid when clients subscribe.
          </p>
        </div>
        <Button
          type="button"
          variant="secondary"
          className="w-full sm:w-auto shrink-0 font-semibold"
          onClick={() => {
            hapticLight();
            navigate('/earnings');
          }}
        >
          Set up payouts
        </Button>
      </div>
    </Card>
  );
}
