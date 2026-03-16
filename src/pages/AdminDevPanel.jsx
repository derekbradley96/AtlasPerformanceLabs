import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { ChevronLeft, User, Users, Dumbbell, Shield, RotateCcw, LogOut, Zap, UserPlus, Copy, Mail, Trash2, ListChecks } from 'lucide-react';
import { useAuth, ADMIN_EMAIL } from '@/lib/AuthContext';
import { APP_MODE, SUPABASE_ENABLED } from '@/lib/config';
import { stripeServiceUpsert, MOCK_SERVICES } from '@/lib/supabaseStripeApi';
import { createManualClientStub, getStubClients, resetStubClients, seedRealisticStubClients, seedTestClients } from '@/lib/clientStubStore';
import { resetSandbox, addClient } from '@/lib/sandboxStore';
import { colors } from '@/ui/tokens';
const BG = colors.bg;
const CARD = colors.surface1;
const TEXT = colors.text;
const MUTED = 'rgba(229,231,235,0.65)';
const SEPARATOR = 'rgba(255,255,255,0.06)';
const ACCENT = colors.primary;
const isDev = import.meta.env.DEV;

/** Keys cleared by Reset App State (demo/auth/seed/plan). */
const RESET_KEYS = [
  'atlas_demo_mode',
  'APL_DEMO_MODE',
  'atlas_demo_dataset_v1',
  'atlas_role',
  'atlas_solo',
  'atlas_fake_session',
  'atlas_seed_clients_v1',
  'atlas_seed_checkins_v1',
  'atlas_client_stubs',
  'atlas_trainer_plan',
];
/** Clear any other atlas_* or APL_* keys for a full reset. */
function clearAllAtlasKeys() {
  if (typeof window === 'undefined' || !window.localStorage) return;
  const toRemove = [];
  for (let i = 0; i < window.localStorage.length; i++) {
    const k = window.localStorage.key(i);
    if (k && (k.startsWith('atlas_') || k.startsWith('APL_'))) toRemove.push(k);
  }
  toRemove.forEach((k) => window.localStorage.removeItem(k));
  RESET_KEYS.forEach((k) => window.localStorage.removeItem(k));
}

async function lightHaptic() {
  try {
    if (Capacitor.isNativePlatform()) await Haptics.impact({ style: ImpactStyle.Light });
    else if (navigator.vibrate) navigator.vibrate(10);
  } catch (e) {}
}

function RoleRow({ icon, title, onPress, isLast }) {
  return (
    <button
      type="button"
      onClick={onPress}
      className="w-full text-left"
      style={{
        height: 64,
        minHeight: 64,
        borderRadius: 0,
        padding: '0 16px',
        background: CARD,
        border: 'none',
        borderBottom: isLast ? 'none' : `1px solid ${SEPARATOR}`,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: 12,
          background: '#111C33',
          display: 'grid',
          placeItems: 'center',
          flex: '0 0 auto',
        }}
      >
        {icon}
      </div>
      <span style={{ flex: 1, color: TEXT, fontWeight: 600, fontSize: 16 }}>{title}</span>
    </button>
  );
}

const hasSupabase = SUPABASE_ENABLED;

export default function AdminDevPanel() {
  const navigate = useNavigate();
  const { enterAdmin, clearSession, user, exitDemo, setFakeSession, role } = useAuth();
  const userId = user?.id ?? 'local-trainer';
  const sandboxTrainer = user?.id === 'fake-trainer';
  const hasFakeSession = !!user && (user.id === 'fake-trainer' || user.id === 'fake-client' || user.id === 'fake-solo');
  const [seedLoading, setSeedLoading] = useState(false);
  const [testClientsLoading, setTestClientsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [sandboxEmail, setSandboxEmail] = useState(user?.email || 'dev@atlas.local');
  const [stubFullName, setStubFullName] = useState('');
  const [stubEmail, setStubEmail] = useState('');
  const [stubPhase, setStubPhase] = useState('Maintenance');
  const [stubStatus, setStubStatus] = useState('on_track');
  const [stubKey, setStubKey] = useState(0);

  const isAdminAccount = user?.email === ADMIN_EMAIL;
  if (!isDev && !isAdminAccount) {
    navigate('/', { replace: true });
    return null;
  }

  const handleRole = async (roleKey) => {
    await lightHaptic();
    enterAdmin(roleKey);
    if (roleKey === 'trainer') navigate('/home', { replace: true });
    if (roleKey === 'client') navigate('/client-dashboard', { replace: true });
    if (roleKey === 'solo') navigate('/solo-dashboard', { replace: true });
  };

  const handleBack = async () => {
    await lightHaptic();
    navigate('/', { replace: true });
  };

  const handleResetAppState = async () => {
    await lightHaptic();
    clearAllAtlasKeys();
    window.location.href = '/';
  };

  const handleAddTestClients = async () => {
    await lightHaptic();
    const tid = userId || 'local-trainer';
    setTestClientsLoading(true);
    try {
      const names = ['Test Alpha', 'Test Beta', 'Test Gamma'];
      names.forEach((full_name) => addClient(tid, { full_name, goal: 'maintain', phase: 'Maintenance' }));
      if (typeof window !== 'undefined') window.dispatchEvent(new Event('atlas-sandbox-updated'));
      if (typeof window !== 'undefined' && window.alert) window.alert(`Added ${names.length} test clients. Open Clients list to see them.`);
      navigate('/home', { replace: true });
    } catch (e) {
      if (typeof window !== 'undefined' && window.alert) window.alert('Failed: ' + (e?.message ?? e));
    } finally {
      setTestClientsLoading(false);
    }
  };

  const envSnippet = `VITE_APP_MODE=real
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key`;
  const handleCopyEnv = async () => {
    await lightHaptic();
    try {
      await navigator.clipboard.writeText(envSnippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      if (typeof window !== 'undefined' && window.alert) window.alert('Copy failed: ' + (e?.message ?? e));
    }
  };

  const handleExitDemo = async () => {
    await lightHaptic();
    exitDemo(() => navigate('/', { replace: true }));
  };

  const handleReseedDemoData = async () => {
    await lightHaptic();
    resetSandbox();
    if (typeof window !== 'undefined') window.dispatchEvent(new Event('atlas-sandbox-updated'));
    navigate('/home', { replace: true });
  };

  const handleStartSandboxTrainer = async () => {
    await lightHaptic();
    const email = (sandboxEmail || '').trim() || 'dev@atlas.local';
    setFakeSession('coach', email);
    navigate('/home', { replace: true });
  };

  const handleSwitchSandboxRole = async (newRole) => {
    await lightHaptic();
    const email = (user?.email || sandboxEmail || '').trim() || 'dev@atlas.local';
    setFakeSession(newRole, email);
    if (newRole === 'coach') navigate('/home', { replace: true });
    else if (newRole === 'client') navigate('/messages', { replace: true });
    else navigate('/home', { replace: true });
  };

  const handleCreateStubClient = async () => {
    await lightHaptic();
    const trainerId = sandboxTrainer ? 'fake-trainer' : userId;
    if (!trainerId) return;
    createManualClientStub({
      trainerId,
      fullName: stubFullName.trim() || 'New client',
      email: stubEmail.trim() || 'client@example.com',
      phase: stubPhase,
      status: stubStatus,
    });
    setStubFullName('');
    setStubEmail('');
    setStubKey((k) => k + 1);
    if (sandboxTrainer) navigate('/clients', { replace: true });
  };

  const handleSeedTestClients = async () => {
    await lightHaptic();
    const trainerId = sandboxTrainer ? 'fake-trainer' : userId;
    if (!trainerId) return;
    const count = seedTestClients(trainerId);
    setStubKey((k) => k + 1);
    navigate('/clients', { replace: true });
  };

  const handleSeedRealisticClients = async () => {
    await lightHaptic();
    const trainerId = sandboxTrainer ? 'fake-trainer' : userId;
    if (!trainerId) return;
    const count = seedRealisticStubClients(trainerId);
    setStubKey((k) => k + 1);
    if (typeof window !== 'undefined' && window.alert) window.alert(`Added ${count} realistic clients. Open Clients list to see them.`);
    if (sandboxTrainer) navigate('/clients', { replace: true });
  };

  const handleResetSandboxData = async () => {
    await lightHaptic();
    resetStubClients();
    setStubKey((k) => k + 1);
    if (typeof window !== 'undefined' && window.alert) window.alert('Sandbox data cleared.');
  };

  const handleClearSession = async () => {
    await lightHaptic();
    clearSession();
  };

  const handleSeedServices = async () => {
    await lightHaptic();
    if (!hasSupabase || !userId) return;
    setSeedLoading(true);
    try {
      for (const s of MOCK_SERVICES) {
        await stripeServiceUpsert({ user_id: userId, name: s.name, description: s.description ?? '', price_amount: s.price_amount, currency: s.currency ?? 'gbp', interval: s.interval ?? 'month', active: s.active !== false });
      }
      if (typeof window !== 'undefined' && window.alert) window.alert('Mock services seeded. Check Services or Public link.');
    } catch (e) {
      if (typeof window !== 'undefined' && window.alert) window.alert('Seed failed: ' + (e?.message ?? e));
    } finally {
      setSeedLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: BG,
        color: TEXT,
        paddingTop: 'max(24px, env(safe-area-inset-top, 0))',
        paddingBottom: 'max(24px, env(safe-area-inset-bottom, 0))',
        paddingLeft: 'max(20px, env(safe-area-inset-left, 0))',
        paddingRight: 'max(20px, env(safe-area-inset-right, 0))',
      }}
    >
      <div style={{ maxWidth: 420, margin: '0 auto' }}>
        <button
          type="button"
          onClick={handleBack}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            minHeight: 44,
            padding: '8px 0',
            background: 'none',
            border: 'none',
            color: MUTED,
            fontSize: 15,
          }}
        >
          <ChevronLeft size={20} /> Back
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 24, marginBottom: 8 }}>
          <Shield size={20} color={ACCENT} />
          <span style={{ fontSize: 15, color: MUTED }}>Admin (DEV only)</span>
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 20 }}>Instant dashboard access</h1>

        <div style={{ overflow: 'hidden', borderRadius: 14, background: CARD, marginBottom: 24 }}>
          <RoleRow
            title="Enter as Trainer"
            icon={<Dumbbell size={20} color={ACCENT} />}
            onPress={() => handleRole('trainer')}
            isLast={false}
          />
          <RoleRow
            title="Enter as Client"
            icon={<Users size={20} color={ACCENT} />}
            onPress={() => handleRole('client')}
            isLast={false}
          />
          <RoleRow
            title="Enter as Personal"
            icon={<User size={20} color={ACCENT} />}
            onPress={() => handleRole('solo')}
            isLast={false}
          />
        </div>

        <h2 style={{ fontSize: 17, fontWeight: 600, marginBottom: 12, color: TEXT }}>Session & data</h2>
        <div style={{ overflow: 'hidden', borderRadius: 14, background: CARD }}>
          <RoleRow
            title="Navigation Audit"
            icon={<ListChecks size={20} color={ACCENT} />}
            onPress={() => navigate('/navigation-audit', { replace: true })}
            isLast={false}
          />
          <RoleRow
            title="Reset App State"
            icon={<RotateCcw size={20} color={ACCENT} />}
            onPress={handleResetAppState}
            isLast={false}
          />
          <RoleRow
            title="Clear session"
            icon={<LogOut size={20} color={ACCENT} />}
            onPress={handleClearSession}
            isLast={!hasSupabase}
          />
          <RoleRow
            title={testClientsLoading ? 'Adding…' : 'Add Test Clients'}
            icon={<UserPlus size={20} color={ACCENT} />}
            onPress={handleAddTestClients}
            isLast={!hasSupabase}
          />
          {hasSupabase && (
            <RoleRow
              title={seedLoading ? 'Seeding…' : 'Seed mock services (Stripe)'}
              icon={<Zap size={20} color={ACCENT} />}
              onPress={handleSeedServices}
              isLast
            />
          )}
        </div>

        {isDev && (
          <>
            <h2 style={{ fontSize: 17, fontWeight: 600, marginBottom: 12, marginTop: 28, color: TEXT }}>Sandbox Mode (DEV)</h2>
            <p style={{ fontSize: 13, color: MUTED, marginBottom: 12 }}>
              Use a fake session to test as a trainer without Demo Mode. Clients you create appear in the Trainer Clients list.
            </p>
            <div style={{ overflow: 'hidden', borderRadius: 14, background: CARD, marginBottom: 24 }}>
              <RoleRow
                title="Reseed Sandbox"
                icon={<RotateCcw size={20} color={ACCENT} />}
                onPress={handleReseedDemoData}
                isLast={false}
              />
              <RoleRow
                title="Clear all sessions"
                icon={<Trash2 size={20} color={ACCENT} />}
                onPress={handleClearSession}
                isLast={!hasFakeSession}
              />
              {!hasFakeSession && (
                <>
                  <div style={{ padding: '12px 16px', borderBottom: `1px solid ${SEPARATOR}`, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Mail size={18} color={MUTED} />
                    <input
                      type="email"
                      placeholder="Email for fake trainer"
                      value={sandboxEmail}
                      onChange={(e) => setSandboxEmail(e.target.value)}
                      style={{
                        flex: 1,
                        background: '#111C33',
                        border: 'none',
                        borderRadius: 8,
                        padding: '10px 12px',
                        color: TEXT,
                        fontSize: 14,
                      }}
                    />
                  </div>
                  <RoleRow
                    title="Start as Trainer (sandbox)"
                    icon={<Dumbbell size={20} color={ACCENT} />}
                    onPress={handleStartSandboxTrainer}
                    isLast
                  />
                </>
              )}
              {hasFakeSession && (
                <>
                  <RoleRow
                    title="Switch to Trainer"
                    icon={<Dumbbell size={20} color={ACCENT} />}
                    onPress={() => handleSwitchSandboxRole('trainer')}
                    isLast={false}
                  />
                  <RoleRow
                    title="Switch to Client"
                    icon={<Users size={20} color={ACCENT} />}
                    onPress={() => handleSwitchSandboxRole('client')}
                    isLast={false}
                  />
                  <RoleRow
                    title="Switch to Personal"
                    icon={<User size={20} color={ACCENT} />}
                    onPress={() => handleSwitchSandboxRole('solo')}
                    isLast
                  />
                </>
              )}
            </div>

            {sandboxTrainer && (
              <>
                <h2 style={{ fontSize: 17, fontWeight: 600, marginBottom: 12, color: TEXT }}>Fake clients</h2>
                <div style={{ overflow: 'hidden', borderRadius: 14, background: CARD, marginBottom: 24 }}>
                  <div style={{ padding: 16, borderBottom: `1px solid ${SEPARATOR}` }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 12 }}>
                      <input
                        placeholder="Full name"
                        value={stubFullName}
                        onChange={(e) => setStubFullName(e.target.value)}
                        style={{ background: '#111C33', border: 'none', borderRadius: 8, padding: '10px 12px', color: TEXT, fontSize: 14 }}
                      />
                      <input
                        type="email"
                        placeholder="Email"
                        value={stubEmail}
                        onChange={(e) => setStubEmail(e.target.value)}
                        style={{ background: '#111C33', border: 'none', borderRadius: 8, padding: '10px 12px', color: TEXT, fontSize: 14 }}
                      />
                      <select
                        value={stubPhase}
                        onChange={(e) => setStubPhase(e.target.value)}
                        style={{ background: '#111C33', border: 'none', borderRadius: 8, padding: '10px 12px', color: TEXT, fontSize: 14 }}
                      >
                        <option value="Maintenance">Maintenance</option>
                        <option value="Bulk">Bulk</option>
                        <option value="Cut">Cut</option>
                        <option value="Prep Week 10">Prep Week 10</option>
                        <option value="Peak Week">Peak Week</option>
                      </select>
                      <select
                        value={stubStatus}
                        onChange={(e) => setStubStatus(e.target.value)}
                        style={{ background: '#111C33', border: 'none', borderRadius: 8, padding: '10px 12px', color: TEXT, fontSize: 14 }}
                      >
                        <option value="on_track">On track</option>
                        <option value="at_risk">At risk</option>
                        <option value="needs_review">Needs review</option>
                        <option value="attention">Attention</option>
                      </select>
                    </div>
                    <button
                      type="button"
                      onClick={handleCreateStubClient}
                      style={{
                        width: '100%',
                        padding: '10px 16px',
                        background: ACCENT,
                        border: 'none',
                        borderRadius: 8,
                        color: '#fff',
                        fontSize: 14,
                        fontWeight: 600,
                      }}
                    >
                      Create client
                    </button>
                  </div>
                  <RoleRow
                    title="Seed Test Clients"
                    icon={<UserPlus size={20} color={ACCENT} />}
                    onPress={handleSeedTestClients}
                    isLast={false}
                  />
                  <RoleRow
                    title="Seed realistic clients (5)"
                    icon={<UserPlus size={20} color={ACCENT} />}
                    onPress={handleSeedRealisticClients}
                    isLast={false}
                  />
                  <RoleRow
                    title="Reset Sandbox Data"
                    icon={<Trash2 size={20} color={ACCENT} />}
                    onPress={handleResetSandboxData}
                    isLast
                  />
                </div>
                {getStubClients().length > 0 && (
                  <p style={{ fontSize: 12, color: MUTED, marginBottom: 24 }} key={stubKey}>
                    {getStubClients().length} stub client(s). Open Clients to see them.
                  </p>
                )}
              </>
            )}
          </>
        )}

        {APP_MODE !== 'real' && (
          <div style={{ marginTop: 24, padding: 16, background: CARD, borderRadius: 14 }}>
            <h2 style={{ fontSize: 17, fontWeight: 600, marginBottom: 8, color: TEXT }}>Force Real Mode (DEV)</h2>
            <p style={{ fontSize: 13, color: MUTED, marginBottom: 8 }}>
              App mode is set at build time. To use Supabase and turn off demo:
            </p>
            <ol style={{ fontSize: 12, color: MUTED, marginBottom: 12, paddingLeft: 20 }}>
              <li>Create or edit <code style={{ background: '#111', padding: '2px 6px', borderRadius: 4 }}>.env.local</code> in the project root.</li>
              <li>Add the lines below (replace with your Supabase URL and anon key).</li>
              <li>Restart the dev server and reload the app.</li>
            </ol>
            <pre style={{ background: '#111', padding: 12, borderRadius: 8, fontSize: 12, overflow: 'auto', marginBottom: 8 }}>{envSnippet}</pre>
            <button
              type="button"
              onClick={handleCopyEnv}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 12px',
                background: ACCENT,
                border: 'none',
                borderRadius: 8,
                color: '#fff',
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              <Copy size={14} /> {copied ? 'Copied' : 'Copy for .env.local'}
            </button>
          </div>
        )}

        {hasSupabase && (
          <div style={{ marginTop: 24, padding: 16, background: CARD, borderRadius: 14 }}>
            <h2 style={{ fontSize: 17, fontWeight: 600, marginBottom: 8, color: TEXT }}>Stripe & webhooks</h2>
            <p style={{ fontSize: 13, color: MUTED, marginBottom: 4 }}>Supabase: configured</p>
            <p style={{ fontSize: 12, color: MUTED }}>
              Webhook: point Stripe to your project <code style={{ background: '#111', padding: '2px 6px', borderRadius: 4 }}>/functions/v1/stripe-webhook</code> and set STRIPE_WEBHOOK_SECRET.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
