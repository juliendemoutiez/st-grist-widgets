import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../../assets/styles/reset.scss';
import '../../assets/styles/globals.scss';
import { CunninghamProvider } from '@openfun/cunningham-react';
import { GristProvider } from '@grist-widgets/ui';
import { KanbanWidget } from '../../widgets/kanban';

const STATUSES = [
  '1. RDV découverte',
  '2. Focus produit',
  '3. Expérimentation lancée',
  '4. Suivi expé',
  '5. Bilan expé',
  '6. Perdu / En pause',
] as const;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <CunninghamProvider theme="dsfr-light">
      <GristProvider allowSelectBy>
        <KanbanWidget statuses={STATUSES} />
      </GristProvider>
    </CunninghamProvider>
  </StrictMode>,
);
