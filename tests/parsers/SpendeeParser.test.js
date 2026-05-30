const { SpendeeParser } = require('../../src/parsers/SpendeeParser');

describe('SpendeeParser', () => {
  const parser = new SpendeeParser();

  it('maps an Expense row to a negative expense and null income', () => {
    const rows = parser.parse([{
      Date: '2026-04-11T17:40:18+00:00',
      Wallet: 'Banesco Panamá',
      Type: 'Expense',
      'Category name': 'Lujos',
      Amount: '-192.54000000',
      Currency: 'USD',
      Note: 'Pago Tarjeta',
      Labels: 'Padres',
      Author: 'Cesar',
    }]);
    expect(rows).toHaveLength(1);
    expect(rows[0].expense).toBe(-192.54);
    expect(rows[0].income).toBeNull();
    expect(rows[0].name).toBe('Pago Tarjeta');
    expect(rows[0].category).toBe('Lujos');
    expect(rows[0].tags).toBe('Padres');
  });

  it('maps an Income row to a positive income and null expense', () => {
    const rows = parser.parse([{
      Date: '2026-04-17T18:10:25+00:00',
      Wallet: 'Banesco Panamá',
      Type: 'Income',
      'Category name': 'Other',
      Amount: '1000.00000000',
      Currency: 'USD',
      Note: 'ACH TRANSFERENCIA RECIBIDA',
      Labels: '',
      Author: 'Cesar',
    }]);
    expect(rows[0].income).toBe(1000);
    expect(rows[0].expense).toBeNull();
    expect(rows[0].tags).toBe('');
  });

  it('falls back to "Sin Asignar" when category is missing', () => {
    const rows = parser.parse([{
      Date: '2026-04-13T19:16:34+00:00', Amount: '-1', 'Category name': '', Note: '', Labels: '',
    }]);
    expect(rows[0].category).toBe('Sin Asignar');
  });

  it('produces ISO date strings', () => {
    const rows = parser.parse([{
      Date: '2026-04-11T17:40:18+00:00', Amount: '-1', 'Category name': 'X', Note: '', Labels: '',
    }]);
    expect(rows[0].date).toBe('2026-04-11T17:40:18.000Z');
  });
});
