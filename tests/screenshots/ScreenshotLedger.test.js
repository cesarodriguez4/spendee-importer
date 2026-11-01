const fs = require('fs');
const os = require('os');
const path = require('path');
const { ScreenshotLedger } = require('../../src/screenshots/ScreenshotLedger');

function tempPath() {
  return path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'ledger-')), 'nested', 'ledger.json');
}

describe('ScreenshotLedger', () => {
  it('fixes the start date on first use and keeps it', () => {
    const file = tempPath();
    const since = new ScreenshotLedger(file, () => new Date('2026-11-01T00:00:00Z')).since;
    expect(since).toBe('2026-11-01T00:00:00.000Z');
    expect(new ScreenshotLedger(file, () => new Date('2027-01-01T00:00:00Z')).since).toBe(since);
  });

  it('remembers finished screenshots', () => {
    const file = tempPath();
    const ledger = new ScreenshotLedger(file);
    ledger.markDone('a', 'created');
    ledger.save();
    expect(new ScreenshotLedger(file).isDone('a')).toBe(true);
    expect(new ScreenshotLedger(file).isDone('b')).toBe(false);
  });

  it('flags a screenshot stuck for over a day', () => {
    let now = new Date('2026-11-01T00:00:00Z');
    const ledger = new ScreenshotLedger(tempPath(), () => now);
    expect(ledger.markRetry('a', 'rate_unavailable')).toBe(false);
    now = new Date('2026-11-02T01:00:00Z');
    expect(ledger.markRetry('a', 'rate_unavailable')).toBe(true);
    expect(ledger.isDone('a')).toBe(false);
  });

  it('starts clean from an unreadable file', () => {
    const file = tempPath();
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, 'not json');
    expect(new ScreenshotLedger(file).isDone('a')).toBe(false);
  });
});
