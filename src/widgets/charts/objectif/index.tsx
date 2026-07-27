import { useGrist, WidgetSettings } from '@grist-widgets/ui';
import { Bloc, Jauges, type LigneJauge } from '../primitives';
import { agregerOuZero, appliquerFiltres, grouper, useTable } from '../donnees';
import type { ConfigObjectif } from '../types';

const EXEMPLE = `{
  "titre": "Réalisé comparé à l'objectif",
  "realise": {
    "table": "Deploiements",
    "filtres": [{ "colonne": "offre", "valeur": "OFFRE_3_DIRECT" }],
    "groupe": "region",
    "valeur": { "mode": "compte-distinct", "colonne": "twenty_id" }
  },
  "objectif": {
    "table": "Objectifs",
    "filtres": [{ "colonne": "offre", "valeur": "OFFRE_3_DIRECT" }],
    "groupe": "region",
    "valeur": { "mode": "somme", "colonne": "cible" }
  }
}`;

function valide(parsed: unknown): string | null {
  const c = parsed as ConfigObjectif;
  if (!c?.realise?.table || !c?.realise?.groupe) return 'Le bloc « realise » est incomplet.';
  if (!c?.objectif?.table || !c?.objectif?.groupe) return 'Le bloc « objectif » est incomplet.';
  return null;
}

export function VueObjectif({ config: c }: { config: ConfigObjectif }) {
  const realise = useTable(c.realise?.table);
  const objectif = useTable(c.objectif?.table);

  const erreur = realise.erreur ?? objectif.erreur;
  if (erreur) return <p className="viz__vide">Lecture impossible : {erreur}</p>;
  if (realise.chargement || objectif.chargement) return <p className="viz__vide">Chargement…</p>;

  const parGroupe = (
    lignes: typeof realise.lignes,
    source: ConfigObjectif['realise'],
  ): Map<string, number> => {
    const out = new Map<string, number>();
    for (const [cle, paquet] of grouper(appliquerFiltres(lignes, source.filtres), source.groupe)) {
      out.set(cle, agregerOuZero(paquet, source.valeur));
    }
    return out;
  };

  const faits = parGroupe(realise.lignes, c.realise);
  const cibles = parGroupe(objectif.lignes, c.objectif);

  /*
   * Piloté par les objectifs : une ligne sans cible n'a rien à comparer.
   * L'inverse — une cible sans réalisé — reste affichée, à zéro, car c'est
   * une information utile.
   */
  const lignes: LigneJauge[] = [...cibles.entries()]
    .map(([cle, cible]) => ({
      cle,
      libelle: c.libelles?.[cle] ?? cle,
      realise: faits.get(cle) ?? 0,
      cible,
    }))
    .sort((a, b) => b.cible - a.cible);

  return (
      <Bloc
        titre={c.titre}
        sousTitre={c.sousTitre}
        tableau={{
          entetes: ['', 'Réalisé', 'Objectif', 'Atteinte'],
          lignes: lignes.map((l) => [
            l.libelle,
            l.realise,
            l.cible,
            l.cible > 0 ? `${Math.round((l.realise / l.cible) * 100)} %` : '-',
          ]),
        }}
      >
        <Jauges lignes={lignes} />
      </Bloc>
  );
}

export function ObjectifWidget() {
  const { widgetOptions, isConfiguringWidget, setIsConfiguringWidget } = useGrist();
  const config = widgetOptions as ConfigObjectif | null;

  if (isConfiguringWidget || valide(config)) {
    return (
      <div className="viz">
        <WidgetSettings
          title="Réalisé / objectif"
          placeholder={EXEMPLE}
          validate={valide}
          onDone={() => setIsConfiguringWidget(false)}
        />
      </div>
    );
  }
  return (
    <div className="viz">
      <VueObjectif config={config as ConfigObjectif} />
    </div>
  );
}
