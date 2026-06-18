export const NAME_COL = 'Nom';
export const DONE_COL = 'Terminee';
export const DUE_COL = 'Date_d_echeance';
export const PROJET_COL = 'Projet';
export const LISTE_COL = 'Liste';
export const SUPPRIME_COL = 'Supprimee';
export const ORDRE_COL = 'Ordre';
export const COMPLETION_COL = 'Terminee_le';
export const SUBTASKS_COL = 'Sous_taches';
export const ETIQUETTES_COL = 'Etiquettes';
export const PRIORITE_COL = 'Priorite';

export interface ProjetColor { fill: string; text: string }

export const SECTIONS = [
  { key: 'Boîte de réception', label: 'Boîte de réception', icon: 'inbox' },
  { key: "Aujourd'hui", label: "Aujourd'hui", icon: 'today' },
  { key: 'Prochainement', label: 'Prochainement', icon: 'schedule' },
  { key: 'Terminées', label: 'Terminées', icon: 'check_circle' },
] as const;

export type SectionKey = typeof SECTIONS[number]['key'];

export type ActiveFilter =
  | { type: 'section'; key: SectionKey }
  | { type: 'project'; id: string; label: string }
  | { type: 'tag'; id: string; label: string };

export type DragTarget =
  | { type: 'section'; key: SectionKey }
  | { type: 'project'; id: string }
  | null;
