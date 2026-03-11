/**
 * Public lead checkout: select service, enter name/email, pay via Stripe Checkout.
 * URL: /lead-checkout?uid=USER_ID&service=SERVICE_ID (optional: name=, email=)
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import Card from '@/ui/Card';
import Button from '@/ui/Button';
import { colors, spacing } from '@/ui/tokens';
import { toast } from 'sonner';
import { listServices, stripeCheckoutSession, MOCK_SERVICES } from '@/lib/supabaseStripeApi';

const getFunctionsUrl = () => (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL) ? 'yes' : null;
const useSupabase = !!getFunctionsUrl();

function formatPrice(amount, currency = 'gbp') {
  if (amount == null) return '—';
  const value = currency.toLowerCase() === 'gbp' ? amount / 100 : amount / 100;
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: currency.toUpperCase(), minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);
}

export default function LeadCheckout() {
  const [searchParams] = useSearchParams();
  const uid = searchParams.get('uid');
  const serviceId = searchParams.get('service');
  const [services, setServices] = useState([]);
  const [service, setService] = useState(null);
  const [loading, setLoading] = useState(!!uid);
  const [paying, setPaying] = useState(false);
  const [name, setName] = useState(searchParams.get('name') || '');
  const [email, setEmail] = useState(searchParams.get('email') || '');

  useEffect(() => {
    if (!uid) {
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const { services: list } = useSupabase ? await listServices(uid) : { services: MOCK_SERVICES };
        const arr = Array.isArray(list) ? list : MOCK_SERVICES;
        setServices(arr);
        const s = serviceId ? arr.find((x) => x.id === serviceId) : arr[0];
        setService(s ?? null);
      } catch (e) {
        setServices(MOCK_SERVICES);
        setService(MOCK_SERVICES.find((x) => x.id === serviceId) ?? MOCK_SERVICES[0] ?? null);
      } finally {
        setLoading(false);
      }
    })();
  }, [uid, serviceId]);

  const handlePay = useCallback(async () => {
    const n = (name || '').trim();
    const e = (email || '').trim();
    if (!e) {
      toast.error('Email required');
      return;
    }
    if (!uid || !service?.id) {
      toast.error('Missing coach or service');
      return;
    }
    setPaying(true);
    try {
      const { url, error } = await stripeCheckoutSession({
        user_id: uid,
        service_id: service.id,
        lead_name: n || e,
        lead_email: e,
      });
      if (error) {
        toast.error(error);
        return;
      }
      if (url) {
        try {
          sessionStorage.setItem('lead_checkout_pending', JSON.stringify({ uid, name: (n || '').trim(), email: (e || '').trim() }));
        } catch (_) {}
        window.location.href = url;
        return;
      }
      toast.error('No checkout URL');
    } catch (err) {
      toast.error(err?.message ?? 'Checkout failed');
    } finally {
      setPaying(false);
    }
  }, [uid, service, name, email]);

  if (!uid) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: colors.bg, color: colors.muted }}>
        <p className="text-sm">Invalid link. Use the payment link from your coach.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: colors.bg, color: colors.muted }}>
        <p className="text-sm">Loading…</p>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen"
      style={{
        padding: spacing[24],
        paddingBottom: spacing[24] + 40,
        background: colors.bg,
        color: colors.text,
      }}
    >
      <h1 className="text-xl font-semibold mb-2" style={{ color: colors.text }}>Checkout</h1>
      <p className="text-sm mb-6" style={{ color: colors.muted }}>Choose a plan and pay securely with Stripe.</p>

      {services.length > 1 && (
        <div className="mb-6">
          <p className="text-xs font-medium mb-2" style={{ color: colors.muted }}>Plan</p>
          <div className="flex flex-wrap gap-2">
            {services.filter((s) => s.active !== false).map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setService(s)}
                className="rounded-xl px-4 py-3 text-left border-none transition-colors"
                style={{
                  background: service?.id === s.id ? colors.accent : 'rgba(255,255,255,0.08)',
                  color: service?.id === s.id ? '#fff' : colors.text,
                }}
              >
                <span className="font-medium">{s.name}</span>
                <span className="block text-xs opacity-90">{formatPrice(s.price_amount, s.currency)}/{s.interval || 'month'}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {service && (
        <Card style={{ marginBottom: spacing[16], padding: spacing[16] }}>
          <p className="font-medium" style={{ color: colors.text }}>{service.name}</p>
          <p className="text-lg font-semibold mt-1" style={{ color: colors.accent }}>{formatPrice(service.price_amount, service.currency)}/{service.interval || 'month'}</p>
          {service.description ? <p className="text-sm mt-2" style={{ color: colors.muted }}>{service.description}</p> : null}
        </Card>
      )}

      <Card style={{ padding: spacing[16] }}>
        <input
          type="text"
          placeholder="Your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-lg px-3 py-2.5 text-[15px] border-none mb-3"
          style={{ background: 'rgba(255,255,255,0.08)', color: colors.text }}
        />
        <input
          type="email"
          placeholder="Email *"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-lg px-3 py-2.5 text-[15px] border-none mb-4"
          style={{ background: 'rgba(255,255,255,0.08)', color: colors.text }}
        />
        <Button variant="primary" onClick={handlePay} disabled={paying || !service} className="w-full">
          {paying ? 'Redirecting…' : 'Pay with Stripe'}
        </Button>
      </Card>
    </div>
  );
}
