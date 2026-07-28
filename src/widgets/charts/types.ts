/**
 * Contrat de configuration des widgets de graphiques.
 *
 * Aucun de ces types ne connaît le document qui l'utilise : tables, colonnes,
 * libellés et filtres viennent de `widgetOptions`, éditable depuis Grist et
 * archivé dans `instances/*.json`.
 */

/**
 * Filtre sur une colonne.
 *
 * Par défaut, égalité : `valeur` peut lister plusieurs valeurs acceptées.
 * Avec `operateur: 'maximum'`, aucune valeur n'est attendue — seules les lignes
 * portant la plus grande valeur de la colonne sont gardées. C'est ce qui permet
 * de lire la dernière période d'une table de snapshots sans la coder en dur.
 */
export interface Filtre {
  colonne: string;
  valeur?: string | number | boolean | (string | number)[];
  operateur?: 'egal' | 'maximum';
}

export type ModeAgregation = 'compte' | 'compte-distinct' | 'somme' | 'moyenne' | 'mediane';

export interface Valeur {
  mode: ModeAgregation;
  /** Colonne à sommer, moyenner ou dédoublonner. Inutile en mode `compte`. */
  colonne?: string;
  /** Nombre de décimales à l'affichage. */
  decimales?: number;
}

/** Dimension : une colonne, et de quoi la présenter. */
export interface Dimension {
  colonne: string;
  /** Correspondance valeur brute -> libellé affiché. Absente : valeur brute. */
  libelles?: Record<string, string>;
  /** Libellés abrégés, pour les en-têtes de colonnes serrés. */
  libellesCourts?: Record<string, string>;
  /** Ordre imposé. Les valeurs absentes de la liste sont rejetées. */
  ordre?: string[];
  /** À défaut d'ordre imposé : par effectif décroissant, ou alphabétique. */
  tri?: 'valeur-desc' | 'alpha';
  /** Ne garder que les modalités effectivement peuplées. */
  masquerVides?: boolean;
}

/** Bloc commun à tous les widgets : ce qu'on lit, et comment on l'intitule. */
export interface ConfigCommune {
  titre?: string;
  sousTitre?: string;
  table: string;
  filtres?: Filtre[];
  valeur?: Valeur;
  /** Suffixe d'unité affiché après les valeurs (« j », « % »…). */
  suffixe?: string;
}

export interface ConfigHeatmap extends ConfigCommune {
  lignes: Dimension;
  colonnes: Dimension;
  /** `racine` tasse les écarts d'ordre de grandeur ; monotone, l'ordre tient. */
  echelle?: 'lineaire' | 'racine';
  totaux?: boolean;
  /**
   * En-têtes de colonnes. `oblique` (défaut) garde des colonnes étroites quand
   * elles sont nombreuses ; `horizontal` se lit mieux dès qu'elles sont assez
   * larges, les libellés passant alors à la ligne si besoin.
   */
  entetes?: 'oblique' | 'horizontal';
}

export interface ConfigBarres extends ConfigCommune {
  lignes: Dimension;
  /**
   * Ajoute le nombre d'observations derrière chaque valeur. À activer dès que
   * les effectifs sont faibles : une moyenne sur deux mesures et une moyenne
   * sur cinquante se ressemblent trop sur un graphique.
   */
  afficherEffectif?: boolean;
}

export interface ConfigLigne extends ConfigCommune {
  /**
   * Axe des abscisses. `mois` et `semaine` attendent un horodatage Grist et
   * regroupent les enregistrements sur la période ; `brut` prend la valeur
   * telle quelle.
   */
  x: Dimension & { format?: 'mois' | 'semaine' | 'brut' };
  /** Séries superposées. Absente : une seule série. */
  series?: Dimension & { max?: number; libelleAutres?: string };
}

/** Réalisé et objectif viennent de deux tables, jointes sur un groupe commun. */
export interface ConfigObjectif {
  titre?: string;
  sousTitre?: string;
  realise: { table: string; filtres?: Filtre[]; groupe: string; valeur: Valeur };
  objectif: { table: string; filtres?: Filtre[]; groupe: string; valeur: Valeur };
  libelles?: Record<string, string>;
}

export type Config = ConfigHeatmap | ConfigBarres | ConfigLigne | ConfigObjectif;
