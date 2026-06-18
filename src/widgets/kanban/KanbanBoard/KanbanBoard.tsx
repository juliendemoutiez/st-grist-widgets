import './KanbanBoard.scss';
import { useRef, useState } from 'react';
import { useGrist } from '@grist-widgets/ui';
import { KanbanColumn } from '../KanbanColumn/KanbanColumn';
import type { KanbanColumns } from '../types';


interface KanbanBoardProps {
  statuses: readonly string[];
  columns: KanbanColumns;
}

export function KanbanBoard({ statuses, columns }: KanbanBoardProps) {
  const { allRecords: records, record: selectedRecord, updateLinkedRecord, setCursorPos } = useGrist();

  const dragRef = useRef<{ id: number; fromStatus: string } | null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<string | null>(null);

  const boardColumns = statuses.map((status) => ({
    status,
    cards: records.filter((r) => r[columns.status] === status),
  }));

  const handleDragStart = (id: number, fromStatus: string) => {
    dragRef.current = { id, fromStatus };
  };

  const handleDrop = async (toStatus: string) => {
    const info = dragRef.current;
    dragRef.current = null;
    setDragOverStatus(null);
    if (!info || info.fromStatus === toStatus) return;
    await updateLinkedRecord(info.id, { [columns.status]: toStatus });
  };

  const handleDragEnd = () => {
    dragRef.current = null;
    setDragOverStatus(null);
  };

  return (
    <div className="kanban-board">
      {boardColumns.map(({ status, cards }) => (
        <KanbanColumn
          key={status}
          status={status}
          cards={cards}
          columns={columns}
          selectedId={selectedRecord?.id ?? null}
          isDragOver={dragOverStatus === status}
          onCardClick={(id) => setCursorPos(id)}
          onDragStart={(id) => handleDragStart(id, status)}
          onDragOver={() => setDragOverStatus(status)}
          onDragLeave={() => setDragOverStatus(null)}
          onDrop={() => handleDrop(status)}
          onDragEnd={handleDragEnd}
        />
      ))}
    </div>
  );
}
