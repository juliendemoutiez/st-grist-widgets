import './FormLayout.scss';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { FormWrapper } from '../FormWrapper/FormWrapper';
import { FormField } from '../FormField/FormField';
import { useNavigation, useGrist, useColumnMeta, useRelativeDate } from '@grist-widgets/ui';
import type { FormConfig } from '@grist-widgets/ui';

interface FormLayoutProps {
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

export function FormLayout({ config, mode, children }: FormLayoutProps) {
  const { record, updateCurrentRecord, fetchTable, createRecord, updateRecord, setCursorPos, updateColumnWidgetOptions } = useGrist();
  const columnMeta = useColumnMeta(config.table);
  const { push, pop, resetToRoot, stack, popResult, clearPopResult } = useNavigation();

  const [title, setTitle] = useState('');
  const [fields, setFields] = useState<Record<string, unknown>>({});
  const [refReloadKey, setRefReloadKey] = useState(0);

  const titleRef = useRef(title);
  titleRef.current = title;
  const fieldsRef = useRef(fields);
  fieldsRef.current = fields;

  const pendingRefColId = useRef<string | null>(null);
  const pendingRefPushDepth = useRef<number | null>(null);

  const dirtyFields = useRef(new Set<string>());

  const navProps = stack[stack.length - 1]?.props;
  const editId = mode === 'subForm' ? (navProps?.editId as string | undefined) : undefined;
  const editLabel = mode === 'subForm' ? (navProps?.editLabel as string | undefined) : undefined;
  const parentTable = mode === 'subForm' ? (navProps?.parentTable as string | undefined) : undefined;
  const parentRecordId = mode === 'subForm' ? (navProps?.parentRecordId as string | undefined) : undefined;
  const parentColId = mode === 'subForm' ? (navProps?.parentColId as string | undefined) : undefined;
  const initialFields = mode === 'subForm' ? (navProps?.initialFields as Record<string, unknown> | undefined) : undefined;

  const subFormRecordId = useRef<number | null>(editId ? Number(editId) : null);
  const subFormReady = useRef<Promise<void>>(
    subFormRecordId.current != null ? Promise.resolve() : new Promise(() => {}),
  );
  const subFormInitStarted = useRef(false);

  // --- Data loading ---

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
        if (config.headerDateColId) {
          const col = table[config.headerDateColId] as unknown[] | undefined;
          vals[config.headerDateColId] = col?.[rowIdx] ?? null;
        }
        console.log(`[FormLayout] Field values from ${config.table}:`, vals);
        setFields(vals);
      } catch (err) {
        console.warn(`[FormLayout] Failed to fetch full row from ${config.table}:`, err);
      }
    })();
  }, [recordId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (mode !== 'subForm') return;
    if (subFormInitStarted.current) return;
    subFormInitStarted.current = true;
    setTitle(editLabel ?? '');

    let resolveReady: () => void;
    subFormReady.current = new Promise<void>((r) => { resolveReady = r; });

    (async () => {
      if (editId) {
        try {
          const table = await fetchTable(config.table);
          const rowIdx = table.id.indexOf(Number(editId));
          if (rowIdx === -1) return;

          const titleVal = table[config.titleColId]?.[rowIdx];
          if (titleVal != null) {
            setTitle(String(titleVal));
          }

          const vals: Record<string, unknown> = {};
          for (const f of config.fields) {
            const col = table[f.colId] as unknown[] | undefined;
            vals[f.colId] = col?.[rowIdx] ?? null;
          }
          if (config.headerDateColId) {
            const col = table[config.headerDateColId] as unknown[] | undefined;
            vals[config.headerDateColId] = col?.[rowIdx] ?? null;
          }
          setFields(vals);
        } catch (err) {
          console.warn(`[FormLayout] Failed to fetch existing record from ${config.table}:`, err);
        }
      } else {
        try {
          const newId = await createRecord(config.table, {
            ...(config.titleReadOnly ? {} : { [config.titleColId]: config.titleDefault }),
            ...initialFields,
          });
          subFormRecordId.current = newId;

          if (parentTable && parentRecordId && parentColId) {
            await updateRecord(parentTable, Number(parentRecordId), { [parentColId]: newId });
          }

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
            console.warn(`[FormLayout] Failed to fetch new record from ${config.table}:`, err);
          }
        } catch (err) {
          console.warn(`[FormLayout] Failed to create record in ${config.table}:`, err);
        }
      }
      resolveReady!();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Saving ---

  useEffect(() => {
    if (config.titleFormula) {
      setTitle(config.titleFormula(fields));
    }
  }, [fields, config.titleFormula]);

  const refreshTitle = useCallback(async (rowId: number) => {
    if (!config.titleReadOnly) return;
    if (config.titleFormula) return;
    try {
      const table = await fetchTable(config.table);
      const rowIdx = table.id.indexOf(rowId);
      if (rowIdx === -1) return;
      const titleVal = table[config.titleColId]?.[rowIdx];
      if (titleVal != null) setTitle(String(titleVal));
    } catch { /* ignore */ }
  }, [fetchTable, config.table, config.titleColId, config.titleReadOnly]);

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

  const saveTitle = useCallback(async () => {
    if (config.titleReadOnly) return;
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

  const handleSubFormBack = useCallback(async () => {
    await subFormReady.current;
    const label = titleRef.current.trim() || config.titleDefault;

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
        console.warn('[FormLayout] Failed to save on back:', err);
      }
    }

    const id = subFormRecordId.current != null
      ? String(subFormRecordId.current)
      : `local-${Date.now()}`;
    pop({ id, label });
  }, [config, pop, updateRecord]);

  const handleFieldChange = useCallback(
    (colId: string, value: unknown) => {
      dirtyFields.current.add(colId);
      fieldsRef.current[colId] = value;
      setFields((prev) => ({ ...prev, [colId]: value }));
    },
    [],
  );

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

  const handleTitleChange = useCallback(
    (v: string) => {
      setTitle(v);
    },
    [],
  );

  const handleNewRecord = useCallback(async () => {
    try {
      const newId = await createRecord(config.table, {
        [config.titleColId]: config.titleDefault,
      });
      await new Promise((r) => setTimeout(r, 300));
      await setCursorPos(newId);
    } catch (err) {
      console.warn('[FormLayout] Failed to create new record:', err);
    }
  }, [createRecord, setCursorPos, config.table, config.titleColId, config.titleDefault]);

  const createdAt = useMemo(() => {
    if (config.headerDateColId) {
      const ts = fields[config.headerDateColId];
      if (ts != null && typeof ts === 'number' && ts > 0) return new Date(ts * 1000);
    }
    return new Date();
  }, [config.headerDateColId, fields]);
  const headerDate = useRelativeDate(createdAt, config.headerDatePrefix ?? '');

  const regularFields = config.fields;

  // --- Render ---

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
    <FormWrapper
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
          <FormField

            key={f.colId}
            colId={f.colId}
            icon={f.icon}
            label={f.label}
            value={fields[f.colId]}
            onChange={(v) => handleFieldChange(f.colId, v)}
            onBlur={() => saveField(f.colId)}
            columnMeta={columnMeta[f.colId]}
            onCreateChoice={
              f.createChoice
                ? async (newLabel: string, color?: { fillColor: string; textColor: string }) => {
                    const meta = columnMeta[f.colId];
                    const current = meta?.widgetOptions ?? {};
                    const choices = [...(current.choices ?? []), newLabel];
                    const choiceOptions = { ...(current.choiceOptions ?? {}) };
                    if (color) choiceOptions[newLabel] = { fillColor: color.fillColor, textColor: color.textColor };
                    await updateColumnWidgetOptions(config.table, f.colId, { ...current, choices, choiceOptions });
                  }
                : undefined
            }
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
            mailto={f.mailto}
          />
        ))}
      </div>
      {children && (() => {
        const id = mode === 'currentRecord' ? recordId : subFormRecordId.current;
        return id != null ? children(id) : null;
      })()}
    </FormWrapper>
    </>
  );
}
