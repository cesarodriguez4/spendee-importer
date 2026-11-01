const { Row } = require('../core/Row');
const { parseDate } = require('../core/dateParser');
const { parseEUAmount, splitIncomeExpense } = require('../core/amountParser');

class BanescoVEParser {
  constructor(schema, exchangeRate) {
    this.schema = schema;
    this.exchangeRate = null;
    if (exchangeRate !== undefined && exchangeRate !== null && String(exchangeRate).trim() !== '') {
      const rate = Number(exchangeRate);
      if (!Number.isFinite(rate) || rate <= 0) {
        throw new Error('BanescoVEParser exchange rate must be a positive number (Bs → USD)');
      }
      this.exchangeRate = rate;
    }
  }

  parse(rawData, categorizer) {
    const { headerRows, dateFormat, locale, columns, categoryFallback } = this.schema;
    const pruned = rawData.filter((row) => row.length > 0);
    const rows = [];
    for (let i = headerRows; i < pruned.length; i++) {
      const raw = pruned[i];
      const bsAmount = parseEUAmount(raw[columns.amount]);
      const amount = this.exchangeRate ? this.#toUSD(bsAmount) : bsAmount;
      const baseName = raw[columns.name];
      const displayName = this.exchangeRate ? `${baseName} $ ${amount.toFixed(2)}` : baseName;
      const { income, expense } = splitIncomeExpense(amount);
      rows.push(new Row({
        date: parseDate(raw[columns.date], dateFormat, locale),
        name: displayName,
        category: categorizer.categorize(baseName, categoryFallback),
        tags: categorizer.tag(baseName),
        payee: categorizer.payee(baseName),
        currency: this.exchangeRate ? 'USD' : 'VES',
        identity: [raw[columns.date], baseName, bsAmount].join('|'),
        expense,
        income,
      }));
    }
    return rows;
  }

  #toUSD(bsAmount) {
    return Number((bsAmount / this.exchangeRate).toFixed(2));
  }
}

module.exports = { BanescoVEParser };
