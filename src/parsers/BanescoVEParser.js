const { Row } = require('../core/Row');
const { parseDate } = require('../core/dateParser');
const { parseEUAmount, splitIncomeExpense } = require('../core/amountParser');

function excelSerialToDate(serial) {
  // Excel 1900 date system: day 1 = 1900-01-01.
  return new Date((serial - 25569) * 86400 * 1000);
}

function parseVESAmount(value) {
  if (typeof value === 'number') return value;
  if (typeof value !== 'string') return Number(value);
  // Newer Banesco Venezuela statements prefix amounts with "Bs." and non-breaking spaces.
  const match = value.match(/-?\d[\d.,]*/);
  return parseEUAmount(match ? match[0] : value);
}

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
      const rawDate = raw[columns.date];
      const rawAmount = raw[columns.amount];
      const bsAmount = parseVESAmount(rawAmount);
      const amount = this.exchangeRate ? this.#toUSD(bsAmount) : bsAmount;
      const baseName = raw[columns.name];
      const displayName = this.exchangeRate ? `${baseName} $ ${amount.toFixed(2)}` : baseName;
      const { income, expense } = splitIncomeExpense(amount);
      const date = typeof rawDate === 'number'
        ? excelSerialToDate(rawDate).toISOString()
        : this.#parseDateWithFallback(rawDate, dateFormat, locale);
      rows.push(new Row({
        date,
        name: displayName,
        category: categorizer.categorize(baseName, categoryFallback),
        tags: categorizer.tag(baseName),
        payee: categorizer.payee(baseName),
        currency: this.exchangeRate ? 'USD' : 'VES',
        identity: [rawDate, baseName, bsAmount].join('|'),
        expense,
        income,
      }));
    }
    return rows;
  }

  #parseDateWithFallback(value, primaryFormat, locale) {
    const formats = [primaryFormat, 'YYYY/MM/DD', 'DD/MM/YYYY'].filter((f, i, arr) => arr.indexOf(f) === i);
    let lastError;
    for (const format of formats) {
      try {
        return parseDate(value, format, locale);
      } catch (err) {
        lastError = err;
      }
    }
    throw lastError;
  }

  #toUSD(bsAmount) {
    return Number((bsAmount / this.exchangeRate).toFixed(2));
  }
}

module.exports = { BanescoVEParser };
