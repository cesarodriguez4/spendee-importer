const fs = require('fs');
const os = require('os');
const path = require('path');
const { PeriodLog, coveredRange, rangeOf } = require('../../src/periods/PeriodLog');

const SOURCES = [
  { id: 'banesco', label: 'Banesco', destinations: ['wallet'] },
  { id: 'bancamiga', label: 'Bancamiga', destinations: ['odoo', 'board'] },
];

function makeLog() {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'periods-')), 'nested', 'periods.json');
  return { file, log: new PeriodLog(file, () => new Date('2026-11-01T12:00:00')) };
}

function entry(log, id, today = '2026-11-01') {
  return log.status({ sources: SOURCES, today }).find((s) => s.source === id);
}

function period(from, to, via = 'wallet', source = 'banesco') {
  return { source, from, to, via };
}

describe('PeriodLog', () => {
  it('reports how far a source is covered and how far behind it is', () => {
    const { log } = makeLog();
    log.recordPeriod(period('2026-09-10', '2026-10-05'));
    expect(entry(log, 'banesco')).toMatchObject({ coveredThrough: '2026-10-05', daysBehind: 27, overdue: false });
  });

  it('never moves coveredThrough back when an older file is loaded', () => {
    const { log } = makeLog();
    log.recordPeriod(period('2026-09-10', '2026-10-05'));
    log.recordPeriod(period('2026-08-01', '2026-08-31'));
    expect(entry(log, 'banesco').coveredThrough).toBe('2026-10-05');
  });

  it('refreshes a repeated range instead of adding a line', () => {
    const { log } = makeLog();
    log.recordPeriod(period('2026-09-10', '2026-10-05'));
    log.recordPeriod(period('2026-09-10', '2026-10-05'));
    expect(entry(log, 'banesco').periods).toHaveLength(1);
  });

  it('keeps the same range through different destinations apart', () => {
    const { log } = makeLog();
    log.recordPeriod(period('2026-09-10', '2026-10-05', 'odoo'));
    log.recordPeriod(period('2026-09-10', '2026-10-05', 'board'));
    expect(entry(log, 'banesco').periods).toHaveLength(2);
  });

  it('is only as current as its most behind destination', () => {
    const { log } = makeLog();
    log.recordPeriod(period('2026-09-01', '2026-10-31', 'odoo', 'bancamiga'));
    expect(entry(log, 'bancamiga')).toMatchObject({
      coveredThrough: null,
      daysBehind: null,
      byDestination: {
        odoo: { coveredThrough: '2026-10-31', daysBehind: 1 },
        board: { coveredThrough: null, daysBehind: null },
      },
    });

    log.recordPeriod(period('2026-09-01', '2026-10-15', 'board', 'bancamiga'));
    expect(entry(log, 'bancamiga')).toMatchObject({ coveredThrough: '2026-10-15', daysBehind: 17 });
  });

  it('finds gaps per destination, not across them', () => {
    const { log } = makeLog();
    log.recordPeriod(period('2026-08-01', '2026-08-31', 'odoo', 'bancamiga'));
    log.recordPeriod(period('2026-08-01', '2026-08-31', 'board', 'bancamiga'));
    log.recordPeriod(period('2026-10-01', '2026-10-31', 'odoo', 'bancamiga'));
    log.recordPeriod(period('2026-09-01', '2026-10-31', 'board', 'bancamiga'));
    const { gaps, byDestination } = entry(log, 'bancamiga');
    expect(byDestination.board.gaps).toEqual([]);
    expect(gaps).toEqual([{ from: '2026-08-31', to: '2026-10-01', days: 31, destination: 'odoo' }]);
  });

  it('counts a manual correction for every destination', () => {
    const { log } = makeLog();
    log.recordPeriod(period('2026-09-01', '2026-10-20', 'manual', 'bancamiga'));
    expect(entry(log, 'bancamiga').byDestination).toMatchObject({
      odoo: { coveredThrough: '2026-10-20' },
      board: { coveredThrough: '2026-10-20' },
    });
  });

  it('reports coverage for one destination when asked', () => {
    const { log } = makeLog();
    log.recordPeriod(period('2026-09-01', '2026-10-31', 'odoo', 'bancamiga'));
    log.recordPeriod(period('2026-09-01', '2026-10-15', 'board', 'bancamiga'));
    expect(log.coveredThrough('bancamiga', 'board')).toBe('2026-10-15');
    expect(log.coveredThrough('bancamiga')).toBe('2026-10-31');
  });

  it('records nothing without a range', () => {
    const { file, log } = makeLog();
    expect(log.recordPeriod({ source: 'banesco', via: 'wallet' })).toBe(false);
    expect(fs.existsSync(file)).toBe(false);
  });

  it.each([
    [30, false],
    [31, true],
  ])('at %i days behind, overdue is %s', (days, overdue) => {
    const { log } = makeLog();
    log.recordPeriod(period('2026-09-01', '2026-10-01'));
    const today = new Date(Date.UTC(2026, 9, 1 + days)).toISOString().slice(0, 10);
    expect(entry(log, 'banesco', today).overdue).toBe(overdue);
  });

  it.each([
    ['2026-10-12', 0],
    ['2026-10-13', 1],
  ])('with the next period starting %s, it finds %i gap(s)', (from, gaps) => {
    const { log } = makeLog();
    log.recordPeriod(period('2026-09-10', '2026-10-05'));
    log.recordPeriod(period(from, '2026-10-26'));
    expect(entry(log, 'banesco').gaps).toHaveLength(gaps);
  });

  it('does not report a gap covered by a longer earlier period', () => {
    const { log } = makeLog();
    log.recordPeriod(period('2026-01-01', '2026-10-01'));
    log.recordPeriod(period('2026-02-01', '2026-02-10'));
    log.recordPeriod(period('2026-10-02', '2026-10-05'));
    expect(entry(log, 'banesco').gaps).toEqual([]);
  });

  it('keeps screenshots apart from coverage', () => {
    const { log } = makeLog();
    log.recordScreenshot({ source: 'banesco', date: '2026-10-30T14:30:00' });
    expect(entry(log, 'banesco')).toMatchObject({ coveredThrough: null, lastScreenshot: '2026-10-30', daysBehind: null });
  });

  it('keeps the most recent screenshot movement', () => {
    const { log } = makeLog();
    log.recordScreenshot({ source: 'banesco', date: '2026-10-30T14:30:00' });
    log.recordScreenshot({ source: 'banesco', date: '2026-10-01T14:30:00' });
    expect(entry(log, 'banesco').lastScreenshot).toBe('2026-10-30');
  });

  it('lists tracked sources with no record, and unknown sources that have one', () => {
    const { log } = makeLog();
    log.recordPeriod(period('2026-09-10', '2026-10-05', 'manual', 'retired'));
    const ids = log.status({ sources: SOURCES, today: '2026-11-01' }).map((s) => s.source);
    expect(ids).toEqual(expect.arrayContaining(['banesco', 'bancamiga', 'retired']));
  });

  it('sorts sources with no record first, then the furthest behind', () => {
    const { log } = makeLog();
    const sources = [...SOURCES, { id: 'mercantil', label: 'Mercantil', destinations: ['wallet'] }];
    log.recordPeriod(period('2026-09-01', '2026-10-20', 'wallet', 'banesco'));
    log.recordPeriod(period('2026-09-01', '2026-10-01', 'wallet', 'mercantil'));
    expect(log.status({ sources, today: '2026-11-01' }).map((s) => s.source)).toEqual(['bancamiga', 'mercantil', 'banesco']);
  });

  it('refuses to overwrite a damaged file', () => {
    const { file, log } = makeLog();
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, '{ not json');

    expect(() => log.recordPeriod(period('2026-09-10', '2026-10-05'))).toThrow(/damaged/);
    expect(() => log.status({ sources: SOURCES })).toThrow(/damaged/);
    expect(fs.readFileSync(file, 'utf8')).toBe('{ not json');
  });

  it('refuses a valid JSON file of the wrong shape', () => {
    const { file, log } = makeLog();
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, '[]');
    expect(() => log.status({ sources: SOURCES })).toThrow(/damaged/);
  });
});

describe('coveredRange', () => {
  const item = (status, date, extra = {}) => ({ status, row: { date }, ...extra });

  it('spans what reached Wallet', () => {
    expect(coveredRange([
      item('created', '2026-10-05T12:00:00'),
      item('duplicate', '2026-10-01T12:00:00'),
      item('possible_duplicate', '2026-10-09T12:00:00'),
    ])).toEqual({ from: '2026-10-01', to: '2026-10-09' });
  });

  it('counts rows held because they were already recorded', () => {
    expect(coveredRange([item('held', '2026-10-05T12:00:00', { alreadyRecorded: true })]))
      .toEqual({ from: '2026-10-05', to: '2026-10-05' });
  });

  it.each(['invalid', 'rate_unavailable', 'held'])('ignores %s rows', (status) => {
    expect(coveredRange([
      item('created', '2026-10-05T12:00:00'),
      item(status, '2026-10-30T12:00:00'),
    ])).toEqual({ from: '2026-10-05', to: '2026-10-05' });
  });

  it.each(['failed', 'unknown', 'not_attempted'])('vouches for nothing when a row is %s', (status) => {
    expect(coveredRange([item('created', '2026-10-05T12:00:00'), item(status, '2026-10-06T12:00:00')])).toBeNull();
  });

  it('returns null when nothing counts', () => {
    expect(coveredRange([item('invalid', '2026-10-05T12:00:00')])).toBeNull();
  });
});

describe('rangeOf', () => {
  it('ignores unreadable dates', () => {
    expect(rangeOf(['2026-10-05T12:00:00', null, 'nope', '2026-10-01T12:00:00'])).toEqual({ from: '2026-10-01', to: '2026-10-05' });
    expect(rangeOf([null])).toBeNull();
  });
});
