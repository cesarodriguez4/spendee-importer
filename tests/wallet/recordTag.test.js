const { execFileSync } = require('child_process');
const path = require('path');
const { computeTag, extractTag, formatTag, tagRows } = require('../../src/wallet/recordTag');
const { Row } = require('../../src/core/Row');

describe('recordTag', () => {
  const row = new Row({ date: '2026-10-20T04:00:00.000Z', name: 'X', category: '', income: null, expense: -5 });

  it('round-trips a tag through a note', () => {
    const tag = computeTag('banesco', 'a', 0);
    expect(tag).toMatch(/^[0-9a-f]{10}$/);
    expect(extractTag(`Some note ${formatTag(tag)}`)).toBe(tag);
    expect(extractTag('Some note')).toBeNull();
  });

  it('gives identical rows different tags', () => {
    const [first, second] = tagRows([row, row], 'banesco');
    expect(first).not.toBe(second);
  });

  it('prefers the identity set by the parser', () => {
    const a = new Row({ ...row, name: 'X $ 1.00', identity: 'raw' });
    const b = new Row({ ...row, name: 'X $ 2.00', identity: 'raw' });
    expect(tagRows([a], 'banescoVE')).toEqual(tagRows([b], 'banescoVE'));
  });

  it('separates sources', () => {
    expect(tagRows([row], 'banesco')).not.toEqual(tagRows([row], 'mercantil'));
  });

  it('keeps tags stable across machine time zones', () => {
    // A statement date is parsed as local midnight, so each zone sees its own instant.
    const script = `
      const { tagRows } = require(${JSON.stringify(path.join(__dirname, '../../src/wallet/recordTag'))});
      const { parseDate } = require(${JSON.stringify(path.join(__dirname, '../../src/core/dateParser'))});
      const row = { date: parseDate('20/10/2026', 'DD/MM/YYYY', 'es'), name: 'X', income: null, expense: -5 };
      process.stdout.write(tagRows([row], 'banesco')[0]);
    `;
    const tagIn = (TZ) => execFileSync(process.execPath, ['-e', script], { env: { ...process.env, TZ } }).toString();
    const tag = tagIn('UTC');
    expect(tagIn('America/Caracas')).toBe(tag);
    expect(tagIn('Asia/Tokyo')).toBe(tag);
  });
});
