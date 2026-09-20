const xlsx = require('node-xlsx');
const { HtmlTableReader } = require('../../src/core/HtmlTableReader');

const reader = new HtmlTableReader();

describe('HtmlTableReader', () => {
  it('reads a table into a matrix', () => {
    const html = '<table><tr><th>A</th><th>B</th></tr><tr><td>1</td><td>2</td></tr></table>';
    expect(reader.readBuffer(Buffer.from(html, 'utf8'))).toEqual([['A', 'B'], ['1', '2']]);
  });

  it('decodes named and numeric HTML entities', () => {
    const html = '<table><tr><th>D&eacute;bito</th><th>Cr&#233;dito</th><th>a&#xe9;b</th></tr></table>';
    expect(reader.readBuffer(Buffer.from(html, 'utf8'))).toEqual([['Débito', 'Crédito', 'aéb']]);
  });

  it('decodes latin1 files that are not valid UTF-8', () => {
    const html = '<table><tr><td>Comisión Crédito</td></tr></table>';
    expect(reader.readBuffer(Buffer.from(html, 'latin1'))).toEqual([['Comisión Crédito']]);
  });

  it('keeps U+FFFD that the source already contained instead of guessing latin1', () => {
    const html = '<table><tr><td>Comisi�n</td></tr></table>';
    expect(reader.readBuffer(Buffer.from(html, 'utf8'))).toEqual([['Comisi�n']]);
  });

  it('strips markup inside cells and collapses whitespace', () => {
    const html = '<table><tr><th><img src="logo.png" alt=""></th></tr>'
      + '<tr><td>  a <br> b  </td></tr></table>';
    expect(reader.readBuffer(Buffer.from(html, 'utf8'))).toEqual([[''], ['a b']]);
  });

  it('emits an empty row for <tr></tr>', () => {
    const html = '<table><tr><td>1</td></tr><tr></tr></table>';
    expect(reader.readBuffer(Buffer.from(html, 'utf8'))).toEqual([['1'], []]);
  });

  it('falls back to node-xlsx when the buffer is not HTML', () => {
    const buffer = xlsx.build([{ name: 'S', data: [['A', 'B'], [1, 2]] }]);
    expect(reader.readBuffer(Buffer.from(buffer))).toEqual([['A', 'B'], [1, 2]]);
  });
});
