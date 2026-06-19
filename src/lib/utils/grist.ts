/** Extract the target table name from a Ref type string, e.g. "Ref:Organisations" → "Organisations". */
export function parseRefTarget(type: string): string | null {
  const match = type.match(/^Ref:(.+)$/);
  return match ? match[1] : null;
}

/** Extract the target table name from a RefList type string, e.g. "RefList:CONTACTS" → "CONTACTS". */
export function parseRefListTarget(type: string): string | null {
  const match = type.match(/^RefList:(.+)$/);
  return match ? match[1] : null;
}

/** Decode a Grist RefList value to a number array. Grist encodes RefList as ['L', id1, id2, ...].
 * grist.onRecord (keepEncoded:false) may send display labels instead of IDs — NaN entries are dropped. */
export function decodeRefList(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  const arr = value as unknown[];
  const nums = arr[0] === 'L' ? arr.slice(1).map(Number) : arr.map(Number);
  return nums.filter(n => !isNaN(n));
}

/** Decode a Grist ChoiceList value to a string array. Grist encodes ChoiceList as ['L', 'v1', 'v2', ...]. */
export function decodeChoiceList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const arr = value as unknown[];
  if (arr.length > 0 && arr[0] === 'L') return arr.slice(1).map(String);
  return arr.map(String);
}

/** Convert a Grist timestamp to a JS Date, or null.
 * grist.onRecord sends DateTime as ms; docApi.fetchTable sends seconds.
 * Values above 1e10 are treated as ms, others as seconds. */
export function gristTsToDate(value: unknown): Date | null {
  if (value == null || value === 0) return null;
  const ts = typeof value === 'number' ? value : Number(value);
  if (isNaN(ts)) return null;
  return new Date(ts > 1e10 ? ts : ts * 1000);
}

/** Format a Grist timestamp as a localized date+time string. */
export function formatDateTime(value: unknown): string {
  const d = gristTsToDate(value);
  if (!d) return '—';
  return d.toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

/** Format a Grist Date value (UTC midnight) as a localized date-only string. */
export function formatDate(value: unknown): string {
  const d = gristTsToDate(value);
  if (!d) return '—';
  return d.toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
  });
}

/** Convert a Grist timestamp to the `datetime-local` input format (YYYY-MM-DDThh:mm). */
export function toDateTimeLocal(value: unknown): string {
  const d = gristTsToDate(value);
  if (!d) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Convert a `datetime-local` input value back to a Grist timestamp (seconds). */
export function fromDateTimeLocal(str: string): number {
  return Math.floor(new Date(str).getTime() / 1000);
}

/**
 * Parse a Grist hyperlink value ("Label https://url" or just "https://url").
 * Returns null if the value is empty.
 */
export function parseHyperlink(value: unknown): { url: string; label: string } | null {
  if (!value || typeof value !== 'string' || !value.trim()) return null;
  const str = value.trim();
  const lastSpace = str.lastIndexOf(' ');
  if (lastSpace !== -1) {
    const potentialUrl = str.slice(lastSpace + 1);
    if (/^https?:\/\/\S/.test(potentialUrl)) {
      return { url: potentialUrl, label: str.slice(0, lastSpace) };
    }
  }
  const url = /^https?:\/\//.test(str) ? str : `https://${str}`;
  return { url, label: str };
}

/** Return a short display label for a hyperlink: explicit label if set, otherwise the hostname. */
export function getHyperlinkDisplay(parsed: { url: string; label: string }): string {
  if (parsed.label !== parsed.url) return parsed.label;
  try { return new URL(parsed.url).hostname; } catch { return parsed.url; }
}

/** Apply a text transform: 'uppercase' → all caps, 'capitalize' → first letter of each word. */
export function applyTransform(val: string, transform?: 'uppercase' | 'capitalize'): string {
  if (!transform) return val;
  if (transform === 'uppercase') return val.toUpperCase();
  return val.replace(/(^|[\s-])(\S)/g, (_, sep, c) => sep + c.toUpperCase());
}
