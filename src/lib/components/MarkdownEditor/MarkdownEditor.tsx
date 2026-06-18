import './MarkdownEditor.scss';
import { useCallback, useEffect, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { Markdown } from 'tiptap-markdown';

interface MarkdownEditorProps {
  icon: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  onBlur: () => void;
  readOnly?: boolean;
  /** Changing this value forces the editor content to sync even if userEdited is true (e.g. on record switch). */
  resetToken?: string | number | null;
}

/** A single toolbar button. Uses a Material Icon when `icon` is set, or a text label when `text` is set. */
function TbBtn({
  icon,
  text,
  title,
  active,
  onClick,
}: {
  icon?: string;
  text?: string;
  title: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`rte-toolbar__btn${active ? ' rte-toolbar__btn--active' : ''}`}
      title={title}
      onMouseDown={(e) => {
        e.preventDefault(); // keep editor focus
        onClick();
      }}
    >
      {icon ? <span className="material-icons">{icon}</span> : <span className="rte-toolbar__text">{text}</span>}
    </button>
  );
}

export function MarkdownEditor({ icon, label, value, onChange, onBlur, readOnly, resetToken }: MarkdownEditorProps) {
  // Track whether the content was changed by the user (not programmatic updates)
  const userEdited = useRef(false);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: 'Écrire une note…' }),
      Markdown.configure({
        html: false,
        transformPastedText: true,
        transformCopiedText: true,
      }),
    ],
    content: value || '',
    editable: !readOnly,
    onUpdate: ({ editor: ed }) => {
      userEdited.current = true;
      const md = (ed.storage as unknown as { markdown: { getMarkdown: () => string } }).markdown.getMarkdown();
      onChange(md);
    },
  });

  // Sync external value changes (e.g. initial load from Grist, record switch) into the editor
  const prevValue = useRef(value);
  const prevResetToken = useRef(resetToken);
  useEffect(() => {
    if (!editor) return;
    const tokenChanged = resetToken !== prevResetToken.current;
    prevResetToken.current = resetToken;
    if (tokenChanged || (value !== prevValue.current && !userEdited.current)) {
      userEdited.current = false;
      editor.commands.setContent(value || '');
    }
    prevValue.current = value;
  }, [value, editor, resetToken]);

  // Save on blur
  const handleBlur = useCallback(() => {
    if (userEdited.current) {
      userEdited.current = false;
      onBlur();
    }
  }, [onBlur]);

  useEffect(() => {
    if (!editor) return;
    editor.on('blur', handleBlur);
    return () => { editor.off('blur', handleBlur); };
  }, [editor, handleBlur]);

  return (
    <div className="markdown-editor">
      <div className="markdown-editor__header">
        <div className="markdown-editor__title">
          <span className="material-icons">{icon}</span>
          <span>{label}</span>
        </div>
      </div>

      <div className={`markdown-editor__body${readOnly ? ' markdown-editor__body--readonly' : ''}`}>
        {editor && !readOnly && (
          <BubbleMenu editor={editor} options={{ placement: 'top', offset: 8 }}>
            <div className="rte-bubble">
              <TbBtn
                icon="format_bold"
                title="Gras"
                active={editor.isActive('bold')}
                onClick={() => editor.chain().focus().toggleBold().run()}
              />
              <TbBtn
                text="H1"
                title="Titre 1"
                active={editor.isActive('heading', { level: 1 })}
                onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
              />
              <TbBtn
                text="H2"
                title="Titre 2"
                active={editor.isActive('heading', { level: 2 })}
                onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
              />
              <TbBtn
                icon="format_list_bulleted"
                title="Liste à puces"
                active={editor.isActive('bulletList')}
                onClick={() => editor.chain().focus().toggleBulletList().run()}
              />
              <TbBtn
                icon="format_list_numbered"
                title="Liste numérotée"
                active={editor.isActive('orderedList')}
                onClick={() => editor.chain().focus().toggleOrderedList().run()}
              />
              <TbBtn
                icon="format_quote"
                title="Citation"
                active={editor.isActive('blockquote')}
                onClick={() => editor.chain().focus().toggleBlockquote().run()}
              />
              <TbBtn
                icon="horizontal_rule"
                title="Séparateur"
                onClick={() => editor.chain().focus().setHorizontalRule().run()}
              />
            </div>
          </BubbleMenu>
        )}
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
