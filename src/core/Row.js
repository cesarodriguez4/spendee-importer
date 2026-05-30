class Row {
  constructor({ date, name, category, tags, expense, income, payee, currency }) {
    this.date = date;
    this.name = name;
    this.category = category;
    this.tags = tags;
    this.expense = expense;
    this.income = income;
    if (payee !== undefined) this.payee = payee;
    if (currency !== undefined) this.currency = currency;
  }

  toArray() {
    return [this.date, this.name, this.category, this.tags, this.expense, this.income];
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
}

module.exports = { Row };
