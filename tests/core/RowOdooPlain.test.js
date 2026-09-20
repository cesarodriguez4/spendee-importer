const { Row } = require('../../src/core/Row');

// Rows come back from the browser as plain objects with stringified numbers,
// which is what /api/export feeds to Row.odooArrayFromPlain.
describe('Row.odooArrayFromPlain', () => {
  const base = { date: '2024-02-10T00:00:00.000Z', name: 'Transfer' };

  it('coerces string amounts to numbers', () => {
    expect(Row.odooArrayFromPlain({ ...base, income: '100', expense: '' })[3]).toBe(100);
    expect(Row.odooArrayFromPlain({ ...base, income: '', expense: '-25.5' })[3]).toBe(-25.5);
  });

  it('falls back to 0 when both amounts are blank or absent', () => {
    expect(Row.odooArrayFromPlain({ ...base, income: '', expense: '' })[3]).toBe(0);
    expect(Row.odooArrayFromPlain(base)[3]).toBe(0);
  });

  it('truncates the date and blanks out missing reference and payee', () => {
    expect(Row.odooArrayFromPlain(base)).toEqual(['2024-02-10', 'Transfer', '', 0, '', '']);
  });

  it('emits the journal stamped on the row', () => {
    const row = { ...base, income: '100', journal: 'Bancamiga Banco Universal C.A' };
    expect(Row.odooArrayFromPlain(row)[5]).toBe('Bancamiga Banco Universal C.A');
  });

  it('prefers an explicit journal argument', () => {
    expect(Row.odooArrayFromPlain({ ...base, journal: 'Viejo' }, 'Nuevo')[5]).toBe('Nuevo');
  });

  it('stays aligned with the header row', () => {
    expect(Row.odooArrayFromPlain(base)).toHaveLength(Row.odooHeaders().length);
  });
});
