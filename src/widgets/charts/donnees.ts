import { useEffect, useState } from 'react';
import { useGrist } from '@grist-widgets/ui';
import type { Dimension, Filtre, Valeur } from './types';

/** Une ligne de table Grist, colonnes non typées. */
export type Ligne = Record<string, unknown>;

/** `fetchTable` renvoie les colonnes ; on repasse en lignes. */
function enLignes(table: Record<string, unknown[]>): Ligne[] {
  const cols = Object.keys(table);
  if (!cols.length) return [];
  const n = (table[cols[0]] as unknown[]).length;
  const out: Ligne[] = [];
  for (let i = 0; i < n; i++) {
    const row: Ligne = {};
    for (const c of cols) row[c] = (table[c] as unknown[])[i];
    out.push(row);
  }
  return out;
}

/** Charge une table, avec l'erreur remontée telle quelle pour affichage. */
export function useTable(nom: string | undefined) {
  const { fetchTable, dataVersion } = useGrist();
  const [lignes, setLignes] = useState<Ligne[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    if (!nom) {
      setLignes([]);
      setChargement(false);
      return;
    }
    let annule = false;
    setChargement(true);
    setErreur(null);
    fetchTable(nom)
      .then((t) => {
        if (!annule) setLignes(enLignes(t as Record<string, unknown[]>));
      })
      .catch((e: unknown) => {
        if (!annule) setErreur(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!annule) setChargement(false);
      });
    return () => {
      annule = true;
    };
  }, [nom, fetchTable, dataVersion]);

  return { lignes, chargement, erreur };
}

/** Une ChoiceList Grist arrive sous la forme ['L', 'a', 'b']. */
export function valeursDe(brut: unknown): (string | number)[] {
  if (Array.isArray(brut)) return brut.filter((v) => v !== 'L') as (string | number)[];
  if (brut === null || brut === undefined || brut === '') return [];
  return [brut as string | number];
}

export function texte(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (Array.isArray(v)) return v.filter((x) => x !== 'L').join(', ');
  return String(v);
}

export function appliquerFiltres(lignes: Ligne[], filtres?: Filtre[]): Ligne[] {
  if (!filtres?.length) return lignes;
  return lignes.filter((l) =>
    filtres.every((f) => {
      const attendues = Array.isArray(f.valeur) ? f.valeur.map(String) : [String(f.valeur)];
      const presentes = valeursDe(l[f.colonne]).map(String);
      return presentes.some((v) => attendues.includes(v));
    }),
  );
}

/**
 * Agrège un paquet de lignes selon le mode demandé.
 *
 * Renvoie `null` pour une moyenne sans aucune valeur numérique : un groupe qui
 * n'a rien à moyenner n'a pas une moyenne de zéro, il n'en a pas. Les appelants
 * peuvent alors l'écarter ou en faire une rupture de courbe.
 */
export function agreger(lignes: Ligne[], valeur?: Valeur): number | null {
  const mode = valeur?.mode ?? 'compte';
  const col = valeur?.colonne;

  if (mode === 'compte' || !col) return lignes.length;

  if (mode === 'compte-distinct') {
    return new Set(lignes.map((l) => texte(l[col])).filter(Boolean)).size;
  }

  const nombres = lignes
    .map((l) => l[col])
    .filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  if (!nombres.length) return mode === 'somme' ? 0 : null;

  let brut: number;
  if (mode === 'mediane') {
    const tries = [...nombres].sort((a, b) => a - b);
    const m = Math.floor(tries.length / 2);
    brut = tries.length % 2 ? tries[m] : (tries[m - 1] + tries[m]) / 2;
  } else {
    const somme = nombres.reduce((a, b) => a + b, 0);
    brut = mode === 'moyenne' ? somme / nombres.length : somme;
  }
  const d = valeur?.decimales ?? (mode === 'somme' ? 0 : 1);
  const f = 10 ** d;
  return Math.round(brut * f) / f;
}

/** Nombre de valeurs réellement agrégeables dans un paquet de lignes. */
export function compteAgregeable(lignes: Ligne[], valeur?: Valeur): number {
  const col = valeur?.colonne;
  if (!col || valeur?.mode === 'compte') return lignes.length;
  if (valeur?.mode === 'compte-distinct') {
    return new Set(lignes.map((l) => texte(l[col])).filter(Boolean)).size;
  }
  return lignes.filter((l) => typeof l[col] === 'number' && Number.isFinite(l[col] as number)).length;
}

/** Variante commode là où une absence de valeur se lit comme un zéro. */
export const agregerOuZero = (lignes: Ligne[], valeur?: Valeur): number =>
  agreger(lignes, valeur) ?? 0;

/**
 * Éclate les lignes par modalité d'une dimension. Une ligne dont la colonne
 * porte plusieurs valeurs (ChoiceList) compte dans chaque modalité.
 */
export function grouper(lignes: Ligne[], colonne: string): Map<string, Ligne[]> {
  const groupes = new Map<string, Ligne[]>();
  for (const l of lignes) {
    for (const v of valeursDe(l[colonne])) {
      const cle = String(v);
      if (!cle) continue;
      const paquet = groupes.get(cle);
      if (paquet) paquet.push(l);
      else groupes.set(cle, [l]);
    }
  }
  return groupes;
}

export const libelleDe = (dim: Dimension, cle: string) => dim.libelles?.[cle] ?? cle;
export const libelleCourtDe = (dim: Dimension, cle: string) =>
  dim.libellesCourts?.[cle] ?? dim.libelles?.[cle] ?? cle;

/**
 * Ordonne les modalités : ordre imposé s'il existe, sinon tri demandé.
 * `poids` sert au tri par effectif décroissant.
 */
export function ordonner(
  dim: Dimension,
  presentes: string[],
  poids: (cle: string) => number,
): string[] {
  if (dim.ordre?.length) {
    const gardees = dim.ordre.filter((c) => !dim.masquerVides || presentes.includes(c));
    return gardees;
  }
  const cles = [...presentes];
  if (dim.tri === 'alpha') {
    return cles.sort((a, b) => libelleDe(dim, a).localeCompare(libelleDe(dim, b), 'fr'));
  }
  return cles.sort((a, b) => poids(b) - poids(a));
}

/** Formatage français : séparateur de milliers, décimales à la française. */
export const nombre = (n: number) =>
  n.toLocaleString('fr-FR', { maximumFractionDigits: 2 });

const MOIS_COURTS = [
  'janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin',
  'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.',
];

/** Un horodatage Grist (secondes) vers « juil. 26 ». */
export function formatMois(brut: unknown): string {
  if (typeof brut !== 'number' || !brut) return texte(brut);
  const d = new Date(brut * 1000);
  return `${MOIS_COURTS[d.getUTCMonth()]} ${String(d.getUTCFullYear()).slice(2)}`;
}

/** Clé de tri chronologique d'une abscisse temporelle. */
export const cleTemporelle = (brut: unknown): number =>
  typeof brut === 'number' ? brut : 0;

/**
 * Ramène un horodatage au premier de son mois.
 *
 * C'est ce qui donne son sens à `format: 'mois'` : sans ce regroupement, une
 * colonne horodatée à la seconde produirait une abscisse par enregistrement,
 * toutes étiquetées avec le même mois.
 */
export function debutDeMois(brut: unknown): number | null {
  if (typeof brut !== 'number' || !brut) return null;
  const d = new Date(brut * 1000);
  return Math.floor(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1) / 1000);
}

/** Suite continue de premiers-de-mois entre deux bornes incluses. */
export function moisEntre(debut: number, fin: number): number[] {
  const out: number[] = [];
  const d = new Date(debut * 1000);
  let a = d.getUTCFullYear();
  let m = d.getUTCMonth();
  for (let garde = 0; garde < 600; garde++) {
    const t = Math.floor(Date.UTC(a, m, 1) / 1000);
    if (t > fin) break;
    out.push(t);
    m += 1;
    if (m > 11) {
      m = 0;
      a += 1;
    }
  }
  return out;
}
