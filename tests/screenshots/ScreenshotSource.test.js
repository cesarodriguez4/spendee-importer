const fs = require('fs');
const os = require('os');
const path = require('path');
const { DriveScreenshotSource, LocalScreenshotSource } = require('../../src/screenshots/ScreenshotSource');

const CREDENTIALS = { folderId: 'folder', clientId: 'c', clientSecret: 's', refreshToken: 'r' };

function makeDriveFetch() {
  const pages = [
    { files: [{ id: 'a', name: 'a.png', createdTime: 't' }], nextPageToken: 'more' },
    { files: [{ id: 'b', name: 'b.png', createdTime: 't' }] },
  ];
  const calls = [];
  const fetch = async (url, options = {}) => {
    calls.push({ url, options });
    if (url.includes('oauth2')) return { ok: true, json: async () => ({ access_token: 'token' }) };
    if (url.includes('alt=media')) return { ok: true, arrayBuffer: async () => new TextEncoder().encode('img').buffer };
    return { ok: true, json: async () => pages.shift() };
  };
  return { fetch, calls };
}

describe('DriveScreenshotSource', () => {
  it('requires its credentials', () => {
    expect(() => new DriveScreenshotSource({ ...CREDENTIALS, refreshToken: '' })).toThrow(/refreshToken/);
  });

  it('lists every page of images created after the cutoff', async () => {
    const { fetch, calls } = makeDriveFetch();
    const files = await new DriveScreenshotSource({ ...CREDENTIALS, fetch }).list({ since: '2026-11-01T00:00:00.000Z' });
    const query = decodeURIComponent(calls[1].url.replace(/\+/g, ' '));

    expect(files.map((f) => f.id)).toEqual(['a', 'b']);
    expect(query).toContain("'folder' in parents");
    expect(query).toContain("createdTime > '2026-11-01T00:00:00.000Z'");
    expect(calls[2].url).toContain('pageToken=more');
  });

  it('only issues read requests to Drive', async () => {
    const { fetch, calls } = makeDriveFetch();
    const source = new DriveScreenshotSource({ ...CREDENTIALS, fetch });
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'drive-'));
    const target = await source.download({ id: 'a', name: 'a.png' }, dir);

    expect(fs.readFileSync(target, 'utf8')).toBe('img');
    const driveCalls = calls.filter((c) => c.url.includes('googleapis.com/drive'));
    expect(driveCalls.every((c) => !c.options.method || c.options.method === 'GET')).toBe(true);
  });
});

describe('LocalScreenshotSource', () => {
  it('lists recent images and leaves the originals in place', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'shots-'));
    fs.writeFileSync(path.join(dir, 'old.png'), 'x');
    fs.utimesSync(path.join(dir, 'old.png'), new Date('2020-01-01'), new Date('2020-01-01'));
    fs.writeFileSync(path.join(dir, 'new.PNG'), 'x');
    fs.writeFileSync(path.join(dir, 'notes.txt'), 'x');

    const source = new LocalScreenshotSource(dir);
    const files = await source.list({ since: '2021-01-01T00:00:00.000Z' });

    expect(files.map((f) => f.name)).toEqual(['new.PNG']);
    expect(await source.download(files[0])).toBe(path.join(dir, 'new.PNG'));
  });
});
