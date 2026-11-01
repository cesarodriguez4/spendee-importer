const { spawn } = require('child_process');
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const xlsx = require('node-xlsx');

const ROOT = path.join(__dirname, '..', '..');
const IMPORT = path.join(ROOT, 'scripts', 'import-to-wallet.js');
const SYNC = path.join(ROOT, 'scripts', 'sync-screenshots.js');

// An account id that sources.json can't map, passed with --account.
const ACCOUNT = { id: 'acc', name: 'Test', currencyCode: 'USD' };

function run(script, args, env = {}) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [script, ...args], {
      // WALLET_API_URL points at the fake server, so no test can reach the real API.
      env: { PATH: process.env.PATH, WALLET_API_KEY: '', WALLET_API_URL: 'http://127.0.0.1:9', ...env },
      cwd: os.tmpdir(),
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (data) => { stdout += data; });
    child.stderr.on('data', (data) => { stderr += data; });
    child.on('close', (code) => resolve({ code, stdout, stderr }));
  });
}

function writeTemp(name, content) {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'cli-')), name);
  fs.writeFileSync(file, content);
  return file;
}

function banescoFile(name = 'movimientos.xlsx') {
  return writeTemp(name, Buffer.from(xlsx.build([{
    name: 'Sheet',
    data: [
      ...Array.from({ length: 8 }, () => ['cabecera']),
      ['', '26/10/2026', 'COMPRA', -8.35, 100],
      ['', '25/10/2026', 'PAGO', -2.5, 108.35],
    ],
  }])));
}

function startWallet({ existing = [], respond } = {}) {
  const posts = [];
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      const send = (status, payload) => {
        res.writeHead(status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(payload));
      };
      const url = req.url.split('?')[0];
      if (req.method === 'POST') {
        const batch = JSON.parse(body);
        posts.push(batch);
        if (respond) return respond(batch, send);
        return send(200, {
          summary: { total: batch.length, succeeded: batch.length },
          results: batch.map((_, inputIndex) => ({ inputIndex, success: true, id: `r${inputIndex}` })),
        });
      }
      if (url.endsWith('/accounts')) return send(200, { accounts: [ACCOUNT] });
      if (url.endsWith('/categories')) return send(200, { categories: [] });
      if (url.endsWith('/labels')) return send(200, { labels: [] });
      if (url.endsWith('/records')) return send(200, { records: [...existing, ...posts.flat().map((p, i) => ({ id: `r${i}`, ...p }))] });
      return send(404, { error: 'not found' });
    });
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve({
      posts,
      env: { WALLET_API_KEY: 'test', WALLET_API_URL: `http://127.0.0.1:${server.address().port}/wallet` },
      close: () => new Promise((done) => { server.close(done); }),
    }));
  });
}

describe('import-to-wallet', () => {
  let wallet;
  afterEach(async () => {
    if (wallet) await wallet.close();
    wallet = null;
  });

  it('writes nothing without --apply', async () => {
    wallet = await startWallet();
    const { code, stdout } = await run(IMPORT, [banescoFile(), '--account=acc', '--json'], wallet.env);
    const report = JSON.parse(stdout);

    expect(code).toBe(0);
    expect(wallet.posts).toHaveLength(0);
    expect(report.applied).toBe(false);
    expect(report.source).toBe('banesco');
    expect(report.summary.counts.new).toBe(2);
  });

  it('detects the source and uploads with --apply', async () => {
    wallet = await startWallet();
    const { code, stdout } = await run(IMPORT, [banescoFile(), '--account=acc', '--apply', '--json'], wallet.env);

    expect(code).toBe(0);
    expect(wallet.posts[0]).toHaveLength(2);
    expect(wallet.posts[0][0].note).toMatch(/\[si:[0-9a-f]{10}\]$/);
    expect(JSON.parse(stdout).summary.counts.created).toBe(2);
  });

  it('creates nothing when the same file is uploaded twice', async () => {
    wallet = await startWallet();
    const file = banescoFile();
    await run(IMPORT, [file, '--account=acc', '--apply', '--json'], wallet.env);
    const { stdout } = await run(IMPORT, [file, '--account=acc', '--apply', '--json'], wallet.env);

    expect(wallet.posts).toHaveLength(1);
    expect(JSON.parse(stdout).summary.counts.duplicate).toBe(2);
  });

  it('exits 2 and keeps the detail when rows fail', async () => {
    wallet = await startWallet({
      respond: (batch, send) => send(400, {
        summary: { total: batch.length, succeeded: 0 },
        results: batch.map((_, inputIndex) => ({ inputIndex, success: false, error: 'bad amount', errorType: 'client_error' })),
      }),
    });
    const { code, stdout } = await run(IMPORT, [banescoFile(), '--account=acc', '--apply', '--json'], wallet.env);

    expect(code).toBe(2);
    expect(JSON.parse(stdout).items[0].reason).toBe('bad amount');
  });

  it('stops without writing when the source cannot be identified', async () => {
    wallet = await startWallet();
    const file = writeTemp('notas.xlsx', Buffer.from(xlsx.build([{ name: 'S', data: [['hola']] }])));
    const { code, stdout } = await run(IMPORT, [file, '--apply', '--json'], wallet.env);

    expect(code).toBe(1);
    expect(JSON.parse(stdout).status).toBe('source_ambiguous');
    expect(wallet.posts).toHaveLength(0);
  });

  it('fails without an API key unless a file was requested', async () => {
    const { code, stderr } = await run(IMPORT, [banescoFile()]);
    expect(code).toBe(1);
    expect(stderr).toMatch(/WALLET_API_KEY/);
  });

  it('exits 1 when the file cannot be parsed, since nothing was written', async () => {
    wallet = await startWallet();
    const data = Array.from({ length: 9 }, () => ['hola']);
    const file = writeTemp('x.xlsx', Buffer.from(xlsx.build([{ name: 'S', data }])));
    const { code } = await run(IMPORT, [file, '--source=banesco', '--account=acc', '--apply'], wallet.env);

    expect(code).toBe(1);
    expect(wallet.posts).toHaveLength(0);
  });

  it('rejects unknown arguments', async () => {
    const { code, stderr } = await run(IMPORT, [banescoFile(), '--aply']);
    expect(code).toBe(1);
    expect(stderr).toMatch(/--aply/);
  });

  it('reports a missing file', async () => {
    const { code, stderr } = await run(IMPORT, ['/no/such/file.xls']);
    expect(code).toBe(1);
    expect(stderr).toMatch(/not found/i);
  });
});

describe('sync-screenshots record', () => {
  let wallet;
  afterEach(async () => {
    if (wallet) await wallet.close();
    wallet = null;
  });

  function review() {
    return writeTemp('receipts.json', JSON.stringify({
      screenshots: [
        { id: 'cat', kind: 'other' },
        { id: 'pending', kind: 'receipt', bank: 'binancePay', status: 'pending', direction: 'expense', amount: 5, currency: 'USDT', date: '2026-10-20 10:00', reference: 'P_1' },
      ],
    }));
  }

  it('settles reviewed screenshots only with --apply', async () => {
    wallet = await startWallet();
    const ledgerPath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'ledger-')), 'ledger.json');
    const env = { ...wallet.env, SCREENSHOTS_LEDGER: ledgerPath };

    const dry = await run(SYNC, ['record', review()], env);
    expect(JSON.parse(dry.stdout).summary.counts.held).toBe(1);
    expect(fs.existsSync(ledgerPath)).toBe(false);

    const applied = await run(SYNC, ['record', review(), '--apply'], env);
    expect(applied.code).toBe(0);
    expect(wallet.posts).toHaveLength(0);

    const { done } = JSON.parse(fs.readFileSync(ledgerPath, 'utf8'));
    expect(done.cat.status).toBe('other');
    expect(done.pending.status).toBe('held');
  });
});
