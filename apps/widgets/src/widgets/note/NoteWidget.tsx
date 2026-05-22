import '@blocknote/core/fonts/inter.css';
import '@blocknote/mantine/style.css';
import './note.scss';

import { withMultiColumn, getMultiColumnSlashMenuItems, multiColumnDropCursor, locales as multiColumnLocales } from '@blocknote/xl-multi-column';

import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  useCreateBlockNote,
  FormattingToolbar,
  FormattingToolbarController,
  BlockTypeSelect,
  BasicTextStyleButton,
  ColorStyleButton,
  NestBlockButton,
  UnnestBlockButton,
  CreateLinkButton,
  createReactBlockSpec,
  SuggestionMenuController,
  getDefaultReactSlashMenuItems,
  SideMenuController,
} from '@blocknote/react';
import { BlockNoteSchema, defaultBlockSpecs } from '@blocknote/core';
import { en as enDictionary } from '@blocknote/core/locales';
import { BlockNoteView } from '@blocknote/mantine';
import type { RowRecord } from 'grist-plugin-api';
import { useGrist } from '@grist-widgets/ui';

// ── Page-ref block ────────────────────────────────────────────────────────────

interface NoteContextValue {
  pages: RowRecord[];
  emojiColumnId: string;
  titleColumnId: string;
  onNavigate: (pageId: number) => void;
}

const NoteContext = React.createContext<NoteContextValue | null>(null);

const PageRefBlock = createReactBlockSpec(
  {
    type: 'pageRef' as const,
    propSchema: { pageId: { default: '' } },
    content: 'none',
  },
  {
    render: ({ block }) => {
      const ctx = useContext(NoteContext);
      const pageId = Number(block.props.pageId);
      const page = ctx?.pages.find((p) => p.id === pageId) ?? null;
      const emoji = String(page?.[ctx?.emojiColumnId ?? 'Emoji'] ?? '📄');
      const title = page
        ? String(page[ctx?.titleColumnId ?? 'Title'] || 'Sans titre')
        : 'Page introuvable';

      return (
        <div
          className={`page-ref-block${!page ? ' page-ref-block--missing' : ''}`}
          onClick={() => page && ctx?.onNavigate(pageId)}
          contentEditable={false}
        >
          <span className="page-ref-block__emoji">{emoji}</span>
          <span className="page-ref-block__title">{title}</span>
          <span className="material-icons page-ref-block__icon">chevron_right</span>
        </div>
      );
    },
  },
);

// ── Todo-item block ────────────────────────────────────────────────────────

const PROJECT_COLORS = ['blue', 'violet', 'green', 'orange', 'red', 'teal'] as const;
type ProjectColor = (typeof PROJECT_COLORS)[number];

function hashColor(text: string): ProjectColor {
  let h = 0x811c9dc5; // FNV-1a offset basis
  for (let i = 0; i < text.length; i++) {
    h = Math.imul(h ^ text.charCodeAt(i), 0x01000193) >>> 0; // FNV prime
  }
  return PROJECT_COLORS[h % PROJECT_COLORS.length];
}

function ProjectBadge({
  block,
  editor,
}: {
  block: { id: string; props: { checked: boolean; project: string } };
  editor: ReturnType<typeof useCreateBlockNote>;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const ref = useRef<HTMLDivElement>(null);

  const draftRef = useRef(draft);
  draftRef.current = draft;

  const commit = (value: string) => {
    editor.updateBlock(block as Parameters<typeof editor.updateBlock>[0], {
      props: { project: value.trim() },
    });
    setOpen(false);
  };

  useEffect(() => {
    if (!open) return;
    setDraft(block.props.project);
    setTimeout(() => inputRef.current?.select(), 0);
    const handle = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) commit(draftRef.current);
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [open]);

  const project = block.props.project.trim();
  const color = project ? (block.props.checked ? 'grey' : hashColor(project)) : null;

  return (
    <div className="todo-badge-wrap" ref={ref}>
      <button
        type="button"
        className={`todo-badge${color ? ` todo-badge--${color}` : ' todo-badge--empty'}`}
        onClick={() => setOpen((o) => !o)}
      >
        {project ? (
          <span>{project}</span>
        ) : (
          <>
            <span className="material-icons">add</span>
            <span>Projet</span>
          </>
        )}
      </button>
      {open && (
        <div className="todo-badge-picker">
          <input
            ref={inputRef}
            className="todo-badge-picker__input"
            value={draft}
            placeholder="Nom du projet…"
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); commit(draft); }
              if (e.key === 'Escape') { setOpen(false); }
            }}
          />
          <div className="todo-badge-picker__actions">
            {project && (
              <button
                type="button"
                className="todo-badge-picker__clear"
                onClick={() => commit('')}
              >
                <span className="material-icons">close</span>
                Retirer
              </button>
            )}
            <button
              type="button"
              className="todo-badge-picker__confirm"
              onClick={() => commit(draft)}
            >
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const TodoItemBlock = createReactBlockSpec(
  {
    type: 'todoItem' as const,
    propSchema: {
      checked: { default: false },
      project: { default: '' },
    },
    content: 'inline',
  },
  {
    render: ({ block, editor, contentRef }) => {
      const isEmpty = (block.content as unknown[]).length === 0;
      return (
        <div className={`todo-item${block.props.checked ? ' todo-item--checked' : ''}`}>
          <button
            type="button"
            className="todo-item__checkbox"
            contentEditable={false}
            onClick={() =>
              editor.updateBlock(block, { props: { checked: !block.props.checked } })
            }
          >
            <span className="material-icons">
              {block.props.checked ? 'check_box' : 'check_box_outline_blank'}
            </span>
          </button>
          <div contentEditable={false}>
            <ProjectBadge block={block} editor={editor} />
          </div>
          <div className={`todo-item__text-wrap${isEmpty ? ' todo-item__text-wrap--empty' : ''}`}>
            <div className="todo-item__text" ref={contentRef} />
          </div>
        </div>
      );
    },
  },
);

// ── Status-badge block ─────────────────────────────────────────────────────

const STATUS_OPTIONS = [
  { label: 'Todo',        color: 'grey'   },
  { label: 'In Progress', color: 'blue'   },
  { label: 'Review',      color: 'orange' },
  { label: 'Done',        color: 'green'  },
  { label: 'Blocked',     color: 'red'    },
] as const;

type StatusColor = (typeof STATUS_OPTIONS)[number]['color'];

const StatusBadgeBlock = createReactBlockSpec(
  {
    type: 'statusBadge' as const,
    propSchema: {
      label: { default: 'Todo' },
      color: { default: 'grey' as StatusColor },
    },
    content: 'none',
  },
  {
    render: ({ block, editor }) => {
      const { label, color } = block.props;

      const handleClick = () => {
        const idx = STATUS_OPTIONS.findIndex((s) => s.label === label);
        const next = STATUS_OPTIONS[(idx + 1) % STATUS_OPTIONS.length];
        editor.updateBlock(block, { props: { label: next.label, color: next.color } });
      };

      return (
        <span
          className={`status-badge status-badge--${color}`}
          onClick={handleClick}
          contentEditable={false}
          title="Cliquer pour changer le statut"
        >
          {label}
        </span>
      );
    },
  },
);

const noteSchema = withMultiColumn(BlockNoteSchema.create({
  blockSpecs: {
    ...defaultBlockSpecs,
    pageRef: PageRefBlock(),
    statusBadge: StatusBadgeBlock(),
    todoItem: TodoItemBlock(),
  },
}));

const MAX_IMAGE_DIMENSION = 1200;

function resizeImageToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.onload = () => {
      if (!file.type.startsWith('image/')) {
        resolve(reader.result as string);
        return;
      }
      const img = new Image();
      img.onerror = () => reject(new Error('Failed to decode image'));
      img.onload = () => {
        let { width, height } = img;
        if (width > MAX_IMAGE_DIMENSION || height > MAX_IMAGE_DIMENSION) {
          const ratio = Math.min(MAX_IMAGE_DIMENSION / width, MAX_IMAGE_DIMENSION / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d')!.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL(file.type === 'image/png' ? 'image/png' : 'image/jpeg', 0.85));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

const EMOJIS = [
  '📄', '📝', '📌', '📎', '🔖', '💡', '🎯', '✅', '⭐', '🔥',
  '💼', '📊', '📈', '🗓️', '🔍', '🧠', '💬', '🤝', '🎉', '🚀',
  '🌟', '❤️', '🔴', '🟡', '🟢', '🔵', '⚡', '🛠️', '🎨', '📚',
  '🏠', '🌍', '👤', '👥', '🔒', '📧', '📞', '🖥️', '😋', '🎵',
  '🥬', '👨‍💻', '🎨', '⛵', '🤖', '🧪'
];

const DEFAULT_EMOJI = '📄';

interface PageSettings {
  width?: 'full' | 'reduced';
}

const DEFAULT_SETTINGS: PageSettings = { width: 'reduced' };

function parseSettings(raw: unknown): PageSettings {
  if (!raw || typeof raw !== 'string') return { ...DEFAULT_SETTINGS };
  try {
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function EmojiPicker({ current, onSelect }: { current: string; onSelect: (e: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  return (
    <div className="emoji-picker" ref={ref}>
      <button
        type="button"
        className="emoji-picker__trigger"
        onClick={() => setOpen((o) => !o)}
        title="Changer l'emoji"
      >
        {current || DEFAULT_EMOJI}
      </button>
      {open && (
        <div className="emoji-picker__grid">
          {EMOJIS.map((e) => (
            <button
              key={e}
              type="button"
              className={`emoji-picker__option${e === current ? ' emoji-picker__option--active' : ''}`}
              onClick={() => { onSelect(e); setOpen(false); }}
            >
              {e}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function PageOptionsMenu({
  settings,
  onUpdate,
  onDelete,
}: {
  settings: PageSettings;
  onUpdate: (patch: Partial<PageSettings>) => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const isFullWidth = settings.width === 'full';

  return (
    <div className="page-options" ref={ref}>
      <button
        type="button"
        className="page-options__trigger"
        onClick={() => setOpen((o) => !o)}
        title="Options de la page"
      >
        <span className="material-icons">more_horiz</span>
      </button>
      {open && (
        <div className="page-options__dropdown">
          <div className="page-options__toggle-row">
            <span className="page-options__toggle-label">Pleine largeur</span>
            <label className="toggle">
              <input
                type="checkbox"
                checked={isFullWidth}
                onChange={(e) => onUpdate({ width: e.target.checked ? 'full' : 'reduced' })}
              />
              <span className="toggle__slider" />
            </label>
          </div>
          <div className="page-options__divider" />
          <button
            type="button"
            className="page-options__choice page-options__choice--danger"
            onClick={() => { onDelete(); setOpen(false); }}
          >
            <span className="material-icons">delete</span>
            Supprimer la page
          </button>
        </div>
      )}
    </div>
  );
}

function isRootPage(page: RowRecord, parentCol: string): boolean {
  const v = page[parentCol];
  return !v || v === 0;
}

function sortByPosition(pages: RowRecord[], posCol: string): RowRecord[] {
  return [...pages].sort((a, b) => {
    const posA = Number(a[posCol]) || 0;
    const posB = Number(b[posCol]) || 0;
    if (posA !== posB) return posA - posB;
    return a.id - b.id;
  });
}

export function NoteWidget({
  columnId = 'Note',
  titleColumnId = 'Title',
  emojiColumnId = 'Emoji',
  settingsColumnId = 'Settings',
  positionColumnId = 'Position',
  parentColumnId = 'Parent',
  deletedColumnId = 'Deleted',
}: {
  columnId?: string;
  titleColumnId?: string;
  emojiColumnId?: string;
  settingsColumnId?: string;
  positionColumnId?: string;
  parentColumnId?: string;
  deletedColumnId?: string;
}) {
  const { record, isReady, dataVersion, updateCurrentRecord, updateLinkedRecord, createLinkedRecord, setCursorPos, fetchCurrentTable } = useGrist();

  const [pages, setPages] = useState<RowRecord[]>([]);

  const [title, setTitle] = useState('');
  const [emoji, setEmoji] = useState('');
  const [settings, setSettings] = useState<PageSettings>({ ...DEFAULT_SETTINGS });
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());

  const editor = useCreateBlockNote({
    schema: noteSchema,
    uploadFile: resizeImageToDataUrl,
    dropCursor: multiColumnDropCursor,
    dictionary: { ...enDictionary, multi_column: multiColumnLocales.en } as any,
  });
  const gristValueRef = useRef<string>('');
  const suppressSaveRef = useRef(false);

  // Enter on a todoItem → insert a new todoItem below
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' || e.shiftKey) return;
      if ((e.target as HTMLElement).tagName === 'INPUT') return;
      if (!editor.isFocused) return;
      let pos;
      try { pos = editor.getTextCursorPosition(); } catch { return; }
      if (!pos || pos.block.type !== 'todoItem') return;
      e.preventDefault();
      e.stopImmediatePropagation();
      const newId = Math.random().toString(36).slice(2);
      try {
        editor.insertBlocks(
          [{ id: newId, type: 'todoItem', props: { checked: false, project: '' } }],
          pos.block,
          'after',
        );
        editor.setTextCursorPosition(newId, 'start');
      } catch { /* no-op */ }
    };
    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [editor]);

  // Re-fetch all pages (with all columns) whenever data changes
  useEffect(() => {
    if (!isReady) return;
    fetchCurrentTable()
      .then((rows) => setPages(rows.filter((r) => !r[deletedColumnId])))
      .catch(console.error);
  }, [isReady, dataVersion, fetchCurrentTable, deletedColumnId]);

  // Build tree: roots + children grouped by parent
  const { roots, childrenMap } = useMemo(() => {
    const rootPages: RowRecord[] = [];
    const map = new Map<number, RowRecord[]>();

    for (const p of pages) {
      if (isRootPage(p, parentColumnId)) {
        rootPages.push(p);
      } else {
        const pid = Number(p[parentColumnId]);
        const list = map.get(pid) ?? [];
        list.push(p);
        map.set(pid, list);
      }
    }

    const sortedRoots = sortByPosition(rootPages, positionColumnId);
    for (const [pid, children] of map) {
      map.set(pid, sortByPosition(children, positionColumnId));
    }

    return { roots: sortedRoots, childrenMap: map };
  }, [pages, parentColumnId, positionColumnId]);

  const currentPage = pages.find((p) => p.id === record?.id) ?? null;
  const parentPage = currentPage && !isRootPage(currentPage, parentColumnId)
    ? pages.find((p) => p.id === Number(currentPage[parentColumnId])) ?? null
    : null;

  const syncedPageIdRef = useRef<number | null>(null);
  useEffect(() => {
    if (!currentPage) return;
    if (currentPage.id === syncedPageIdRef.current) return;
    syncedPageIdRef.current = currentPage.id;
    setTitle(String(currentPage[titleColumnId] ?? ''));
    setEmoji(String(currentPage[emojiColumnId] ?? ''));
    setSettings(parseSettings(currentPage[settingsColumnId]));
  }, [currentPage, titleColumnId, emojiColumnId, settingsColumnId]);

  const handleTitleBlur = useCallback(
    (e: React.FocusEvent<HTMLInputElement>) => {
      const value = e.currentTarget.value;
      if (value !== String(currentPage?.[titleColumnId] ?? '')) {
        updateCurrentRecord({ [titleColumnId]: value });
      }
    },
    [currentPage, titleColumnId, updateCurrentRecord],
  );

  const handleTitleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        editor.focus();
      }
    },
    [editor],
  );

  const handleEmojiSelect = useCallback(
    (value: string) => {
      setEmoji(value);
      updateCurrentRecord({ [emojiColumnId]: value });
    },
    [emojiColumnId, updateCurrentRecord],
  );

  const handleDeletePage = useCallback(async () => {
    if (!record) return;
    await updateCurrentRecord({ [deletedColumnId]: true });
  }, [record, deletedColumnId, updateCurrentRecord]);

  const handleSettingsUpdate = useCallback(
    (patch: Partial<PageSettings>) => {
      setSettings((prev) => {
        const next = { ...prev, ...patch };
        updateCurrentRecord({ [settingsColumnId]: JSON.stringify(next) });
        return next;
      });
    },
    [settingsColumnId, updateCurrentRecord],
  );

  const toggleCollapse = useCallback((pageId: number) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(pageId)) next.delete(pageId);
      else next.add(pageId);
      return next;
    });
  }, []);

  // ── Drag-and-drop reordering + reparenting ──────────────────────────
  const [dragState, setDragState] = useState<{
    draggedId: number;
    overId: number | null;
    placement: 'before' | 'after' | 'onto';
  } | null>(null);

  const handleDragStart = useCallback((e: React.DragEvent, pageId: number) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(pageId));
    setDragState({ draggedId: pageId, overId: null, placement: 'before' });
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, pageId: number, isChild: boolean) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const h = rect.height;

    let placement: 'before' | 'after' | 'onto';
    if (!isChild && y > h * 0.25 && y < h * 0.75) {
      placement = 'onto';
    } else if (y < h / 2) {
      placement = 'before';
    } else {
      placement = 'after';
    }

    setDragState((prev) => prev ? { ...prev, overId: pageId, placement } : null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (!dragState?.draggedId || !dragState.overId || dragState.draggedId === dragState.overId) {
      setDragState(null);
      return;
    }

    const dragged = pages.find((p) => p.id === dragState.draggedId);
    const over = pages.find((p) => p.id === dragState.overId);
    if (!dragged || !over) { setDragState(null); return; }

    // ── Reparent: drop "onto" a root page ───────────────────────────
    if (dragState.placement === 'onto') {
      if (!isRootPage(over, parentColumnId)) { setDragState(null); return; }
      const draggedHasChildren = (childrenMap.get(dragged.id) ?? []).length > 0;
      if (draggedHasChildren) { setDragState(null); return; }

      const newSiblings = childrenMap.get(over.id) ?? [];
      const maxPos = newSiblings.length > 0
        ? Math.max(...newSiblings.map((p) => Number(p[positionColumnId]) || 0))
        : 0;

      setPages((prev) =>
        prev.map((p) => (p.id === dragged.id
          ? { ...p, [parentColumnId]: over.id, [positionColumnId]: maxPos + 1 }
          : p)),
      );
      updateLinkedRecord(dragged.id, { [parentColumnId]: over.id, [positionColumnId]: maxPos + 1 });
      setCollapsed((prev) => { const next = new Set(prev); next.delete(over.id); return next; });
      setDragState(null);
      return;
    }

    // ── Reorder / reparent via before|after placement ───────────────
    // The new parent is determined by where we're dropping, not where we came from.
    const newParent = isRootPage(over, parentColumnId) ? 0 : Number(over[parentColumnId]);

    // A page that has children cannot be made into a subpage.
    const draggedHasChildren = (childrenMap.get(dragged.id) ?? []).length > 0;
    if (draggedHasChildren && newParent !== 0) { setDragState(null); return; }

    const siblings = newParent === 0
      ? roots
      : (childrenMap.get(newParent) ?? []);

    const without = siblings.filter((p) => p.id !== dragState.draggedId);
    const overIdx = without.findIndex((p) => p.id === dragState.overId);
    const targetIdx = dragState.placement === 'before' ? overIdx : overIdx + 1;

    let newPos: number;
    if (targetIdx <= 0) {
      newPos = (Number(without[0]?.[positionColumnId]) || 0) - 1;
    } else if (targetIdx >= without.length) {
      newPos = (Number(without[without.length - 1]?.[positionColumnId]) || 0) + 1;
    } else {
      const before = Number(without[targetIdx - 1]?.[positionColumnId]) || 0;
      const after = Number(without[targetIdx]?.[positionColumnId]) || 0;
      newPos = (before + after) / 2;
    }

    setPages((prev) =>
      prev.map((p) => (p.id === dragState.draggedId
        ? { ...p, [parentColumnId]: newParent, [positionColumnId]: newPos }
        : p)),
    );
    updateLinkedRecord(dragState.draggedId, { [parentColumnId]: newParent, [positionColumnId]: newPos });
    setDragState(null);
  }, [dragState, pages, roots, childrenMap, parentColumnId, positionColumnId, updateLinkedRecord]);

  const handleDragEnd = useCallback(() => setDragState(null), []);

  // Load editor content only when switching to a different record
  const loadedRecordIdRef = useRef<number | null>(null);
  useEffect(() => {
    if (!record) return;
    if (record.id === loadedRecordIdRef.current) return;
    loadedRecordIdRef.current = record.id;

    const incoming = String(record[columnId] ?? '');
    gristValueRef.current = incoming;
    suppressSaveRef.current = true;

    let blocks;
    try {
      blocks = JSON.parse(incoming);
    } catch {
      blocks = editor.tryParseMarkdownToBlocks(incoming);
    }
    try {
      editor.replaceBlocks(editor.document, blocks);
    } finally {
      suppressSaveRef.current = false;
    }
  }, [record, columnId, editor]);

  const handleChange = useCallback(() => {
    if (suppressSaveRef.current) return;

    const json = JSON.stringify(editor.document);
    if (json === gristValueRef.current) return;

    gristValueRef.current = json;
    updateCurrentRecord({ [columnId]: json });
  }, [editor, columnId, updateCurrentRecord]);

  const handleNavigate = useCallback((pageId: number) => {
    setCursorPos(pageId);
  }, [setCursorPos]);

  const handleNewPage = useCallback(async () => {
    const maxPos = roots.length > 0
      ? Math.max(...roots.map((p) => Number(p[positionColumnId]) || 0))
      : 0;
    const id = await createLinkedRecord({
      [titleColumnId]: '',
      [columnId]: '',
      [emojiColumnId]: DEFAULT_EMOJI,
      [settingsColumnId]: JSON.stringify(DEFAULT_SETTINGS),
      [positionColumnId]: maxPos + 1,
      [parentColumnId]: 0,
    });
    await setCursorPos(id);
  }, [createLinkedRecord, setCursorPos, titleColumnId, columnId, emojiColumnId, settingsColumnId, positionColumnId, parentColumnId, roots]);

  const handleNewSubpage = useCallback(async (parentId: number) => {
    const siblings = childrenMap.get(parentId) ?? [];
    const maxPos = siblings.length > 0
      ? Math.max(...siblings.map((p) => Number(p[positionColumnId]) || 0))
      : 0;
    const id = await createLinkedRecord({
      [titleColumnId]: '',
      [columnId]: '',
      [emojiColumnId]: DEFAULT_EMOJI,
      [settingsColumnId]: JSON.stringify(DEFAULT_SETTINGS),
      [positionColumnId]: maxPos + 1,
      [parentColumnId]: parentId,
    });
    setCollapsed((prev) => { const next = new Set(prev); next.delete(parentId); return next; });
    await setCursorPos(id);
  }, [createLinkedRecord, setCursorPos, titleColumnId, columnId, emojiColumnId, settingsColumnId, positionColumnId, parentColumnId, childrenMap]);

  const noteContextValue = useMemo<NoteContextValue>(
    () => ({ pages, emojiColumnId, titleColumnId, onNavigate: handleNavigate }),
    [pages, emojiColumnId, titleColumnId, handleNavigate],
  );

  if (!isReady) {
    return (
      <div className="note-app">
        <div className="note-widget note-widget--idle">
          <span className="material-icons note-widget__idle-icon">note_alt</span>
          <p className="note-widget__idle-text">Initialisation…</p>
        </div>
      </div>
    );
  }

  const widthClass = settings.width === 'full' ? 'note-widget--full' : 'note-widget--reduced';

  const renderPageItem = (p: RowRecord, isChild: boolean) => {
    const isOver = dragState?.overId === p.id && dragState.draggedId !== p.id;
    const children = childrenMap.get(p.id) ?? [];
    const hasChildren = children.length > 0;
    const isCollapsed = collapsed.has(p.id);

    const liClass = [
      'note-sidebar__li',
      isChild ? 'note-sidebar__li--child' : '',
      dragState?.draggedId === p.id ? 'note-sidebar__li--dragging' : '',
      isOver && dragState?.placement === 'before' ? 'note-sidebar__li--drop-before' : '',
      isOver && dragState?.placement === 'after' ? 'note-sidebar__li--drop-after' : '',
      isOver && dragState?.placement === 'onto' ? 'note-sidebar__li--drop-onto' : '',
    ].filter(Boolean).join(' ');

    return (
      <li
        key={p.id}
        className={liClass}
        draggable
        onDragStart={(e) => handleDragStart(e, p.id)}
        onDragOver={(e) => handleDragOver(e, p.id, isChild)}
        onDrop={handleDrop}
        onDragEnd={handleDragEnd}
      >
        <button
          type="button"
          className={`note-sidebar__emoji-btn${hasChildren && !isChild ? ' note-sidebar__emoji-btn--collapsible' : ''}`}
          onClick={hasChildren && !isChild ? () => toggleCollapse(p.id) : undefined}
          tabIndex={hasChildren && !isChild ? 0 : -1}
        >
          <span className="note-sidebar__emoji-char">
            {String(p[emojiColumnId] || DEFAULT_EMOJI)}
          </span>
          {hasChildren && !isChild && (
            <span className="material-icons note-sidebar__emoji-caret">
              {isCollapsed ? 'chevron_right' : 'expand_more'}
            </span>
          )}
        </button>
        <button
          type="button"
          className={`note-sidebar__item${p.id === record?.id ? ' note-sidebar__item--active' : ''}`}
          onClick={() => setCursorPos(p.id)}
        >
          <span className="note-sidebar__item-label">
            {String(p[titleColumnId] || 'Sans titre')}
          </span>
        </button>
        {!isChild && (
          <button
            type="button"
            className="note-sidebar__add-sub-btn"
            title="Ajouter une sous-page"
            onClick={(e) => { e.stopPropagation(); handleNewSubpage(p.id); }}
          >
            <span className="material-icons">add</span>
          </button>
        )}
      </li>
    );
  };

  return (
    <NoteContext.Provider value={noteContextValue}>
    <div className="note-app">
      {sidebarOpen ? (
        <aside className="note-sidebar">
          <div className="note-sidebar__header">
            <span className="note-sidebar__heading">Pages</span>
            <button
              type="button"
              className="note-sidebar__new-btn"
              title="Nouvelle page"
              onClick={handleNewPage}
            >
              <span className="material-icons">add</span>
            </button>
            <button
              type="button"
              className="note-sidebar__new-btn"
              title="Fermer le panneau"
              onClick={() => setSidebarOpen(false)}
            >
              <span className="material-icons">chevron_left</span>
            </button>
          </div>

          <ul className="note-sidebar__list">
            {roots.map((p) => {
              const children = childrenMap.get(p.id) ?? [];
              const isCollapsed = collapsed.has(p.id);
              return (
                <React.Fragment key={p.id}>
                  {renderPageItem(p, false)}
                  {!isCollapsed && children.map((c) => renderPageItem(c, true))}
                </React.Fragment>
              );
            })}
          </ul>
        </aside>
      ) : (
        <button
          type="button"
          className="note-sidebar-toggle"
          title="Ouvrir le panneau"
          onClick={() => setSidebarOpen(true)}
        >
          <span className="material-icons">menu</span>
        </button>
      )}

      <main className="note-main">
        {!record ? (
          <div className="note-widget note-widget--idle">
            <span className="material-icons note-widget__idle-icon">note_alt</span>
            <p className="note-widget__idle-text">Sélectionnez une page pour commencer.</p>
          </div>
        ) : (
          <div className={`note-widget ${widthClass}`}>
            <div className="note-widget__toolbar">
              <PageOptionsMenu settings={settings} onUpdate={handleSettingsUpdate} onDelete={handleDeletePage} />
            </div>
            <div className="note-widget__header">
              {parentPage && (
                <button
                  type="button"
                  className="note-widget__breadcrumb"
                  onClick={() => setCursorPos(parentPage.id)}
                >
                  <span className="material-icons">chevron_left</span>
                  <span>{String(parentPage[emojiColumnId] || DEFAULT_EMOJI)}</span>
                  <span>{String(parentPage[titleColumnId] || 'Sans titre')}</span>
                </button>
              )}
              <EmojiPicker current={emoji} onSelect={handleEmojiSelect} />
              <input
                className="note-widget__title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={handleTitleBlur}
                onKeyDown={handleTitleKeyDown}
                placeholder="Sans titre"
              />
            </div>
            <BlockNoteView editor={editor} onChange={handleChange} editable={true} formattingToolbar={false} slashMenu={false} sideMenu={false}>
              <SideMenuController floatingUIOptions={{ useFloatingOptions: { placement: 'left' } }} />
              <SuggestionMenuController
                triggerCharacter="/"
                getItems={async (query) => {
                  const defaultItems = getDefaultReactSlashMenuItems(editor);
                  const pageItems = pages
                    .filter((p) => p.id !== record?.id)
                    .map((p) => ({
                      title: String(p[titleColumnId] || 'Sans titre'),
                      aliases: [String(p[titleColumnId] || '').toLowerCase(), 'page', 'sous-page'],
                      group: 'Pages',
                      icon: <span style={{ fontSize: '14px', lineHeight: 1 }}>{String(p[emojiColumnId] || DEFAULT_EMOJI)}</span>,
                      onItemClick: () => {
                        editor.insertBlocks(
                          [{ type: 'pageRef', props: { pageId: String(p.id) } }],
                          editor.getTextCursorPosition().block,
                          'after',
                        );
                      },
                    }));
                  const todoItem = {
                    title: 'To Do',
                    aliases: ['todo', 'task', 'tâche', 'checklist'],
                    group: 'Blocs',
                    icon: <span className="material-icons" style={{ fontSize: '16px' }}>check_box_outline_blank</span>,
                    onItemClick: () => {
                      editor.insertBlocks(
                        [{ type: 'todoItem', props: { checked: false, project: '' } }],
                        editor.getTextCursorPosition().block,
                        'after',
                      );
                    },
                  };
                  const statusItem = {
                    title: 'Status Badge',
                    aliases: ['status', 'badge', 'statut', 'tag'],
                    group: 'Blocs',
                    icon: <span style={{ fontSize: '12px', lineHeight: 1, fontWeight: 600 }}>●</span>,
                    onItemClick: () => {
                      editor.insertBlocks(
                        [{ type: 'statusBadge', props: { label: 'Todo', color: 'grey' } }],
                        editor.getTextCursorPosition().block,
                        'after',
                      );
                    },
                  };
                  const columnItems = getMultiColumnSlashMenuItems(editor);
                  const all = [...defaultItems, ...columnItems, todoItem, statusItem, ...pageItems];
                  if (!query) return all;
                  const q = query.toLowerCase();
                  return all.filter((item) =>
                    item.title.toLowerCase().includes(q) ||
                    item.aliases?.some((a) => a.toLowerCase().includes(q)),
                  );
                }}
              />
              <FormattingToolbarController
                formattingToolbar={() => (
                  <FormattingToolbar>
                    <BlockTypeSelect key="blockTypeSelect" />
                    <BasicTextStyleButton basicTextStyle="bold" key="boldStyleButton" />
                    <BasicTextStyleButton basicTextStyle="italic" key="italicStyleButton" />
                    <BasicTextStyleButton basicTextStyle="underline" key="underlineStyleButton" />
                    <BasicTextStyleButton basicTextStyle="strike" key="strikeStyleButton" />
                    <BasicTextStyleButton basicTextStyle="code" key="codeStyleButton" />
                    <ColorStyleButton key="colorStyleButton" />
                    <NestBlockButton key="nestBlockButton" />
                    <UnnestBlockButton key="unnestBlockButton" />
                    <CreateLinkButton key="createLinkButton" />
                  </FormattingToolbar>
                )}
              />
            </BlockNoteView>
          </div>
        )}
      </main>
    </div>
    </NoteContext.Provider>
  );
}
