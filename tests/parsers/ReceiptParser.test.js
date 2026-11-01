const { ReceiptParser } = require('../../src/parsers/ReceiptParser');
const { Categorizer } = require('../../src/core/Categorizer');
const sources = require('../../src/config/sources.json');

function banesco(overrides = {}) {
  return {
    id: 'shot-1',
    kind: 'receipt',
    bank: 'banescoVE',
    status: 'success',
    direction: 'expense',
    amount: 65000,
    currency: 'VES',
    date: '2026-10-20 14:30',
    reference: '123456',
    counterparty: 'Panaderia',
    concept: 'Pago movil',
    ...overrides,
  };
}

function binance(overrides = {}) {
  return banesco({
    id: 'shot-2',
    bank: 'binancePay',
    amount: 30,
    currency: 'USDT',
    reference: 'P_TESTORDER000001',
    counterparty: 'Persona',
    concept: '',
    ...overrides,
  });
}

describe('ReceiptParser', () => {
  const parser = new ReceiptParser(sources);
  const categorizer = new Categorizer({}, {});
  const parse = (...screenshots) => parser.parse({ screenshots }, categorizer);

  it('turns a Banesco receipt into an expense in Bs', () => {
    const [row] = parse(banesco());
    expect(row.expense).toBe(-65000);
    expect(row.currency).toBe('VES');
    expect(row.walletSource).toBe('banescoVE');
    expect(row.reference).toBe('123456');
    expect(row.holdReason).toBeUndefined();
  });

  it('records Binance Pay USDT in the USD account', () => {
    const [row] = parse(binance({ direction: 'income' }));
    expect(row.income).toBe(30);
    expect(row.currency).toBe('USD');
    expect(row.walletSource).toBe('binance');
  });

  it('merges repeated captures of one receipt', () => {
    const rows = parse(banesco(), banesco({ id: 'shot-9' }));
    expect(rows).toHaveLength(1);
    expect(rows[0].origins).toEqual(['shot-1', 'shot-9']);
  });

  it('skips screenshots that are not receipts', () => {
    expect(parse({ id: 'cat', kind: 'other' })).toEqual([]);
  });

  it.each([
    ['pending', { status: 'pending' }, /status/],
    ['unclear', { status: 'unclear' }, /status/],
    ['no reference', { reference: '' }, /reference/],
    ['bad date', { date: 'ayer' }, /date/],
    ['bad amount', { amount: 'mucho' }, /amount/],
    ['zero amount', { amount: 0 }, /amount/],
    ['no direction', { direction: '' }, /direction/],
    ['wrong currency', { currency: 'USD' }, /Currency/],
    ['unknown bank', { bank: 'otro' }, /not supported/],
  ])('holds a receipt: %s', (_, overrides, reason) => {
    const [row] = parse(banesco(overrides));
    expect(row.holdReason).toMatch(reason);
  });

  it('holds other Binance Pay coins', () => {
    const [row] = parse(binance({ currency: 'BTC' }));
    expect(row.holdReason).toMatch(/Currency/);
  });

  it('does not merge receipts without a reference', () => {
    const rows = parse(banesco({ reference: '' }), banesco({ id: 'shot-9', reference: '' }));
    expect(rows).toHaveLength(2);
    expect(rows[0].identity).not.toBe(rows[1].identity);
  });
});
