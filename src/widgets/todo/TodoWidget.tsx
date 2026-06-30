import './todo.scss';
import React, { useEffect, useRef, useMemo, useState } from 'react';
import { flushSync } from 'react-dom';
import type { RowRecord } from 'grist-plugin-api';
import { useGrist, decodeChoiceList } from '@grist-widgets/ui';
import { useTodoData } from './useTodoData';
import { TaskItem } from './TaskItem';
import { TodoNav } from './TodoNav';
import {
  NAME_COL, DONE_COL, LISTE_COL, PROJET_COL, ORDRE_COL, SUPPRIME_COL,
  COMPLETION_COL, ETIQUETTES_COL, PRIORITE_COL, SECTIONS,
} from './types';
import type { ActiveFilter, DragTarget } from './types';

// ─── Header menu ─────────────────────────────────────────────────────────────

interface HeaderMenuProps {
  showDone: boolean;
  onToggleDone: () => void;
  onClose: () => void;
  label: string;
}

function HeaderMenu({ showDone, onToggleDone, label }: HeaderMenuProps) {
  return (
    <div className="todo-widget__header-menu">
      <div className="todo-widget__header-menu-item" onMouseDown={(e) => { e.preventDefault(); onToggleDone(); }}>
        <span className="todo-widget__header-menu-item-label">{label}</span>
        <span className={`todo-widget__toggle${showDone ? ' todo-widget__toggle--on' : ''}`} aria-hidden="true">
          <span className="todo-widget__toggle-thumb" />
        </span>
      </div>
    </div>
  );
}

// ─── Sort button ─────────────────────────────────────────────────────────────

const SORT_OPTIONS: { mode: 'manual' | 'priority' | 'name'; label: string; icon: string }[] = [
  { mode: 'manual', label: 'Manuel', icon: 'drag_indicator' },
  { mode: 'priority', label: 'Priorité', icon: 'flag' },
  { mode: 'name', label: 'Nom', icon: 'sort_by_alpha' },
];

function SortButton({ sortMode, onSort }: { sortMode: 'manual' | 'priority' | 'name'; onSort: (m: 'manual' | 'priority' | 'name') => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const current = SORT_OPTIONS.find((o) => o.mode === sortMode)!;

  return (
    <div ref={ref} className={`todo-widget__sort${open ? ' todo-widget__sort--open' : ''}`}>
      <button
        className="todo-widget__add-btn"
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        aria-label="Trier"
        title={`Tri : ${current.label}`}
      >
        <span className="material-icons">swap_vert</span>
        {sortMode !== 'manual' && <span className="todo-widget__sort-label">{current.label}</span>}
      </button>
      {open && (
        <div className="todo-widget__sort-menu">
          {SORT_OPTIONS.map((o) => (
            <button
              key={o.mode}
              className={`todo-widget__sort-option${sortMode === o.mode ? ' todo-widget__sort-option--active' : ''}`}
              onMouseDown={(e) => { e.preventDefault(); onSort(o.mode); setOpen(false); }}
            >
              <span className="material-icons">{o.icon}</span>
              {o.label}
              {sortMode === o.mode && <span className="material-icons todo-widget__sort-check">check</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main widget ──────────────────────────────────────────────────────────────

export function TodoWidget() {
  const { allRecords, updateLinkedRecord, createLinkedRecord, setCursorPos, setSelectedRows } = useGrist();
  const { records, projetChoices, projetColorMap, etiquettesChoices, initialized } = useTodoData();

  const [menuOpenId, setMenuOpenId] = useState<number | null>(null);
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>({ type: 'section', key: "Aujourd'hui" });
  const [dragTarget, setDragTarget] = useState<DragTarget>(null);
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [dropIndicatorId, setDropIndicatorId] = useState<number | 'end' | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const pendingSelectId = useRef<number | null>(null);
  const [draftActive, setDraftActive] = useState(false);
  const [draftText, setDraftText] = useState('');
  const draftRef = useRef<HTMLInputElement>(null);
  const [navOpen, setNavOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showDone, setShowDone] = useState(() => {
    const saved = localStorage.getItem('todo-show-done');
    return saved === null ? true : saved === 'true';
  });
  const [showDoneProject, setShowDoneProject] = useState(() => {
    const saved = localStorage.getItem('todo-show-done-project');
    return saved === null ? true : saved === 'true';
  });
  const [showHeaderMenu, setShowHeaderMenu] = useState(false);
  const [sortMode, setSortMode] = useState<'manual' | 'priority' | 'name'>(() => {
    return (localStorage.getItem('todo-sort-mode') as 'manual' | 'priority' | 'name') ?? 'manual';
  });
  const [projectSort, setProjectSort] = useState<'alpha' | 'count'>(() => {
    return (localStorage.getItem('todo-project-sort') as 'alpha' | 'count') ?? 'alpha';
  });

  useEffect(() => { localStorage.setItem('todo-show-done', String(showDone)); }, [showDone]);
  useEffect(() => { localStorage.setItem('todo-show-done-project', String(showDoneProject)); }, [showDoneProject]);
  useEffect(() => { localStorage.setItem('todo-sort-mode', sortMode); }, [sortMode]);
  useEffect(() => { localStorage.setItem('todo-project-sort', projectSort); }, [projectSort]);

  const headerMenuWrapRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!showHeaderMenu) return;
    const handler = (e: MouseEvent) => {
      if (headerMenuWrapRef.current && !headerMenuWrapRef.current.contains(e.target as Node)) {
        setShowHeaderMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showHeaderMenu]);

  useEffect(() => {
    if (pendingSelectId.current !== null) {
      const id = pendingSelectId.current;
      if (allRecords.some((r) => r.id === id)) {
        pendingSelectId.current = null;
        setSelectedId(id);
        void setCursorPos(id);
        void setSelectedRows([id]);
      }
    }
  }, [allRecords, setCursorPos, setSelectedRows]);

  const isAujourdhui = activeFilter.type === 'section' && activeFilter.key === "Aujourd'hui";
  const isTerminees = activeFilter.type === 'section' && activeFilter.key === 'Terminées';

  const filteredRecords = useMemo(() => {
    let base: typeof records;
    if (activeFilter.type === 'section') {
      if (activeFilter.key === 'Terminées') {
        base = records.filter((r) => Boolean(r[DONE_COL]));
      } else if (activeFilter.key === 'Boîte de réception') {
        base = records.filter((r) =>
          !Boolean(r[DONE_COL]) &&
          !String(r[PROJET_COL] ?? '') &&
          String(r[LISTE_COL] ?? '') !== "Aujourd'hui" &&
          String(r[LISTE_COL] ?? '') !== 'Prochainement',
        );
      } else {
        base = records.filter((r) => String(r[LISTE_COL] ?? '') === activeFilter.key);
      }
    } else if (activeFilter.type === 'project') {
      base = records.filter((r) => String(r[PROJET_COL] ?? '') === activeFilter.id);
    } else {
      base = records.filter((r) => decodeChoiceList(r[ETIQUETTES_COL]).includes(activeFilter.id));
    }
    let visible = base;
    if (isAujourdhui) visible = base.filter((r) => !Boolean(r[DONE_COL]));
    else if ((activeFilter.type === 'project' || activeFilter.type === 'tag') && !showDoneProject) visible = base.filter((r) => !Boolean(r[DONE_COL]));

    const isProjectOrTag = activeFilter.type === 'project' || activeFilter.type === 'tag';
    const doneFirst = (a: RowRecord, b: RowRecord) => Number(Boolean(a[DONE_COL])) - Number(Boolean(b[DONE_COL]));
    const PRIORITY_ORDER: Record<string, number> = { P1: 0, P2: 1, P3: 2 };
    const byCompletion = (a: RowRecord, b: RowRecord) =>
      ((b[COMPLETION_COL] as number) || 0) - ((a[COMPLETION_COL] as number) || 0);

    if (sortMode === 'priority') {
      return [...visible].sort((a, b) => {
        if (isProjectOrTag) { const d = doneFirst(a, b); if (d !== 0) return d; }
        const pa = PRIORITY_ORDER[String(a[PRIORITE_COL] ?? '')] ?? 99;
        const pb = PRIORITY_ORDER[String(b[PRIORITE_COL] ?? '')] ?? 99;
        return pa !== pb ? pa - pb : isTerminees
          ? byCompletion(a, b)
          : ((a[ORDRE_COL] as number) || 0) - ((b[ORDRE_COL] as number) || 0);
      });
    }
    if (sortMode === 'name') {
      return [...visible].sort((a, b) => {
        if (isProjectOrTag) { const d = doneFirst(a, b); if (d !== 0) return d; }
        return String(a[NAME_COL] ?? '').localeCompare(String(b[NAME_COL] ?? ''), 'fr');
      });
    }
    return [...visible].sort((a, b) => {
      if (isProjectOrTag) { const d = doneFirst(a, b); if (d !== 0) return d; }
      return isTerminees
        ? byCompletion(a, b)
        : ((a[ORDRE_COL] as number) || 0) - ((b[ORDRE_COL] as number) || 0);
    });
  }, [records, activeFilter, isAujourdhui, isTerminees, showDoneProject, sortMode]);

  const doneRecords = useMemo(() => {
    if (!isAujourdhui) return [];
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayTs = todayStart.getTime() / 1000;
    const done = records.filter((r) => {
      if (!Boolean(r[DONE_COL])) return false;
      const completedTs = r[COMPLETION_COL] as number | null;
      return completedTs != null && completedTs >= todayTs;
    });
    const PRIORITY_ORDER: Record<string, number> = { P1: 0, P2: 1, P3: 2 };
    if (sortMode === 'priority') {
      return [...done].sort((a, b) => {
        const pa = PRIORITY_ORDER[String(a[PRIORITE_COL] ?? '')] ?? 99;
        const pb = PRIORITY_ORDER[String(b[PRIORITE_COL] ?? '')] ?? 99;
        return pa !== pb ? pa - pb : ((b[COMPLETION_COL] as number) || 0) - ((a[COMPLETION_COL] as number) || 0);
      });
    }
    if (sortMode === 'name') {
      return [...done].sort((a, b) => String(a[NAME_COL] ?? '').localeCompare(String(b[NAME_COL] ?? ''), 'fr'));
    }
    return [...done].sort((a, b) => ((b[COMPLETION_COL] as number) || 0) - ((a[COMPLETION_COL] as number) || 0));
  }, [records, isAujourdhui, sortMode]);

  const handleToggle = async (id: number, done: boolean) => {
    const now = done ? Math.floor(Date.now() / 1000) : null;
    const fields: Record<string, unknown> = { [DONE_COL]: done, [COMPLETION_COL]: now };
    if (done) fields[LISTE_COL] = '';
    await updateLinkedRecord(id, fields);
  };

  const handleDelete = async (id: number) => {
    await updateLinkedRecord(id, { [SUPPRIME_COL]: true });
  };

  const handleAddTask = () => {
    flushSync(() => {
      setDraftActive(true);
      setDraftText('');
    });
    draftRef.current?.focus();
  };

  const handleDraftSave = async () => {
    const text = draftText.trim() || 'Nouvelle tâche';
    setDraftActive(false);
    setDraftText('');
    const maxOrder = filteredRecords.reduce((max, r) => Math.max(max, (r[ORDRE_COL] as number) || 0), 0);
    const fields: Record<string, unknown> = { [NAME_COL]: text, [ORDRE_COL]: maxOrder + 10 };
    if (activeFilter.type === 'section') fields[LISTE_COL] = activeFilter.key === 'Boîte de réception' ? '' : activeFilter.key;
    else if (activeFilter.type === 'project') { fields[PROJET_COL] = activeFilter.id; fields[LISTE_COL] = ''; }
    else if (activeFilter.type === 'tag') { fields[LISTE_COL] = ''; fields[ETIQUETTES_COL] = ['L', activeFilter.id]; }
    const id = await createLinkedRecord(fields);
    if (id) pendingSelectId.current = id;
  };

  const handleDraftCancel = () => {
    setDraftActive(false);
    setDraftText('');
  };

  const startEdit = (id: number) => setEditingId(id);

  const saveEdit = async (id: number, text: string) => {
    setEditingId(null);
    await updateLinkedRecord(id, { [NAME_COL]: text || 'Nouvelle tâche' });
  };

  const cancelEdit = () => setEditingId(null);

  const handleReorder = async (draggedId: number, insertBeforeId: number | null, list: RowRecord[]) => {
    const withoutDragged = list.filter((r) => r.id !== draggedId);
    const dragged = list.find((r) => r.id === draggedId);
    if (!dragged) return;
    const newList = [...withoutDragged];
    const insertIdx = insertBeforeId === null ? newList.length : newList.findIndex((r) => r.id === insertBeforeId);
    newList.splice(insertIdx === -1 ? newList.length : insertIdx, 0, dragged);
    await Promise.all(newList.map((r, i) => updateLinkedRecord(r.id, { [ORDRE_COL]: (i + 1) * 10 })));
  };

  const handleDragStart = (id: number) => setDraggingId(id);
  const handleDragEnd = () => { setDraggingId(null); setDragTarget(null); setDropIndicatorId(null); };

  const handleDrop = async (target: DragTarget) => {
    if (draggingId == null || !target) return;
    if (target.type === 'section') {
      const fields: Record<string, unknown> = { [LISTE_COL]: target.key === 'Boîte de réception' ? '' : target.key };
      if (target.key === 'Boîte de réception') fields[PROJET_COL] = '';
      await updateLinkedRecord(draggingId, fields);
    } else {
      await updateLinkedRecord(draggingId, { [PROJET_COL]: target.id });
    }
    setDraggingId(null);
    setDragTarget(null);
  };

  const navCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const section of SECTIONS) {
      if (section.key === 'Terminées') {
        counts[`section:${section.key}`] = records.filter((r) => Boolean(r[DONE_COL])).length;
      } else if (section.key === 'Boîte de réception') {
        counts[`section:${section.key}`] = records.filter(
          (r) => !Boolean(r[DONE_COL]) &&
          !String(r[PROJET_COL] ?? '') &&
          String(r[LISTE_COL] ?? '') !== "Aujourd'hui" &&
          String(r[LISTE_COL] ?? '') !== 'Prochainement',
        ).length;
      } else {
        counts[`section:${section.key}`] = records.filter(
          (r) => !Boolean(r[DONE_COL]) && String(r[LISTE_COL] ?? '') === section.key,
        ).length;
      }
    }
    for (const name of projetChoices) {
      counts[`project:${name}`] = records.filter(
        (r) => !Boolean(r[DONE_COL]) && String(r[PROJET_COL] ?? '') === name,
      ).length;
    }
    for (const tag of etiquettesChoices) {
      counts[`tag:${tag}`] = records.filter(
        (r) => !Boolean(r[DONE_COL]) && decodeChoiceList(r[ETIQUETTES_COL]).includes(tag),
      ).length;
    }
    return counts;
  }, [records, projetChoices, etiquettesChoices]);

  const usedProjets = useMemo(
    () => new Set(records.map((r) => String(r[PROJET_COL] ?? '')).filter(Boolean)),
    [records],
  );

  const projetEntries = useMemo(() => {
    const filtered = projetChoices.filter((name) => usedProjets.has(name));
    if (projectSort === 'count') {
      return [...filtered].sort((a, b) => (navCounts[`project:${b}`] ?? 0) - (navCounts[`project:${a}`] ?? 0));
    }
    return [...filtered].sort((a, b) => a.localeCompare(b, 'fr'));
  }, [projetChoices, usedProjets, projectSort, navCounts]);

  const activeLabel =
    activeFilter.type === 'section'
      ? (SECTIONS.find((s) => s.key === activeFilter.key)?.label ?? activeFilter.key)
      : activeFilter.label;

  const renderList = (list: RowRecord[], allowReorder = false) => (
    <>
      <ul className="todo-widget__list">
        {list.map((record, idx) => (
          <TaskItem
            key={record.id}
            record={record}
            isDragging={draggingId === record.id}
            isSelected={selectedId === record.id}
            isDropBefore={allowReorder && dropIndicatorId === record.id}
            isMenuOpen={menuOpenId === record.id}
            isEditing={editingId === record.id}
            allowReorder={allowReorder}
            draggingId={draggingId}
            nextItemId={idx + 1 < list.length ? list[idx + 1].id : 'end'}
            projetColorMap={projetColorMap}
            activeFilter={activeFilter}
            onToggle={(done) => handleToggle(record.id, done)}
            onDelete={() => handleDelete(record.id)}
            onSelect={() => { setSelectedId(record.id); void setCursorPos(record.id); void setSelectedRows([record.id]); }}
            onStartEdit={() => startEdit(record.id)}
            onSaveEdit={(text) => saveEdit(record.id, text)}
            onCancelEdit={cancelEdit}
            onDragStart={() => handleDragStart(record.id)}
            onDragEnd={handleDragEnd}
            onSetDropIndicator={setDropIndicatorId}
            onClearDragTarget={() => setDragTarget(null)}
            onDrop={() => {
              if (draggingId != null && dropIndicatorId != null) {
                handleReorder(draggingId, dropIndicatorId === 'end' ? null : dropIndicatorId as number, list);
              }
              setDropIndicatorId(null);
              setDraggingId(null);
              setDragTarget(null);
            }}
            onFilterByTag={(tag) => setActiveFilter({ type: 'tag', id: tag, label: tag })}
            onFilterByProject={(name) => setActiveFilter({ type: 'project', id: name, label: name })}
            onMenuOpen={() => setMenuOpenId(record.id)}
            onMenuClose={() => setMenuOpenId(null)}
          />
        ))}
      </ul>
      {allowReorder && (
        <div
          className={`todo-widget__list-end${dropIndicatorId === 'end' ? ' todo-widget__list-end--active' : ''}`}
          onDragOver={(e) => { e.preventDefault(); if (draggingId === null) return; setDropIndicatorId('end'); setDragTarget(null); }}
          onDrop={(e) => {
            e.preventDefault();
            if (draggingId != null) handleReorder(draggingId, null, list);
            setDropIndicatorId(null);
            setDraggingId(null);
            setDragTarget(null);
          }}
        />
      )}
    </>
  );

  return (
    <div className="todo-widget__root">
      {navOpen && <div className="todo-widget__nav-overlay" onClick={() => setNavOpen(false)} />}
      <TodoNav
        navOpen={navOpen}
        onNavClose={() => setNavOpen(false)}
        activeFilter={activeFilter}
        onFilterChange={setActiveFilter}
        draggingId={draggingId}
        dragTarget={dragTarget}
        onDragTarget={setDragTarget}
        onClearDropIndicator={() => setDropIndicatorId(null)}
        projetEntries={projetEntries}
        projetColorMap={projetColorMap}
        navCounts={navCounts}
        onDrop={handleDrop}
        projectSort={projectSort}
        onProjectSort={setProjectSort}
      />

      <div className="todo-widget__main" onClick={() => { setSelectedId(null); setSelectedRows([]); }}>
        <div className="todo-widget__header">
          <button className="todo-widget__nav-toggle" onClick={(e) => { e.stopPropagation(); setNavOpen((v) => !v); }} aria-label="Menu">
            <span className="material-icons">menu</span>
          </button>
          <h1 className="todo-widget__title">
            {activeFilter.type === 'section' ? (
              <span className="material-icons todo-widget__title-icon">
                {SECTIONS.find((s) => s.key === activeFilter.key)?.icon}
              </span>
            ) : activeFilter.type === 'tag' ? (
              <span className="material-icons todo-widget__title-icon todo-widget__title-icon--tag">sell</span>
            ) : (
              <span
                className="todo-widget__title-dot"
                style={projetColorMap.get(activeLabel)
                  ? { backgroundColor: projetColorMap.get(activeLabel)!.fill, boxShadow: `0 0 0 2px ${projetColorMap.get(activeLabel)!.text}60` }
                  : undefined}
              />
            )}
            <span className="todo-widget__title-label">{activeLabel}</span>
          </h1>
          <div className="todo-widget__header-actions">
            <SortButton sortMode={sortMode} onSort={setSortMode} />
            {(isAujourdhui || activeFilter.type === 'project' || activeFilter.type === 'tag') && (
              <div ref={headerMenuWrapRef} className="todo-widget__header-menu-wrap">
                <button
                  className="todo-widget__add-btn"
                  onClick={(e) => { e.stopPropagation(); setShowHeaderMenu((v) => !v); }}
                  aria-label="Options"
                >
                  <span className="material-icons">more_horiz</span>
                </button>
                {showHeaderMenu && (
                  <HeaderMenu
                    showDone={isAujourdhui ? showDone : showDoneProject}
                    onToggleDone={isAujourdhui ? () => setShowDone((v) => !v) : () => setShowDoneProject((v) => !v)}
                    onClose={() => setShowHeaderMenu(false)}
                    label={isAujourdhui ? "Afficher les tâches terminées aujourd'hui" : 'Afficher les tâches terminées'}
                  />
                )}
              </div>
            )}
          </div>
        </div>

        {!initialized ? (
          <ul className="todo-widget__list">
            {[60, 45, 75, 50, 65].map((w, i) => (
              <li key={i} className="todo-widget__skeleton-item">
                <span className="todo-widget__skeleton-checkbox" />
                <span className="todo-widget__skeleton-line" style={{ width: `${w}%` }} />
              </li>
            ))}
          </ul>
        ) : (() => {
          const visibleList = isAujourdhui && showDone ? [...filteredRecords, ...doneRecords] : filteredRecords;
          if (visibleList.length === 0 && !draftActive) {
            return (
              <div className="todo-widget__empty">
                <span className="material-icons todo-widget__empty-icon">check_circle</span>
                <p className="todo-widget__empty-text">{isTerminees ? 'Aucune tâche terminée' : 'Aucune tâche'}</p>
                {!isTerminees && (
                  <button className="todo-widget__empty-btn" onClick={() => { handleAddTask(); }}>
                    <span className="material-icons">add</span>
                    Ajouter une tâche
                  </button>
                )}
              </div>
            );
          }
          return (
            <>
              {renderList(visibleList, !isTerminees && sortMode === 'manual')}
              {draftActive && (
                <ul className="todo-widget__list">
                  <li className="todo-widget__item">
                    <button className="todo-widget__checkbox" disabled aria-hidden="true" />
                    <input
                      ref={draftRef}
                      type="text"
                      className="todo-widget__draft-name"
                      value={draftText}
                      placeholder="Nouvelle tâche..."
                      onChange={(e) => setDraftText(e.target.value)}
                      onBlur={() => { void handleDraftSave(); }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') { e.preventDefault(); void handleDraftSave(); }
                        if (e.key === 'Escape') { e.preventDefault(); handleDraftCancel(); }
                      }}
                    />
                  </li>
                </ul>
              )}
            </>
          );
        })()}

        {initialized && !draftActive && !isTerminees && (isAujourdhui && showDone ? [...filteredRecords, ...doneRecords] : filteredRecords).length > 0 && (
          <button className="todo-widget__add-task-btn" onClick={(e) => { e.stopPropagation(); handleAddTask(); }}>
            <span className="material-icons">add</span>
            Ajouter une tâche
          </button>
        )}
      </div>
    </div>
  );
}
