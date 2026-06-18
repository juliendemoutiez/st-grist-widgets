import { NodeResizer, type NodeProps, type Node } from '@xyflow/react';
import type { RectangleNodeData } from '../types';
import { useSchemaDiagram } from '../SchemaDiagramContext';

type RectangleNodeType = Node<RectangleNodeData>;

export function RectangleNode({ data, selected }: NodeProps<RectangleNodeType>) {
  const { layoutEditable, onRectangleResizeEnd, onOpenRectPanel } = useSchemaDiagram();

  return (
    <div
      className="rectangle-node"
      style={{ borderColor: data.color, background: `${data.color}0F` }}
      onClick={layoutEditable ? () => onOpenRectPanel(data.rectId) : undefined}
    >
      {layoutEditable && (
        <NodeResizer
          isVisible={selected}
          minWidth={120}
          minHeight={60}
          onResizeEnd={(_, p) => onRectangleResizeEnd(data.rectId, p.x, p.y, p.width, p.height)}
        />
      )}
      {data.title && <div className="rectangle-node__title">{data.title}</div>}
    </div>
  );
}
