import { useEffect, useState } from 'react';
import { useGrist } from '../contexts/GristContext';

export interface ColumnMeta {
  colId: string;
  type: string;
  widgetOptions: {
    choices?: string[];
    choiceOptions?: Record<string, { fillColor?: string; textColor?: string }>;
    [key: string]: unknown;
  } | null;
}

/**
 * Fetches _grist_Tables_column + _grist_Tables once and returns
 * a map of column metadata keyed by `tableId.colId`.
 */
export function useColumnMeta(tableId: string) {
  const { fetchTable, dataVersion } = useGrist();
  const [metaMap, setMetaMap] = useState<Record<string, ColumnMeta>>({});

  useEffect(() => {
    (async () => {
      try {
        const [cols, tables] = await Promise.all([
          fetchTable('_grist_Tables_column'),
          fetchTable('_grist_Tables'),
        ]);

        // Find the parent table's internal id
        const tableIdx = (tables.tableId as string[]).indexOf(tableId);
        if (tableIdx === -1) {
          console.warn(`[useColumnMeta] Table "${tableId}" not found`);
          return;
        }
        const parentId = tables.id[tableIdx];

        const colIds = cols.colId as string[];
        const parentIds = cols.parentId as number[];
        const types = cols.type as string[];
        const widgetOptionsCols = cols.widgetOptions as string[];

        const map: Record<string, ColumnMeta> = {};

        for (let i = 0; i < colIds.length; i++) {
          if (parentIds[i] !== parentId) continue;

          let parsed: ColumnMeta['widgetOptions'] = null;
          const raw = widgetOptionsCols[i];
          if (raw) {
            try {
              parsed = JSON.parse(raw);
            } catch {
              // ignore malformed JSON
            }
          }

          map[colIds[i]] = {
            colId: colIds[i],
            type: types[i],
            widgetOptions: parsed,
          };
        }

        console.log('[useColumnMeta] Loaded columns for', tableId, ':', Object.entries(map).map(([k, v]) => `${k}(${v.type})`).join(', '));
        setMetaMap(map);
      } catch (err) {
        console.warn('[useColumnMeta] Failed to fetch column metadata:', err);
      }
    })();
  }, [fetchTable, tableId, dataVersion]);

  return metaMap;
}
