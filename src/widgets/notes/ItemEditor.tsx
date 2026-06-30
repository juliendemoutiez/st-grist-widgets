import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useEditor, EditorContent } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Mention from '@tiptap/extension-mention';
import { Markdown } from 'tiptap-markdown';
import type { RowRecord } from 'grist-plugin-api';
import { TITLE_COL, CONTENT_COL, ICON_COL, PARENT_COL, COMMON_EMOJIS, DEFAULT_ICON } from './constants';

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
        className="notes-mention-list"
        style={{ position: 'fixed', top: rect.bottom + 4, left: rect.left }}
      >
        {items.map((item, index) => (
          <button
            key={item.id}
            className={`notes-mention-list__item${index === selectedIndex ? ' notes-mention-list__item--selected' : ''}`}
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

// ─── Toolbar button ───────────────────────────────────────────────────────────

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

// ─── Emoji picker ─────────────────────────────────────────────────────────────

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
    <div className="notes__emoji-wrap" ref={wrapRef}>
      <button
        type="button"
        className={`notes__emoji-btn${open ? ' notes__emoji-btn--open' : ''}`}
        onClick={() => setOpen((o) => !o)}
        title="Choisir un emoji"
      >
        {value || '📝'}
      </button>
      {open && (
        <div className="notes__emoji-picker">
          {COMMON_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              className={`notes__emoji-option${emoji === value ? ' notes__emoji-option--active' : ''}`}
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

// ─── ItemEditor ───────────────────────────────────────────────────────────────

export function ItemEditor({ item, allRecords, onSaveTitle, onSaveContent, onSaveIcon, onNavigate, onOpenSidebar, focusEndKey }: {
  item: RowRecord;
  allRecords: RowRecord[];
  onSaveTitle: (t: string) => void;
  onSaveContent: (c: string) => void;
  onSaveIcon: (icon: string) => void;
  onNavigate: (id: number) => void;
  onOpenSidebar: () => void;
  focusEndKey?: number;
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

  const contentDraft      = useRef(String(item[CONTENT_COL] ?? ''));
  const userEditedContent = useRef(false);
  const autoSaveTimer     = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onSaveContentRef  = useRef(onSaveContent);
  const titleRef          = useRef<HTMLInputElement>(null);
  const allRecordsRef     = useRef(allRecords);

  useEffect(() => { onSaveContentRef.current = onSaveContent; }, [onSaveContent]);
  const [mentionState, setMentionState] = useState<MentionState | null>(null);
  const mentionListRef = useRef<MentionListHandle>(null);

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
        HTMLAttributes: { class: 'notes-mention' },
        renderHTML({ options, node }: { options: { HTMLAttributes: Record<string, unknown> }; node: { attrs: Record<string, unknown> } }) {
          const noteId = Number(node.attrs.id);
          const record = allRecordsRef.current.find(r => r.id === noteId);
          const emoji = record ? String(record[ICON_COL] ?? '') : '';
          const children: unknown[] = [];
          if (emoji) children.push(['span', { class: 'notes-mention__emoji' }, emoji]);
          children.push(['span', { class: 'notes-mention__label' }, String(node.attrs.label ?? '')]);
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

  // Reset editor content when navigating to a different note
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    if (autoSaveTimer.current) { clearTimeout(autoSaveTimer.current); autoSaveTimer.current = null; }
    userEditedContent.current = false;
    editor.commands.setContent(parseContent(item[CONTENT_COL]));
  }, [item.id, editor]);

  // Focus to end when parent increments focusEndKey (e.g. opening today's daily note)
  useEffect(() => {
    if (!editor || editor.isDestroyed || !focusEndKey) return;
    editor.commands.focus('end');
  }, [focusEndKey, editor]);

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
      <div className="notes__editor">
        <div className="notes__editor-inner">
          {breadcrumbs.length > 0 && (
            <div className="notes__breadcrumb">
              {breadcrumbs.map((p, i) => (
                <React.Fragment key={p.id}>
                  <button className="notes__breadcrumb-item" onClick={() => onNavigate(p.id)}>
                    {p[ICON_COL] && <span className="notes__breadcrumb-emoji">{String(p[ICON_COL])}</span>}
                    <span>{String(p[TITLE_COL] ?? '') || 'Sans titre'}</span>
                  </button>
                  {i < breadcrumbs.length - 1 && (
                    <span className="material-icons notes__breadcrumb-sep">chevron_right</span>
                  )}
                </React.Fragment>
              ))}
            </div>
          )}
          <div className="notes__title-row">
            <button className="notes__nav-toggle" onClick={onOpenSidebar} aria-label="Menu">
              <span className="material-icons">menu</span>
            </button>
            <EmojiPicker
              value={iconDraft}
              onChange={(emoji) => { setIconDraft(emoji); onSaveIcon(emoji); }}
            />
            <input
              ref={titleRef}
              className="notes__note-title"
              value={titleDraft}
              placeholder="Sans titre"
              onChange={(e) => setTitleDraft(e.target.value)}
              onBlur={handleTitleBlur}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); editor?.commands.focus('start'); }
              }}
            />
          </div>

          <div className="notes__tiptap-wrap" onClick={handleEditorClick}>
            {editor && (
              <BubbleMenu editor={editor} options={{ placement: 'top', offset: 8 }}>
                <div className="rte-bubble">
                  <TbBtn icon="format_bold"          title="Gras"            active={editor.isActive('bold')}                  onClick={() => editor.chain().focus().toggleBold().run()} />
                  <TbBtn icon="format_italic"        title="Italique"        active={editor.isActive('italic')}                onClick={() => editor.chain().focus().toggleItalic().run()} />
                  <TbBtn icon="format_strikethrough" title="Barré"           active={editor.isActive('strike')}                onClick={() => editor.chain().focus().toggleStrike().run()} />
                  <div className="rte-bubble__divider" />
                  <TbBtn text="H1" title="Titre 1"   active={editor.isActive('heading', { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} />
                  <TbBtn text="H2" title="Titre 2"   active={editor.isActive('heading', { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} />
                  <div className="rte-bubble__divider" />
                  <TbBtn icon="format_list_bulleted" title="Liste"           active={editor.isActive('bulletList')}            onClick={() => editor.chain().focus().toggleBulletList().run()} />
                  <TbBtn icon="format_list_numbered" title="Liste numérotée" active={editor.isActive('orderedList')}           onClick={() => editor.chain().focus().toggleOrderedList().run()} />
                  <TbBtn icon="format_quote"         title="Citation"        active={editor.isActive('blockquote')}            onClick={() => editor.chain().focus().toggleBlockquote().run()} />
                  <TbBtn icon="code"                 title="Code"            active={editor.isActive('code')}                  onClick={() => editor.chain().focus().toggleCode().run()} />
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
