import { useGrist, WidgetSettings } from '@grist-widgets/ui';
import { VueHeatmap } from '../heatmap';
import { VueBarres } from '../barres';
import { VueLigne } from '../ligne';
import { VueObjectif } from '../objectif';
import type { ConfigBarres, ConfigHeatmap, ConfigLigne, ConfigObjectif } from '../types';

/**
 * Tableau de bord : une page Grist unique qui empile plusieurs blocs, plutôt
 * qu'une vue personnalisée par graphique. Il reste agnostique du document — il
 * ne fait que composer les mêmes vues génériques, chacune avec sa propre
 * configuration, sous une clé `type`.
 */
export type ConfigBloc =
  | ({ type: 'heatmap' } & ConfigHeatmap)
  | ({ type: 'barres' } & ConfigBarres)
  | ({ type: 'ligne' } & ConfigLigne)
  | ({ type: 'objectif' } & ConfigObjectif);

export interface ConfigDashboard {
  titre?: string;
  blocs: ConfigBloc[];
}

const EXEMPLE = `{
  "titre": "Offre 3 - déploiement",
  "blocs": [
    {
      "type": "heatmap",
      "titre": "Collectivités par région et par outil",
      "table": "Deploiements",
      "filtres": [{ "colonne": "offre", "valeur": "OFFRE_3_DIRECT" }],
      "lignes": { "colonne": "region", "tri": "valeur-desc" },
      "colonnes": { "colonne": "produit", "tri": "valeur-desc", "masquerVides": true },
      "valeur": { "mode": "compte" }
    },
    {
      "type": "ligne",
      "titre": "Évolution mensuelle",
      "table": "Snapshots",
      "x": { "colonne": "periode", "format": "mois" },
      "valeur": { "mode": "somme", "colonne": "nb" }
    }
  ]
}`;

const TYPES = ['heatmap', 'barres', 'ligne', 'objectif'];

function valide(parsed: unknown): string | null {
  const c = parsed as ConfigDashboard;
  if (!Array.isArray(c?.blocs) || !c.blocs.length) return 'Le tableau « blocs » est requis.';
  const mauvais = c.blocs.findIndex((b) => !TYPES.includes(b?.type));
  if (mauvais >= 0) return `Bloc ${mauvais + 1} : « type » doit valoir ${TYPES.join(', ')}.`;
  return null;
}

function Bloc({ bloc }: { bloc: ConfigBloc }) {
  switch (bloc.type) {
    case 'heatmap':
      return <VueHeatmap config={bloc} />;
    case 'barres':
      return <VueBarres config={bloc} />;
    case 'ligne':
      return <VueLigne config={bloc} />;
    case 'objectif':
      return <VueObjectif config={bloc} />;
  }
}

export function DashboardWidget() {
  const { widgetOptions, isConfiguringWidget, setIsConfiguringWidget } = useGrist();
  const config = widgetOptions as ConfigDashboard | null;

  if (isConfiguringWidget || valide(config)) {
    return (
      <div className="viz">
        <WidgetSettings
          title="Tableau de bord"
          placeholder={EXEMPLE}
          validate={valide}
          onDone={() => setIsConfiguringWidget(false)}
        />
      </div>
    );
  }
  const c = config as ConfigDashboard;

  return (
    <div className="viz">
      {c.titre && <h2 className="viz__titre">{c.titre}</h2>}
      {c.blocs.map((bloc, i) => (
        <Bloc key={`${bloc.type}-${i}`} bloc={bloc} />
      ))}
    </div>
  );
}
