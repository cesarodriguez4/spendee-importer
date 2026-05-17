
const { BanescoParser } = require('../../src/parsers/BanescoParser');
const { Categorizer } = require('../../src/core/Categorizer');
const sources = require('../../src/config/sources.json');

describe('BanescoParser', () => {
  const categorizer = new Categorizer(
    { Comida: ['KROMI'] },
    { Mercado: ['KROMI'] },
  );

  const headerPadding = Array(sources.banesco.headerRows).fill(['header']);
  const rawData = [
    ...headerPadding,
    ['', '15/03/2025', 'KROMI Mercado', '-100.50'],
    ['', '16/03/2025', 'Salario ACH', '1,500.00'],
  ];

  const parser = new BanescoParser(sources.banesco);
  const rows = parser.parse(rawData, categorizer);

  it('produces one Row per data row', () => {
    expect(rows).toHaveLength(2);
  });

  it('routes negative amounts to expense', () => {
    expect(rows[0].expense).toBe(-100.5);
    expect(rows[0].income).toBeNull();
  });

  it('routes positive amounts to income', () => {
    expect(rows[1].income).toBe(1500);
    expect(rows[1].expense).toBeNull();
  });

  it('categorizes by description', () => {
    expect(rows[0].category).toBe('Comida');
    expect(rows[0].tags).toBe('Mercado');
  });

  it('uses category fallback "Padres" when nothing matches', () => {
    const noMatch = [
      ...headerPadding,
      ['', '17/03/2025', 'Pago de luz', '-50.00'],
    ];
    const [row] = parser.parse(noMatch, categorizer);
    expect(row.category).toBe('Padres');
    expect(row.tags).toBe('Padres');
  });
});
