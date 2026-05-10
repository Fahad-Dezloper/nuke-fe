'use client';

import { SectionErrorBoundary } from '@/components/error-boundary';
import { AutomationPanel } from '@/components/features/automation/automation-panel';

export default function AutomationPage() {
  return (
    <SectionErrorBoundary name="Automation">
      <AutomationPanel />
    </SectionErrorBoundary>
  );
}
