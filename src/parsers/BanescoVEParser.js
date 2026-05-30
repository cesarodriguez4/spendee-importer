const { Row } = require('../core/Row');
const { parseDate } = require('../core/dateParser');
const { parseEUAmount, splitIncomeExpense } = require('../core/amountParser');

class BanescoVEParser {
  constructor(schema, exchangeRate) {
    const rate = Number(exchangeRate);
    if (!Number.isFinite(rate) || rate <= 0) {
      throw new Error('BanescoVEParser requires a positive exchange rate (Bs → USD)');
    }
    this.schema = schema;
    this.exchangeRate = rate;
  }

  parse(rawData, categorizer) {
    const { headerRows, dateFormat, locale, columns, categoryFallback } = this.schema;
    const pruned = rawData.filter((row) => row.length > 0);
    const rows = [];
    for (let i = headerRows; i < pruned.length; i++) {
      const raw = pruned[i];
      const bsAmount = parseEUAmount(raw[columns.amount]);
      const usdAmount = this.#toUSD(bsAmount);
      const baseName = raw[columns.name];
      const displayName = `${baseName} $ ${usdAmount.toFixed(2)}`;
      const { income, expense } = splitIncomeExpense(usdAmount);
      rows.push(new Row({
        date: parseDate(raw[columns.date], dateFormat, locale),
        name: displayName,
        category: categorizer.categorize(baseName, categoryFallback),
        tags: categorizer.tag(baseName),
        payee: categorizer.payee(baseName),
        currency: 'USD',
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
