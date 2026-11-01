
const { BanescoVEParser } = require('../../src/parsers/BanescoVEParser');
const { Categorizer } = require('../../src/core/Categorizer');
const sources = require('../../src/config/sources.json');

describe('BanescoVEParser', () => {
  const categorizer = new Categorizer({}, {});

  it('keeps the amounts in Bs when no exchange rate is provided', () => {
    const parser = new BanescoVEParser(sources.banescoVE);
    const [row] = parser.parse([
      ['header', '', '', ''],
      ['2025/03/15', '', 'PANADERIA', '-65.000,00'],
    ], categorizer);
    expect(row.expense).toBe(-65000);
    expect(row.currency).toBe('VES');
    expect(row.name).toBe('PANADERIA');
  });

  it('builds the same identity whatever the exchange rate', () => {
    const raw = [
      ['header', '', '', ''],
      ['2025/03/15', '', 'PANADERIA', '-65.000,00'],
    ];
    const identityAt = (rate) => new BanescoVEParser(sources.banescoVE, rate).parse(raw, categorizer)[0].identity;
    expect(identityAt(650)).toBe(identityAt(700));
    expect(identityAt(650)).toBe(identityAt(undefined));
  });

  it('throws if the exchange rate is zero or negative', () => {
    expect(() => new BanescoVEParser(sources.banescoVE, 0)).toThrow(/exchange rate/i);
    expect(() => new BanescoVEParser(sources.banescoVE, -650)).toThrow(/exchange rate/i);
  });

  it('converts Bs amounts to USD using the exchange rate', () => {
    const parser = new BanescoVEParser(sources.banescoVE, 650);
    const raw = [
      ['header', '', '', ''],
      ['2025/03/15', '', 'PANADERIA', '-65.000,00'],
    ];
    const [row] = parser.parse(raw, categorizer);
    expect(row.expense).toBeCloseTo(-100, 2);
    expect(row.name).toContain('$');
    expect(row.name).toContain('-100.00');
  });
});
