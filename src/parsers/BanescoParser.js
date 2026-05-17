const { Row } = require('../core/Row');
const { parseDate } = require('../core/dateParser');
const { parseUSAmount, splitIncomeExpense } = require('../core/amountParser');

class BanescoParser {
  constructor(schema) {
    this.schema = schema;
  }

  parse(rawData, categorizer) {
    const { headerRows, dateFormat, locale, columns, categoryFallback, tagFallback } = this.schema;
    const pruned = rawData.filter((row) => row.length > 0);
    const rows = [];
    for (let i = headerRows; i < pruned.length; i++) {
      const raw = pruned[i];
      const name = raw[columns.name];
      const amount = parseUSAmount(raw[columns.amount]);
      const { income, expense } = splitIncomeExpense(amount);
      rows.push(new Row({
        date: parseDate(raw[columns.date], dateFormat, locale),
        name,
        category: categorizer.categorize(name, categoryFallback),
        tags: categorizer.tag(name, tagFallback),
        expense,
        income,
      }));
    }
    return rows;
  }
}

module.exports = { BanescoParser };
