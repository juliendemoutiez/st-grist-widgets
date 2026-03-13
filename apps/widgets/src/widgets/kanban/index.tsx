import './kanban.scss';
import { KanbanBoard } from './KanbanBoard';

interface KanbanWidgetProps {
  statuses: readonly string[];
}

export function KanbanWidget({ statuses }: KanbanWidgetProps) {
  return (
    <div className="kanban-layout">
      <KanbanBoard statuses={statuses} />
    </div>
  );
}
