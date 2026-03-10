import { useEffect, useState } from 'react';

const grist = (window as unknown as { grist?: typeof import('grist-plugin-api').default }).grist;

export interface InteractionInfo {
  prochaineDate: number | null;
  isOverdue: boolean;
}

/** Maps projectId → InteractionInfo from the latest interaction. */
export function useInteractionDates(): Map<number, InteractionInfo> {
  const [map, setMap] = useState<Map<number, InteractionInfo>>(new Map());

  useEffect(() => {
    if (!grist) return;

    grist.docApi.fetchTable('Interactions').then((table) => {
      const projetsCol = table['Projets'] as unknown[];
      const dateCol = table['Date'] as unknown[];
      const prochaineCol = table['Date_de_prochaine_interaction'] as unknown[];

      const entries = new Map<number, { interactionDate: number; prochaineDate: number | null }[]>();

      for (let i = 0; i < table.id.length; i++) {
        const projets = projetsCol[i];
        const interactionDate = typeof dateCol[i] === 'number' ? (dateCol[i] as number) : 0;
        const prochaineDate = typeof prochaineCol[i] === 'number' && (prochaineCol[i] as number) > 0
          ? (prochaineCol[i] as number)
          : null;

        let projectIds: number[] = [];
        if (Array.isArray(projets) && projets[0] === 'L') {
          projectIds = (projets as unknown[]).slice(1).map(Number).filter(Boolean);
        } else if (typeof projets === 'number' && projets > 0) {
          projectIds = [projets];
        }

        for (const pid of projectIds) {
          const list = entries.get(pid) ?? [];
          list.push({ interactionDate, prochaineDate });
          entries.set(pid, list);
        }
      }

      const nowSeconds = Date.now() / 1000;
      const result = new Map<number, InteractionInfo>();

      for (const [pid, list] of entries) {
        list.sort((a, b) => b.interactionDate - a.interactionDate);
        const prochaineDate = list[0]?.prochaineDate ?? null;
        result.set(pid, {
          prochaineDate,
          isOverdue: prochaineDate !== null && prochaineDate < nowSeconds,
        });
      }

      setMap(result);
    }).catch((err) => {
      console.warn('[useInteractionDates] Failed:', err);
    });
  }, []);

  return map;
}
