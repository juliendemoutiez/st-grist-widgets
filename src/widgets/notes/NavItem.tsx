import React from 'react';
import { createPortal } from 'react-dom';
import type { RowRecord } from 'grist-plugin-api';
import { ICON_COL, TYPE_COL, TITLE_COL, T_NOTE, itemIcon } from './constants';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface NavTreeState {
  selectedId: number | null;
  expandedFolders: Set<number>;
  draggingId: number | null;
  dropBeforeId: number | 'end' | null;
  dropGroup: string | null;
  folderDropTarget: number | null;
  menuOpenId: number | null;
  menuPos: { top: number; left: number } | null;
  treeChildren: (id: number) => RowRecord[];
}

export interface NavTreeHandlers {
  onSelect: (id: number) => void;
  onNewNote: (parentId?: number) => void;
  onExpandToggle: (id: number) => void;
  onDragStart: (e: React.DragEvent, id: number) => void;
  onDragEnd: () => void;
  onDragOverItem: (e: React.DragEvent, item: RowRecord, group: RowRecord[], groupKey: string) => void;
  onDropItem: (e: React.DragEvent, item: RowRecord, group: RowRecord[], groupKey: string) => void;
  onDragOverEnd: (e: React.DragEvent, groupKey: string, list: RowRecord[]) => void;
  onDropEnd: (e: React.DragEvent, groupKey: string, list: RowRecord[]) => void;
  onMenuOpen: (id: number, pos: { top: number; left: number }) => void;
  onMenuClose: () => void;
  onArchive: (id: number) => void;
}

// ─── NavDropEnd ───────────────────────────────────────────────────────────────

export function NavDropEnd({ groupKey, list, ts, th }: {
  groupKey: string; list: RowRecord[]; ts: NavTreeState; th: NavTreeHandlers;
}) {
  const isActive = ts.dropGroup === groupKey && ts.dropBeforeId === 'end';
  return (
    <div
      className={`notes__nav-drop-end${isActive ? ' notes__nav-drop-end--active' : ''}`}
      onDragOver={(e) => th.onDragOverEnd(e, groupKey, list)}
      onDrop={(e) => th.onDropEnd(e, groupKey, list)}
    />
  );
}

// ─── NavItem ──────────────────────────────────────────────────────────────────

export function NavItem({ item, group, groupKey, depth = 0, ts, th }: {
  item: RowRecord; group: RowRecord[]; groupKey: string; depth?: number;
  ts: NavTreeState; th: NavTreeHandlers;
}) {
  const children      = ts.treeChildren(item.id);
  const hasChildren   = children.length > 0;
  const childGroupKey = `children-${item.id}`;

  const isActive     = ts.selectedId === item.id;
  const isExpanded   = ts.expandedFolders.has(item.id);
  const isDragging   = ts.draggingId === item.id;
  const isDropBefore = ts.dropGroup === groupKey && ts.dropBeforeId === item.id;
  const isNestTarget = ts.folderDropTarget === item.id;

  return (
    <React.Fragment>
      <div
        className={[
          'notes__nav-item',
          isActive     ? 'notes__nav-item--active'        : '',
          isDragging   ? 'notes__nav-item--dragging'      : '',
          isDropBefore ? 'notes__nav-item--drop-before'   : '',
          isNestTarget ? 'notes__nav-item--folder-target' : '',
          hasChildren  ? 'notes__nav-item--has-children'  : '',
        ].filter(Boolean).join(' ')}
        style={depth > 0 ? { paddingLeft: `${0.75 + depth * 0.75}rem` } : undefined}
        onClick={() => th.onSelect(item.id)}
        draggable
        onDragStart={(e) => th.onDragStart(e, item.id)}
        onDragEnd={th.onDragEnd}
        onDragOver={(e) => th.onDragOverItem(e, item, group, groupKey)}
        onDrop={(e) => th.onDropItem(e, item, group, groupKey)}
      >
        <span
          className="notes__nav-icon-wrap"
          onClick={hasChildren ? (e) => { e.stopPropagation(); th.onExpandToggle(item.id); } : undefined}
        >
          {item[ICON_COL] ? (
            <span className="notes__nav-icon notes__nav-icon--note notes__nav-icon--emoji">
              {String(item[ICON_COL])}
            </span>
          ) : (
            <span className="material-icons notes__nav-icon notes__nav-icon--note">
              {itemIcon(String(item[TYPE_COL] ?? T_NOTE))}
            </span>
          )}
          {hasChildren && (
            <span className="material-icons notes__nav-icon notes__nav-icon--caret">
              {isExpanded ? 'expand_more' : 'chevron_right'}
            </span>
          )}
        </span>
        <span className="notes__nav-label">
          {String(item[TITLE_COL] ?? '') || 'Sans titre'}
        </span>
        <button
          className="notes__note-add-sub"
          onClick={(e) => { e.stopPropagation(); th.onNewNote(item.id); }}
          title="Nouvelle sous-note"
        >
          <span className="material-icons">add</span>
        </button>
        <button
          className="notes__note-menu-btn"
          onMouseDown={(e) => {
            e.stopPropagation();
            e.preventDefault();
            if (ts.menuOpenId === item.id) { th.onMenuClose(); return; }
            const rect = e.currentTarget.getBoundingClientRect();
            th.onMenuOpen(item.id, { top: rect.bottom + 4, left: rect.left });
          }}
        >
          <span className="material-icons">more_horiz</span>
        </button>
        {ts.menuOpenId === item.id && ts.menuPos && createPortal(
          <div className="notes__item-menu" style={{ top: ts.menuPos.top, left: ts.menuPos.left }}>
            <button
              className="notes__item-menu__action"
              onMouseDown={(e) => { e.preventDefault(); th.onArchive(item.id); }}
            >
              <span className="material-icons">inventory_2</span>
              Archiver
            </button>
          </div>,
          document.body,
        )}
      </div>
      {hasChildren && isExpanded && (
        <>
          {children.map((child) => (
            <NavItem
              key={child.id}
              item={child}
              group={children}
              groupKey={childGroupKey}
              depth={depth + 1}
              ts={ts}
              th={th}
            />
          ))}
          <NavDropEnd groupKey={childGroupKey} list={children} ts={ts} th={th} />
        </>
      )}
    </React.Fragment>
  );
}
