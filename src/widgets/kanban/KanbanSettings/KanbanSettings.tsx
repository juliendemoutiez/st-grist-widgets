import { WidgetSettings } from '@grist-widgets/ui';
import type { KanbanConfig } from '../types';

const PLACEHOLDER: KanbanConfig = {
  statuses: ['Status A', 'Status B'],
  columns: {
    status: 'MyStatusColumn',
    title: 'MyTitleColumn',
    subtitle: 'MySubtitleColumn',
    badges: [
      { key: 'MyBadgeColumn', icon: 'people' },
    ],
    dueDate: 'MyDueDateColumn',
    assignee: 'MyAssigneeColumn',
  },
};

function validate(parsed: unknown): string | null {
  const p = parsed as KanbanConfig;
  if (!Array.isArray(p.statuses) || p.statuses.some((s) => typeof s !== 'string')) {
    return '"statuses" must be an array of strings';
  }
  if (!p.columns?.status || typeof p.columns.status !== 'string') {
    return '"columns.status" must be a string';
  }
  if (!p.columns?.title || typeof p.columns.title !== 'string') {
    return '"columns.title" must be a string';
  }
  return null;
}

export function KanbanSettings({ onDone }: { onDone: () => void }) {
  return (
    <WidgetSettings
      title="Configuration du kanban"
      placeholder={JSON.stringify(PLACEHOLDER, null, 2)}
      validate={validate}
      onDone={onDone}
    />
  );
}
