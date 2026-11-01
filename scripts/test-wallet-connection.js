#!/usr/bin/env node

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { WalletApiClient } = require('../src/wallet');

async function main() {
  const apiKey = process.env.WALLET_API_KEY;
  const baseUrl = process.env.WALLET_API_URL;

  if (!apiKey) {
    console.error('WALLET_API_KEY no está configurada.');
    process.exit(1);
  }

  const client = new WalletApiClient({ apiKey, baseUrl });

  console.log('Probando conexión con Wallet API...');
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
