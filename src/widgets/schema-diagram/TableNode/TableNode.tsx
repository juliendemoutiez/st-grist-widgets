import { Handle, Position, type NodeProps, type Node } from '@xyflow/react';
import { useSchemaDiagram } from '../SchemaDiagramContext';
import type { TableNodeData } from '../types';

type TableNodeType = Node<TableNodeData>;

export function TableNode({ data }: NodeProps<TableNodeType>) {
  const { onOpenPanel } = useSchemaDiagram();

  return (
    <div className="table-node">
      <Handle type="target" position={Position.Left} id="__target" />
      <Handle type="source" position={Position.Right} id="__source" />

      <div
        className="table-node__header"
        style={{ background: data.color }}
        onClick={(e) => { e.stopPropagation(); onOpenPanel(data.tableId); }}
      >
        <span className="table-node__name">{data.tableName}</span>
        <span className="table-node__badge">
          {data.fieldCount === null ? '…' : `${data.fieldCount} champs`}
        </span>
      </div>

      <div className="table-node__body">
        <p className={`table-node__description${data.description ? '' : ' table-node__description--placeholder'}`}>
          {data.description || 'Aucune description'}
        </p>
      </div>

      <div className="table-node__footer">
        <span className="table-node__row-count">
          {data.rowCount === null
            ? '…'
            : `${data.rowCount.toLocaleString('fr-FR')} lignes`}
        </span>
        <button
          className="nodrag table-node__fields-btn"
          onClick={e => { e.stopPropagation(); onOpenPanel(data.tableId); }}
        >
          Champs
          <span className="material-icons">chevron_right</span>
        </button>
      </div>
    </div>
  );
}
