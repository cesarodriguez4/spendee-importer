const { BancamigaParser } = require('../../src/parsers/BancamigaParser');
const { Categorizer } = require('../../src/core/Categorizer');
const sources = require('../../src/config/sources.json');

const schema = sources.bancamiga;

const categorizer = new Categorizer(
  { Comisiones: ['Comision'], Transferencias: ['Credito Inmediato'] },
  { Banco: ['Comision'] },
  { CORPOELEC: ['PAGO D SERV ELECTRICO'] },
);

// Shape produced by HtmlTableReader: header rows, transactions, a blank row and
// the totals row the bank appends.
const raw = [
  [''],
  ['Bancamiga Banco Universal'],
  ['Cuenta: 01720204962045899800'],
  ['Movimientos del 01/09/2026-30/09/2026'],
  ['Saldo Inicial: 54719.54'],
  ['Nro.', 'Fecha', 'Referencia', 'Concepto', 'Débito', 'Crédito', 'Saldo'],
  ['1', '04/09/26', "'93569318", 'NC Credito Inmediato', '0', '986226,89', '1040946,43'],
  ['2', '04/09/26', "'230405881258", 'Comision Solicitud Transf. Otros Bancos', '300,00', '0', '940646,43'],
  ['3', '05/09/26', "'34441107", 'Comisi�n Cr�dito Inmediato', '2640,00', '0', '58006,43'],
  ['4', '07/09/26', "'691038734", 'Consumo Masterdebit Nacional - FARMATODO CA CCS NOROESTE VEN', '26530,00', '0', '30465,71'],
  [],
  ['Creditos Total: 986226,89', 'Debito Total: 982940', 'Saldo Final: 58006,43'],
];

describe('BancamigaParser', () => {
  it('keeps only transaction rows, dropping headers, blanks and the totals row', () => {
    const rows = new BancamigaParser(schema).parse(raw, categorizer);
    expect(rows).toHaveLength(4);
    expect(rows.map((r) => r.reference)).toEqual(['93569318', '230405881258', '34441107', '691038734']);
  });

  it('parses dates as DD/MM/YY', () => {
    const [first] = new BancamigaParser(schema).parse(raw, categorizer);
    expect(first.date.slice(0, 10)).toBe('2026-09-04');
  });

  it('maps credit to positive income and debit to negative expense', () => {
    const rows = new BancamigaParser(schema).parse(raw, categorizer);
    expect(rows[0].income).toBe(986226.89);
    expect(rows[0].expense).toBeNull();
    expect(rows[1].expense).toBe(-300);
    expect(rows[1].income).toBeNull();
  });

  it('exports native bolivars when no exchange rate is given', () => {
    const [first] = new BancamigaParser(schema).parse(raw, categorizer);
    expect(first.currency).toBe('VES');
    expect(first.name).toBe('NC Credito Inmediato');
  });

  it('converts to USD and annotates the name when an exchange rate is given', () => {
    const rows = new BancamigaParser(schema, { exchangeRate: 320 }).parse(raw, categorizer);
    expect(rows[0].currency).toBe('USD');
    expect(rows[0].income).toBe(3081.96);
    expect(rows[0].name).toBe('NC Credito Inmediato $ 3081.96');
    expect(rows[1].expense).toBe(-0.94);
  });

  it('treats a blank exchange rate as absent', () => {
    for (const exchangeRate of ['', '   ', null, undefined]) {
      expect(new BancamigaParser(schema, { exchangeRate }).parse(raw, categorizer)[0].currency).toBe('VES');
    }
  });

  it('rejects a non-positive or non-numeric exchange rate', () => {
    for (const exchangeRate of [0, -1, 'abc']) {
      expect(() => new BancamigaParser(schema, { exchangeRate })).toThrow(/positive number/);
    }
  });

  it('repairs U+FFFD and strips accents so every month yields the same concept', () => {
    const rows = new BancamigaParser(schema).parse(raw, categorizer);
    const latin1 = new BancamigaParser(schema).parse(
      [['3', '05/09/26', "'34441107", 'Comisión Crédito Inmediato', '2640,00', '0', '58006,43']],
      categorizer,
    );
    expect(rows[2].name).toBe('Comision Credito Inmediato');
    expect(latin1[0].name).toBe('Comision Credito Inmediato');
  });

  it('categorizes and tags on the full concept', () => {
    const rows = new BancamigaParser(schema).parse(raw, categorizer);
    expect(rows[0].category).toBe('Transferencias');
    expect(rows[1].category).toBe('Comisiones');
    expect(rows[1].tags).toBe('Banco');
    expect(rows[3].category).toBe('Sin Asignar');
  });

  it('falls back to the merchant after the separator for the payee', () => {
    const rows = new BancamigaParser(schema).parse(raw, categorizer);
    expect(rows[3].payee).toBe('FARMATODO CA CCS NOROESTE');
    expect(rows[0].payee).toBeNull();
  });

  it('prefers an explicit payee mapping over the merchant fallback', () => {
    const [row] = new BancamigaParser(schema).parse(
      [['1', '04/09/26', "'1", 'Op. Nacional Master Debit - PAGO D SERV ELECTRICO CCS NOROESTE VEN', '100,00', '0', '0']],
      categorizer,
    );
    expect(row.payee).toBe('CORPOELEC');
  });
});
