
const { MercantilParser } = require('../../src/parsers/MercantilParser');
const { Categorizer } = require('../../src/core/Categorizer');
const sources = require('../../src/config/sources.json');

describe('MercantilParser', () => {
  const categorizer = new Categorizer({ Comida: ['KROMI'] }, {});
  const parser = new MercantilParser(sources.mercantil);

  it('skips header rows and produces Rows with expense/income columns intact', () => {
    const raw = [
      ['h1'], ['h2'],
      ['15/Mar/2025', 'KROMI', '', -50, ''],
      ['16/Mar/2025', 'Salario', '', '', 1000],
    ];
    const rows = parser.parse(raw, categorizer);
    expect(rows).toHaveLength(2);
    expect(rows[0].name).toBe('KROMI');
    expect(rows[0].category).toBe('Comida');
    expect(rows[0].expense).toBe(-50);
    expect(rows[1].income).toBe(1000);
  });
});
