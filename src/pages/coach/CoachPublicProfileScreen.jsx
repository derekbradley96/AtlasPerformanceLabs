import React, { useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { getTrainerProfileByUsername } from '@/lib/trainerFoundation/trainerProfileRepo';
import Card from '@/ui/Card';
import Button from '@/ui/Button';
import { colors, spacing } from '@/ui/tokens';
import LeadApplicationForm from '@/pages/coach/LeadApplicationForm';
import { impactLight } from '@/lib/haptics';
import { User, Briefcase, Image as ImageIcon } from 'lucide-react';

export default function CoachPublicProfileScreen() {
  const { username } = useParams();
  const profile = useMemo(
    () => (username ? getTrainerProfileByUsername(username) : null),
    [username]
  );
  const [applyOpen, setApplyOpen] = useState(false);

  const notFound = username && !profile;

  if (notFound) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center px-6"
        style={{ background: colors.bg }}
      >
        <User size={48} style={{ color: colors.muted }} className="mb-4" />
        <h1 className="text-xl font-semibold text-center mb-2" style={{ color: colors.text }}>
          Coach not found
        </h1>
        <p className="text-center text-sm" style={{ color: colors.muted }}>
          This profile doesn&apos;t exist or isn&apos;t available.
        </p>
      </div>
    );
  }

  const p = profile;
  const displayName = p?.displayName || p?.username || 'Coach';
  const specialties = p?.specialties ?? [];
  const portfolio = p?.trainerPortfolio ?? [];
  const services = p?.services ?? [];

  return (
    <div
      className="min-h-screen"
      style={{
        background: colors.bg,
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: `calc(${spacing[24]} + env(safe-area-inset-bottom))`,
        paddingLeft: spacing[16],
        paddingRight: spacing[16],
      }}
    >
      {/* Header: banner + avatar + name */}
      <div className="rounded-2xl overflow-hidden mb-4" style={{ background: colors.card }}>
        <div
          className="h-28 flex items-end justify-center pb-2"
          style={{
            background: p?.bannerImage
              ? `center/cover url(${p.bannerImage})`
              : 'linear-gradient(135deg, rgba(37,99,235,0.3), rgba(15,23,42,0.9))',
          }}
        />
        <div className="flex flex-col items-center px-4 pb-4 -mt-12">
          <div
            className="w-24 h-24 rounded-2xl border-4 overflow-hidden flex-shrink-0"
            style={{ borderColor: colors.card, background: colors.card }}
          >
            {p?.profileImage ? (
              <img src={p.profileImage} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <User size={40} style={{ color: colors.muted }} />
              </div>
            )}
          </div>
          <h1 className="text-xl font-semibold mt-3" style={{ color: colors.text }}>
            {displayName}
          </h1>
          {p?.username && (
            <p className="text-sm" style={{ color: colors.muted }}>@{p.username}</p>
          )}
        </div>
      </div>

      {specialties.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {specialties.map((s) => (
            <span
              key={s}
              className="rounded-full px-3 py-1 text-sm"
              style={{ background: 'rgba(37,99,235,0.2)', color: '#93C5FD' }}
            >
              {s}
            </span>
          ))}
        </div>
      )}

      {p?.bio && (
        <Card style={{ padding: spacing[16], marginBottom: spacing[16] }}>
          <p className="text-sm whitespace-pre-wrap" style={{ color: colors.text }}>{p.bio}</p>
        </Card>
      )}

      {/* Services */}
      <h2 className="text-lg font-semibold mb-3" style={{ color: colors.text }}>Services</h2>
      {services.length === 0 ? (
        <Card style={{ padding: spacing[24], textAlign: 'center' }}>
          <Briefcase size={32} style={{ color: colors.muted }} className="mx-auto mb-2" />
          <p className="text-sm" style={{ color: colors.muted }}>No services listed yet.</p>
        </Card>
      ) : (
        <div className="space-y-3 mb-6">
          {services.map((s) => (
            <Card key={s.id} style={{ padding: spacing[16] }}>
              <div className="flex justify-between items-start gap-2">
                <div>
                  <p className="font-medium" style={{ color: colors.text }}>{s.name}</p>
                  {s.description && (
                    <p className="text-sm mt-1" style={{ color: colors.muted }}>{s.description}</p>
                  )}
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
            </Card>
          ))}
        </div>
      )}

      {/* Portfolio */}
      <h2 className="text-lg font-semibold mb-3" style={{ color: colors.text }}>Portfolio</h2>
      {portfolio.length === 0 ? (
        <Card style={{ padding: spacing[24], textAlign: 'center', marginBottom: spacing[24] }}>
          <ImageIcon size={32} style={{ color: colors.muted }} className="mx-auto mb-2" />
          <p className="text-sm" style={{ color: colors.muted }}>No portfolio images yet.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-3 gap-2 mb-8">
          {portfolio.map((item) => (
            <div
              key={item.id}
              className="aspect-square rounded-xl overflow-hidden border"
              style={{ borderColor: colors.border }}
            >
              <img src={item.url} alt={item.caption || ''} className="w-full h-full object-cover" />
            </div>
          ))}
        </div>
      )}

      <Button
        className="w-full"
        onClick={() => {
          impactLight();
          setApplyOpen(true);
        }}
      >
        Apply for coaching
      </Button>

      {applyOpen && (
        <LeadApplicationForm
          trainerUserId={p?.trainerId ?? p?.user_id}
          trainerProfileId={p?.trainerId}
          services={services}
          onClose={() => setApplyOpen(false)}
          onSuccess={() => setApplyOpen(false)}
        />
      )}
    </div>
  );
}
