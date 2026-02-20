import { RecordForm, Timeline } from '@grist-widgets/ui';
import type { FormConfig, TimelineConfig } from '@grist-widgets/ui';

const PROJET_FORM: FormConfig = {
  table: 'Projets',
  titleColId: 'Nom',
  titleDefault: 'Sans titre',
  titlePlaceholder: 'Titre du projet',
  headerDateColId: 'Cree_le',
  headerDatePrefix: 'Créé',
  newRecordLabel: 'Nouveau projet',
  emptyMessage: 'Cliquez sur un projet pour afficher les détails',
  fields: [
    { colId: 'Pour_qui', icon: 'group', label: 'Pour qui' },
    // { colId: 'Statut', icon: 'flag', label: 'Statut' },
    { colId: 'Priorite', icon: 'priority_high', label: 'Priorité' },
    { colId: 'Lien_CR', icon: 'link', label: 'Lien CR' },
    { colId: 'Effectifs', icon: 'people', label: 'Effectifs' },
    { colId: 'Solutions_actuelles', icon: 'inventory_2', label: 'Solutions actuelles' },
    { colId: 'Interet_pour_La_Suite', icon: 'favorite', label: 'Intérêt pour La Suite' },
    // { colId: 'Projet_de_migration', icon: 'build', label: 'Projet de migration' },
    { colId: 'Sentiment_envers_LaSuite', icon: 'sentiment_satisfied', label: 'Sentiment envers La Suite' },
    { colId: 'Echeance_contrat', icon: 'calendar_month', label: 'Echéance contrat' },

    {
      colId: 'Organisation',
      icon: 'business',
      label: 'Organisation',
      addLabel: 'Ajouter une organisation',
      refAddScreen: 'OrgForm',
      refEditScreen: 'OrgForm',
    },
    { colId: 'Cree_par', icon: 'account_circle', label: 'Créé par', readOnly: true, avatar: true },
    { colId: 'Derniere_mise_a_jour_par', icon: 'account_circle', label: 'Dernière mise à jour par', readOnly: true, avatar: true },
    { colId: 'Cree_le', icon: 'calendar_today', label: 'Créé le', readOnly: true },
    { colId: 'Derniere_mise_a_jour', icon: 'update', label: 'Dernière mise à jour le', readOnly: true },
  ],
};

const INTERACTIONS_TIMELINE: TimelineConfig = {
  table: 'Interactions',
  filterCol: 'Projets',
  refType: 'RefList',
  dateCol: 'Date',
  typeCol: 'Type',
  detailCol: 'Prochaine_etape',
  addScreen: 'InteractionForm',
  addDateCol: 'Date',
  editScreen: 'InteractionForm',
  title: 'Interactions',
  icon: 'chat',
  emptyMessage: 'Aucune interaction',
};

export function ProjetForm() {
  return (
    <RecordForm config={PROJET_FORM} mode="currentRecord">
      {(recordId) => <Timeline config={INTERACTIONS_TIMELINE} filterId={recordId} />}
    </RecordForm>
  );
}
