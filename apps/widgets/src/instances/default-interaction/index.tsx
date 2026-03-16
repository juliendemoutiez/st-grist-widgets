import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../../assets/styles/reset.scss';
import '../../assets/styles/globals.scss';
import { CunninghamProvider } from '@gouvfr-lasuite/ui-kit';
import { GristProvider } from '@grist-widgets/ui';
import { NestedFormWidget } from '../../widgets/nested-form';
import { InteractionForm } from './screens/InteractionForm';
import { ContactForm } from './screens/ContactForm';
import { OrgForm } from './screens/OrgForm';

const screens = {
  InteractionForm,
  ContactForm,
  OrgForm,
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <CunninghamProvider theme="dsfr-light">
      <GristProvider>
        <NestedFormWidget screens={screens} initialScreen="InteractionForm" />
      </GristProvider>
    </CunninghamProvider>
  </StrictMode>,
);
