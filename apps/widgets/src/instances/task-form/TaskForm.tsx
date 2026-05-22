import { RecordForm } from '../../widgets/nested-form/RecordForm';
import type { FormConfig } from '@grist-widgets/ui';
import { SubtasksField } from './SubtasksField';

const TASK_FORM: FormConfig = {
  table: 'Taches',
  titleColId: 'Nom',
  titleDefault: 'Nouvelle tâche',
  titlePlaceholder: 'Nouvelle tâche...',
  emptyMessage: 'Sélectionnez une tâche',
  headerDateColId: 'Creee_le',
  headerDatePrefix: 'Créée',
  fields: [
    { colId: 'Projet', icon: 'folder_open', label: 'Projet', createChoice: true },
    { colId: 'Priorite', icon: 'flag', label: 'Priorité' },
    { colId: 'Etiquettes', icon: 'sell', label: 'Étiquettes', createChoice: true },
    { colId: 'Date_d_echeance', icon: 'calendar_today', label: 'Échéance' },
    { colId: 'Commentaire', icon: 'notes', label: 'Commentaire', markdown: true },
  ],
};

export function TaskForm() {
  return (
    <RecordForm config={TASK_FORM} mode="currentRecord">
      {(recordId) => <SubtasksField parentId={recordId} />}
    </RecordForm>
  );
}
