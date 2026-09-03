const { Row } = require('../core/Row');
const { parseDate } = require('../core/dateParser');
const { parseUSAmount, splitIncomeExpense } = require('../core/amountParser');

class PayoneerParser {
  constructor(schema) {
    this.schema = schema;
  }

  parse(rawData, categorizer) {
    const {
      headerRows = 0,
      dateFormat,
      locale,
      columns,
      includeStatuses = [],
      categoryFallback,
    } = this.schema;

    const filtered = rawData
      .slice(headerRows)
      .filter((raw) => raw.length > 0 && raw[columns.amount] !== undefined && raw[columns.amount] !== '')
      .filter((raw) => includeStatuses.length === 0 || includeStatuses.includes(raw[columns.status]));

    return filtered.map((raw) => {
      const name = raw[columns.name];
      const amount = parseUSAmount(raw[columns.amount]);
      const { income, expense } = splitIncomeExpense(amount);
      return new Row({
        date: parseDate(raw[columns.date], dateFormat, locale),
        name,
        category: categorizer.categorize(name, categoryFallback),
        tags: categorizer.tag(name),
        payee: categorizer.payee(name),
        currency: raw[columns.currency] || 'USD',
        expense,
        income,
      });
    });
  }
}

module.exports = { PayoneerParser };
