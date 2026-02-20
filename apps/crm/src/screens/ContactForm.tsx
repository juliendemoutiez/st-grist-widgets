import { RecordForm } from '@grist-widgets/ui';
import type { FormConfig } from '@grist-widgets/ui';

const CONTACT_FORM: FormConfig = {
  table: 'Contacts',
  titleColId: 'Nom_Complet',
  titleDefault: 'Nouveau contact',
  titlePlaceholder: '',
  titleReadOnly: true,
  headerDateColId: 'Cree_le',
  headerDatePrefix: 'Créé',
  fields: [
    { colId: 'Nom', icon: 'person', label: 'Nom', transform: 'uppercase' },
    { colId: 'Prenom', icon: 'badge', label: 'Prénom', transform: 'capitalize' },
    { colId: 'Organisations', icon: 'business', label: 'Organisations', refLabelCol: 'Nom' },
    { colId: 'Cree_par', icon: 'account_circle', label: 'Créé par', readOnly: true, avatar: true },
    { colId: 'Derniere_mise_a_jour_par', icon: 'account_circle', label: 'Dernière mise à jour par', readOnly: true, avatar: true },
    { colId: 'Cree_le', icon: 'calendar_today', label: 'Créé le', readOnly: true },
    { colId: 'Derniere_mise_a_jour', icon: 'update', label: 'Dernière mise à jour le', readOnly: true },
  ],
};

export function ContactForm() {
  return <RecordForm config={CONTACT_FORM} mode="subForm" />;
}
