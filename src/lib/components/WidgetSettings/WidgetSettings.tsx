import { useState } from 'react';
import { Button } from '@gouvfr-lasuite/cunningham-react';
import { useGrist } from '../../contexts/GristContext';
import './widget-settings.scss';

interface WidgetSettingsProps {
  title: string;
  placeholder?: string;
  validate?: (parsed: unknown) => string | null;
  onDone: () => void;
}

export function WidgetSettings({ title, placeholder, validate, onDone }: WidgetSettingsProps) {
  const { widgetOptions, saveWidgetOptions } = useGrist();
  const [value, setValue] = useState(() =>
    widgetOptions ? JSON.stringify(widgetOptions, null, 2) : '',
  );
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(value);
    } catch {
      setError('Invalid JSON');
      return;
    }
    if (validate) {
      const err = validate(parsed);
      if (err) { setError(err); return; }
    }
    await saveWidgetOptions(parsed as Record<string, unknown>);
    onDone();
  };

  return (
    <div className="widget-settings">
      <div className="widget-settings__header">
        <h2>{title}</h2>
        <div className="widget-settings__actions">
          {widgetOptions && (
            <Button color="neutral" size="small" onClick={onDone}>
              Cancel
            </Button>
          )}
          <Button size="small" onClick={handleSave}>Save</Button>
        </div>
      </div>
      <div className="widget-settings__editor">
        <textarea
          className="widget-settings__textarea"
          value={value}
          onChange={(e) => { setValue(e.target.value); setError(null); }}
          placeholder={placeholder}
          spellCheck={false}
          autoFocus
        />
        {error && <p className="widget-settings__error">{error}</p>}
      </div>
    </div>
  );
}
