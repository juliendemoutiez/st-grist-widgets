import './KanbanCard.scss';
import { UserAvatar } from '@gouvfr-lasuite/ui-kit';
import type { RowRecord } from 'grist-plugin-api';
import { formatDate } from '@grist-widgets/ui';
import type { KanbanColumns } from '../types';

interface KanbanCardProps {
  record: RowRecord;
  columns: KanbanColumns;
  isSelected: boolean;
  onClick: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}

export function KanbanCard({ record, columns, isSelected, onClick, onDragStart, onDragEnd }: KanbanCardProps) {
  const title = record[columns.title] ? String(record[columns.title]) : 'Sans titre';
  const subtitle = columns.subtitle && record[columns.subtitle] ? String(record[columns.subtitle]) : null;
  const assignee = columns.assignee && record[columns.assignee] ? String(record[columns.assignee]) : null;

  const nowSeconds = Date.now() / 1000;
  const dueDateRaw = columns.dueDate ? record[columns.dueDate] : null;
  let dueDateTs: number | null = null;
  if (typeof dueDateRaw === 'number' && dueDateRaw > 0) {
    dueDateTs = dueDateRaw;
  } else if (dueDateRaw instanceof Date && !isNaN(dueDateRaw.getTime())) {
    dueDateTs = dueDateRaw.getTime() / 1000;
  }
  const dueDateStr = dueDateTs ? formatDate(dueDateTs) : null;
  const isOverdue = dueDateTs !== null && dueDateTs < nowSeconds;

  const hasMeta = (columns.badges && columns.badges.length > 0) || dueDateStr || assignee;

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
      <div className="kanban-card__title">{title}</div>
      {subtitle && <div className="kanban-card__subtitle">{subtitle}</div>}
      {hasMeta && (
        <div className="kanban-card__footer">
          <div className="kanban-card__chips">
            {columns.badges?.map(({ key, icon }) => {
              const value = record[key] != null ? String(record[key]) : null;
              if (!value) return null;
              return (
                <span key={key} className="kanban-card__badge">
                  <span className="material-icons">{icon}</span>
                  <span className="kanban-card__chip-label">{value}</span>
                </span>
              );
            })}
            {dueDateStr && (
              <span className={`kanban-card__meta${isOverdue ? ' kanban-card__meta--overdue' : ''}`}>
                <span className="material-icons">event</span>
                <span className="kanban-card__chip-label">{dueDateStr}</span>
              </span>
            )}
          </div>
          {assignee && (
            <span className="kanban-card__user">
              <UserAvatar fullName={assignee} size="xsmall" />
            </span>
          )}
        </div>
      )}
    </div>
  );
}
