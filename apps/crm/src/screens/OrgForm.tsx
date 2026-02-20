import { RecordForm } from '@grist-widgets/ui';
import type { FormConfig } from '@grist-widgets/ui';

const ORG_FORM: FormConfig = {
  table: 'Organisations',
  titleColId: 'Nom',
  titleDefault: 'Sans titre',
  titlePlaceholder: "Nom de l'organisation",
  headerDateColId: 'Cree_le',
  headerDatePrefix: 'Créé',
  fields: [
    { colId: 'Nature_juridique', icon: 'gavel', label: 'Nature juridique' },
    {
      colId: 'Organisation_de_rattachement',
      icon: 'business',
      label: 'Organisation de rattachement',
      addLabel: 'Ajouter une organisation',
      refAddScreen: 'OrgForm',
      refEditScreen: 'OrgForm',
      refLabelCol: 'Nom',
    },
    {
      colId: 'Contacts',
      icon: 'people',
      label: 'Contacts',
      addLabel: 'Ajouter un contact',
      refAddScreen: 'ContactForm',
      refEditScreen: 'ContactForm',
      refLabelCol: 'Nom_complet',
    },
    { colId: 'Cree_par', icon: 'account_circle', label: 'Créé par', readOnly: true, avatar: true },
    { colId: 'Derniere_mise_a_jour_par', icon: 'account_circle', label: 'Dernière mise à jour par', readOnly: true, avatar: true },
    { colId: 'Cree_le', icon: 'calendar_today', label: 'Créé le', readOnly: true },
    { colId: 'Derniere_mise_a_jour', icon: 'update', label: 'Dernière mise à jour le', readOnly: true },
  ],
};

export function OrgForm() {
  return <RecordForm config={ORG_FORM} mode="subForm" />;
}
