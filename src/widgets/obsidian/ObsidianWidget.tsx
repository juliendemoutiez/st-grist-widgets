import './obsidian.scss';
import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useEditor, EditorContent } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Mention from '@tiptap/extension-mention';
import { Markdown } from 'tiptap-markdown';
import type { RowRecord } from 'grist-plugin-api';
import { useGrist } from '@grist-widgets/ui';

// ─── Column names ─────────────────────────────────────────────────────────────

const TITLE_COL    = 'Title';
const CONTENT_COL  = 'Content';
const ICON_COL     = 'Icon';
const TYPE_COL     = 'Type';
const PARENT_COL   = 'Parent';
const ORDER_COL    = 'Order';
const STATUS_COL   = 'Status';
const CREATED_COL  = 'Created';
const MODIFIED_COL = 'Modified';

const COMMON_EMOJIS = [
  '📝', '✅', '⭐', '🎯', '💡', '🔥', '❤️', '🚀',
  '📌', '🎨', '📚', '💼', '🏠', '🌍', '🤔', '💭',
  '🔑', '📊', '🗓️', '⚡', '🎉', '👍', '🌟', '📢',
  '🔔', '💬', '🤝', '🧠', '🎓', '💰', '🏆', '🔒',
  '📷', '🎵', '🌈', '🍀', '🦋', '🌊', '🏔️', '🌱',
];

const T_NOTE     = 'note';
const T_DAILY    = 'daily';
const S_ARCHIVED = 'archived';
const S_ACTIVE   = 'active';
const DEFAULT_ICON = '📝';

// ─── Static views ─────────────────────────────────────────────────────────────

const STATIC_VIEWS = [
  { id: 'notes'   as const, label: 'Notes',         icon: 'description'        },
  { id: 'daily'   as const, label: 'Daily stream',  icon: 'calendar_view_week' },
  { id: 'archive' as const, label: 'Archive',       icon: 'inventory_2'        },
];
type ViewId = typeof STATIC_VIEWS[number]['id'];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function itemIcon(type: string) {
  if (type === T_DAILY) return 'today';
  return 'description';
}

function formatDate(ts: unknown): string {
  if (!ts) return '';
  const d    = new Date(Number(ts) * 1000);
  const now  = new Date();
  const today     = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterday = today - 86_400_000;
  const item      = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  if (item === today)     return "Aujourd'hui";
  if (item === yesterday) return 'Hier';
  return d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
}

// ─── Toolbar button ───────────────────────────────────────────────────────────

// ─── Note mention popup ───────────────────────────────────────────────────────

interface MentionListHandle {
  onKeyDown: (event: KeyboardEvent) => boolean;
}

interface MentionState {
  items: RowRecord[];
  command: (attrs: { id: string; label: string; emoji?: string }) => void;
  clientRect: (() => DOMRect | null) | null;
}

const NoteMentionList = React.forwardRef<MentionListHandle, MentionState>(
  ({ items, command, clientRect }, ref) => {
    const [selectedIndex, setSelectedIndex] = useState(0);

    React.useImperativeHandle(ref, () => ({
      onKeyDown(event) {
        if (event.key === 'ArrowUp') {
          setSelectedIndex((i) => (i - 1 + Math.max(items.length, 1)) % Math.max(items.length, 1));
          return true;
        }
        if (event.key === 'ArrowDown') {
          setSelectedIndex((i) => (i + 1) % Math.max(items.length, 1));
          return true;
        }
        if (event.key === 'Enter') {
          const item = items[selectedIndex];
          if (item) command({ id: String(item.id), label: String(item[TITLE_COL] ?? ''), emoji: String(item[ICON_COL] ?? DEFAULT_ICON) });
          return true;
        }
        return false;
      },
    }), [items, command, selectedIndex]);

    useEffect(() => setSelectedIndex(0), [items]);

    const rect = clientRect?.();
    if (!rect || items.length === 0) return null;

    return (
      <div
        className="obsidian-mention-list"
        style={{ position: 'fixed', top: rect.bottom + 4, left: rect.left }}
      >
        {items.map((item, index) => (
          <button
            key={item.id}
            className={`obsidian-mention-list__item${index === selectedIndex ? ' obsidian-mention-list__item--selected' : ''}`}
            onMouseDown={(e) => {
              e.preventDefault();
              command({ id: String(item.id), label: String(item[TITLE_COL] ?? ''), emoji: String(item[ICON_COL] ?? DEFAULT_ICON) });
            }}
            onMouseEnter={() => setSelectedIndex(index)}
          >
            <span className="material-icons">description</span>
            <span>{String(item[TITLE_COL] ?? '') || 'Sans titre'}</span>
          </button>
        ))}
      </div>
    );
  }
);
NoteMentionList.displayName = 'NoteMentionList';

function TbBtn({ icon, text, title, active, onClick }: {
  icon?: string; text?: string; title: string; active?: boolean; onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`rte-toolbar__btn${active ? ' rte-toolbar__btn--active' : ''}`}
      title={title}
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
    >
      {icon ? <span className="material-icons">{icon}</span>
             : <span className="rte-toolbar__text">{text}</span>}
    </button>
  );
}

// ─── Emoji picker ────────────────────────────────────────────────────────────

function EmojiPicker({ value, onChange }: { value: string; onChange: (e: string) => void }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div className="obsidian__emoji-wrap" ref={wrapRef}>
      <button
        type="button"
        className={`obsidian__emoji-btn${open ? ' obsidian__emoji-btn--open' : ''}`}
        onClick={() => setOpen((o) => !o)}
        title="Choisir un emoji"
      >
        {value || '📝'}
      </button>
      {open && (
        <div className="obsidian__emoji-picker">
          {COMMON_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              className={`obsidian__emoji-option${emoji === value ? ' obsidian__emoji-option--active' : ''}`}
              onClick={() => { onChange(emoji); setOpen(false); }}
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Editor ──────────────────────────────────────────────────────────────────

function ItemEditor({ item, allRecords, onSaveTitle, onSaveContent, onSaveIcon, onNavigate, onOpenSidebar, focusEnd }: {
  item: RowRecord;
  allRecords: RowRecord[];
  onSaveTitle: (t: string) => void;
  onSaveContent: (c: string) => void;
  onSaveIcon: (icon: string) => void;
  onNavigate: (id: number) => void;
  onOpenSidebar: () => void;
  focusEnd?: boolean;
}) {
  const [titleDraft, setTitleDraft] = useState(String(item[TITLE_COL] ?? ''));
  const [iconDraft, setIconDraft]   = useState(String(item[ICON_COL] ?? ''));

  const breadcrumbs = useMemo(() => {
    const trail: RowRecord[] = [];
    let current = item;
    for (let i = 0; i < 20; i++) {
      const parentId = Number(current[PARENT_COL]);
      if (!parentId) break;
      const parent = allRecords.find((r) => r.id === parentId);
      if (!parent) break;
      trail.unshift(parent);
      current = parent;
    }
    return trail;
  }, [item.id, item[PARENT_COL], allRecords]);
  const contentDraft       = useRef(String(item[CONTENT_COL] ?? ''));
  const userEditedContent  = useRef(false);
  const autoSaveTimer      = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onSaveContentRef   = useRef(onSaveContent);
  const titleRef           = useRef<HTMLInputElement>(null);
  const allRecordsRef      = useRef(allRecords);

  useEffect(() => { onSaveContentRef.current = onSaveContent; }, [onSaveContent]);
  const [mentionState, setMentionState] = useState<MentionState | null>(null);
  const mentionListRef     = useRef<MentionListHandle>(null);

  useEffect(() => { allRecordsRef.current = allRecords; }, [allRecords]);

  useEffect(() => {
    setTitleDraft(String(item[TITLE_COL] ?? ''));
    setIconDraft(String(item[ICON_COL] ?? ''));
    contentDraft.current = String(item[CONTENT_COL] ?? '');
    if (!item[TITLE_COL]) titleRef.current?.focus();
  }, [item.id]);

  const parseContent = (raw: unknown) => {
    const s = String(raw ?? '');
    try { return JSON.parse(s); } catch { return s; }
  };

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: 'Commencez à écrire…' }),
      Markdown.configure({ html: false, transformPastedText: true, transformCopiedText: true }),
      Mention.configure({
        HTMLAttributes: { class: 'obsidian-mention' },
        renderHTML({ options, node }: { options: { HTMLAttributes: Record<string, unknown> }; node: { attrs: Record<string, unknown> } }) {
          const noteId = Number(node.attrs.id);
          const record = allRecordsRef.current.find(r => r.id === noteId);
          const emoji = record ? String(record[ICON_COL] ?? '') : '';
          const children: unknown[] = [];
          if (emoji) children.push(['span', { class: 'obsidian-mention__emoji' }, emoji]);
          children.push(['span', { class: 'obsidian-mention__label' }, String(node.attrs.label ?? '')]);
          return ['span', { ...options.HTMLAttributes, 'data-note-id': String(node.attrs.id) }, ...children];
        },
        suggestion: {
          char: '[[',
          allowSpaces: true,
          items: ({ query }: { query: string }) =>
            allRecordsRef.current
              .filter((r) => r.id !== item.id && String(r[TITLE_COL] ?? '').toLowerCase().includes(query.toLowerCase()))
              .slice(0, 8),
          render: () => ({
            onStart: (props: MentionState) => setMentionState(props),
            onUpdate: (props: MentionState) => setMentionState(props),
            onExit: () => setMentionState(null),
            onKeyDown: ({ event }: { event: KeyboardEvent }) => mentionListRef.current?.onKeyDown(event) ?? false,
          }),
        },
      }),
    ],
    content: parseContent(item[CONTENT_COL]),
    onUpdate: ({ editor: ed }) => {
      userEditedContent.current = true;
      contentDraft.current = JSON.stringify(ed.getJSON());
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
      autoSaveTimer.current = setTimeout(() => {
        if (userEditedContent.current) {
          userEditedContent.current = false;
          onSaveContentRef.current(contentDraft.current);
        }
      }, 1500);
    },
  });

  useEffect(() => {
    if (!editor) return;
    if (autoSaveTimer.current) { clearTimeout(autoSaveTimer.current); autoSaveTimer.current = null; }
    userEditedContent.current = false;
    editor.commands.setContent(parseContent(item[CONTENT_COL]));
    if (focusEnd) editor.commands.focus('end');
  }, [item.id, editor]);

  useEffect(() => {
    if (!editor || !focusEnd) return;
    editor.commands.focus('end');
  }, [focusEnd, editor]);

  const handleContentBlur = useCallback(() => {
    if (userEditedContent.current) {
      userEditedContent.current = false;
      onSaveContent(contentDraft.current);
    }
  }, [onSaveContent]);

  useEffect(() => {
    if (!editor) return;
    editor.on('blur', handleContentBlur);
    return () => { editor.off('blur', handleContentBlur); };
  }, [editor, handleContentBlur]);

  const handleTitleBlur = () => {
    const val = titleDraft.trim() || 'Sans titre';
    onSaveTitle(val);
    setTitleDraft(val);
  };

  const handleEditorClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const noteIdStr = target.closest('[data-note-id]')?.getAttribute('data-note-id');
    if (noteIdStr) {
      e.preventDefault();
      onNavigate(Number(noteIdStr));
    }
  }, [onNavigate]);

  return (
    <>
      {mentionState && createPortal(
        <NoteMentionList ref={mentionListRef} {...mentionState} />,
        document.body,
      )}
      <div className="obsidian__editor">
        <div className="obsidian__editor-inner">
          {breadcrumbs.length > 0 && (
            <div className="obsidian__breadcrumb">
              {breadcrumbs.map((p, i) => (
                <React.Fragment key={p.id}>
                  <button className="obsidian__breadcrumb-item" onClick={() => onNavigate(p.id)}>
                    {p[ICON_COL] && <span className="obsidian__breadcrumb-emoji">{String(p[ICON_COL])}</span>}
                    <span>{String(p[TITLE_COL] ?? '') || 'Sans titre'}</span>
                  </button>
                  {i < breadcrumbs.length - 1 && (
                    <span className="material-icons obsidian__breadcrumb-sep">chevron_right</span>
                  )}
                </React.Fragment>
              ))}
            </div>
          )}
          <div className="obsidian__title-row">
            <button className="obsidian__nav-toggle" onClick={onOpenSidebar} aria-label="Menu">
              <span className="material-icons">menu</span>
            </button>
            <EmojiPicker
              value={iconDraft}
              onChange={(emoji) => { setIconDraft(emoji); onSaveIcon(emoji); }}
            />
            <input
              ref={titleRef}
              className="obsidian__note-title"
              value={titleDraft}
              placeholder="Sans titre"
              onChange={(e) => setTitleDraft(e.target.value)}
              onBlur={handleTitleBlur}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); editor?.commands.focus('start'); }
              }}
            />
          </div>

          <div className="obsidian__tiptap-wrap" onClick={handleEditorClick}>
            {editor && (
              <BubbleMenu editor={editor} options={{ placement: 'top', offset: 8 }}>
                <div className="rte-bubble">
                  <TbBtn icon="format_bold"          title="Gras"            active={editor.isActive('bold')}                    onClick={() => editor.chain().focus().toggleBold().run()} />
                  <TbBtn icon="format_italic"        title="Italique"        active={editor.isActive('italic')}                  onClick={() => editor.chain().focus().toggleItalic().run()} />
                  <TbBtn icon="format_strikethrough" title="Barré"           active={editor.isActive('strike')}                  onClick={() => editor.chain().focus().toggleStrike().run()} />
                  <div className="rte-bubble__divider" />
                  <TbBtn text="H1" title="Titre 1"  active={editor.isActive('heading', { level: 1 })}    onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} />
                  <TbBtn text="H2" title="Titre 2"  active={editor.isActive('heading', { level: 2 })}    onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} />
                  <div className="rte-bubble__divider" />
                  <TbBtn icon="format_list_bulleted" title="Liste"           active={editor.isActive('bulletList')}              onClick={() => editor.chain().focus().toggleBulletList().run()} />
                  <TbBtn icon="format_list_numbered" title="Liste numérotée" active={editor.isActive('orderedList')}             onClick={() => editor.chain().focus().toggleOrderedList().run()} />
                  <TbBtn icon="format_quote"         title="Citation"        active={editor.isActive('blockquote')}              onClick={() => editor.chain().focus().toggleBlockquote().run()} />
                  <TbBtn icon="code"                 title="Code"            active={editor.isActive('code')}                    onClick={() => editor.chain().focus().toggleCode().run()} />
                </div>
              </BubbleMenu>
            )}
            <EditorContent editor={editor} />
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Main widget ──────────────────────────────────────────────────────────────

export function ObsidianWidget() {
  const {
    allRecords, record,
    createLinkedRecord, updateLinkedRecord,
    setCursorPos, setSelectedRows,
  } = useGrist();

  const storageKey = `obsidian_expanded_${window.location.pathname}`;

  const [activeView, setActiveView]             = useState<ViewId>('notes');
  const [selectedId, setSelectedId]             = useState<number | null>(null);
  const [expandedFolders, setExpandedFolders]   = useState<Set<number>>(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) return new Set(JSON.parse(raw) as number[]);
    } catch {}
    return new Set();
  });
  const [focusEnd, setFocusEnd]                 = useState(false);
  const [sidebarOpen, setSidebarOpen]           = useState(false);

  const [menuOpenId, setMenuOpenId] = useState<number | null>(null);
  const [menuPos,    setMenuPos]    = useState<{ top: number; left: number } | null>(null);

  const draggingIdRef = useRef<number | null>(null);
  const [draggingId, setDraggingId]         = useState<number | null>(null);
  const [dropBeforeId, setDropBeforeId]     = useState<number | 'end' | null>(null);
  const [dropGroup, setDropGroup]           = useState<string | null>(null);
  const [folderDropTarget, setFolderDropTarget] = useState<number | null>(null);

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify([...expandedFolders]));
  }, [expandedFolders]);

  useEffect(() => {
    if (record?.id && record.id !== selectedId) setSelectedId(record.id);
  }, [record?.id]);

  useEffect(() => { draggingIdRef.current = draggingId; }, [draggingId]);

  // ── Derived data ───────────────────────────────────────────────────────────

  // Tree: active + non-daily, root-level, sorted by Order
  const rootItems = useMemo(
    () =>
      [...allRecords.filter(
        (r) => !Number(r[PARENT_COL]) && r[STATUS_COL] !== S_ARCHIVED && r[TYPE_COL] !== T_DAILY,
      )].sort((a, b) => ((a[ORDER_COL] as number) || 0) - ((b[ORDER_COL] as number) || 0)),
    [allRecords],
  );

  // All children, unfiltered (used for drag ops and folder-add)
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

  // Tree-filtered children (active + non-daily)
  const treeChildren = useCallback(
    (folderId: number) =>
      (childrenMap.get(folderId) ?? []).filter(
        (r) => r[STATUS_COL] !== S_ARCHIVED && r[TYPE_COL] !== T_DAILY,
      ),
    [childrenMap],
  );

  // Daily stream: Type=daily sorted by Created desc
  const dailyItems = useMemo(
    () =>
      [...allRecords.filter((r) => r[TYPE_COL] === T_DAILY)].sort(
        (a, b) => ((b[CREATED_COL] as number) || 0) - ((a[CREATED_COL] as number) || 0),
      ),
    [allRecords],
  );

  // Archive: tree of archived items — roots are archived items whose parent is not also archived
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

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleSelect = async (id: number) => {
    setSelectedId(id);
    await setCursorPos(id);
    await setSelectedRows([id]);
  };

  const handleNewNote = async (parentId?: number) => {
    const siblings = parentId ? (childrenMap.get(parentId) ?? []) : rootItems;
    const maxOrder = siblings.reduce((m, r) => Math.max(m, (r[ORDER_COL] as number) || 0), 0);

    const parentTitle = parentId
      ? String(allRecords.find((r) => r.id === parentId)?.[TITLE_COL] ?? '')
      : '';
    const isMeeting = parentTitle.toLowerCase().includes('meetings');

    const now = new Date();
    const dd   = String(now.getDate()).padStart(2, '0');
    const mm   = String(now.getMonth() + 1).padStart(2, '0');
    const yyyy = now.getFullYear();

    const meetingContent = JSON.stringify({
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Participants' }] },
        { type: 'paragraph' },
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Notes' }] },
        { type: 'paragraph' },
      ],
    });

    const fields: Record<string, unknown> = {
      [TITLE_COL]:   isMeeting ? `${dd}/${mm}/${yyyy}` : '',
      [CONTENT_COL]: isMeeting ? meetingContent : '',
      [TYPE_COL]:    T_NOTE,
      [ICON_COL]:    DEFAULT_ICON,
      [STATUS_COL]:  S_ACTIVE,
      [PARENT_COL]:  parentId ?? 0,
      [ORDER_COL]:   maxOrder + 10,
    };
    const id = await createLinkedRecord(fields);
    if (id) {
      if (parentId) setExpandedFolders((prev) => new Set([...prev, parentId]));
      await handleSelect(id);
    }
  };

  const handleNewDaily = async () => {
    const now  = new Date();
    const dd   = String(now.getDate()).padStart(2, '0');
    const mm   = String(now.getMonth() + 1).padStart(2, '0');
    const yyyy = now.getFullYear();
    const todayTitle = `${dd}-${mm}-${yyyy}`;

    const existing = allRecords.find(
      (r) => r[TYPE_COL] === T_DAILY && r[TITLE_COL] === todayTitle,
    );

    setActiveView('daily');

    if (existing) {
      setFocusEnd(true);
      await handleSelect(existing.id);
      setTimeout(() => setFocusEnd(false), 0);
    } else {
      const id = await createLinkedRecord({
        [TITLE_COL]: todayTitle,
        [CONTENT_COL]: '',
        [TYPE_COL]: T_DAILY,
      });
      if (id) await handleSelect(id);
    }
  };


  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const trackSave = useCallback(async (fn: () => Promise<void>) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    setSaveStatus('saving');
    try {
      await fn();
      setSaveStatus('saved');
      saveTimerRef.current = setTimeout(() => setSaveStatus('idle'), 2000);
    } catch {
      setSaveStatus('idle');
    }
  }, []);

  const handleSaveTitle = (title: string) => {
    if (!selectedId) return;
    void trackSave(() => updateLinkedRecord(selectedId, { [TITLE_COL]: title }));
  };

  const handleSaveContent = (content: string) => {
    if (!selectedId) return;
    void trackSave(() => updateLinkedRecord(selectedId, { [CONTENT_COL]: content }));
  };

  const handleSaveIcon = (icon: string) => {
    if (!selectedId) return;
    void trackSave(() => updateLinkedRecord(selectedId, { [ICON_COL]: icon }));
  };


  const handleArchive = async (id: number) => {
    setMenuOpenId(null);
    setMenuPos(null);
    const toArchive: number[] = [];
    const collect = (nodeId: number) => {
      toArchive.push(nodeId);
      for (const child of childrenMap.get(nodeId) ?? []) collect(child.id);
    };
    collect(id);
    if (selectedId !== null && toArchive.includes(selectedId)) setSelectedId(null);
    await Promise.all(toArchive.map((nid) => updateLinkedRecord(nid, { [STATUS_COL]: S_ARCHIVED })));
  };



  useEffect(() => {
    if (menuOpenId === null) return;
    const handler = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('.obsidian__item-menu')) {
        setMenuOpenId(null);
        setMenuPos(null);
      }
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
    await Promise.all(list.map((r, i) => updateLinkedRecord(r.id, { [ORDER_COL]: (i + 1) * 10 })));
  };

  const handleMoveUnder = async (itemId: number, newParentId: number) => {
    const siblings = childrenMap.get(newParentId) ?? [];
    const maxOrder = siblings.reduce((m, r) => Math.max(m, (r[ORDER_COL] as number) || 0), 0);
    await updateLinkedRecord(itemId, { [PARENT_COL]: newParentId, [ORDER_COL]: maxOrder + 10 });
    setExpandedFolders((prev) => new Set([...prev, newParentId]));
  };

  const handleMoveToRoot = async (itemId: number) => {
    const maxOrder = rootItems.reduce((m, r) => Math.max(m, (r[ORDER_COL] as number) || 0), 0);
    await updateLinkedRecord(itemId, { [PARENT_COL]: 0, [ORDER_COL]: maxOrder + 10 });
  };

  const handleMoveBefore = async (draggedId: number, targetItem: RowRecord, targetGroup: RowRecord[]) => {
    const newParentId = Number(targetItem[PARENT_COL]) || 0;
    const without = targetGroup.filter((r) => r.id !== draggedId);
    const insertIdx = without.findIndex((r) => r.id === targetItem.id);
    const list = [...without];
    list.splice(insertIdx === -1 ? list.length : insertIdx, 0, { id: draggedId } as RowRecord);
    await updateLinkedRecord(draggedId, { [PARENT_COL]: newParentId });
    await Promise.all(list.map((r, i) => updateLinkedRecord(r.id, { [ORDER_COL]: (i + 1) * 10 })));
  };

  // ── Drag helpers ───────────────────────────────────────────────────────────

  const clearDrag = () => {
    draggingIdRef.current = null;
    setDraggingId(null); setDropBeforeId(null); setDropGroup(null); setFolderDropTarget(null);
  };

  const getGroup = useCallback((r: RowRecord): { key: string; list: RowRecord[] } => {
    const pid = Number(r[PARENT_COL]) || 0;
    if (!pid) return { key: 'root', list: rootItems };
    return { key: `children-${pid}`, list: childrenMap.get(pid) ?? [] };
  }, [rootItems, childrenMap]);

  // ── Render helpers ─────────────────────────────────────────────────────────

  const renderDropEnd = (groupKey: string, list: RowRecord[]) => (
    <div
      className={`obsidian__nav-drop-end${dropGroup === groupKey && dropBeforeId === 'end' ? ' obsidian__nav-drop-end--active' : ''}`}
      onDragOver={(e) => {
        const cid = draggingIdRef.current;
        if (cid === null) return;
        const dragged = allRecords.find((r) => r.id === cid);
        if (!dragged) return;
        const g = getGroup(dragged);
        if (g.key === groupKey || (groupKey === 'root' && g.key !== 'root')) {
          e.preventDefault();
          setDropBeforeId('end'); setDropGroup(groupKey); setFolderDropTarget(null);
        }
      }}
      onDrop={(e) => {
        e.preventDefault();
        const cid = draggingIdRef.current;
        if (cid === null) { clearDrag(); return; }
        const dragged = allRecords.find((r) => r.id === cid);
        if (!dragged) { clearDrag(); return; }
        const g = getGroup(dragged);
        if (g.key === groupKey)              void handleReorder(cid, null, list);
        else if (groupKey === 'root')        void handleMoveToRoot(cid);
        clearDrag();
      }}
    />
  );

  const renderItem = (item: RowRecord, group: RowRecord[], groupKey: string, depth = 0): React.ReactNode => {
    const isActive       = selectedId === item.id;
    const isExpanded     = expandedFolders.has(item.id);
    const isDragging     = draggingId === item.id;
    const isDropBefore   = dropGroup === groupKey && dropBeforeId === item.id;
    const isNestTarget   = folderDropTarget === item.id;
    const children       = treeChildren(item.id);
    const hasChildren    = children.length > 0;
    const childGroupKey  = `children-${item.id}`;

    return (
      <React.Fragment key={item.id}>
        <div
          className={[
            'obsidian__nav-item',
            isActive     ? 'obsidian__nav-item--active'        : '',
            isDragging   ? 'obsidian__nav-item--dragging'      : '',
            isDropBefore ? 'obsidian__nav-item--drop-before'   : '',
            isNestTarget   ? 'obsidian__nav-item--folder-target'  : '',
            hasChildren    ? 'obsidian__nav-item--has-children'   : '',
          ].filter(Boolean).join(' ')}
          style={depth > 0 ? { paddingLeft: `${0.75 + depth * 0.75}rem` } : undefined}
          onClick={() => void handleSelect(item.id)}
          draggable
          onDragStart={(e) => {
            e.dataTransfer.effectAllowed = 'move';
            draggingIdRef.current = item.id;
            setDraggingId(item.id);
          }}
          onDragEnd={clearDrag}
          onDragOver={(e) => {
            const cid = draggingIdRef.current;
            if (cid === null || cid === item.id) return;
            const dragged = allRecords.find((r) => r.id === cid);
            if (!dragged) return;
            e.preventDefault();
            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
            const inTopHalf = (e.clientY - rect.top) < rect.height / 2;
            if (inTopHalf) {
              setDropBeforeId(item.id); setDropGroup(groupKey); setFolderDropTarget(null);
            } else {
              setFolderDropTarget(item.id); setDropBeforeId(null); setDropGroup(null);
            }
          }}
          onDrop={(e) => {
            e.preventDefault();
            const cid = draggingIdRef.current;
            if (cid === null || cid === item.id) { clearDrag(); return; }
            const dragged = allRecords.find((r) => r.id === cid);
            if (!dragged) { clearDrag(); return; }
            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
            const inTopHalf = (e.clientY - rect.top) < rect.height / 2;
            const g = getGroup(dragged);
            if (inTopHalf) {
              if (g.key === groupKey) void handleReorder(cid, item.id, group);
              else void handleMoveBefore(cid, item, group);
            } else {
              void handleMoveUnder(cid, item.id);
            }
            clearDrag();
          }}
        >
          <span
            className="obsidian__nav-icon-wrap"
            onClick={hasChildren ? (e) => {
              e.stopPropagation();
              setExpandedFolders((prev) => {
                const next = new Set(prev);
                if (next.has(item.id)) next.delete(item.id); else next.add(item.id);
                return next;
              });
            } : undefined}
          >
            {item[ICON_COL] ? (
              <span className="obsidian__nav-icon obsidian__nav-icon--note obsidian__nav-icon--emoji">
                {String(item[ICON_COL])}
              </span>
            ) : (
              <span className="material-icons obsidian__nav-icon obsidian__nav-icon--note">
                {itemIcon(String(item[TYPE_COL] ?? T_NOTE))}
              </span>
            )}
            {hasChildren && (
              <span className="material-icons obsidian__nav-icon obsidian__nav-icon--caret">
                {isExpanded ? 'expand_more' : 'chevron_right'}
              </span>
            )}
          </span>
          <span className="obsidian__nav-label">
            {String(item[TITLE_COL] ?? '') || 'Sans titre'}
          </span>
          <button
            className="obsidian__note-add-sub"
            onClick={(e) => { e.stopPropagation(); void handleNewNote(item.id); }}
            title="Nouvelle sous-note"
          >
            <span className="material-icons">add</span>
          </button>
          <button
            className="obsidian__note-menu-btn"
            onMouseDown={(e) => {
              e.stopPropagation();
              e.preventDefault();
              if (menuOpenId === item.id) { setMenuOpenId(null); setMenuPos(null); return; }
              const rect = e.currentTarget.getBoundingClientRect();
              setMenuPos({ top: rect.bottom + 4, left: rect.left });
              setMenuOpenId(item.id);
            }}
          >
            <span className="material-icons">more_horiz</span>
          </button>
          {menuOpenId === item.id && menuPos && createPortal(
            <div className="obsidian__item-menu" style={{ top: menuPos.top, left: menuPos.left }}>
              <button
                className="obsidian__item-menu__action"
                onMouseDown={(e) => { e.preventDefault(); void handleArchive(item.id); }}
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
            {children.map((child) => renderItem(child, children, childGroupKey, depth + 1))}
            {renderDropEnd(childGroupKey, children)}
          </>
        )}
      </React.Fragment>
    );
  };

  // Archive tree item (no drag, no add-sub, no menu)
  const renderArchivedItem = (item: RowRecord, depth = 0): React.ReactNode => {
    const isActive   = selectedId === item.id;
    const isExpanded = expandedFolders.has(item.id);
    const children   = archivedChildren(item.id);
    const hasChildren = children.length > 0;
    return (
      <React.Fragment key={item.id}>
        <div
          className={['obsidian__nav-item', 'obsidian__nav-item--no-actions', isActive ? 'obsidian__nav-item--active' : '', hasChildren ? 'obsidian__nav-item--has-children' : ''].filter(Boolean).join(' ')}
          style={depth > 0 ? { paddingLeft: `${0.75 + depth * 0.75}rem` } : undefined}
          onClick={() => void handleSelect(item.id)}
        >
          <span
            className="obsidian__nav-icon-wrap"
            onClick={hasChildren ? (e) => {
              e.stopPropagation();
              setExpandedFolders((prev) => { const n = new Set(prev); n.has(item.id) ? n.delete(item.id) : n.add(item.id); return n; });
            } : undefined}
          >
            {item[ICON_COL] ? (
              <span className="obsidian__nav-icon obsidian__nav-icon--note obsidian__nav-icon--emoji">{String(item[ICON_COL])}</span>
            ) : (
              <span className="material-icons obsidian__nav-icon obsidian__nav-icon--note">{itemIcon(String(item[TYPE_COL] ?? T_NOTE))}</span>
            )}
            {hasChildren && (
              <span className="material-icons obsidian__nav-icon obsidian__nav-icon--caret">
                {isExpanded ? 'expand_more' : 'chevron_right'}
              </span>
            )}
          </span>
          <span className="obsidian__nav-label">{String(item[TITLE_COL] ?? '') || 'Sans titre'}</span>
        </div>
        {hasChildren && isExpanded && children.map((child) => renderArchivedItem(child, depth + 1))}
      </React.Fragment>
    );
  };

  // Flat item (daily / archive / tags views — no drag)
  const renderFlatItem = (item: RowRecord, subtitle?: string) => (
    <div
      key={item.id}
      className={`obsidian__nav-item${selectedId === item.id ? ' obsidian__nav-item--active' : ''}`}
      onClick={() => void handleSelect(item.id)}
    >
      <span className="material-icons obsidian__nav-icon">
        {itemIcon(String(item[TYPE_COL] ?? T_NOTE))}
      </span>
      <div className="obsidian__nav-flat-meta">
        <span className="obsidian__nav-label">{String(item[TITLE_COL] ?? '') || 'Sans titre'}</span>
        {subtitle && <span className="obsidian__nav-subtitle">{subtitle}</span>}
      </div>
    </div>
  );

  // Notes-section content based on active view
  const renderNotesContent = () => {
    if (activeView === 'daily') {
      if (dailyItems.length === 0) return <div className="obsidian__empty-list">Aucune note daily</div>;
      return <>{dailyItems.map((r) => renderFlatItem(r, formatDate(r[CREATED_COL])))}</>;
    }

    if (activeView === 'archive') {
      if (archivedRootItems.length === 0) return <div className="obsidian__empty-list">Aucun élément archivé</div>;
      return <>{archivedRootItems.map((r) => renderArchivedItem(r))}</>;
    }

    // Notes: tree
    if (rootItems.length === 0) return <div className="obsidian__empty-list">Aucune note</div>;
    return (
      <>
        {rootItems.map((item) => renderItem(item, rootItems, 'root'))}
        {renderDropEnd('root', rootItems)}
      </>
    );
  };

  // ── JSX ────────────────────────────────────────────────────────────────────

  return (
    <div className="obsidian__root">
      {sidebarOpen && <div className="obsidian__nav-overlay" onClick={() => setSidebarOpen(false)} />}
      <aside className={`obsidian__sidebar${sidebarOpen ? ' obsidian__sidebar--open' : ''}`}>

        {/* ── NOTES ── */}
        <div className="obsidian__notes-section">
          <div className="obsidian__nav-section-header">
            <span className="obsidian__nav-section-label">
              {STATIC_VIEWS.find((v) => v.id === activeView)?.label}
            </span>
            {activeView === 'notes' && (
              <button
                className="obsidian__nav-section-btn"
                onClick={() => void handleNewNote()}
                title="Nouvelle note"
              >
                <span className="material-icons">add</span>
              </button>
            )}
            {activeView === 'daily' && (
              <button
                className="obsidian__nav-section-btn"
                onClick={() => void handleNewDaily()}
                title="Nouvelle daily note"
              >
                <span className="material-icons">add</span>
              </button>
            )}
          </div>
          {renderNotesContent()}
        </div>

        {/* ── BOTTOM VIEW TABS ── */}
        <div className="obsidian__view-tabs">
          {STATIC_VIEWS.map((view) => (
            <button
              key={view.id}
              className={`obsidian__view-tab${activeView === view.id ? ' obsidian__view-tab--active' : ''}`}
              onClick={() => setActiveView(view.id)}
              data-tooltip={view.label}
            >
              <span className="material-icons">{view.icon}</span>
            </button>
          ))}
          <button
            className="obsidian__daily-create-btn"
            onClick={() => void handleNewDaily()}
            title="Nouvelle daily note"
          >
            <span className="material-icons">calendar_today</span>
          </button>
        </div>

      </aside>

      <main className="obsidian__main">
        {saveStatus !== 'idle' && (
          <div className={`obsidian__save-status obsidian__save-status--${saveStatus}`}>
            <span className="material-icons">
              {saveStatus === 'saving' ? 'sync' : 'check_circle'}
            </span>
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
            focusEnd={focusEnd}
          />
        ) : (
          <div className="obsidian__no-selection">
            <button className="obsidian__nav-toggle obsidian__nav-toggle--no-selection" onClick={() => setSidebarOpen(true)} aria-label="Menu">
              <span className="material-icons">menu</span>
            </button>
            <span className="material-icons obsidian__no-selection-icon">edit_note</span>
            <p>Sélectionnez une note ou créez-en une nouvelle</p>
            <button className="obsidian__create-btn" onClick={() => void handleNewNote()}>
              <span className="material-icons">add</span>
              Nouvelle note
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
