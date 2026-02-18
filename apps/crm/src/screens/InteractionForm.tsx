import { RecordForm } from '@grist-widgets/ui';
import type { FormConfig } from '@grist-widgets/ui';

const INTERACTION_FORM: FormConfig = {
  table: 'INTERACTIONS',
  titleColId: 'Type',
  titleDefault: 'Nouvelle interaction',
  titlePlaceholder: '',
  titleReadOnly: true,
  headerDateColId: 'Cree_le',
  headerDatePrefix: 'Créé',
  fields: [
    { colId: 'Date', icon: 'event', label: 'Date' },
    { colId: 'Projets', icon: 'folder', label: 'Projets', readOnly: true, refLabelCol: 'Nom' },
    { colId: 'Type', icon: 'label', label: 'Type', readOnly: true },
    { colId: 'Produits', icon: 'inventory_2', label: 'Produits', readOnly: true },
    {
      colId: 'Contacts',
      icon: 'people',
      label: 'Contacts',
      addLabel: 'Ajouter un contact',
      refAddScreen: 'ContactForm',
      refEditScreen: 'ContactForm',
      refLabelCol: 'Nom_complet',
    },
    {
      colId: 'Contacts_internes',
      icon: 'group',
      label: 'Contacts internes',
      readOnly: true,
      refLabelCol: 'Nom_complet',
    },
    { colId: 'Cree_par', icon: 'account_circle', label: 'Créé par', readOnly: true, avatar: true },
    { colId: 'Derniere_mise_a_jour_par', icon: 'account_circle', label: 'Dernière mise à jour par', readOnly: true, avatar: true },
    { colId: 'Cree_le', icon: 'calendar_today', label: 'Créé le', readOnly: true },
    { colId: 'Derniere_mise_a_jour', icon: 'update', label: 'Dernière mise à jour le', readOnly: true },
    { colId: 'Prochaine_etape', icon: 'notes', label: 'Prochaine étape', markdown: true },
  ],
};

export function InteractionForm() {
  return <RecordForm config={INTERACTION_FORM} mode="subForm" />;
}
