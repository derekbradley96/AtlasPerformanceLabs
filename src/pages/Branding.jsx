import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { getBranding, saveBranding } from '@/lib/branding/brandingRepo';
import Card from '@/ui/Card';
import Button from '@/ui/Button';
import { colors, spacing } from '@/ui/tokens';
import { toast } from 'sonner';

export default function Branding() {
  const navigate = useNavigate();
  const { user, isDemoMode } = useAuth();
  const trainerId = isDemoMode ? 'demo-trainer' : user?.id ?? 'trainer-1';

  const [logoUrl, setLogoUrl] = useState('');
  const [accentColor, setAccentColor] = useState(colors.primary);
  const [footerText, setFooterText] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const b = getBranding(trainerId);
    setLogoUrl(b.logoUrl ?? '');
    setAccentColor(b.accentColor ?? colors.primary);
    setFooterText(b.footerText ?? '');
  }, [trainerId]);

  const handleLogoChange = (e) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => setLogoUrl(reader.result ?? '');
    reader.readAsDataURL(file);
  };

  const handleSave = () => {
    setSaving(true);
    saveBranding(trainerId, { logoUrl: logoUrl || undefined, accentColor, footerText: footerText || undefined });
    setSaving(false);
    toast.success('Branding saved');
  };

  return (
    <div
      className="app-screen min-w-0 max-w-full overflow-x-hidden"
      style={{
        paddingLeft: spacing[16],
        paddingRight: spacing[16],
        paddingBottom: `calc(${spacing[24]} + env(safe-area-inset-bottom, 0px))`,
      }}
    >
      <p className="text-[13px] mb-4" style={{ color: colors.muted }}>
        Used on PDF exports (Progress Report, Comp Prep, Payment Summary, Timeline).
      </p>

      <Card style={{ padding: spacing[16], marginBottom: spacing[16] }}>
        <p className="text-xs font-medium mb-2" style={{ color: colors.muted }}>Logo</p>
        <div className="flex items-center gap-4 flex-wrap">
          {logoUrl && (
            <img src={logoUrl} alt="Logo" style={{ maxHeight: 48, maxWidth: 120, objectFit: 'contain', background: 'transparent' }} />
          )}
          <label className="cursor-pointer">
            <input type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
            <span className="text-[14px] font-medium" style={{ color: colors.accent }}>{logoUrl ? 'Change' : 'Upload'} logo</span>
          </label>
          {logoUrl && (
            <button type="button" onClick={() => setLogoUrl('')} className="text-[14px]" style={{ color: colors.muted }}>Remove</button>
          )}
        </div>
      </Card>

      <Card style={{ padding: spacing[16], marginBottom: spacing[16] }}>
        <p className="text-xs font-medium mb-2" style={{ color: colors.muted }}>Accent colour</p>
        <div className="flex items-center gap-3">
          <input
            type="color"
            value={accentColor}
            onChange={(e) => setAccentColor(e.target.value)}
            style={{ width: 44, height: 44, padding: 0, border: 'none', borderRadius: 8, cursor: 'pointer' }}
          />
          <input
            type="text"
            value={accentColor}
            onChange={(e) => setAccentColor(e.target.value)}
            className="flex-1 rounded-lg border px-3 py-2 text-[14px] font-mono"
            style={{ background: 'rgba(255,255,255,0.06)', borderColor: colors.border, color: colors.text }}
          />
        </div>
      </Card>

      <Card style={{ padding: spacing[16], marginBottom: spacing[16] }}>
        <p className="text-xs font-medium mb-2" style={{ color: colors.muted }}>Footer text</p>
        <textarea
          value={footerText}
          onChange={(e) => setFooterText(e.target.value)}
          placeholder="e.g. Your Name | your@email.com"
          rows={2}
          className="w-full rounded-xl resize-none border px-3 py-2 text-[14px]"
          style={{ background: 'rgba(255,255,255,0.06)', borderColor: colors.border, color: colors.text }}
        />
      </Card>

      <Button variant="primary" onClick={handleSave} disabled={saving} style={{ width: '100%' }}>
        Save branding
      </Button>
    </div>
  );
}
