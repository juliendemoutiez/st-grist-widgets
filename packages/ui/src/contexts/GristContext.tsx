import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { RowRecord, FetchedTable } from 'grist-plugin-api';

// Access the global `grist` object injected by the <script> tag.
// The npm package is just a shim — the real API comes from the script.
const grist = (window as unknown as { grist?: typeof import('grist-plugin-api').default }).grist;

interface GristContextValue {
  /** The currently selected row in the widget's linked table. */
  record: RowRecord | null;
  /** Whether grist.ready() has been called and first record received. */
  isReady: boolean;
  /** Update fields on the currently selected record. */
  updateCurrentRecord: (fields: Record<string, unknown>) => Promise<void>;
  /** Update a record in the widget's linked table. Triggers cross-widget notifications. */
  updateLinkedRecord: (id: number, fields: Record<string, unknown>) => Promise<void>;
  /** Fetch all rows from a table (column-oriented). */
  fetchTable: (tableId: string) => Promise<FetchedTable>;
  /** Create a new record in a table, returns the new row id. */
  createRecord: (tableId: string, fields: Record<string, unknown>) => Promise<number>;
  /** Update a record in any table. */
  updateRecord: (tableId: string, id: number, fields: Record<string, unknown>) => Promise<void>;
  /** Move the Grist cursor to a specific row. */
  setCursorPos: (rowId: number) => Promise<void>;
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
  const [isReady, setIsReady] = useState(false);
  const initRef = useRef(false);
  const tableCache = useRef(new Map<string, CacheEntry>());

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
  }, []);

  const updateCurrentRecord = useCallback(async (fields: Record<string, unknown>) => {
    if (!grist || !record) return;
    const table = await grist.getTable();
    await table.update({ id: record.id, fields });
    tableCache.current.clear();
  }, [record]);

  const updateLinkedRecord = useCallback(async (id: number, fields: Record<string, unknown>) => {
    if (!grist) throw new Error('Grist API not available');
    const table = await grist.getTable();
    await table.update({ id, fields });
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

  const setCursorPos = useCallback(async (rowId: number) => {
    if (!grist) throw new Error('Grist API not available');
    await grist.setCursorPos({ rowId });
  }, []);

  return (
    <GristContext.Provider value={{ record, isReady, updateCurrentRecord, updateLinkedRecord, fetchTable, createRecord, updateRecord, setCursorPos }}>
      {children}
    </GristContext.Provider>
  );
}
