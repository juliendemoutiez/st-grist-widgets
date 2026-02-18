import { NavigationProvider, useNavigation } from '@grist-widgets/ui';
import { ProjetForm } from './screens/ProjetForm';
import { OrgForm } from './screens/OrgForm';
import { ContactForm } from './screens/ContactForm';
import { InteractionForm } from './screens/InteractionForm';

type ScreenName = 'ProjetForm' | 'OrgForm' | 'InteractionForm' | 'ContactForm';

function ScreenRenderer({ screen }: { screen: ScreenName }) {
  switch (screen) {
    case 'ProjetForm':
      return <ProjetForm />;
    case 'OrgForm':
      return <OrgForm />;
    case 'ContactForm':
      return <ContactForm />;
    case 'InteractionForm':
      return <InteractionForm />;
  }
}

function NavigationRenderer() {
  const { stack } = useNavigation();

  return (
    <>
      {stack.map((entry, index) => (
        <div
          key={`${entry.screen}-${index}`}
          style={{ display: index === stack.length - 1 ? 'block' : 'none' }}
        >
          <ScreenRenderer screen={entry.screen as ScreenName} />
        </div>
      ))}
    </>
  );
}

function App() {
  return (
    <div style={{ height: '100%' }}>
      <NavigationProvider initialScreen="ProjetForm">
        <NavigationRenderer />
      </NavigationProvider>
    </div>
  );
}

export default App;
