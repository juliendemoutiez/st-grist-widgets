import { useEffect, useState } from 'react';
import { useGrist } from '../contexts/GristContext';

/**
 * Table listing, per role, the columns that role cannot write. The document's
 * access rules remain the authority — this only stops the form from offering an
 * edit that Grist will refuse. Rows are visible only to the role they name, so a
 * user with nothing locked simply reads an empty table.
 *
 * Generated from the access rules; regenerate it whenever they change.
 */
const LOCK_TABLE = 'WIDGET_FIELD_READONLY';

/** Returns the set of colIds the current user may not write in `tableId`. */
export function useReadOnlyFields(tableId: string) {
  const { fetchTable } = useGrist();
  const [locked, setLocked] = useState<Set<string>>(new Set());

  useEffect(() => {
    (async () => {
      try {
        const rows = await fetchTable(LOCK_TABLE);
        const tableIds = rows.Table_id as string[];
        const colIds = rows.Col_id as string[];

        const set = new Set<string>();
        for (let i = 0; i < colIds.length; i++) {
          if (tableIds[i] === tableId) set.add(colIds[i]);
        }

        if (set.size > 0) {
          console.log(`[useReadOnlyFields] ${tableId} locked:`, [...set].join(', '));
        }
        setLocked(set);
      } catch (err) {
        // Table missing or denied: lock nothing and let the config decide alone,
        // which is how the form behaved before this table existed.
        console.warn(`[useReadOnlyFields] ${LOCK_TABLE} unavailable:`, err);
      }
    })();
  }, [fetchTable, tableId]);

  return locked;
}
