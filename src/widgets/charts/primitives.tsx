import { useCallback, useState } from 'react';
import type { ReactNode } from 'react';
import { nombre } from './donnees';

/**
 * Primitives de tracé, agnostiques du document : elles reçoivent des libellés
 * et des nombres déjà préparés, et ne connaissent ni table ni colonne.
 *
 * Le `viewBox` est calé sur la largeur maximale d'affichage : à pleine largeur
 * l'échelle vaut 1 et le texte garde sa taille nominale.
 */
export const LARGEUR = 1000;

const LARGEUR_LIBELLE = 180;
const RESERVE_ETIQUETTE = 56;
const RESERVE_ETIQUETTE_JAUGE = 175;
const HAUTEUR_BARRE = 25;
const PAS = 36;
const ECART = 2; // respiration entre segments, en unités de surface

/* ------------------------------------------------------------------ */
/* Infobulle                                                           */
/* ------------------------------------------------------------------ */

export interface ContenuInfobulle {
  titre: string;
  lignes: { libelle: string; valeur: string; couleur?: string }[];
}

export function useInfobulle() {
  const [etat, setEtat] = useState<{ x: number; y: number; contenu: ContenuInfobulle } | null>(null);

  const montrer = useCallback((e: React.MouseEvent, contenu: ContenuInfobulle) => {
    setEtat({ x: e.clientX, y: e.clientY, contenu });
  }, []);
  const cacher = useCallback(() => setEtat(null), []);

  const noeud = etat ? (
    <div
      className="viz__infobulle"
      style={{
        // Bascule près des bords pour ne pas sortir du cadre.
        left: Math.min(etat.x + 12, window.innerWidth - 272),
        top: Math.max(8, etat.y - 12),
      }}
      role="tooltip"
    >
      <div className="viz__infobulle-titre">{etat.contenu.titre}</div>
      {etat.contenu.lignes.map((l, i) => (
        <div className="viz__infobulle-ligne" key={i}>
          {l.couleur && <span className="viz__puce" style={{ background: l.couleur }} />}
          <span>{l.libelle}</span>
          <span className="viz__infobulle-valeur">{l.valeur}</span>
        </div>
      ))}
    </div>
  ) : null;

  return { montrer, cacher, noeud };
}

/* ------------------------------------------------------------------ */
/* Légende                                                             */
/* ------------------------------------------------------------------ */

export interface Serie {
  cle: string;
  libelle: string;
  couleur: string;
}

export function Legende({ series }: { series: Serie[] }) {
  if (series.length < 2) return null; // une seule série : le titre la nomme
  return (
    <div className="viz__legende">
      {series.map((s) => (
        <span className="viz__legende-item" key={s.cle}>
          <span className="viz__puce" style={{ background: s.couleur }} />
          {s.libelle}
        </span>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Barres horizontales, éventuellement empilées                        */
/* ------------------------------------------------------------------ */

export interface LigneBarres {
  cle: string;
  libelle: string;
  segments: { cle: string; valeur: number }[];
  /** Mention discrète après la valeur, p. ex. le nombre d'observations. */
  annotation?: string;
}

export function Barres({
  lignes,
  series,
  suffixe = '',
}: {
  lignes: LigneBarres[];
  series: Serie[];
  suffixe?: string;
}) {
  const { montrer, cacher, noeud } = useInfobulle();
  const couleurs = new Map(series.map((s) => [s.cle, s.couleur]));
  const libelles = new Map(series.map((s) => [s.cle, s.libelle]));

  const totaux = lignes.map((l) => l.segments.reduce((s, x) => s + x.valeur, 0));
  const max = Math.max(1, ...totaux);
  const largeurTrace = LARGEUR - LARGEUR_LIBELLE - RESERVE_ETIQUETTE;
  const hauteur = lignes.length * PAS + 8;
  const echelle = (v: number) => (v / max) * largeurTrace;

  if (!lignes.length) return <p className="viz__vide">Aucune donnée sur ce périmètre.</p>;

  return (
    <>
      <div className="viz__scroll">
        <svg className="viz__svg" viewBox={`0 0 ${LARGEUR} ${hauteur}`} style={{ minWidth: 720 }} role="img">
          {lignes.map((ligne, i) => {
            const y = i * PAS;
            const total = totaux[i];
            let x = LARGEUR_LIBELLE;
            return (
              <g key={ligne.cle}>
                <text className="viz__axe" x={LARGEUR_LIBELLE - 8} y={y + HAUTEUR_BARRE / 2} textAnchor="end" dominantBaseline="central">
                  {ligne.libelle}
                </text>

                {ligne.segments.map((seg) => {
                  if (seg.valeur <= 0) return null;
                  const l = Math.max(echelle(seg.valeur) - ECART, 1);
                  const xs = x;
                  x += echelle(seg.valeur);
                  const couleur = couleurs.get(seg.cle) ?? 'var(--neutral)';
                  return (
                    <g key={seg.cle}>
                      <rect className="viz__marque" x={xs} y={y} width={l} height={HAUTEUR_BARRE} rx={3} fill={couleur} />
                      <rect
                        className="viz__cible"
                        x={xs}
                        y={y - 3}
                        width={l + ECART}
                        height={HAUTEUR_BARRE + 6}
                        onMouseMove={(e) =>
                          montrer(e, {
                            titre: ligne.libelle,
                            lignes:
                              ligne.segments.length > 1
                                ? [
                                    { libelle: libelles.get(seg.cle) ?? seg.cle, valeur: `${nombre(seg.valeur)}${suffixe}`, couleur },
                                    { libelle: 'Total', valeur: `${nombre(total)}${suffixe}` },
                                  ]
                                : [{ libelle: libelles.get(seg.cle) ?? seg.cle, valeur: `${nombre(seg.valeur)}${suffixe}`, couleur }],
                          })
                        }
                        onMouseLeave={cacher}
                      />
                    </g>
                  );
                })}

                {/* Étiquette directe : le relief exigé quand le contraste est faible. */}
                <text className="viz__valeur" x={LARGEUR_LIBELLE + echelle(total) + 8} y={y + HAUTEUR_BARRE / 2} dominantBaseline="central">
                  {nombre(total)}
                  {suffixe}
                  {ligne.annotation && <tspan className="viz__annotation"> {ligne.annotation}</tspan>}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      {noeud}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Courbe                                                              */
/* ------------------------------------------------------------------ */

export interface SerieCourbe extends Serie {
  points: (number | null)[];
}

export function Courbe({
  abscisses,
  series,
  hauteur = 300,
  suffixe = '',
}: {
  abscisses: string[];
  series: SerieCourbe[];
  hauteur?: number;
  suffixe?: string;
}) {
  const { montrer, cacher, noeud } = useInfobulle();
  const [survol, setSurvol] = useState<number | null>(null);

  const marge = { haut: 16, droite: 20, bas: 32, gauche: 52 };
  const l = LARGEUR - marge.gauche - marge.droite;
  const h = hauteur - marge.haut - marge.bas;

  const valeurs = series.flatMap((s) => s.points.filter((p): p is number => p !== null));
  if (!abscisses.length || !valeurs.length) {
    return <p className="viz__vide">Pas encore assez d'historique pour tracer une évolution.</p>;
  }
  const max = Math.max(...valeurs);
  const borneHaute = max <= 1 ? 1 : Math.ceil(max * 1.15);

  const x = (i: number) => marge.gauche + (abscisses.length === 1 ? l / 2 : (i / (abscisses.length - 1)) * l);
  const y = (v: number) => marge.haut + h - (v / borneHaute) * h;
  const graduations = [0, 0.5, 1].map((f) => Math.round(borneHaute * f));

  return (
    <>
      <div className="viz__scroll">
        <svg className="viz__svg" viewBox={`0 0 ${LARGEUR} ${hauteur}`} style={{ minWidth: 580 }} role="img">
          {graduations.map((g) => (
            <g key={g}>
              <line className="viz__grille" x1={marge.gauche} x2={LARGEUR - marge.droite} y1={y(g)} y2={y(g)} />
              <text className="viz__axe" x={marge.gauche - 8} y={y(g) + 4} textAnchor="end">
                {nombre(g)}
              </text>
            </g>
          ))}

          {abscisses.map((a, i) => (
            <text className="viz__axe" key={`${a}-${i}`} x={x(i)} y={hauteur - 8} textAnchor="middle">
              {a}
            </text>
          ))}

          {series.map((s) => {
            const segments: string[] = [];
            let courant: string[] = [];
            s.points.forEach((p, i) => {
              if (p === null) {
                if (courant.length) segments.push(courant.join(' '));
                courant = [];
              } else {
                courant.push(`${courant.length ? 'L' : 'M'}${x(i)},${y(p)}`);
              }
            });
            if (courant.length) segments.push(courant.join(' '));
            return (
              <g key={s.cle}>
                {segments.map((d, i) => (
                  <path key={i} d={d} fill="none" stroke={s.couleur} strokeWidth={2} strokeLinecap="round" />
                ))}
                {s.points.map((p, i) =>
                  p === null ? null : (
                    // Anneau de surface : sépare les marques qui se chevauchent.
                    <circle key={i} cx={x(i)} cy={y(p)} r={4} fill={s.couleur} stroke="var(--surface-1)" strokeWidth={2} />
                  ),
                )}
              </g>
            );
          })}

          {abscisses.map((a, i) => {
            const pas = abscisses.length === 1 ? l : l / (abscisses.length - 1);
            return (
              <rect
                key={`cible-${a}-${i}`}
                className="viz__cible"
                x={x(i) - pas / 2}
                y={marge.haut}
                width={pas}
                height={h}
                onMouseMove={(e) => {
                  setSurvol(i);
                  montrer(e, {
                    titre: a,
                    lignes: series
                      .filter((s) => s.points[i] !== null)
                      .map((s) => ({
                        libelle: s.libelle,
                        valeur: `${nombre(s.points[i] as number)}${suffixe}`,
                        couleur: s.couleur,
                      })),
                  });
                }}
                onMouseLeave={() => {
                  setSurvol(null);
                  cacher();
                }}
              />
            );
          })}

          {survol !== null && (
            <line
              className="viz__grille"
              x1={x(survol)}
              x2={x(survol)}
              y1={marge.haut}
              y2={marge.haut + h}
              strokeDasharray="3 3"
            />
          )}
        </svg>
      </div>
      {noeud}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Jauges réalisé / objectif                                           */
/* ------------------------------------------------------------------ */

export interface LigneJauge {
  cle: string;
  libelle: string;
  realise: number;
  cible: number;
}

export function Jauges({ lignes }: { lignes: LigneJauge[] }) {
  const { montrer, cacher, noeud } = useInfobulle();
  if (!lignes.length) return <p className="viz__vide">Aucun objectif saisi pour ce périmètre.</p>;

  const max = Math.max(1, ...lignes.map((l) => Math.max(l.realise, l.cible)));
  const largeurTrace = LARGEUR - LARGEUR_LIBELLE - RESERVE_ETIQUETTE_JAUGE;
  const hauteur = lignes.length * PAS + 8;

  return (
    <>
      <div className="viz__scroll">
        <svg className="viz__svg" viewBox={`0 0 ${LARGEUR} ${hauteur}`} style={{ minWidth: 720 }} role="img">
          {lignes.map((ligne, i) => {
            const y = i * PAS;
            const lReal = (ligne.realise / max) * largeurTrace;
            const lCible = (ligne.cible / max) * largeurTrace;
            const atteint = ligne.cible > 0 && ligne.realise >= ligne.cible;
            const pct = ligne.cible > 0 ? Math.round((ligne.realise / ligne.cible) * 100) : null;
            return (
              <g key={ligne.cle}>
                <text className="viz__axe" x={LARGEUR_LIBELLE - 8} y={y + HAUTEUR_BARRE / 2} textAnchor="end" dominantBaseline="central">
                  {ligne.libelle}
                </text>
                {/* Piste = objectif ; la barre colorée est le réalisé. */}
                <rect x={LARGEUR_LIBELLE} y={y + 4} width={Math.max(lCible, 1)} height={HAUTEUR_BARRE - 8} rx={3} fill="var(--objectif)" opacity={0.35} />
                <rect
                  className="viz__marque"
                  x={LARGEUR_LIBELLE}
                  y={y}
                  width={Math.max(lReal, 1)}
                  height={HAUTEUR_BARRE}
                  rx={3}
                  fill={atteint ? 'var(--series-3)' : 'var(--series-1)'}
                />
                {ligne.cible > 0 && (
                  <line
                    x1={LARGEUR_LIBELLE + lCible}
                    x2={LARGEUR_LIBELLE + lCible}
                    y1={y - 2}
                    y2={y + HAUTEUR_BARRE + 2}
                    stroke="var(--text-secondary)"
                    strokeWidth={2}
                  />
                )}
                <text className="viz__valeur" x={LARGEUR_LIBELLE + Math.max(lReal, lCible) + 8} y={y + HAUTEUR_BARRE / 2} dominantBaseline="central">
                  {nombre(ligne.realise)} / {nombre(ligne.cible)}
                  {pct !== null ? `  (${pct} %)` : ''}
                </text>
                <rect
                  className="viz__cible"
                  x={LARGEUR_LIBELLE}
                  y={y - 3}
                  width={largeurTrace}
                  height={HAUTEUR_BARRE + 6}
                  onMouseMove={(e) =>
                    montrer(e, {
                      titre: ligne.libelle,
                      lignes: [
                        { libelle: 'Réalisé', valeur: nombre(ligne.realise), couleur: atteint ? 'var(--series-3)' : 'var(--series-1)' },
                        { libelle: 'Objectif', valeur: nombre(ligne.cible) },
                        { libelle: 'Atteinte', valeur: pct !== null ? `${pct} %` : '-' },
                      ],
                    })
                  }
                  onMouseLeave={cacher}
                />
              </g>
            );
          })}
        </svg>
      </div>
      {noeud}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Carte de chaleur                                                    */
/* ------------------------------------------------------------------ */

export interface LigneChaleur {
  cle: string;
  libelle: string;
  cellules: Record<string, number>;
}

/** Rampe séquentielle : une seule teinte. C'est une magnitude, pas une identité. */
const RAMPE_CHALEUR = [
  'var(--ordinal-1)',
  'var(--ordinal-2)',
  'var(--ordinal-3)',
  'var(--ordinal-4)',
  'var(--ordinal-5)',
  'var(--ordinal-6)',
  'var(--ordinal-7)',
];
/** Au-delà de ce palier, le fond est trop foncé pour du texte sombre. */
const PALIER_TEXTE_CLAIR = 3;

export function CarteChaleur({
  lignes,
  colonnes,
  echelle = 'racine',
  totaux = true,
  suffixe = '',
  entetes = 'oblique',
}: {
  lignes: LigneChaleur[];
  colonnes: { cle: string; libelle: string; libelleLong: string }[];
  echelle?: 'lineaire' | 'racine';
  totaux?: boolean;
  suffixe?: string;
  entetes?: 'oblique' | 'horizontal';
}) {
  const { montrer, cacher, noeud } = useInfobulle();

  if (!lignes.length || !colonnes.length) {
    return <p className="viz__vide">Aucune donnée sur ce périmètre.</p>;
  }

  const max = Math.max(1, ...lignes.flatMap((l) => colonnes.map((c) => l.cellules[c.cle] ?? 0)));

  const palier = (v: number) => {
    if (v <= 0) return -1;
    const t = echelle === 'racine' ? Math.sqrt(v) / Math.sqrt(max) : v / max;
    return Math.min(RAMPE_CHALEUR.length - 1, Math.floor(t * RAMPE_CHALEUR.length));
  };

  /*
   * Hauteur des en-têtes obliques : un libellé de n caractères écrit à -45°
   * occupe n × largeurCar × sin(45°) en vertical. La calculer évite le vide
   * d'une hauteur fixe surdimensionnée pour des libellés courts.
   */
  const oblique = entetes === 'oblique';
  const carsMax = Math.max(5, ...colonnes.map((c) => c.libelle.length));
  const hauteurEntete = oblique
    ? Math.round(Math.min(120, carsMax * 11 * 0.55 * Math.SQRT1_2 + 12))
    : undefined;
  const classeEntete = oblique ? 'viz__chaleur-oblique' : 'viz__chaleur-droit';

  const totalLigne = (l: LigneChaleur) => colonnes.reduce((a, c) => a + (l.cellules[c.cle] ?? 0), 0);
  const totalColonne = (cle: string) => lignes.reduce((a, l) => a + (l.cellules[cle] ?? 0), 0);
  const totalGeneral = lignes.reduce((a, l) => a + totalLigne(l), 0);

  return (
    <>
      <div className="viz__scroll">
        <table className="viz__chaleur">
          <thead>
            <tr>
              <th scope="col" className="viz__chaleur-entete" />
              {colonnes.map((c) => (
                <th
                  scope="col"
                  key={c.cle}
                  className={classeEntete}
                  style={{ height: hauteurEntete }}
                  title={c.libelleLong}
                >
                  <div>
                    <span>{c.libelle}</span>
                  </div>
                </th>
              ))}
              {totaux && (
                <th scope="col" className={`${classeEntete} viz__chaleur-total`} style={{ height: hauteurEntete }}>
                  <div>
                    <span>Total</span>
                  </div>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {lignes.map((l) => (
              <tr key={l.cle}>
                <th scope="row" className="viz__chaleur-entete">
                  {l.libelle}
                </th>
                {colonnes.map((c) => {
                  const v = l.cellules[c.cle] ?? 0;
                  const p = palier(v);
                  return (
                    <td
                      key={c.cle}
                      className={p >= PALIER_TEXTE_CLAIR ? 'viz__chaleur-case--fonce' : undefined}
                      style={p >= 0 ? { background: RAMPE_CHALEUR[p] } : undefined}
                      onMouseMove={(e) =>
                        montrer(e, {
                          titre: l.libelle,
                          lignes: [
                            { libelle: c.libelleLong, valeur: `${nombre(v)}${suffixe}` },
                            { libelle: 'Total de la ligne', valeur: `${nombre(totalLigne(l))}${suffixe}` },
                          ],
                        })
                      }
                      onMouseLeave={cacher}
                    >
                      {v > 0 ? nombre(v) : <span className="viz__chaleur-zero">·</span>}
                    </td>
                  );
                })}
                {totaux && <td className="viz__chaleur-total">{nombre(totalLigne(l))}</td>}
              </tr>
            ))}
          </tbody>
          {totaux && (
            <tfoot>
              <tr>
                <th scope="row" className="viz__chaleur-entete">
                  Total
                </th>
                {colonnes.map((c) => (
                  <td key={c.cle}>{nombre(totalColonne(c.cle))}</td>
                ))}
                <td className="viz__chaleur-total">{nombre(totalGeneral)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      {noeud}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Bloc : titre, bascule graphique / données, contenu                  */
/* ------------------------------------------------------------------ */

export function Bloc({
  titre,
  sousTitre,
  children,
  tableau,
}: {
  titre?: string;
  sousTitre?: string;
  children: ReactNode;
  tableau?: { entetes: string[]; lignes: (string | number)[][] };
}) {
  const [voirTableau, setVoirTableau] = useState(false);
  return (
    <section className="viz__bloc">
      <div className="viz__entete">
        <div>
          {titre && <h3 className="viz__bloc-titre">{titre}</h3>}
          {sousTitre && <p className="viz__bloc-sous-titre">{sousTitre}</p>}
        </div>
        {tableau && (
          <div className="viz__bascule" role="group" aria-label="Mode d'affichage">
            <button
              type="button"
              aria-pressed={!voirTableau}
              aria-label="Afficher le graphique"
              title="Graphique"
              onClick={() => setVoirTableau(false)}
            >
              <span className="material-icons" aria-hidden="true">
                bar_chart
              </span>
            </button>
            <button
              type="button"
              aria-pressed={voirTableau}
              aria-label="Afficher les données"
              title="Données"
              onClick={() => setVoirTableau(true)}
            >
              <span className="material-icons" aria-hidden="true">
                table_rows
              </span>
            </button>
          </div>
        )}
      </div>
      {voirTableau && tableau ? (
        <div className="viz__scroll">
          <table className="viz__table">
            <thead>
              <tr>
                {tableau.entetes.map((e, i) => (
                  <th key={`${e}-${i}`}>{e}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tableau.lignes.map((l, i) => (
                <tr key={i}>
                  {l.map((c, j) => (
                    <td key={j}>{typeof c === 'number' ? nombre(c) : c}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        children
      )}
    </section>
  );
}
