import './FormField.scss';
import { useCallback, useEffect, useRef, useState } from 'react';
import { UserAvatar } from '@gouvfr-lasuite/ui-kit';
import { PickerSelect, DatePickerSelect, useGrist, parseRefTarget, parseRefListTarget, decodeRefList, decodeChoiceList, formatDateTime, formatDate, toDateTimeLocal, fromDateTimeLocal, parseHyperlink, getHyperlinkDisplay, applyTransform } from '@grist-widgets/ui';
import type { PickerOption, ColumnMeta } from '@grist-widgets/ui';

interface FormFieldProps {
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
  required?: boolean;
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

export function FormRow({ icon, label, children }: { icon: string; label: string; children: React.ReactNode }) {
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
      console.warn(`[FormField] Could not fetch ${targetTable}:`, err);
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


export function FormField({ colId: _colId, icon, label, value, onChange, onBlur, columnMeta, addLabel, onAdd, onClickSelected, refReloadTrigger, readOnly, required, avatar, transform, refLabelCol, mailto, onCreateChoice }: FormFieldProps) {
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

    if (readOnly) {
      const opt = allOptions.find(o => o.value === strValue);
      return (
        <FormRow icon={icon} label={label}>
          <span className="meta-row__value-static">
            {strValue ? (
              <span
                className="picker-select__relation-chip"
                style={opt?.fillColor ? { backgroundColor: opt.fillColor, color: opt.textColor } : undefined}
              >
                {opt?.label ?? strValue}
              </span>
            ) : '—'}
          </span>
        </FormRow>
      );
    }

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
      <FormRow icon={icon} label={label}>
        <PickerSelect
          options={allOptions}
          value={strValue}
          onChange={(v) => { onChange(v ?? ''); onBlur?.(); }}
          placeholder="Choisir..."
          avatar={avatar}
          onCreate={handleCreateChoice}
        />
      </FormRow>
    );
  }

  if (type === 'ChoiceList') {
    const baseOptions = buildChoiceOptions(columnMeta!);
    const allOptions = [
      ...baseOptions,
      ...extraChoices.filter((e) => !baseOptions.some((o) => o.value === e.value)),
    ];
    const arrValue = decodeChoiceList(value);

    if (readOnly) {
      return (
        <FormRow icon={icon} label={label}>
          <span className="meta-row__value-static">
            {arrValue.length === 0
              ? '—'
              : arrValue.map((v) => {
                  const opt = allOptions.find(o => o.value === v);
                  return (
                    <span
                      key={v}
                      className="picker-select__relation-chip"
                      style={opt?.fillColor ? { backgroundColor: opt.fillColor, color: opt.textColor } : undefined}
                    >
                      {opt?.label ?? v}
                    </span>
                  );
                })
            }
          </span>
        </FormRow>
      );
    }

    const handleCreate = onCreateChoice
      ? (newLabel: string) => {
          setExtraChoices((prev) => [...prev, { value: newLabel, label: newLabel }]);
          onChange(['L', ...arrValue, newLabel]);
          onBlur?.();
          onCreateChoice(newLabel).catch(() => {});
        }
      : undefined;

    return (
      <FormRow icon={icon} label={label}>
        <PickerSelect
          mode="multi"
          options={allOptions}
          value={arrValue}
          onChange={(v) => { onChange(['L', ...v]); onBlur?.(); }}
          onCreate={handleCreate}
        />
      </FormRow>
    );
  }

  if (refTarget) {
    const numValue = Number(value);
    const strValue = value != null && value !== 0 && !Number.isNaN(numValue) ? String(value) : undefined;
    if (refLoading && strValue) {
      return <FormRow icon={icon} label={label}><span className="meta-row__skeleton" /></FormRow>;
    }
    if (readOnly) {
      const opt = refOptions.find(o => o.value === strValue);
      const chipLabel = opt?.label ?? '\u2014';
      return (
        <FormRow icon={icon} label={label}>
          <span className="meta-row__value-static">
            {strValue ? (
              <span className="picker-select__relation-chip">
                {onClickSelected && (
                  <span className="material-icons picker-select__relation-link" onClick={() => onClickSelected(strValue, opt?.label ?? '')}>link</span>
                )}
                {chipLabel}
              </span>
            ) : '\u2014'}
          </span>
        </FormRow>
      );
    }
    return (
      <FormRow icon={icon} label={label}>
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
      </FormRow>
    );
  }

  if (refListTarget) {
    const arrValue = decodeRefList(value).map(String);
    if (refLoading && arrValue.length > 0) {
      return (
        <FormRow icon={icon} label={label}>
          {arrValue.map((_, i) => <span key={i} className="meta-row__skeleton" />)}
        </FormRow>
      );
    }
    if (readOnly) {
      return (
        <FormRow icon={icon} label={label}>
          <span className="meta-row__value-static">
            {arrValue.length === 0
              ? '\u2014'
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
          </span>
        </FormRow>
      );
    }
    return (
      <FormRow icon={icon} label={label}>
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
      </FormRow>
    );
  }

  if (type === 'Int' || type === 'Numeric') {
    const numValue = value != null && value !== 0 ? Number(value) : '';
    if (readOnly) {
      return (
        <FormRow icon={icon} label={label}>
          <span className="meta-row__value-static">{numValue !== '' ? String(numValue) : '—'}</span>
        </FormRow>
      );
    }
    return (
      <FormRow icon={icon} label={label}>
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
      </FormRow>
    );
  }

  if (type === 'Date') {
    if (readOnly) {
      return (
        <FormRow icon={icon} label={label}>
          <span className="meta-row__value-static">{formatDate(value)}</span>
        </FormRow>
      );
    }
    return (
      <FormRow icon={icon} label={label}>
        <DatePickerSelect
          value={value as number | null}
          onChange={(v) => { onChange(v); onBlur?.(); }}
          placeholder={label}
          required={required}
        />
      </FormRow>
    );
  }

  if (type === 'DateTime') {
    if (readOnly) {
      return (
        <FormRow icon={icon} label={label}>
          <span className="meta-row__value-static">{formatDateTime(value)}</span>
        </FormRow>
      );
    }
    return (
      <FormRow icon={icon} label={label}>
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
      </FormRow>
    );
  }

  if (type === 'Bool') {
    const boolValue = Boolean(value);
    return (
      <FormRow icon={icon} label={label}>
        <div className="meta-row__toggle-wrap">
          <button
            type="button"
            role="switch"
            aria-checked={boolValue}
            className={`form-toggle${boolValue ? ' form-toggle--on' : ''}${readOnly ? ' form-toggle--readonly' : ''}`}
            onClick={() => { if (!readOnly) { onChange(!boolValue); onBlur?.(); } }}
          >
            <span className="form-toggle__thumb" />
          </button>
        </div>
      </FormRow>
    );
  }

  // HyperLink: Text column styled as hyperlink
  const isHyperlink = columnMeta?.widgetOptions?.widget === 'HyperLink';
  if (isHyperlink) {
    const parsed = parseHyperlink(value);
    const displayText = parsed ? getHyperlinkDisplay(parsed) : '';

    if (readOnly) {
      return (
        <FormRow icon={icon} label={label}>
          {parsed
            ? <a href={parsed.url} target="_blank" rel="noopener noreferrer" className="meta-row__hl-chip">{displayText}</a>
            : <span className="meta-row__value-static">{'\u2014'}</span>
          }
        </FormRow>
      );
    }

    const strValue = value != null ? String(value) : '';

    if (parsed && !hlEditing) {
      return (
        <FormRow icon={icon} label={label}>
          <div className="meta-row__link-wrap">
            <a href={parsed.url} target="_blank" rel="noopener noreferrer" className="meta-row__hl-chip">{displayText}</a>
            <button type="button" className="meta-row__hl-edit" onClick={() => setHlEditing(true)} title="Modifier">
              <span className="material-icons">edit</span>
            </button>
          </div>
        </FormRow>
      );
    }

    return (
      <FormRow icon={icon} label={label}>
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
      </FormRow>
    );
  }

  // Default: Text
  if (readOnly) {
    const display = value != null && value !== '' ? String(value) : '\u2014';
    return (
      <FormRow icon={icon} label={label}>
        <span className="meta-row__value-static">
          {avatar && display !== '\u2014' && <UserAvatar fullName={display} size="xsmall" />}
          {display}
          {mailto && display !== '\u2014' && (
            <a href={`mailto:${display}`} className="meta-row__mailto" title={`Envoyer un email à ${display}`}>
              <span className="material-icons">mail</span>
            </a>
          )}
        </span>
      </FormRow>
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
    <FormRow icon={icon} label={label}>
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
    </FormRow>
  );
}
