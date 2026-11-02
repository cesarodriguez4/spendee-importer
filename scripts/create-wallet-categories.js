#!/usr/bin/env node

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { WalletApiClient } = require('../src/wallet');

const CATEGORIES_TO_CREATE = [
  { name: 'Sin Asignar', parentName: 'Others' },
  { name: 'Transferencias', parentName: 'Others' },
  { name: 'Comida para la casa', parentName: 'Comida', preferredGroup: 'food_and_drinks' },
  { name: 'Other', parentName: 'Others' },
];

async function main() {
  const apiKey = process.env.WALLET_API_KEY;
  const baseUrl = process.env.WALLET_API_URL;

  if (!apiKey) {
    console.error('❌ WALLET_API_KEY no está configurada.');
    process.exit(1);
  }

  const client = new WalletApiClient({ apiKey, baseUrl });

  console.log('Obteniendo categorías existentes...');
  const existingCategories = await client.getAllCategories();
  console.log(`Total de categorías existentes: ${existingCategories.length}`);

  const existingByNameLower = new Map(
    existingCategories.map((cat) => [cat.name.toLowerCase(), cat])
  );

  const parentsByName = new Map();
  for (const cat of existingCategories) {
    if (cat.customCategory) continue;
    const list = parentsByName.get(cat.name) || [];
    list.push(cat);
    parentsByName.set(cat.name, list);
  }

  function pickParent(name, preferredGroup) {
    const list = parentsByName.get(name);
    if (!list) return undefined;
    if (preferredGroup) {
      const match = list.find((cat) => cat.group?.id === preferredGroup || cat.group === preferredGroup);
      if (match) return match;
    }
    return list[0];
  }

  const results = {
    existed: [],
    created: [],
    errors: [],
  };

  for (const { name, parentName, preferredGroup } of CATEGORIES_TO_CREATE) {
    const existing = existingByNameLower.get(name.toLowerCase());
    if (existing) {
      results.existed.push({ name, id: existing.id });
      console.log(`⚠️ Ya existe: "${name}" (id: ${existing.id})`);
      continue;
    }

    const parent = pickParent(parentName, preferredGroup);
    if (!parent) {
      results.errors.push({ name, error: `No se encontró la categoría padre "${parentName}"` });
      console.error(`❌ No se encontró categoría padre "${parentName}" para "${name}"`);
      continue;
    }

    const payload = {
      name,
      parentId: parent.id,
      color: parent.color ? normalizeColor(parent.color) : undefined,
      cardinality: parent.cardinality || 'need',
    };

    try {
      console.log(`Creando "${name}" bajo "${parentName}"...`);
      await client.request('/v1/api/categories/custom', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      // The API returns 201 with an empty body, so re-fetch to get the id.
      const fresh = (await client.getAllCategories()).find(
        (cat) => cat.name.toLowerCase() === name.toLowerCase()
      );
      results.created.push({ name, id: fresh?.id, parentId: parent.id });
      console.log(`✅ Creada: "${name}" (id: ${fresh?.id})`);
    } catch (err) {
      results.errors.push({ name, error: err.message, status: err.status });
      console.error(`❌ Error creando "${name}": ${err.message}`);
    }
  }

  console.log('\n--- Resumen ---');
  console.log(`Ya existían: ${results.existed.length}`);
  for (const item of results.existed) console.log(`  - ${item.name} (${item.id})`);
  console.log(`Creadas: ${results.created.length}`);
  for (const item of results.created) console.log(`  - ${item.name} (${item.id})`);
  console.log(`Errores: ${results.errors.length}`);
  for (const item of results.errors) console.log(`  - ${item.name}: ${item.error}`);
}

function normalizeColor(color) {
  // The API expects named colors; if the parent has a hex, pick a reasonable default.
  const namedColors = [
    'Blue', 'Charcoal', 'CoffeeBrown', 'DarkPurple', 'Green', 'LightBlue',
    'Lime', 'Orange', 'PineGreen', 'Pink', 'Purple', 'Red', 'Stone',
    'Turquoise', 'Wine', 'Yellow',
  ];
  if (namedColors.includes(color)) return color;
  return 'Stone';
}

main().catch((err) => {
  console.error('Error inesperado:', err.message);
  if (process.env.DEBUG) console.error(err.stack);
  process.exit(1);
});
