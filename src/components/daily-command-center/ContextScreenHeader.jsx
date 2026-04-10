import React from 'react';
import { PageHeader } from '@/components/atlas-ui/PageHeader';

/** @deprecated Prefer `PageHeader` from `@/components/atlas-ui` for new screens. */
export default function ContextScreenHeader({ title, subtitle, actions }) {
  return <PageHeader title={title} subtitle={subtitle} actions={actions} />;
}
