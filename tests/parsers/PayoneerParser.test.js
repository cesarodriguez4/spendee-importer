
const dayjs = require('dayjs');
const { PayoneerParser } = require('../../src/parsers/PayoneerParser');
const { Categorizer } = require('../../src/core/Categorizer');
const sources = require('../../src/config/sources.json');

describe('PayoneerParser', () => {
  const categorizer = new Categorizer(
    { Software: ['GRAMMARLY'] },
    { Trabajo: ['GRAMMARLY'] },
    { Grammarly: ['GRAMMARLY'] },
  );

  const header = ['Date', 'Description', 'Amount', 'Currency', 'Status', 'Transaction ID'];
  const rawData = [
    header,
    ['06 Jun, 2026', 'Card charge (GRAMMARLY CO*SITTPIW)', '-145.44', 'USD', 'Completed', '1003901653'],
    ['04 Jun, 2026', 'Payment from Dualboot Partners LLC', '5,000.00', 'USD', 'Completed', '995164937'],
    ['03 Jun, 2026', 'Card charge (BPAY GLOBAL D)', '-1,527.00', 'USD', 'Pending', '1003070257'],
  ];

  const parser = new PayoneerParser(sources.payoneer);
  const rows = parser.parse(rawData, categorizer);

  it('keeps only Completed transactions', () => {
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.name !== 'Card charge (BPAY GLOBAL D)')).toBe(true);
  });

  it('routes negative amounts to expense', () => {
    expect(rows[0].expense).toBe(-145.44);
    expect(rows[0].income).toBeNull();
  });

  it('routes positive amounts to income and strips thousands separator', () => {
    expect(rows[1].income).toBe(5000);
    expect(rows[1].expense).toBeNull();
  });

  it('parses "DD MMM, YYYY" dates', () => {
    expect(dayjs(rows[0].date).format('YYYY-MM-DD')).toBe('2026-06-06');
  });

  it('reads currency from the CSV column', () => {
    expect(rows[0].currency).toBe('USD');
  });

  it('categorizes, tags and assigns payee by description', () => {
    expect(rows[0].category).toBe('Software');
    expect(rows[0].tags).toBe('Trabajo');
    expect(rows[0].payee).toBe('Grammarly');
  });

  it('uses category fallback "Sin Asignar" when nothing matches', () => {
    const noMatch = [
      header,
      ['02 Jun, 2026', 'Card charge (NGROK INC.)', '-10.10', 'USD', 'Completed', '1002717136'],
    ];
    const [row] = parser.parse(noMatch, categorizer);
    expect(row.category).toBe('Sin Asignar');
  });
});
