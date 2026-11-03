const { SOURCES_META, destinationsFor } = require('../services/TransactionService');
const { TARGETS, loadAccounts } = require('../wallet/createImporter');

function loadAllAccounts() {
  return Object.fromEntries(Object.keys(TARGETS).map((target) => [target, loadAccounts(target)]));
}

/**
 * The sources worth showing in the control, each with the destinations it can
 * actually reach: Wallet or Board once the source has an account there, files
 * like Odoo always. A destination that can't be reached yet is left out so it
 * doesn't read as permanently behind.
 *
 * @param {Object} [accounts] account map per API destination, e.g. { wallet: {...}, board: {...} }
 */
function trackedSources(accounts = loadAllAccounts()) {
  return SOURCES_META
    .map((meta) => ({
      id: meta.id,
      label: meta.label,
      destinations: destinationsFor(meta.id).filter((dest) => !TARGETS[dest] || accounts[dest]?.[meta.id]),
    }))
    .filter((source) => source.destinations.length);
}

module.exports = { trackedSources };
