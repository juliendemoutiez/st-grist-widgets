import { useEffect, useState } from 'react';

const grist = (window as unknown as { grist?: typeof import('grist-plugin-api').default }).grist;

/** Maps status label → fillColor from the Statut choice column in Projets. */
export function useStatusColors(): Map<string, string> {
  const [colors, setColors] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    if (!grist) return;

    (async () => {
      try {
        const tables = await grist.docApi.fetchTable('_grist_Tables');
        const tableIdx = (tables['tableId'] as string[]).indexOf('Projets');
        if (tableIdx === -1) return;
        const tableRowId = tables.id[tableIdx];

        const cols = await grist.docApi.fetchTable('_grist_Tables_column');
        const parentIds = cols['parentId'] as number[];
        const colIds = cols['colId'] as string[];
        const widgetOptionsArr = cols['widgetOptions'] as string[];

        const colIdx = cols.id.findIndex(
          (_, i) => parentIds[i] === tableRowId && colIds[i] === 'Statut',
        );
        if (colIdx === -1) return;

        const widgetOptions = JSON.parse(widgetOptionsArr[colIdx] || '{}');
        const choiceOptions: Record<string, { textColor?: string }> = widgetOptions.choiceOptions ?? {};

        const map = new Map<string, string>();
        for (const [status, opts] of Object.entries(choiceOptions)) {
          if (opts.textColor) map.set(status, opts.textColor);
        }
        setColors(map);
      } catch (err) {
        console.warn('[useStatusColors] Failed:', err);
      }
    })();
  }, []);

  return colors;
}
