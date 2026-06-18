import React from 'react';
import type { ProjetColor, ActiveFilter, DragTarget, SectionKey } from './types';
import { SECTIONS } from './types';

interface TodoNavProps {
  navOpen: boolean;
  onNavClose: () => void;
  activeFilter: ActiveFilter;
  onFilterChange: (f: ActiveFilter) => void;
  draggingId: number | null;
  dragTarget: DragTarget;
  onDragTarget: (t: DragTarget) => void;
  onClearDropIndicator: () => void;
  projetEntries: string[];
  projetColorMap: Map<string, ProjetColor>;
  navCounts: Record<string, number>;
  onDrop: (target: DragTarget) => void;
}

export function TodoNav({
  navOpen,
  onNavClose,
  activeFilter,
  onFilterChange,
  draggingId,
  dragTarget,
  onDragTarget,
  onClearDropIndicator,
  projetEntries,
  projetColorMap,
  navCounts,
  onDrop,
}: TodoNavProps) {
  const isSectionActive = (key: SectionKey) =>
    activeFilter.type === 'section' && activeFilter.key === key;

  const isDragOverSection = (key: SectionKey) =>
    dragTarget?.type === 'section' && dragTarget.key === key;

  const isProjectActive = (id: string) =>
    activeFilter.type === 'project' && activeFilter.id === id;

  const isDragOverProject = (id: string) =>
    dragTarget?.type === 'project' && dragTarget.id === id;

  return (
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
            onClick={() => { onFilterChange({ type: 'section', key: section.key }); onNavClose(); }}
            onDragOver={noDrop ? undefined : (e) => {
              e.preventDefault();
              if (draggingId === null) return;
              onDragTarget({ type: 'section', key: section.key });
              onClearDropIndicator();
            }}
            onDragLeave={noDrop ? undefined : () => onDragTarget(null)}
            onDrop={noDrop ? undefined : (e) => { e.preventDefault(); onDrop({ type: 'section', key: section.key }); }}
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
                onClick={() => { onFilterChange({ type: 'project', id: name, label: name }); onNavClose(); }}
                onDragOver={(e) => {
                  e.preventDefault();
                  if (draggingId === null) return;
                  onDragTarget({ type: 'project', id: name });
                  onClearDropIndicator();
                }}
                onDragLeave={() => onDragTarget(null)}
                onDrop={(e) => { e.preventDefault(); onDrop({ type: 'project', id: name }); }}
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
  );
}
