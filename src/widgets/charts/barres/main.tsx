import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../../../assets/styles/reset.scss';
import '../../../assets/styles/globals.scss';
import '../viz.scss';
import { CunninghamProvider } from '@gouvfr-lasuite/ui-kit';
import { GristProvider } from '@grist-widgets/ui';
import { BarresWidget } from '.';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <CunninghamProvider theme="dsfr-light">
      <GristProvider>
        <BarresWidget />
      </GristProvider>
    </CunninghamProvider>
  </StrictMode>,
);
