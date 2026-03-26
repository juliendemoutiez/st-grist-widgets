import { useEffect, useRef, useState } from 'react';
import { useGrist, useNavigation } from '@grist-widgets/ui';
import type { TimelineConfig } from '@grist-widgets/ui';

/** Strip markdown syntax and collapse to a single line. */
function stripMarkdown(text: string): string {
  return text
    .split('\n')
    .map((l) => l.replace(/^[#>\-*+]+\s*/, '').trim())
    .filter((l) => l.length > 0)
    .join(' · ');
}

interface TimelineItem {
  id: number;
  date: string;
  dateTs: number;
  types: string[];
  detail: string;
}

interface TimelineProps {
  config: TimelineConfig;
  filterId: number;
}

export function Timeline({ config, filterId }: TimelineProps) {
  const { fetchTable } = useGrist();
  const { push, stack } = useNavigation();
  const [items, setItems] = useState<TimelineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  const prevStackLen = useRef(stack.length);
  useEffect(() => {
    if (stack.length < prevStackLen.current) setReloadKey((k) => k + 1);
    prevStackLen.current = stack.length;
  }, [stack.length]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        const table = await fetchTable(config.table);
        const ids = table.id as number[];
        const filterVals = table[config.filterCol] as unknown[];
        const dates = table[config.dateCol] as unknown[];
        const types = table[config.typeCol] as unknown[];
        const details = config.detailCol ? table[config.detailCol] as unknown[] : null;

        const matched: TimelineItem[] = [];
        for (let i = 0; i < ids.length; i++) {
          const ref = filterVals[i];
          const matches =
            config.refType === 'RefList'
              ? Array.isArray(ref) && ref[0] === 'L' && ref.includes(filterId)
              : ref === filterId;

          if (!matches) continue;

          const rawDate = dates?.[i];
          let dateStr = '';
          if (typeof rawDate === 'number' && rawDate > 0) {
            dateStr = new Date(rawDate * 1000).toLocaleDateString('fr-FR', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            });
          } else if (typeof rawDate === 'string') {
            dateStr = rawDate;
          }

          const rawType = types?.[i];
          let parsedTypes: string[] = [];
          if (Array.isArray(rawType) && rawType[0] === 'L') {
            parsedTypes = (rawType as unknown[]).slice(1).map(String).filter(Boolean);
          } else if (typeof rawType === 'string' && rawType) {
            parsedTypes = [rawType];
          }

          matched.push({
            id: ids[i],
            date: dateStr,
            dateTs: typeof rawDate === 'number' ? rawDate : 0,
            types: parsedTypes,
            detail: details && typeof details[i] === 'string' ? (details[i] as string) : '',
          });
        }

        matched.sort((a, b) => b.dateTs - a.dateTs || b.id - a.id);

        if (!cancelled) setItems(matched);
      } catch (err) {
        console.warn(`[Timeline] Failed to fetch ${config.table}:`, err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [filterId, fetchTable, reloadKey, config]);

  const handleAdd = () => {
    const initialFields: Record<string, unknown> = {
      [config.filterCol]:
        config.refType === 'RefList' ? ['L', filterId] : filterId,
    };
    if (config.addDateCol) {
      const now = new Date();
      initialFields[config.addDateCol] = Math.floor(
        Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / 1000,
      );
    }
    push(config.addScreen, { initialFields });
  };

  const handleEdit = (item: TimelineItem) => {
    const typeLabel = item.types.join(', ');
    const label = config.editLabelCol
      ? typeLabel
      : typeLabel || String(item.id);
    push(config.editScreen, { editId: String(item.id), editLabel: label });
  };

  return (
    <div className="timeline-section">
      <hr className="section-divider" />
      <div className="section-title">
        <span className="material-icons">{config.icon}</span>
        {config.title}
        <button type="button" className="section-title__add" onClick={handleAdd}>
          <span className="material-icons">add</span>
        </button>
      </div>
      {!loading && items.length === 0 && (
        <div className="timeline-empty">{config.emptyMessage ?? 'Aucun élément'}</div>
      )}
      {!loading && items.length > 0 && (
        <div className="timeline">
          {items.map((item, index) => (
            <div
              key={item.id}
              className="timeline__item"
              onClick={() => handleEdit(item)}
            >
              <div className="timeline__marker">
                <span className="timeline__dot" />
                {index < items.length - 1 && <span className="timeline__line" />}
              </div>
              <div className="timeline__content">
                <div className="timeline__header">
                  <span className="timeline__date">{item.date || 'Non datée'}</span>
                  {item.types.length > 0 && (
                    <div className="timeline__types">
                      {item.types.map((t) => (
                        <span key={t} className="timeline__type">{t}</span>
                      ))}
                    </div>
                  )}
                </div>
                {index === 0 && item.detail && (
                  <div className="timeline__detail">
                    <span className="material-icons">arrow_forward</span>
                    <span>{stripMarkdown(item.detail)}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
