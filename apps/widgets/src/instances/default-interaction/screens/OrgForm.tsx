import { RecordForm } from '../../../widgets/nested-form/RecordForm';
import type { FormConfig } from '@grist-widgets/ui';

const ORG_FORM: FormConfig = {
  table: 'Organisations',
  titleColId: 'Nom',
  titleDefault: 'Sans titre',
  titlePlaceholder: "Nom de l'organisation",
  fields: [
    { colId: 'Type', icon: 'label', label: 'Type' },
    {
      colId: 'Contacts',
      icon: 'people',
      label: 'Contacts',
      addLabel: 'Ajouter un contact',
      refAddScreen: 'ContactForm',
      refEditScreen: 'ContactForm',
      refLabelCol: 'Nom_complet',
    },
    { colId: 'Cree_le', icon: 'calendar_today', label: 'Créé le', readOnly: true },
    { colId: 'Derniere_mise_a_jour', icon: 'update', label: 'Dernière mise à jour le', readOnly: true },
  ],
};

export function OrgForm() {
  return <RecordForm config={ORG_FORM} mode="subForm" />;
}
