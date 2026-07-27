#!/usr/bin/env node
/**
 * Syncs the "Présence numérique des territoires" dataset from data.gouv.fr
 * into a Grist table, creating the table if needed and upserting rows by SIRET.
 *
 * Dataset: https://www.data.gouv.fr/datasets/donnees-de-la-presence-numerique-des-territoires
 *
 * Required env vars:
 *   GRIST_API_URL   Base URL of the Grist instance, e.g. https://grist.example.org
 *   GRIST_API_KEY   Grist personal API key
 *   GRIST_DOC_ID    Target document id
 *
 * Optional env vars:
 *   GRIST_TABLE_ID  Target table id (default: "Collectivites")
 *   DATASET_URL     Override the dataset resource URL (default: JSON.gz resource below)
 *
 * Usage:
 *   node --env-file=.env scripts/sync-presence-numerique.mjs
 */

import { gunzipSync } from 'node:zlib';

const DATASET_URL =
  process.env.DATASET_URL ??
  'https://www.data.gouv.fr/api/1/datasets/r/fd73a12f-572c-4b04-89e9-91cc8c6ebcb3';

const GRIST_API_URL = requireEnv('GRIST_API_URL').replace(/\/+$/, '');
const GRIST_API_KEY = requireEnv('GRIST_API_KEY');
const GRIST_DOC_ID = requireEnv('GRIST_DOC_ID');
const GRIST_TABLE_ID = process.env.GRIST_TABLE_ID ?? 'Collectivites';

const BATCH_SIZE = 500;

// Grist column id -> { type, label }. Codes (siret, siren, insee, postal...)
// are kept as Text to preserve leading zeros; only true counts are numeric.
const COLUMNS = {
  Type: { type: 'Text', label: 'Type' },
  SIRET: { type: 'Text', label: 'SIRET' },
  SIREN: { type: 'Text', label: 'SIREN' },
  Libelle: { type: 'Text', label: 'Libellé' },
  Population: { type: 'Int', label: 'Population' },
  Code_INSEE: { type: 'Text', label: 'Code INSEE' },
  Code_postal: { type: 'Text', label: 'Code postal' },
  EPCI_SIRET: { type: 'Text', label: 'EPCI SIRET' },
  Departement_Code_INSEE: { type: 'Text', label: 'Département Code INSEE' },
  Region_Code_INSEE: { type: 'Text', label: 'Région Code INSEE' },
  Adresse_e_mail: { type: 'Text', label: 'Adresse e-mail' },
  Site_internet: { type: 'Text', label: 'Site internet' },
  Telephone: { type: 'Text', label: 'Téléphone' },
  RPNT: { type: 'Text', label: 'RPNT' },
  URL_Service_Public_fr: { type: 'Text', label: 'URL Service-Public.fr' },
};

const DATASET_FIELD_BY_COLUMN = {
  SIRET: 'siret',
  SIREN: 'siren',
  Libelle: 'libelle',
  Population: 'population',
  Code_postal: 'code_postal',
  EPCI_SIRET: 'epci_siret',
  Departement_Code_INSEE: 'departement_code_insee',
  Region_Code_INSEE: 'region_code_insee',
  Adresse_e_mail: 'adresse_messagerie',
  Site_internet: 'site_internet',
  Telephone: 'telephone',
  RPNT: 'rpnt',
  URL_Service_Public_fr: 'service_public_url',
};

const UPSERT_COLUMN = 'SIRET';

// Dataset "type" values -> French display labels.
const TYPE_LABELS = {
  commune: 'Commune',
  epci: 'EPCI',
  departement: 'Département',
  region: 'Région',
};

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

async function gristRequest(path, options = {}) {
  const res = await fetch(`${GRIST_API_URL}/api/docs/${GRIST_DOC_ID}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${GRIST_API_KEY}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Grist API ${options.method ?? 'GET'} ${path} failed: ${res.status} ${body}`);
  }
  if (res.status === 204) {
    return null;
  }
  return res.json();
}

async function ensureTable() {
  const { tables } = await gristRequest('/tables');
  if (tables.some((t) => t.id === GRIST_TABLE_ID)) {
    console.log(`Table "${GRIST_TABLE_ID}" already exists, skipping creation.`);
    return;
  }
  console.log(`Creating table "${GRIST_TABLE_ID}"...`);
  await gristRequest('/tables', {
    method: 'POST',
    body: JSON.stringify({
      tables: [
        {
          id: GRIST_TABLE_ID,
          columns: Object.entries(COLUMNS).map(([id, { type, label }]) => ({
            id,
            fields: { label, type },
          })),
        },
      ],
    }),
  });
}

async function fetchDataset() {
  console.log(`Downloading dataset from ${DATASET_URL} ...`);
  const res = await fetch(DATASET_URL);
  if (!res.ok) {
    throw new Error(`Failed to download dataset: ${res.status}`);
  }
  const gzipped = Buffer.from(await res.arrayBuffer());
  const json = gunzipSync(gzipped).toString('utf-8');
  const records = JSON.parse(json);
  console.log(`Downloaded ${records.length} rows.`);
  return records;
}

// For region/departement rows, the dataset's own "code_insee" is actually
// the INSEE code of the commune hosting the entity's headquarters, not the
// region/departement's own code. Use the real administrative code instead.
function resolveCodeInsee(record) {
  if (record.type === 'region') {
    return record.region_code_insee ?? record.code_insee ?? null;
  }
  if (record.type === 'departement') {
    return record.departement_code_insee ?? record.code_insee ?? null;
  }
  return record.code_insee ?? null;
}

function toGristFields(record) {
  const fields = {};
  for (const colId of Object.keys(COLUMNS)) {
    if (colId === 'Type') {
      fields[colId] = TYPE_LABELS[record.type] ?? record.type ?? null;
      continue;
    }
    if (colId === 'Code_INSEE') {
      fields[colId] = resolveCodeInsee(record);
      continue;
    }
    const value = record[DATASET_FIELD_BY_COLUMN[colId]];
    fields[colId] = Array.isArray(value) ? value.join(', ') : (value ?? null);
  }
  return fields;
}

async function upsertBatch(records) {
  const body = {
    records: records.map((record) => ({
      require: { [UPSERT_COLUMN]: record.siret },
      fields: toGristFields(record),
    })),
  };
  await gristRequest(`/tables/${GRIST_TABLE_ID}/records?onmany=first`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

async function main() {
  await ensureTable();
  const records = await fetchDataset();

  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);
    await upsertBatch(batch);
    console.log(`Synced ${Math.min(i + BATCH_SIZE, records.length)} / ${records.length}`);
  }

  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
