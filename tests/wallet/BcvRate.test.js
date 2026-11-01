const fs = require('fs');
const os = require('os');
const path = require('path');
const { BcvRate } = require('../../src/wallet/BcvRate');

function makeFetch(body, ok = true) {
  return vi.fn(async () => ({ ok, json: async () => body }));
}

describe('BcvRate', () => {
  it('reads the USD rate of a date', async () => {
    const fetch = makeFetch({ USD: 889.2553, date: '2026-11-01' });
    const rate = await new BcvRate({ fetch }).getRate('2026-11-01');

    expect(rate).toBe(889.2553);
    expect(fetch.mock.calls[0][0]).toBe('https://bcv.today/api/v1/history/2026-11-01.json');
  });

  it.each([
    ['a missing rate', { date: '2026-11-01' }],
    ['a zero rate', { USD: 0, date: '2026-11-01' }],
    ['a text rate', { USD: 'n/a', date: '2026-11-01' }],
    ['another date', { USD: 889, date: '2026-10-30' }],
  ])('returns null for %s', async (_, body) => {
    expect(await new BcvRate({ fetch: makeFetch(body) }).getRate('2026-11-01')).toBeNull();
  });

  it('returns null when the date is not published or the request fails', async () => {
    expect(await new BcvRate({ fetch: makeFetch({}, false) }).getRate('2026-11-01')).toBeNull();
    const failing = vi.fn(async () => { throw new Error('down'); });
    expect(await new BcvRate({ fetch: failing }).getRate('2026-11-01')).toBeNull();
  });

  it('caches rates on disk', async () => {
    const cachePath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'bcv-')), 'nested', 'rates.json');
    await new BcvRate({ cachePath, fetch: makeFetch({ USD: 889, date: '2026-11-01' }) }).getRate('2026-11-01');

    const fetch = makeFetch({});
    expect(await new BcvRate({ cachePath, fetch }).getRate('2026-11-01')).toBe(889);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('does not cache a failure', async () => {
    const cachePath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'bcv-')), 'rates.json');
    await new BcvRate({ cachePath, fetch: makeFetch({}, false) }).getRate('2026-11-01');

    const fetch = makeFetch({ USD: 889, date: '2026-11-01' });
    expect(await new BcvRate({ cachePath, fetch }).getRate('2026-11-01')).toBe(889);
  });
});
