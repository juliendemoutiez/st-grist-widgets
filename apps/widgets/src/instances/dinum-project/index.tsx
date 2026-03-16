import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../../assets/styles/reset.scss';
import '../../assets/styles/globals.scss';
import { CunninghamProvider } from '@gouvfr-lasuite/ui-kit';
import { GristProvider } from '@grist-widgets/ui';
import { NestedFormWidget } from '../../widgets/nested-form';
import { ProjetForm } from './screens/ProjetForm';
import { OrgForm } from './screens/OrgForm';
import { ContactForm } from './screens/ContactForm';
import { InteractionForm } from './screens/InteractionForm';

const screens = {
  ProjetForm,
  OrgForm,
  ContactForm,
  InteractionForm,
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <CunninghamProvider theme="dsfr-light">
      <GristProvider>
        <NestedFormWidget screens={screens} initialScreen="ProjetForm" />
      </GristProvider>
    </CunninghamProvider>
  </StrictMode>,
);
