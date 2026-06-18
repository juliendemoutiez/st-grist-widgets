import React, { useEffect, useLayoutEffect, useRef } from 'react';
import type { RowRecord } from 'grist-plugin-api';
import { decodeChoiceList } from '@grist-widgets/ui';
import type { ProjetColor, ActiveFilter } from './types';
import {
  NAME_COL, DONE_COL, DUE_COL, PROJET_COL, LISTE_COL,
  SUBTASKS_COL, ETIQUETTES_COL, PRIORITE_COL,
} from './types';

// ─── Utilities ────────────────────────────────────────────────────────────────

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

export function parseSubtasks(raw: unknown): { text: string; done: boolean }[] {
  try {
    const parsed = JSON.parse(typeof raw === 'string' ? raw : '[]');
    if (Array.isArray(parsed)) return parsed;
  } catch {}
  return [];
}

export function parseDueDate(value: unknown): Date | null {
  if (value == null || value === 0 || value === '') return null;
  if (typeof value === 'number') return new Date(value * 1000);
  if (typeof value === 'string') {
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

export function formatDate(d: Date): string {
  return d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
}

type DueStatus = 'overdue' | 'soon' | 'ok';

export function dueStatus(d: Date): DueStatus {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(d);
  target.setHours(0, 0, 0, 0);
  const diffDays = (target.getTime() - today.getTime()) / 86_400_000;
  if (diffDays < 0) return 'overdue';
  if (diffDays <= 3) return 'soon';
  return 'ok';
}

// ─── TaskNameSpan ─────────────────────────────────────────────────────────────

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

// ─── DropdownMenu ─────────────────────────────────────────────────────────────

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

// ─── TaskItem ─────────────────────────────────────────────────────────────────

const PRIORITY_DEFAULTS: Record<string, string> = { P1: '#ef4444', P2: '#f97316', P3: '#3b82f6' };

export interface TaskItemProps {
  record: RowRecord;
  isDragging: boolean;
  isSelected: boolean;
  isDropBefore: boolean;
  isMenuOpen: boolean;
  isEditing: boolean;
  allowReorder: boolean;
  draggingId: number | null;
  nextItemId: number | 'end';
  projetColorMap: Map<string, ProjetColor>;
  activeFilter: ActiveFilter;
  onToggle: (done: boolean) => void;
  onDelete: () => void;
  onSelect: () => void;
  onStartEdit: () => void;
  onSaveEdit: (text: string) => void;
  onCancelEdit: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  onSetDropIndicator: (id: number | 'end') => void;
  onClearDragTarget: () => void;
  onDrop: () => void;
  onFilterByTag: (tag: string) => void;
  onFilterByProject: (name: string) => void;
  onMenuOpen: () => void;
  onMenuClose: () => void;
}

export function TaskItem({
  record,
  isDragging,
  isSelected,
  isDropBefore,
  isMenuOpen,
  isEditing,
  allowReorder,
  draggingId,
  nextItemId,
  projetColorMap,
  activeFilter,
  onToggle,
  onDelete,
  onSelect,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onDragStart,
  onDragEnd,
  onSetDropIndicator,
  onClearDragTarget,
  onDrop,
  onFilterByTag,
  onFilterByProject,
  onMenuOpen,
  onMenuClose,
}: TaskItemProps) {
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
  const priorityColor = priority ? (PRIORITY_DEFAULTS[priority] ?? null) : null;
  const isNew = isEditing && name === '';
  const listeValue = String(record[LISTE_COL] ?? '');
  const showListeChip = activeFilter.type === 'project' && (listeValue === "Aujourd'hui" || listeValue === 'Prochainement');

  return (
    <li
      className={[
        'todo-widget__item',
        isDragging ? 'todo-widget__item--dragging' : '',
        isSelected ? 'todo-widget__item--selected' : '',
        isDropBefore ? 'todo-widget__item--drop-before' : '',
        isMenuOpen ? 'todo-widget__item--menu-open' : '',
      ].filter(Boolean).join(' ')}
      draggable={!isEditing}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={allowReorder ? (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (draggingId === null || draggingId === record.id) return;
        const rect = e.currentTarget.getBoundingClientRect();
        onSetDropIndicator(e.clientY < rect.top + rect.height / 2 ? record.id : nextItemId);
        onClearDragTarget();
      } : undefined}
      onDrop={allowReorder ? (e) => {
        e.preventDefault();
        e.stopPropagation();
        onDrop();
      } : undefined}
      onMouseDown={isNew ? (e) => e.preventDefault() : undefined}
      onClick={isNew ? (e) => e.stopPropagation() : (e) => { e.stopPropagation(); onSelect(); }}
    >
      {!isNew && (
        <span className="todo-widget__drag-handle" aria-hidden="true">
          <span className="material-icons">drag_indicator</span>
        </span>
      )}

      <button
        className={`todo-widget__checkbox${isDone ? ' todo-widget__checkbox--checked' : ''}`}
        style={priority && !isDone && priorityColor ? { backgroundColor: `${priorityColor}18`, borderColor: priorityColor } : undefined}
        disabled={isEditing && name === ''}
        onClick={(e) => { e.stopPropagation(); onToggle(!isDone); }}
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
            isEditing={isEditing}
            onStartEdit={onStartEdit}
            onSave={onSaveEdit}
            onCancel={onCancelEdit}
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
                        onClick={(e) => { e.stopPropagation(); onFilterByTag(tag); }}
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
            <div className="todo-widget__chips-group">
              {showListeChip && (
                <span className="todo-widget__liste-chip" title={listeValue}>
                  <span className="material-icons">{listeValue === "Aujourd'hui" ? 'today' : 'schedule'}</span>
                </span>
              )}
              <span
                className="todo-widget__projet-chip"
                style={projetColor ? { backgroundColor: projetColor.fill, color: projetColor.text } : undefined}
                onClick={(e) => { e.stopPropagation(); onFilterByProject(projetName); }}
              >{projetName}</span>
            </div>
          )}
        </div>
      </div>

      {!isNew && (
        <div className="todo-widget__side">
          <div className="todo-widget__actions">
            <div className="todo-widget__menu-wrap">
              <button
                className="todo-widget__action-btn"
                onMouseDown={(e) => { e.stopPropagation(); isMenuOpen ? onMenuClose() : onMenuOpen(); }}
                onClick={(e) => e.stopPropagation()}
                aria-label="Plus d'options"
              >
                <span className="material-icons">more_horiz</span>
              </button>
              {isMenuOpen && (
                <DropdownMenu
                  onDelete={onDelete}
                  onClose={onMenuClose}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </li>
  );
}
