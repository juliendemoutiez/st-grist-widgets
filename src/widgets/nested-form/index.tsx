import './index.scss';
import { useMemo } from 'react';
import { NavigationProvider, useNavigation, useGrist, WidgetSettings } from '@grist-widgets/ui';
import type { NestedFormWidgetConfig, JsonScreenConfig } from '@grist-widgets/ui';
import { FormScreen } from './FormScreen/FormScreen';
import { SectionContent } from './sections/SectionContent/SectionContent';

// ── Settings ──────────────────────────────────────────────────────────────────

const SETTINGS_TITLE = 'Configuration du formulaire';

const SETTINGS_PLACEHOLDER = JSON.stringify(
  {
    initialScreen: 'MyForm',
    screens: {
      MyForm: {
        mode: 'currentRecord',
        table: 'MyTable',
        titleColId: 'Nom',
        titleDefault: 'Nouveau',
        titlePlaceholder: 'Titre...',
        fields: [{ colId: 'Champ1', icon: 'label', label: 'Champ 1' }],
      },
    },
  } satisfies NestedFormWidgetConfig,
  null,
  2,
);

function validateConfig(parsed: unknown): string | null {
  if (typeof parsed !== 'object' || parsed === null) return 'Config must be an object';
  const c = parsed as Record<string, unknown>;
  if (typeof c.initialScreen !== 'string') return '"initialScreen" must be a string';
  if (typeof c.screens !== 'object' || c.screens === null) return '"screens" must be an object';
  for (const [name, screen] of Object.entries(c.screens as Record<string, unknown>)) {
    if (typeof screen !== 'object' || screen === null) return `Screen "${name}" must be an object`;
    const s = screen as Record<string, unknown>;
    if (s.mode !== 'currentRecord' && s.mode !== 'subForm')
      return `Screen "${name}".mode must be "currentRecord" or "subForm"`;
    if (typeof s.table !== 'string') return `Screen "${name}".table must be a string`;
    if (!Array.isArray(s.fields)) return `Screen "${name}".fields must be an array`;
    if (typeof s.titleColId !== 'string') return `Screen "${name}".titleColId must be a string`;
    if (s.sections !== undefined) {
      if (!Array.isArray(s.sections)) return `Screen "${name}".sections must be an array`;
      for (const section of s.sections as unknown[]) {
        if (typeof section !== 'object' || section === null) return `A section in "${name}" must be an object`;
        const sec = section as Record<string, unknown>;
        if (!['timeline', 'tasks', 'comment'].includes(sec.type as string))
          return `Section type must be "timeline", "tasks", or "comment"`;
        if (sec.type === 'timeline') {
          if (typeof sec.table !== 'string') return `Timeline section in "${name}": "table" must be a string`;
          if (typeof sec.addScreen !== 'string') return `Timeline section in "${name}": "addScreen" must be a string`;
          if (typeof sec.editScreen !== 'string') return `Timeline section in "${name}": "editScreen" must be a string`;
        }
        if (sec.type === 'tasks') {
          if (typeof sec.table !== 'string') return `Tasks section in "${name}": "table" must be a string`;
          if (typeof sec.col !== 'string') return `Tasks section in "${name}": "col" must be a string`;
        }
        if (sec.type === 'comment') {
          if (typeof sec.col !== 'string') return `Comment section in "${name}": "col" must be a string`;
          if (typeof sec.title !== 'string') return `Comment section in "${name}": "title" must be a string`;
          if (typeof sec.icon !== 'string') return `Comment section in "${name}": "icon" must be a string`;
        }
      }
    }
  }
  return null;
}

// ── Renderer ──────────────────────────────────────────────────────────────────

function ScreenRenderer({ screens }: { screens: Record<string, JsonScreenConfig> }) {
  const { stack } = useNavigation();
  return (
    <>
      {stack.map((entry, index) => {
        const screen = screens[entry.screen];
        if (!screen || !screen.table || !screen.fields) return null;

        const childSections = screen.sections ?? [];
        const formConfig = {
          table: screen.table,
          fields: screen.fields,
          titleColId: screen.titleColId,
          titleDefault: screen.titleDefault,
          titlePlaceholder: screen.titlePlaceholder,
          titleReadOnly: screen.titleReadOnly,
          titlePrefix: screen.titlePrefix,
          headerDateColId: screen.headerDateColId,
          headerDatePrefix: screen.headerDatePrefix,
          newRecordLabel: screen.newRecordLabel,
          emptyMessage: screen.emptyMessage,
        };

        return (
          <div
            key={`${entry.screen}-${index}`}
            style={{ display: index === stack.length - 1 ? 'block' : 'none' }}
          >
            <FormScreen config={formConfig} mode={screen.mode}>
              {childSections.length > 0
                ? (recordId) => (
                    <>
                      {childSections.map((section, i) => (
                        <SectionContent
                          key={i}
                          section={section}
                          recordId={recordId}
                          parentTable={screen.table}
                        />
                      ))}
                    </>
                  )
                : undefined}
            </FormScreen>
          </div>
        );
      })}
    </>
  );
}

// ── Widget ────────────────────────────────────────────────────────────────────

export function NestedFormWidget() {
  const { widgetOptions, isConfiguringWidget, setIsConfiguringWidget } = useGrist();

  const widgetConfig = widgetOptions as NestedFormWidgetConfig | null;
  const screens = useMemo(() => widgetConfig?.screens ?? {}, [widgetConfig]);

  if (isConfiguringWidget) {
    return (
      <WidgetSettings
        title={SETTINGS_TITLE}
        placeholder={SETTINGS_PLACEHOLDER}
        validate={validateConfig}
        onDone={() => setIsConfiguringWidget(false)}
      />
    );
  }

  if (!widgetConfig?.initialScreen) {
    return (
      <div className="empty-state">
        <span className="material-icons empty-state__icon">settings</span>
        <p className="empty-state__text">Configurez ce widget pour commencer</p>
      </div>
    );
  }

  return (
    <div style={{ height: '100%' }}>
      <NavigationProvider initialScreen={widgetConfig.initialScreen}>
        <ScreenRenderer screens={screens} />
      </NavigationProvider>
    </div>
  );
}
