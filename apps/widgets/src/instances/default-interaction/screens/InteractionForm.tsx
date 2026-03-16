import { RecordForm } from '../../../widgets/nested-form/RecordForm';
import type { FormConfig } from '@grist-widgets/ui';

const INTERACTION_FORM: FormConfig = {
  table: 'Interactions',
  titleColId: 'Nom_complet',
  titleDefault: 'Nouvelle interaction',
  titlePlaceholder: '',
  titleReadOnly: true,
  fields: [
    { colId: 'Date', icon: 'event', label: 'Date' },
    { colId: 'Source', icon: 'input', label: 'Source' },
    { colId: 'Type', icon: 'label', label: 'Type' },
    { colId: 'Canal', icon: 'router', label: 'Canal' },
    {
      colId: 'Contacts',
      icon: 'people',
      label: 'Contacts',
      addLabel: 'Ajouter un contact',
      refAddScreen: 'ContactForm',
      refEditScreen: 'ContactForm',
      refLabelCol: 'Nom_complet',
    },
    { colId: 'Sujet', icon: 'subject', label: 'Sujet' },
    { colId: 'Cree_le', icon: 'calendar_today', label: 'Créé le', readOnly: true },
    { colId: 'Derniere_mise_a_jour', icon: 'update', label: 'Dernière mise à jour le', readOnly: true },
  ],
};

export function InteractionForm() {
  return <RecordForm config={INTERACTION_FORM} mode="currentRecord" />;
}
