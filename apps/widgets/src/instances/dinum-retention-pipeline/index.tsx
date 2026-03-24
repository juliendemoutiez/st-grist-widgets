import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../../assets/styles/reset.scss';
import '../../assets/styles/globals.scss';
import { CunninghamProvider } from '@gouvfr-lasuite/ui-kit';
import { GristProvider } from '@grist-widgets/ui';
import { KanbanWidget } from '../../widgets/kanban';

const STATUSES = [
  '8. Suivi objections',
  '9. Engagement déploiement',
  '10. Suivi déploiement',
  '11. Arrêts licences',
  '12. Elargissement LaSuite',
  '13. En pause',
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
