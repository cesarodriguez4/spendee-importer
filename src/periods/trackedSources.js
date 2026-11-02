const { SOURCES_META, destinationsFor } = require('../services/TransactionService');
const { loadWalletAccounts } = require('../wallet/createImporter');

/**
 * The sources worth showing in the control: those with a Wallet account, plus
 * those that go elsewhere. A source that can't reach any destination yet is left
 * out so it doesn't read as permanently behind.
 */
function trackedSources(accounts = loadWalletAccounts()) {
  return SOURCES_META
    .map((meta) => ({ id: meta.id, label: meta.label, destinations: destinationsFor(meta.id) }))
    .filter((source) => accounts[source.id] || !source.destinations.includes('wallet'));
}

module.exports = { trackedSources };
