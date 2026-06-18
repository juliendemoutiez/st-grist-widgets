export type RectangleNodeData = {
  rectId: string;
  title: string;
  color: string;
};

export type RectangleOption = {
  id: string;
  title?: string;
  color?: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type TableNodeData = {
  tableId: string;
  tableName: string;
  description: string;
  color: string;
  fieldCount: number | null;
  outgoingRefs: string[];
  incomingRefs: string[];
  rowCount: number | null;
};

export type AnnotationRow = {
  id: number;
  TableId: string;
  tableName?: string;
  Description: string;
};

export type SchemaColumn = {
  colId: string;
  type: string;
  label: string;
  parentTableId: string;
};
