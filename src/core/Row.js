class Row {
  constructor({ date, name, category, tags, expense, income }) {
    this.date = date;
    this.name = name;
    this.category = category;
    this.tags = tags;
    this.expense = expense;
    this.income = income;
  }

  toArray() {
    return [this.date, this.name, this.category, this.tags, this.expense, this.income];
  }

  static headers() {
    return ['Fecha', 'Descripción', 'Categoría', 'Tags', 'Gasto', 'Ingreso'];
  }
}

module.exports = { Row };
