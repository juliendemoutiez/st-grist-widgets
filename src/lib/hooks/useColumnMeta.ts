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
 * Mirror table holding `type` + `widgetOptions` per column, readable by users
 * whose access rules deny them the `_grist_*` metadata tables. Grist refuses
 * access rules on metadata tables ("Invalid tables in rules"), so a document
 * with a doc-wide deny leaves restricted users no way to read column types —
 * without which every field falls back to Text and renders raw (dates as epoch
 * numbers, references as row ids). Regenerate it whenever a column type changes.
 */
const FALLBACK_TABLE = 'WIDGET_COLUMN_META';

function parseWidgetOptions(raw: string | undefined): ColumnMeta['widgetOptions'] {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    // ignore malformed JSON
    return null;
  }
}

/**
 * Fetches _grist_Tables_column + _grist_Tables once and returns
 * a map of column metadata keyed by `tableId.colId`.
 */
export function useColumnMeta(tableId: string) {
  const { fetchTable } = useGrist();
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

          map[colIds[i]] = {
            colId: colIds[i],
            type: types[i],
            widgetOptions: parseWidgetOptions(widgetOptionsCols[i]),
          };
        }

        console.log('[useColumnMeta] Loaded columns for', tableId, ':', Object.entries(map).map(([k, v]) => `${k}(${v.type})`).join(', '));
        setMetaMap(map);
      } catch (err) {
        console.warn('[useColumnMeta] Failed to fetch column metadata:', err);

        // Access rules can deny the metadata tables. Fall back to the mirror.
        try {
          const mirror = await fetchTable(FALLBACK_TABLE);
          const tableIds = mirror.Table_id as string[];
          const colIds = mirror.Col_id as string[];
          const types = mirror.Type as string[];
          const widgetOptionsCols = mirror.Widget_options as string[];

          const map: Record<string, ColumnMeta> = {};

          for (let i = 0; i < colIds.length; i++) {
            if (tableIds[i] !== tableId) continue;

            map[colIds[i]] = {
              colId: colIds[i],
              type: types[i],
              widgetOptions: parseWidgetOptions(widgetOptionsCols[i]),
            };
          }

          if (Object.keys(map).length === 0) {
            console.warn(`[useColumnMeta] ${FALLBACK_TABLE} has no rows for "${tableId}"`);
            return;
          }

          console.log(`[useColumnMeta] Loaded columns for ${tableId} from ${FALLBACK_TABLE}:`, Object.entries(map).map(([k, v]) => `${k}(${v.type})`).join(', '));
          setMetaMap(map);
        } catch (fallbackErr) {
          console.warn(`[useColumnMeta] ${FALLBACK_TABLE} unavailable too:`, fallbackErr);
        }
      }
    })();
  }, [fetchTable, tableId]);

  return metaMap;
}
