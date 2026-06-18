import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { getSupabase, hasSupabase } from '@/lib/supabaseClient';
import { isEliteTier, resolveCoachPlanTier } from '@/config/plans';
import { getCoachClientJoinLinkPrimary } from '@/lib/referrals';
import { uploadAndSaveCoachBrandLogo } from '@/lib/profileAvatarUpload';
import Card from '@/ui/Card';
import Button from '@/ui/Button';
import { colors, spacing } from '@/ui/tokens';
import { toast } from 'sonner';
import Branding from '@/pages/Branding';

const ACCENT_PRESETS = ['#3B82F6', '#22C55E', '#EAB308', '#A855F7', '#F97316', '#EC4899'];

function normalizeHex(v) {
  const s = String(v || '').trim();
  if (!/^#[0-9A-Fa-f]{6}$/.test(s)) return '#3B82F6';
  return s;
}

export default function EliteBrandingPage() {
  const navigate = useNavigate();
  const { user, profile, updateProfile, isDemoMode } = useAuth();
  const coachId = isDemoMode ? 'demo-trainer' : user?.id ?? null;
  const tier = resolveCoachPlanTier(profile, user);
  const elite = isEliteTier(tier);
  const invite = (profile?.referral_code ?? '').toString().trim();

  const [brandName, setBrandName] = useState('');
  const [accent, setAccent] = useState('#3B82F6');
  const [headline, setHeadline] = useState('');
  const [message, setMessage] = useState('');
  const [bullets, setBullets] = useState(['', '', '']);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    setBrandName((profile?.brand_name ?? '').toString());
    setAccent(normalizeHex(profile?.brand_accent_colour));
    setHeadline((profile?.onboarding_headline ?? '').toString());
    setMessage((profile?.onboarding_message ?? '').toString());
    const raw = profile?.onboarding_bullets;
    const arr = Array.isArray(raw) ? raw.map((x) => String(x ?? '')) : [];
    setBullets([arr[0] || '', arr[1] || '', arr[2] || '']);
  }, [profile?.id, profile?.brand_name, profile?.brand_accent_colour, profile?.onboarding_headline, profile?.onboarding_message, profile?.onboarding_bullets]);

  const logoUrl = (profile?.brand_logo_url ?? '').toString().trim();

  const previewJoinUrl = useMemo(() => {
    if (!invite) return '';
    const origin = typeof window !== 'undefined' ? window.location.origin.replace(/\/$/, '') : '';
    const path = `/join/${encodeURIComponent(invite)}`;
    return origin ? `${origin}${path}` : path;
  }, [invite]);

  const saveFields = useCallback(async () => {
    if (!coachId || !hasSupabase) {
      toast.error('Sign in to save branding');
      return;
    }
    if (message.length > 280) {
      toast.error('Welcome message must be 280 characters or fewer');
      return;
    }
    setSaving(true);
    const bulletsOut = bullets.map((b) => b.trim()).filter(Boolean).slice(0, 3);
    const { error } = await updateProfile({
      brand_name: brandName.trim() || null,
      brand_accent_colour: normalizeHex(accent),
      onboarding_headline: headline.trim() || null,
      onboarding_message: message.trim() || null,
      onboarding_bullets: bulletsOut,
    });
    setSaving(false);
    if (error) {
      toast.error(error.message || 'Could not save');
      return;
    }
    toast.success('Branding saved');
  }, [coachId, brandName, accent, headline, message, bullets, updateProfile]);

  const onLogo = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    const sb = getSupabase();
    if (!sb || !coachId) return;
    setUploading(true);
    try {
      await uploadAndSaveCoachBrandLogo({ supabase: sb, userId: coachId, file });
      toast.success('Logo updated');
    } catch (err) {
      toast.error(err?.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const openPreview = () => {
    if (!previewJoinUrl) {
      toast.error('Set a referral code on your profile first');
      return;
    }
    window.open(previewJoinUrl, '_blank', 'noopener,noreferrer');
  };

  if (!elite) {
    return (
      <div
        className="app-screen min-w-0 max-w-full overflow-x-hidden"
        style={{
          paddingLeft: spacing[16],
          paddingRight: spacing[16],
          paddingBottom: `calc(${spacing[24]} + env(safe-area-inset-bottom, 0px))`,
        }}
      >
        <h1 className="text-lg font-semibold mb-2" style={{ color: colors.text }}>
          Client app branding
        </h1>
        <Card style={{ padding: spacing[16], marginBottom: spacing[16] }}>
          <p className="text-sm mb-3" style={{ color: colors.muted }}>
            White-label client app, custom join page, marketplace priority, and priority support are included on{' '}
            <strong style={{ color: colors.text }}>Elite</strong>. Upgrade in Plan &amp; Billing to unlock this page.
          </p>
          <Button type="button" variant="primary" onClick={() => navigate('/plan')}>
            View plans
          </Button>
        </Card>
        <p className="text-xs mb-2" style={{ color: colors.muted }}>
          PDF &amp; export branding (all plans)
        </p>
        <Branding />
      </div>
    );
  }

  return (
    <div
      className="app-screen min-w-0 max-w-full overflow-x-hidden"
      style={{
        paddingLeft: spacing[16],
        paddingRight: spacing[16],
        paddingBottom: `calc(${spacing[24]} + env(safe-area-inset-bottom, 0px))`,
      }}
    >
      <h1 className="text-lg font-semibold mb-1" style={{ color: colors.text }}>
        Elite — client branding
      </h1>
      <p className="text-sm mb-4" style={{ color: colors.muted }}>
        What your clients see in the app and on your invite link.
      </p>

      <Card style={{ padding: spacing[16], marginBottom: spacing[16] }}>
        <p className="text-xs font-semibold mb-2" style={{ color: colors.muted }}>Brand name</p>
        <p className="text-xs mb-2" style={{ color: colors.muted }}>
          What should clients see instead of &quot;Atlas Performance Labs&quot;?
        </p>
        <input
          type="text"
          value={brandName}
          onChange={(e) => setBrandName(e.target.value)}
          placeholder="Tom's Coaching"
          className="w-full rounded-xl px-3 py-3 text-sm mb-3 border-none"
          style={{ background: colors.surface1, color: colors.text, border: `1px solid ${colors.border}` }}
        />

        <p className="text-xs font-semibold mb-2" style={{ color: colors.muted }}>Logo</p>
        <div className="flex items-center gap-3 flex-wrap mb-3">
          {logoUrl ? (
            <img src={logoUrl} alt="" style={{ maxHeight: 48, maxWidth: 120, objectFit: 'contain' }} />
          ) : null}
          <label className="cursor-pointer">
            <input type="file" accept="image/*" className="hidden" onChange={onLogo} disabled={uploading} />
            <span className="text-sm font-medium" style={{ color: colors.accent }}>{uploading ? 'Uploading…' : logoUrl ? 'Change logo' : 'Upload logo'}</span>
          </label>
        </div>

        <p className="text-xs font-semibold mb-2" style={{ color: colors.muted }}>Accent colour</p>
        <div className="flex flex-wrap gap-2 mb-2">
          {ACCENT_PRESETS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setAccent(c)}
              className="w-9 h-9 rounded-full border-2"
              style={{ background: c, borderColor: accent === c ? colors.text : colors.border }}
              aria-label={`Accent ${c}`}
            />
          ))}
        </div>
        <input
          type="text"
          value={accent}
          onChange={(e) => setAccent(e.target.value)}
          placeholder="#3B82F6"
          className="w-full rounded-xl px-3 py-2 text-sm mb-3"
          style={{ background: colors.surface1, color: colors.text, border: `1px solid ${colors.border}` }}
        />

        <p className="text-xs font-semibold mb-2" style={{ color: colors.muted }}>Preview</p>
        <div
          className="rounded-xl p-3 mb-3"
          style={{ background: colors.bg, border: `1px solid ${colors.border}` }}
        >
          <div className="flex items-center gap-2 mb-2">
            {logoUrl ? <img src={logoUrl} alt="" style={{ width: 32, height: 32, borderRadius: 8, objectFit: 'cover' }} /> : null}
            <span className="text-sm font-bold" style={{ color: colors.text }}>{brandName.trim() || 'Your brand'}</span>
          </div>
          <div className="h-2 rounded-full" style={{ background: normalizeHex(accent), maxWidth: '100%' }} />
        </div>
      </Card>

      <Card style={{ padding: spacing[16], marginBottom: spacing[16] }}>
        <p className="text-xs font-semibold mb-2" style={{ color: colors.muted }}>Client onboarding page</p>
        <p className="text-xs mb-3" style={{ color: colors.muted }}>
          Shown at <code style={{ color: colors.text }}>/join/{invite || 'your-code'}</code> when headline is set.
        </p>
        <label className="text-xs font-semibold" style={{ color: colors.muted }}>Headline</label>
        <input
          type="text"
          value={headline}
          onChange={(e) => setHeadline(e.target.value)}
          placeholder="Ready to transform?"
          className="w-full rounded-xl px-3 py-3 text-sm mb-3 mt-1"
          style={{ background: colors.surface1, color: colors.text, border: `1px solid ${colors.border}` }}
        />
        <label className="text-xs font-semibold" style={{ color: colors.muted }}>Welcome message (max 280)</label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value.slice(0, 280))}
          rows={4}
          className="w-full rounded-xl px-3 py-3 text-sm mb-2 mt-1 resize-none"
          style={{ background: colors.surface1, color: colors.text, border: `1px solid ${colors.border}` }}
        />
        <p className="text-[11px] mb-3" style={{ color: colors.muted }}>{message.length}/280</p>
        {[0, 1, 2].map((i) => (
          <div key={i} className="mb-2">
            <label className="text-xs" style={{ color: colors.muted }}>Value bullet {i + 1}</label>
            <input
              type="text"
              value={bullets[i]}
              onChange={(e) => setBullets((prev) => prev.map((v, j) => (j === i ? e.target.value : v)))}
              className="w-full rounded-xl px-3 py-2 text-sm mt-1"
              style={{ background: colors.surface1, color: colors.text, border: `1px solid ${colors.border}` }}
            />
          </div>
        ))}
        <div className="flex gap-2 mt-3 flex-wrap">
          <Button type="button" variant="secondary" onClick={openPreview} disabled={!invite}>
            Preview join page
          </Button>
          <Button type="button" variant="primary" onClick={saveFields} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </Card>

      <p className="text-xs mb-2" style={{ color: colors.muted }}>Client signup link (standard flow)</p>
      <Card style={{ padding: spacing[12], marginBottom: spacing[16] }}>
        <p className="text-xs break-all" style={{ color: colors.text }}>
          {invite ? getCoachClientJoinLinkPrimary(invite, coachId) : 'Add a referral code to generate a link.'}
        </p>
      </Card>

      <p className="text-xs mb-2" style={{ color: colors.muted }}>PDF &amp; export branding</p>
      <Branding />
    </div>
  );
}
