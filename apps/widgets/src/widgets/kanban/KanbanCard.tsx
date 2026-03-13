import { UserAvatar } from '@gouvfr-lasuite/ui-kit';
import type { RowRecord } from 'grist-plugin-api';

interface KanbanCardProps {
  record: RowRecord;
  isSelected: boolean;
  prochaineDate: number | null;
  isOverdue: boolean;
  onClick: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}

function formatDate(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function KanbanCard({ record, isSelected, prochaineDate, isOverdue, onClick, onDragStart, onDragEnd }: KanbanCardProps) {
  const nom = record['Nom'] ? String(record['Nom']) : 'Sans titre';
  const pourQui = record['Pour_qui_'] ? String(record['Pour_qui_']) : null;
  const effectifs = record['Effectifs'] != null ? String(record['Effectifs']) : null;
  const dateStr = prochaineDate ? formatDate(prochaineDate) : null;
  const lead = record['Lead'] ? String(record['Lead']) : null;

  return (
    <div
      className={`kanban-card${isSelected ? ' kanban-card--selected' : ''}`}
      draggable
      onClick={onClick}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'move';
        onDragStart();
      }}
      onDragEnd={onDragEnd}
    >
      <div className="kanban-card__title">{nom}</div>
      {pourQui && <div className="kanban-card__subtitle">{pourQui}</div>}
      {(effectifs || dateStr || lead) && (
        <div className="kanban-card__footer">
          {effectifs && (
            <span className="kanban-card__badge">
              <span className="material-icons">people</span>
              {effectifs}
            </span>
          )}
          {dateStr && (
            <span className={`kanban-card__meta${isOverdue ? ' kanban-card__meta--overdue' : ''}`}>
              <span className="material-icons">event</span>
              {dateStr}
            </span>
          )}
          {lead && (
            <span className="kanban-card__user">
              <UserAvatar fullName={lead} size="xsmall" />
            </span>
          )}
        </div>
      )}
    </div>
  );
}
