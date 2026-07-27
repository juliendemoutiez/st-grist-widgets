import { useGrist, WidgetSettings } from '@grist-widgets/ui';
import { Barres, Bloc, type LigneBarres, type Serie } from '../primitives';
import { agreger, appliquerFiltres, grouper, libelleDe, ordonner, useTable } from '../donnees';
import type { ConfigBarres } from '../types';

/**
 * Rampe ordinale : quand `lignes.ordre` impose une séquence, la teinte
 * s'assombrit le long de cette séquence pour redoubler l'ordre. Sinon toutes
 * les barres partagent la teinte principale — une mesure unique sur des
 * catégories nominales ne se colore pas par sa valeur.
 */
const RAMPE = [
  'var(--ordinal-1)',
  'var(--ordinal-2)',
  'var(--ordinal-3)',
  'var(--ordinal-4)',
  'var(--ordinal-5)',
  'var(--ordinal-6)',
  'var(--ordinal-7)',
];

const EXEMPLE = `{
  "titre": "Temps moyen par étape",
  "table": "Historique_Parcours",
  "filtres": [{ "colonne": "champ", "valeur": "parcoursDirecte" }],
  "lignes": { "colonne": "valeur_avant", "ordre": ["A_CONTACTER", "CONTACT_EN_COURS"] },
  "valeur": { "mode": "moyenne", "colonne": "duree_etape_jours" },
  "suffixe": " j"
}`;

function valide(parsed: unknown): string | null {
  const c = parsed as ConfigBarres;
  if (!c?.table) return 'Le champ « table » est requis.';
  if (!c?.lignes?.colonne) return 'Le champ « lignes.colonne » est requis.';
  return null;
}

export function VueBarres({ config: c }: { config: ConfigBarres }) {
  const { lignes: brutes, chargement, erreur } = useTable(c.table);

  if (erreur) return <p className="viz__vide">Lecture impossible : {erreur}</p>;
  if (chargement) return <p className="viz__vide">Chargement…</p>;

  const filtrees = appliquerFiltres(brutes, c.filtres);

  // Un groupe sans valeur agrégeable est écarté : une moyenne qui n'existe pas
  // ne doit pas se lire comme une barre à zéro.
  const valeurs = new Map<string, number>();
  for (const [cle, paquet] of grouper(filtrees, c.lignes.colonne)) {
    const v = agreger(paquet, c.valeur);
    if (v !== null) valeurs.set(cle, v);
  }

  const cles = ordonner(c.lignes, [...valeurs.keys()], (cle) => valeurs.get(cle) ?? 0).filter((cle) =>
    valeurs.has(cle),
  );

  // Séquence imposée : la teinte suit l'ordre. Sinon, teinte unique.
  const ordinal = Boolean(c.lignes.ordre?.length);
  const couleur = (i: number) =>
    ordinal ? RAMPE[Math.round((i / Math.max(1, cles.length - 1)) * (RAMPE.length - 1))] : 'var(--series-1)';

  const lignes: LigneBarres[] = cles.map((cle) => ({
    cle,
    libelle: libelleDe(c.lignes, cle),
    segments: [{ cle, valeur: valeurs.get(cle) ?? 0 }],
  }));
  const series: Serie[] = cles.map((cle, i) => ({
    cle,
    libelle: libelleDe(c.lignes, cle),
    couleur: couleur(i),
  }));

  return (
      <Bloc
        titre={c.titre}
        sousTitre={c.sousTitre}
        tableau={{
          entetes: ['', 'Valeur'],
          lignes: lignes.map((l) => [l.libelle, l.segments[0].valeur]),
        }}
      >
        <Barres lignes={lignes} series={series} suffixe={c.suffixe} />
      </Bloc>
  );
}

export function BarresWidget() {
  const { widgetOptions, isConfiguringWidget, setIsConfiguringWidget } = useGrist();
  const config = widgetOptions as ConfigBarres | null;

  if (isConfiguringWidget || valide(config)) {
    return (
      <div className="viz">
        <WidgetSettings
          title="Barres"
          placeholder={EXEMPLE}
          validate={valide}
          onDone={() => setIsConfiguringWidget(false)}
        />
      </div>
    );
  }
  return (
    <div className="viz">
      <VueBarres config={config as ConfigBarres} />
    </div>
  );
}
