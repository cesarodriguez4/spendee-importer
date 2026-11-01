const fs = require('fs');
const path = require('path');
const sources = require('../config/sources.json');
const { BcvRate } = require('./BcvRate');
const { WalletApiClient } = require('./WalletApiClient');
const { WalletImporter } = require('./WalletImporter');

const REPO_ROOT = path.join(__dirname, '..', '..');
const ACCOUNTS_PATH = path.join(REPO_ROOT, 'wallet-accounts.json');

// Account ids stay out of git: this repo is public.
function loadWalletAccounts(filePath = ACCOUNTS_PATH) {
  if (!fs.existsSync(filePath)) return {};
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function withWalletAccounts(config, accounts) {
  const merged = { ...config };
  for (const [source, walletAccounts] of Object.entries(accounts)) {
    merged[source] = { ...merged[source], walletAccounts };
  }
  return merged;
}

function createImporter(env = process.env) {
  if (!env.WALLET_API_KEY) throw new Error('WALLET_API_KEY is not set.');
  return new WalletImporter({
    client: new WalletApiClient({ baseUrl: env.WALLET_API_URL, apiKey: env.WALLET_API_KEY }),
    sources: withWalletAccounts(sources, loadWalletAccounts()),
    bcvRate: new BcvRate({ cachePath: path.join(REPO_ROOT, 'state', 'bcv-rates.json') }),
  });
}

module.exports = { createImporter, loadWalletAccounts, withWalletAccounts };
