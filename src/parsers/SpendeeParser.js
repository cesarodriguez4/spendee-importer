const dayjs = require('dayjs');
const { Row } = require('../core/Row');
const { splitIncomeExpense } = require('../core/amountParser');

class SpendeeParser {
  parse(rows, categorizer = null) {
    return rows.map((row) => {
      const amount = parseFloat(row.Amount);
      const { income, expense } = splitIncomeExpense(amount);
      const name = row.Note || '';
      return new Row({
        date: dayjs(row.Date).toISOString(),
        name,
        category: row['Category name'] || 'Sin Asignar',
        tags: row.Labels || '',
        expense,
        income,
        payee: categorizer ? categorizer.payee(name) : null,
        currency: 'USD',
      });
    });
  }
}

module.exports = { SpendeeParser };
