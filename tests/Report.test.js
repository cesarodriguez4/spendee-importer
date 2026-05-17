
const { Report } = require('../src/core/Report');
const { Row } = require('../src/core/Row');

describe('Report', () => {
  it('wires reader → parser → writer and prepends headers', () => {
    const reader = { read: () => [['raw']] };
    const parser = {
      parse: () => [new Row({ date: 'd', name: 'n', category: 'c', tags: 't', expense: -1, income: null })],
    };
    let written;
    const writer = { write: (path, data) => { written = { path, data }; } };

    const report = new Report({
      reader, parser, categorizer: null, writer,
      sourcePath: 'in.csv', outputPath: 'out.xlsx',
    });

    const result = report.run();
    expect(result).toContain('in.csv');
    expect(written.path).toBe('out.xlsx');
    expect(written.data[0]).toEqual(Row.headers());
    expect(written.data[1]).toEqual(['d', 'n', 'c', 't', -1, null]);
  });
});
