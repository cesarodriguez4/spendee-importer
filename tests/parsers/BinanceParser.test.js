
const { BinanceParser } = require('../../src/parsers/BinanceParser');
const { Categorizer } = require('../../src/core/Categorizer');
const sources = require('../../src/config/sources.json');

describe('BinanceParser', () => {
  const categorizer = new Categorizer({}, {});
  const parser = new BinanceParser(sources.binance);

  it('filters out excluded operations', () => {
    const raw = [
      ['u', '2025-03-15 10:00:00', 'Spot', 'Deposit', 'USDT', '50', 'note'],
      ['u', '2025-03-15 11:00:00', 'Spot', 'Sell', 'USDT', '-25', 'note'],
    ];
    const rows = parser.parse(raw, categorizer);
    expect(rows).toHaveLength(1);
    expect(rows[0].expense).toBe(-25);
  });

  it('filters out non-allowed coins', () => {
    const raw = [
      ['u', '2025-03-15 10:00:00', 'Spot', 'Sell', 'BTC', '0.001', 'note'],
    ];
    expect(parser.parse(raw, categorizer)).toHaveLength(0);
  });
});
