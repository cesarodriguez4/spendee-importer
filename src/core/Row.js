class Row {
  constructor({ date, name, category, tags, expense, income, payee, currency, reference, journal }) {
    this.date = date;
    this.name = name;
    this.category = category;
    this.tags = tags;
    this.expense = expense;
    this.income = income;
    if (payee !== undefined) this.payee = payee;
    if (currency !== undefined) this.currency = currency;
    if (reference !== undefined) this.reference = reference;
    if (journal !== undefined) this.journal = journal;
  }

  toArray() {
    return [this.date, this.name, this.category, this.tags, this.expense, this.income];
  }

  toOdooArray(journal = this.journal) {
    const date = typeof this.date === 'string' ? this.date.slice(0, 10) : this.date;
    // `expense` is already signed (negative) by splitIncomeExpense — don't negate it.
    const amount = this.income != null ? this.income : (this.expense != null ? this.expense : 0);
    return [date, this.name, this.reference || '', amount, this.payee || '', journal || ''];
  }

  // Same shape as toOdooArray, but for rows that came back from the browser as
  // plain objects: numbers arrive as strings and blanks as ''.
  static odooArrayFromPlain(r, journal = r.journal) {
    const date = typeof r.date === 'string' ? r.date.slice(0, 10) : r.date;
    // `expense` is already signed (negative) by splitIncomeExpense — don't negate it.
    const amount = r.income != null && r.income !== '' ? Number(r.income) : (r.expense != null && r.expense !== '' ? Number(r.expense) : 0);
    return [date, r.name, r.reference ?? '', amount, r.payee ?? '', journal ?? ''];
  }

  static headers() {
    return ['Fecha', 'Descripción', 'Categoría', 'Tags', 'Gasto', 'Ingreso'];
  }

  static spendeeHeaders() {
    return ['Fecha', 'Descripción', 'Categoría', 'Tags', 'Monto', 'Payee', 'Currency'];
  }

  static headersWithPayeeCurrency() {
    return [...Row.headers(), 'Payee', 'Currency'];
  }

  static odooHeaders() {
    return ['Date', 'Payment Reference', 'Reference', 'Amount', 'Partner', 'Journal'];
  }
}

module.exports = { Row };
