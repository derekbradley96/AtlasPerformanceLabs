import React, { useCallback, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { useAppRefresh } from '@/lib/useAppRefresh';
import { Plus, Copy, Trash2, MoreVertical, FileText } from 'lucide-react';
import {
  listTemplatesByTrainer,
  createTemplate,
  duplicateTemplate,
  deleteTemplate,
  updateTemplate,
  createOnboardingToken,
} from '@/lib/intake/intakeTemplateRepo';
import Card from '@/ui/Card';
import Button from '@/ui/Button';
import { colors, spacing } from '@/ui/tokens';
import { toast } from 'sonner';
import { impactLight, impactMedium } from '@/lib/haptics';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { getAppOrigin } from '@/lib/appOrigin';
import ConfirmDialog from '@/components/ui/ConfirmDialog';

export default function IntakeTemplatesList() {
  const { user, isDemoMode } = useAuth();
  const trainerId = isDemoMode ? 'demo-trainer' : user?.id ?? null;
  const navigate = useNavigate();
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [templateIdToDelete, setTemplateIdToDelete] = useState(null);

  const load = useCallback(() => {
    if (!trainerId) return;
    setTemplates(listTemplatesByTrainer(trainerId));
    setLoading(false);
  }, [trainerId]);

  const { refresh, refreshing } = useAppRefresh(load);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreate = useCallback(() => {
    impactLight();
    if (!trainerId) return;
    const t = createTemplate(trainerId, { name: 'New intake', serviceType: 'coaching', sections: [] });
    navigate(`/intake-templates/${t.id}`);
  }, [trainerId, navigate]);

  const handleDuplicate = useCallback(
    (id) => {
      impactLight();
      if (!trainerId) return;
      const t = duplicateTemplate(id, trainerId);
      if (t) {
        toast.success('Template duplicated');
        load();
        navigate(`/intake-templates/${t.id}`);
      } else {
        toast.error('Could not duplicate');
      }
    },
    [trainerId, load, navigate]
  );

  const handleDeleteRequest = useCallback((id) => {
    impactMedium();
    setTemplateIdToDelete(id);
    setDeleteConfirmOpen(true);
  }, []);

  const handleDeleteConfirm = useCallback(() => {
    if (!templateIdToDelete) return;
    if (deleteTemplate(templateIdToDelete)) {
      toast.success('Template deleted');
      load();
    } else {
      toast.error('Could not delete');
    }
    setDeleteConfirmOpen(false);
    setTemplateIdToDelete(null);
  }, [templateIdToDelete, load]);

  const handleDeleteCancel = useCallback(() => {
    setDeleteConfirmOpen(false);
    setTemplateIdToDelete(null);
  }, []);

  const handleToggleActive = useCallback(
    (t) => {
      impactLight();
      updateTemplate(t.id, { isActive: !t.isActive });
      toast.success(t.isActive ? 'Template disabled' : 'Template enabled');
      load();
    },
    [load]
  );

  const handleCopyLink = useCallback((t) => {
    impactLight();
    const token = createOnboardingToken(trainerId, t.id);
    const url = `${getAppOrigin()}/onboarding/${token}`;
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(url);
      toast.success('Onboarding link copied');
    } else {
      toast.error('Clipboard not available');
    }
  }, [trainerId]);

  if (!trainerId) {
    return (
      <div className="p-6 text-slate-400">
        <p>You must be signed in as a trainer.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-6 flex flex-col gap-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 bg-slate-800/50 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div
      className="app-screen min-w-0 max-w-full overflow-x-hidden"
      style={{ paddingBottom: `calc(${spacing[16]} + env(safe-area-inset-bottom, 0px))` }}
    >
      <div className="flex justify-end gap-2 mb-4">
        <Button variant="secondary" onClick={refresh} disabled={refreshing}>
          {refreshing ? 'Refreshing…' : 'Refresh'}
        </Button>
        <Button onClick={handleCreate} className="gap-2">
          <Plus size={18} />
          New template
        </Button>
      </div>

      {templates.length === 0 ? (
        <Card style={{ padding: spacing[24], textAlign: 'center' }}>
          <FileText size={48} className="mx-auto mb-3 opacity-50" style={{ color: colors.muted }} />
          <h3 className="text-lg font-semibold mb-2" style={{ color: colors.text }}>
            No intake templates yet
          </h3>
          <p className="text-sm mb-4" style={{ color: colors.muted }}>
            Create a template to collect client info via a shareable onboarding link.
          </p>
          <Button onClick={handleCreate}>Create your first template</Button>
        </Card>
      ) : (
        <ul className="space-y-3">
          {templates.map((t) => (
            <Card key={t.id} style={{ padding: spacing[16] }}>
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <h3 className="font-medium truncate" style={{ color: colors.text }}>
                    {t.name}
                  </h3>
                  <p className="text-xs mt-0.5" style={{ color: colors.muted }}>
                    {t.serviceType} · {(t.sections ?? []).length} section(s) · {t.isActive ? 'Active' : 'Disabled'}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="secondary"
                    onClick={() => navigate(`/intake-templates/${t.id}`)}
                  >
                    Edit
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="secondary" className="p-2 min-h-0">
                        <MoreVertical size={18} />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => handleCopyLink(t)}>
                        <Copy size={14} className="mr-2" />
                        Copy onboarding link
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => handleDuplicate(t.id)}>
                        <Copy size={14} className="mr-2" />
                        Duplicate
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => handleToggleActive(t)}>
                        {t.isActive ? 'Disable' : 'Enable'}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onSelect={() => handleDeleteRequest(t.id)}
                        className="text-red-500 focus:text-red-500"
                      >
                        <Trash2 size={14} className="mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </Card>
          ))}
        </ul>
      )}
      <ConfirmDialog
        open={deleteConfirmOpen}
        title="Delete template?"
        message="This cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
      />
    </div>
  );
}
