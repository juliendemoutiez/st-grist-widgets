import { NavigationProvider, useNavigation } from '@grist-widgets/ui';

type ScreenMap = Record<string, React.ComponentType>;

interface NestedFormWidgetProps {
  screens: ScreenMap;
  initialScreen: string;
}

function NavigationRenderer({ screens }: { screens: ScreenMap }) {
  const { stack } = useNavigation();

  return (
    <>
      {stack.map((entry, index) => {
        const Component = screens[entry.screen];
        return (
          <div
            key={`${entry.screen}-${index}`}
            style={{ display: index === stack.length - 1 ? 'block' : 'none' }}
          >
            {Component && <Component />}
          </div>
        );
      })}
    </>
  );
}

export function NestedFormWidget({ screens, initialScreen }: NestedFormWidgetProps) {
  return (
    <div style={{ height: '100%' }}>
      <NavigationProvider initialScreen={initialScreen}>
        <NavigationRenderer screens={screens} />
      </NavigationProvider>
    </div>
  );
}
