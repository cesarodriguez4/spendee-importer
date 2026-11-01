const dayjs = require('dayjs');
const customParseFormat = require('dayjs/plugin/customParseFormat');
const { Row } = require('../core/Row');
const { splitIncomeExpense } = require('../core/amountParser');

dayjs.extend(customParseFormat);

const RECEIPT_SOURCE = 'receipt';

// Currency a receipt may show, and the one its Wallet account is kept in.
const BANKS = {
  banescoVE: { walletSource: 'banescoVE', label: 'Banesco', currencies: { VES: 'VES' } },
  binancePay: { walletSource: 'binance', label: 'Binance Pay', currencies: { USDT: 'USD' } },
};

const DATE_FORMATS = ['YYYY-MM-DD HH:mm:ss', 'YYYY-MM-DD HH:mm', 'YYYY-MM-DD'];

function parseReceiptDate(value) {
  const parsed = dayjs(String(value ?? '').trim(), DATE_FORMATS, true);
  return parsed.isValid() ? parsed : null;
}

/**
 * Turns what an agent read from bank screenshots into Rows. The agent only reports
 * what it saw (schemas/receipt.schema.json). Whether a receipt is good enough to
 * write is decided here, and anything short of certain becomes a held Row.
 */
class ReceiptParser {
  constructor(schema) {
    this.schema = schema;
  }

  parse(document, categorizer) {
    const screenshots = Array.isArray(document?.screenshots) ? document.screenshots : [];
    const byReference = new Map();
    const rows = [];

    for (const shot of screenshots) {
      if (shot.kind !== 'receipt') continue;

      // Two captures of one receipt are one movement.
      const key = `${shot.bank}|${String(shot.reference ?? '').trim()}`;
      const repeated = shot.reference ? byReference.get(key) : null;
      if (repeated) {
        repeated.origins.push(shot.id);
        continue;
      }

      const row = this.#toRow(shot, categorizer);
      if (shot.reference) byReference.set(key, row);
      rows.push(row);
    }
    return rows;
  }

  #toRow(shot, categorizer) {
    const bank = BANKS[shot.bank];
    const date = parseReceiptDate(shot.date);
    const reference = String(shot.reference ?? '').trim();
    const amount = Number(shot.amount);
    const walletCurrency = bank?.currencies[shot.currency];
    const signed = shot.direction === 'income' ? Math.abs(amount) : -Math.abs(amount);

    const holdReason = this.#holdReason({ shot, bank, date, reference, amount, walletCurrency });
    const concept = String(shot.concept || shot.counterparty || '').trim();
    const name = [bank?.label || shot.bank, concept, reference && `Ref ${reference}`].filter(Boolean).join(' - ');
    const fallback = this.schema[bank?.walletSource]?.categoryFallback || 'Sin Asignar';

    const row = new Row({
      date: date ? date.toISOString() : null,
      name,
      category: categorizer.categorize(name, fallback),
      tags: categorizer.tag(name),
      payee: String(shot.counterparty || '').trim() || categorizer.payee(name),
      currency: walletCurrency || shot.currency,
      reference,
      identity: `${shot.bank}|${reference || shot.id}`,
      walletSource: bank?.walletSource,
      ...(holdReason ? { holdReason } : {}),
      ...(Number.isFinite(amount) ? splitIncomeExpense(signed) : { income: null, expense: null }),
    });
    row.origins = [shot.id];
    return row;
  }

  #holdReason({ shot, bank, date, reference, amount, walletCurrency }) {
    if (!bank) return `Bank "${shot.bank}" is not supported.`;
    if (shot.status !== 'success') return `Receipt status is "${shot.status}".`;
    if (!reference) return 'The receipt has no reference number.';
    if (!date) return 'The receipt date is unreadable.';
    if (!Number.isFinite(amount) || amount === 0) return 'The receipt amount is unreadable.';
    if (shot.direction !== 'income' && shot.direction !== 'expense') return 'The receipt does not show the direction.';
    if (!walletCurrency) return `Currency "${shot.currency}" is not expected for ${shot.bank}.`;
    return null;
  }
}

module.exports = { ReceiptParser, RECEIPT_SOURCE };
