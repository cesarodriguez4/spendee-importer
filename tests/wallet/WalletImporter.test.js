const { WalletImporter, STATUS } = require('../../src/wallet/WalletImporter');
const { WalletUnknownResultError } = require('../../src/wallet/WalletApiClient');
const { formatTag, tagRows } = require('../../src/wallet/recordTag');
const { Row } = require('../../src/core/Row');

const ACCOUNTS = [
  { id: 'usd', name: 'Banesco USD', currencyCode: 'USD' },
  { id: 'ves', name: 'Banesco VE', currencyCode: 'VES' },
];

const SOURCES = {
  banesco: { walletAccounts: { USD: 'usd' } },
  banescoVE: { usdNote: true, walletAccounts: { VES: 'ves' } },
  mixed: { walletAccounts: { USD: 'usd', VES: 'usd' } },
};

function makeClient({ records = [], createRecords } = {}) {
  return {
    getAllAccounts: vi.fn(async () => ACCOUNTS),
    getAllCategories: vi.fn(async () => [{ id: 'cat-food', name: 'Food' }]),
    getAllLabels: vi.fn(async () => []),
    getAllRecords: vi.fn(async () => records.map((record) => ({ ...record }))),
    createRecords: createRecords || vi.fn(async (batch) => ({
      results: batch.map((_, inputIndex) => ({ inputIndex, success: true, id: `r${inputIndex}` })),
    })),
  };
}

function usdRow(overrides = {}) {
  return new Row({
    date: '2026-10-20T04:00:00.000Z',
    name: 'FARMACIA',
    category: 'Food',
    income: null,
    expense: -10,
    currency: 'USD',
    ...overrides,
  });
}

function vesRow(overrides = {}) {
  return usdRow({ currency: 'VES', expense: -88925.53, identity: '2026/10/20|PANADERIA|-88925.53', name: 'PANADERIA', ...overrides });
}

function statuses(result) {
  return result.items.map((item) => item.status);
}

describe('WalletImporter.plan', () => {
  it('writes nothing while planning', async () => {
    const client = makeClient();
    const plan = await new WalletImporter({ client, sources: SOURCES }).plan({ rows: [usdRow()], source: 'banesco' });

    expect(statuses(plan)).toEqual([STATUS.NEW]);
    expect(client.createRecords).not.toHaveBeenCalled();
  });

  it('builds a payload with the account, currency, category and tag', async () => {
    const importer = new WalletImporter({ client: makeClient(), sources: SOURCES });
    const { items: [item] } = await importer.plan({ rows: [usdRow()], source: 'banesco' });

    expect(item.payload).toMatchObject({
      accountId: 'usd',
      categoryId: 'cat-food',
      amount: { value: -10, currencyCode: 'USD' },
      note: `FARMACIA ${formatTag(item.tag)}`,
    });
  });

  it('marks a row whose tag is already in Wallet as a duplicate', async () => {
    const [tag] = tagRows([usdRow()], 'banesco');
    const client = makeClient({
      records: [{ id: 'x', note: `Renamed in the app ${formatTag(tag)}`, amount: { value: -10 }, recordDate: '2026-10-20T04:00:00Z' }],
    });
    const plan = await new WalletImporter({ client, sources: SOURCES }).plan({ rows: [usdRow()], source: 'banesco' });

    expect(statuses(plan)).toEqual([STATUS.DUPLICATE]);
    expect(plan.items[0].match).toBe('x');
  });

  it('keeps identical rows distinct across re-runs', async () => {
    const rows = [usdRow(), usdRow()];
    const [first] = tagRows(rows, 'banesco');
    const client = makeClient({
      records: [{ id: 'x', note: formatTag(first), amount: { value: -10 }, recordDate: '2026-10-20T04:00:00Z' }],
    });
    const plan = await new WalletImporter({ client, sources: SOURCES }).plan({ rows, source: 'banesco' });

    expect(statuses(plan)).toEqual([STATUS.DUPLICATE, STATUS.NEW]);
  });

  it('holds a row that resembles an untagged record', async () => {
    const client = makeClient({
      records: [{ id: 'x', note: 'Manual', amount: { value: -10 }, recordDate: '2026-10-21T01:00:00Z' }],
    });
    const plan = await new WalletImporter({ client, sources: SOURCES }).plan({ rows: [usdRow()], source: 'banesco' });

    expect(statuses(plan)).toEqual([STATUS.POSSIBLE_DUPLICATE]);
    expect(plan.items[0].payload).toBeUndefined();
  });

  it('holds a statement row that resembles a record tagged by another channel', async () => {
    const client = makeClient({
      records: [{ id: 'x', note: 'Binance Pay [si:0123456789]', amount: { value: -10 }, recordDate: '2026-10-20T15:00:00Z' }],
    });
    const plan = await new WalletImporter({ client, sources: SOURCES }).plan({ rows: [usdRow()], source: 'banesco' });

    expect(statuses(plan)).toEqual([STATUS.POSSIBLE_DUPLICATE]);
  });

  it('lets one record explain only one row', async () => {
    const client = makeClient({
      records: [{ id: 'x', note: 'Manual', amount: { value: -10 }, recordDate: '2026-10-20T04:00:00Z' }],
    });
    const plan = await new WalletImporter({ client, sources: SOURCES }).plan({ rows: [usdRow(), usdRow()], source: 'banesco' });

    expect(statuses(plan)).toEqual([STATUS.POSSIBLE_DUPLICATE, STATUS.NEW]);
  });

  it('does not treat a stored 0.00000001 BTC difference as the same amount', async () => {
    const rows = [usdRow({ expense: -0.00012 })];
    const client = makeClient({
      records: [{ id: 'x', note: 'Manual', amount: { value: -0.00013 }, recordDate: '2026-10-20T04:00:00Z' }],
    });
    const plan = await new WalletImporter({ client, sources: SOURCES }).plan({ rows, source: 'banesco' });

    expect(statuses(plan)).toEqual([STATUS.NEW]);
  });

  it('creates an accepted possible duplicate', async () => {
    const [tag] = tagRows([usdRow()], 'banesco');
    const client = makeClient({
      records: [{ id: 'x', note: 'Manual', amount: { value: -10 }, recordDate: '2026-10-20T04:00:00Z' }],
    });
    const plan = await new WalletImporter({ client, sources: SOURCES }).plan({ rows: [usdRow()], source: 'banesco', accept: [tag] });

    expect(statuses(plan)).toEqual([STATUS.NEW]);
  });

  it('rejects a row in a currency other than its account', async () => {
    const plan = await new WalletImporter({ client: makeClient(), sources: SOURCES }).plan({
      rows: [usdRow({ currency: 'VES' })],
      source: 'mixed',
    });

    expect(statuses(plan)).toEqual([STATUS.INVALID]);
    expect(plan.items[0].reason).toMatch(/VES.*USD/);
  });

  it('rejects a row with no mapped account', async () => {
    const plan = await new WalletImporter({ client: makeClient(), sources: SOURCES }).plan({
      rows: [usdRow({ currency: 'GBP' })],
      source: 'banesco',
    });

    expect(statuses(plan)).toEqual([STATUS.INVALID]);
  });

  it('rejects a zero or unreadable amount', async () => {
    const plan = await new WalletImporter({ client: makeClient(), sources: SOURCES }).plan({
      rows: [usdRow({ expense: 0 }), usdRow({ expense: 'abc' })],
      source: 'banesco',
    });

    expect(statuses(plan)).toEqual([STATUS.INVALID, STATUS.INVALID]);
  });

  it('honours a hold set by the parser', async () => {
    const plan = await new WalletImporter({ client: makeClient(), sources: SOURCES }).plan({
      rows: [usdRow({ holdReason: 'No reference.' })],
      source: 'banesco',
    });

    expect(statuses(plan)).toEqual([STATUS.HELD]);
  });

  it('holds a row dated before the source was moved to its current account', async () => {
    const sources = { banescoVE: { ...SOURCES.banescoVE, walletFrom: '2026-10-20' } };
    const plan = await new WalletImporter({ client: makeClient(), sources, bcvRate: { getRate: async () => 900 } }).plan({
      rows: [vesRow({ date: '2026-10-19T04:00:00.000Z' }), vesRow({ date: '2026-10-20T04:00:00.000Z', identity: 'other' })],
      source: 'banescoVE',
    });

    expect(statuses(plan)).toEqual([STATUS.HELD, STATUS.NEW]);
    expect(plan.items[0].reason).toMatch(/2026-10-20/);
  });

  it('fails before writing when a forced category does not exist', async () => {
    const client = makeClient();
    await expect(new WalletImporter({ client, sources: SOURCES }).plan({
      rows: [usdRow()],
      source: 'banesco',
      forceCategory: 'Nope',
    })).rejects.toThrow(/Nope/);
    expect(client.createRecords).not.toHaveBeenCalled();
  });

  it('reads existing records with both date bounds', async () => {
    const client = makeClient();
    await new WalletImporter({ client, sources: SOURCES }).plan({ rows: [usdRow()], source: 'banesco' });
    const [args] = client.getAllRecords.mock.calls[0];

    expect(args.accountId).toBe('usd');
    expect(args.from).toBeTruthy();
    expect(args.before > args.from).toBe(true);
  });

  it('reports totals, date range and unmapped categories', async () => {
    const importer = new WalletImporter({ client: makeClient(), sources: SOURCES });
    const { summary } = await importer.plan({
      rows: [usdRow(), usdRow({ name: 'OTRO', expense: -5, category: 'Sin Asignar' })],
      source: 'banesco',
    });

    expect(summary.total).toBe(2);
    expect(summary.totals.USD).toBe(-15);
    expect(summary.from).toBeTruthy();
    expect(summary.unmappedCategories).toEqual(['Sin Asignar']);
  });

  describe('USD equivalent in the note', () => {
    it('keeps the amount in Bs and adds USD and the rate to the note', async () => {
      const bcvRate = { getRate: vi.fn(async () => 889.2553) };
      const importer = new WalletImporter({ client: makeClient(), sources: SOURCES, bcvRate });
      const { items: [item] } = await importer.plan({ rows: [vesRow()], source: 'banescoVE' });

      expect(item.payload.amount).toEqual({ value: -88925.53, currencyCode: 'VES' });
      expect(item.payload.note).toBe(`PANADERIA $ -100.00 (BCV 889.26) ${formatTag(item.tag)}`);
    });

    it('holds the row when no rate is available', async () => {
      const bcvRate = { getRate: vi.fn(async () => null) };
      const importer = new WalletImporter({ client: makeClient(), sources: SOURCES, bcvRate });
      const plan = await importer.plan({ rows: [vesRow()], source: 'banescoVE' });

      expect(statuses(plan)).toEqual([STATUS.RATE_UNAVAILABLE]);
      expect(plan.items[0].payload).toBeUndefined();
    });

    it('does not ask for a rate for a known duplicate', async () => {
      const [tag] = tagRows([vesRow()], 'banescoVE');
      const bcvRate = { getRate: vi.fn(async () => 889) };
      const client = makeClient({
        records: [{ id: 'x', note: formatTag(tag), amount: { value: -88925.53 }, recordDate: '2026-10-20T04:00:00Z' }],
      });
      const plan = await new WalletImporter({ client, sources: SOURCES, bcvRate }).plan({ rows: [vesRow()], source: 'banescoVE' });

      expect(statuses(plan)).toEqual([STATUS.DUPLICATE]);
      expect(bcvRate.getRate).not.toHaveBeenCalled();
    });

    it('recognises a re-run with a different rate as a duplicate', async () => {
      const firstRun = new WalletImporter({
        client: makeClient(),
        sources: SOURCES,
        bcvRate: { getRate: async () => 800 },
      });
      const { items: [created] } = await firstRun.plan({ rows: [vesRow()], source: 'banescoVE' });

      const client = makeClient({
        records: [{ id: 'x', note: created.payload.note, amount: created.payload.amount, recordDate: '2026-10-20T04:00:00Z' }],
      });
      const secondRun = new WalletImporter({ client, sources: SOURCES, bcvRate: { getRate: async () => 900 } });
      const plan = await secondRun.plan({ rows: [vesRow()], source: 'banescoVE' });

      expect(statuses(plan)).toEqual([STATUS.DUPLICATE]);
    });
  });
});

describe('WalletImporter.execute', () => {
  function rows(count) {
    return Array.from({ length: count }, (_, i) => usdRow({ name: `R${i}` }));
  }

  it('sends batches of 50', async () => {
    const client = makeClient();
    const importer = new WalletImporter({ client, sources: SOURCES });
    const result = await importer.execute(await importer.plan({ rows: rows(101), source: 'banesco' }));

    expect(client.createRecords.mock.calls.map(([batch]) => batch.length)).toEqual([50, 50, 1]);
    expect(result.summary.counts[STATUS.CREATED]).toBe(101);
  });

  it('maps inputIndex to the right row in later batches', async () => {
    const createRecords = vi.fn(async (batch) => ({
      results: batch.map((_, inputIndex) => ({ inputIndex, success: inputIndex !== 1, id: 'id', error: 'bad' })),
    }));
    const client = makeClient({ createRecords });
    const importer = new WalletImporter({ client, sources: SOURCES });
    const result = await importer.execute(await importer.plan({ rows: rows(52), source: 'banesco' }));

    const failed = result.items.filter((item) => item.status === STATUS.FAILED).map((item) => item.index);
    expect(failed).toEqual([1, 51]);
  });

  it('stops after an unknown result and does not attempt later batches', async () => {
    const createRecords = vi.fn(async () => { throw new WalletUnknownResultError('timed out'); });
    const client = makeClient({ createRecords });
    const importer = new WalletImporter({ client, sources: SOURCES });
    const result = await importer.execute(await importer.plan({ rows: rows(60), source: 'banesco' }));

    expect(createRecords).toHaveBeenCalledTimes(1);
    expect(result.summary.counts[STATUS.UNKNOWN]).toBe(50);
    expect(result.summary.counts[STATUS.NOT_ATTEMPTED]).toBe(10);
  });

  it('marks a row with no result as unknown', async () => {
    const client = makeClient({ createRecords: vi.fn(async () => ({ results: [] })) });
    const importer = new WalletImporter({ client, sources: SOURCES });
    const result = await importer.execute(await importer.plan({ rows: rows(1), source: 'banesco' }));

    expect(statuses(result)).toEqual([STATUS.UNKNOWN]);
  });

  it('only sends the missing rows when re-run after a partial failure', async () => {
    const all = rows(3);
    const tags = tagRows(all, 'banesco');
    const records = [
      { id: 'a', note: `R0 ${formatTag(tags[0])}`, amount: { value: -10 }, recordDate: '2026-10-20T04:00:00Z' },
      { id: 'b', note: `R2 ${formatTag(tags[2])}`, amount: { value: -10 }, recordDate: '2026-10-20T04:00:00Z' },
    ];
    const client = makeClient({ records });
    const importer = new WalletImporter({ client, sources: SOURCES });
    await importer.execute(await importer.plan({ rows: all, source: 'banesco' }));

    const [sent] = client.createRecords.mock.calls[0];
    expect(sent).toHaveLength(1);
    expect(sent[0].note).toContain(formatTag(tags[1]));
  });
});
