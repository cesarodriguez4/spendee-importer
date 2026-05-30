const { Row } = require('../core/Row');
const { parseDate } = require('../core/dateParser');

class MercantilParser {
  constructor(schema) {
    this.schema = schema;
  }

  parse(rawData, categorizer) {
    const { headerRows, dateFormat, locale, columns, categoryFallback } = this.schema;
    const rows = [];
    for (let i = headerRows; i < rawData.length; i++) {
      const raw = rawData[i];
      const name = raw[columns.name];
      rows.push(new Row({
        date: parseDate(raw[columns.date], dateFormat, locale),
        name,
        category: categorizer.categorize(name, categoryFallback),
        tags: categorizer.tag(name),
        payee: categorizer.payee(name),
        currency: 'USD',
        expense: raw[columns.expense],
        income: raw[columns.income],
      }));
    }
    return rows;
  }
}

module.exports = { MercantilParser };
