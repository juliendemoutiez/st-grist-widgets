import{w as m,j as s,W as j}from"./NavigationContext-sPPvyzTK.js";import{u,B as d,J as v,g as x,a as h,b as O}from"./primitives-BIWRhEcW.js";const _=`{
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
}`;function f(i){const t=i;return!t?.realise?.table||!t?.realise?.groupe?"Le bloc « realise » est incomplet.":!t?.objectif?.table||!t?.objectif?.groupe?"Le bloc « objectif » est incomplet.":null}function E({config:i}){const t=u(i.realise?.table),o=u(i.objectif?.table),l=t.erreur??o.erreur;if(l)return s.jsxs("p",{className:"viz__vide",children:["Lecture impossible : ",l]});if(t.chargement||o.chargement)return s.jsx("p",{className:"viz__vide",children:"Chargement…"});const n=(e,r)=>{const c=new Map;for(const[g,p]of x(h(e,r.filtres),r.groupe))c.set(g,O(p,r.valeur));return c},b=n(t.lignes,i.realise),a=[...n(o.lignes,i.objectif).entries()].map(([e,r])=>({cle:e,libelle:i.libelles?.[e]??e,realise:b.get(e)??0,cible:r})).sort((e,r)=>r.cible-e.cible);return s.jsx(d,{titre:i.titre,sousTitre:i.sousTitre,tableau:{entetes:["","Réalisé","Objectif","Atteinte"],lignes:a.map(e=>[e.libelle,e.realise,e.cible,e.cible>0?`${Math.round(e.realise/e.cible*100)} %`:"-"])},children:s.jsx(v,{lignes:a})})}function T(){const{widgetOptions:i,isConfiguringWidget:t,setIsConfiguringWidget:o}=m(),l=i;return t||f(l)?s.jsx("div",{className:"viz",children:s.jsx(j,{title:"Réalisé / objectif",placeholder:_,validate:f,onDone:()=>o(!1)})}):s.jsx("div",{className:"viz",children:s.jsx(E,{config:l})})}export{T as O,E as V};
