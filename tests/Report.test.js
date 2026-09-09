
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

  it('uses formatter when provided', () => {
    const reader = { read: () => [['raw']] };
    const parser = {
      parse: () => [new Row({ date: '2024-01-01T00:00:00.000Z', name: 'n', category: 'c', tags: 't', expense: 10, income: null })],
    };
    let written;
    const writer = { write: (path, data) => { written = { path, data }; } };

    const formatter = {
      headers: () => ['Date', 'Amount'],
      mapRow: (row) => [row.date.slice(0, 10), -row.expense],
    };

    const report = new Report({
      reader, parser, categorizer: null, writer,
      sourcePath: 'in.csv', outputPath: 'out.csv', formatter,
    });

    report.run();
    expect(written.data[0]).toEqual(['Date', 'Amount']);
    expect(written.data[1]).toEqual(['2024-01-01', -10]);
  });
});
