import { useRef, useState } from 'react';
import { useGrist } from '@grist-widgets/ui';
import { useRecords } from './useRecords';
import { useInteractionDates } from './useInteractionDates';
import { useStatusColors } from './useStatusColors';
import { KanbanColumn } from './KanbanColumn';


const STATUSES = [
  'Pas de contact',
  'Contacté',
  'Autonomie',
  'Bloqué',
  'Cadrage en cours',
  'Déploiement engagé',
  'Adopté',
  'Abandonné',
] as const;


export function KanbanBoard() {
  const records = useRecords();
  const interactionDates = useInteractionDates();
  const statusColors = useStatusColors();
  const { record: selectedRecord, updateLinkedRecord, setCursorPos } = useGrist();
  const dragRef = useRef<{ id: number; fromStatus: string } | null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<string | null>(null);

  const columns = STATUSES.map((status) => ({
    status,
    cards: records.filter((r) => r['Statut'] === status),
  }));

  const handleDragStart = (id: number, fromStatus: string) => {
    dragRef.current = { id, fromStatus };
  };

  const handleDrop = async (toStatus: string) => {
    const info = dragRef.current;
    dragRef.current = null;
    setDragOverStatus(null);
    if (!info || info.fromStatus === toStatus) return;
    await updateLinkedRecord(info.id, { Statut: toStatus });
  };

  const handleDragEnd = () => {
    dragRef.current = null;
    setDragOverStatus(null);
  };

  return (
    <div className="kanban-board">
      {columns.map(({ status, cards }) => (
        <KanbanColumn
          key={status}
          status={status}
          statusColor={statusColors.get(status)}
          cards={cards}
          selectedId={selectedRecord?.id ?? null}
          isDragOver={dragOverStatus === status}
          interactionDates={interactionDates}
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
