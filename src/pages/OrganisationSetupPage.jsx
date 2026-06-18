/**
 * Organisation setup: coach creates an organisation and becomes owner.
 * Flow: enter name → edit slug → create org → create membership (owner) → update profile.organisation_id.
 * Coach role only. Success → navigate to Organisation Dashboard.
 */
import React, { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { useAuth } from '@/lib/AuthContext';
import { isCoach } from '@/lib/roles';
import { hasSupabase } from '@/lib/supabaseClient';
import TopBar from '@/components/ui/TopBar';
import Card from '@/ui/Card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { colors, spacing, shell } from '@/ui/tokens';
import { pageContainer, standardCard } from '@/ui/pageLayout';
import { Building2 } from 'lucide-react';
import { toast } from 'sonner';
import { hapticLight } from '@/lib/haptics';
import { createOrganisationAsOwner } from '@/data/organisationSetupRepo';

/** Generate URL-friendly slug from name. */
function slugFromName(name) {
  if (!name || typeof name !== 'string') return '';
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export default function OrganisationSetupPage() {
  const navigate = useNavigate();
  const { user, effectiveRole } = useAuth();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');

  const slugDerived = useMemo(() => slugFromName(name), [name]);
  const slugDisplay = slug.trim() || slugDerived;

  const createOrgMutation = useMutation({
    mutationFn: ({ trimmedName, slugValue, ownerProfileId }) =>
      createOrganisationAsOwner({ name: trimmedName, slug: slugValue, ownerProfileId }),
    onSuccess: () => {
      toast.success('Organisation created.');
      navigate('/organisation');
    },
    onError: (err) => {
      toast.error(err?.message || 'Something went wrong.');
    },
  });

  const handleNameChange = useCallback(
    (e) => {
      const v = e.target?.value ?? '';
      setName(v);
      if (!slug.trim()) setSlug(slugFromName(v));
    },
    [slug]
  );

  const handleSlugChange = useCallback((e) => {
    setSlug((e.target?.value ?? '').trim().toLowerCase().replace(/[^a-z0-9-]/g, ''));
  }, []);

  const handleSubmit = useCallback(
    async (e) => {
      e?.preventDefault();
      if (!hasSupabase || !user?.id) {
        toast.error('Sign in to create an organisation.');
        return;
      }
      if (!isCoach(effectiveRole)) {
        toast.error('Only coaches can create an organisation.');
        return;
      }
      const trimmedName = name?.trim();
      if (!trimmedName) {
        toast.error('Enter an organisation name.');
        return;
      }

      hapticLight();
      createOrgMutation.mutate({
        trimmedName,
        slugValue: slugDisplay || null,
        ownerProfileId: user.id,
      });
    },
    [name, slugDisplay, user?.id, effectiveRole, createOrgMutation]
  );

  if (!user) {
    return (
      <div className="min-h-screen" style={{ background: colors.bg, color: colors.text }}>
        <TopBar title="Create organisation" onBack={() => navigate(-1)} />
        <div className="p-4 max-w-lg mx-auto" style={pageContainer}>
          <p style={{ color: colors.muted }}>Sign in to create an organisation.</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate(-1)}>
            Back
          </Button>
        </div>
      </div>
    );
  }

  if (!isCoach(effectiveRole)) {
    return (
      <div className="min-h-screen" style={{ background: colors.bg, color: colors.text }}>
        <TopBar title="Create organisation" onBack={() => navigate(-1)} />
        <div className="p-4 max-w-lg mx-auto" style={pageContainer}>
          <p style={{ color: colors.muted }}>Only coaches can create an organisation.</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate(-1)}>
            Back
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-8" style={{ background: colors.bg, color: colors.text }}>
      <TopBar title="Create organisation" onBack={() => navigate(-1)} />
      <div className="max-w-lg mx-auto" style={{ ...pageContainer, paddingBottom: spacing[32] }}>
        <div className="flex items-center gap-3 mb-6">
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: shell.iconContainerRadius,
              background: colors.primarySubtle,
              color: colors.primary,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Building2 size={24} strokeWidth={2} />
          </div>
          <div>
            <h1 className="atlas-page-title" style={{ margin: 0 }}>Create organisation</h1>
            <p className="text-sm mt-0.5" style={{ color: colors.muted }}>
              Set up your team or brand. You’ll be the owner.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <Card style={{ ...standardCard, padding: spacing[20], marginBottom: spacing[20] }}>
            <div className="space-y-4">
              <div>
                <Label htmlFor="org-name" style={{ color: colors.muted, fontSize: 12, fontWeight: 600 }}>
                  Organisation name
                </Label>
                <Input
                  id="org-name"
                  type="text"
                  value={name}
                  onChange={handleNameChange}
                  placeholder="e.g. Atlas Performance"
                  className="mt-2 bg-black/20 border border-white/10 text-white placeholder:text-white/40"
                  autoComplete="organization"
                  maxLength={120}
                />
              </div>
              <div>
                <Label htmlFor="org-slug" style={{ color: colors.muted, fontSize: 12, fontWeight: 600 }}>
                  Slug <span style={{ fontWeight: 400, color: colors.muted }}>(optional, for URLs)</span>
                </Label>
                <Input
                  id="org-slug"
                  type="text"
                  value={slug}
                  onChange={handleSlugChange}
                  placeholder={slugDerived || 'e.g. atlas-performance'}
                  className="mt-2 bg-black/20 border border-white/10 text-white placeholder:text-white/40 font-mono text-sm"
                  maxLength={80}
                />
                {slugDerived && !slug && (
                  <p className="text-xs mt-1" style={{ color: colors.muted }}>
                    Will use: <code style={{ background: colors.surface2, padding: '2px 6px', borderRadius: 4 }}>{slugDerived || '—'}</code>
                  </p>
                )}
              </div>
            </div>
          </Card>

          <Button
            type="submit"
            disabled={createOrgMutation.isPending || !name?.trim()}
            className="w-full"
            style={{ minHeight: 48 }}
          >
            {createOrgMutation.isPending ? 'Creating…' : 'Create organisation'}
          </Button>
        </form>
      </div>
    </div>
  );
}
