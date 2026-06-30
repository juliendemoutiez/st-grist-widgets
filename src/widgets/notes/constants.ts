// ─── Column names ─────────────────────────────────────────────────────────────

export const TITLE_COL       = 'Title';
export const CONTENT_COL     = 'Content';
export const ICON_COL        = 'Icon';
export const TYPE_COL        = 'Type';
export const PARENT_COL      = 'Parent';
export const ORDER_COL       = 'Order';
export const STATUS_COL      = 'Status';
export const CREATED_COL     = 'Created';
export const IS_EXPANDED_COL = 'IsExpanded';

// ─── Value constants ──────────────────────────────────────────────────────────

export const T_NOTE      = 'note';
export const T_DAILY     = 'daily';
export const S_ARCHIVED  = 'archived';
export const S_ACTIVE    = 'active';
export const DEFAULT_ICON = '📝';

export const COMMON_EMOJIS = [
  '📝', '✅', '⭐', '🎯', '💡', '🔥', '❤️', '🚀',
  '📌', '🎨', '📚', '💼', '🏠', '🌍', '🤔', '💭',
  '🔑', '📊', '🗓️', '⚡', '🎉', '👍', '🌟', '📢',
  '🔔', '💬', '🤝', '🧠', '🎓', '💰', '🏆', '🔒',
  '📷', '🎵', '🌈', '🍀', '🦋', '🌊', '🏔️', '🌱',
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function itemIcon(type: string): string {
  if (type === T_DAILY) return 'today';
  return 'description';
}
