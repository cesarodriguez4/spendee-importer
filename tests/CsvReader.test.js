const { parseCsv, fixMojibake } = require('../src/core/CsvReader');

describe('parseCsv', () => {
  it('parses quoted fields containing commas', () => {
    const text = 'a,b,c\n1,"hello, world",3\n';
    expect(parseCsv(text)).toEqual([
      ['a', 'b', 'c'],
      ['1', 'hello, world', '3'],
    ]);
  });

  it('handles escaped quotes within quoted fields', () => {
    expect(parseCsv('a\n"she said ""hi"""\n')).toEqual([['a'], ['she said "hi"']]);
  });

  it('handles CRLF line endings', () => {
    expect(parseCsv('a,b\r\n1,2\r\n')).toEqual([['a', 'b'], ['1', '2']]);
  });
});

describe('fixMojibake', () => {
  it('repairs double-encoded UTF-8', () => {
    expect(fixMojibake('PanamÃ¡')).toBe('Panamá');
    expect(fixMojibake('RodrÃ­guez')).toBe('Rodríguez');
  });

  it('leaves clean UTF-8 untouched', () => {
    expect(fixMojibake('Panamá')).toBe('Panamá');
    expect(fixMojibake('hello world')).toBe('hello world');
  });
});
