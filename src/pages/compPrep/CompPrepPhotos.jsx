import React, { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, Plus, ImageIcon } from 'lucide-react';
import { getClientById, getClientPhotos } from '@/data/selectors';
import { addClientPhoto } from '@/lib/compPrepStore';
import Card from '@/ui/Card';
import { colors, spacing } from '@/ui/tokens';

const PHOTO_TYPES = [
  { value: 'checkin', label: 'Check-in' },
  { value: 'posing', label: 'Posing' },
  { value: 'peak_week', label: 'Peak week' },
];

export default function CompPrepPhotos() {
  const { clientId } = useParams();
  const navigate = useNavigate();
  const [refresh, setRefresh] = useState(0);
  const client = useMemo(() => (clientId ? getClientById(clientId) : null), [clientId]);
  const photos = useMemo(() => (clientId ? getClientPhotos(clientId) : []), [clientId, refresh]);

  const [filterType, setFilterType] = useState('');
  const [compareIds, setCompareIds] = useState([]);
  const [sliderWeekIndex, setSliderWeekIndex] = useState(0);

  const filtered = useMemo(() => {
    if (!filterType) return photos;
    return photos.filter((p) => p.type === filterType);
  }, [photos, filterType]);

  const byWeek = useMemo(() => {
    const byDate = {};
    filtered.forEach((p) => {
      const week = p.created_at?.slice(0, 10) ?? 'unknown';
      if (!byDate[week]) byDate[week] = [];
      byDate[week].push(p);
    });
    const weeks = Object.keys(byDate).sort((a, b) => b.localeCompare(a));
    return { weeks, byDate };
  }, [filtered]);

  const handleAddPhoto = () => {
    if (!clientId) return;
    const url = 'https://placehold.co/400x600/1e293b/94a3b8?text=Photo';
    addClientPhoto(clientId, { type: 'checkin', image_url: url, notes: '' }, () => getClientPhotos(clientId));
    setRefresh((r) => r + 1);
  };

  if (!client) {
    return (
      <div className="app-screen p-4" style={{ background: colors.bg, color: colors.muted }}>
        <p>Client not found.</p>
      </div>
    );
  }

  return (
    <div
      className="app-screen min-w-0 max-w-full overflow-x-hidden"
      style={{
        minHeight: '100%',
        background: colors.bg,
        color: colors.text,
        paddingLeft: spacing[16],
        paddingRight: spacing[16],
        paddingBottom: `calc(${spacing[16]} + env(safe-area-inset-bottom, 0px))`,
      }}
    >
      <div className="flex items-center gap-2 mb-4">
        <button
          type="button"
          onClick={() => navigate(`/comp-prep/${clientId}`)}
          className="p-2 -ml-2 rounded-lg"
          style={{ color: colors.muted }}
        >
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-lg font-semibold">Photo Vault</h1>
      </div>
      <p className="text-sm mb-4" style={{ color: colors.muted }}>
        {client.full_name || client.name}
      </p>

      {/* Filter by type */}
      <div className="flex gap-2 mb-4 flex-wrap">
        <button
          type="button"
          onClick={() => setFilterType('')}
          className="px-3 py-1.5 rounded-lg text-sm font-medium"
          style={{
            background: !filterType ? 'rgba(59, 130, 246, 0.2)' : 'rgba(255,255,255,0.08)',
            color: !filterType ? '#93C5FD' : colors.muted,
          }}
        >
          All
        </button>
        {PHOTO_TYPES.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => setFilterType(t.value)}
            className="px-3 py-1.5 rounded-lg text-sm font-medium"
            style={{
              background: filterType === t.value ? 'rgba(59, 130, 246, 0.2)' : 'rgba(255,255,255,0.08)',
              color: filterType === t.value ? '#93C5FD' : colors.muted,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Side-by-side compare (placeholder: select two photos) */}
      {compareIds.length >= 2 && (
        <Card style={{ marginBottom: spacing[16], padding: spacing[16] }}>
          <h3 className="text-sm font-semibold mb-2">Compare</h3>
          <div className="grid grid-cols-2 gap-2">
            {compareIds.slice(0, 2).map((id) => {
              const p = photos.find((x) => x.id === id);
              return (
                <div key={id} className="aspect-[2/3] rounded-lg overflow-hidden bg-slate-800 flex items-center justify-center">
                  {p?.image_url ? (
                    <img src={p.image_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <ImageIcon size={32} style={{ color: colors.muted }} />
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Weekly progression slider */}
      {byWeek.weeks.length > 0 && (
        <Card style={{ marginBottom: spacing[16], padding: spacing[16] }}>
          <h3 className="text-sm font-semibold mb-2">By week</h3>
          <input
            type="range"
            min={0}
            max={Math.max(0, byWeek.weeks.length - 1)}
            value={sliderWeekIndex}
            onChange={(e) => setSliderWeekIndex(Number(e.target.value))}
            className="w-full h-2 rounded-full appearance-none bg-slate-700 accent-blue-500"
          />
          <p className="text-xs mt-1" style={{ color: colors.muted }}>
            Week of {byWeek.weeks[sliderWeekIndex]}
          </p>
          <div className="grid grid-cols-2 gap-2 mt-2">
            {(byWeek.byDate[byWeek.weeks[sliderWeekIndex]] ?? []).map((p) => (
              <div key={p.id} className="aspect-[2/3] rounded-lg overflow-hidden bg-slate-800 flex items-center justify-center">
                {p.image_url ? (
                  <img src={p.image_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <ImageIcon size={24} style={{ color: colors.muted }} />
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Add photo */}
      <button
        type="button"
        onClick={handleAddPhoto}
        className="flex items-center justify-center gap-2 w-full py-4 rounded-xl border-2 border-dashed mb-4"
        style={{ borderColor: colors.border, color: colors.muted }}
      >
        <Plus size={20} />
        <span>Add photo</span>
      </button>

      {/* Photo grid */}
      <div className="grid grid-cols-2 gap-3">
        {filtered.map((p) => (
          <div key={p.id} className="rounded-xl overflow-hidden bg-slate-800">
            <div className="aspect-[2/3] flex items-center justify-center bg-slate-800">
              {p.image_url ? (
                <img src={p.image_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <ImageIcon size={32} style={{ color: colors.muted }} />
              )}
            </div>
            <div className="p-2">
              <p className="text-xs capitalize" style={{ color: colors.muted }}>
                {p.type}
              </p>
              {p.notes && <p className="text-xs truncate" style={{ color: colors.text }}>{p.notes}</p>}
              <button
                type="button"
                onClick={() =>
                  setCompareIds((prev) =>
                    prev.includes(p.id) ? prev.filter((x) => x !== p.id) : [...prev.slice(-1), p.id]
                  )
                }
                className="text-xs mt-1"
                style={{ color: colors.accent }}
              >
                {compareIds.includes(p.id) ? 'Remove from compare' : 'Compare'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
