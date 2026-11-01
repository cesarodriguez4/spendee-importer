const crypto = require('crypto');
const dayjs = require('dayjs');
const { WalletFormatter } = require('./WalletFormatter');

// Wallet has no external id field, so imported records carry this tag in the note.
const TAG_PATTERN = /\[si:([0-9a-f]{10})\]/;

function defaultIdentity(row) {
  return [
    dayjs(row.date).format('YYYY-MM-DD HH:mm:ss'),
    String(row.name ?? '').trim(),
    WalletFormatter.amountOf(row),
  ].join('|');
}

function computeTag(source, identity, occurrence) {
  return crypto
    .createHash('sha256')
    .update(`${source}|${identity}|${occurrence}`)
    .digest('hex')
    .slice(0, 10);
}

/**
 * One tag per row, in order. Identical rows in a file get different occurrence
 * numbers, so two equal coffees on one day stay two records.
 */
function tagRows(rows, source) {
  const seen = new Map();
  return rows.map((row) => {
    const identity = row.identity || defaultIdentity(row);
    const occurrence = seen.get(identity) || 0;
    seen.set(identity, occurrence + 1);
    return computeTag(source, identity, occurrence);
  });
}

function formatTag(tag) {
  return `[si:${tag}]`;
}

function extractTag(note) {
  const match = TAG_PATTERN.exec(String(note ?? ''));
  return match ? match[1] : null;
}

module.exports = { computeTag, defaultIdentity, extractTag, formatTag, tagRows };
