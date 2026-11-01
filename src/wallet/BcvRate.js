const fs = require('fs');
const path = require('path');

const DEFAULT_BASE_URL = 'https://bcv.today/api/v1/history';
const DEFAULT_TIMEOUT = 15000;

/**
 * BCV USD/VES rate by calendar date, from bcv.today (unofficial; it republishes
 * bcv.org.ve and fills weekends and holidays with the last effective rate).
 *
 * Only used for the USD equivalent shown in notes, never for the record amount.
 */
class BcvRate {
  /**
   * @param {Object} [opts]
   * @param {string} [opts.cachePath] JSON file for rates already fetched
   * @param {string} [opts.baseUrl]
   * @param {Function} [opts.fetch=globalThis.fetch]
   * @param {number} [opts.timeout=15000]
   */
  constructor(opts = {}) {
    this.cachePath = opts.cachePath || '';
    this.baseUrl = opts.baseUrl || DEFAULT_BASE_URL;
    this.fetch = opts.fetch || globalThis.fetch;
    this.timeout = opts.timeout || DEFAULT_TIMEOUT;
    this.cache = this.#loadCache();
  }

  /**
   * @param {string} date YYYY-MM-DD
   * @returns {Promise<number|null>} null when no valid rate is available
   */
  async getRate(date) {
    if (this.cache[date]) return this.cache[date];

    const rate = await this.#fetchRate(date);
    if (rate === null) return null;

    this.cache[date] = rate;
    this.#saveCache();
    return rate;
  }

  async #fetchRate(date) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);
    try {
      const response = await this.fetch(`${this.baseUrl}/${date}.json`, { signal: controller.signal });
      if (!response.ok) return null;
      const body = await response.json();
      const rate = Number(body?.USD);
      return body?.date === date && Number.isFinite(rate) && rate > 0 ? rate : null;
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  #loadCache() {
    if (!this.cachePath) return {};
    try {
      return JSON.parse(fs.readFileSync(this.cachePath, 'utf8'));
    } catch {
      return {};
    }
  }

  #saveCache() {
    if (!this.cachePath) return;
    fs.mkdirSync(path.dirname(this.cachePath), { recursive: true });
    fs.writeFileSync(this.cachePath, JSON.stringify(this.cache, null, 2));
  }
}

module.exports = { BcvRate };
