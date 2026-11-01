const dayjs = require('dayjs');

const MAX_TEXT_LENGTH = 255;

/**
 * Converts internal Row objects into Wallet API record payloads.
 *
 * Docs: https://rest.budgetbakers.com/wallet/reference
 */
class WalletFormatter {
  /**
   * @param {Object} [opts]
   * @param {string} [opts.accountId]
   * @param {Object} [opts.categoryMap] map of lowercase category name -> categoryId
   * @param {Object} [opts.labelMap] map of lowercase label name -> labelId
   */
  constructor(opts = {}) {
    this.accountId = opts.accountId || '';
    this.categoryMap = opts.categoryMap || {};
    this.labelMap = opts.labelMap || {};
  }

  /**
   * @param {import('../core/Row').Row} row
   * @param {Object} [opts]
   * @param {string} [opts.accountId] overrides the formatter's account
   * @param {string} [opts.noteSuffix] kept whole when the note has to be truncated
   * @returns {Object}
   */
  format(row, opts = {}) {
    const recordDate = typeof row.date === 'string' && row.date.includes('T')
      ? row.date
      : dayjs(row.date).toISOString();

    const categoryName = row.category || 'Unknown';
    const categoryId = this.categoryMap[categoryName.toLowerCase()];
    const accountId = opts.accountId || this.accountId;

    const payload = {
      recordDate,
      amount: { value: WalletFormatter.amountOf(row) },
      note: WalletFormatter.buildNote(row.name, opts.noteSuffix),
      counterParty: String(row.payee || '').slice(0, MAX_TEXT_LENGTH),
      labelIds: this.#mapLabels(row.tags),
    };

    // The API rejects a currency that differs from the account's, which turns a
    // wrong mapping into an error instead of Bs recorded as USD.
    if (row.currency) {
      payload.amount.currencyCode = row.currency;
    }

    if (categoryId) {
      payload.categoryId = categoryId;
    }

    if (accountId) {
      payload.accountId = accountId;
    }

    return payload;
  }

  formatMany(rows) {
    return rows.map((row) => this.format(row));
  }

  /**
   * Signed amount of a row: income positive, expense negative. Parsers may leave
   * a 0 on the unused side, so the first non-zero side wins. Returns 0 when there
   * is no amount and NaN when a value is unreadable; the API accepts neither.
   */
  static amountOf(row) {
    let unreadable = false;
    const sides = [[row.income, 1], [row.expense, -1]];
    for (const [raw, sign] of sides) {
      if (raw === null || raw === undefined || raw === '') continue;
      const value = Number(raw);
      if (Number.isNaN(value)) unreadable = true;
      else if (value !== 0) return sign * Math.abs(value);
    }
    return unreadable ? NaN : 0;
  }

  /**
   * The note limit is 255 characters; only the description gets truncated.
   */
  static buildNote(name, suffix = '') {
    const description = String(name ?? '').trim();
    if (!suffix) return description.slice(0, MAX_TEXT_LENGTH);
    const room = MAX_TEXT_LENGTH - suffix.length - 1;
    return `${description.slice(0, Math.max(room, 0)).trim()} ${suffix}`.trim();
  }

  /**
   * Build a category map from Wallet's category list response.
   * @param {Array<{id: string, name: string}>|{categories?: Array<{id: string, name: string}>}} categories
   * @returns {Object}
   */
  static buildCategoryMap(categories) {
    const list = Array.isArray(categories)
      ? categories
      : (categories && categories.categories) || [];
    const map = {};
    for (const cat of list) {
      if (cat.name) {
        map[String(cat.name).toLowerCase()] = cat.id;
      }
    }
    return map;
  }

  /**
   * Build a label map from Wallet's label list response.
   * @param {Array<{id: string, name: string}>|{labels?: Array<{id: string, name: string}>}} labels
   * @returns {Object}
   */
  static buildLabelMap(labels) {
    const list = Array.isArray(labels)
      ? labels
      : (labels && labels.labels) || [];
    const map = {};
    for (const label of list) {
      if (label.name) {
        map[String(label.name).toLowerCase()] = label.id;
      }
    }
    return map;
  }

  #mapLabels(tags) {
    if (!tags) return [];
    const names = String(tags)
      .split(/[,;]/)
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);

    const ids = [];
    for (const name of names) {
      if (this.labelMap[name]) {
        ids.push(this.labelMap[name]);
      }
    }
    return ids;
  }
}

module.exports = { WalletFormatter };
