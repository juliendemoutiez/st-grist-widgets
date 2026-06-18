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
  const { fetchTable, updateRecord, dataVersion } = useGrist();
  const [value, setValue] = useState('');
  const savedValue = useRef('');

  useEffect(() => {
    (async () => {
      try {
        const t = await fetchTable(table);
        const rowIdx = (t.id as number[]).indexOf(parentId);
        if (rowIdx === -1) return;
        const raw = (t[col] as unknown[])?.[rowIdx];
        const text = raw != null ? String(raw) : '';
        setValue(text);
        savedValue.current = text;
      } catch { /* ignore */ }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parentId, dataVersion]);

  const handleSave = useCallback(async () => {
    try {
      await updateRecord(table, parentId, { [col]: value });
      savedValue.current = value;
    } catch (err) {
      console.warn('[CommentSection] Failed to save:', err);
    }
  }, [table, col, parentId, value, updateRecord]);

  return (
    <MarkdownEditor
      icon={icon}
      label={title}
      value={value}
      onChange={setValue}
      onBlur={handleSave}
      resetToken={parentId}
    />
  );
}
