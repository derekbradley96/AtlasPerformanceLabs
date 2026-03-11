import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { getTrainerProfile, setTrainerProfile } from '@/lib/trainerFoundation/trainerProfileRepo';
import { getCoachProfile, setCoachProfile } from '@/lib/data/coachProfileRepo';
import { X, Plus, Trash2, Image as ImageIcon, Zap } from 'lucide-react';
import Card from '@/ui/Card';
import Button from '@/ui/Button';
import { colors, spacing } from '@/ui/tokens';
import { toast } from 'sonner';
import { impactLight } from '@/lib/haptics';
import { PLANS, CURRENCY } from '@/config/plans';

const BIO_MAX = 800;
const RESPONSE_TIME_OPTIONS = [
  { value: '', label: 'Select…' },
  { value: 'within_4_hours', label: 'Within 4 hours' },
  { value: 'within_12_hours', label: 'Within 12 hours' },
  { value: 'within_24_hours', label: 'Within 24 hours' },
  { value: 'within_48_hours', label: 'Within 48 hours' },
];

const SPECIALTY_PRESETS = ['Strength', 'Hypertrophy', 'Fat loss', 'Competition prep', 'Nutrition', 'Mobility', 'Beginner-friendly', 'Online coaching'];

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

function generateId() {
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function getCurrentPlanIdFromStorage() {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem('atlas_trainer_plan') : null;
    return raw || 'pro';
  } catch {
    return 'pro';
  }
}

export default function TrainerProfileSettings() {
  const navigate = useNavigate();
  const { user, isDemoMode } = useAuth();
  const trainerId = isDemoMode ? 'demo-trainer' : user?.id ?? null;
  const fileInputRef = useRef(null);
  const bannerInputRef = useRef(null);

  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState({
    profileImage: '',
    bannerImage: '',
    displayName: '',
    username: '',
    bio: '',
    specialties: [],
    yearsCoaching: '',
    credentials: '',
    timezone: 'UTC',
    workingHours: '',
    responseTime: '',
    trainerPortfolio: [],
    services: [],
    uspBullets: ['', '', ''],
    instagram: '',
    website: '',
  });
  const [specialtyInput, setSpecialtyInput] = useState('');
  const [portfolioModalIndex, setPortfolioModalIndex] = useState(null);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (!trainerId) return;
    const p = getTrainerProfile(trainerId);
    const coach = getCoachProfile(trainerId);
    const branding = coach?.branding ?? {};
    const uspBullets = Array.isArray(branding.uspBullets) ? [...branding.uspBullets] : ['', '', ''];
    while (uspBullets.length < 3) uspBullets.push('');
    setProfile(p);
    setForm({
      profileImage: p?.profileImage ?? '',
      bannerImage: p?.bannerImage ?? '',
      displayName: p?.displayName ?? '',
      username: p?.username ?? '',
      bio: p?.bio ?? '',
      specialties: p?.specialties ?? [],
      yearsCoaching: p?.yearsCoaching != null ? String(p.yearsCoaching) : '',
      credentials: p?.credentials ?? '',
      timezone: p?.timezone ?? 'UTC',
      workingHours: p?.workingHours ?? '',
      responseTime: p?.responseTime ?? '',
      trainerPortfolio: p?.trainerPortfolio ?? [],
      services: p?.services ?? [],
      uspBullets: uspBullets.slice(0, 3),
      instagram: branding.instagram ?? '',
      website: branding.website ?? '',
    });
  }, [trainerId]);

  const update = useCallback((patch) => {
    setForm((prev) => ({ ...prev, ...patch }));
    setHasChanges(true);
  }, []);

  const addSpecialty = useCallback(() => {
    const v = specialtyInput.trim();
    if (v && !form.specialties.includes(v)) {
      update({ specialties: [...form.specialties, v] });
      setSpecialtyInput('');
    }
  }, [form.specialties, specialtyInput, update]);

  const removeSpecialty = useCallback(
    (idx) => {
      update({ specialties: form.specialties.filter((_, i) => i !== idx) });
    },
    [form.specialties, update]
  );

  const handleProfileImage = useCallback(
    async (e) => {
      const file = e.target?.files?.[0];
      if (!file) return;
      try {
        const url = await readFileAsDataUrl(file);
        update({ profileImage: url });
        impactLight();
      } catch (err) {
        toast.error('Could not load image');
      }
      e.target.value = '';
    },
    [update]
  );

  const handleBannerImage = useCallback(
    async (e) => {
      const file = e.target?.files?.[0];
      if (!file) return;
      try {
        const url = await readFileAsDataUrl(file);
        update({ bannerImage: url });
        impactLight();
      } catch (err) {
        toast.error('Could not load image');
      }
      e.target.value = '';
    },
    [update]
  );

  const addPortfolioItem = useCallback(
    (e) => {
      const file = e.target?.files?.[0];
      if (!file) return;
      readFileAsDataUrl(file).then((url) => {
        const item = { id: generateId(), url, category: 'general', caption: '' };
        update({ trainerPortfolio: [...form.trainerPortfolio, item] });
        impactLight();
      }).catch(() => toast.error('Could not load image'));
      e.target.value = '';
    },
    [form.trainerPortfolio, update]
  );

  const removePortfolioItem = useCallback(
    (id) => {
      update({ trainerPortfolio: form.trainerPortfolio.filter((i) => i.id !== id) });
      setPortfolioModalIndex(null);
    },
    [form.trainerPortfolio, update]
  );

  const updatePortfolioItem = useCallback(
    (id, patch) => {
      update({
        trainerPortfolio: form.trainerPortfolio.map((i) => (i.id === id ? { ...i, ...patch } : i)),
      });
    },
    [form.trainerPortfolio, update]
  );

  const movePortfolioItem = useCallback(
    (index, dir) => {
      const list = [...form.trainerPortfolio];
      const next = index + dir;
      if (next < 0 || next >= list.length) return;
      [list[index], list[next]] = [list[next], list[index]];
      update({ trainerPortfolio: list });
    },
    [form.trainerPortfolio, update]
  );

  const addService = useCallback(() => {
    update({
      services: [
        ...form.services,
        {
          id: generateId(),
          name: '',
          description: '',
          price: undefined,
          includesCheckins: true,
          includesCalls: false,
          includesPosing: false,
          includesPeakWeek: false,
        },
      ],
    });
    impactLight();
  }, [form.services, update]);

  const updateService = useCallback(
    (id, patch) => {
      update({
        services: form.services.map((s) => (s.id === id ? { ...s, ...patch } : s)),
      });
    },
    [form.services, update]
  );

  const removeService = useCallback(
    (id) => {
      update({ services: form.services.filter((s) => s.id !== id) });
    },
    [form.services, update]
  );

  const handleSave = useCallback(() => {
    if (!trainerId) return;
    setSaving(true);
    try {
      setTrainerProfile(trainerId, {
        profileImage: form.profileImage || undefined,
        bannerImage: form.bannerImage || undefined,
        displayName: form.displayName || undefined,
        username: form.username || undefined,
        bio: form.bio?.slice(0, BIO_MAX) || undefined,
        specialties: form.specialties.length ? form.specialties : undefined,
        yearsCoaching: form.yearsCoaching === '' ? undefined : (parseInt(form.yearsCoaching, 10) || undefined),
        credentials: form.credentials || undefined,
        timezone: form.timezone || undefined,
        workingHours: form.workingHours || undefined,
        responseTime: form.responseTime || undefined,
        trainerPortfolio: form.trainerPortfolio.length ? form.trainerPortfolio : undefined,
        services: form.services.length ? form.services : undefined,
      });
      const existingBranding = getCoachProfile(trainerId)?.branding ?? {};
      setCoachProfile(trainerId, {
        branding: {
          ...existingBranding,
          uspBullets: form.uspBullets.filter((s) => s.trim()),
          instagram: (form.instagram || '').trim() || undefined,
          website: (form.website || '').trim() || undefined,
        },
      });
      setHasChanges(false);
      toast.success('Profile saved');
      impactLight();
    } catch (e) {
      toast.error('Failed to save');
    } finally {
      setSaving(false);
    }
  }, [trainerId, form]);

  if (!trainerId) return null;

  const openModal = portfolioModalIndex !== null ? form.trainerPortfolio[portfolioModalIndex] : null;
  const planId = getCurrentPlanIdFromStorage();
  const currentPlan = PLANS.find((p) => p.id === planId) || PLANS[1];

  return (
    <div
      className="app-screen min-w-0 max-w-full overflow-x-hidden bg-[#0B1220] animate-in fade-in slide-in-from-right-4 duration-200"
      style={{
        paddingBottom: `calc(72px + env(safe-area-inset-bottom) + 24px)`,
        paddingLeft: spacing[16],
        paddingRight: spacing[16],
        paddingTop: spacing[8],
      }}
    >
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Plan card */}
        <Card style={{ padding: spacing[20] }}>
          <h2 className="text-lg font-semibold mb-3" style={{ color: colors.text }}>Plan & Billing</h2>
          <p className="text-sm font-medium mb-1" style={{ color: colors.muted }}>Current plan</p>
          <p className="text-[17px] font-semibold mb-1" style={{ color: colors.text }}>{currentPlan.name}</p>
          <p className="text-sm mb-4" style={{ color: colors.muted }}>
            {currentPlan.price === 0 ? `${CURRENCY}0` : `${CURRENCY}${currentPlan.price}`}/month
            {currentPlan.commission != null && ` · ${currentPlan.commission} commission`}
          </p>
          <Button
            variant="primary"
            onClick={() => { impactLight(); navigate('/plan'); }}
            className="w-full gap-2"
          >
            <Zap size={18} />
            Upgrade & manage billing
          </Button>
        </Card>

        {/* Public Profile */}
        <Card style={{ padding: spacing[20] }}>
          <h2 className="text-lg font-semibold mb-4" style={{ color: colors.text }}>Public Profile</h2>
          <div className="space-y-4">
            <div className="flex gap-4 items-start">
              <input type="file" accept="image/*" ref={fileInputRef} className="hidden" onChange={handleProfileImage} />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-24 h-24 rounded-xl overflow-hidden flex-shrink-0 border-2 border-dashed flex items-center justify-center"
                style={{ borderColor: colors.border, background: 'rgba(255,255,255,0.04)' }}
              >
                {form.profileImage ? (
                  <img src={form.profileImage} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <ImageIcon size={32} style={{ color: colors.muted }} />
                )}
              </button>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium mb-1" style={{ color: colors.muted }}>Profile photo (square)</p>
                <Button variant="secondary" onClick={() => fileInputRef.current?.click()}>Upload</Button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: colors.muted }}>Banner image (optional)</label>
              <input type="file" accept="image/*" ref={bannerInputRef} className="hidden" onChange={handleBannerImage} />
              <button
                type="button"
                onClick={() => bannerInputRef.current?.click()}
                className="w-full h-24 rounded-xl border-2 border-dashed flex items-center justify-center"
                style={{ borderColor: colors.border, background: 'rgba(255,255,255,0.04)' }}
              >
                {form.bannerImage ? (
                  <img src={form.bannerImage} alt="Banner" className="w-full h-full object-cover rounded-xl" />
                ) : (
                  <span style={{ color: colors.muted }}>Add banner</span>
                )}
              </button>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: colors.muted }}>Display name</label>
              <input
                type="text"
                value={form.displayName}
                onChange={(e) => update({ displayName: e.target.value })}
                placeholder="How clients see you"
                className="w-full rounded-lg border px-3 py-2 text-[15px]"
                style={{ borderColor: colors.border, background: colors.card, color: colors.text }}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: colors.muted }}>Username (unique)</label>
              <input
                type="text"
                value={form.username}
                onChange={(e) => update({ username: e.target.value })}
                placeholder="e.g. coach_jane"
                className="w-full rounded-lg border px-3 py-2 text-[15px]"
                style={{ borderColor: colors.border, background: colors.card, color: colors.text }}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: colors.muted }}>Bio (max {BIO_MAX} chars)</label>
              <textarea
                value={form.bio}
                onChange={(e) => update({ bio: e.target.value.slice(0, BIO_MAX) })}
                placeholder="Tell clients about yourself"
                rows={4}
                className="w-full rounded-lg border px-3 py-2 text-[15px]"
                style={{ borderColor: colors.border, background: colors.card, color: colors.text }}
              />
              <p className="text-xs mt-1" style={{ color: colors.muted }}>{form.bio.length}/{BIO_MAX}</p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: colors.muted }}>Specialties</label>
              <div className="flex flex-wrap gap-2 mb-2">
                {SPECIALTY_PRESETS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => {
                      if (form.specialties.includes(s)) update({ specialties: form.specialties.filter((x) => x !== s) });
                      else update({ specialties: [...form.specialties, s] });
                    }}
                    className="rounded-full px-3 py-1.5 text-sm border"
                    style={{
                      borderColor: form.specialties.includes(s) ? colors.accent : colors.border,
                      background: form.specialties.includes(s) ? 'rgba(37,99,235,0.2)' : 'transparent',
                      color: form.specialties.includes(s) ? '#93C5FD' : colors.muted,
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={specialtyInput}
                  onChange={(e) => setSpecialtyInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addSpecialty())}
                  placeholder="Or add custom"
                  className="flex-1 rounded-lg border px-3 py-2 text-sm"
                  style={{ borderColor: colors.border, background: colors.card, color: colors.text }}
                />
                <Button variant="secondary" onClick={addSpecialty}>Add</Button>
              </div>
              {form.specialties.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {form.specialties.map((s, i) => (
                    <span key={s} className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-sm bg-blue-500/20 text-blue-300">
                      {s}
                      <button type="button" onClick={() => removeSpecialty(i)} aria-label="Remove"><X size={14} /></button>
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: colors.muted }}>Years coaching</label>
              <input
                type="number"
                min={0}
                value={form.yearsCoaching}
                onChange={(e) => update({ yearsCoaching: e.target.value })}
                placeholder="e.g. 5"
                className="w-full rounded-lg border px-3 py-2 text-[15px]"
                style={{ borderColor: colors.border, background: colors.card, color: colors.text }}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: colors.muted }}>Credentials</label>
              <input
                type="text"
                value={form.credentials}
                onChange={(e) => update({ credentials: e.target.value })}
                placeholder="e.g. NASM CPT, CSCS"
                className="w-full rounded-lg border px-3 py-2 text-[15px]"
                style={{ borderColor: colors.border, background: colors.card, color: colors.text }}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: colors.muted }}>Timezone</label>
              <input
                type="text"
                readOnly
                value={form.timezone}
                placeholder="e.g. America/New_York"
                className="w-full rounded-lg border px-3 py-2 text-[15px]"
                style={{ borderColor: colors.border, background: 'rgba(255,255,255,0.04)', color: colors.text }}
              />
              <p className="text-xs mt-1" style={{ color: colors.muted }}>Edit in Setup</p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: colors.muted }}>Working hours</label>
              <input
                type="text"
                readOnly
                value={form.workingHours || '—'}
                placeholder="e.g. Mon–Fri 9–5"
                className="w-full rounded-lg border px-3 py-2 text-[15px]"
                style={{ borderColor: colors.border, background: 'rgba(255,255,255,0.04)', color: colors.text }}
              />
              <p className="text-xs mt-1" style={{ color: colors.muted }}>Edit in Setup</p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: colors.muted }}>Response time</label>
              <select
                value={form.responseTime}
                onChange={(e) => update({ responseTime: e.target.value })}
                className="w-full rounded-lg border px-3 py-2 text-[15px]"
                style={{ borderColor: colors.border, background: colors.card, color: colors.text }}
              >
                {RESPONSE_TIME_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: colors.muted }}>USPs / key selling points (max 3)</label>
              {[0, 1, 2].map((i) => (
                <input
                  key={i}
                  type="text"
                  value={form.uspBullets[i] ?? ''}
                  onChange={(e) => update({ uspBullets: form.uspBullets.map((v, j) => (j === i ? e.target.value : v)) })}
                  placeholder={`USP ${i + 1}`}
                  className="w-full rounded-lg border px-3 py-2 text-[15px] mb-2"
                  style={{ borderColor: colors.border, background: colors.card, color: colors.text }}
                />
              ))}
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: colors.muted }}>Instagram</label>
              <input
                type="text"
                value={form.instagram}
                onChange={(e) => update({ instagram: e.target.value })}
                placeholder="@handle"
                className="w-full rounded-lg border px-3 py-2 text-[15px]"
                style={{ borderColor: colors.border, background: colors.card, color: colors.text }}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: colors.muted }}>Website</label>
              <input
                type="text"
                value={form.website}
                onChange={(e) => update({ website: e.target.value })}
                placeholder="https://..."
                className="w-full rounded-lg border px-3 py-2 text-[15px]"
                style={{ borderColor: colors.border, background: colors.card, color: colors.text }}
              />
            </div>
          </div>
        </Card>

        {/* Portfolio */}
        <Card style={{ padding: spacing[20] }}>
          <h2 className="text-lg font-semibold mb-4" style={{ color: colors.text }}>Portfolio</h2>
          <div className="grid grid-cols-3 gap-3">
            {form.trainerPortfolio.map((item, index) => (
              <div key={item.id} className="relative group aspect-square rounded-xl overflow-hidden border" style={{ borderColor: colors.border }}>
                <button
                  type="button"
                  onClick={() => { setPortfolioModalIndex(index); impactLight(); }}
                  className="absolute inset-0"
                >
                  <img src={item.url} alt={item.caption || 'Portfolio'} className="w-full h-full object-cover" />
                </button>
                <div className="absolute bottom-0 left-0 right-0 p-2 bg-black/60 text-white text-xs truncate">{item.caption || item.category}</div>
                <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button type="button" onClick={(e) => { e.stopPropagation(); movePortfolioItem(index, -1); }} disabled={index === 0} className="p-1 rounded bg-black/60" aria-label="Move left">←</button>
                  <button type="button" onClick={(e) => { e.stopPropagation(); movePortfolioItem(index, 1); }} disabled={index === form.trainerPortfolio.length - 1} className="p-1 rounded bg-black/60" aria-label="Move right">→</button>
                  <button type="button" onClick={(e) => { e.stopPropagation(); removePortfolioItem(item.id); }} className="p-1 rounded bg-red-500/80" aria-label="Delete"><Trash2 size={14} /></button>
                </div>
              </div>
            ))}
            <label className="aspect-square rounded-xl border-2 border-dashed flex items-center justify-center cursor-pointer" style={{ borderColor: colors.border }}>
              <input type="file" accept="image/*" className="hidden" onChange={addPortfolioItem} />
              <Plus size={28} style={{ color: colors.muted }} />
            </label>
          </div>
        </Card>

        {/* Services */}
        <Card style={{ padding: spacing[20] }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold" style={{ color: colors.text }}>Services</h2>
            <Button variant="secondary" onClick={addService} className="gap-1"><Plus size={16} /> Add</Button>
          </div>
          {form.services.length > 0 && (
            <div className="mb-4">
              <p className="text-xs font-medium mb-2" style={{ color: colors.muted }}>Preview (as on public profile)</p>
              <div className="space-y-3">
                {form.services.map((s) => (
                  <div key={`preview-${s.id}`} className="p-4 rounded-xl border" style={{ borderColor: colors.border, background: 'rgba(255,255,255,0.03)' }}>
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <p className="font-medium" style={{ color: colors.text }}>{s.name}</p>
                        {s.description && <p className="text-sm mt-1" style={{ color: colors.muted }}>{s.description}</p>}
                        <div className="flex flex-wrap gap-2 mt-2 text-xs" style={{ color: colors.muted }}>
                          {s.includesCheckins && <span>Check-ins</span>}
                          {s.includesCalls && <span>Calls</span>}
                          {s.includesPosing && <span>Posing</span>}
                          {s.includesPeakWeek && <span>Peak week</span>}
                        </div>
                      </div>
                      <span className="font-semibold whitespace-nowrap" style={{ color: colors.accent }}>
                        {s.price != null ? `£${(s.price / 100).toFixed(0)}/mo` : '—'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="space-y-4">
            {form.services.map((s) => (
              <div key={s.id} className="p-4 rounded-xl border space-y-3" style={{ borderColor: colors.border, background: 'rgba(255,255,255,0.03)' }}>
                <div className="flex justify-between gap-2">
                  <input
                    type="text"
                    value={s.name}
                    onChange={(e) => updateService(s.id, { name: e.target.value })}
                    placeholder="Service name"
                    className="flex-1 rounded-lg border px-3 py-2 text-sm"
                    style={{ borderColor: colors.border, background: colors.card, color: colors.text }}
                  />
                  <button type="button" onClick={() => removeService(s.id)} className="p-2 text-red-400" aria-label="Remove service"><Trash2 size={18} /></button>
                </div>
                <input
                  type="text"
                  value={s.description ?? ''}
                  onChange={(e) => updateService(s.id, { description: e.target.value })}
                  placeholder="Description"
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                  style={{ borderColor: colors.border, background: colors.card, color: colors.text }}
                />
                <input
                  type="text"
                  inputMode="decimal"
                  value={s.price != null ? (s.price / 100).toFixed(2) : ''}
                  onChange={(e) => {
                    const v = e.target.value.replace(/[^0-9.]/g, '');
                    const n = v === '' ? undefined : Math.round(parseFloat(v) * 100);
                    updateService(s.id, { price: n });
                  }}
                  placeholder="Price (e.g. 99.00)"
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                  style={{ borderColor: colors.border, background: colors.card, color: colors.text }}
                />
                <div className="flex flex-wrap gap-4 text-sm">
                  {['includesCheckins', 'includesCalls', 'includesPosing', 'includesPeakWeek'].map((key) => (
                    <label key={key} className="flex items-center gap-2" style={{ color: colors.muted }}>
                      <input
                        type="checkbox"
                        checked={!!s[key]}
                        onChange={(e) => updateService(s.id, { [key]: e.target.checked })}
                      />
                      {key.replace('includes', '').replace(/([A-Z])/g, ' $1').trim()}
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Sticky save bar */}
      <div
        className="fixed left-0 right-0 z-40 flex gap-3 items-center px-4 border-t"
        style={{
          bottom: 0,
          minHeight: 72,
          paddingBottom: 'max(12px, env(safe-area-inset-bottom))',
          paddingTop: 12,
          background: 'rgba(11, 18, 32, 0.92)',
          borderColor: colors.border,
          backdropFilter: 'blur(18px)',
        }}
      >
        <Button variant="secondary" onClick={() => navigate(-1)} style={{ flex: 1 }}>Cancel</Button>
        <Button onClick={handleSave} disabled={saving || !hasChanges} style={{ flex: 1 }}>{saving ? 'Saving…' : 'Save'}</Button>
      </div>

      {/* Portfolio fullscreen modal */}
      {openModal && (
        <div
          className="fixed inset-0 z-50 flex flex-col bg-[#0B1220] animate-in fade-in duration-200"
          style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: colors.border }}>
            <button type="button" onClick={() => setPortfolioModalIndex(null)} className="p-2" style={{ color: colors.text }}>Close</button>
            <input
              type="text"
              value={openModal.caption ?? ''}
              onChange={(e) => updatePortfolioItem(openModal.id, { caption: e.target.value })}
              placeholder="Caption"
              className="flex-1 mx-4 rounded-lg border px-3 py-2 text-sm"
              style={{ borderColor: colors.border, background: colors.card, color: colors.text }}
            />
            <button type="button" onClick={() => removePortfolioItem(openModal.id)} className="p-2 text-red-400"><Trash2 size={20} /></button>
          </div>
          <div className="flex-1 flex items-center justify-center p-4 min-h-0">
            <img src={openModal.url} alt={openModal.caption} className="max-w-full max-h-full object-contain" />
          </div>
        </div>
      )}
    </div>
  );
}
