import { useCallback, useEffect, useRef, useState } from 'react';
import { MarkdownEditor, useGrist } from '@grist-widgets/ui';

interface CommentSectionProps {
  table: string;
  col: string;
  parentId: number;
  title: string;
  icon: string;
}

export function CommentSection({ table, col, parentId, title, icon }: CommentSectionProps) {
  const { fetchTable, updateRecord } = useGrist();
  const [value, setValue] = useState('');
  // Row whose comment is currently in `value`; used as the editor's resetToken so the editor
  // only resets once the new row's comment has loaded (not with the previous row's value).
  const [loadedId, setLoadedId] = useState<number | null>(null);
  const savedValue = useRef('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const t = await fetchTable(table);
        if (cancelled) return;
        const rowIdx = (t.id as number[]).indexOf(parentId);
        const raw = rowIdx === -1 ? null : (t[col] as unknown[])?.[rowIdx];
        const text = raw != null ? String(raw) : '';
        setValue(text);
        setLoadedId(parentId);
        savedValue.current = text;
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, [parentId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSave = useCallback(async () => {
    if (loadedId !== parentId) return;
    try {
      await updateRecord(table, parentId, { [col]: value });
      savedValue.current = value;
    } catch (err) {
      console.warn('[CommentSection] Failed to save:', err);
    }
  }, [table, col, parentId, loadedId, value, updateRecord]);

  return (
    <MarkdownEditor
      icon={icon}
      label={title}
      value={value}
      onChange={setValue}
      onBlur={handleSave}
      resetToken={loadedId}
    />
  );
}
