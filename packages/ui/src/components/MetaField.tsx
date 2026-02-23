import { useCallback, useEffect, useRef, useState } from 'react';
import { UserAvatar } from '@gouvfr-lasuite/ui-kit';
import { PickerSelect, type PickerOption } from './PickerSelect';
import { useGrist } from '../contexts/GristContext';
import type { ColumnMeta } from '../hooks/useColumnMeta';

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

/** Build picker options from Choice/ChoiceList widgetOptions. */
function buildChoiceOptions(meta: ColumnMeta): PickerOption[] {
  const choices = meta.widgetOptions?.choices ?? [];
  const choiceOpts = meta.widgetOptions?.choiceOptions ?? {};
  return choices.map((label) => ({
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
  // Track which targetTable options have actually been loaded for.
  // This lets us derive `loading` synchronously during render, so the skeleton
  // is shown even when targetTable transitions from null → non-null mid-lifecycle
  // (e.g. when columnMeta loads asynchronously after the initial render).
  const loadedForRef = useRef<string | null>(null);
  // Explicit reloading flag for when reloadTrigger fires (loadedForRef won't help
  // there since the table hasn't changed, only its data has).
  const [reloading, setReloading] = useState(false);

  // loading = true when:
  // 1. targetTable is set but we haven't loaded options for it yet (derived, synchronous)
  // 2. an explicit reload is in progress due to reloadTrigger
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
      loadedForRef.current = targetTable; // mark done even on error
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

  // Re-fetch when reloadTrigger changes (after initial load)
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
    month: 'long',
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

/** Convert a Grist Date timestamp (UTC midnight) to a date input value (YYYY-MM-DD). */
function toDateInput(value: unknown): string {
  const d = gristTsToDate(value);
  if (!d) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** Convert a date input value (YYYY-MM-DD) back to a Grist Date timestamp (UTC midnight, seconds). */
function fromDateInput(str: string): number {
  const [y, m, d] = str.split('-').map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 1000);
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
  // capitalize: first letter after start, space, or hyphen
  return val.replace(/(^|[\s-])(\S)/g, (_, sep, c) => sep + c.toUpperCase());
}

export function MetaField({ colId: _colId, icon, label, value, onChange, onBlur, columnMeta, addLabel, onAdd, onClickSelected, refReloadTrigger, readOnly, avatar, transform, refLabelCol }: MetaFieldProps) {
  // Strip timezone suffix from DateTime types (e.g. "DateTime:Europe/Paris" → "DateTime")
  const rawType = columnMeta?.type ?? 'Text';
  const type = rawType.startsWith('DateTime') ? 'DateTime' : rawType;
  const refTarget = parseRefTarget(type);
  const refListTarget = parseRefListTarget(type);
  const { options: refOptions, loading: refLoading } = useRefOptions(refTarget ?? refListTarget, refReloadTrigger, refLabelCol);
  const [hlEditing, setHlEditing] = useState(false);

  if (type === 'Choice') {
    const options = buildChoiceOptions(columnMeta!);
    const strValue = value != null && value !== '' ? String(value) : undefined;
    return (
      <MetaRow icon={icon} label={label}>
        <PickerSelect
          options={options}
          value={strValue}
          onChange={(v) => { onChange(v ?? ''); onBlur?.(); }}
          placeholder="Choisir..."
        />
      </MetaRow>
    );
  }

  if (type === 'ChoiceList') {
    const options = buildChoiceOptions(columnMeta!);
    const arrValue = decodeChoiceList(value);
    return (
      <MetaRow icon={icon} label={label}>
        <PickerSelect
          mode="multi"
          options={options}
          value={arrValue}
          onChange={(v) => { onChange(['L', ...v]); onBlur?.(); }}
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
        <input
          type="date"
          className="meta-row__input"
          value={toDateInput(value)}
          required
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLElement).blur();
          }}
          onBlur={() => onBlur?.()}
          onChange={(e) => {
            const v = e.target.value;
            if (v) onChange(fromDateInput(v));
          }}
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

    // Chip view: show pill + edit button
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

    // Edit view: text input (also shown when no value yet)
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
        </span>
      </MetaRow>
    );
  }
  const strValue = value != null ? String(value) : '';
  return (
    <MetaRow icon={icon} label={label}>
      <input
        type="text"
        className="meta-row__input"
        value={strValue}
        size={Math.max((strValue || label).length + 3, 4)}
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
    </MetaRow>
  );
}
