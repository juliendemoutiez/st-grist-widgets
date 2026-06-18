import { useCallback, useEffect, useState } from 'react';

/**
 * Returns a human-readable relative date string that auto-updates every 30 seconds.
 * @param date  The reference Date
 * @param prefix Optional prefix, e.g. "Créé" → "Créé il y a 3 minutes"
 */
export function useRelativeDate(date: Date, prefix: string) {
  const fmt = useCallback(() => {
    const diffSec = Math.floor((Date.now() - date.getTime()) / 1000);
    if (diffSec < 60) return prefix ? `${prefix} maintenant` : 'Maintenant';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) {
      const ago = diffMin === 1 ? 'il y a 1 minute' : `il y a ${diffMin} minutes`;
      return prefix ? `${prefix} ${ago}` : ago;
    }
    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) {
      const ago = diffHour === 1 ? 'il y a 1 heure' : `il y a ${diffHour} heures`;
      return prefix ? `${prefix} ${ago}` : ago;
    }
    const diffDay = Math.floor(diffHour / 24);
    if (diffDay < 30) {
      const ago = diffDay === 1 ? 'il y a 1 jour' : `il y a ${diffDay} jours`;
      return prefix ? `${prefix} ${ago}` : ago;
    }
    const diffMonth = Math.floor(diffDay / 30);
    if (diffMonth < 12) {
      const ago = diffMonth === 1 ? 'il y a 1 mois' : `il y a ${diffMonth} mois`;
      return prefix ? `${prefix} ${ago}` : ago;
    }
    const diffYear = Math.floor(diffDay / 365);
    const ago = diffYear === 1 ? 'il y a 1 an' : `il y a ${diffYear} ans`;
    return prefix ? `${prefix} ${ago}` : ago;
  }, [date, prefix]);

  const [label, setLabel] = useState(fmt);

  useEffect(() => {
    setLabel(fmt());
    const id = setInterval(() => setLabel(fmt()), 30_000);
    return () => clearInterval(id);
  }, [fmt]);

  return label;
}
