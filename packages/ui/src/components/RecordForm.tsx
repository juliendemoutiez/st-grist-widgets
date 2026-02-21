import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ScreenShell } from './ScreenShell';
import { MetaField } from './MetaField';
import { MarkdownEditor } from './MarkdownEditor';
import { useNavigation } from '../contexts/NavigationContext';
import { useGrist } from '../contexts/GristContext';
import { useColumnMeta } from '../hooks/useColumnMeta';
import { useRelativeDate } from '../hooks/useRelativeDate';
import type { FormConfig } from '../types';

interface RecordFormProps {
  config: FormConfig;
  /**
   * - `currentRecord`: reads the currently selected Grist record and auto-saves
   *   each field change via `updateCurrentRecord`.
   * - `subForm`: reads `editId`/`editLabel` from navigation props, auto-saves
   *   each field change when editing, or creates the record on back when new.
   */
  mode: 'currentRecord' | 'subForm';
  /** Optional render prop receiving the current record's Grist row ID. */
  children?: (recordId: number) => ReactNode;
}

export function RecordForm({ config, mode, children }: RecordFormProps) {
  const { record, updateCurrentRecord, fetchTable, createRecord, updateRecord, setCursorPos } = useGrist();
  const columnMeta = useColumnMeta(config.table);
  const { push, pop, resetToRoot, stack, popResult, clearPopResult } = useNavigation();

  const [title, setTitle] = useState('');
  const [fields, setFields] = useState<Record<string, unknown>>({});
  const [refReloadKey, setRefReloadKey] = useState(0);

  // Refs to always access the latest values from blur/save callbacks
  const titleRef = useRef(title);
  titleRef.current = title;
  const fieldsRef = useRef(fields);
  fieldsRef.current = fields;

  // Track which Ref field triggered the last sub-form push
  const pendingRefColId = useRef<string | null>(null);
  // Track the stack depth at push time so we only consume popResult from our direct child
  const pendingRefPushDepth = useRef<number | null>(null);

  // Track which fields the user actually changed (to avoid re-saving fetched internal values)
  const dirtyFields = useRef(new Set<string>());

  // --- Sub-form mode: read editId / editLabel from nav props ---
  const navProps = stack[stack.length - 1]?.props;
  const editId = mode === 'subForm' ? (navProps?.editId as string | undefined) : undefined;
  const editLabel = mode === 'subForm' ? (navProps?.editLabel as string | undefined) : undefined;
  const parentTable = mode === 'subForm' ? (navProps?.parentTable as string | undefined) : undefined;
  const parentRecordId = mode === 'subForm' ? (navProps?.parentRecordId as string | undefined) : undefined;
  const parentColId = mode === 'subForm' ? (navProps?.parentColId as string | undefined) : undefined;
  const initialFields = mode === 'subForm' ? (navProps?.initialFields as Record<string, unknown> | undefined) : undefined;

  // For subForm mode: the Grist row ID (known for editing, acquired after creation)
  const subFormRecordId = useRef<number | null>(editId ? Number(editId) : null);
  // Promise that resolves once the subForm record is ready (created or loaded).
  // Saves await this so they never run before the record exists.
  const subFormReady = useRef<Promise<void>>(
    subFormRecordId.current != null ? Promise.resolve() : new Promise(() => {}),
  );
  // Guard against React StrictMode double-firing the creation effect
  const subFormInitStarted = useRef(false);

  // --- Data loading ---

  // currentRecord mode: if the selected record changes while on a sub-form, pop back to root
  const recordId = mode === 'currentRecord' ? (record?.id ?? null) : null;
  const prevRecordId = useRef(recordId);
  useEffect(() => {
    if (mode !== 'currentRecord') return;
    if (prevRecordId.current != null && recordId !== prevRecordId.current && stack.length > 1) {
      resetToRoot();
    }
    prevRecordId.current = recordId;
  }, [mode, recordId, stack.length, resetToRoot]);
  useEffect(() => {
    if (mode !== 'currentRecord' || recordId == null) return;

    (async () => {
      try {
        const table = await fetchTable(config.table);
        const rowIdx = table.id.indexOf(recordId);
        if (rowIdx === -1) return;

        setTitle(
          table[config.titleColId]?.[rowIdx] != null
            ? String((table[config.titleColId] as unknown[])[rowIdx])
            : '',
        );
        const vals: Record<string, unknown> = {};
        for (const f of config.fields) {
          const col = table[f.colId] as unknown[] | undefined;
          vals[f.colId] = col?.[rowIdx] ?? null;
        }
        console.log(`[RecordForm] Field values from ${config.table}:`, vals);
        setFields(vals);
      } catch (err) {
        console.warn(`[RecordForm] Failed to fetch full row from ${config.table}:`, err);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [record]);

  // subForm mode: initialize from nav props
  // - editing: fetch existing field values
  // - creating: create the record immediately so every change auto-saves
  useEffect(() => {
    if (mode !== 'subForm') return;
    if (subFormInitStarted.current) return;
    subFormInitStarted.current = true;
    setTitle(editLabel ?? '');

    let resolveReady: () => void;
    subFormReady.current = new Promise<void>((r) => { resolveReady = r; });

    (async () => {
      if (editId) {
        // Editing: load current values
        try {
          const table = await fetchTable(config.table);
          const rowIdx = table.id.indexOf(Number(editId));
          if (rowIdx === -1) return;

          // Load title from fetched data (useful for computed columns like Nom_complet)
          const titleVal = table[config.titleColId]?.[rowIdx];
          if (titleVal != null) {
            setTitle(String(titleVal));
          }

          const vals: Record<string, unknown> = {};
          for (const f of config.fields) {
            const col = table[f.colId] as unknown[] | undefined;
            vals[f.colId] = col?.[rowIdx] ?? null;
          }
          setFields(vals);
        } catch (err) {
          console.warn(`[RecordForm] Failed to fetch existing record from ${config.table}:`, err);
        }
      } else {
        // Creating: insert a new row right away with the default title
        try {
          const newId = await createRecord(config.table, {
            ...(config.titleReadOnly ? {} : { [config.titleColId]: config.titleDefault }),
            ...initialFields,
          });
          subFormRecordId.current = newId;

          // Immediately link the new record to the parent's Ref field
          if (parentTable && parentRecordId && parentColId) {
            await updateRecord(parentTable, Number(parentRecordId), { [parentColId]: newId });
          }

          // Re-fetch the newly created record to populate read-only/formula fields
          try {
            const table = await fetchTable(config.table);
            const rowIdx = table.id.indexOf(newId);
            if (rowIdx !== -1) {
              const titleVal = table[config.titleColId]?.[rowIdx];
              if (titleVal != null) setTitle(String(titleVal));
              const vals: Record<string, unknown> = {};
              for (const f of config.fields) {
                const col = table[f.colId] as unknown[] | undefined;
                vals[f.colId] = col?.[rowIdx] ?? null;
              }
              setFields(vals);
            }
          } catch (err) {
            console.warn(`[RecordForm] Failed to fetch new record from ${config.table}:`, err);
          }
        } catch (err) {
          console.warn(`[RecordForm] Failed to create record in ${config.table}:`, err);
        }
      }
      resolveReady!();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Saving ---

  // When a titleFormula is defined, derive the displayed title from field values
  useEffect(() => {
    if (config.titleFormula) {
      setTitle(config.titleFormula(fields));
    }
  }, [fields, config.titleFormula]);

  // Re-fetch the title from Grist (for computed/formula title columns)
  const refreshTitle = useCallback(async (rowId: number) => {
    if (!config.titleReadOnly) return;
    if (config.titleFormula) return; // title is derived from field state, not from Grist
    try {
      const table = await fetchTable(config.table);
      const rowIdx = table.id.indexOf(rowId);
      if (rowIdx === -1) return;
      const titleVal = table[config.titleColId]?.[rowIdx];
      if (titleVal != null) setTitle(String(titleVal));
    } catch { /* ignore */ }
  }, [fetchTable, config.table, config.titleColId, config.titleReadOnly]);

  // Persist a single field to Grist (reads latest value from ref)
  const saveField = useCallback(
    async (colId: string) => {
      if (mode === 'currentRecord') {
        try {
          await updateCurrentRecord({ [colId]: fieldsRef.current[colId] });
          if (recordId != null) await refreshTitle(recordId);
        } catch (err) {
          console.warn(`Failed to save field ${colId}:`, err);
        }
      } else {
        // Wait for the record to be created/loaded before updating
        await subFormReady.current;
        if (subFormRecordId.current != null) {
          try {
            await updateRecord(config.table, subFormRecordId.current, { [colId]: fieldsRef.current[colId] });
            await refreshTitle(subFormRecordId.current);
          } catch (err) {
            console.warn(`Failed to save field ${colId}:`, err);
          }
        }
      }
    },
    [mode, updateCurrentRecord, updateRecord, config.table, recordId, refreshTitle],
  );

  // Persist the title to Grist (reads latest value from ref)
  const saveTitle = useCallback(async () => {
    if (config.titleReadOnly) return;
    // Save the default to Grist if the title is empty, but keep local state empty
    // so the CSS pseudo-element handles the display
    const value = titleRef.current.trim() || config.titleDefault;
    if (mode === 'currentRecord') {
      try {
        await updateCurrentRecord({ [config.titleColId]: value });
      } catch (err) {
        console.warn(`Failed to save title:`, err);
      }
    } else {
      await subFormReady.current;
      if (subFormRecordId.current != null) {
        try {
          await updateRecord(config.table, subFormRecordId.current, { [config.titleColId]: value });
        } catch (err) {
          console.warn(`Failed to save title:`, err);
        }
      }
    }
  }, [mode, updateCurrentRecord, updateRecord, config.table, config.titleColId, config.titleDefault]);

  // subForm back handler: save dirty fields, then pop with result
  const handleSubFormBack = useCallback(async () => {
    await subFormReady.current;
    const label = titleRef.current.trim() || config.titleDefault;

    // Save the title (unless computed/read-only) and any dirty fields.
    if (subFormRecordId.current != null) {
      const updates: Record<string, unknown> = {};
      if (!config.titleReadOnly) {
        updates[config.titleColId] = label;
      }
      for (const colId of dirtyFields.current) {
        updates[colId] = fieldsRef.current[colId];
      }
      try {
        await updateRecord(config.table, subFormRecordId.current, updates);
      } catch (err) {
        console.warn('[RecordForm] Failed to save on back:', err);
      }
    }

    const id = subFormRecordId.current != null
      ? String(subFormRecordId.current)
      : `local-${Date.now()}`;
    pop({ id, label });
  }, [config, pop, updateRecord]);

  // --- Field change: update local state only (save happens on blur) ---
  const handleFieldChange = useCallback(
    (colId: string, value: unknown) => {
      dirtyFields.current.add(colId);
      fieldsRef.current[colId] = value; // sync update so onBlur reads the latest value
      setFields((prev) => ({ ...prev, [colId]: value }));
    },
    [],
  );

  // --- Handle popResult from sub-forms (Ref / RefList fields) ---
  // Only consume if the stack depth matches (i.e. our direct child was popped, not a grandchild)
  useEffect(() => {
    if (
      popResult &&
      typeof popResult === 'object' &&
      'id' in popResult &&
      pendingRefColId.current &&
      pendingRefPushDepth.current != null &&
      stack.length === pendingRefPushDepth.current
    ) {
      const { id } = popResult as { id: string };
      const colId = pendingRefColId.current;
      pendingRefColId.current = null;
      pendingRefPushDepth.current = null;

      const numId = Number(id);
      const colType = columnMeta[colId]?.type ?? '';
      const isRefList = colType.startsWith('RefList:');

      let newValue: unknown;
      if (isRefList) {
        // Append to existing RefList
        const current = fieldsRef.current[colId];
        const existing = Array.isArray(current) && current[0] === 'L'
          ? current.slice(1).map(Number)
          : [];
        if (!existing.includes(numId)) existing.push(numId);
        newValue = ['L', ...existing];
      } else {
        newValue = numId;
      }

      dirtyFields.current.add(colId);
      fieldsRef.current[colId] = newValue;
      setFields((prev) => ({ ...prev, [colId]: newValue }));

      // Save using explicit table + record ID to avoid relying on
      // grist.getTable() / record state which may be stale after navigation.
      if (mode === 'currentRecord' && recordId != null) {
        updateRecord(config.table, recordId, { [colId]: newValue }).catch((err) =>
          console.warn(`Failed to save ref field ${colId}:`, err),
        );
      } else if (mode === 'subForm') {
        saveField(colId);
      }

      setRefReloadKey((k) => k + 1);
      clearPopResult();
    }
  }, [popResult, clearPopResult, saveField, mode, recordId, updateRecord, config.table, columnMeta, stack.length]);

  // --- Title change: update local state only (save happens on blur) ---
  const handleTitleChange = useCallback(
    (v: string) => {
      setTitle(v);
    },
    [],
  );

  // --- Create new record (currentRecord mode) ---
  const handleNewRecord = useCallback(async () => {
    try {
      const newId = await createRecord(config.table, {
        [config.titleColId]: config.titleDefault,
      });
      await new Promise((r) => setTimeout(r, 300));
      await setCursorPos(newId);
    } catch (err) {
      console.warn('[RecordForm] Failed to create new record:', err);
    }
  }, [createRecord, setCursorPos, config.table, config.titleColId, config.titleDefault]);

  // --- Header relative date ---
  const createdAt = useMemo(() => {
    if (config.headerDateColId) {
      const ts = fields[config.headerDateColId];
      if (ts != null && typeof ts === 'number' && ts > 0) return new Date(ts * 1000);
    }
    return new Date();
  }, [config.headerDateColId, fields]);
  const headerDate = useRelativeDate(createdAt, config.headerDatePrefix ?? '');

  // --- Separate regular fields from bottom markdown fields ---
  const regularFields = useMemo(() => config.fields.filter((f) => !f.markdown), [config.fields]);
  const markdownFields = useMemo(() => config.fields.filter((f) => f.markdown), [config.fields]);

  // --- Render ---

  // No record selected yet in currentRecord mode → show placeholder
  if (mode === 'currentRecord' && recordId == null) {
    return (
      <>
        {config.newRecordLabel && (
          <button type="button" className="new-record-btn" onClick={handleNewRecord}>
            <span className="material-icons">add</span>
            {config.newRecordLabel}
          </button>
        )}
        <div className="empty-state">
          <span className="material-icons empty-state__icon">description</span>
          <p className="empty-state__text">{config.emptyMessage ?? 'Sélectionnez un enregistrement'}</p>
        </div>
      </>
    );
  }

  return (
    <>
    {mode === 'currentRecord' && config.newRecordLabel && (
      <button
        type="button"
        className="new-record-btn"
        onClick={handleNewRecord}
      >
        <span className="material-icons">add</span>
        {config.newRecordLabel}
      </button>
    )}
    <ScreenShell
      title={title}
      onTitleChange={config.titleReadOnly ? undefined : handleTitleChange}
      onTitleBlur={config.titleReadOnly ? undefined : saveTitle}
      titleDefault={config.titleDefault}
      titlePlaceholder={config.titlePlaceholder}
      headerRight={headerDate}
      onBack={mode === 'subForm' ? handleSubFormBack : undefined}
    >
      <div className="meta-section">
        {regularFields.map((f) => (
          <MetaField
            key={f.colId}
            colId={f.colId}
            icon={f.icon}
            label={f.label}
            value={fields[f.colId]}
            onChange={(v) => handleFieldChange(f.colId, v)}
            onBlur={() => saveField(f.colId)}
            columnMeta={columnMeta[f.colId]}
            addLabel={f.addLabel}
            onAdd={
              f.refAddScreen
                ? () => {
                    pendingRefColId.current = f.colId;
                    pendingRefPushDepth.current = stack.length;
                    const parentId = mode === 'currentRecord' ? recordId : subFormRecordId.current;
                    push(f.refAddScreen!, {
                      parentTable: config.table,
                      parentRecordId: parentId != null ? String(parentId) : undefined,
                      parentColId: f.colId,
                    });
                  }
                : undefined
            }
            onClickSelected={
              f.refEditScreen
                ? (v, label) => {
                    pendingRefColId.current = f.colId;
                    pendingRefPushDepth.current = stack.length;
                    push(f.refEditScreen!, { editId: v, editLabel: label });
                  }
                : undefined
            }
            refReloadTrigger={refReloadKey}
            readOnly={f.readOnly}
            avatar={f.avatar}
            transform={f.transform}
            refLabelCol={f.refLabelCol}
          />
        ))}
      </div>
      {children && (() => {
        const id = mode === 'currentRecord' ? recordId : subFormRecordId.current;
        return id != null ? children(id) : null;
      })()}
      {markdownFields.map((f) => (
        <MarkdownEditor
          key={f.colId}
          icon={f.icon}
          label={f.label}
          value={fields[f.colId] != null ? String(fields[f.colId]) : ''}
          onChange={(v) => handleFieldChange(f.colId, v)}
          onBlur={() => saveField(f.colId)}
          readOnly={f.readOnly}
        />
      ))}
    </ScreenShell>
    </>
  );
}
