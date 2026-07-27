import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../../../assets/styles/reset.scss';
import '../../../assets/styles/globals.scss';
import '../viz.scss';
import { CunninghamProvider } from '@gouvfr-lasuite/ui-kit';
import { GristProvider } from '@grist-widgets/ui';
import { LigneWidget } from '.';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <CunninghamProvider theme="dsfr-light">
      <GristProvider>
        <LigneWidget />
      </GristProvider>
    </CunninghamProvider>
  </StrictMode>,
);
