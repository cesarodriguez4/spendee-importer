const fs = require('fs');
const os = require('os');
const path = require('path');
const { app } = require('../../ui/server');

const ROWS = [
  { date: '2026-09-05T12:00:00', name: 'A', income: 10, expense: null },
  { date: '2026-10-07T12:00:00', name: 'B', income: null, expense: -5 },
];

describe('UI server', () => {
  let server;
  let base;
  let periodsPath;
  const previous = process.env.PERIODS_PATH;
  const previousBoard = process.env.BOARD_ACCOUNTS_PATH;

  beforeAll(async () => {
    await new Promise((resolve) => { server = app.listen(0, '127.0.0.1', resolve); });
    base = `http://127.0.0.1:${server.address().port}`;
  });

  afterAll(async () => {
    await new Promise((resolve) => { server.close(resolve); });
  });

  beforeEach(() => {
    periodsPath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'periods-')), 'periods.json');
    process.env.PERIODS_PATH = periodsPath;
    // No Board accounts, so the control can't depend on the real map.
    process.env.BOARD_ACCOUNTS_PATH = path.join(os.tmpdir(), 'no-such-board-accounts.json');
  });

  afterEach(() => {
    if (previous === undefined) delete process.env.PERIODS_PATH;
    else process.env.PERIODS_PATH = previous;
    if (previousBoard === undefined) delete process.env.BOARD_ACCOUNTS_PATH;
    else process.env.BOARD_ACCOUNTS_PATH = previousBoard;
  });

  const exportRows = (body) => fetch(`${base}/api/export`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rows: ROWS, fileName: 'x.csv', ...body }),
  });

  it('lists the company sources even with no record, without a Board that has no accounts', async () => {
    const { sources } = await (await fetch(`${base}/api/status`)).json();
    const bancamiga = sources.find((s) => s.source === 'bancamiga');
    expect(bancamiga).toMatchObject({ coveredThrough: null, destinations: ['odoo'] });
    expect(sources.find((s) => s.source === 'payoneerCelssica')).toBeTruthy();
  });

  it('returns an error instead of an empty control when the file is damaged', async () => {
    fs.mkdirSync(path.dirname(periodsPath), { recursive: true });
    fs.writeFileSync(periodsPath, 'nope');
    const res = await fetch(`${base}/api/status`);
    expect(res.status).toBe(500);
    expect((await res.json()).error).toMatch(/damaged/);
  });

  it('records the period of an Odoo export', async () => {
    const res = await exportRows({ format: 'odoo', source: 'bancamiga' });
    expect(res.status).toBe(200);

    const { sources } = await (await fetch(`${base}/api/status`)).json();
    const [saved] = sources.find((s) => s.source === 'bancamiga').periods;
    expect(saved).toMatchObject({ from: '2026-09-05', to: '2026-10-07', via: 'odoo', file: 'x.csv' });
  });

  it('keeps the Odoo file format', async () => {
    const res = await exportRows({ format: 'odoo', source: 'bancamiga' });
    const bytes = Buffer.from(await res.arrayBuffer());
    expect([...bytes.subarray(0, 3)]).toEqual([0xEF, 0xBB, 0xBF]);
    expect(bytes.toString('utf8')).toContain('Date,Payment Reference,Reference,Amount,Partner,Journal');
  });

  it.each([
    ['other formats', { format: 'wallet', source: 'bancamiga' }],
    ['unknown sources', { format: 'odoo', source: 'nope' }],
    ['a missing source', { format: 'odoo' }],
  ])('records nothing for %s', async (_, body) => {
    const res = await exportRows(body);
    expect(res.status).toBe(200);
    expect(fs.existsSync(periodsPath)).toBe(false);
  });

  it('still delivers the export when the control file is damaged', async () => {
    fs.mkdirSync(path.dirname(periodsPath), { recursive: true });
    fs.writeFileSync(periodsPath, 'nope');
    const res = await exportRows({ format: 'odoo', source: 'bancamiga' });
    expect(res.status).toBe(200);
    expect(fs.readFileSync(periodsPath, 'utf8')).toBe('nope');
  });
});
