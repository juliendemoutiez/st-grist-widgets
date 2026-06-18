export interface KanbanBadge {
  key: string;
  icon: string;
}

export interface KanbanColumns {
  status: string;
  title: string;
  subtitle?: string;
  badges?: KanbanBadge[];
  dueDate?: string;
  assignee?: string;
}

export interface KanbanConfig {
  statuses: string[];
  columns: KanbanColumns;
}
