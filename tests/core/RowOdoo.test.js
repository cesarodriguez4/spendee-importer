const { Row } = require('../../src/core/Row');

describe('Row Odoo', () => {
  it('has correct Odoo headers', () => {
    expect(Row.odooHeaders()).toEqual([
      'Date', 'Payment Reference', 'Reference', 'Amount', 'Partner', 'Journal',
    ]);
  });

  it('formats date as YYYY-MM-DD from ISO string', () => {
    const row = new Row({
      date: '2024-03-15T00:00:00.000Z',
      name: 'Test',
      category: 'Cat',
      tags: 'Tag',
      expense: 50,
      income: null,
    });
    const odoo = row.toOdooArray();
    expect(odoo[0]).toBe('2024-03-15');
  });

  it('returns negative amount for expense', () => {
    const row = new Row({
      date: '2024-01-01T00:00:00.000Z',
      name: 'Gasto',
      category: 'C',
      tags: 'T',
      expense: -25.5,
      income: null,
    });
    expect(row.toOdooArray()).toEqual([
      '2024-01-01', 'Gasto', '', -25.5, '', '',
    ]);
  });

  it('returns positive amount for income', () => {
    const row = new Row({
      date: '2024-01-01T00:00:00.000Z',
      name: 'Ingreso',
      category: 'C',
      tags: 'T',
      expense: null,
      income: 100,
    });
    expect(row.toOdooArray()).toEqual([
      '2024-01-01', 'Ingreso', '', 100, '', '',
    ]);
  });

  it('returns 0 when both expense and income are null', () => {
    const row = new Row({
      date: '2024-01-01T00:00:00.000Z',
      name: 'Nada',
      category: 'C',
      tags: 'T',
      expense: null,
      income: null,
    });
    expect(row.toOdooArray()[3]).toBe(0);
  });

  it('includes reference and payee when provided', () => {
    const row = new Row({
      date: '2024-02-10T00:00:00.000Z',
      name: 'Transfer',
      category: 'C',
      tags: 'T',
      expense: -10,
      income: null,
      payee: 'Juan',
      reference: 'REF-123',
    });
    expect(row.toOdooArray()).toEqual([
      '2024-02-10', 'Transfer', 'REF-123', -10, 'Juan', '',
    ]);
  });

  describe('journal column', () => {
    const base = {
      date: '2024-02-10T00:00:00.000Z',
      name: 'Transfer',
      category: 'C',
      tags: 'T',
      expense: -10,
      income: null,
    };

    it('takes the journal from the argument', () => {
      const row = new Row(base);
      expect(row.toOdooArray('Bancamiga Banco Universal C.A')[5])
        .toBe('Bancamiga Banco Universal C.A');
    });

    it('falls back to the journal set on the row', () => {
      const row = new Row({ ...base, journal: 'Bancamiga Banco Universal C.A' });
      expect(row.toOdooArray()[5]).toBe('Bancamiga Banco Universal C.A');
    });

    it('prefers the argument over the row property', () => {
      const row = new Row({ ...base, journal: 'Viejo' });
      expect(row.toOdooArray('Nuevo')[5]).toBe('Nuevo');
    });

    it('keeps toArray free of the journal', () => {
      const row = new Row({ ...base, journal: 'Bancamiga Banco Universal C.A' });
      expect(row.toArray()).toEqual(['2024-02-10T00:00:00.000Z', 'Transfer', 'C', 'T', -10, null]);
    });
  });
});
