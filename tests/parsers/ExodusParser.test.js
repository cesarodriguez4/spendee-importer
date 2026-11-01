const { ExodusParser } = require('../../src/parsers/ExodusParser');
const sources = require('../../src/config/sources.json');
const { WalletFormatter } = require('../../src/wallet/WalletFormatter');

function raw({ date = '2026-10-20 10:00:00', out = '', outCurrency = 'BTC', inAmount = '', inCurrency = '', wallet = 'w1' }) {
  const row = new Array(17).fill('');
  row[0] = date;
  row[2] = wallet;
  row[4] = out;
  row[5] = outCurrency;
  row[10] = 'https://tx/1';
  row[11] = inAmount;
  row[12] = inCurrency;
  return row;
}

describe('ExodusParser', () => {
  it('stamps the wallet currency on each row', () => {
    const parser = new ExodusParser(sources.exodus, { currency: 'BTC', wallet: 'w1' });
    const [row] = parser.parse([raw({ out: '-0.5' })]);
    expect(row.currency).toBe('BTC');
  });

  it('reads an outflow with a blank income cell as an expense', () => {
    const parser = new ExodusParser(sources.exodus, { currency: 'BTC', wallet: 'w1' });
    const [row] = parser.parse([raw({ out: '-0.5' })]);
    expect(WalletFormatter.amountOf(row)).toBe(-0.5);
  });

  it('keeps every date when no range is given', () => {
    const parser = new ExodusParser(sources.exodus, { currency: 'BTC', wallet: 'w1' });
    expect(parser.parse([raw({ out: '-1', date: '2020-01-01 00:00:00' })])).toHaveLength(1);
  });

  it('applies a date range when given', () => {
    const parser = new ExodusParser(sources.exodus, {
      currency: 'BTC', wallet: 'w1', startDate: '2026-10-01', endDate: '2026-10-31',
    });
    expect(parser.parse([raw({ out: '-1', date: '2020-01-01 00:00:00' })])).toHaveLength(0);
  });
});
