import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Panel,
  useNodesState,
  useReactFlow,
  useViewport,
  type Node,
  type OnNodeDrag,
  type ReactFlowInstance,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useGrist, WidgetSettings } from '@grist-widgets/ui';
import { TableNode } from './TableNode/TableNode';
import { RectangleNode } from './RectangleNode/RectangleNode';
import { SchemaDiagramContext } from './SchemaDiagramContext';
import type { TableNodeData, RectangleNodeData, RectangleOption, SchemaColumn } from './types';
import './SchemaDiagramWidget.scss';

// ─── Constants ────────────────────────────────────────────────────────────────

const NODE_WIDTH = 260;
const COLS_PER_ROW = 3;
const H_GAP = 100;
const V_GAP = 80;
const APPROX_ROW_HEIGHT = 200;
const DEFAULT_RECT_COLOR = '#dbeafe';
const DEFAULT_RECT_W = 400;
const DEFAULT_RECT_H = 250;

const PALETTE = [
  '#2a9d8f', '#6c5ce7', '#2d8a3c', '#c07830',
  '#2980b9', '#8e44ad', '#b03030', '#16a085',
  '#d35400', '#27ae60',
];

// ─── Options types ────────────────────────────────────────────────────────────

type TableOption = {
  visible?: boolean;
  description?: string;
  x?: number;
  y?: number;
  color?: string;
};

type OpenPanel =
  | { type: 'table'; tableId: string }
  | { type: 'rect'; rectId: string };

type WidgetOptions = {
  layoutEditable?: boolean;
  defaultRectangleColor?: string;
  defaultRectangleTitle?: string;
  tables?: Record<string, TableOption>;
  rectangles?: RectangleOption[];
};

function parseTableOptions(opts: Record<string, unknown> | null): Record<string, TableOption> {
  return (opts?.tables as Record<string, TableOption>) ?? {};
}

function validateOptions(parsed: unknown): string | null {
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return 'La valeur doit être un objet JSON';
  }
  const { tables } = parsed as Record<string, unknown>;
  if (tables !== undefined) {
    if (typeof tables !== 'object' || tables === null || Array.isArray(tables)) {
      return '"tables" doit être un objet';
    }
    for (const [key, val] of Object.entries(tables as Record<string, unknown>)) {
      if (typeof val !== 'object' || val === null || Array.isArray(val)) {
        return `"tables.${key}" doit être un objet`;
      }
    }
  }
  return null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function tableColor(tableId: string): string {
  let hash = 0;
  for (let i = 0; i < tableId.length; i++) {
    hash = ((hash << 5) - hash) + tableId.charCodeAt(i);
    hash |= 0;
  }
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

function getDisplayType(type: string): string {
  if (type.startsWith('Ref:')) return `→ ${type.slice(4)}`;
  if (type.startsWith('RefList:')) return `→ [${type.slice(8)}]`;
  const MAP: Record<string, string> = {
    Text: 'Text', Int: 'Integer', Numeric: 'Number', Bool: 'Boolean',
    Date: 'Date', DateTime: 'Date/Time', Choice: 'Choice',
    ChoiceList: 'Choice List', Attachments: 'Attachments', Any: 'Any',
  };
  return MAP[type] ?? type;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const nodeTypes: Record<string, any> = { table: TableNode, rectangle: RectangleNode };
const PRO_OPTIONS = { hideAttribution: true };

// ─── Color swatches ───────────────────────────────────────────────────────────

function ColorSwatches({ selected, onChange }: { selected: string; onChange: (c: string) => void }) {
  return (
    <div className="color-swatches">
      {PALETTE.map(c => (
        <button
          key={c}
          className={`color-swatches__swatch${c === selected ? ' color-swatches__swatch--active' : ''}`}
          style={{ background: c }}
          onClick={e => { e.stopPropagation(); onChange(c); }}
          aria-label={c}
        />
      ))}
    </div>
  );
}

// ─── Canvas controls ──────────────────────────────────────────────────────────

function CanvasControls() {
  const { zoomIn, zoomOut, fitView } = useReactFlow();
  const { zoom } = useViewport();
  return (
    <div className="canvas-controls">
      <button className="canvas-controls__btn" onClick={() => zoomOut({ duration: 200 })}>−</button>
      <span className="canvas-controls__zoom">{Math.round(zoom * 100)}%</span>
      <button className="canvas-controls__btn" onClick={() => zoomIn({ duration: 200 })}>+</button>
      <div className="canvas-controls__sep" />
      <button className="canvas-controls__btn canvas-controls__btn--reset" onClick={() => fitView({ duration: 300, padding: 0.15 })}>
        Réinitialiser
      </button>
    </div>
  );
}

// ─── Fields panel ─────────────────────────────────────────────────────────────

function FieldsPanel({
  tableId, color, columns, description, onClose, layoutEditable, onColorChange, onDescriptionChange,
}: {
  tableId: string;
  color: string;
  columns: SchemaColumn[];
  description: string;
  onClose: () => void;
  layoutEditable: boolean;
  onColorChange: (color: string) => void;
  onDescriptionChange: (desc: string) => void;
}) {
  const [desc, setDesc] = useState(description);
  const sorted = [...columns].sort((a, b) =>
    (a.label || a.colId).localeCompare(b.label || b.colId, 'fr', { sensitivity: 'base' })
  );
  return (
    <div className="fields-panel">
      <div className="fields-panel__header" style={{ borderTopColor: color }}>
        <div>
          <div className="fields-panel__title">{tableId}</div>
          <div className="fields-panel__subtitle">{sorted.length} champs</div>
        </div>
        <button className="fields-panel__close" onClick={onClose} aria-label="Fermer">
          <span className="material-icons">close</span>
        </button>
      </div>
      {(layoutEditable || desc) && (
        <div className="fields-panel__section">
          {layoutEditable ? (
            <textarea
              className="fields-panel__text-input fields-panel__text-input--textarea"
              value={desc}
              onChange={e => setDesc(e.target.value)}
              onBlur={() => onDescriptionChange(desc)}
              placeholder="Ajouter une description…"
              rows={3}
            />
          ) : (
            <p className="fields-panel__description">{desc}</p>
          )}
        </div>
      )}
      {layoutEditable && (
        <div className="fields-panel__section">
          <div className="fields-panel__section-label">Couleur</div>
          <ColorSwatches selected={color} onChange={onColorChange} />
        </div>
      )}
      <div className="fields-panel__list">
        {sorted.map(col => (
          <div key={col.colId} className="fields-panel__row">
            <span className="fields-panel__col-name">{col.label || col.colId}</span>
            <span className="fields-panel__col-type">{getDisplayType(col.type)}</span>
          </div>
        ))}
        {sorted.length === 0 && <div className="fields-panel__empty">Aucun champ trouvé</div>}
      </div>
    </div>
  );
}

function RectanglePanel({
  rect, onClose, onColorChange, onTitleChange,
}: {
  rect: RectangleOption;
  onClose: () => void;
  onColorChange: (color: string) => void;
  onTitleChange: (title: string) => void;
}) {
  const [title, setTitle] = useState(rect.title ?? '');
  return (
    <div className="fields-panel">
      <div className="fields-panel__header" style={{ borderTopColor: rect.color ?? DEFAULT_RECT_COLOR }}>
        <div>
          <div className="fields-panel__title">Rectangle</div>
        </div>
        <button className="fields-panel__close" onClick={onClose} aria-label="Fermer">
          <span className="material-icons">close</span>
        </button>
      </div>
      <div className="fields-panel__section">
        <div className="fields-panel__section-label">Titre</div>
        <input
          className="fields-panel__text-input"
          value={title}
          onChange={e => setTitle(e.target.value)}
          onBlur={() => onTitleChange(title)}
          onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
          placeholder="Titre du rectangle"
        />
      </div>
      <div className="fields-panel__section">
        <div className="fields-panel__section-label">Couleur</div>
        <ColorSwatches selected={rect.color ?? DEFAULT_RECT_COLOR} onChange={onColorChange} />
      </div>
    </div>
  );
}

// ─── Main widget ──────────────────────────────────────────────────────────────

const OPTIONS_PLACEHOLDER = JSON.stringify(
  {
    layoutEditable: false,
    defaultRectangleColor: '#dbeafe',
    defaultRectangleTitle: 'Groupe',
    tables: {
      NomTable: { visible: true, description: 'Description de la table' },
      AutreTable: { visible: false },
    },
  },
  null,
  2,
);

export function SchemaDiagramWidget() {
  const {
    fetchTable,
    widgetOptions, saveWidgetOptions,
    isConfiguringWidget, setIsConfiguringWidget,
  } = useGrist();

  const [schemaColumns, setSchemaColumns] = useState<SchemaColumn[]>([]);
  const [tableIds, setTableIds] = useState<string[]>([]);
  const [rowCounts, setRowCounts] = useState<Record<string, number | null>>({});
  const [openPanel, setOpenPanel] = useState<OpenPanel | null>(null);

  // ── Fetch schema ──────────────────────────────────────────────────────────
  const loadSchema = useCallback(async () => {
    try {
      const [tablesRaw, colsRaw] = await Promise.all([
        fetchTable('_grist_Tables'),
        fetchTable('_grist_Tables_column'),
      ]);
      const gristIds = tablesRaw.id as number[];
      const gristTableIds = tablesRaw.tableId as string[];
      const idToTableId: Record<number, string> = {};
      for (let i = 0; i < gristIds.length; i++) idToTableId[gristIds[i]] = gristTableIds[i];
      const nextTableIds = (gristTableIds as string[]).filter(t => !t.startsWith('_grist_'));
      setTableIds(prev =>
        prev.length === nextTableIds.length && prev.every((id, i) => id === nextTableIds[i])
          ? prev
          : nextTableIds,
      );

      const cColIds = colsRaw.colId as string[];
      const cTypes = colsRaw.type as string[];
      const cLabels = colsRaw.label as string[];
      const cParents = colsRaw.parentId as number[];
      const loaded: SchemaColumn[] = [];
      for (let i = 0; i < cColIds.length; i++) {
        const parentTableId = idToTableId[cParents[i]];
        if (!parentTableId || parentTableId.startsWith('_grist_')) continue;
        const colId = cColIds[i] as string;
        if (colId === 'manualSort' || colId.startsWith('gristHelper_')) continue;
        loaded.push({ colId, type: (cTypes[i] as string) || 'Any', label: (cLabels[i] as string) || '', parentTableId });
      }
      setSchemaColumns(loaded);
    } catch (err) {
      console.error('Schema fetch failed:', err);
    }
  }, [fetchTable]);

  useEffect(() => {
    const t = setTimeout(() => loadSchema(), 100);
    return () => clearTimeout(t);
  }, [loadSchema]);

  // ── Fetch row counts ──────────────────────────────────────────────────────
  useEffect(() => {
    if (tableIds.length === 0) return;
    setRowCounts(Object.fromEntries(tableIds.map(id => [id, null])));
    for (const tableId of tableIds) {
      fetchTable(tableId)
        .then(data => setRowCounts(prev => ({ ...prev, [tableId]: (data.id as number[]).length })))
        .catch(() => setRowCounts(prev => ({ ...prev, [tableId]: 0 })));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableIds]);

  // ── Parse options ─────────────────────────────────────────────────────────
  const opts = widgetOptions as WidgetOptions | null;
  const tableOptions = useMemo(() => parseTableOptions(widgetOptions), [widgetOptions]);
  const layoutEditable = opts?.layoutEditable === true;
  const rectOptions = useMemo(() => (opts?.rectangles ?? []) as RectangleOption[], [opts]);

  const visibleTableIds = useMemo(
    () => tableIds.filter(id => tableOptions[id]?.visible !== false),
    [tableIds, tableOptions],
  );

  // ── Build nodes ───────────────────────────────────────────────────────────
  const columnsByTable = useMemo(() => {
    const map: Record<string, SchemaColumn[]> = {};
    for (const col of schemaColumns) (map[col.parentTableId] ??= []).push(col);
    return map;
  }, [schemaColumns]);

  const visibleTableIdSet = useMemo(() => new Set(visibleTableIds), [visibleTableIds]);

  const builtTableNodes = useMemo<Node<TableNodeData>[]>(() => {
    const outgoing: Record<string, string[]> = {};
    const incoming: Record<string, string[]> = {};
    for (const col of schemaColumns) {
      const isRef = col.type.startsWith('Ref:') || col.type.startsWith('RefList:');
      if (!isRef) continue;
      const target = col.type.startsWith('Ref:') ? col.type.slice(4) : col.type.slice(8);
      if (!visibleTableIdSet.has(col.parentTableId) || !visibleTableIdSet.has(target)) continue;
      (outgoing[col.parentTableId] ??= []).push(target);
      (incoming[target] ??= []).push(col.parentTableId);
    }
    for (const k of Object.keys(outgoing)) outgoing[k] = [...new Set(outgoing[k])];
    for (const k of Object.keys(incoming)) incoming[k] = [...new Set(incoming[k])];

    return visibleTableIds.map((tableId, i) => {
      const opt = tableOptions[tableId];
      const col = i % COLS_PER_ROW;
      const rowIdx = Math.floor(i / COLS_PER_ROW);
      const defaultPos = { x: col * (NODE_WIDTH + H_GAP), y: rowIdx * (APPROX_ROW_HEIGHT + V_GAP) };
      const savedPos = opt?.x !== undefined && opt?.y !== undefined ? { x: opt.x, y: opt.y } : null;
      const cols = columnsByTable[tableId] ?? [];
      return {
        id: tableId,
        type: 'table',
        position: savedPos ?? defaultPos,
        zIndex: 1,
        data: {
          tableId, tableName: tableId,
          description: opt?.description ?? '',
          color: tableOptions[tableId]?.color ?? tableColor(tableId),
          fieldCount: schemaColumns.length > 0 ? cols.length : null,
          outgoingRefs: outgoing[tableId] ?? [],
          incomingRefs: incoming[tableId] ?? [],
          rowCount: rowCounts[tableId] ?? null,
        },
        style: { width: NODE_WIDTH },
      };
    });
  }, [visibleTableIds, schemaColumns, columnsByTable, visibleTableIdSet, rowCounts, tableOptions]);

  const builtRectNodes = useMemo<Node<RectangleNodeData>[]>(() =>
    rectOptions.map(rect => ({
      id: `rect-${rect.id}`,
      type: 'rectangle',
      position: { x: rect.x, y: rect.y },
      zIndex: 0,
      selectable: layoutEditable,
      focusable: layoutEditable,
      style: { width: rect.width, height: rect.height },
      data: { rectId: rect.id, title: rect.title ?? '', color: rect.color ?? DEFAULT_RECT_COLOR },
    })),
  [rectOptions, layoutEditable]);

  // Rectangles first so table nodes render on top
  const allBuiltNodes = useMemo(
    () => [...builtRectNodes, ...builtTableNodes],
    [builtRectNodes, builtTableNodes],
  );

  // ── Nodes state ───────────────────────────────────────────────────────────
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const initialNodes = useMemo(() => allBuiltNodes, []);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<any>>(initialNodes);

  const rfInstanceRef = useRef<ReactFlowInstance | null>(null);
  const hasFitRef = useRef(false);

  useEffect(() => {
    setNodes(curr => {
      const prevMap = Object.fromEntries(curr.map(n => [n.id, n]));
      return allBuiltNodes.map(n => ({
        ...n,
        position: prevMap[n.id]?.position ?? n.position,
      }));
    });
    if (!hasFitRef.current && allBuiltNodes.length > 0) {
      hasFitRef.current = true;
      setTimeout(() => rfInstanceRef.current?.fitView({ duration: 400, padding: 0.15 }), 300);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allBuiltNodes]);

  // ── Persistence helpers ───────────────────────────────────────────────────
  const widgetOptionsRef = useRef(widgetOptions);
  widgetOptionsRef.current = widgetOptions;
  const tableOptionsRef = useRef(tableOptions);
  tableOptionsRef.current = tableOptions;
  const rectOptionsRef = useRef(rectOptions);
  rectOptionsRef.current = rectOptions;

  const saveTablePos = useCallback((tableId: string, x: number, y: number) => {
    const cur = widgetOptionsRef.current as WidgetOptions ?? {};
    saveWidgetOptions({
      ...cur,
      tables: { ...tableOptionsRef.current, [tableId]: { ...tableOptionsRef.current[tableId], x, y } },
    } as Record<string, unknown>);
  }, [saveWidgetOptions]);

  const saveRectGeometry = useCallback((rectId: string, x: number, y: number, width: number, height: number) => {
    const cur = widgetOptionsRef.current as WidgetOptions ?? {};
    const rects = rectOptionsRef.current.map(r => r.id === rectId ? { ...r, x, y, width, height } : r);
    saveWidgetOptions({ ...cur, rectangles: rects } as Record<string, unknown>);
  }, [saveWidgetOptions]);

  const saveTableDescription = useCallback((tableId: string, description: string) => {
    const cur = widgetOptionsRef.current as WidgetOptions ?? {};
    saveWidgetOptions({
      ...cur,
      tables: { ...tableOptionsRef.current, [tableId]: { ...tableOptionsRef.current[tableId], description } },
    } as Record<string, unknown>);
  }, [saveWidgetOptions]);

  const saveTableColor = useCallback((tableId: string, color: string) => {
    const cur = widgetOptionsRef.current as WidgetOptions ?? {};
    saveWidgetOptions({
      ...cur,
      tables: { ...tableOptionsRef.current, [tableId]: { ...tableOptionsRef.current[tableId], color } },
    } as Record<string, unknown>);
  }, [saveWidgetOptions]);

  const saveRectColor = useCallback((rectId: string, color: string) => {
    const cur = widgetOptionsRef.current as WidgetOptions ?? {};
    const rects = rectOptionsRef.current.map(r => r.id === rectId ? { ...r, color } : r);
    saveWidgetOptions({ ...cur, rectangles: rects } as Record<string, unknown>);
  }, [saveWidgetOptions]);

  const saveRectTitle = useCallback((rectId: string, title: string) => {
    const cur = widgetOptionsRef.current as WidgetOptions ?? {};
    const rects = rectOptionsRef.current.map(r => r.id === rectId ? { ...r, title } : r);
    saveWidgetOptions({ ...cur, rectangles: rects } as Record<string, unknown>);
  }, [saveWidgetOptions]);

  // ── Drag & resize handlers ────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleNodeDragStop: OnNodeDrag<Node<any>> = useCallback((_, node) => {
    if (node.type === 'table') {
      saveTablePos(node.id, node.position.x, node.position.y);
    } else if (node.type === 'rectangle') {
      const { width, height } = node.style as { width: number; height: number };
      saveRectGeometry(node.data.rectId, node.position.x, node.position.y, width, height);
    }
  }, [saveTablePos, saveRectGeometry]);

  const onRectangleResizeEnd = useCallback(
    (rectId: string, x: number, y: number, width: number, height: number) => {
      saveRectGeometry(rectId, x, y, width, height);
    },
    [saveRectGeometry],
  );

  // ── Add rectangle ─────────────────────────────────────────────────────────
  const handleAddRectangle = useCallback(() => {
    const cur = widgetOptionsRef.current as WidgetOptions ?? {};
    const newRect: RectangleOption = {
      id: Date.now().toString(),
      title: cur.defaultRectangleTitle ?? '',
      color: cur.defaultRectangleColor ?? DEFAULT_RECT_COLOR,
      x: 0, y: 0,
      width: DEFAULT_RECT_W, height: DEFAULT_RECT_H,
    };
    saveWidgetOptions({ ...cur, rectangles: [...(cur.rectangles ?? []), newRect] } as Record<string, unknown>);
  }, [saveWidgetOptions]);

  // ── Panel ─────────────────────────────────────────────────────────────────
  const onOpenPanel = useCallback((tableId: string) => setOpenPanel({ type: 'table', tableId }), []);
  const onOpenRectPanel = useCallback((rectId: string) => setOpenPanel({ type: 'rect', rectId }), []);

  const contextValue = useMemo(
    () => ({ onOpenPanel, onOpenRectPanel, layoutEditable, onRectangleResizeEnd }),
    [onOpenPanel, onOpenRectPanel, layoutEditable, onRectangleResizeEnd],
  );

  const panelColumns = useMemo(
    () => openPanel?.type === 'table' ? (columnsByTable[openPanel.tableId] ?? []) : [],
    [openPanel, columnsByTable],
  );

  const openRect = useMemo(
    () => openPanel?.type === 'rect' ? (rectOptions.find(r => r.id === openPanel.rectId) ?? null) : null,
    [openPanel, rectOptions],
  );

  // ─────────────────────────────────────────────────────────────────────────
  if (isConfiguringWidget) {
    return (
      <WidgetSettings
        title="Configuration du schéma"
        placeholder={OPTIONS_PLACEHOLDER}
        validate={validateOptions}
        onDone={() => setIsConfiguringWidget(false)}
      />
    );
  }

  return (
    <SchemaDiagramContext.Provider value={contextValue}>
      <div className="schema-diagram">
        {layoutEditable && (
          <div className="schema-diagram__edit-chip">
            Mode édition
            <button className="schema-diagram__edit-chip__add-btn nodrag nopan" onClick={handleAddRectangle}>
              <span className="material-icons">add</span>
              Rectangle
            </button>
          </div>
        )}

        <ReactFlow
          nodes={nodes}
          onNodesChange={onNodesChange}
          nodeTypes={nodeTypes}
          onInit={(instance) => { rfInstanceRef.current = instance; }}
          onNodeDragStop={layoutEditable ? handleNodeDragStop : undefined}
          nodesDraggable={layoutEditable}
          minZoom={0.15}
          maxZoom={2.5}
          deleteKeyCode={null}
          nodesConnectable={false}
          edgesFocusable={false}
          proOptions={PRO_OPTIONS}
        >
          <Background variant={BackgroundVariant.Dots} color="#c8cdd5" gap={24} size={1.5} />
          <Panel position="bottom-center">
            <CanvasControls />
          </Panel>
        </ReactFlow>

        {openPanel?.type === 'table' && (
          <FieldsPanel
            key={openPanel.tableId}
            tableId={openPanel.tableId}
            color={tableOptions[openPanel.tableId]?.color ?? tableColor(openPanel.tableId)}
            description={tableOptions[openPanel.tableId]?.description ?? ''}
            columns={panelColumns}
            onClose={() => setOpenPanel(null)}
            layoutEditable={layoutEditable}
            onColorChange={(color) => saveTableColor(openPanel.tableId, color)}
            onDescriptionChange={(desc) => saveTableDescription(openPanel.tableId, desc)}
          />
        )}
        {openPanel?.type === 'rect' && openRect && (
          <RectanglePanel
            key={openRect.id}
            rect={openRect}
            onClose={() => setOpenPanel(null)}
            onColorChange={(color) => saveRectColor(openPanel.rectId, color)}
            onTitleChange={(title) => saveRectTitle(openPanel.rectId, title)}
          />
        )}
      </div>
    </SchemaDiagramContext.Provider>
  );
}
