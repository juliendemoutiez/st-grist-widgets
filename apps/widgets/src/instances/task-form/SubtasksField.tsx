import { useState, useEffect, useRef, useCallback } from 'react';
import type React from 'react';
import { useGrist } from '@grist-widgets/ui';

const SUBTASKS_COL = 'Sous_taches';

interface Subtask { text: string; done: boolean; }

function parse(raw: unknown): Subtask[] {
  try {
    const parsed = JSON.parse(typeof raw === 'string' ? raw : '[]');
    if (Array.isArray(parsed)) return parsed;
  } catch {}
  return [];
}

export function SubtasksField({ parentId }: { parentId: number }) {
  const { fetchTable, updateRecord } = useGrist();
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [newText, setNewText] = useState('');
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null);
  const [dropIndicatorIdx, setDropIndicatorIdx] = useState<number | null>(null);
  const newInputRef = useRef<HTMLInputElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetchTable('Taches').then((table) => {
      const idx = (table.id as number[]).indexOf(parentId);
      if (idx === -1) return;
      setSubtasks(parse((table[SUBTASKS_COL] as unknown[])?.[idx]));
    }).catch(() => {});
  }, [fetchTable, parentId]);

  useEffect(() => {
    if (editingIdx !== null) editInputRef.current?.focus();
  }, [editingIdx]);

  const save = useCallback((list: Subtask[]) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      updateRecord('Taches', parentId, { [SUBTASKS_COL]: JSON.stringify(list) }).catch(() => {});
    }, 300);
  }, [updateRecord, parentId]);

  const handleToggle = (idx: number) => {
    const next = subtasks.map((t, i) => i === idx ? { ...t, done: !t.done } : t);
    setSubtasks(next); save(next);
  };

  const handleDelete = (idx: number) => {
    const next = subtasks.filter((_, i) => i !== idx);
    setSubtasks(next); save(next);
    if (editingIdx === idx) setEditingIdx(null);
  };

  const startEdit = (idx: number) => {
    setEditingIdx(idx);
    setEditValue(subtasks[idx].text);
  };

  const commitEdit = (idx: number, value: string) => {
    const text = value.trim();
    setEditingIdx(null);
    if (!text) {
      const next = subtasks.filter((_, i) => i !== idx);
      setSubtasks(next); save(next);
    } else {
      const next = subtasks.map((t, i) => i === idx ? { ...t, text } : t);
      setSubtasks(next); save(next);
    }
  };

  const handleAdd = useCallback(() => {
    const text = newText.trim();
    if (!text) return;
    const next = [...subtasks, { text, done: false }];
    setNewText(''); setSubtasks(next); save(next);
    setTimeout(() => newInputRef.current?.focus(), 0);
  }, [newText, subtasks, save]);

  // ─── Drag and drop ────────────────────────────────────────────────────────

  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (draggingIdx === null) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setDropIndicatorIdx(e.clientY < rect.top + rect.height / 2 ? idx : idx + 1);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (draggingIdx === null || dropIndicatorIdx === null) { setDraggingIdx(null); setDropIndicatorIdx(null); return; }
    const list = [...subtasks];
    const [item] = list.splice(draggingIdx, 1);
    const at = dropIndicatorIdx > draggingIdx ? dropIndicatorIdx - 1 : dropIndicatorIdx;
    list.splice(at, 0, item);
    setSubtasks(list); save(list);
    setDraggingIdx(null); setDropIndicatorIdx(null);
  };

  const handleDragEnd = () => { setDraggingIdx(null); setDropIndicatorIdx(null); };

  return (
    <div className="subtasks-field">
      <div className="subtasks-field__header">
        <span className="material-icons">checklist</span>
        <span>Sous-tâches</span>
      </div>

      {subtasks.map((task, idx) => (
        <div
          key={idx}
          className={[
            'subtasks-field__item',
            draggingIdx === idx ? 'subtasks-field__item--dragging' : '',
            dropIndicatorIdx === idx ? 'subtasks-field__item--drop-before' : '',
          ].filter(Boolean).join(' ')}
          draggable={editingIdx !== idx}
          onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; setDraggingIdx(idx); }}
          onDragEnd={handleDragEnd}
          onDragOver={(e) => handleDragOver(e, idx)}
          onDrop={handleDrop}
        >
          <span className="subtasks-field__drag-handle">
            <span className="material-icons">drag_indicator</span>
          </span>
          <button
            className={`subtasks-field__checkbox${task.done ? ' subtasks-field__checkbox--checked' : ''}`}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => handleToggle(idx)}
          >
            <span className="material-icons">check</span>
          </button>
          {editingIdx === idx ? (
            <input
              ref={editInputRef}
              className="subtasks-field__edit-input"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); commitEdit(idx, editValue); }
                if (e.key === 'Escape') setEditingIdx(null);
              }}
              onBlur={() => commitEdit(idx, editValue)}
            />
          ) : (
            <span
              className={`subtasks-field__name${task.done ? ' subtasks-field__name--done' : ''}`}
              onClick={() => startEdit(idx)}
            >
              {task.text}
            </span>
          )}
          <button className="subtasks-field__delete" onMouseDown={(e) => e.preventDefault()} onClick={() => handleDelete(idx)}>
            <span className="material-icons">close</span>
          </button>
        </div>
      ))}

      <div
        className={`subtasks-field__add-row${dropIndicatorIdx === subtasks.length ? ' subtasks-field__add-row--drop-before' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDropIndicatorIdx(subtasks.length); }}
        onDrop={handleDrop}
      >
        <span className="subtasks-field__drag-handle-placeholder" aria-hidden="true" />
        <span className="subtasks-field__checkbox subtasks-field__checkbox--placeholder" aria-hidden="true" />
        <input
          ref={newInputRef}
          className="subtasks-field__input"
          type="text"
          placeholder="Ajouter une sous-tâche..."
          value={newText}
          onChange={(e) => setNewText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); handleAdd(); }
            if (e.key === 'Escape') setNewText('');
          }}
          onBlur={handleAdd}
        />
      </div>
    </div>
  );
}
