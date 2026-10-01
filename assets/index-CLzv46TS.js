import{w as j,j as s,W as d}from"./NavigationContext-sPPvyzTK.js";import{u as b,B as v,J as x,g as h,a as O,b as _}from"./primitives-DsohSztl.js";const E=`{
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
}`;function g(i){const t=i;return!t?.realise?.table||!t?.realise?.groupe?"Le bloc « realise » est incomplet.":!t?.objectif?.table||!t?.objectif?.groupe?"Le bloc « objectif » est incomplet.":null}function R({config:i}){const t=b(i.realise?.table),l=b(i.objectif?.table),o=t.erreur??l.erreur;if(o)return s.jsxs("p",{className:"viz__vide",children:["Lecture impossible : ",o]});if(t.chargement||l.chargement)return s.jsx("p",{className:"viz__vide",children:"Chargement…"});const n=(e,r)=>{const f=new Map;for(const[p,m]of h(O(e,r.filtres),r.groupe))f.set(p,_(m,r.valeur));return f},a=n(t.lignes,i.realise),c=n(l.lignes,i.objectif),u=[...new Set([...a.keys(),...c.keys()])].map(e=>({cle:e,libelle:i.libelles?.[e]??e,realise:a.get(e)??0,cible:c.get(e)??null})).sort((e,r)=>(r.cible??-1)-(e.cible??-1)||r.realise-e.realise);return s.jsx(v,{titre:i.titre,sousTitre:i.sousTitre,tableau:{entetes:["","Réalisé","Objectif","Atteinte"],lignes:u.map(e=>[e.libelle,e.realise,e.cible??"-",e.cible?`${Math.round(e.realise/e.cible*100)} %`:"-"])},children:s.jsx(x,{lignes:u})})}function T(){const{widgetOptions:i,isConfiguringWidget:t,setIsConfiguringWidget:l}=j(),o=i;return t||g(o)?s.jsx("div",{className:"viz",children:s.jsx(d,{title:"Réalisé / objectif",placeholder:E,validate:g,onDone:()=>l(!1)})}):s.jsx("div",{className:"viz",children:s.jsx(R,{config:o})})}export{T as O,R as V};
