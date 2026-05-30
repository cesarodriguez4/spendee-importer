const dayjs = require('dayjs');
const { Row } = require('../core/Row');
const { splitIncomeExpense } = require('../core/amountParser');

class SpendeeParser {
  parse(rows) {
    return rows.map((row) => {
      const amount = parseFloat(row.Amount);
      const { income, expense } = splitIncomeExpense(amount);
      return new Row({
        date: dayjs(row.Date).toISOString(),
        name: row.Note || '',
        category: row['Category name'] || 'Sin Asignar',
        tags: row.Labels || '',
        expense,
        income,
        payee: 'Spendee App',
        currency: row.Currency || 'USD',
      });
    });
  }
}

module.exports = { SpendeeParser };
