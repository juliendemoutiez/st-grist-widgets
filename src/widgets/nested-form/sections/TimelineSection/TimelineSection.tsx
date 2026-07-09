import './TimelineSection.scss';
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

/** Dropdown menu with a delete action, shown from the item's three-dot button. */
function TimelineItemMenu({ onDelete, onClose }: { onDelete: () => void; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="timeline__dropdown"
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        className="timeline__dropdown-item timeline__dropdown-item--danger"
        onClick={() => { onDelete(); onClose(); }}
      >
        <span className="material-icons">delete</span>
        Supprimer
      </button>
    </div>
  );
}

export function TimelineSection({ config, filterId }: TimelineProps) {
  const { fetchTable, updateRecord } = useGrist();
  const { push, stack } = useNavigation();
  const [items, setItems] = useState<TimelineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const [menuOpenId, setMenuOpenId] = useState<number | null>(null);
  // Detected at runtime from actual data; falls back to config.refType on first render.
  const detectedIsRefList = useRef(config.refType === 'RefList');

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
        const filterVals = table[config.filterCol] as unknown[] | undefined;

        if (!filterVals) {
          console.warn(
            `[Timeline] Column "${config.filterCol}" not found in table "${config.table}".`,
            'Available columns:', Object.keys(table).join(', '),
          );
          if (!cancelled) setItems([]);
          return;
        }

        // Detect actual column format from the first non-empty value.
        const sample = filterVals.find(v => v !== 0 && v !== null && v !== undefined);
        if (sample !== undefined) {
          detectedIsRefList.current = Array.isArray(sample) && (sample as unknown[])[0] === 'L';
        }

        const dates = table[config.dateCol] as unknown[];
        const types = table[config.typeCol] as unknown[];
        const details = config.detailCol ? table[config.detailCol] as unknown[] : null;
        const deleted = config.deletedCol ? table[config.deletedCol] as unknown[] : null;

        const matched: TimelineItem[] = [];
        for (let i = 0; i < ids.length; i++) {
          const ref = filterVals[i];
          const matches = detectedIsRefList.current
            ? Array.isArray(ref) && (ref as unknown[])[0] === 'L' && (ref as unknown[]).includes(filterId)
            : ref === filterId;

          if (!matches) continue;
          if (deleted && deleted[i]) continue;

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
      [config.filterCol]: detectedIsRefList.current ? ['L', filterId] : filterId,
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

  const handleDelete = async (id: number) => {
    if (!config.deletedCol) return;
    await updateRecord(config.table, id, { [config.deletedCol]: true });
    setReloadKey((k) => k + 1);
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
              className={['timeline__item', menuOpenId === item.id ? 'timeline__item--menu-open' : ''].filter(Boolean).join(' ')}
              onClick={() => handleEdit(item)}
            >
              <div className="timeline__marker">
                <span className="timeline__dot" />
                {index < items.length - 1 && <span className="timeline__line" />}
              </div>
              <div className="timeline__content">
                <div className="timeline__header">
                  <span className="timeline__date">{item.date || 'Non datée'}</span>
                  <div className="timeline__header-right">
                    {item.types.length > 0 && (
                      <div className="timeline__types">
                        {item.types.map((t) => (
                          <span key={t} className="timeline__type">{t}</span>
                        ))}
                      </div>
                    )}
                    {config.deletedCol && (
                      <div className="timeline__menu-wrap">
                        <button
                          type="button"
                          className="timeline__action-btn"
                          onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setMenuOpenId((cur) => (cur === item.id ? null : item.id));
                          }}
                          aria-label="Plus d'options"
                        >
                          <span className="material-icons">more_horiz</span>
                        </button>
                        {menuOpenId === item.id && (
                          <TimelineItemMenu
                            onDelete={() => handleDelete(item.id)}
                            onClose={() => setMenuOpenId(null)}
                          />
                        )}
                      </div>
                    )}
                  </div>
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
