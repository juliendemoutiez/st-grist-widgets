import { RecordForm } from '../../../widgets/nested-form/RecordForm';
import type { FormConfig } from '@grist-widgets/ui';

const CONTACT_FORM: FormConfig = {
  table: 'Contacts',
  titleColId: 'Nom_complet',
  titleDefault: 'Nouveau contact',
  titlePlaceholder: '',
  titleReadOnly: true,
  fields: [
    { colId: 'Prenom', icon: 'badge', label: 'Prénom', transform: 'capitalize' },
    { colId: 'Nom_de_famille', icon: 'person', label: 'Nom', transform: 'uppercase' },
    { colId: 'Email', icon: 'email', label: 'Email', mailto: true },
    {
      colId: 'Organisation',
      icon: 'business',
      label: 'Organisation',
      addLabel: 'Ajouter une organisation',
      refAddScreen: 'OrgForm',
      refEditScreen: 'OrgForm',
      refLabelCol: 'Nom',
    },
    { colId: 'Type', icon: 'label', label: 'Type' },
    { colId: 'Cree_le', icon: 'calendar_today', label: 'Créé le', readOnly: true },
    { colId: 'Derniere_mise_a_jour', icon: 'update', label: 'Dernière mise à jour le', readOnly: true },
  ],
};

export function ContactForm() {
  return <RecordForm config={CONTACT_FORM} mode="subForm" />;
}
