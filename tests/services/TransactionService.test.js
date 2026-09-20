const { getRows, journalFor } = require('../../src/services/TransactionService');
const { Row } = require('../../src/core/Row');
const sources = require('../../src/config/sources.json');

const html = `<table>
  <tr><td>Nro.</td><td>Fecha</td><td>Referencia</td><td>Concepto</td><td>D&eacute;bito</td><td>Cr&eacute;dito</td><td>Saldo</td></tr>
  <tr><td>1</td><td>04/09/26</td><td>'93569318</td><td>NC Credito Inmediato</td><td>0</td><td>986226,89</td><td>1040946,43</td></tr>
  <tr><td>2</td><td>04/09/26</td><td>'230405881258</td><td>Comision Solicitud Transf. Otros Bancos</td><td>300,00</td><td>0</td><td>940646,43</td></tr>
</table>`;

describe('journalFor', () => {
  it('returns the journal configured for the source', () => {
    expect(journalFor('bancamiga')).toBe(sources.bancamiga.journal);
    expect(journalFor('bancamiga')).toBe('Bancamiga Banco Universal C.A');
  });

  it('returns an empty string for sources without a journal', () => {
    expect(journalFor('mercantil')).toBe('');
  });

  it('does not throw for registry-only sources missing from sources.json', () => {
    expect(journalFor('spendee')).toBe('');
  });
});

describe('getRows journal stamping', () => {
  it('stamps the journal on every parsed row', () => {
    const rows = getRows({ buffer: Buffer.from(html), source: 'bancamiga', options: {} });
    expect(rows).toHaveLength(2);
    for (const row of rows) expect(row.journal).toBe('Bancamiga Banco Universal C.A');
  });

  it('survives the JSON round-trip the UI export depends on', () => {
    const [first] = getRows({ buffer: Buffer.from(html), source: 'bancamiga', options: {} });
    const plain = JSON.parse(JSON.stringify({ ...first }));
    expect(Row.odooArrayFromPlain(plain)[5]).toBe('Bancamiga Banco Universal C.A');
  });
});
