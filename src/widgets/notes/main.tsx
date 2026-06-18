import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../../assets/styles/reset.scss';
import '../../assets/styles/globals.scss';
import { CunninghamProvider } from '@gouvfr-lasuite/ui-kit';
import { GristProvider } from '@grist-widgets/ui';
import { NotesWidget } from './NotesWidget';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <CunninghamProvider theme="dsfr-light">
      <GristProvider allowSelectBy>
        <NotesWidget />
      </GristProvider>
    </CunninghamProvider>
  </StrictMode>,
);
