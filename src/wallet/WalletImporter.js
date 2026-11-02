const dayjs = require('dayjs');
const { WalletFormatter } = require('./WalletFormatter');
const { WalletUnknownResultError } = require('./WalletApiClient');
const { extractTag, formatTag, tagRows } = require('./recordTag');

const BATCH_SIZE = 50;
const AMOUNT_TOLERANCE = 1e-8;

const STATUS = Object.freeze({
  NEW: 'new',
  DUPLICATE: 'duplicate',
  POSSIBLE_DUPLICATE: 'possible_duplicate',
  HELD: 'held',
  INVALID: 'invalid',
  RATE_UNAVAILABLE: 'rate_unavailable',
  CREATED: 'created',
  FAILED: 'failed',
  UNKNOWN: 'unknown',
  NOT_ATTEMPTED: 'not_attempted',
});

/**
 * Decides what each parsed row should do in Wallet, then writes only the new ones.
 * plan() never writes, so re-running a file after any failure is safe.
 */
class WalletImporter {
  /**
   * @param {Object} opts
   * @param {import('./WalletApiClient').WalletApiClient} opts.client
   * @param {Object} opts.sources per-source config from sources.json
   * @param {{getRate: Function}} [opts.bcvRate] needed by sources with `usdNote`
   */
  constructor({ client, sources = {}, bcvRate = null }) {
    this.client = client;
    this.sources = sources;
    this.bcvRate = bcvRate;
  }

  /**
   * @param {Object} opts
   * @param {Array} opts.rows
   * @param {string} opts.source
   * @param {string} [opts.accountId] sends every row to this account
   * @param {string} [opts.forceCategory]
   * @param {Array<string>} [opts.accept] tags to create despite a possible duplicate
   */
  async plan({ rows, source, accountId = '', forceCategory = '', accept = [] }) {
    const [accounts, categories, labels] = await Promise.all([
      this.client.getAllAccounts(),
      this.client.getAllCategories(),
      this.client.getAllLabels(),
    ]);

    const categoryMap = WalletFormatter.buildCategoryMap(categories);
    if (forceCategory && !categoryMap[forceCategory.toLowerCase()]) {
      throw new Error(`Category "${forceCategory}" does not exist in Wallet.`);
    }

    const accountsById = new Map(accounts.map((account) => [account.id, account]));
    const tags = tagRows(rows, source);
    const items = rows.map((row, index) => this.#classify({
      row: forceCategory ? { ...row, category: forceCategory } : row,
      index,
      tag: tags[index],
      source,
      accountId,
      accountsById,
    }));

    const existing = await this.#readExisting(items);
    this.#matchTags(items, existing);
    this.#matchPossibleDuplicates(items, existing, new Set(accept));
    await this.#annotateUsd(items, source);

    const formatter = new WalletFormatter({
      categoryMap,
      labelMap: WalletFormatter.buildLabelMap(labels),
    });
    for (const item of items) {
      if (item.status !== STATUS.NEW) continue;
      const noteSuffix = [item.usdNote, formatTag(item.tag)].filter(Boolean).join(' ');
      item.payload = formatter.format(item.row, { accountId: item.accountId, noteSuffix });
    }

    return { source, items, summary: summarize(items, categoryMap) };
  }

  /**
   * Sends the plan's new rows in batches. Stops at the first response it cannot
   * trust: that batch is reported as unknown and a re-run reconciles it by tag.
   */
  async execute(plan) {
    const pending = plan.items.filter((item) => item.status === STATUS.NEW);

    for (let start = 0; start < pending.length; start += BATCH_SIZE) {
      const batch = pending.slice(start, start + BATCH_SIZE);
      try {
        const response = await this.client.createRecords(batch.map((item) => item.payload));
        applyResults(batch, response);
      } catch (err) {
        const status = err instanceof WalletUnknownResultError ? STATUS.UNKNOWN : STATUS.FAILED;
        for (const item of batch) {
          item.status = status;
          item.reason = err.message;
        }
        for (const item of pending.slice(start + BATCH_SIZE)) {
          item.status = STATUS.NOT_ATTEMPTED;
          item.reason = 'Stopped after an earlier batch failed.';
        }
        break;
      }
    }

    return { ...plan, summary: summarize(plan.items, null, plan.summary) };
  }

  #classify({ row, index, tag, source, accountId, accountsById }) {
    const item = { index, row, tag, status: STATUS.NEW };

    if (row.holdReason) return hold(item, STATUS.HELD, row.holdReason);

    const amount = WalletFormatter.amountOf(row);
    if (!amount) return hold(item, STATUS.INVALID, 'The amount is zero or unreadable.');
    if (!dayjs(row.date).isValid()) return hold(item, STATUS.INVALID, 'The date is unreadable.');

    const sourceConfig = this.sources[row.walletSource || source] || {};
    // Movements before this date are already in Wallet in a form that neither a
    // tag nor the amount can match, so importing them would count them twice.
    if (sourceConfig.walletFrom && dayjs(row.date).format('YYYY-MM-DD') < sourceConfig.walletFrom) {
      item.alreadyRecorded = true;
      return hold(item, STATUS.HELD, `Dated before ${sourceConfig.walletFrom}, already recorded in Wallet by earlier imports.`);
    }

    const targetId = accountId || sourceConfig.walletAccounts?.[row.currency];
    if (!targetId) {
      return hold(item, STATUS.INVALID, `No Wallet account is mapped for ${source} in ${row.currency || 'an unknown currency'}.`);
    }

    const account = accountsById.get(targetId);
    if (!account) return hold(item, STATUS.INVALID, `Wallet account ${targetId} does not exist.`);
    if (row.currency && account.currencyCode && account.currencyCode !== row.currency) {
      return hold(item, STATUS.INVALID, `Row is in ${row.currency} but "${account.name}" is in ${account.currencyCode}.`);
    }

    item.accountId = targetId;
    item.amount = amount;
    return item;
  }

  async #readExisting(items) {
    const byAccount = new Map();
    for (const item of items) {
      if (item.status !== STATUS.NEW) continue;
      if (!byAccount.has(item.accountId)) byAccount.set(item.accountId, []);
      byAccount.get(item.accountId).push(dayjs(item.row.date));
    }

    const existing = new Map();
    for (const [accountId, dates] of byAccount) {
      const sorted = dates.sort((a, b) => a.valueOf() - b.valueOf());
      const records = await this.client.getAllRecords({
        accountId,
        from: sorted[0].subtract(1, 'day').format('YYYY-MM-DD'),
        before: sorted[sorted.length - 1].add(2, 'day').format('YYYY-MM-DD'),
      });
      existing.set(accountId, records);
    }
    return existing;
  }

  #matchTags(items, existing) {
    const tagged = new Map();
    for (const records of existing.values()) {
      for (const record of records) {
        const tag = extractTag(record.note);
        if (tag) tagged.set(tag, record);
      }
    }

    for (const item of items) {
      if (item.status !== STATUS.NEW) continue;
      const record = tagged.get(item.tag);
      if (!record) continue;
      item.status = STATUS.DUPLICATE;
      item.match = record.id;
      record.claimed = true;
    }
  }

  // Also catches the same movement arriving through another channel, such as a
  // statement after its screenshot. Each record can only explain one row.
  #matchPossibleDuplicates(items, existing, accepted) {
    for (const item of items) {
      if (item.status !== STATUS.NEW || accepted.has(item.tag)) continue;
      const record = (existing.get(item.accountId) || []).find((candidate) => (
        !candidate.claimed && sameMovement(item, candidate)
      ));
      if (!record) continue;
      record.claimed = true;
      item.status = STATUS.POSSIBLE_DUPLICATE;
      item.match = record.id;
      item.reason = `Same amount within a day of "${record.note || record.id}".`;
    }
  }

  async #annotateUsd(items, source) {
    for (const item of items) {
      if (item.status !== STATUS.NEW || item.row.currency !== 'VES') continue;
      if (!this.sources[item.row.walletSource || source]?.usdNote) continue;

      const rate = this.bcvRate
        ? await this.bcvRate.getRate(dayjs(item.row.date).format('YYYY-MM-DD'))
        : null;
      if (!rate) {
        hold(item, STATUS.RATE_UNAVAILABLE, 'No BCV rate is available for this date yet.');
        continue;
      }
      item.usdNote = `$ ${(item.amount / rate).toFixed(2)} (BCV ${rate.toFixed(2)})`;
    }
  }
}

function hold(item, status, reason) {
  item.status = status;
  item.reason = reason;
  return item;
}

function sameMovement(item, record) {
  const value = Number(record.amount?.value);
  if (!Number.isFinite(value) || Math.abs(value - item.amount) > AMOUNT_TOLERANCE) return false;
  const days = dayjs(item.row.date).startOf('day').diff(dayjs(record.recordDate).startOf('day'), 'day');
  return Math.abs(days) <= 1;
}

function applyResults(batch, response) {
  const results = response?.results || [];
  batch.forEach((item, position) => {
    const result = results.find((r) => r.inputIndex === position);
    if (!result) {
      item.status = STATUS.UNKNOWN;
      item.reason = 'Wallet returned no result for this row.';
    } else if (result.success) {
      item.status = STATUS.CREATED;
      item.id = result.id;
    } else {
      item.status = STATUS.FAILED;
      item.reason = result.error || 'Unknown error.';
      item.errorType = result.errorType;
      item.fields = result.fields;
    }
  });
}

function summarize(items, categoryMap, previous = {}) {
  const counts = {};
  const totals = {};
  const dates = [];

  for (const item of items) {
    counts[item.status] = (counts[item.status] || 0) + 1;
    const date = dayjs(item.row.date);
    if (date.isValid()) dates.push(date.valueOf());

    const amount = WalletFormatter.amountOf(item.row);
    if (Number.isFinite(amount)) {
      const currency = item.row.currency || 'unknown';
      totals[currency] = Number(((totals[currency] || 0) + amount).toFixed(8));
    }
  }

  const unmappedCategories = categoryMap
    ? [...new Set(items
      .filter((item) => item.status === STATUS.NEW && !categoryMap[String(item.row.category || 'Unknown').toLowerCase()])
      .map((item) => item.row.category || 'Unknown'))]
    : previous.unmappedCategories;

  return {
    total: items.length,
    counts,
    totals,
    from: dates.length ? dayjs(Math.min(...dates)).format('YYYY-MM-DD') : null,
    to: dates.length ? dayjs(Math.max(...dates)).format('YYYY-MM-DD') : null,
    unmappedCategories,
  };
}

module.exports = { WalletImporter, STATUS };
