import { useGrist, WidgetSettings } from '@grist-widgets/ui';
import { Bloc, Courbe, Legende, type SerieCourbe } from '../primitives';
import {
  agreger,
  agregerOuZero,
  appliquerFiltres,
  cleTemporelle,
  debutDeMois,
  debutDeSemaine,
  formatMois,
  formatSemaine,
  moisEntre,
  semainesEntre,
  grouper,
  libelleDe,
  ordonner,
  texte,
  useTable,
  type Ligne,
} from '../donnees';
import type { ConfigLigne } from '../types';

/** Quatre emplacements catégoriels au maximum ; au-delà, repli en « Autres ». */
const COULEURS = ['var(--series-1)', 'var(--series-2)', 'var(--series-3)', 'var(--series-4)'];
const MAX_SERIES_DEFAUT = 4;
const CLE_AUTRES = '__autres';

const EXEMPLE = `{
  "titre": "Évolution mensuelle",
  "table": "Snapshots",
  "filtres": [{ "colonne": "dimension", "valeur": "PRODUIT" }],
  "x": { "colonne": "periode", "format": "mois" },
  "series": { "colonne": "valeur", "max": 4 },
  "valeur": { "mode": "somme", "colonne": "nb" }
}`;

function valide(parsed: unknown): string | null {
  const c = parsed as ConfigLigne;
  if (!c?.table) return 'Le champ « table » est requis.';
  if (!c?.x?.colonne) return 'Le champ « x.colonne » est requis.';
  return null;
}

export function VueLigne({ config: c }: { config: ConfigLigne }) {
  const { lignes: brutes, chargement, erreur } = useTable(c.table);

  if (erreur) return <p className="viz__vide">Lecture impossible : {erreur}</p>;
  if (chargement) return <p className="viz__vide">Chargement…</p>;

  const filtrees = appliquerFiltres(brutes, c.filtres);

  /*
   * En `format: 'mois'`, l'abscisse est le mois — pas l'horodatage. Sans ce
   * regroupement, une colonne datée à la seconde produirait une abscisse par
   * enregistrement. Les mois sans donnée sont ensuite réintroduits, sinon
   * l'axe se resserre sur les seules périodes actives et la pente ment.
   */
  const parMois = c.x.format === 'mois';
  const parSemaine = c.x.format === 'semaine';
  const parPeriode = parMois || parSemaine;
  const debutPeriode = parMois ? debutDeMois : debutDeSemaine;
  const parX = new Map<string, Ligne[]>();
  const bruteX = new Map<string, unknown>();
  for (const l of filtrees) {
    const brut = l[c.x.colonne];
    const groupe = parPeriode ? debutPeriode(brut) : brut;
    if (groupe === null || groupe === undefined || groupe === '') continue;
    const cle = texte(groupe);
    bruteX.set(cle, groupe);
    const paquet = parX.get(cle);
    if (paquet) paquet.push(l);
    else parX.set(cle, [l]);
  }

  let clesX: string[];
  if (parPeriode && parX.size) {
    const bornes = [...bruteX.values()].map((v) => cleTemporelle(v));
    const suite = parMois ? moisEntre : semainesEntre;
    clesX = suite(Math.min(...bornes), Math.max(...bornes)).map(String);
    for (const cle of clesX) if (!bruteX.has(cle)) bruteX.set(cle, Number(cle));
  } else {
    const temporel = c.x.format !== 'brut';
    clesX = [...parX.keys()].sort((a, b) =>
      temporel ? cleTemporelle(bruteX.get(a)) - cleTemporelle(bruteX.get(b)) : a.localeCompare(b, 'fr'),
    );
  }

  const abscisses = clesX.map((cle) => {
    if (parMois) return formatMois(bruteX.get(cle));
    if (parSemaine) return formatSemaine(bruteX.get(cle));
    return libelleDe(c.x, cle);
  });

  // Une seule série si aucune colonne de séries n'est configurée.
  let series: SerieCourbe[];
  if (!c.series?.colonne) {
    series = [
      {
        cle: 'total',
        libelle: c.titre ?? 'Total',
        couleur: COULEURS[0],
        points: clesX.map((cle) => agreger(parX.get(cle) ?? [], c.valeur)),
      },
    ];
  } else {
    const dim = c.series;
    const poids = new Map<string, number>();
    for (const [cle, paquet] of grouper(filtrees, dim.colonne)) {
      poids.set(cle, agregerOuZero(paquet, c.valeur));
    }
    const classees = ordonner(dim, [...poids.keys()], (cle) => poids.get(cle) ?? 0);
    const max = dim.max ?? MAX_SERIES_DEFAUT;
    const principales = classees.slice(0, max);
    const aDesAutres = classees.length > max;
    const cleDe = (v: string) => (principales.includes(v) ? v : CLE_AUTRES);

    const parXSerie = new Map<string, Map<string, number>>();
    for (const cleX of clesX) {
      const m = new Map<string, number>();
      for (const [cleSerie, paquet] of grouper(parX.get(cleX) ?? [], dim.colonne)) {
        const k = cleDe(cleSerie);
        m.set(k, (m.get(k) ?? 0) + agregerOuZero(paquet, c.valeur));
      }
      parXSerie.set(cleX, m);
    }

    series = [
      ...principales.map((cle, i) => ({
        cle,
        libelle: libelleDe(dim, cle),
        couleur: COULEURS[i % COULEURS.length],
        points: clesX.map((cleX) => parXSerie.get(cleX)?.get(cle) ?? null),
      })),
      ...(aDesAutres
        ? [
            {
              cle: CLE_AUTRES,
              libelle: dim.libelleAutres ?? `Autres (${classees.length - max})`,
              couleur: 'var(--series-autres)',
              points: clesX.map((cleX) => parXSerie.get(cleX)?.get(CLE_AUTRES) ?? null),
            },
          ]
        : []),
    ];
  }

  return (
      <Bloc
        titre={c.titre}
        sousTitre={c.sousTitre}
        tableau={{
          entetes: ['', ...series.map((s) => s.libelle)],
          lignes: abscisses.map((a, i) => [a, ...series.map((s) => s.points[i] ?? 0)]),
        }}
      >
        <Courbe abscisses={abscisses} series={series} suffixe={c.suffixe} />
        <Legende series={series} />
      </Bloc>
  );
}

export function LigneWidget() {
  const { widgetOptions, isConfiguringWidget, setIsConfiguringWidget } = useGrist();
  const config = widgetOptions as ConfigLigne | null;

  if (isConfiguringWidget || valide(config)) {
    return (
      <div className="viz">
        <WidgetSettings
          title="Courbe d'évolution"
          placeholder={EXEMPLE}
          validate={valide}
          onDone={() => setIsConfiguringWidget(false)}
        />
      </div>
    );
  }
  return (
    <div className="viz">
      <VueLigne config={config as ConfigLigne} />
    </div>
  );
}
