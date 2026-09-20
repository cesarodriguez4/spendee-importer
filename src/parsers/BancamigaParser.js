const { Row } = require('../core/Row');
const { parseDate } = require('../core/dateParser');
const { parseEUAmount, splitIncomeExpense } = require('../core/amountParser');

const DATE_CELL = /^\d{2}\/\d{2}\/\d{2}$/;

class BancamigaParser {
  constructor(schema, options = {}) {
    this.schema = schema;
    this.exchangeRate = null;
    const raw = options.exchangeRate;
    if (raw !== undefined && raw !== null && String(raw).trim() !== '') {
      const rate = Number(raw);
      if (!Number.isFinite(rate) || rate <= 0) {
        throw new Error('BancamigaParser exchange rate must be a positive number (Bs → USD)');
      }
      this.exchangeRate = rate;
    }
  }

  parse(rawData, categorizer) {
    const { dateFormat, locale, columns, categoryFallback } = this.schema;
    return rawData
      .filter((row) => DATE_CELL.test(String(row[columns.date] ?? '').trim()))
      .map((raw) => {
        const name = this.#normalize(raw[columns.name]);
        const debit = parseEUAmount(raw[columns.expense]) || 0;
        const credit = parseEUAmount(raw[columns.income]) || 0;
        const amount = this.#convert(credit - debit);
        return new Row({
          date: parseDate(String(raw[columns.date]).trim(), dateFormat, locale),
          name: this.exchangeRate ? `${name} $ ${amount.toFixed(2)}` : name,
          category: categorizer.categorize(name, categoryFallback),
          tags: categorizer.tag(name),
          payee: categorizer.payee(name) ?? this.#merchant(name),
          currency: this.exchangeRate ? 'USD' : 'VES',
          reference: String(raw[columns.reference] ?? '').replace(/^'/, '').trim(),
          ...splitIncomeExpense(amount),
        });
      });
  }

  #convert(amount) {
    if (!this.exchangeRate) return amount;
    return Number((amount / this.exchangeRate).toFixed(2));
  }

  // Statements arrive in three encodings (ASCII, latin1, and UTF-8 the bank had
  // already mangled into U+FFFD). Repair what we can, then strip accents so the
  // same concept yields the same string whichever month it came from — which is
  // also what Categorizer's accent-free keywords expect.
  #normalize(value) {
    if (!value) return '';
    let text = String(value);
    for (const [from, to] of this.schema.textRepairs ?? []) {
      text = text.split(from).join(to);
    }
    return text.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
  }

  // "Consumo Masterdebit Nacional - FARMATODO CA CCS NOROESTE VEN" carries the
  // merchant after the separator; use it as the Odoo partner when payees.json
  // has no explicit mapping.
  #merchant(name) {
    const separator = this.schema.merchantSeparator;
    if (!separator) return null;
    const at = name.indexOf(separator);
    if (at === -1) return null;
    const merchant = name.slice(at + separator.length).replace(/\sVEN$/, '').trim();
    return merchant || null;
  }
}

module.exports = { BancamigaParser };
