const xlsx = require('node-xlsx');
const { detectSource, expandOptions, getRows } = require('../../src/services/TransactionService');
const sources = require('../../src/config/sources.json');

function sheet(rows) {
  return Buffer.from(xlsx.build([{ name: 'Sheet', data: rows }]));
}

const banescoPanama = () => sheet([
  ...Array.from({ length: 8 }, () => ['cabecera']),
  ['', '26/10/2026', 'COMPRA', -8.35, 15641.96],
  ['', '25/10/2026', 'PAGO', '-1,250.50', 14391.46],
]);

const banescoVenezuela = () => sheet([
  ['Fecha', 'Ref', 'Concepto', 'Monto'],
  ['2026/10/20', '', 'PANADERIA', '-65.000,00'],
]);

const mercantil = () => sheet([
  ['Mercantil Banco'],
  ['Fecha', 'Descripcion', 'Referencia', 'Debito', 'Credito'],
  ['03/SEP/2026', 'COMPRA', 140601, 16.8, ''],
  ['31/AGO/2026', 'COMISION', 142725, '.07', ''],
]);

const binanceCsv = () => Buffer.from([
  'ID de usuario,Tiempo,Cuenta,Operación,Moneda,Cambio,Observación',
  '11111111,2026-09-09 21:35:50,Funding,Transfer,USDT,-30,Binance Pay - P_TESTORDER000001',
].join('\n'));

const bancamigaHtml = () => Buffer.from(`<table>
  <tr><td>Nro.</td><td>Fecha</td><td>Referencia</td><td>Concepto</td><td>Debito</td><td>Credito</td></tr>
  <tr><td>1</td><td>04/09/26</td><td>'93569318</td><td>NC Credito</td><td>0</td><td>986226,89</td></tr>
</table>`);

describe('detectSource', () => {
  it.each([
    ['banesco', banescoPanama, 'Estados_de_cuenta.xls'],
    ['banescoVE', banescoVenezuela, 'movimientos.xlsx'],
    ['mercantil', mercantil, 'Mercantil Banco, Sistema de Banca por Internet.xlsx'],
    ['binance', binanceCsv, 'historial.csv'],
    ['bancamiga', bancamigaHtml, 'Movimientos_07102026.xls'],
  ])('recognises %s by content', (expected, build, fileName) => {
    expect(detectSource({ buffer: build(), fileName }).source).toBe(expected);
  });

  it('does not let the name override the content', () => {
    expect(detectSource({ buffer: banescoVenezuela(), fileName: 'banesco.xlsx' }).source).toBe('banescoVE');
  });

  it('returns no source for an unrecognised file', () => {
    const result = detectSource({ buffer: sheet([['hola'], ['mundo']]), fileName: 'notas.xlsx' });
    expect(result).toEqual({ source: null, candidates: [] });
  });

  it('rejects a file with an unknown extension', () => {
    expect(detectSource({ buffer: banescoVenezuela(), fileName: 'foto.png' }).source).toBeNull();
  });

  it('does not fit a Panama amount format into Banesco Venezuela', () => {
    const buffer = sheet([
      ['Fecha', 'Ref', 'Concepto', 'Monto'],
      ['2026/10/20', '', 'PANADERIA', '-1,250.50'],
    ]);
    expect(detectSource({ buffer, fileName: 'x.xlsx' }).source).toBeNull();
  });
});

describe('Binance dates', () => {
  it('keeps the year of a real export', () => {
    const [row] = getRows({ buffer: sheet([
      ['ID de usuario', 'Tiempo', 'Cuenta', 'Operación', 'Moneda', 'Cambio', 'Observación'],
      ['1', '2026-09-09 21:35:50', 'Funding', 'Transfer', 'USDT', '-30', 'Binance Pay'],
    ]), source: 'binance' });
    expect(new Date(row.date).getFullYear()).toBe(2026);
  });
});

describe('expandOptions', () => {
  it('runs every configured Exodus wallet by default', () => {
    expect(expandOptions('exodus', {})).toHaveLength(sources.exodus.wallets.length);
    expect(expandOptions('exodus', { wallet: 'all' })).toHaveLength(sources.exodus.wallets.length);
  });

  it('respects a chosen wallet and leaves other sources alone', () => {
    expect(expandOptions('exodus', { wallet: 'BTC|x' })).toEqual([{ wallet: 'BTC|x' }]);
    expect(expandOptions('banesco', {})).toEqual([{}]);
  });
});
