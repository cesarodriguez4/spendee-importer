/**
 * HTTP client for Wallet by Budget Bakers REST API.
 *
 * Docs: https://rest.budgetbakers.com/wallet/reference
 * Spec: https://rest.budgetbakers.com/wallet/openapi
 */

const PAGE_SIZE = 200;
const MAX_RATE_LIMIT_RETRIES = 3;
const DEFAULT_RETRY_AFTER_SECONDS = 60;

class WalletApiError extends Error {
  constructor(message, { status, code, body } = {}) {
    super(message);
    this.name = 'WalletApiError';
    this.status = status;
    this.code = code;
    this.body = body;
  }
}

// The request may or may not have been applied: a timeout, a dropped connection
// or an unreadable success body. Never retry a write blindly after this one.
class WalletUnknownResultError extends Error {
  constructor(message) {
    super(message);
    this.name = 'WalletUnknownResultError';
  }
}

class WalletApiClient {
  /**
   * @param {Object} opts
   * @param {string} [opts.baseUrl='https://rest.budgetbakers.com/wallet']
   * @param {string} [opts.apiKey]
   * @param {number} [opts.timeout=30000]
   * @param {Function} [opts.fetch=globalThis.fetch]
   * @param {Function} [opts.sleep] waits between rate-limit retries
   */
  constructor(opts = {}) {
    this.baseUrl = (opts.baseUrl || 'https://rest.budgetbakers.com/wallet')
      .replace(/\/+$/, '')
      .replace(/\/v1\/api$/, '');
    this.apiKey = opts.apiKey || '';
    this.timeout = opts.timeout || 30000;
    this.fetch = opts.fetch || globalThis.fetch;
    this.sleep = opts.sleep || ((ms) => new Promise((resolve) => { setTimeout(resolve, ms); }));
  }

  /**
   * Low-level request helper.
   *
   * @param {string} path
   * @param {Object} [options] fetch options, plus `batch: true` for write
   *   endpoints whose 400/500 responses still carry per-item results.
   */
  async request(path, options = {}) {
    if (!this.apiKey) {
      throw new Error('Wallet API key is required. Set WALLET_API_KEY env var.');
    }

    const { batch, ...fetchOptions } = options;

    for (let attempt = 0; ; attempt += 1) {
      const { response, text } = await this.#send(path, fetchOptions);

      // A 429 is rejected before processing, so it is safe to retry even a write.
      if (response.status === 429 && attempt < MAX_RATE_LIMIT_RETRIES) {
        const retryAfter = Number(response.headers?.get?.('Retry-After')) || DEFAULT_RETRY_AFTER_SECONDS;
        await this.sleep(retryAfter * 1000);
        continue;
      }

      return this.#parse(response, text, batch);
    }
  }

  /**
   * List accounts (wallets/cards).
   */
  async getAccounts(opts = {}) {
    const query = this.#buildPaginationQuery(opts);
    return this.request(`/v1/api/accounts${query}`);
  }

  async getAllAccounts() {
    return this.#listAll('accounts', () => '/v1/api/accounts');
  }

  /**
   * List categories.
   */
  async getCategories(opts = {}) {
    const query = this.#buildPaginationQuery(opts);
    return this.request(`/v1/api/categories${query}`);
  }

  async getAllCategories() {
    return this.#listAll('categories', () => '/v1/api/categories');
  }

  /**
   * List labels.
   */
  async getLabels(opts = {}) {
    const query = this.#buildPaginationQuery(opts);
    return this.request(`/v1/api/labels${query}`);
  }

  async getAllLabels() {
    return this.#listAll('labels', () => '/v1/api/labels');
  }

  /**
   * List records (transactions).
   *
   * Without `from` or `before` the API silently applies a 3-month window.
   *
   * @param {Object} opts
   * @param {string} [opts.from] inclusive date filter (YYYY-MM-DD or ISO)
   * @param {string} [opts.before] exclusive date filter
   * @param {string} [opts.accountId]
   * @param {string} [opts.categoryId]
   * @param {number} [opts.limit=30]
   * @param {number} [opts.offset=0]
   */
  async getRecords(opts = {}) {
    const params = this.#buildPaginationParams(opts);
    if (opts.from) params.append('recordDate', `gte.${opts.from}`);
    if (opts.before) params.append('recordDate', `lt.${opts.before}`);
    if (opts.accountId) params.append('accountId', opts.accountId);
    if (opts.categoryId) params.append('categoryId', opts.categoryId);

    const query = params.toString() ? `?${params.toString()}` : '';
    return this.request(`/v1/api/records${query}`);
  }

  /**
   * Every record in a date range. `from` and `before` are required so the
   * default 3-month window can never silently truncate the result.
   */
  async getAllRecords(opts) {
    if (!opts.from || !opts.before) {
      throw new Error('getAllRecords requires both "from" and "before".');
    }
    return this.#collect('records', ({ limit, offset }) => this.getRecords({ ...opts, limit, offset }));
  }

  /**
   * Create a single record.
   *
   * The POST /v1/api/records endpoint accepts an array of records; this helper
   * sends an array with one item and returns that item's result.
   */
  async createRecord(record) {
    const response = await this.createRecords([record]);
    const results = response.results || [];
    return results[0] || response;
  }

  /**
   * Create up to 50 records in a single batch request. Batches are not atomic.
   * 200, 207, 400 and 500 all resolve with the per-item results.
   *
   * @param {Array<Object>} records
   * @returns {Promise<{summary: Object, results: Array}>}
   */
  async createRecords(records) {
    return this.request('/v1/api/records?returnData=false', {
      method: 'POST',
      body: JSON.stringify(records),
      batch: true,
    });
  }

  /**
   * Delete up to 10 records by id. Paired transfers need both ids in one call.
   */
  async deleteRecords(ids) {
    return this.request('/v1/api/records', {
      method: 'DELETE',
      body: JSON.stringify({ ids }),
      batch: true,
    });
  }

  async #send(path, options) {
    const url = `${this.baseUrl}${path}`;
    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.apiKey}`,
      ...(options.headers || {}),
    };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await this.fetch(url, {
        ...options,
        headers,
        signal: controller.signal,
      });
      return { response, text: await response.text() };
    } catch (err) {
      const reason = err.name === 'AbortError' ? `timed out after ${this.timeout}ms` : err.message;
      throw new WalletUnknownResultError(`Wallet API request got no response: ${reason}`);
    } finally {
      clearTimeout(timer);
    }
  }

  #parse(response, text, batch) {
    let body = null;
    let unreadable = false;
    if (text) {
      try {
        body = JSON.parse(text);
      } catch {
        // Some errors (e.g. 403) are text/plain; don't let that hide the status.
        unreadable = true;
      }
    }

    if (response.ok) {
      if (unreadable) {
        throw new WalletUnknownResultError(`Wallet API returned an unreadable ${response.status} response`);
      }
      return body;
    }

    if (batch && Array.isArray(body?.results)) return body;

    const message = body?.message || body?.error || (unreadable && text) || response.statusText;
    throw new WalletApiError(`Wallet API error ${response.status}: ${message}`, {
      status: response.status,
      code: body?.error || body?.code,
      body,
    });
  }

  async #listAll(key, pathFor) {
    return this.#collect(key, ({ limit, offset }) => {
      const query = this.#buildPaginationQuery({ limit, offset });
      return this.request(`${pathFor()}${query}`);
    });
  }

  async #collect(key, fetchPage) {
    const items = [];
    let offset = 0;
    for (;;) {
      const page = await fetchPage({ limit: PAGE_SIZE, offset });
      items.push(...(page?.[key] || []));
      if (page?.nextOffset === undefined || page?.nextOffset === null) return items;
      offset = page.nextOffset;
    }
  }

  #buildPaginationQuery(opts) {
    const params = this.#buildPaginationParams(opts);
    return params.toString() ? `?${params.toString()}` : '';
  }

  #buildPaginationParams(opts) {
    const params = new URLSearchParams();
    if (opts.limit) params.append('limit', String(opts.limit));
    if (opts.offset) params.append('offset', String(opts.offset));
    return params;
  }
}

module.exports = { WalletApiClient, WalletApiError, WalletUnknownResultError };
