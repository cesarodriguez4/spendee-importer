class Row {
  constructor({ date, name, category, tags, expense, income, payee, currency, reference }) {
    this.date = date;
    this.name = name;
    this.category = category;
    this.tags = tags;
    this.expense = expense;
    this.income = income;
    if (payee !== undefined) this.payee = payee;
    if (currency !== undefined) this.currency = currency;
    if (reference !== undefined) this.reference = reference;
  }

  toArray() {
    return [this.date, this.name, this.category, this.tags, this.expense, this.income];
  }

  toOdooArray() {
    const date = typeof this.date === 'string' ? this.date.slice(0, 10) : this.date;
    const amount = this.income != null ? this.income : (this.expense != null ? -this.expense : 0);
    return [date, this.name, this.reference || '', amount, this.payee || ''];
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
    return ['Date', 'Payment Reference', 'Reference', 'Amount', 'Partner'];
  }
}

module.exports = { Row };
