const { WalletApiClient, WalletUnknownResultError } = require('../../src/wallet/WalletApiClient');

function makeMockFetch(response) {
  let callCount = 0;
  let lastUrl = null;
  let lastOptions = null;

  const mock = async (url, options) => {
    callCount += 1;
    lastUrl = url;
    lastOptions = options;
    return {
      ok: response.ok !== false,
      status: response.status || 200,
      statusText: response.statusText || 'OK',
      text: async () => JSON.stringify(response.body ?? response),
    };
  };

  mock.calls = {
    get length() { return callCount; },
  };
  mock.lastUrl = () => lastUrl;
  mock.lastOptions = () => lastOptions;
  return mock;
}

describe('WalletApiClient', () => {
  it('throws when no API key is provided', async () => {
    const client = new WalletApiClient({ fetch: makeMockFetch({}) });
    await expect(client.getAccounts()).rejects.toThrow(/API key is required/);
  });

  it('sends an Authorization header', async () => {
    const fetchMock = makeMockFetch({ accounts: [] });
    const client = new WalletApiClient({ apiKey: 'secret', fetch: fetchMock });
    await client.getAccounts();

    expect(fetchMock.calls.length).toBe(1);
    expect(fetchMock.lastOptions().headers.Authorization).toBe('Bearer secret');
  });

  it('uses a configurable base URL', async () => {
    const fetchMock = makeMockFetch({ accounts: [] });
    const client = new WalletApiClient({
      apiKey: 'secret',
      baseUrl: 'https://wallet.test/wallet',
      fetch: fetchMock,
    });
    await client.getAccounts();

    expect(fetchMock.lastUrl()).toBe('https://wallet.test/wallet/v1/api/accounts');
  });

  it('normalizes a base URL that already includes /v1/api', async () => {
    const fetchMock = makeMockFetch({ accounts: [] });
    const client = new WalletApiClient({
      apiKey: '***',
      baseUrl: 'https://wallet.test/wallet/v1/api',
      fetch: fetchMock,
    });
    await client.getAccounts();

    expect(fetchMock.lastUrl()).toBe('https://wallet.test/wallet/v1/api/accounts');
  });

  it('returns parsed JSON on success', async () => {
    const fetchMock = makeMockFetch({ id: 'rec-1' });
    const client = new WalletApiClient({ apiKey: 'secret', fetch: fetchMock });
    const result = await client.createRecord({ amount: { value: 10 } });
    expect(result).toEqual({ id: 'rec-1' });
  });

  it('throws on non-2xx responses', async () => {
    const fetchMock = makeMockFetch({ ok: false, status: 401, statusText: 'Unauthorized', body: { message: 'bad key' } });
    const client = new WalletApiClient({ apiKey: 'secret', fetch: fetchMock });
    await expect(client.getCategories()).rejects.toThrow('Wallet API error 401: bad key');
  });

  it('lists labels', async () => {
    const fetchMock = makeMockFetch({ labels: [] });
    const client = new WalletApiClient({ apiKey: 'secret', fetch: fetchMock });
    await client.getLabels({ limit: 50 });

    expect(fetchMock.lastUrl()).toBe('https://rest.budgetbakers.com/wallet/v1/api/labels?limit=50');
  });

  it('builds query params for getRecords', async () => {
    const fetchMock = makeMockFetch({ records: [] });
    const client = new WalletApiClient({ apiKey: 'secret', fetch: fetchMock });
    await client.getRecords({ from: '2026-01-01', before: '2026-02-01', accountId: 'acc-1', limit: 10 });

    const url = fetchMock.lastUrl();
    expect(url).toBe('https://rest.budgetbakers.com/wallet/v1/api/records?limit=10&recordDate=gte.2026-01-01&recordDate=lt.2026-02-01&accountId=acc-1');
  });

  function makeSequenceFetch(responses) {
    const calls = [];
    const mock = async (url, options) => {
      calls.push({ url, options });
      const next = responses[Math.min(calls.length - 1, responses.length - 1)];
      if (next instanceof Error) throw next;
      return {
        ok: next.status >= 200 && next.status < 300,
        status: next.status,
        statusText: next.statusText || '',
        headers: { get: (name) => (next.headers || {})[name] ?? null },
        text: async () => (typeof next.body === 'string' ? next.body : JSON.stringify(next.body ?? null)),
      };
    };
    mock.calls = calls;
    return mock;
  }

  it('follows nextOffset across pages', async () => {
    const fetchMock = makeSequenceFetch([
      { status: 200, body: { records: [{ id: 'a' }], nextOffset: 200 } },
      { status: 200, body: { records: [{ id: 'b' }] } },
    ]);
    const client = new WalletApiClient({ apiKey: 'secret', fetch: fetchMock });
    const records = await client.getAllRecords({ from: '2026-01-01', before: '2026-02-01' });

    expect(records.map((r) => r.id)).toEqual(['a', 'b']);
    expect(fetchMock.calls[1].url).toContain('offset=200');
  });

  it('refuses an open-ended record listing', async () => {
    const client = new WalletApiClient({ apiKey: 'secret', fetch: makeSequenceFetch([]) });
    await expect(client.getAllRecords({ from: '2026-01-01' })).rejects.toThrow(/before/);
  });

  it('keeps per-item results from a fully failed batch', async () => {
    const body = { summary: { total: 1, succeeded: 0 }, results: [{ inputIndex: 0, success: false, error: 'bad' }] };
    const client = new WalletApiClient({ apiKey: 'secret', fetch: makeSequenceFetch([{ status: 400, body }]) });
    await expect(client.createRecords([{}])).resolves.toEqual(body);
  });

  it('keeps the status when an error body is plain text', async () => {
    const client = new WalletApiClient({
      apiKey: 'secret',
      fetch: makeSequenceFetch([{ status: 403, body: 'Forbidden: wrong surface' }]),
    });
    await expect(client.getAccounts()).rejects.toThrow('Wallet API error 403: Forbidden: wrong surface');
  });

  it('exposes init_sync_in_progress as an error code', async () => {
    const client = new WalletApiClient({
      apiKey: 'secret',
      fetch: makeSequenceFetch([{ status: 409, body: { error: 'init_sync_in_progress' } }]),
    });
    await expect(client.getAccounts()).rejects.toMatchObject({ status: 409, code: 'init_sync_in_progress' });
  });

  it('waits for Retry-After on a 429 and then retries', async () => {
    const sleep = vi.fn(async () => {});
    const fetchMock = makeSequenceFetch([
      { status: 429, headers: { 'Retry-After': '7' }, body: { error: 'rate' } },
      { status: 200, body: { accounts: [] } },
    ]);
    const client = new WalletApiClient({ apiKey: 'secret', fetch: fetchMock, sleep });
    await client.getAccounts();

    expect(sleep).toHaveBeenCalledWith(7000);
    expect(fetchMock.calls).toHaveLength(2);
  });

  it('gives up after repeated 429s', async () => {
    const fetchMock = makeSequenceFetch([{ status: 429, body: { error: 'rate' } }]);
    const client = new WalletApiClient({ apiKey: 'secret', fetch: fetchMock, sleep: async () => {} });
    await expect(client.getAccounts()).rejects.toMatchObject({ status: 429 });
    expect(fetchMock.calls).toHaveLength(4);
  });

  it('never retries a write that got no response', async () => {
    const fetchMock = makeSequenceFetch([new Error('socket hang up')]);
    const client = new WalletApiClient({ apiKey: 'secret', fetch: fetchMock });
    await expect(client.createRecords([{}])).rejects.toBeInstanceOf(WalletUnknownResultError);
    expect(fetchMock.calls).toHaveLength(1);
  });

  it('treats an unreadable success body as an unknown result', async () => {
    const client = new WalletApiClient({
      apiKey: 'secret',
      fetch: makeSequenceFetch([{ status: 200, body: '<html>' }]),
    });
    await expect(client.createRecords([{}])).rejects.toBeInstanceOf(WalletUnknownResultError);
  });

  it('deletes through the batch endpoint', async () => {
    const fetchMock = makeSequenceFetch([{ status: 200, body: { results: [] } }]);
    const client = new WalletApiClient({ apiKey: 'secret', fetch: fetchMock });
    await client.deleteRecords(['a', 'b']);

    expect(fetchMock.calls[0].url).toBe('https://rest.budgetbakers.com/wallet/v1/api/records');
    expect(fetchMock.calls[0].options.method).toBe('DELETE');
    expect(JSON.parse(fetchMock.calls[0].options.body)).toEqual({ ids: ['a', 'b'] });
  });

  it('creates records in a single batch request', async () => {
    const fetchMock = makeMockFetch({ summary: { total: 2, succeeded: 2 }, results: [{ success: true }, { success: true }] });
    const client = new WalletApiClient({ apiKey: 'secret', fetch: fetchMock });
    const result = await client.createRecords([{ amount: { value: 10 } }, { amount: { value: 20 } }]);

    expect(fetchMock.calls.length).toBe(1);
    expect(fetchMock.lastOptions().method).toBe('POST');
    expect(JSON.parse(fetchMock.lastOptions().body)).toHaveLength(2);
    expect(result.results).toHaveLength(2);
  });
});
