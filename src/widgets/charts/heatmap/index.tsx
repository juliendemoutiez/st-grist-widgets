import { useGrist, WidgetSettings } from '@grist-widgets/ui';
import { Bloc, CarteChaleur, type LigneChaleur } from '../primitives';
import {
  agregerOuZero,
  appliquerFiltres,
  grouper,
  libelleCourtDe,
  libelleDe,
  ordonner,
  useTable,
} from '../donnees';
import type { ConfigHeatmap } from '../types';

const EXEMPLE = `{
  "titre": "Effectifs par région et par outil",
  "table": "Deploiements",
  "filtres": [{ "colonne": "offre", "valeur": "OFFRE_3_DIRECT" }],
  "lignes": { "colonne": "region", "tri": "valeur-desc" },
  "colonnes": { "colonne": "produit", "tri": "valeur-desc", "masquerVides": true },
  "valeur": { "mode": "compte" },
  "echelle": "racine"
}`;

function valide(parsed: unknown): string | null {
  const c = parsed as ConfigHeatmap;
  if (!c?.table) return 'Le champ « table » est requis.';
  if (!c?.lignes?.colonne) return 'Le champ « lignes.colonne » est requis.';
  if (!c?.colonnes?.colonne) return 'Le champ « colonnes.colonne » est requis.';
  return null;
}

export function VueHeatmap({ config: c }: { config: ConfigHeatmap }) {
  const { lignes: brutes, chargement, erreur } = useTable(c.table);

  if (erreur) return <p className="viz__vide">Lecture impossible : {erreur}</p>;
  if (chargement) return <p className="viz__vide">Chargement…</p>;

  const filtrees = appliquerFiltres(brutes, c.filtres);
  const parLigne = grouper(filtrees, c.lignes.colonne);

  // Effectif d'une modalité de colonne, tous groupes de lignes confondus.
  const poidsColonne = new Map<string, number>();
  for (const [cle, paquet] of grouper(filtrees, c.colonnes.colonne)) {
    poidsColonne.set(cle, agregerOuZero(paquet, c.valeur));
  }

  const clesColonnes = ordonner(
    c.colonnes,
    [...poidsColonne.keys()],
    (cle) => poidsColonne.get(cle) ?? 0,
  );
  const colonnes = clesColonnes.map((cle) => ({
    cle,
    libelle: libelleCourtDe(c.colonnes, cle),
    libelleLong: libelleDe(c.colonnes, cle),
  }));

  const cellulesPar = new Map<string, Record<string, number>>();
  for (const [cleLigne, paquet] of parLigne) {
    const cellules: Record<string, number> = {};
    for (const [cleCol, sous] of grouper(paquet, c.colonnes.colonne)) {
      cellules[cleCol] = agregerOuZero(sous, c.valeur);
    }
    cellulesPar.set(cleLigne, cellules);
  }

  const totalDe = (cle: string) =>
    clesColonnes.reduce((a, col) => a + (cellulesPar.get(cle)?.[col] ?? 0), 0);

  const lignes: LigneChaleur[] = ordonner(c.lignes, [...cellulesPar.keys()], totalDe).map((cle) => ({
    cle,
    libelle: libelleDe(c.lignes, cle),
    cellules: cellulesPar.get(cle) ?? {},
  }));

  return (
      <Bloc
        titre={c.titre}
        sousTitre={c.sousTitre}
        tableau={{
          entetes: ['', ...colonnes.map((col) => col.libelleLong), 'Total'],
          lignes: lignes.map((l) => [
            l.libelle,
            ...colonnes.map((col) => l.cellules[col.cle] ?? 0),
            totalDe(l.cle),
          ]),
        }}
      >
        <CarteChaleur
          lignes={lignes}
          colonnes={colonnes}
          echelle={c.echelle}
          totaux={c.totaux !== false}
          suffixe={c.suffixe}
        />
      </Bloc>
  );
}

export function HeatmapWidget() {
  const { widgetOptions, isConfiguringWidget, setIsConfiguringWidget } = useGrist();
  const config = widgetOptions as ConfigHeatmap | null;

  if (isConfiguringWidget || valide(config)) {
    return (
      <div className="viz">
        <WidgetSettings
          title="Carte de chaleur"
          placeholder={EXEMPLE}
          validate={valide}
          onDone={() => setIsConfiguringWidget(false)}
        />
      </div>
    );
  }
  return (
    <div className="viz">
      <VueHeatmap config={config as ConfigHeatmap} />
    </div>
  );
}
