import './KanbanColumn.scss';
import type { RowRecord } from 'grist-plugin-api';
import type { KanbanColumns } from '../types';
import { KanbanCard } from '../KanbanCard/KanbanCard';

interface KanbanColumnProps {
  status: string;
  cards: RowRecord[];
  columns: KanbanColumns;
  selectedId: number | null;
  isDragOver: boolean;
  onCardClick: (id: number) => void;
  onDragStart: (id: number) => void;
  onDragOver: () => void;
  onDragLeave: () => void;
  onDrop: () => void;
  onDragEnd: () => void;
}

export function KanbanColumn({
  status,
  cards,
  columns,
  selectedId,
  isDragOver,
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
        <span className="kanban-column__title">{status}</span>
        <span className="kanban-column__count">{cards.length}</span>
      </div>
      <div className="kanban-column__cards">
        {cards.map((card) => (
          <KanbanCard
            key={card.id}
            record={card}
            columns={columns}
            isSelected={card.id === selectedId}
            onClick={() => onCardClick(card.id)}
            onDragStart={() => onDragStart(card.id)}
            onDragEnd={onDragEnd}
          />
        ))}
      </div>
    </div>
  );
}
