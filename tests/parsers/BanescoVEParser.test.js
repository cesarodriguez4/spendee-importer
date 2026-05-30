
const { BanescoVEParser } = require('../../src/parsers/BanescoVEParser');
const { Categorizer } = require('../../src/core/Categorizer');
const sources = require('../../src/config/sources.json');

describe('BanescoVEParser', () => {
  const categorizer = new Categorizer({}, {});

  it('throws if no exchange rate is provided', () => {
    expect(() => new BanescoVEParser(sources.banescoVE)).toThrow(/exchange rate/i);
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
