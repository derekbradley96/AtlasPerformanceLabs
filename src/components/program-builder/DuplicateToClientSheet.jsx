import React from 'react';
import { UserPlus } from 'lucide-react';
import Card from '@/ui/Card';
import { colors, spacing, shell, touchTargetMin } from '@/ui/tokens';
import { standardCard, sectionLabel, sectionGap } from '@/ui/pageLayout';

export default function DuplicateToClientSheet({
  block,
  clients,
  isPersonalRole,
  clientId,
  duplicateTargetClientId,
  setDuplicateTargetClientId,
  onDuplicate,
  saving,
}) {
  if (!block?.id || clients.length === 0 || isPersonalRole) return null;

  return (
    <Card style={{ ...standardCard, marginBottom: sectionGap, padding: spacing[16] }}>
      <p style={{ ...sectionLabel, marginBottom: spacing[8] }}>Assign program to another client</p>
      <div className="flex flex-wrap gap-2 items-center">
        <select
          value={duplicateTargetClientId}
          onChange={(e) => setDuplicateTargetClientId(e.target.value)}
          style={{
            flex: 1,
            minWidth: 220,
            padding: `${spacing[10]}px ${spacing[12]}px`,
            borderRadius: 10,
            background: colors.surface2,
            border: `1px solid ${shell.cardBorder}`,
            color: colors.text,
            fontSize: 14,
          }}
        >
          <option value="">Select target client</option>
          {clients
            .filter((c) => c.id !== (clientId || block.client_id))
            .map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
        </select>
        <button
          type="button"
          onClick={onDuplicate}
          disabled={saving || !duplicateTargetClientId}
          className="inline-flex items-center gap-2 text-sm font-medium rounded-lg transition-opacity"
          style={{
            minHeight: touchTargetMin,
            padding: `${spacing[12]}px ${spacing[16]}px`,
            border: `1px solid ${colors.primary}`,
            background: 'transparent',
            color: colors.primary,
            cursor: saving || !duplicateTargetClientId ? 'not-allowed' : 'pointer',
            opacity: saving || !duplicateTargetClientId ? 0.6 : 1,
          }}
        >
          <UserPlus size={16} /> Assign to client
        </button>
      </div>
    </Card>
  );
}
