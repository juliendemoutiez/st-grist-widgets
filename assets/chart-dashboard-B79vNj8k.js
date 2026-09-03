import{w as u,j as e,W as d,z as m,r as f,A as p,G as g}from"./NavigationContext-sPPvyzTK.js";import"./primitives-BIWRhEcW.js";import{V as j}from"./index-BCVFmOc5.js";import{V as x}from"./index-BLh1nIX6.js";import{V as h}from"./index-DojhEXAg.js";import{V as v}from"./index-DZh2xsUl.js";const b=`{
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
}`,a=["heatmap","barres","ligne","objectif"];function c(t){const r=t;if(!Array.isArray(r?.blocs)||!r.blocs.length)return"Le tableau « blocs » est requis.";const i=r.blocs.findIndex(s=>!a.includes(s?.type));return i>=0?`Bloc ${i+1} : « type » doit valoir ${a.join(", ")}.`:null}function y({bloc:t}){switch(t.type){case"heatmap":return e.jsx(j,{config:t});case"barres":return e.jsx(x,{config:t});case"ligne":return e.jsx(h,{config:t});case"objectif":return e.jsx(v,{config:t})}}function E(){const{widgetOptions:t,isConfiguringWidget:r,setIsConfiguringWidget:i}=u(),s=t;if(r||c(s))return e.jsx("div",{className:"viz",children:e.jsx(d,{title:"Tableau de bord",placeholder:b,validate:c,onDone:()=>i(!1)})});const o=s;return e.jsxs("div",{className:"viz",children:[o.titre&&e.jsx("h2",{className:"viz__titre",children:o.titre}),o.blocs.map((n,l)=>e.jsx(y,{bloc:n},`${n.type}-${l}`))]})}m.createRoot(document.getElementById("root")).render(e.jsx(f.StrictMode,{children:e.jsx(p,{theme:"dsfr-light",children:e.jsx(g,{children:e.jsx(E,{})})})}));
