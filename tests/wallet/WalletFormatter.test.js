const { WalletFormatter } = require('../../src/wallet/WalletFormatter');
const { Row } = require('../../src/core/Row');

describe('WalletFormatter', () => {
  it('formats an income row as positive amount', () => {
    const formatter = new WalletFormatter({ accountId: 'acc-1' });
    const row = new Row({
      date: '2026-10-27T12:00:00.000Z',
      name: 'Salary',
      category: 'Income',
      tags: 'work,monthly',
      income: 1000,
      expense: null,
      currency: 'USD',
      payee: 'Acme Corp',
    });

    const payload = formatter.format(row);
    expect(payload.amount.value).toBe(1000);
    expect(payload.amount.currencyCode).toBe('USD');
    expect(payload.note).toBe('Salary');
    expect(payload.counterParty).toBe('Acme Corp');
    expect(payload.accountId).toBe('acc-1');
    expect(payload.labelIds).toEqual([]);
    expect(payload.recordDate).toBe('2026-10-27T12:00:00.000Z');
  });

  it('formats an expense row as negative amount', () => {
    const formatter = new WalletFormatter();
    const row = new Row({
      date: '2026-10-27',
      name: 'Coffee',
      category: 'Food',
      tags: '',
      income: null,
      expense: -4.5,
    });

    const payload = formatter.format(row);
    expect(payload.amount.value).toBe(-4.5);
    expect(payload.labelIds).toEqual([]);
  });

  it('maps category names to Wallet categoryIds', () => {
    const formatter = new WalletFormatter({ categoryMap: { food: 'cat-food' } });
    const row = new Row({ date: '2026-10-27', name: 'B', category: 'Food', income: null, expense: 5 });

    const payload = formatter.format(row);
    expect(payload.categoryId).toBe('cat-food');
  });

  it('leaves the currency to the account when the row has none', () => {
    const formatter = new WalletFormatter({ accountId: 'acc-1' });
    const row = new Row({ date: '2026-10-27', name: 'X', category: '', tags: null, income: null, expense: -1 });
    expect(formatter.format(row).amount.currencyCode).toBeUndefined();
  });

  it('sends the row currency so the API can reject a mismatched account', () => {
    const formatter = new WalletFormatter({ accountId: 'acc-usd' });
    const row = new Row({ date: '2026-10-27', name: 'X', category: '', income: null, expense: -1000, currency: 'VES' });
    expect(formatter.format(row).amount.currencyCode).toBe('VES');
  });

  describe('amountOf', () => {
    it('ignores a 0 left on the unused side', () => {
      expect(WalletFormatter.amountOf({ income: 0, expense: -5 })).toBe(-5);
      expect(WalletFormatter.amountOf({ income: 5, expense: 0 })).toBe(5);
    });

    it('signs an expense stored as a positive number', () => {
      expect(WalletFormatter.amountOf({ income: '', expense: 16.8 })).toBe(-16.8);
    });

    it('reports a missing amount as 0 and an unreadable one as NaN', () => {
      expect(WalletFormatter.amountOf({ income: null, expense: null })).toBe(0);
      expect(WalletFormatter.amountOf({ income: 'abc', expense: null })).toBeNaN();
    });
  });

  describe('buildNote', () => {
    it('keeps the suffix whole when the description is too long', () => {
      const suffix = '$ -12.34 (BCV 889.26) [si:a1b2c3d4e5]';
      const note = WalletFormatter.buildNote('x'.repeat(400), suffix);
      expect(note).toHaveLength(255);
      expect(note.endsWith(suffix)).toBe(true);
    });

    it('truncates a note without suffix', () => {
      expect(WalletFormatter.buildNote('x'.repeat(400))).toHaveLength(255);
    });
  });

  it('formats many rows', () => {
    const formatter = new WalletFormatter();
    const rows = [
      new Row({ date: '2026-10-27', name: 'A', category: 'X', income: 10, expense: null }),
      new Row({ date: '2026-10-27', name: 'B', category: 'Y', income: null, expense: -10 }),
    ];
    expect(formatter.formatMany(rows)).toHaveLength(2);
  });

  it('builds a category map from Wallet categories', () => {
    const categories = [
      { id: 'cat-1', name: 'Food' },
      { id: 'cat-2', name: 'Transport' },
    ];
    const map = WalletFormatter.buildCategoryMap(categories);
    expect(map).toEqual({ food: 'cat-1', transport: 'cat-2' });
  });

  it('builds a category map from Wallet categories response envelope', () => {
    const response = {
      categories: [
        { id: 'cat-1', name: 'Food' },
        { id: 'cat-2', name: 'Transport' },
      ],
      limit: 200,
      offset: 0,
    };
    const map = WalletFormatter.buildCategoryMap(response);
    expect(map).toEqual({ food: 'cat-1', transport: 'cat-2' });
  });

  it('builds a label map from Wallet labels response envelope', () => {
    const response = {
      labels: [
        { id: 'lbl-1', name: 'Work' },
        { id: 'lbl-2', name: 'Personal' },
      ],
      limit: 200,
      offset: 0,
    };
    const map = WalletFormatter.buildLabelMap(response);
    expect(map).toEqual({ work: 'lbl-1', personal: 'lbl-2' });
  });

  it('maps tags to labelIds when a label map is provided', () => {
    const formatter = new WalletFormatter({ labelMap: { work: 'lbl-1', monthly: 'lbl-2' } });
    const row = new Row({ date: '2026-10-27', name: 'Salary', category: 'Income', tags: 'work,monthly', income: 1000, expense: null });
    const payload = formatter.format(row);
    expect(payload.labelIds).toEqual(['lbl-1', 'lbl-2']);
  });
});
