function parseUSAmount(value) {
  if (typeof value === 'number') return value;
  if (typeof value !== 'string') return Number(value);
  return Number(value.replace(/,/g, ''));
}

function parseEUAmount(value) {
  if (typeof value === 'number') return value;
  if (typeof value !== 'string') return Number(value);
  return Number(value.replace(/\./g, '').replace(/,/g, '.'));
}

function splitIncomeExpense(amount) {
  if (Number.isNaN(amount) || amount === null || amount === undefined) {
    return { income: null, expense: null };
  }
  return {
    income: amount < 0 ? null : amount,
    expense: amount > 0 ? null : amount,
  };
}

module.exports = { parseUSAmount, parseEUAmount, splitIncomeExpense };
