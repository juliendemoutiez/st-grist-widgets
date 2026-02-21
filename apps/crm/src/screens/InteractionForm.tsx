import { RecordForm } from '@grist-widgets/ui';
import type { FormConfig } from '@grist-widgets/ui';

function interactionTitle(fields: Record<string, unknown>): string {
  const type = fields['Type'];
  if (!type) return '';
  const date = fields['Date'];
  if (typeof date === 'number' && date > 0) {
    const formatted = new Date(date * 1000).toLocaleDateString('fr-FR', {
      day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
    });
    return `${type} (${formatted})`;
  }
  return `${type} (Non datée)`;
}

const INTERACTION_FORM: FormConfig = {
  table: 'Interactions',
  titleColId: 'Type',
  titleDefault: 'Nouvelle interaction',
  titlePlaceholder: '',
  titleReadOnly: true,
  titleFormula: interactionTitle,
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
      refLabelCol: 'Nom_Complet',
    },
    {
      colId: 'Contacts_internes',
      icon: 'group',
      label: 'Contacts internes',
      readOnly: true,
      refLabelCol: 'Nom_Complet',
    },
    { colId: 'Date_de_prochaine_interaction', icon: 'calendar_month', label: 'Date de prochaine interaction' },
    { colId: 'Cree_par', icon: 'account_circle', label: 'Créé par', readOnly: true, avatar: true },
    { colId: 'Cree_le', icon: 'calendar_today', label: 'Créé le', readOnly: true },
    { colId: 'Prochaine_etape', icon: 'notes', label: 'Prochaine étape', markdown: true },
  ],
};

export function InteractionForm() {
  return <RecordForm config={INTERACTION_FORM} mode="subForm" />;
}
