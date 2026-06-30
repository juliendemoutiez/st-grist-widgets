import './FormScreen.scss';
import type { ReactNode } from 'react';
import { useGrist } from '@grist-widgets/ui';
import type { FormConfig } from '@grist-widgets/ui';
import { FormShell } from '../FormShell/FormShell';
import { FormField } from '../FormField/FormField';
import { useFormData } from './useFormData';

interface FormScreenProps {
  config: FormConfig;
  mode: 'currentRecord' | 'subForm';
  /** Render prop receiving the active Grist row ID, used to render sections. */
  children?: (recordId: number) => ReactNode;
}

export function FormScreen({ config, mode, children }: FormScreenProps) {
  const { updateColumnWidgetOptions } = useGrist();
  const {
    title, fields, refReloadKey, recordId, headerDate, columnMeta, invalidFields,
    onTitleChange, onTitleBlur, onFieldChange, onFieldBlur,
    onBack, onNewRecord, onRefAdd, onRefEdit,
  } = useFormData(config, mode);

  const newRecordButton = onNewRecord && (
    <button type="button" className="new-record-btn" onClick={onNewRecord}>
      <span className="material-icons">add</span>
      {config.newRecordLabel}
    </button>
  );

  if (mode === 'currentRecord' && recordId == null) {
    return (
      <>
        {newRecordButton}
        <div className="empty-state">
          <span className="material-icons empty-state__icon">description</span>
          <p className="empty-state__text">{config.emptyMessage ?? 'Sélectionnez un enregistrement'}</p>
        </div>
      </>
    );
  }

  return (
    <>
      {newRecordButton}
      <FormShell
        title={title}
        onTitleChange={onTitleChange}
        onTitleBlur={onTitleBlur}
        titleDefault={config.titleDefault}
        titlePlaceholder={config.titlePlaceholder}
        headerRight={headerDate}
        onBack={onBack}
      >
        <div className="meta-section">
          {config.fields.map((f) => (
            <FormField
              key={f.colId}
              colId={f.colId}
              icon={f.icon}
              label={f.label}
              value={fields[f.colId]}
              onChange={(v) => onFieldChange(f.colId, v)}
              onBlur={() => onFieldBlur(f.colId)}
              columnMeta={columnMeta[f.colId]}
              onCreateChoice={
                f.createChoice
                  ? async (newLabel, color) => {
                      const meta = columnMeta[f.colId];
                      const current = meta?.widgetOptions ?? {};
                      const choices = [...(current.choices ?? []), newLabel];
                      const choiceOptions = { ...(current.choiceOptions ?? {}) };
                      if (color) choiceOptions[newLabel] = { fillColor: color.fillColor, textColor: color.textColor };
                      await updateColumnWidgetOptions(config.table, f.colId, { ...current, choices, choiceOptions });
                    }
                  : undefined
              }
              addLabel={f.addLabel}
              onAdd={f.refAddScreen ? () => onRefAdd(f.colId, f.refAddScreen!) : undefined}
              onClickSelected={f.refEditScreen ? (v, label) => onRefEdit(f.colId, f.refEditScreen!, v, label) : undefined}
              refReloadTrigger={refReloadKey}
              readOnly={f.readOnly}
              hasError={invalidFields.has(f.colId)}
              avatar={f.avatar}
              transform={f.transform}
              refLabelCol={f.refLabelCol}
              mailto={f.mailto}
            />
          ))}
        </div>
        {children && recordId != null && children(recordId)}
      </FormShell>
    </>
  );
}
