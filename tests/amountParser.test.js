
const { parseUSAmount, parseEUAmount, splitIncomeExpense } = require('../src/core/amountParser');

describe('parseUSAmount', () => {
  it('parses thousand separators with commas', () => {
    expect(parseUSAmount('1,234.56')).toBe(1234.56);
  });
  it('returns numbers untouched', () => {
    expect(parseUSAmount(42)).toBe(42);
  });
});

describe('parseEUAmount', () => {
  it('parses European decimal format', () => {
    expect(parseEUAmount('1.234,56')).toBe(1234.56);
  });
  it('parses simple decimals', () => {
    expect(parseEUAmount('100,5')).toBe(100.5);
  });
});

describe('splitIncomeExpense', () => {
  it('routes positives to income', () => {
    expect(splitIncomeExpense(50)).toEqual({ income: 50, expense: null });
  });
  it('routes negatives to expense', () => {
    expect(splitIncomeExpense(-30)).toEqual({ income: null, expense: -30 });
  });
  it('returns nulls for NaN', () => {
    expect(splitIncomeExpense(NaN)).toEqual({ income: null, expense: null });
  });
});
