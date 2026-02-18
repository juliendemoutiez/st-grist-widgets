# CLAUDE.md

## Project Context

This is a Grist custom widget for CRM record creation.
See README.md for the full spec.

## Key decisions already made

- Vite + React + TypeScript (NOT Preact)
- UI: @openfun/cunningham-react (La Suite numérique / Cunningham)
- Grist Plugin API for reading/writing data
- Hosted on GitHub Pages
- Simple textarea for interaction content (no rich text for now)

## Data model

- Tables: Organisations, Contacts, Projets, Interactions, Utilisateurs (TBD)
- An Interaction links a Contact to a Projet
- Projet statuses: Prospect, En cours, Gagné, Perdu
- Contacts are linked to Projets only via Interactions

## UX

- Multi-screen navigation with state preservation
- Screens: ProjetForm → OrgPicker/OrgForm, InteractionForm → ContactPicker/ContactForm
- Twenty CRM-inspired UI (letter avatars, searchable pickers with "+ Ajouter Nouveau")
- ← Retour button preserves parent form state

## Current state

- Project scaffolded with Vite + React + Cunningham
- Nothing built yet — start with screen navigation and ProjetForm

## Commands

- `npm run dev` — start dev server
- `npm run build` — production build
- `npx cunningham -g` — regenerate design tokens