import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigation, useGrist, useColumnMeta, useRelativeDate } from '@grist-widgets/ui';
import type { FormConfig, ColumnMeta } from '@grist-widgets/ui';

/** Props carried on the navigation stack when pushing a subForm screen. */
interface SubFormNavProps {
  /** ID of an existing record to edit. Absent when creating a new record. */
  editId?: string;
  editLabel?: string;
  /** Parent context used to link a newly created record back to its parent. */
  parentTable?: string;
  parentRecordId?: string;
  parentColId?: string;
  /** Extra field values to set on the new record at creation time. */
  initialFields?: Record<string, unknown>;
}

export interface UseFormDataReturn {
  title: string;
  fields: Record<string, unknown>;
  refReloadKey: number;
  /** Active Grist row ID — null when no record is selected (currentRecord mode). */
  recordId: number | null;
  headerDate: string;
  columnMeta: Record<string, ColumnMeta>;
  onTitleChange: ((v: string) => void) | undefined;
  onTitleBlur: (() => void) | undefined;
  onFieldChange: (colId: string, value: unknown) => void;
  onFieldBlur: (colId: string) => void;
  /** Defined only in subForm mode. */
  onBack: (() => void) | undefined;
  /** Defined only when config.newRecordLabel is set. */
  onNewRecord: (() => void) | undefined;
  onRefAdd: (colId: string, refAddScreen: string) => void;
  onRefEdit: (colId: string, refEditScreen: string, value: string, label: string) => void;
}

export function useFormData(config: FormConfig, mode: 'currentRecord' | 'subForm'): UseFormDataReturn {
  const { record, updateCurrentRecord, fetchTable, createRecord, updateRecord, setCursorPos } = useGrist();
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

  // subForm: navigation props passed by the parent when pushing this screen
  const navProps = mode === 'subForm'
    ? (stack[stack.length - 1]?.props ?? {}) as SubFormNavProps
    : undefined;
  const { editId, editLabel, parentTable, parentRecordId, parentColId, initialFields } = navProps ?? {};

  const subFormRecordId = useRef<number | null>(editId ? Number(editId) : null);
  // 'loading': record not yet created/fetched; 'ready': safe to save field-level changes.
  const [subFormStatus, setSubFormStatus] = useState<'loading' | 'ready'>(
    subFormRecordId.current != null ? 'ready' : 'loading',
  );
  const subFormInitStarted = useRef(false);

  // ── currentRecord: reset nav stack when the selected row changes ──────────────

  const recordId = mode === 'currentRecord' ? (record?.id ?? null) : null;
  const prevRecordId = useRef(recordId);
  useEffect(() => {
    if (mode !== 'currentRecord') return;
    if (prevRecordId.current != null && recordId !== prevRecordId.current && stack.length > 1) {
      resetToRoot();
    }
    prevRecordId.current = recordId;
  }, [mode, recordId, stack.length, resetToRoot]);

  // ── currentRecord: load raw field values on record change ────────────────────

  useEffect(() => {
    if (mode !== 'currentRecord' || recordId == null || !record) return;
    let cancelled = false;

    setTitle(record[config.titleColId] != null ? String(record[config.titleColId]) : '');

    const sanitize = (v: unknown) =>
      v == null || (typeof v === 'number' && isNaN(v)) ? null : v;

    // grist.onRecord (keepEncoded:false) decodes RefList to display labels and DateTime to
    // Date objects — neither is what our field renderers expect. fetchTable returns the raw
    // stored values: ['L', rowId, ...] for RefList, seconds for DateTime.
    fetchTable(config.table)
      .then(table => {
        if (cancelled) return;
        const rowIdx = (table.id as number[]).indexOf(recordId);
        if (rowIdx === -1) return;
        const vals: Record<string, unknown> = {};
        for (const f of config.fields) {
          const col = table[f.colId] as unknown[] | undefined;
          vals[f.colId] = sanitize(col?.[rowIdx] ?? null);
        }
        if (config.headerDateColId) {
          const col = table[config.headerDateColId] as unknown[] | undefined;
          vals[config.headerDateColId] = sanitize(col?.[rowIdx] ?? null);
        }
        if (config.alertColId) {
          const col = table[config.alertColId] as unknown[] | undefined;
          vals[config.alertColId] = sanitize(col?.[rowIdx] ?? null);
        }
        setFields(vals);
      })
      .catch(err => {
        if (cancelled) return;
        console.warn('[useFormData] fetchTable failed, falling back to onRecord data:', err);
        const vals: Record<string, unknown> = {};
        for (const f of config.fields) vals[f.colId] = sanitize(record[f.colId]);
        if (config.headerDateColId) vals[config.headerDateColId] = sanitize(record[config.headerDateColId]);
        if (config.alertColId) vals[config.alertColId] = sanitize(record[config.alertColId]);
        setFields(vals);
      });

    return () => { cancelled = true; };
  }, [recordId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── subForm: init on mount (create new record or load existing) ──────────────

  useEffect(() => {
    if (mode !== 'subForm') return;
    if (subFormInitStarted.current) return;
    subFormInitStarted.current = true;
    setTitle(editLabel ?? '');

    (async () => {
      if (editId) {
        try {
          const table = await fetchTable(config.table);
          const rowIdx = table.id.indexOf(Number(editId));
          if (rowIdx !== -1) {
            const titleVal = table[config.titleColId]?.[rowIdx];
            if (titleVal != null) setTitle(String(titleVal));
            const vals: Record<string, unknown> = {};
            for (const f of config.fields) {
              const col = table[f.colId] as unknown[] | undefined;
              vals[f.colId] = col?.[rowIdx] ?? null;
            }
            if (config.headerDateColId) {
              const col = table[config.headerDateColId] as unknown[] | undefined;
              vals[config.headerDateColId] = col?.[rowIdx] ?? null;
            }
            if (config.alertColId) {
              const col = table[config.alertColId] as unknown[] | undefined;
              vals[config.alertColId] = col?.[rowIdx] ?? null;
            }
            setFields(vals);
          }
        } catch (err) {
          console.warn(`[useFormData] Failed to fetch existing record from ${config.table}:`, err);
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
              if (config.alertColId) {
                const col = table[config.alertColId] as unknown[] | undefined;
                vals[config.alertColId] = col?.[rowIdx] ?? null;
              }
              setFields(vals);
            }
          } catch (err) {
            console.warn(`[useFormData] Failed to fetch new record from ${config.table}:`, err);
          }
        } catch (err) {
          console.warn(`[useFormData] Failed to create record in ${config.table}:`, err);
        }
      }
      setSubFormStatus('ready');
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Title formula / prefix ───────────────────────────────────────────────────

  useEffect(() => {
    if (config.titleFormula) setTitle(config.titleFormula(fields));
  }, [fields, config.titleFormula]);

  useEffect(() => {
    if (!config.titlePrefix) return;
    const val = fields[config.titleColId];
    if (typeof val === 'number' && val > 0) {
      const formatted = new Date(val * 1000).toLocaleDateString('fr-FR', {
        day: 'numeric', month: 'long', year: 'numeric',
      });
      setTitle(config.titlePrefix + formatted);
    }
  }, [fields, config.titlePrefix, config.titleColId]);

  const refreshTitle = useCallback(async (rowId: number) => {
    if (!config.titleReadOnly || config.titleFormula || config.titlePrefix) return;
    try {
      const table = await fetchTable(config.table);
      const rowIdx = table.id.indexOf(rowId);
      if (rowIdx === -1) return;
      const titleVal = table[config.titleColId]?.[rowIdx];
      if (titleVal != null) setTitle(String(titleVal));
    } catch { /* ignore */ }
  }, [fetchTable, config.table, config.titleColId, config.titleReadOnly, config.titleFormula]);

  // ── Saving ───────────────────────────────────────────────────────────────────

  const saveField = useCallback(async (colId: string) => {
    if (mode === 'currentRecord') {
      try {
        await updateCurrentRecord({ [colId]: fieldsRef.current[colId] });
        if (recordId != null) await refreshTitle(recordId);
      } catch (err) {
        console.warn(`[useFormData] Failed to save field ${colId}:`, err);
      }
    } else {
      if (subFormStatus !== 'ready' || subFormRecordId.current == null) return;
      try {
        await updateRecord(config.table, subFormRecordId.current, { [colId]: fieldsRef.current[colId] });
        await refreshTitle(subFormRecordId.current);
      } catch (err) {
        console.warn(`[useFormData] Failed to save field ${colId}:`, err);
      }
    }
  }, [mode, updateCurrentRecord, updateRecord, config.table, recordId, refreshTitle, subFormStatus]);

  const saveTitle = useCallback(async () => {
    if (config.titleReadOnly) return;
    const value = titleRef.current.trim() || config.titleDefault;
    if (mode === 'currentRecord') {
      try {
        await updateCurrentRecord({ [config.titleColId]: value });
      } catch (err) {
        console.warn(`[useFormData] Failed to save title:`, err);
      }
    } else {
      if (subFormStatus !== 'ready' || subFormRecordId.current == null) return;
      try {
        await updateRecord(config.table, subFormRecordId.current, { [config.titleColId]: value });
      } catch (err) {
        console.warn(`[useFormData] Failed to save title:`, err);
      }
    }
  }, [mode, updateCurrentRecord, updateRecord, config.table, config.titleColId, config.titleDefault, config.titleReadOnly, subFormStatus]);

  const handleSubFormBack = useCallback(async () => {
    const label = titleRef.current.trim() || config.titleDefault;

    if (subFormRecordId.current != null) {
      const updates: Record<string, unknown> = {};
      if (!config.titleReadOnly) updates[config.titleColId] = label;
      for (const colId of dirtyFields.current) {
        updates[colId] = fieldsRef.current[colId];
      }
      try {
        await updateRecord(config.table, subFormRecordId.current, updates);
      } catch (err) {
        console.warn('[useFormData] Failed to save on back:', err);
      }
    }

    const id = subFormRecordId.current != null
      ? String(subFormRecordId.current)
      : `local-${Date.now()}`;
    pop({ id, label });
  }, [config, pop, updateRecord]);

  // ── Field change ─────────────────────────────────────────────────────────────

  const handleFieldChange = useCallback((colId: string, value: unknown) => {
    dirtyFields.current.add(colId);
    fieldsRef.current[colId] = value;
    setFields((prev) => ({ ...prev, [colId]: value }));
  }, []);

  // ── Return from ref sub-form ─────────────────────────────────────────────────

  useEffect(() => {
    if (
      !popResult ||
      typeof popResult !== 'object' ||
      !('id' in popResult) ||
      !pendingRefColId.current ||
      pendingRefPushDepth.current == null ||
      stack.length !== pendingRefPushDepth.current
    ) return;

    const { id } = popResult as { id: string };
    const colId = pendingRefColId.current;
    pendingRefColId.current = null;
    pendingRefPushDepth.current = null;

    const numId = Number(id);
    const colType = columnMeta[colId]?.type ?? '';
    const isRefList = colType.startsWith('RefList:');

    if (isNaN(numId)) {
      setRefReloadKey((k) => k + 1);
      clearPopResult();
      return;
    }

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
        console.warn(`[useFormData] Failed to save ref field ${colId}:`, err),
      );
    } else if (mode === 'subForm') {
      saveField(colId);
    }

    setRefReloadKey((k) => k + 1);
    clearPopResult();
  }, [popResult, clearPopResult, saveField, mode, recordId, updateRecord, config.table, columnMeta, stack.length]);

  // ── New record ───────────────────────────────────────────────────────────────

  const handleNewRecord = useCallback(async () => {
    try {
      const newId = await createRecord(config.table, { [config.titleColId]: config.titleDefault });
      await new Promise((r) => setTimeout(r, 300));
      await setCursorPos(newId);
    } catch (err) {
      console.warn('[useFormData] Failed to create new record:', err);
    }
  }, [createRecord, setCursorPos, config.table, config.titleColId, config.titleDefault]);

  // ── Ref navigation ───────────────────────────────────────────────────────────

  const onRefAdd = useCallback((colId: string, refAddScreen: string) => {
    pendingRefColId.current = colId;
    pendingRefPushDepth.current = stack.length;
    const parentId = mode === 'currentRecord' ? recordId : subFormRecordId.current;
    push(refAddScreen, {
      parentTable: config.table,
      parentRecordId: parentId != null ? String(parentId) : undefined,
      parentColId: colId,
    });
  }, [push, stack.length, mode, recordId, config.table]);

  const onRefEdit = useCallback((colId: string, refEditScreen: string, value: string, label: string) => {
    pendingRefColId.current = colId;
    pendingRefPushDepth.current = stack.length;
    push(refEditScreen, { editId: value, editLabel: label });
  }, [push, stack.length]);

  // ── Header date ──────────────────────────────────────────────────────────────

  const createdAt = useMemo(() => {
    if (config.headerDateColId) {
      const ts = fields[config.headerDateColId];
      if (ts != null && typeof ts === 'number' && ts > 0) return new Date(ts > 1e10 ? ts : ts * 1000);
    }
    return new Date();
  }, [config.headerDateColId, fields]);
  const headerDate = useRelativeDate(createdAt, config.headerDatePrefix ?? '');

  // ── Return ───────────────────────────────────────────────────────────────────

  return {
    title,
    fields,
    refReloadKey,
    recordId,
    headerDate,
    columnMeta,
    onTitleChange: config.titleReadOnly ? undefined : (v: string) => setTitle(v),
    onTitleBlur: config.titleReadOnly ? undefined : saveTitle,
    onFieldChange: handleFieldChange,
    onFieldBlur: saveField,
    onBack: mode === 'subForm' ? handleSubFormBack : undefined,
    onNewRecord: config.newRecordLabel ? handleNewRecord : undefined,
    onRefAdd,
    onRefEdit,
  };
}
