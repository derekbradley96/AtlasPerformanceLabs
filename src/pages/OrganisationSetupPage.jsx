/**
 * Organisation setup: coach creates an organisation and becomes owner.
 * Flow: enter name → edit slug → create org → create membership (owner) → update profile.organisation_id.
 * Coach role only. Success → navigate to Organisation Dashboard.
 */
import React, { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { isCoach } from '@/lib/roles';
import { getSupabase, hasSupabase } from '@/lib/supabaseClient';
import TopBar from '@/components/ui/TopBar';
import Card from '@/ui/Card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { colors, spacing, shell } from '@/ui/tokens';
import { pageContainer, standardCard, sectionLabel } from '@/ui/pageLayout';
import { Building2 } from 'lucide-react';
import { toast } from 'sonner';
import { hapticLight } from '@/lib/haptics';

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
  const [submitting, setSubmitting] = useState(false);

  const slugDerived = useMemo(() => slugFromName(name), [name]);
  const slugDisplay = slug.trim() || slugDerived;

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

      setSubmitting(true);
      hapticLight();
      const supabase = getSupabase();
      try {
        const ownerProfileId = user.id;
        const slugValue = slugDisplay || null;

        const { data: org, error: orgError } = await supabase
          .from('organisations')
          .insert({
            name: trimmedName,
            slug: slugValue,
            owner_profile_id: ownerProfileId,
          })
          .select('id')
          .single();

        if (orgError) {
          if (orgError.code === '23505') {
            toast.error('That slug is already in use. Choose another.');
          } else {
            toast.error(orgError.message || 'Could not create organisation.');
          }
          setSubmitting(false);
          return;
        }

        const orgId = org?.id;
        if (!orgId) {
          toast.error('Organisation was created but could not continue.');
          setSubmitting(false);
          return;
        }

        const { error: memberError } = await supabase.from('organisation_members').insert({
          organisation_id: orgId,
          profile_id: ownerProfileId,
          role: 'owner',
          is_active: true,
        });

        if (memberError) {
          toast.error(memberError.message || 'Could not add you as owner.');
          setSubmitting(false);
          return;
        }

        const { error: profileError } = await supabase
          .from('profiles')
          .update({ organisation_id: orgId })
          .eq('id', ownerProfileId);

        if (profileError) {
          toast.error(profileError.message || 'Organisation created but profile could not be updated.');
          setSubmitting(false);
          return;
        }

        toast.success('Organisation created.');
        navigate('/organisation');
      } catch (err) {
        toast.error(err?.message || 'Something went wrong.');
      } finally {
        setSubmitting(false);
      }
    },
    [name, slugDisplay, user?.id, effectiveRole, navigate]
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
            disabled={submitting || !name?.trim()}
            className="w-full"
            style={{ minHeight: 48 }}
          >
            {submitting ? 'Creating…' : 'Create organisation'}
          </Button>
        </form>
      </div>
    </div>
  );
}
