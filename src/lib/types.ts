/** Navigation screen identifier — apps define a stricter union locally. */
export type ScreenName = string;

export interface ScreenEntry {
  screen: ScreenName;
  props?: Record<string, unknown>;
}

/** Declarative definition of a single form field. */
export interface FieldDef {
  colId: string;
  icon: string;
  label: string;
  addLabel?: string;
  readOnly?: boolean;
  required?: boolean;
  avatar?: boolean;
  /** Text transform applied on blur: 'uppercase' or 'capitalize' (first letter of each word). */
  transform?: 'uppercase' | 'capitalize';
  /** Screen to push when the "add" button is clicked on a Ref field */
  refAddScreen?: ScreenName;
  /** Screen to push when a selected Ref chip is clicked */
  refEditScreen?: ScreenName;
  /** Column to use as display label for Ref/RefList options (defaults to 'Nom') */
  refLabelCol?: string;
  /** Show a mailto: link icon next to the field value */
  mailto?: boolean;
  /** Allow creating new choices directly from the picker (ChoiceList columns only) */
  createChoice?: boolean;
}

/** Declarative configuration for a generic timeline section. */
export interface TimelineConfig {
  /** Grist table to fetch items from, e.g. 'INTERACTIONS' */
  table: string;
  /** Column in that table referencing the parent record */
  filterCol: string;
  /** Whether filterCol is a plain Ref or a RefList */
  refType: 'Ref' | 'RefList';
  /** Column holding the item date (Grist Unix timestamp) */
  dateCol: string;
  /** Column holding the item type/title label */
  typeCol: string;
  /** Optional column shown as a detail line with an arrow icon */
  detailCol?: string;
  /** Screen pushed when the add button is clicked */
  addScreen: ScreenName;
  /** If set, pre-fill this column with today's UTC date on add */
  addDateCol?: string;
  /** Screen pushed when an item is clicked */
  editScreen: ScreenName;
  /** Column used as the label when pushing editScreen */
  editLabelCol?: string;
  /** Boolean column used for soft-deletion. When set, items are excluded once true and a delete action is shown. */
  deletedCol?: string;
  /** Section heading */
  title: string;
  /** Material icon name for the section heading */
  icon: string;
  /** Message shown when the list is empty */
  emptyMessage?: string;
}

/** JSON-serializable form config (function fields excluded). */
export type JsonFormConfig = Omit<FormConfig, 'titleFormula'>;

export interface TimelineSectionConfig extends TimelineConfig {
  type: 'timeline';
}

export interface TasksSectionConfig {
  type: 'tasks';
  /** Grist table that holds the tasks JSON blob. */
  table: string;
  /** Column in that table containing the JSON-encoded subtask list. */
  col: string;
  /** Section heading. */
  title?: string;
  /** Material icon name. */
  icon?: string;
}

export interface CommentSectionConfig {
  type: 'comment';
  /** Column on the current record to read/write. */
  col: string;
  /** Section heading. */
  title: string;
  /** Material icon name. */
  icon: string;
}

export type SectionConfig = TimelineSectionConfig | TasksSectionConfig | CommentSectionConfig;

export interface JsonScreenConfig {
  mode: 'currentRecord' | 'subForm';
  table: string;
  fields: FieldDef[];
  titleColId: string;
  titleDefault: string;
  titlePlaceholder: string;
  titleReadOnly?: boolean;
  /** Prepended to the formatted titleColId date value, e.g. "Interaction du ". */
  titlePrefix?: string;
  headerDateColId?: string;
  headerDatePrefix?: string;
  /**
   * Column whose truthy value triggers a banner at the top of the form, showing that value as text.
   * Prefix the value with a type and "::" to control severity, e.g. "error:: Ce champ est invalide".
   * Recognized types: 'warning' (default), 'error', 'info'.
   */
  alertColId?: string;
  newRecordLabel?: string;
  emptyMessage?: string;
  sections?: SectionConfig[];
}

export interface NestedFormWidgetConfig {
  initialScreen: string;
  screens: Record<string, JsonScreenConfig>;
}

/** Declarative configuration for a record form. */
export interface FormConfig {
  /** Grist table name, e.g. 'PROJETS' */
  table: string;
  /** Column used for the editable title, e.g. 'Nom' */
  titleColId: string;
  titleDefault: string;
  titlePlaceholder: string;
  /** When true, the title is displayed but not editable (e.g. for computed columns). */
  titleReadOnly?: boolean;
  /** Prepended to the formatted titleColId date value, e.g. "Interaction du ". */
  titlePrefix?: string;
  /**
   * Optional function to compute the displayed title from the current field values.
   * When provided, overrides titleColId for display purposes.
   * Return an empty string to show no title.
   */
  titleFormula?: (fields: Record<string, unknown>) => string;
  /** Column whose Grist timestamp is shown as a relative date in the header */
  headerDateColId?: string;
  /** Prefix for the relative date, e.g. 'Créé' */
  headerDatePrefix?: string;
  /**
   * Column whose truthy value triggers a banner at the top of the form, showing that value as text.
   * Prefix the value with a type and "::" to control severity, e.g. "error:: Ce champ est invalide".
   * Recognized types: 'warning' (default), 'error', 'info'.
   */
  alertColId?: string;
  fields: FieldDef[];
  /** Label for the "new record" button shown in currentRecord mode. If omitted, no button is shown. */
  newRecordLabel?: string;
  /** Message shown when no record is selected. */
  emptyMessage?: string;
}
