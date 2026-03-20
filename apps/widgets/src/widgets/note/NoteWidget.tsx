import '@blocknote/core/fonts/inter.css';
import '@blocknote/mantine/style.css';
import './note.scss';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useCreateBlockNote } from '@blocknote/react';
import { BlockNoteView } from '@blocknote/mantine';
import type { RowRecord } from 'grist-plugin-api';
import { useGrist } from '@grist-widgets/ui';

const EMOJIS = [
  '📄', '📝', '📌', '📎', '🔖', '💡', '🎯', '✅', '⭐', '🔥',
  '💼', '📊', '📈', '🗓️', '🔍', '🧠', '💬', '🤝', '🎉', '🚀',
  '🌟', '❤️', '🔴', '🟡', '🟢', '🔵', '⚡', '🛠️', '🎨', '📚',
  '🏠', '🌍', '👤', '👥', '🔒', '📧', '📞', '🖥️', '📱', '🎵',
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
}: {
  settings: PageSettings;
  onUpdate: (patch: Partial<PageSettings>) => void;
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

  const width = settings.width ?? 'reduced';

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
          <span className="page-options__label">Largeur</span>
          <div className="page-options__choices">
            <button
              type="button"
              className={`page-options__choice${width === 'reduced' ? ' page-options__choice--active' : ''}`}
              onClick={() => onUpdate({ width: 'reduced' })}
            >
              <span className="material-icons">vertical_align_center</span>
              Réduite
            </button>
            <button
              type="button"
              className={`page-options__choice${width === 'full' ? ' page-options__choice--active' : ''}`}
              onClick={() => onUpdate({ width: 'full' })}
            >
              <span className="material-icons">width_full</span>
              Pleine
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function NoteWidget({
  columnId = 'Note',
  titleColumnId = 'Title',
  emojiColumnId = 'Emoji',
  settingsColumnId = 'Settings',
  positionColumnId = 'Position',
}: {
  columnId?: string;
  titleColumnId?: string;
  emojiColumnId?: string;
  settingsColumnId?: string;
  positionColumnId?: string;
}) {
  const { record, isReady, dataVersion, updateCurrentRecord, updateLinkedRecord, createLinkedRecord, setCursorPos, fetchCurrentTable } = useGrist();

  // Full pages list fetched via docApi.fetchTable (all columns, regardless of section visibility)
  const [pages, setPages] = useState<RowRecord[]>([]);

  const [title, setTitle] = useState('');
  const [emoji, setEmoji] = useState('');
  const [settings, setSettings] = useState<PageSettings>({ ...DEFAULT_SETTINGS });
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const editor = useCreateBlockNote();
  const gristValueRef = useRef<string>('');
  const suppressSaveRef = useRef(false);

  // Re-fetch all pages (with all columns) whenever data changes
  useEffect(() => {
    if (!isReady) return;
    fetchCurrentTable()
      .then(setPages)
      .catch(console.error);
  }, [isReady, dataVersion, fetchCurrentTable]);

  const sortedPages = useMemo(() =>
    [...pages].sort((a, b) => {
      const posA = Number(a[positionColumnId]) || 0;
      const posB = Number(b[positionColumnId]) || 0;
      if (posA !== posB) return posA - posB;
      return a.id - b.id;
    }),
    [pages, positionColumnId],
  );

  // Derive the current page from the full pages list so emoji is always populated
  const currentPage = pages.find((p) => p.id === record?.id) ?? null;

  // Sync title, emoji and settings from Grist only when switching to a different page.
  // Using record id as the trigger prevents a race condition: fetchCurrentTable()
  // can return stale data before writes are committed, which would reset local state.
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

  // ── Drag-and-drop reordering ──────────────────────────────────────
  const [dragState, setDragState] = useState<{
    draggedId: number;
    overId: number | null;
    placement: 'before' | 'after';
  } | null>(null);

  const handleDragStart = useCallback((e: React.DragEvent, pageId: number) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(pageId));
    setDragState({ draggedId: pageId, overId: null, placement: 'before' });
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, pageId: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const rect = e.currentTarget.getBoundingClientRect();
    const placement: 'before' | 'after' = e.clientY < rect.top + rect.height / 2 ? 'before' : 'after';
    setDragState((prev) => prev ? { ...prev, overId: pageId, placement } : null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (!dragState?.draggedId || !dragState.overId || dragState.draggedId === dragState.overId) {
      setDragState(null);
      return;
    }

    const without = sortedPages.filter((p) => p.id !== dragState.draggedId);
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
      prev.map((p) => (p.id === dragState.draggedId ? { ...p, [positionColumnId]: newPos } : p)),
    );
    updateLinkedRecord(dragState.draggedId, { [positionColumnId]: newPos });
    setDragState(null);
  }, [dragState, sortedPages, positionColumnId, updateLinkedRecord]);

  const handleDragEnd = useCallback(() => setDragState(null), []);

  // Load editor content only when switching to a different record.
  // We must NOT reload on every record update for the same ID, because
  // onRecord fires back after our own writes with slightly stale data,
  // which would overwrite what the user just typed and jump the cursor.
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
    editor.replaceBlocks(editor.document, blocks);
    suppressSaveRef.current = false;
  }, [record, columnId, editor]);

  const handleChange = useCallback(() => {
    if (suppressSaveRef.current) return;

    const json = JSON.stringify(editor.document);
    if (json === gristValueRef.current) return;

    gristValueRef.current = json;
    updateCurrentRecord({ [columnId]: json });
  }, [editor, columnId, updateCurrentRecord]);

  const handleNewPage = useCallback(async () => {
    const maxPos = sortedPages.length > 0
      ? Math.max(...sortedPages.map((p) => Number(p[positionColumnId]) || 0))
      : 0;
    const id = await createLinkedRecord({
      [titleColumnId]: '',
      [columnId]: '',
      [emojiColumnId]: DEFAULT_EMOJI,
      [settingsColumnId]: JSON.stringify(DEFAULT_SETTINGS),
      [positionColumnId]: maxPos + 1,
    });
    await setCursorPos(id);
  }, [createLinkedRecord, setCursorPos, titleColumnId, columnId, emojiColumnId, settingsColumnId, positionColumnId, sortedPages]);

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

  return (
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
          {sortedPages.map((p) => {
            const isOver = dragState?.overId === p.id && dragState.draggedId !== p.id;
            const liClass = [
              'note-sidebar__li',
              dragState?.draggedId === p.id ? 'note-sidebar__li--dragging' : '',
              isOver && dragState?.placement === 'before' ? 'note-sidebar__li--drop-before' : '',
              isOver && dragState?.placement === 'after' ? 'note-sidebar__li--drop-after' : '',
            ].filter(Boolean).join(' ');

            return (
              <li
                key={p.id}
                className={liClass}
                draggable
                onDragStart={(e) => handleDragStart(e, p.id)}
                onDragOver={(e) => handleDragOver(e, p.id)}
                onDrop={handleDrop}
                onDragEnd={handleDragEnd}
              >
                <span className="note-sidebar__drag-handle">
                  <span className="material-icons">drag_indicator</span>
                </span>
                <button
                  type="button"
                  className={`note-sidebar__item${p.id === record?.id ? ' note-sidebar__item--active' : ''}`}
                  onClick={() => setCursorPos(p.id)}
                >
                  <span className="note-sidebar__item-emoji">
                    {String(p[emojiColumnId] || DEFAULT_EMOJI)}
                  </span>
                  <span className="note-sidebar__item-label">
                    {String(p[titleColumnId] || 'Sans titre')}
                  </span>
                </button>
              </li>
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
              <PageOptionsMenu settings={settings} onUpdate={handleSettingsUpdate} />
            </div>
            <div className="note-widget__header">
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
            <BlockNoteView editor={editor} onChange={handleChange} editable={true} />
          </div>
        )}
      </main>
    </div>
  );
}
