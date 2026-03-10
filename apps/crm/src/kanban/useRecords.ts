import { useEffect, useState } from 'react';
import type { RowRecord } from 'grist-plugin-api';

const grist = (window as unknown as { grist?: typeof import('grist-plugin-api').default }).grist;

/**
 * Subscribes to grist.onRecords and returns all rows from the widget's linked table.
 * Updates whenever Grist fires the callback (i.e. on table changes).
 */
export function useRecords(): RowRecord[] {
  const [records, setRecords] = useState<RowRecord[]>([]);

  useEffect(() => {
    if (!grist) return;
    grist.onRecords((recs) => {
      setRecords(recs);
    });
  }, []);

  return records;
}
