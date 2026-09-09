const fs = require('fs');
const path = require('path');
const { OdooCsvWriter, escapeCsvCell, buildCsv } = require('../../src/core/OdooCsvWriter');

describe('OdooCsvWriter', () => {
  const tmpDir = path.join(__dirname, '..', '..', 'tmp');

  beforeAll(() => {
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(() => {
    const files = fs.readdirSync(tmpDir);
    for (const f of files) {
      fs.unlinkSync(path.join(tmpDir, f));
    }
  });

  describe('escapeCsvCell', () => {
    it('returns plain string for simple values', () => {
      expect(escapeCsvCell('hello')).toBe('hello');
      expect(escapeCsvCell(123)).toBe('123');
    });

    it('wraps in quotes when comma present', () => {
      expect(escapeCsvCell('a,b')).toBe('"a,b"');
    });

    it('escapes double quotes by doubling them', () => {
      expect(escapeCsvCell('say "hello"')).toBe('"say ""hello"""');
    });

    it('handles newline', () => {
      expect(escapeCsvCell('line1\nline2')).toBe('"line1\nline2"');
    });

    it('returns empty string for null/undefined', () => {
      expect(escapeCsvCell(null)).toBe('');
      expect(escapeCsvCell(undefined)).toBe('');
    });
  });

  describe('buildCsv', () => {
    it('joins rows with commas and newlines', () => {
      const csv = buildCsv([
        ['Date', 'Amount'],
        ['2024-01-01', 100],
      ]);
      expect(csv).toBe('Date,Amount\n2024-01-01,100');
    });
  });

  describe('write', () => {
    it('writes UTF-8 BOM and CSV content', () => {
      const writer = new OdooCsvWriter(tmpDir);
      const filePath = writer.write('test.csv', [
        ['Date', 'Payment Reference', 'Amount'],
        ['2024-01-01', 'Compra', -50],
      ]);

      const raw = fs.readFileSync(filePath);
      expect(raw[0]).toBe(0xEF);
      expect(raw[1]).toBe(0xBB);
      expect(raw[2]).toBe(0xBF);

      const text = raw.toString('utf8');
      expect(text).toContain('Date,Payment Reference,Amount');
      expect(text).toContain('2024-01-01,Compra,-50');
    });
  });
});
