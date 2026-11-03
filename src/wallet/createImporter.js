const fs = require('fs');
const path = require('path');
const sources = require('../config/sources.json');
const { destinationsFor } = require('../services/TransactionService');
const { BcvRate } = require('./BcvRate');
const { WalletApiClient } = require('./WalletApiClient');
const { WalletImporter } = require('./WalletImporter');

const REPO_ROOT = path.join(__dirname, '..', '..');

// Board is the business version of Wallet: same API, its own token and accounts.
const TARGETS = Object.freeze({
  wallet: {
    label: 'Wallet',
    keyVar: 'WALLET_API_KEY',
    urlVar: 'WALLET_API_URL',
    defaultUrl: 'https://rest.budgetbakers.com/wallet',
    accountsVar: 'WALLET_ACCOUNTS_PATH',
    accountsFile: 'wallet-accounts.json',
  },
  board: {
    label: 'Board',
    keyVar: 'BOARD_API_KEY',
    urlVar: 'BOARD_API_URL',
    defaultUrl: 'https://rest.budgetbakers.com/board',
    accountsVar: 'BOARD_ACCOUNTS_PATH',
    accountsFile: 'board-accounts.json',
  },
});

function targetConfig(target) {
  const config = TARGETS[target];
  if (!config) throw new Error(`Unknown destination: ${target}`);
  return config;
}

// The API destination a source writes to, or null when it only goes to files.
// No source declares both, so this never has to choose.
function targetFor(source) {
  const destinations = destinationsFor(source);
  return Object.keys(TARGETS).find((target) => destinations.includes(target)) || null;
}

function readAccounts(filePath) {
  if (!fs.existsSync(filePath)) return {};
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

// Account ids stay out of git: this repo is public.
function loadAccounts(target = 'wallet', env = process.env) {
  const config = targetConfig(target);
  return readAccounts(env[config.accountsVar] || path.join(REPO_ROOT, config.accountsFile));
}

function loadWalletAccounts(filePath = process.env.WALLET_ACCOUNTS_PATH || path.join(REPO_ROOT, TARGETS.wallet.accountsFile)) {
  return readAccounts(filePath);
}

function withWalletAccounts(config, accounts) {
  const merged = { ...config };
  for (const [source, walletAccounts] of Object.entries(accounts)) {
    merged[source] = { ...merged[source], walletAccounts };
  }
  return merged;
}

function createImporter(env = process.env, { target = 'wallet' } = {}) {
  const config = targetConfig(target);
  if (!env[config.keyVar]) throw new Error(`${config.keyVar} is not set.`);
  return new WalletImporter({
    client: new WalletApiClient({
      baseUrl: env[config.urlVar] || config.defaultUrl,
      apiKey: env[config.keyVar],
      label: config.label,
    }),
    sources: withWalletAccounts(sources, loadAccounts(target, env)),
    bcvRate: new BcvRate({ cachePath: path.join(REPO_ROOT, 'state', 'bcv-rates.json') }),
    label: config.label,
  });
}

module.exports = {
  TARGETS,
  createImporter,
  loadAccounts,
  loadWalletAccounts,
  targetConfig,
  targetFor,
  withWalletAccounts,
};
