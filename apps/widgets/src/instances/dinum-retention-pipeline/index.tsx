import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../../assets/styles/reset.scss';
import '../../assets/styles/globals.scss';
import { CunninghamProvider } from '@openfun/cunningham-react';
import { GristProvider } from '@grist-widgets/ui';
import { KanbanWidget } from '../../widgets/kanban';

const STATUSES = [
  '7. Suivi objections',
  '8. Engagement déploiement',
  '9. Suivi déploiement',
  '10. Arrêts licences',
  '11. Elargissement LaSuite',
  '12. En pause',
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
