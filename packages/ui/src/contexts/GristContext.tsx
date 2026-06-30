import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { RowRecord, FetchedTable } from 'grist-plugin-api';

// Access the global `grist` object injected by the <script> tag.
// The npm package is just a shim — the real API comes from the script.
const grist = (window as unknown as { grist?: typeof import('grist-plugin-api').default }).grist;

interface GristContextValue {
  /** The currently selected row in the widget's linked table. */
  record: RowRecord | null;
  /** All rows visible in the widget's linked table. */
  allRecords: RowRecord[];
  /** Whether grist.ready() has been called and first record received. */
  isReady: boolean;
  /** Increments whenever Grist notifies of a data change — use as a useEffect dependency to re-fetch. */
  dataVersion: number;
  /** Update fields on the currently selected record. */
  updateCurrentRecord: (fields: Record<string, unknown>) => Promise<void>;
  /** Update a record in the widget's linked table. Triggers cross-widget notifications. */
  updateLinkedRecord: (id: number, fields: Record<string, unknown>) => Promise<void>;
  /** Create a new record in the widget's linked table, returns the new row id. */
  createLinkedRecord: (fields: Record<string, unknown>) => Promise<number>;
  /** Delete a record from the widget's linked table. */
  deleteLinkedRecord: (id: number) => Promise<void>;
  /** Fetch all rows from a table (column-oriented). */
  fetchTable: (tableId: string) => Promise<FetchedTable>;
  /** Create a new record in a table, returns the new row id. */
  createRecord: (tableId: string, fields: Record<string, unknown>) => Promise<number>;
  /** Update a record in any table. */
  updateRecord: (tableId: string, id: number, fields: Record<string, unknown>) => Promise<void>;
  /** Delete a record from a table. */
  deleteRecord: (tableId: string, id: number) => Promise<void>;
  /** Update a column's widgetOptions (e.g. to add a new choice). */
  updateColumnWidgetOptions: (tableId: string, colId: string, options: unknown) => Promise<void>;
  /** Move the Grist cursor to a specific row. */
  setCursorPos: (rowId: number) => Promise<void>;
  /** Notify linked widgets of the selected row (allowSelectBy). */
  setSelectedRows: (rowIds: number[]) => Promise<void>;
  /**
   * Fetch ALL rows with ALL columns from the widget's linked table,
   * regardless of column visibility in the Grist section.
   * Use this when onRecord/allRecords may be missing hidden columns.
   */
  fetchCurrentTable: () => Promise<RowRecord[]>;
}

const GristContext = createContext<GristContextValue | null>(null);

export function useGrist() {
  const ctx = useContext(GristContext);
  if (!ctx) throw new Error('useGrist must be used within GristProvider');
  return ctx;
}

const TABLE_CACHE_TTL_MS = 30_000;

interface CacheEntry {
  data: FetchedTable;
  fetchedAt: number;
}

export function GristProvider({ children, allowSelectBy }: { children: ReactNode; allowSelectBy?: boolean }) {
  const [record, setRecord] = useState<RowRecord | null>(null);
  const [allRecords, setAllRecords] = useState<RowRecord[]>([]);
  const [isReady, setIsReady] = useState(false);
  const [dataVersion, setDataVersion] = useState(0);
  const initRef = useRef(false);
  const tableCache = useRef(new Map<string, CacheEntry>());
  const linkedTableId = useRef<string | null>(null);

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    console.log('GristProvider init — grist global:', grist);
    if (!grist) {
      console.warn('Grist API not available — running outside Grist?');
      return;
    }

    console.log('Calling grist.ready()');
    grist.ready({ requiredAccess: 'full', allowSelectBy });
    grist.onRecord((data) => {
      console.log('grist.onRecord fired:', JSON.stringify(data));
      tableCache.current.clear();
      setRecord(data);
      setIsReady(true);
    });
    grist.onRecords((records) => {
      tableCache.current.clear();
      const recs = records ?? [];
      setAllRecords(recs);
      setDataVersion((v) => v + 1);
      if (recs.length === 0) setRecord(null);
    });
  }, []);

  const updateCurrentRecord = useCallback(async (fields: Record<string, unknown>) => {
    if (!grist || !record) return;
    const table = await grist.getTable();
    await table.update({ id: record.id, fields });
    tableCache.current.clear();
  }, [record]);

  const createLinkedRecord = useCallback(async (fields: Record<string, unknown>) => {
    if (!grist) throw new Error('Grist API not available');
    const table = await grist.getTable();
    const result = await table.create({ fields });
    tableCache.current.clear();
    return typeof result === 'object' && result !== null ? (result as { id: number }).id : result as number;
  }, []);

  const deleteLinkedRecord = useCallback(async (id: number) => {
    if (!grist) throw new Error('Grist API not available');
    const table = await grist.getTable();
    await table.destroy(id);
    tableCache.current.clear();
  }, []);

  const updateLinkedRecord = useCallback(async (id: number, fields: Record<string, unknown>) => {
    if (!grist) throw new Error('Grist API not available');
    // Use applyUserActions instead of table.update() — the latter validates against the
    // widget's visible column list and rejects writes to hidden columns (e.g. IsExpanded).
    if (!linkedTableId.current) {
      const table = await grist.getTable();
      linkedTableId.current = await table.getTableId();
    }
    await grist.docApi.applyUserActions([['UpdateRecord', linkedTableId.current, id, fields]]);
    tableCache.current.clear();
  }, []);

  const fetchTable = useCallback(async (tableId: string) => {
    if (!grist) throw new Error('Grist API not available');
    const cached = tableCache.current.get(tableId);
    if (cached && Date.now() - cached.fetchedAt < TABLE_CACHE_TTL_MS) {
      return cached.data;
    }
    const data = await grist.docApi.fetchTable(tableId);
    tableCache.current.set(tableId, { data, fetchedAt: Date.now() });
    return data;
  }, []);

  const createRecord = useCallback(async (tableId: string, fields: Record<string, unknown>) => {
    if (!grist) throw new Error('Grist API not available');
    const result = await grist.docApi.applyUserActions([
      ['AddRecord', tableId, null, fields],
    ]);
    tableCache.current.delete(tableId);
    return (result as { retValues: number[] }).retValues[0];
  }, []);

  const updateRecord = useCallback(async (tableId: string, id: number, fields: Record<string, unknown>) => {
    if (!grist) throw new Error('Grist API not available');
    const table = await grist.getTable(tableId);
    await table.update({ id, fields });
    tableCache.current.delete(tableId);
  }, []);

  const deleteRecord = useCallback(async (tableId: string, id: number) => {
    if (!grist) throw new Error('Grist API not available');
    await grist.docApi.applyUserActions([['RemoveRecord', tableId, id]]);
    tableCache.current.delete(tableId);
  }, []);

  const updateColumnWidgetOptions = useCallback(async (tableId: string, colId: string, options: unknown) => {
    if (!grist) throw new Error('Grist API not available');
    await grist.docApi.applyUserActions([
      ['ModifyColumn', tableId, colId, { widgetOptions: JSON.stringify(options) }],
    ]);
    tableCache.current.delete('_grist_Tables_column');
    setDataVersion((v) => v + 1);
  }, []);

  const setCursorPos = useCallback(async (rowId: number) => {
    if (!grist) throw new Error('Grist API not available');
    await grist.setCursorPos({ rowId });
  }, []);

  const setSelectedRows = useCallback(async (rowIds: number[]) => {
    if (!grist) throw new Error('Grist API not available');
    await grist.setSelectedRows(rowIds);
  }, []);

  const fetchCurrentTable = useCallback(async (): Promise<RowRecord[]> => {
    if (!grist) throw new Error('Grist API not available');
    const table = await grist.getTable();
    const tableId = await table.getTableId();
    const fetched = await grist.docApi.fetchTable(tableId);
    const ids = fetched.id as number[];
    return ids.map((id, i) => {
      const row: RowRecord = { id };
      for (const [col, values] of Object.entries(fetched)) {
        if (col !== 'id') row[col] = (values as unknown[])[i];
      }
      return row;
    });
  }, []);

  return (
    <GristContext.Provider value={{ record, allRecords, isReady, dataVersion, updateCurrentRecord, updateLinkedRecord, createLinkedRecord, deleteLinkedRecord, fetchTable, createRecord, updateRecord, deleteRecord, updateColumnWidgetOptions, setCursorPos, setSelectedRows, fetchCurrentTable }}>
      {children}
    </GristContext.Provider>
  );
}
