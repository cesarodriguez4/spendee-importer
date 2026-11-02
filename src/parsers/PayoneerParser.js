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

    const header = rawData[headerRows > 0 ? headerRows - 1 : 0] || [];
    const isNewFormat =
      header[0] === 'Currency' &&
      header[1] === 'Payout method' &&
      header[6] === 'Debit amount';

    const col = isNewFormat
      ? {
          date: 2,
          name: 9,
          credit: 5,
          debit: 6,
          currency: 0,
          status: 7,
        }
      : {
          date: columns.date,
          name: columns.name,
          amount: columns.amount,
          currency: columns.currency,
          status: columns.status,
        };

    const filtered = rawData
      .slice(headerRows)
      .filter((raw) => raw.length > 0)
      .filter((raw) => {
        if (isNewFormat) {
          return raw[col.credit] !== undefined && raw[col.credit] !== '' &&
                 raw[col.debit] !== undefined && raw[col.debit] !== '';
        }
        return raw[col.amount] !== undefined && raw[col.amount] !== '';
      })
      .filter((raw) => includeStatuses.length === 0 || includeStatuses.includes(raw[col.status]));

    return filtered.map((raw) => {
      const name = raw[col.name];
      let amount;
      if (isNewFormat) {
        amount = parseUSAmount(raw[col.credit]) + parseUSAmount(raw[col.debit]);
      } else {
        amount = parseUSAmount(raw[col.amount]);
      }
      const { income, expense } = splitIncomeExpense(amount);
      return new Row({
        date: parseDate(raw[col.date], isNewFormat ? 'MM-DD-YYYY' : dateFormat, locale),
        name,
        category: categorizer.categorize(name, categoryFallback),
        tags: categorizer.tag(name),
        payee: categorizer.payee(name),
        currency: raw[col.currency] || 'USD',
        expense,
        income,
      });
    });
  }
}

module.exports = { PayoneerParser };
