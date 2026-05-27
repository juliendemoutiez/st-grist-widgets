import './todo.scss';
import React, { useEffect, useLayoutEffect, useRef, useMemo, useState } from 'react';
import type { RowRecord } from 'grist-plugin-api';
import { useGrist } from '@grist-widgets/ui';

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

// ─── Dropdown menu ────────────────────────────────────────────────────────────

interface DropdownMenuProps {
  onDelete: () => void;
  onClose: () => void;
}

function DropdownMenu({ onDelete, onClose }: DropdownMenuProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  return (
    <div ref={ref} className="todo-widget__dropdown">
      <button
        className="todo-widget__dropdown-item todo-widget__dropdown-item--danger"
        onMouseDown={(e) => { e.preventDefault(); onDelete(); onClose(); }}
      >
        <span className="material-icons">delete</span>
        Supprimer
      </button>
    </div>
  );
}

// ─── Task name span ───────────────────────────────────────────────────────────

function caretRangeAt(x: number, y: number): Range | null {
  const doc = document as Document & {
    caretRangeFromPoint?: (x: number, y: number) => Range | null;
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
  };
  if (doc.caretRangeFromPoint) return doc.caretRangeFromPoint(x, y);
  if (doc.caretPositionFromPoint) {
    const pos = doc.caretPositionFromPoint(x, y);
    if (pos) {
      const r = document.createRange();
      r.setStart(pos.offsetNode, pos.offset);
      r.collapse(true);
      return r;
    }
  }
  return null;
}

interface TaskNameSpanProps {
  name: string;
  isDone: boolean;
  isEditing: boolean;
  onStartEdit: () => void;
  onSave: (text: string) => void;
  onCancel: () => void;
}

function TaskNameSpan({ name, isDone, isEditing, onStartEdit, onSave, onCancel }: TaskNameSpanProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const clickPosRef = useRef<{ x: number; y: number } | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !isEditing) return;
    if (!el.textContent) el.textContent = name;
    el.focus();
    const pos = clickPosRef.current;
    clickPosRef.current = null;
    if (pos) {
      const r = caretRangeAt(pos.x, pos.y);
      if (r) { window.getSelection()?.removeAllRanges(); window.getSelection()?.addRange(r); return; }
    }
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    window.getSelection()?.removeAllRanges();
    window.getSelection()?.addRange(range);
  }, [isEditing]);

  return (
    <span
      ref={ref}
      contentEditable={isEditing || undefined}
      suppressContentEditableWarning
      data-placeholder={isEditing ? 'Nouvelle tâche...' : undefined}
      className={['todo-widget__name', isDone ? 'todo-widget__name--done' : '', isEditing ? 'todo-widget__name--editing' : ''].filter(Boolean).join(' ')}
      onClick={(e) => {
        if (!isEditing) { clickPosRef.current = { x: e.clientX, y: e.clientY }; onStartEdit(); }
      }}
      onBlur={isEditing ? () => onSave(ref.current?.textContent?.trim() ?? '') : undefined}
      onKeyDown={isEditing ? (e) => {
        if (e.key === 'Enter') { e.preventDefault(); ref.current?.blur(); }
        if (e.key === 'Escape') { e.stopPropagation(); if (ref.current) ref.current.textContent = name; onCancel(); }
      } : undefined}
    >
      {isEditing ? null : name}
    </span>
  );
}

const NAME_COL = 'Nom';
const DONE_COL = 'Terminee';
const DUE_COL = 'Date_d_echeance';
const PROJET_COL = 'Projet';
const LISTE_COL = 'Liste';
const SUPPRIME_COL = 'Supprimee';
const ORDRE_COL = 'Ordre';
const COMPLETION_COL = 'Terminee_le';
const SUBTASKS_COL = 'Sous_taches';
const ETIQUETTES_COL = 'Etiquettes';
const PRIORITE_COL = 'Priorite';

function parseSubtasks(raw: unknown): { text: string; done: boolean }[] {
  try {
    const parsed = JSON.parse(typeof raw === 'string' ? raw : '[]');
    if (Array.isArray(parsed)) return parsed;
  } catch {}
  return [];
}

function decodeChoiceList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const arr = raw as unknown[];
  if (arr.length > 0 && arr[0] === 'L') return arr.slice(1).map(String);
  return arr.map(String);
}

// ─── Sections ─────────────────────────────────────────────────────────────────

const SECTIONS = [
  { key: 'Boîte de réception', label: 'Boîte de réception', icon: 'inbox' },
  { key: "Aujourd'hui", label: "Aujourd'hui", icon: 'today' },
  { key: 'Prochainement', label: 'Prochainement', icon: 'schedule' },
  { key: 'Terminées', label: 'Terminées', icon: 'check_circle' },
] as const;

type SectionKey = typeof SECTIONS[number]['key'];

type ActiveFilter =
  | { type: 'section'; key: SectionKey }
  | { type: 'project'; id: string; label: string }
  | { type: 'tag'; id: string; label: string };

type DragTarget =
  | { type: 'section'; key: SectionKey }
  | { type: 'project'; id: string }
  | null;

interface ProjetColor { fill: string; text: string }

// ─── Date helpers ─────────────────────────────────────────────────────────────

function parseDueDate(value: unknown): Date | null {
  if (value == null || value === 0 || value === '') return null;
  if (typeof value === 'number') return new Date(value * 1000);
  if (typeof value === 'string') {
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function formatDate(d: Date): string {
  return d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
}

type DueStatus = 'overdue' | 'soon' | 'ok';

function dueStatus(d: Date): DueStatus {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(d);
  target.setHours(0, 0, 0, 0);
  const diffDays = (target.getTime() - today.getTime()) / 86_400_000;
  if (diffDays < 0) return 'overdue';
  if (diffDays <= 3) return 'soon';
  return 'ok';
}

// ─── Main widget ──────────────────────────────────────────────────────────────

export function TodoWidget() {
  const { dataVersion, allRecords, updateLinkedRecord, createLinkedRecord, setCursorPos, setSelectedRows, fetchTable, fetchCurrentTable } = useGrist();
  const [records, setRecords] = useState<RowRecord[]>([]);
  const [projetChoices, setProjetChoices] = useState<string[]>([]);
  const [projetColorMap, setProjetColorMap] = useState<Map<string, ProjetColor>>(new Map());
  const [etiquettesChoices, setEtiquettesChoices] = useState<string[]>([]);
  const [etiquettesColorMap, setEtiquettesColorMap] = useState<Map<string, ProjetColor>>(new Map());
  const [menuOpenId, setMenuOpenId] = useState<number | null>(null);
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>({ type: 'section', key: "Aujourd'hui" });
  const [dragTarget, setDragTarget] = useState<DragTarget>(null);
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [dropIndicatorId, setDropIndicatorId] = useState<number | 'end' | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const pendingSelectId = useRef<number | null>(null);
  const pendingEditId = useRef<number | null>(null);
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

  useEffect(() => {
    localStorage.setItem('todo-show-done', String(showDone));
  }, [showDone]);

  useEffect(() => {
    localStorage.setItem('todo-show-done-project', String(showDoneProject));
  }, [showDoneProject]);

  useEffect(() => {
    localStorage.setItem('todo-sort-mode', sortMode);
  }, [sortMode]);

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
  const headerMenuWrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchCurrentTable().then((rows) => {
      setRecords(rows.filter((r) => !r[SUPPRIME_COL]));
    }).catch(() => {});
  }, [dataVersion, fetchCurrentTable]);

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
    if (pendingEditId.current !== null) {
      const id = pendingEditId.current;
      if (records.some((r) => r.id === id)) {
        pendingEditId.current = null;
        setEditingId(id);
      }
    }
  }, [allRecords, records, setCursorPos, setSelectedRows]);

  useEffect(() => {
    fetchTable('_grist_Tables_column').then((table) => {
      const colIds = table.colId as string[];
      const widgetOptionsList = table.widgetOptions as string[];

      const buildColorMap = (colId: string) => {
        const idx = colIds.indexOf(colId);
        if (idx === -1) return new Map<string, ProjetColor>();
        try {
          const opts = JSON.parse(widgetOptionsList[idx] ?? '{}');
          const map = new Map<string, ProjetColor>();
          for (const [choice, style] of Object.entries(opts.choiceOptions ?? {})) {
            const s = style as { fillColor?: string; textColor?: string };
            if (s.fillColor) map.set(choice, { fill: s.fillColor, text: s.textColor ?? '#000' });
          }
          return map;
        } catch { return new Map<string, ProjetColor>(); }
      };

      const projetIdx = colIds.indexOf(PROJET_COL);
      if (projetIdx !== -1) {
        try {
          const opts = JSON.parse(widgetOptionsList[projetIdx] ?? '{}');
          setProjetChoices((opts.choices as string[]) ?? []);
        } catch {}
      }
      setProjetColorMap(buildColorMap(PROJET_COL));

      const etiqIdx = colIds.indexOf(ETIQUETTES_COL);
      if (etiqIdx !== -1) {
        try {
          const opts = JSON.parse(widgetOptionsList[etiqIdx] ?? '{}');
          setEtiquettesChoices((opts.choices as string[]) ?? []);
        } catch {}
      }
      setEtiquettesColorMap(buildColorMap(ETIQUETTES_COL));
    }).catch(() => {});
  }, [fetchTable, dataVersion]);

  const isAujourdhui = activeFilter.type === 'section' && activeFilter.key === "Aujourd'hui";
  const isTerminees = activeFilter.type === 'section' && activeFilter.key === 'Terminées';

  const filteredRecords = useMemo(() => {
    let base: typeof records;
    if (activeFilter.type === 'section') {
      if (activeFilter.key === 'Terminées') {
        base = records.filter((r) => Boolean(r[DONE_COL]));
      } else {
        base = records.filter((r) =>
          String(r[LISTE_COL] ?? '') === activeFilter.key &&
          (activeFilter.key !== 'Boîte de réception' || !String(r[PROJET_COL] ?? '')),
        );
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

  const handleAddTask = async () => {
    const maxOrder = filteredRecords.reduce((max, r) => Math.max(max, (r[ORDRE_COL] as number) || 0), 0);
    const fields: Record<string, unknown> = { [NAME_COL]: '', [ORDRE_COL]: maxOrder + 10 };
    if (activeFilter.type === 'section') fields[LISTE_COL] = activeFilter.key;
    else if (activeFilter.type === 'project') { fields[PROJET_COL] = activeFilter.id; fields[LISTE_COL] = 'Boîte de réception'; }
    else if (activeFilter.type === 'tag') { fields[LISTE_COL] = 'Boîte de réception'; fields[ETIQUETTES_COL] = ['L', activeFilter.id]; }
    const id = await createLinkedRecord(fields);
    if (id) { pendingSelectId.current = id; pendingEditId.current = id; }
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
      const fields: Record<string, unknown> = { [LISTE_COL]: target.key };
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
      } else {
        counts[`section:${section.key}`] = records.filter(
          (r) => !Boolean(r[DONE_COL]) &&
          String(r[LISTE_COL] ?? '') === section.key &&
          (section.key !== 'Boîte de réception' || !String(r[PROJET_COL] ?? '')),
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

  const projetEntries = useMemo(
    () => projetChoices.filter((name) => usedProjets.has(name)).sort((a, b) => a.localeCompare(b, 'fr')),
    [projetChoices, usedProjets],
  );

  const usedEtiquettes = useMemo(
    () => new Set(records.flatMap((r) => decodeChoiceList(r[ETIQUETTES_COL]))),
    [records],
  );

  const etiquetteEntries = useMemo(
    () => etiquettesChoices.filter((t) => usedEtiquettes.has(t)).sort((a, b) => a.localeCompare(b, 'fr')),
    [etiquettesChoices, usedEtiquettes],
  );

  const activeLabel =
    activeFilter.type === 'section'
      ? (SECTIONS.find((s) => s.key === activeFilter.key)?.label ?? activeFilter.key)
      : activeFilter.label;

  const isTagActive = (id: string) => activeFilter.type === 'tag' && activeFilter.id === id;


  const renderList = (list: RowRecord[], allowReorder = false) => (
    <>
    <ul className="todo-widget__list">
      {list.map((record, idx) => {
        const isDone = Boolean(record[DONE_COL]);
        const dueDate = parseDueDate(record[DUE_COL]);
        const projetName = String(record[PROJET_COL] ?? '');
        const projetColor = projetColorMap.get(projetName);
        const name = String(record[NAME_COL] ?? '');
        const status = dueDate ? dueStatus(dueDate) : null;
        const subtasks = parseSubtasks(record[SUBTASKS_COL]);
        const subtasksDone = subtasks.filter((t) => t.done).length;
        const tags = decodeChoiceList(record[ETIQUETTES_COL]);
        const priority = record[PRIORITE_COL] ? String(record[PRIORITE_COL]) : null;
        const PRIORITY_DEFAULTS: Record<string, string> = { P1: '#ef4444', P2: '#f97316', P3: '#3b82f6' };
        const priorityColor = priority ? (PRIORITY_DEFAULTS[priority] ?? null) : null;
        const isNew = editingId === record.id && name === '';

        return (
          <li
            key={record.id}
            className={[
              'todo-widget__item',
              draggingId === record.id ? 'todo-widget__item--dragging' : '',
              selectedId === record.id ? 'todo-widget__item--selected' : '',
              allowReorder && dropIndicatorId === record.id ? 'todo-widget__item--drop-before' : '',
              menuOpenId === record.id ? 'todo-widget__item--menu-open' : '',
            ].filter(Boolean).join(' ')}
            draggable={editingId !== record.id}
            onDragStart={() => handleDragStart(record.id)}
            onDragEnd={handleDragEnd}
            onDragOver={allowReorder ? (e) => {
              e.preventDefault();
              e.stopPropagation();
              if (draggingId === null || draggingId === record.id) return;
              const rect = e.currentTarget.getBoundingClientRect();
              const nextId = idx + 1 < list.length ? list[idx + 1].id : 'end';
              setDropIndicatorId(e.clientY < rect.top + rect.height / 2 ? record.id : nextId);
              setDragTarget(null);
            } : undefined}
            onDrop={allowReorder ? (e) => {
              e.preventDefault();
              e.stopPropagation();
              if (draggingId != null && dropIndicatorId != null) {
                handleReorder(draggingId, dropIndicatorId === 'end' ? null : dropIndicatorId as number, list);
              }
              setDropIndicatorId(null);
              setDraggingId(null);
              setDragTarget(null);
            } : undefined}
            onMouseDown={isNew ? (e) => e.preventDefault() : undefined}
            onClick={isNew ? (e) => e.stopPropagation() : (e) => { e.stopPropagation(); setSelectedId(record.id); setCursorPos(record.id); setSelectedRows([record.id]); }}
          >
            {!isNew && (
              <span className="todo-widget__drag-handle" aria-hidden="true">
                <span className="material-icons">drag_indicator</span>
              </span>
            )}

            <button
              className={`todo-widget__checkbox${isDone ? ' todo-widget__checkbox--checked' : ''}`}
              style={priority && !isDone && priorityColor ? { backgroundColor: `${priorityColor}18`, borderColor: priorityColor } : undefined}
              disabled={editingId === record.id && name === ''}
              onClick={(e) => { e.stopPropagation(); handleToggle(record.id, !isDone); }}
              aria-label={isDone ? 'Marquer comme non terminé' : 'Marquer comme terminé'}
            >
              <span className="material-icons todo-widget__checkbox-check">check</span>
              {priority && (
                <span className="material-icons todo-widget__checkbox-flag" style={priorityColor ? { color: priorityColor } : undefined}>flag</span>
              )}
            </button>

            <div className="todo-widget__content">
              <div className="todo-widget__name-row">
                <TaskNameSpan
                  name={name}
                  isDone={isDone}
                  isEditing={editingId === record.id}
                  onStartEdit={() => startEdit(record.id)}
                  onSave={(text) => saveEdit(record.id, text)}
                  onCancel={cancelEdit}
                />
              </div>
              <div className="todo-widget__meta">
                <div className="todo-widget__meta-left">
                  {dueDate && (
                    <div className={`todo-widget__due${isDone ? ' todo-widget__due--done' : status ? ` todo-widget__due--${status}` : ''}`}>
                      <span className="material-icons">calendar_today</span>
                      {formatDate(dueDate)}
                    </div>
                  )}
                  {tags.length > 0 && (
                    <div className="todo-widget__tags">
                      <span className="material-icons">sell</span>
                      <span className="todo-widget__tags-text">
                        {tags.map((tag, i) => (
                          <React.Fragment key={tag}>
                            <span
                              className="todo-widget__tag-link"
                              onClick={(e) => { e.stopPropagation(); setActiveFilter({ type: 'tag', id: tag, label: tag }); }}
                            >{tag}</span>
                            {i < tags.length - 1 && ', '}
                          </React.Fragment>
                        ))}
                      </span>
                    </div>
                  )}
                  {subtasks.length > 0 && (
                    <div className={`todo-widget__subtasks-badge${subtasksDone === subtasks.length ? ' todo-widget__subtasks-badge--done' : ''}`}>
                      <span className="material-icons">checklist</span>
                      <span>{subtasksDone}/{subtasks.length}</span>
                    </div>
                  )}
                </div>
                {projetName && (
                  <span
                    className="todo-widget__projet-chip"
                    style={projetColor ? { backgroundColor: projetColor.fill, color: projetColor.text } : undefined}
                    onClick={(e) => { e.stopPropagation(); setActiveFilter({ type: 'project', id: projetName, label: projetName }); }}
                  >{projetName}</span>
                )}
              </div>
            </div>

            {!isNew && (
              <div className="todo-widget__side">
                <div className="todo-widget__actions">
                  <div className="todo-widget__menu-wrap">
                    <button
                      className="todo-widget__action-btn"
                      onClick={(e) => { e.stopPropagation(); setMenuOpenId(menuOpenId === record.id ? null : record.id); }}
                      aria-label="Plus d'options"
                    >
                      <span className="material-icons">more_horiz</span>
                    </button>
                    {menuOpenId === record.id && (
                      <DropdownMenu
                        onDelete={() => handleDelete(record.id)}
                        onClose={() => setMenuOpenId(null)}
                      />
                    )}
                  </div>
                </div>
              </div>
            )}
          </li>
        );
      })}
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

  const isSectionActive = (key: SectionKey) =>
    activeFilter.type === 'section' && activeFilter.key === key;

  const isDragOverSection = (key: SectionKey) =>
    dragTarget?.type === 'section' && dragTarget.key === key;

  const isProjectActive = (id: string) =>
    activeFilter.type === 'project' && activeFilter.id === id;

  const isDragOverProject = (id: string) =>
    dragTarget?.type === 'project' && dragTarget.id === id;

  return (
    <div className="todo-widget__root">
      {navOpen && <div className="todo-widget__nav-overlay" onClick={() => setNavOpen(false)} />}
      <nav className={`todo-widget__nav${navOpen ? ' todo-widget__nav--open' : ''}`}>
        {SECTIONS.map((section) => {
          const noDrop = section.key === 'Terminées';
          return (
            <button
              key={section.key}
              className={[
                'todo-widget__nav-item',
                isSectionActive(section.key) ? 'todo-widget__nav-item--active' : '',
                !noDrop && isDragOverSection(section.key) ? 'todo-widget__nav-item--drag-over' : '',
              ].filter(Boolean).join(' ')}
              onClick={() => { setActiveFilter({ type: 'section', key: section.key }); setNavOpen(false); }}
              onDragOver={noDrop ? undefined : (e) => { e.preventDefault(); if (draggingId === null) return; setDragTarget({ type: 'section', key: section.key }); setDropIndicatorId(null); }}
              onDragLeave={noDrop ? undefined : () => setDragTarget(null)}
              onDrop={noDrop ? undefined : (e) => { e.preventDefault(); handleDrop({ type: 'section', key: section.key }); }}
            >
              <span className="material-icons">{section.icon}</span>
              <span className="todo-widget__nav-item-label">{section.label}</span>
              {(navCounts[`section:${section.key}`] ?? 0) > 0 && (
                <span className="todo-widget__nav-count">{navCounts[`section:${section.key}`]}</span>
              )}
            </button>
          );
        })}

        {projetEntries.length > 0 && (
          <>
            <span className="todo-widget__nav-label">Mes projets</span>
            {projetEntries.map((name) => {
              const color = projetColorMap.get(name);
              return (
                <button
                  key={name}
                  className={[
                    'todo-widget__nav-item',
                    isProjectActive(name) ? 'todo-widget__nav-item--active' : '',
                    isDragOverProject(name) ? 'todo-widget__nav-item--drag-over' : '',
                  ].filter(Boolean).join(' ')}
                  onClick={() => { setActiveFilter({ type: 'project', id: name, label: name }); setNavOpen(false); }}
                  onDragOver={(e) => { e.preventDefault(); if (draggingId === null) return; setDragTarget({ type: 'project', id: name }); setDropIndicatorId(null); }}
                  onDragLeave={() => setDragTarget(null)}
                  onDrop={(e) => { e.preventDefault(); handleDrop({ type: 'project', id: name }); }}
                >
                  <span
                    className="todo-widget__nav-chip-dot"
                    style={color ? { backgroundColor: color.fill, boxShadow: `0 0 0 2px ${color.text}60` } : undefined}
                  />
                  <span className="todo-widget__nav-item-label">{name}</span>
                  {(navCounts[`project:${name}`] ?? 0) > 0 && (
                    <span className="todo-widget__nav-count">{navCounts[`project:${name}`]}</span>
                  )}
                </button>
              );
            })}
          </>
        )}

      </nav>

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

        {(() => {
          const visibleList = isAujourdhui && showDone ? [...filteredRecords, ...doneRecords] : filteredRecords;
          if (visibleList.length === 0) {
            return (
              <div className="todo-widget__empty">
                <span className="material-icons todo-widget__empty-icon">check_circle</span>
                <p className="todo-widget__empty-text">{isTerminees ? 'Aucune tâche terminée' : 'Aucune tâche'}</p>
                {!isTerminees && (
                  <button className="todo-widget__empty-btn" onClick={() => { void handleAddTask(); }}>
                    <span className="material-icons">add</span>
                    Ajouter une tâche
                  </button>
                )}
              </div>
            );
          }
          return renderList(visibleList, !isTerminees && sortMode === 'manual');
        })()}

        {!isTerminees && (isAujourdhui && showDone ? [...filteredRecords, ...doneRecords] : filteredRecords).length > 0 && (
          <button className="todo-widget__add-task-btn" onClick={(e) => { e.stopPropagation(); void handleAddTask(); }}>
            <span className="material-icons">add</span>
            Ajouter une tâche
          </button>
        )}
      </div>
    </div>
  );
}
