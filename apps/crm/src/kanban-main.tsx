import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './assets/styles/reset.scss';
import './assets/styles/globals.scss';
import './kanban/kanban.scss';
import { KanbanApp } from './kanban/KanbanApp';
import { CunninghamProvider } from '@openfun/cunningham-react';
import { GristProvider } from '@grist-widgets/ui';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <CunninghamProvider theme="dsfr-light">
      <GristProvider allowSelectBy>
        <KanbanApp />
      </GristProvider>
    </CunninghamProvider>
  </StrictMode>,
);
