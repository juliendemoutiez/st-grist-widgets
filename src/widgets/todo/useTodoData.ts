import { useState, useEffect } from 'react';
import type { RowRecord } from 'grist-plugin-api';
import { useGrist } from '@grist-widgets/ui';
import { PROJET_COL, ETIQUETTES_COL, SUPPRIME_COL } from './types';
import type { ProjetColor } from './types';

export function useTodoData() {
  const { dataVersion, fetchTable, fetchCurrentTable } = useGrist();
  const [records, setRecords] = useState<RowRecord[]>([]);
  const [projetChoices, setProjetChoices] = useState<string[]>([]);
  const [projetColorMap, setProjetColorMap] = useState<Map<string, ProjetColor>>(new Map());
  const [etiquettesChoices, setEtiquettesChoices] = useState<string[]>([]);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    fetchCurrentTable().then((rows) => {
      setRecords(rows.filter((r) => !r[SUPPRIME_COL]));
      setInitialized(true);
    }).catch(() => {});
  }, [dataVersion, fetchCurrentTable]);

  useEffect(() => {
    fetchTable('_grist_Tables_column').then((table) => {
      const colIds = table.colId as string[];
      const widgetOptionsList = table.widgetOptions as string[];

      const buildColorMap = (colId: string) => {
        const idx = colIds.indexOf(colId);
        if (idx === -1) return new Map<string, ProjetColor>();
        try {
          const opts = JSON.parse(widgetOptionsList[idx] ?? '{}');
          const map = new Map<string, ProjetColor>();
          for (const [choice, style] of Object.entries(opts.choiceOptions ?? {})) {
            const s = style as { fillColor?: string; textColor?: string };
            if (s.fillColor) map.set(choice, { fill: s.fillColor, text: s.textColor ?? '#000' });
          }
          return map;
        } catch { return new Map<string, ProjetColor>(); }
      };

      const projetIdx = colIds.indexOf(PROJET_COL);
      if (projetIdx !== -1) {
        try {
          const opts = JSON.parse(widgetOptionsList[projetIdx] ?? '{}');
          setProjetChoices((opts.choices as string[]) ?? []);
        } catch {}
      }
      setProjetColorMap(buildColorMap(PROJET_COL));

      const etiqIdx = colIds.indexOf(ETIQUETTES_COL);
      if (etiqIdx !== -1) {
        try {
          const opts = JSON.parse(widgetOptionsList[etiqIdx] ?? '{}');
          setEtiquettesChoices((opts.choices as string[]) ?? []);
        } catch {}
      }
    }).catch(() => {});
  }, [fetchTable]);

  return { records, projetChoices, projetColorMap, etiquettesChoices, initialized };
}
