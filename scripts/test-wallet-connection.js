#!/usr/bin/env node

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { WalletApiClient } = require('../src/wallet');
const { targetConfig } = require('../src/wallet/createImporter');

// Usage: node scripts/test-wallet-connection.js [--target=wallet|board]
async function main() {
  const flag = process.argv.find((arg) => arg.startsWith('--target='));
  const config = targetConfig(flag ? flag.slice('--target='.length) : 'wallet');
  const apiKey = process.env[config.keyVar];
  const baseUrl = process.env[config.urlVar] || config.defaultUrl;

  if (!apiKey) {
    console.error(`${config.keyVar} no está configurada.`);
    process.exit(1);
  }

  const client = new WalletApiClient({ apiKey, baseUrl, label: config.label });

  console.log(`Probando conexión con ${config.label} API...`);
  console.log('URL base:', client.baseUrl);

  async function probe(label, url) {
    console.log(`\n${label}...`);
    try {
      const response = await client.fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
      });
      const text = await response.text();
      console.log('Status:', response.status, response.statusText);
      console.log('Raw:', text.slice(0, 500));
      try {
        const json = JSON.parse(text);
        console.log('✅ JSON:', JSON.stringify(json, null, 2).slice(0, 500));
      } catch {
        console.log('⚠️ No es JSON válido');
      }
    } catch (err) {
      console.error('❌ Error:', err.message);
    }
  }

  await probe('1. Obteniendo cuentas', `${client.baseUrl}/v1/api/accounts?limit=5`);
  await probe('2. Obteniendo categorías', `${client.baseUrl}/v1/api/categories?limit=5`);
  await probe('3. Obteniendo registros', `${client.baseUrl}/v1/api/records?limit=3`);
}

main().catch((err) => {
  console.error('Error inesperado:', err.message);
  if (process.env.DEBUG) console.error(err.stack);
  process.exit(1);
});
