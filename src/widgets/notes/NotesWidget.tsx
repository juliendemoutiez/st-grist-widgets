import './notes.scss';
import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import type { RowRecord } from 'grist-plugin-api';
import { useGrist } from '@grist-widgets/ui';
import {
  TITLE_COL, CONTENT_COL, ICON_COL, TYPE_COL, PARENT_COL,
  ORDER_COL, STATUS_COL, CREATED_COL, IS_EXPANDED_COL,
  T_NOTE, T_DAILY, S_ARCHIVED, S_ACTIVE, DEFAULT_ICON,
  itemIcon,
} from './constants';
import { NavItem, NavDropEnd } from './NavItem';
import type { NavTreeState, NavTreeHandlers } from './NavItem';
import { ItemEditor } from './ItemEditor';

// ─── Static views ─────────────────────────────────────────────────────────────

const STATIC_VIEWS = [
  { id: 'notes'   as const, label: 'Notes',         icon: 'description'        },
  { id: 'daily'   as const, label: 'Daily stream',  icon: 'calendar_view_week' },
  { id: 'archive' as const, label: 'Archive',       icon: 'inventory_2'        },
];
type ViewId = typeof STATIC_VIEWS[number]['id'];

function formatDate(ts: unknown): string {
  if (!ts) return '';
  const d         = new Date(Number(ts) * 1000);
  const now       = new Date();
  const today     = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterday = today - 86_400_000;
  const item      = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  if (item === today)     return "Aujourd'hui";
  if (item === yesterday) return 'Hier';
  return d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
}

// ─── Main widget ──────────────────────────────────────────────────────────────

export function NotesWidget() {
  const {
    allRecords, record,
    createLinkedRecord, updateLinkedRecord,
    setCursorPos, setSelectedRows, fetchCurrentTable,
  } = useGrist();

  const [activeView, setActiveView]             = useState<ViewId>('notes');
  const [selectedId, setSelectedId]             = useState<number | null>(null);
  const [focusEndKey, setFocusEndKey]           = useState(0);
  const [sidebarOpen, setSidebarOpen]           = useState(false);
  const [menuOpenId, setMenuOpenId]             = useState<number | null>(null);
  const [menuPos, setMenuPos]                   = useState<{ top: number; left: number } | null>(null);

  const draggingIdRef = useRef<number | null>(null);
  const [draggingId, setDraggingId]             = useState<number | null>(null);
  const [dropBeforeId, setDropBeforeId]         = useState<number | 'end' | null>(null);
  const [dropGroup, setDropGroup]               = useState<string | null>(null);
  const [folderDropTarget, setFolderDropTarget] = useState<number | null>(null);

  // Local expanded set — initialized once via fetchCurrentTable (which returns ALL columns,
  // including hidden ones that onRecords/allRecords omits), then updated optimistically.
  const [localExpanded, setLocalExpanded] = useState<Set<number> | null>(null);
  const expandedInitRef = useRef(false);
  useEffect(() => {
    if (expandedInitRef.current) return;
    expandedInitRef.current = true;
    fetchCurrentTable()
      .then((rows) => setLocalExpanded(new Set(rows.filter((r) => r[IS_EXPANDED_COL]).map((r) => r.id))))
      .catch(() => setLocalExpanded(new Set()));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const expandedFolders = localExpanded ?? new Set<number>();

  const persistExpand = useCallback((id: number, expanded: boolean) => {
    void updateLinkedRecord(id, { [IS_EXPANDED_COL]: expanded });
  }, [updateLinkedRecord]);

  const setExpanded = useCallback((id: number, expanded: boolean) => {
    setLocalExpanded((prev) => {
      const s = new Set(prev ?? []);
      if (expanded) s.add(id); else s.delete(id);
      return s;
    });
    persistExpand(id, expanded);
  }, [persistExpand]);

  // Keep allRecords in a ref so stable drag callbacks always see the latest value
  const allRecordsRef = useRef(allRecords);
  useEffect(() => { allRecordsRef.current = allRecords; }, [allRecords]);

  useEffect(() => {
    if (record?.id && record.id !== selectedId) setSelectedId(record.id);
  }, [record?.id]);

  // ── Derived data ───────────────────────────────────────────────────────────

  const rootItems = useMemo(
    () =>
      [...allRecords.filter(
        (r) => !Number(r[PARENT_COL]) && r[STATUS_COL] !== S_ARCHIVED && r[TYPE_COL] !== T_DAILY,
      )].sort((a, b) => ((a[ORDER_COL] as number) || 0) - ((b[ORDER_COL] as number) || 0)),
    [allRecords],
  );

  const childrenMap = useMemo(() => {
    const map = new Map<number, RowRecord[]>();
    for (const r of allRecords) {
      if (r[PARENT_COL]) {
        const pid = Number(r[PARENT_COL]);
        if (!map.has(pid)) map.set(pid, []);
        map.get(pid)!.push(r);
      }
    }
    for (const [, list] of map) {
      list.sort((a, b) => ((a[ORDER_COL] as number) || 0) - ((b[ORDER_COL] as number) || 0));
    }
    return map;
  }, [allRecords]);

  const treeChildren = useCallback(
    (folderId: number) =>
      (childrenMap.get(folderId) ?? []).filter(
        (r) => r[STATUS_COL] !== S_ARCHIVED && r[TYPE_COL] !== T_DAILY,
      ),
    [childrenMap],
  );

  const dailyItems = useMemo(
    () =>
      [...allRecords.filter((r) => r[TYPE_COL] === T_DAILY)].sort(
        (a, b) => ((b[CREATED_COL] as number) || 0) - ((a[CREATED_COL] as number) || 0),
      ),
    [allRecords],
  );

  const archivedRootItems = useMemo(() => {
    const archivedIds = new Set(allRecords.filter((r) => r[STATUS_COL] === S_ARCHIVED).map((r) => r.id));
    return allRecords
      .filter((r) => r[STATUS_COL] === S_ARCHIVED && !archivedIds.has(Number(r[PARENT_COL])))
      .sort((a, b) => ((a[ORDER_COL] as number) || 0) - ((b[ORDER_COL] as number) || 0));
  }, [allRecords]);

  const archivedChildren = useCallback(
    (id: number) =>
      (childrenMap.get(id) ?? [])
        .filter((r) => r[STATUS_COL] === S_ARCHIVED)
        .sort((a, b) => ((a[ORDER_COL] as number) || 0) - ((b[ORDER_COL] as number) || 0)),
    [childrenMap],
  );

  const selectedRecord = useMemo(
    () => (selectedId ? (allRecords.find((r) => r.id === selectedId) ?? null) : null),
    [allRecords, selectedId],
  );

  const getGroup = useCallback((r: RowRecord): { key: string; list: RowRecord[] } => {
    const pid = Number(r[PARENT_COL]) || 0;
    if (!pid) return { key: 'root', list: rootItems };
    return { key: `children-${pid}`, list: childrenMap.get(pid) ?? [] };
  }, [rootItems, childrenMap]);

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleSelect = async (id: number) => {
    setSelectedId(id);
    await setCursorPos(id);
    await setSelectedRows([id]);
  };

  const handleNewNote = async (parentId?: number) => {
    const siblings = parentId ? (childrenMap.get(parentId) ?? []) : rootItems;
    const maxOrder = siblings.reduce((m, r) => Math.max(m, (r[ORDER_COL] as number) || 0), 0);
    const id = await createLinkedRecord({
      [TITLE_COL]:   '',
      [CONTENT_COL]: '',
      [TYPE_COL]:    T_NOTE,
      [ICON_COL]:    DEFAULT_ICON,
      [STATUS_COL]:  S_ACTIVE,
      [PARENT_COL]:  parentId ?? 0,
      [ORDER_COL]:   maxOrder + 10,
    });
    if (id) {
      if (parentId) setExpanded(parentId, true);
      await handleSelect(id);
    }
  };

  const handleNewDaily = async () => {
    const now  = new Date();
    const dd   = String(now.getDate()).padStart(2, '0');
    const mm   = String(now.getMonth() + 1).padStart(2, '0');
    const yyyy = now.getFullYear();
    const todayTitle = `${dd}-${mm}-${yyyy}`;
    const existing = allRecords.find((r) => r[TYPE_COL] === T_DAILY && r[TITLE_COL] === todayTitle);
    setActiveView('daily');
    if (existing) {
      setFocusEndKey((k) => k + 1);
      await handleSelect(existing.id);
    } else {
      const id = await createLinkedRecord({ [TITLE_COL]: todayTitle, [CONTENT_COL]: '', [TYPE_COL]: T_DAILY });
      if (id) await handleSelect(id);
    }
  };

  // saveStatus: pendingSavesRef counter prevents concurrent saves from clobbering each other
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const pendingSavesRef = useRef(0);
  const saveTimerRef    = useRef<ReturnType<typeof setTimeout> | null>(null);

  const trackSave = useCallback(async (fn: () => Promise<void>) => {
    if (saveTimerRef.current) { clearTimeout(saveTimerRef.current); saveTimerRef.current = null; }
    pendingSavesRef.current += 1;
    setSaveStatus('saving');
    try {
      await fn();
    } catch { /* ignore */ } finally {
      pendingSavesRef.current -= 1;
      if (pendingSavesRef.current === 0) {
        setSaveStatus('saved');
        saveTimerRef.current = setTimeout(() => setSaveStatus('idle'), 2000);
      }
    }
  }, []);

  const handleSaveTitle   = (title: string)   => { if (selectedId) void trackSave(() => updateLinkedRecord(selectedId, { [TITLE_COL]:   title   })); };
  const handleSaveContent = (content: string) => { if (selectedId) void trackSave(() => updateLinkedRecord(selectedId, { [CONTENT_COL]: content })); };
  const handleSaveIcon    = (icon: string)    => { if (selectedId) void trackSave(() => updateLinkedRecord(selectedId, { [ICON_COL]:    icon    })); };

  const handleArchive = async (id: number) => {
    setMenuOpenId(null); setMenuPos(null);
    const toArchive: number[] = [];
    const collect = (nodeId: number) => {
      toArchive.push(nodeId);
      for (const child of childrenMap.get(nodeId) ?? []) collect(child.id);
    };
    collect(id);
    if (selectedId !== null && toArchive.includes(selectedId)) setSelectedId(null);
    for (const nid of toArchive) await updateLinkedRecord(nid, { [STATUS_COL]: S_ARCHIVED });
  };

  useEffect(() => {
    if (menuOpenId === null) return;
    const handler = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('.notes__item-menu')) { setMenuOpenId(null); setMenuPos(null); }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpenId]);

  const handleReorder = async (draggedId: number, insertBeforeId: number | null, group: RowRecord[]) => {
    const without = group.filter((r) => r.id !== draggedId);
    const dragged = group.find((r) => r.id === draggedId);
    if (!dragged) return;
    const list = [...without];
    const idx  = insertBeforeId === null ? list.length : list.findIndex((r) => r.id === insertBeforeId);
    list.splice(idx === -1 ? list.length : idx, 0, dragged);
    for (const [i, r] of list.entries()) await updateLinkedRecord(r.id, { [ORDER_COL]: (i + 1) * 10 });
  };

  const handleMoveUnder = async (itemId: number, newParentId: number) => {
    const maxOrder = (childrenMap.get(newParentId) ?? []).reduce((m, r) => Math.max(m, (r[ORDER_COL] as number) || 0), 0);
    await updateLinkedRecord(itemId, { [PARENT_COL]: newParentId, [ORDER_COL]: maxOrder + 10 });
    setExpanded(newParentId, true);
  };

  const handleMoveToRoot = async (itemId: number) => {
    const maxOrder = rootItems.reduce((m, r) => Math.max(m, (r[ORDER_COL] as number) || 0), 0);
    await updateLinkedRecord(itemId, { [PARENT_COL]: 0, [ORDER_COL]: maxOrder + 10 });
  };

  const handleMoveBefore = async (draggedId: number, targetItem: RowRecord, targetGroup: RowRecord[]) => {
    const newParentId = Number(targetItem[PARENT_COL]) || 0;
    const without = targetGroup.filter((r) => r.id !== draggedId);
    const list = [...without];
    list.splice(without.findIndex((r) => r.id === targetItem.id), 0, { id: draggedId } as RowRecord);
    await updateLinkedRecord(draggedId, { [PARENT_COL]: newParentId });
    for (const [i, r] of list.entries()) await updateLinkedRecord(r.id, { [ORDER_COL]: (i + 1) * 10 });
  };

  // ── Stable drag / drop callbacks ────────────────────────────────────────────
  // handlersRef lets the stable useCallback closures always call the latest version
  // of handlers that depend on frequently-changing derived data (rootItems, childrenMap…)

  const handlersRef = useRef({ handleReorder, handleMoveBefore, handleMoveUnder, handleMoveToRoot, getGroup });
  handlersRef.current = { handleReorder, handleMoveBefore, handleMoveUnder, handleMoveToRoot, getGroup };

  const clearDrag = useCallback(() => {
    draggingIdRef.current = null;
    setDraggingId(null); setDropBeforeId(null); setDropGroup(null); setFolderDropTarget(null);
  }, []);

  const handleDragStart = useCallback((e: React.DragEvent, id: number) => {
    e.dataTransfer.effectAllowed = 'move';
    draggingIdRef.current = id;
    setDraggingId(id);
  }, []);

  const handleDragOverItem = useCallback((e: React.DragEvent, item: RowRecord, _group: RowRecord[], groupKey: string) => {
    const cid = draggingIdRef.current;
    if (cid === null || cid === item.id || !allRecordsRef.current.find((r) => r.id === cid)) return;
    e.preventDefault();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    if ((e.clientY - rect.top) < rect.height / 2) {
      setDropBeforeId(item.id); setDropGroup(groupKey); setFolderDropTarget(null);
    } else {
      setFolderDropTarget(item.id); setDropBeforeId(null); setDropGroup(null);
    }
  }, []);

  const handleDropItem = useCallback((e: React.DragEvent, item: RowRecord, group: RowRecord[], groupKey: string) => {
    e.preventDefault();
    const cid = draggingIdRef.current;
    if (cid === null || cid === item.id) { clearDrag(); return; }
    const dragged = allRecordsRef.current.find((r) => r.id === cid);
    if (!dragged) { clearDrag(); return; }
    const inTopHalf = (e.clientY - (e.currentTarget as HTMLElement).getBoundingClientRect().top) < (e.currentTarget as HTMLElement).getBoundingClientRect().height / 2;
    const g = handlersRef.current.getGroup(dragged);
    if (inTopHalf) {
      if (g.key === groupKey) void handlersRef.current.handleReorder(cid, item.id, group);
      else void handlersRef.current.handleMoveBefore(cid, item, group);
    } else {
      void handlersRef.current.handleMoveUnder(cid, item.id);
    }
    clearDrag();
  }, [clearDrag]);

  const handleDragOverEnd = useCallback((e: React.DragEvent, groupKey: string, _list: RowRecord[]) => {
    const cid = draggingIdRef.current;
    if (cid === null) return;
    const dragged = allRecordsRef.current.find((r) => r.id === cid);
    if (!dragged) return;
    const g = handlersRef.current.getGroup(dragged);
    if (g.key === groupKey || (groupKey === 'root' && g.key !== 'root')) {
      e.preventDefault();
      setDropBeforeId('end'); setDropGroup(groupKey); setFolderDropTarget(null);
    }
  }, []);

  const handleDropEnd = useCallback((e: React.DragEvent, groupKey: string, list: RowRecord[]) => {
    e.preventDefault();
    const cid = draggingIdRef.current;
    if (cid === null) { clearDrag(); return; }
    const dragged = allRecordsRef.current.find((r) => r.id === cid);
    if (!dragged) { clearDrag(); return; }
    const g = handlersRef.current.getGroup(dragged);
    if (g.key === groupKey)       void handlersRef.current.handleReorder(cid, null, list);
    else if (groupKey === 'root') void handlersRef.current.handleMoveToRoot(cid);
    clearDrag();
  }, [clearDrag]);

  const handleExpandToggle = useCallback((id: number) => {
    setExpanded(id, !expandedFolders.has(id));
  }, [setExpanded, expandedFolders]);

  const handleMenuOpen  = useCallback((id: number, pos: { top: number; left: number }) => { setMenuOpenId(id); setMenuPos(pos); }, []);
  const handleMenuClose = useCallback(() => { setMenuOpenId(null); setMenuPos(null); }, []);

  // ── Nav tree context objects ────────────────────────────────────────────────

  const ts: NavTreeState = {
    selectedId, expandedFolders, draggingId,
    dropBeforeId, dropGroup, folderDropTarget,
    menuOpenId, menuPos, treeChildren,
  };

  const th: NavTreeHandlers = {
    onSelect:       (id) => void handleSelect(id),
    onNewNote:      (parentId) => void handleNewNote(parentId),
    onExpandToggle: handleExpandToggle,
    onDragStart:    handleDragStart,
    onDragEnd:      clearDrag,
    onDragOverItem: handleDragOverItem,
    onDropItem:     handleDropItem,
    onDragOverEnd:  handleDragOverEnd,
    onDropEnd:      handleDropEnd,
    onMenuOpen:     handleMenuOpen,
    onMenuClose:    handleMenuClose,
    onArchive:      (id) => void handleArchive(id),
  };

  // ── Render helpers ─────────────────────────────────────────────────────────

  const renderArchivedItem = (item: RowRecord, depth = 0): React.ReactNode => {
    const isActive    = selectedId === item.id;
    const isExpanded  = expandedFolders.has(item.id);
    const children    = archivedChildren(item.id);
    const hasChildren = children.length > 0;
    return (
      <React.Fragment key={item.id}>
        <div
          className={['notes__nav-item', 'notes__nav-item--no-actions', isActive ? 'notes__nav-item--active' : '', hasChildren ? 'notes__nav-item--has-children' : ''].filter(Boolean).join(' ')}
          style={depth > 0 ? { paddingLeft: `${0.75 + depth * 0.75}rem` } : undefined}
          onClick={() => void handleSelect(item.id)}
        >
          <span
            className="notes__nav-icon-wrap"
            onClick={hasChildren ? (e) => {
              e.stopPropagation();
              setExpanded(item.id, !expandedFolders.has(item.id));
            } : undefined}
          >
            {item[ICON_COL] ? (
              <span className="notes__nav-icon notes__nav-icon--note notes__nav-icon--emoji">{String(item[ICON_COL])}</span>
            ) : (
              <span className="material-icons notes__nav-icon notes__nav-icon--note">{itemIcon(String(item[TYPE_COL] ?? T_NOTE))}</span>
            )}
            {hasChildren && (
              <span className="material-icons notes__nav-icon notes__nav-icon--caret">
                {isExpanded ? 'expand_more' : 'chevron_right'}
              </span>
            )}
          </span>
          <span className="notes__nav-label">{String(item[TITLE_COL] ?? '') || 'Sans titre'}</span>
        </div>
        {hasChildren && isExpanded && children.map((child) => renderArchivedItem(child, depth + 1))}
      </React.Fragment>
    );
  };

  const renderFlatItem = (item: RowRecord, subtitle?: string) => (
    <div
      key={item.id}
      className={`notes__nav-item${selectedId === item.id ? ' notes__nav-item--active' : ''}`}
      onClick={() => void handleSelect(item.id)}
    >
      <span className="material-icons notes__nav-icon">
        {itemIcon(String(item[TYPE_COL] ?? T_NOTE))}
      </span>
      <div className="notes__nav-flat-meta">
        <span className="notes__nav-label">{String(item[TITLE_COL] ?? '') || 'Sans titre'}</span>
        {subtitle && <span className="notes__nav-subtitle">{subtitle}</span>}
      </div>
    </div>
  );

  const renderNotesContent = () => {
    if (activeView === 'daily') {
      if (dailyItems.length === 0) return <div className="notes__empty-list">Aucune note daily</div>;
      return <>{dailyItems.map((r) => renderFlatItem(r, formatDate(r[CREATED_COL])))}</>;
    }
    if (activeView === 'archive') {
      if (archivedRootItems.length === 0) return <div className="notes__empty-list">Aucun élément archivé</div>;
      return <>{archivedRootItems.map((r) => renderArchivedItem(r))}</>;
    }
    if (rootItems.length === 0) return <div className="notes__empty-list">Aucune note</div>;
    return (
      <>
        {rootItems.map((item) => (
          <NavItem key={item.id} item={item} group={rootItems} groupKey="root" ts={ts} th={th} />
        ))}
        <NavDropEnd groupKey="root" list={rootItems} ts={ts} th={th} />
      </>
    );
  };

  // ── JSX ────────────────────────────────────────────────────────────────────

  return (
    <div className="notes__root">
      {sidebarOpen && <div className="notes__nav-overlay" onClick={() => setSidebarOpen(false)} />}
      <aside className={`notes__sidebar${sidebarOpen ? ' notes__sidebar--open' : ''}`}>

        <div className="notes__notes-section">
          <div className="notes__nav-section-header">
            <span className="notes__nav-section-label">
              {STATIC_VIEWS.find((v) => v.id === activeView)?.label}
            </span>
            {activeView === 'notes' && (
              <button className="notes__nav-section-btn" onClick={() => void handleNewNote()} title="Nouvelle note">
                <span className="material-icons">add</span>
              </button>
            )}
            {activeView === 'daily' && (
              <button className="notes__nav-section-btn" onClick={() => void handleNewDaily()} title="Nouvelle daily note">
                <span className="material-icons">add</span>
              </button>
            )}
          </div>
          {renderNotesContent()}
        </div>

        <div className="notes__view-tabs">
          {STATIC_VIEWS.map((view) => (
            <button
              key={view.id}
              className={`notes__view-tab${activeView === view.id ? ' notes__view-tab--active' : ''}`}
              onClick={() => setActiveView(view.id)}
              data-tooltip={view.label}
            >
              <span className="material-icons">{view.icon}</span>
            </button>
          ))}
          <button className="notes__daily-create-btn" onClick={() => void handleNewDaily()} title="Nouvelle daily note">
            <span className="material-icons">calendar_today</span>
          </button>
        </div>

      </aside>

      <main className="notes__main">
        {saveStatus !== 'idle' && (
          <div className={`notes__save-status notes__save-status--${saveStatus}`}>
            <span className="material-icons">{saveStatus === 'saving' ? 'sync' : 'check_circle'}</span>
            {saveStatus === 'saving' ? 'Enregistrement…' : 'Enregistré'}
          </div>
        )}
        {selectedRecord ? (
          <ItemEditor
            key={selectedRecord.id}
            item={selectedRecord}
            allRecords={allRecords}
            onSaveTitle={handleSaveTitle}
            onSaveContent={handleSaveContent}
            onSaveIcon={handleSaveIcon}
            onNavigate={(id) => void handleSelect(id)}
            onOpenSidebar={() => setSidebarOpen(true)}
            focusEndKey={focusEndKey}
          />
        ) : (
          <div className="notes__no-selection">
            <button className="notes__nav-toggle notes__nav-toggle--no-selection" onClick={() => setSidebarOpen(true)} aria-label="Menu">
              <span className="material-icons">menu</span>
            </button>
            <span className="material-icons notes__no-selection-icon">edit_note</span>
            <p>Sélectionnez une note ou créez-en une nouvelle</p>
            <button className="notes__create-btn" onClick={() => void handleNewNote()}>
              <span className="material-icons">add</span>
              Nouvelle note
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
