import type { RowRecord } from 'grist-plugin-api';
import type { InteractionInfo } from './useInteractionDates';
import { KanbanCard } from './KanbanCard';

interface KanbanColumnProps {
  status: string;
  statusColor?: string;
  cards: RowRecord[];
  selectedId: number | null;
  isDragOver: boolean;
  interactionDates: Map<number, InteractionInfo>;
  onCardClick: (id: number) => void;
  onDragStart: (id: number) => void;
  onDragOver: () => void;
  onDragLeave: () => void;
  onDrop: () => void;
  onDragEnd: () => void;
}

export function KanbanColumn({
  status,
  statusColor,
  cards,
  selectedId,
  isDragOver,
  interactionDates,
  onCardClick,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd,
}: KanbanColumnProps) {
  return (
    <div
      className={`kanban-column${isDragOver ? ' kanban-column--drag-over' : ''}`}
      onDragOver={(e) => { e.preventDefault(); onDragOver(); }}
      onDragLeave={onDragLeave}
      onDrop={(e) => { e.preventDefault(); onDrop(); }}
    >
      <div className="kanban-column__header">
        <span
          className="kanban-column__status-dot"
          data-status={status}
          style={statusColor ? { background: statusColor } : undefined}
        />
        <span className="kanban-column__title">{status}</span>
        <span className="kanban-column__count">{cards.length}</span>
      </div>
      <div className="kanban-column__cards">
        {cards.map((card) => (
          <KanbanCard
            key={card.id}
            record={card}
            isSelected={card.id === selectedId}
            prochaineDate={interactionDates.get(card.id)?.prochaineDate ?? null}
            isOverdue={interactionDates.get(card.id)?.isOverdue ?? false}
            onClick={() => onCardClick(card.id)}
            onDragStart={() => onDragStart(card.id)}
            onDragEnd={onDragEnd}
          />
        ))}
      </div>
    </div>
  );
}
