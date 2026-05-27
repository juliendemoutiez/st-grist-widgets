import { useCallback, useEffect, useRef, useState } from 'react';
import { UserAvatar } from '@gouvfr-lasuite/ui-kit';
import { PickerSelect, DatePickerSelect, useGrist } from '@grist-widgets/ui';
import type { PickerOption, ColumnMeta } from '@grist-widgets/ui';

interface MetaFieldProps {
  colId: string;
  icon: string;
  label: string;
  value: unknown;
  onChange: (value: unknown) => void;
  /** Called when the field should be persisted (on blur for inputs, on select for pickers). */
  onBlur?: () => void;
  columnMeta: ColumnMeta | undefined;
  /** For Ref columns: label for the "Ajouter" button */
  addLabel?: string;
  /** For Ref columns: callback when "Ajouter" is clicked */
  onAdd?: () => void;
  /** For Ref columns: callback when clicking an already-selected relation chip */
  onClickSelected?: (value: string, label: string) => void;
  /** Increment to trigger a re-fetch of Ref options */
  refReloadTrigger?: number;
  /** When true, render as read-only static display */
  readOnly?: boolean;
  /** Show a letter avatar before read-only text value */
  avatar?: boolean;
  /** Text transform applied on blur: 'uppercase' or 'capitalize' */
  transform?: 'uppercase' | 'capitalize';
  /** Column to use as display label for Ref/RefList options (defaults to 'Nom') */
  refLabelCol?: string;
  /** Show a mailto: link icon next to the field value */
  mailto?: boolean;
  /** Called when the user creates a new choice in a Choice/ChoiceList field */
  onCreateChoice?: (label: string, color?: { fillColor: string; textColor: string }) => Promise<void>;
}

export function MetaRow({ icon, label, children }: { icon: string; label: string; children: React.ReactNode }) {
  return (
    <div className="meta-row">
      <div className="meta-row__label">
        <span className="material-icons">{icon}</span>
        <span>{label}</span>
      </div>
      <div className="meta-row__value">{children}</div>
    </div>
  );
}

const CHOICE_PALETTE: { fillColor: string; textColor: string }[] = [
  { fillColor: '#fecdd3', textColor: '#9f1239' },
  { fillColor: '#fed7aa', textColor: '#9a3412' },
  { fillColor: '#fef08a', textColor: '#854d0e' },
  { fillColor: '#bbf7d0', textColor: '#14532d' },
  { fillColor: '#bfdbfe', textColor: '#1e3a8a' },
  { fillColor: '#ddd6fe', textColor: '#4c1d95' },
  { fillColor: '#fbcfe8', textColor: '#9d174d' },
  { fillColor: '#a5f3fc', textColor: '#164e63' },
  { fillColor: '#d9f99d', textColor: '#3f6212' },
  { fillColor: '#fde68a', textColor: '#92400e' },
];

function randomChoiceColor() {
  return CHOICE_PALETTE[Math.floor(Math.random() * CHOICE_PALETTE.length)];
}

/** Build picker options from Choice/ChoiceList widgetOptions. */
function buildChoiceOptions(meta: ColumnMeta): PickerOption[] {
  const choices = meta.widgetOptions?.choices ?? [];
  const choiceOpts = meta.widgetOptions?.choiceOptions ?? {};
  return [...choices]
    .sort((a, b) => a.localeCompare(b, 'fr'))
    .map((label) => ({
      value: label,
      label,
      fillColor: choiceOpts[label]?.fillColor,
      textColor: choiceOpts[label]?.textColor,
    }));
}

/** Hook to fetch rows from a Ref target table. Returns options and a loading flag. */
function useRefOptions(targetTable: string | null, reloadTrigger?: number, labelCol = 'Nom') {
  const { fetchTable } = useGrist();
  const [options, setOptions] = useState<PickerOption[]>([]);
  const loadedForRef = useRef<string | null>(null);
  const [reloading, setReloading] = useState(false);

  const loading = reloading || (targetTable !== null && loadedForRef.current !== targetTable);

  const reload = useCallback(async () => {
    if (!targetTable) return;
    try {
      const data = await fetchTable(targetTable);
      const items = (data.id as number[]).map((id: number, i: number) => ({
        value: String(id),
        label: String((data[labelCol] as string[])?.[i] ?? ''),
      }));
      loadedForRef.current = targetTable;
      setOptions(items);
    } catch (err) {
      console.warn(`[MetaField] Could not fetch ${targetTable}:`, err);
      loadedForRef.current = targetTable;
    } finally {
      setReloading(false);
    }
  }, [fetchTable, targetTable, labelCol]);

  const initialLoadRef = useRef(false);
  useEffect(() => {
    if (!targetTable) return;
    if (!initialLoadRef.current) {
      initialLoadRef.current = true;
      reload();
    }
  }, [reload, targetTable]);

  const prevTrigger = useRef(reloadTrigger);
  useEffect(() => {
    if (reloadTrigger !== prevTrigger.current) {
      prevTrigger.current = reloadTrigger;
      setReloading(true);
      reload();
    }
  }, [reloadTrigger, reload]);

  return { options, loading };
}

/** Extract the target table name from a Ref type string, e.g. "Ref:Organisations" -> "Organisations" */
function parseRefTarget(type: string): string | null {
  const match = type.match(/^Ref:(.+)$/);
  return match ? match[1] : null;
}

/** Extract the target table name from a RefList type string, e.g. "RefList:CONTACTS" -> "CONTACTS" */
function parseRefListTarget(type: string): string | null {
  const match = type.match(/^RefList:(.+)$/);
  return match ? match[1] : null;
}

/** Decode a Grist RefList value to a number array. Grist encodes RefList as ['L', id1, id2, ...]. */
function decodeRefList(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  const arr = value as unknown[];
  if (arr.length > 0 && arr[0] === 'L') {
    return arr.slice(1).map(Number);
  }
  return arr.map(Number);
}

/** Convert a Grist timestamp (seconds since epoch) to a JS Date, or null. */
function gristTsToDate(value: unknown): Date | null {
  if (value == null || value === 0) return null;
  const ts = typeof value === 'number' ? value : Number(value);
  if (isNaN(ts)) return null;
  return new Date(ts * 1000);
}

/** Format a Grist timestamp as a localized date+time string. */
function formatDateTime(value: unknown): string {
  const d = gristTsToDate(value);
  if (!d) return '\u2014';
  return d.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Format a Grist Date value (UTC midnight) as a localized date-only string. */
function formatDate(value: unknown): string {
  const d = gristTsToDate(value);
  if (!d) return '\u2014';
  return d.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/** Convert a Grist timestamp to the `datetime-local` input format (YYYY-MM-DDThh:mm). */
function toDateTimeLocal(value: unknown): string {
  const d = gristTsToDate(value);
  if (!d) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Convert a `datetime-local` input value back to a Grist timestamp (seconds). */
function fromDateTimeLocal(str: string): number {
  return Math.floor(new Date(str).getTime() / 1000);
}

/**
 * Decode a Grist ChoiceList value to a plain string array.
 * Grist encodes ChoiceList as ['L', 'val1', 'val2', ...].
 */
function decodeChoiceList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const arr = value as unknown[];
  if (arr.length > 0 && arr[0] === 'L') {
    return arr.slice(1).map(String);
  }
  return arr.map(String);
}

/**
 * Parse a Grist hyperlink value.
 * Grist format: "Label https://url" (text then space then URL), or just "https://url".
 * Returns null if the value is empty/null.
 */
function parseHyperlink(value: unknown): { url: string; label: string } | null {
  if (!value || typeof value !== 'string' || !value.trim()) return null;
  const str = value.trim();
  const lastSpace = str.lastIndexOf(' ');
  if (lastSpace !== -1) {
    const potentialUrl = str.slice(lastSpace + 1);
    if (/^https?:\/\/\S/.test(potentialUrl)) {
      return { url: potentialUrl, label: str.slice(0, lastSpace) };
    }
  }
  const url = /^https?:\/\//.test(str) ? str : `https://${str}`;
  return { url, label: str };
}

/** Return a short display label for a hyperlink: use the explicit label if set, otherwise the hostname. */
function getHyperlinkDisplay(parsed: { url: string; label: string }): string {
  if (parsed.label !== parsed.url) return parsed.label;
  try { return new URL(parsed.url).hostname; } catch { return parsed.url; }
}

/** Apply a text transform: 'uppercase' → all caps, 'capitalize' → first letter of each word. */
function applyTransform(val: string, transform?: 'uppercase' | 'capitalize'): string {
  if (!transform) return val;
  if (transform === 'uppercase') return val.toUpperCase();
  return val.replace(/(^|[\s-])(\S)/g, (_, sep, c) => sep + c.toUpperCase());
}

export function MetaField({ colId: _colId, icon, label, value, onChange, onBlur, columnMeta, addLabel, onAdd, onClickSelected, refReloadTrigger, readOnly, avatar, transform, refLabelCol, mailto, onCreateChoice }: MetaFieldProps) {
  const rawType = columnMeta?.type ?? 'Text';
  const type = rawType.startsWith('DateTime') ? 'DateTime' : rawType;
  const refTarget = parseRefTarget(type);
  const refListTarget = parseRefListTarget(type);
  const { options: refOptions, loading: refLoading } = useRefOptions(refTarget ?? refListTarget, refReloadTrigger, refLabelCol);
  const [hlEditing, setHlEditing] = useState(false);
  const [extraChoices, setExtraChoices] = useState<PickerOption[]>([]);

  if (type === 'Choice') {
    const baseOptions = buildChoiceOptions(columnMeta!);
    const allOptions = [
      ...baseOptions,
      ...extraChoices.filter((e) => !baseOptions.some((o) => o.value === e.value)),
    ];
    const strValue = value != null && value !== '' ? String(value) : undefined;

    const handleCreateChoice = onCreateChoice
      ? (newLabel: string) => {
          const color = randomChoiceColor();
          setExtraChoices((prev) => [...prev, { value: newLabel, label: newLabel, ...color }]);
          onChange(newLabel);
          onBlur?.();
          onCreateChoice(newLabel, color).catch(() => {});
        }
      : undefined;

    return (
      <MetaRow icon={icon} label={label}>
        <PickerSelect
          options={allOptions}
          value={strValue}
          onChange={(v) => { onChange(v ?? ''); onBlur?.(); }}
          placeholder="Choisir..."
          avatar={avatar}
          onCreate={handleCreateChoice}
        />
      </MetaRow>
    );
  }

  if (type === 'ChoiceList') {
    const baseOptions = buildChoiceOptions(columnMeta!);
    const allOptions = [
      ...baseOptions,
      ...extraChoices.filter((e) => !baseOptions.some((o) => o.value === e.value)),
    ];
    const arrValue = decodeChoiceList(value);

    const handleCreate = onCreateChoice
      ? (newLabel: string) => {
          setExtraChoices((prev) => [...prev, { value: newLabel, label: newLabel }]);
          onChange(['L', ...arrValue, newLabel]);
          onBlur?.();
          onCreateChoice(newLabel).catch(() => {});
        }
      : undefined;

    return (
      <MetaRow icon={icon} label={label}>
        <PickerSelect
          mode="multi"
          options={allOptions}
          value={arrValue}
          onChange={(v) => { onChange(['L', ...v]); onBlur?.(); }}
          onCreate={handleCreate}
        />
      </MetaRow>
    );
  }

  if (refTarget) {
    const strValue = value != null && value !== 0 ? String(value) : undefined;
    if (refLoading && strValue) {
      return <MetaRow icon={icon} label={label}><span className="meta-row__skeleton" /></MetaRow>;
    }
    if (readOnly) {
      const opt = refOptions.find(o => o.value === strValue);
      const chipLabel = opt?.label ?? '\u2014';
      return (
        <MetaRow icon={icon} label={label}>
          {strValue ? (
            <span className="picker-select__relation-chip">
              {onClickSelected && (
                <span className="material-icons picker-select__relation-link" onClick={() => onClickSelected(strValue, opt?.label ?? '')}>link</span>
              )}
              {chipLabel}
            </span>
          ) : <span className="meta-row__value-static">{'\u2014'}</span>}
        </MetaRow>
      );
    }
    return (
      <MetaRow icon={icon} label={label}>
        <PickerSelect
          options={refOptions}
          value={strValue}
          onChange={(v) => { onChange(v ? Number(v) : 0); onBlur?.(); }}
          placeholder="Choisir..."
          addLabel={addLabel}
          onAdd={onAdd}
          relation
          onClickSelected={onClickSelected ? (v) => {
            const opt = refOptions.find(o => o.value === v);
            onClickSelected(v, opt?.label ?? '');
          } : undefined}
        />
      </MetaRow>
    );
  }

  if (refListTarget) {
    const arrValue = decodeRefList(value).map(String);
    if (refLoading && arrValue.length > 0) {
      return (
        <MetaRow icon={icon} label={label}>
          {arrValue.map((_, i) => <span key={i} className="meta-row__skeleton" />)}
        </MetaRow>
      );
    }
    if (readOnly) {
      return (
        <MetaRow icon={icon} label={label}>
          {arrValue.length === 0
            ? <span className="meta-row__value-static">{'\u2014'}</span>
            : arrValue.map((v) => {
                const opt = refOptions.find(o => o.value === v);
                return (
                  <span key={v} className="picker-select__relation-chip">
                    {onClickSelected && (
                      <span className="material-icons picker-select__relation-link" onClick={() => onClickSelected(v, opt?.label ?? '')}>link</span>
                    )}
                    {opt?.label ?? '\u2014'}
                  </span>
                );
              })
          }
        </MetaRow>
      );
    }
    return (
      <MetaRow icon={icon} label={label}>
        <PickerSelect
          mode="multi"
          options={refOptions}
          value={arrValue}
          onChange={(v) => { onChange(v.length > 0 ? ['L', ...v.map(Number)] : null); onBlur?.(); }}
          placeholder="Choisir..."
          addLabel={addLabel}
          onAdd={onAdd}
          relation
          onClickSelected={onClickSelected ? (v) => {
            const opt = refOptions.find(o => o.value === v);
            onClickSelected(v, opt?.label ?? '');
          } : undefined}
        />
      </MetaRow>
    );
  }

  if (type === 'Int' || type === 'Numeric') {
    const numValue = value != null && value !== 0 ? Number(value) : '';
    return (
      <MetaRow icon={icon} label={label}>
        <input
          type="number"
          className="meta-row__input"
          value={numValue}
          style={{ width: `${Math.max(String(numValue || '0').length + 2, 3)}ch` }}
          min={0}
          step={type === 'Int' ? 1 : undefined}
          placeholder="0"
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLElement).blur();
          }}
          onBlur={() => onBlur?.()}
          onChange={(e) => {
            const v = e.target.value;
            const num = v === '' ? 0 : (type === 'Int' ? parseInt(v, 10) : parseFloat(v));
            onChange(num);
          }}
        />
      </MetaRow>
    );
  }

  if (type === 'Date') {
    if (readOnly) {
      return (
        <MetaRow icon={icon} label={label}>
          <span className="meta-row__value-static">{formatDate(value)}</span>
        </MetaRow>
      );
    }
    return (
      <MetaRow icon={icon} label={label}>
        <DatePickerSelect
          value={value as number | null}
          onChange={(v) => { onChange(v); onBlur?.(); }}
          placeholder={label}
        />
      </MetaRow>
    );
  }

  if (type === 'DateTime') {
    if (readOnly) {
      return (
        <MetaRow icon={icon} label={label}>
          <span className="meta-row__value-static">{formatDateTime(value)}</span>
        </MetaRow>
      );
    }
    return (
      <MetaRow icon={icon} label={label}>
        <input
          type="datetime-local"
          className="meta-row__input"
          value={toDateTimeLocal(value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLElement).blur();
          }}
          onBlur={() => onBlur?.()}
          onChange={(e) => {
            const v = e.target.value;
            onChange(v ? fromDateTimeLocal(v) : null);
          }}
        />
      </MetaRow>
    );
  }

  // HyperLink: Text column styled as hyperlink
  const isHyperlink = columnMeta?.widgetOptions?.widget === 'HyperLink';
  if (isHyperlink) {
    const parsed = parseHyperlink(value);
    const displayText = parsed ? getHyperlinkDisplay(parsed) : '';

    if (readOnly) {
      return (
        <MetaRow icon={icon} label={label}>
          {parsed
            ? <a href={parsed.url} target="_blank" rel="noopener noreferrer" className="meta-row__hl-chip">{displayText}</a>
            : <span className="meta-row__value-static">{'\u2014'}</span>
          }
        </MetaRow>
      );
    }

    const strValue = value != null ? String(value) : '';

    if (parsed && !hlEditing) {
      return (
        <MetaRow icon={icon} label={label}>
          <div className="meta-row__link-wrap">
            <a href={parsed.url} target="_blank" rel="noopener noreferrer" className="meta-row__hl-chip">{displayText}</a>
            <button type="button" className="meta-row__hl-edit" onClick={() => setHlEditing(true)} title="Modifier">
              <span className="material-icons">edit</span>
            </button>
          </div>
        </MetaRow>
      );
    }

    return (
      <MetaRow icon={icon} label={label}>
        <input
          type="text"
          className="meta-row__input"
          value={strValue}
          // eslint-disable-next-line jsx-a11y/no-autofocus
          autoFocus={hlEditing}
          placeholder={label}
          onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLElement).blur(); }}
          onBlur={() => { setHlEditing(false); onBlur?.(); }}
          onChange={(e) => { setHlEditing(true); onChange(e.target.value); }}
        />
      </MetaRow>
    );
  }

  // Default: Text
  if (readOnly) {
    const display = value != null && value !== '' ? String(value) : '\u2014';
    return (
      <MetaRow icon={icon} label={label}>
        <span className="meta-row__value-static">
          {avatar && display !== '\u2014' && <UserAvatar fullName={display} size="xsmall" />}
          {display}
          {mailto && display !== '\u2014' && (
            <a href={`mailto:${display}`} className="meta-row__mailto" title={`Envoyer un email à ${display}`}>
              <span className="material-icons">mail</span>
            </a>
          )}
        </span>
      </MetaRow>
    );
  }
  const strValue = value != null ? String(value) : '';
  const input = (
    <span
      className={`meta-row__input-sizer${mailto ? ' meta-row__input-sizer--capped' : ''}`}
      data-value={strValue}
    >
      <input
        type="text"
        className="meta-row__input"
        value={strValue}
        placeholder={label}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLElement).blur();
        }}
        onBlur={() => {
          if (transform) {
            const transformed = applyTransform(strValue, transform);
            if (transformed !== strValue) onChange(transformed);
          }
          onBlur?.();
        }}
        onChange={(e) => onChange(e.target.value)}
      />
    </span>
  );
  return (
    <MetaRow icon={icon} label={label}>
      {mailto ? (
        <div className="meta-row__link-wrap">
          {input}
          {strValue && (
            <a href={`mailto:${strValue}`} className="meta-row__mailto" title={`Envoyer un email à ${strValue}`}>
              <span className="material-icons">mail</span>
            </a>
          )}
        </div>
      ) : input}
    </MetaRow>
  );
}
