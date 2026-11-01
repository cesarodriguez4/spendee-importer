const dayjs = require('dayjs');
const { Row } = require('../core/Row');
const { parseDate } = require('../core/dateParser');
const { splitIncomeExpense } = require('../core/amountParser');

class ExodusParser {
  constructor(schema, { currency, wallet, startDate, endDate }) {
    this.schema = schema;
    this.currency = currency;
    this.wallet = wallet;
    this.startDate = startDate ? dayjs(startDate) : null;
    this.endDate = endDate ? dayjs(endDate) : null;
  }

  parse(rawData) {
    const { dateFormat, columns } = this.schema;
    const filtered = rawData.filter((row) => this.#matches(row, dateFormat, columns));
    const rows = [];
    for (const raw of filtered) {
      const outAmount = raw[columns.outAmount];
      const inAmount = raw[columns.inAmount];
      if ((inAmount && !outAmount && Number(inAmount) === 0)
        || (!inAmount && outAmount && Number(outAmount) === 0)) {
        continue;
      }
      const transactionUrl = raw[columns.transactionUrlA] || raw[columns.transactionUrlB] || '';
      const personalNote = raw[columns.personalNote] || '';
      const { expense } = splitIncomeExpense(Number(outAmount));
      const { income } = splitIncomeExpense(Number(inAmount));
      rows.push(new Row({
        date: parseDate(raw[columns.date], dateFormat),
        name: `${transactionUrl} ${personalNote}`,
        category: 'Transferencias',
        tags: '',
        currency: this.currency || raw[columns.currencyA] || raw[columns.currencyB],
        expense,
        income,
      }));
    }
    return rows;
  }

  #matches(row, dateFormat, columns) {
    const wallet = row[columns.walletA] || row[columns.walletB];
    const currency = row[columns.currencyA] || row[columns.currencyB];
    const date = dayjs(row[columns.date], dateFormat);
    if (!date.isValid()) return false;
    if (this.currency && currency !== this.currency) return false;
    if (this.wallet && wallet !== this.wallet) return false;
    return (!this.startDate || date.isSame(this.startDate) || date.isAfter(this.startDate))
      && (!this.endDate || date.isSame(this.endDate) || date.isBefore(this.endDate));
  }
}

module.exports = { ExodusParser };
