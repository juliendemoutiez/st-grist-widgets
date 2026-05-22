import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../../assets/styles/reset.scss';
import '../../assets/styles/globals.scss';
import '../../widgets/nested-form/nested-form.scss';
import { CunninghamProvider } from '@gouvfr-lasuite/ui-kit';
import { GristProvider } from '@grist-widgets/ui';
import { NestedFormWidget } from '../../widgets/nested-form';
import { TaskForm } from './TaskForm';

const screens = { TaskForm };

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <CunninghamProvider theme="dsfr-light">
      <GristProvider>
        <NestedFormWidget screens={screens} initialScreen="TaskForm" />
      </GristProvider>
    </CunninghamProvider>
  </StrictMode>,
);
