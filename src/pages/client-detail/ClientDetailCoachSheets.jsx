import React from 'react';
import { Download } from 'lucide-react';
import { toast } from 'sonner';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import Button from '@/ui/Button';
import { colors, spacing } from '@/ui/tokens';
import {
  generateProgressReport,
  generateCompPrepReport,
  generatePaymentSummary,
  generateTimelineReport,
} from '@/lib/exports/exportService';
export function ClientDetailExportSheet({
  open,
  onOpenChange,
  clientId,
  trainerId,
  coachViewerWU,
  clientFullName,
  exportingType,
  setExportingType,
  lightHaptic,
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl" style={{ background: colors.card, borderColor: colors.border }}>
        <SheetHeader>
          <SheetTitle style={{ color: colors.text }}>Export PDF</SheetTitle>
        </SheetHeader>
        <div className="flex flex-col gap-2 pt-4 pb-6">
          {[
            { key: 'progress', label: 'Progress Report', fn: generateProgressReport, filename: 'progress-report.pdf' },
            { key: 'comprep', label: 'Comp Prep Report', fn: generateCompPrepReport, filename: 'comp-prep-report.pdf' },
            { key: 'payment', label: 'Payment Summary', fn: generatePaymentSummary, filename: 'payment-summary.pdf' },
            { key: 'timeline', label: 'Timeline Summary', fn: generateTimelineReport, filename: 'timeline-summary.pdf' },
          ].map(({ key, label, fn, filename }) => (
            <button
              key={key}
              type="button"
              disabled={!!exportingType}
              onClick={async () => {
                if (!clientId || exportingType) return;
                await lightHaptic();
                setExportingType(key);
                try {
                  const blob = await fn(clientId, trainerId, { weightUnit: coachViewerWU });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `${(clientFullName || 'client').replace(/\s+/g, '-')}-${filename}`;
                  a.click();
                  URL.revokeObjectURL(url);
                  toast.success('PDF downloaded');
                  onOpenChange(false);
                } catch (e) {
                  toast.error('Failed to generate PDF');
                } finally {
                  setExportingType(null);
                }
              }}
              className="flex items-center justify-between w-full rounded-xl py-3 px-4 text-left transition-opacity"
              style={{
                background: colors.bg,
                border: `1px solid ${colors.border}`,
                color: colors.text,
              }}
            >
              <span className="text-[15px] font-medium">{label}</span>
              {exportingType === key ? (
                <span className="text-[13px]" style={{ color: colors.muted }}>Generating...</span>
              ) : (
                <Download size={18} style={{ color: colors.muted }} />
              )}
            </button>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function ClientDetailMethodologySheet({
  open,
  onOpenChange,
  clientId,
  coachMethodologyPackages,
  navigate,
  onDeployPackage,
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl" style={{ background: colors.card, borderColor: colors.border }}>
        <SheetHeader>
          <SheetTitle style={{ color: colors.text }}>Deploy methodology</SheetTitle>
        </SheetHeader>
        <div className="flex flex-col gap-2 pt-4 pb-6">
          {coachMethodologyPackages.length === 0 ? (
            <button
              type="button"
              onClick={() => navigate(`/methodology-packages?clientId=${clientId}`)}
              className="w-full rounded-xl py-3 px-4 text-left"
              style={{ border: `1px solid ${colors.border}`, background: colors.surface2, color: colors.text }}
            >
              No saved packages yet. Create your first package →
            </button>
          ) : null}
          {coachMethodologyPackages.map((pkg) => (
            <button
              key={pkg.id}
              type="button"
              onClick={() => onDeployPackage(pkg)}
              className="w-full rounded-xl py-3 px-4 text-left"
              style={{ border: `1px solid ${colors.border}`, background: colors.surface2, color: colors.text }}
            >
              <p className="m-0 text-sm font-semibold">{pkg.name}</p>
              <p className="m-0 text-xs" style={{ color: colors.muted, marginTop: spacing[4] }}>
                {(pkg.program_ids || []).length} programs · {pkg.nutrition_formula || 'No formula'}
              </p>
            </button>
          ))}
          <button
            type="button"
            onClick={() => navigate(`/methodology-packages?clientId=${clientId}`)}
            className="w-full rounded-xl py-3 px-4 text-left"
            style={{ border: `1px solid ${colors.border}`, background: colors.bg, color: colors.primary }}
          >
            Manage methodology packages →
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function ClientDetailNutritionAdjustSheet({
  open,
  onOpenChange,
  nutritionForm,
  setNutritionForm,
  onSave,
  nutritionSaving,
  safeFormatDate,
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl" style={{ background: colors.card, borderColor: colors.border }}>
        <SheetHeader>
          <SheetTitle style={{ color: colors.text }}>Adjust this week</SheetTitle>
        </SheetHeader>
        <div className="flex flex-col gap-4 pt-4 pb-6">
          <p className="text-xs" style={{ color: colors.muted }}>Week of {nutritionForm.week_start ? safeFormatDate(nutritionForm.week_start) : '—'}</p>
          <div className="grid grid-cols-2 gap-3">
            {['calories', 'protein', 'carbs', 'fats'].map((field) => (
              <div key={field}>
                <label className="block text-xs font-medium mb-1" style={{ color: colors.muted }}>{field === 'calories' ? 'Calories' : field.charAt(0).toUpperCase() + field.slice(1) + ' (g)'}</label>
                <input
                  type="number"
                  inputMode="numeric"
                  value={nutritionForm[field]}
                  onChange={(e) => setNutritionForm((f) => ({ ...f, [field]: e.target.value }))}
                  className="w-full rounded-xl px-3 py-2 text-[15px] focus:outline-none focus:ring-1"
                  style={{ background: colors.surface1, border: `1px solid ${colors.border}`, color: colors.text }}
                  placeholder={field === 'calories' ? 'e.g. 2000' : 'e.g. 150'}
                />
              </div>
            ))}
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: colors.muted }}>Phase</label>
            <input
              type="text"
              value={nutritionForm.phase}
              onChange={(e) => setNutritionForm((f) => ({ ...f, phase: e.target.value }))}
              className="w-full rounded-xl px-3 py-2 text-[15px] focus:outline-none focus:ring-1"
              style={{ background: colors.surface1, border: `1px solid ${colors.border}`, color: colors.text }}
              placeholder="e.g. Cut week 4"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: colors.muted }}>Notes</label>
            <textarea
              value={nutritionForm.notes}
              onChange={(e) => setNutritionForm((f) => ({ ...f, notes: e.target.value }))}
              rows={2}
              className="w-full rounded-xl px-3 py-2 text-[15px] resize-none focus:outline-none focus:ring-1"
              style={{ background: colors.surface1, border: `1px solid ${colors.border}`, color: colors.text }}
              placeholder="Optional notes"
            />
          </div>
          <div className="flex gap-2 pt-2">
            <Button variant="secondary" onClick={() => onOpenChange(false)} style={{ flex: 1 }}>Cancel</Button>
            <Button variant="primary" onClick={onSave} disabled={nutritionSaving} style={{ flex: 1 }}>{nutritionSaving ? 'Saving…' : 'Save'}</Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
