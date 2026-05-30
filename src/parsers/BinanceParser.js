const { Row } = require('../core/Row');
const { parseDate } = require('../core/dateParser');
const { splitIncomeExpense } = require('../core/amountParser');

class BinanceParser {
  constructor(schema) {
    this.schema = schema;
  }

  parse(rawData, categorizer) {
    const {
      headerRows = 0,
      dateFormat,
      columns,
      excludeAccounts = [],
      excludeOperations = [],
      allowedCoins = [],
      categoryFallback,
    } = this.schema;

    const filtered = rawData
      .slice(headerRows)
      .filter((row) =>
        !excludeAccounts.includes(row[columns.account])
        && !excludeOperations.includes(row[columns.operation])
        && allowedCoins.includes(row[columns.coin]));

    return filtered.map((raw) => {
      const name = raw[columns.remark];
      const amount = Number(raw[columns.amount]);
      const { income, expense } = splitIncomeExpense(amount);
      return new Row({
        date: parseDate(raw[columns.date], dateFormat),
        name,
        category: categorizer.categorize(name, categoryFallback),
        tags: categorizer.tag(name),
        payee: categorizer.payee(name),
        currency: 'USD',
        expense,
        income,
      });
    });
  }
}

module.exports = { BinanceParser };
