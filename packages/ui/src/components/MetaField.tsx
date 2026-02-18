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

/** Hook to fetch rows from a Ref target table. Returns options as { value: id, label }. */
function useRefOptions(targetTable: string | null, reloadTrigger?: number, labelCol = 'Nom') {
  const { fetchTable } = useGrist();
  const [options, setOptions] = useState<PickerOption[]>([]);

  const reload = useCallback(async () => {
    if (!targetTable) return;
    try {
      const data = await fetchTable(targetTable);
      const items = data.id.map((id, i) => ({
        value: String(id),
        label: String((data[labelCol] as string[])?.[i] ?? ''),
      }));
      setOptions(items);
    } catch (err) {
      console.warn(`[MetaField] Could not fetch ${targetTable}:`, err);
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
      reload();
    }
  }, [reloadTrigger, reload]);

  return options;
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

/** Apply a text transform: 'uppercase' → all caps, 'capitalize' → first letter of each word. */
function applyTransform(val: string, transform?: 'uppercase' | 'capitalize'): string {
  if (!transform) return val;
  if (transform === 'uppercase') return val.toUpperCase();
  // capitalize: first letter after start, space, or hyphen
  return val.replace(/(^|[\s-])(\S)/g, (_, sep, c) => sep + c.toUpperCase());
}

export function MetaField({ colId, icon, label, value, onChange, onBlur, columnMeta, addLabel, onAdd, onClickSelected, refReloadTrigger, readOnly, avatar, transform, refLabelCol }: MetaFieldProps) {
  // Strip timezone suffix from DateTime types (e.g. "DateTime:Europe/Paris" → "DateTime")
  const rawType = columnMeta?.type ?? 'Text';
  const type = rawType.startsWith('DateTime') ? 'DateTime' : rawType;
  const refTarget = parseRefTarget(type);
  const refListTarget = parseRefListTarget(type);
  const refOptions = useRefOptions(refTarget ?? refListTarget, refReloadTrigger, refLabelCol);

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
