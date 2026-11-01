#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.join(__dirname, '..');
require('dotenv').config({ path: path.join(REPO_ROOT, '.env') });

const { getRows } = require('../src/services/TransactionService');
const { RECEIPT_SOURCE } = require('../src/parsers/ReceiptParser');
const { DriveScreenshotSource, LocalScreenshotSource } = require('../src/screenshots/ScreenshotSource');
const { ScreenshotLedger } = require('../src/screenshots/ScreenshotLedger');
const { STATUS } = require('../src/wallet');
const { createImporter } = require('../src/wallet/createImporter');

const LEDGER_PATH = process.env.SCREENSHOTS_LEDGER || path.join(REPO_ROOT, 'state', 'screenshots-ledger.json');
const DOWNLOAD_DIR = path.join(REPO_ROOT, 'tmp', 'screenshots');
const DEFAULT_LIMIT = 50;

const EXIT_OK = 0;
const EXIT_PARTIAL = 2;

// Worth another look next run. Everything else is reported once and put to rest.
const RETRY_STATUSES = new Set([STATUS.RATE_UNAVAILABLE, STATUS.UNKNOWN, STATUS.NOT_ATTEMPTED]);

function usage() {
  return [
    'Usage:',
    '  node scripts/sync-screenshots.js fetch [--dir=<folder>] [--since=<YYYY-MM-DD>] [--limit=<n>]',
    '  node scripts/sync-screenshots.js record <receipts.json> [--apply]',
  ].join('\n');
}

function readFlag(argv, name) {
  const flag = argv.find((arg) => arg.startsWith(`--${name}=`));
  return flag ? flag.slice(name.length + 3) : '';
}

function createSource(argv) {
  const dir = readFlag(argv, 'dir') || process.env.SCREENSHOTS_DIR;
  if (dir) return new LocalScreenshotSource(dir);
  return new DriveScreenshotSource({
    folderId: process.env.SCREENSHOTS_DRIVE_FOLDER_ID,
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    refreshToken: process.env.GOOGLE_REFRESH_TOKEN,
  });
}

function clearDownloads() {
  fs.rmSync(DOWNLOAD_DIR, { recursive: true, force: true });
}

async function fetchScreenshots(argv) {
  const ledger = new ScreenshotLedger(LEDGER_PATH);
  const source = createSource(argv);
  const since = readFlag(argv, 'since') ? new Date(readFlag(argv, 'since')).toISOString() : ledger.since;
  const limit = Number(readFlag(argv, 'limit')) || DEFAULT_LIMIT;

  const pending = (await source.list({ since })).filter((file) => !ledger.isDone(file.id));
  clearDownloads();
  fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });

  const screenshots = [];
  for (const file of pending.slice(0, limit)) {
    screenshots.push({ id: file.id, name: file.name, createdTime: file.createdTime, path: await source.download(file, DOWNLOAD_DIR) });
  }

  console.log(JSON.stringify({ status: 'ok', pending: pending.length, screenshots }, null, 2));
  return EXIT_OK;
}

function settle(ledger, ids, status, reason, applied, overdue) {
  for (const id of ids) {
    if (RETRY_STATUSES.has(status)) {
      if (ledger.markRetry(id, status)) overdue.push({ id, status, reason });
    } else if (applied) {
      ledger.markDone(id, status, reason);
    }
  }
}

async function recordScreenshots(argv) {
  const file = argv.find((arg) => !arg.startsWith('--'));
  if (!file) throw new Error(usage());
  const apply = argv.includes('--apply');

  const buffer = fs.readFileSync(path.resolve(file));
  const document = JSON.parse(buffer.toString('utf8'));
  const rows = getRows({ buffer, source: RECEIPT_SOURCE });

  const importer = createImporter();
  const plan = await importer.plan({ rows, source: RECEIPT_SOURCE });
  const result = apply ? await importer.execute(plan) : plan;

  const ledger = new ScreenshotLedger(LEDGER_PATH);
  const overdue = [];
  for (const shot of document.screenshots || []) {
    if (shot.kind !== 'receipt' && apply) ledger.markDone(shot.id, 'other');
  }
  for (const item of result.items) {
    settle(ledger, item.row.origins || [], item.status, item.reason, apply, overdue);
  }
  if (apply) {
    ledger.save();
    clearDownloads();
  }

  const report = {
    status: 'ok',
    applied: apply,
    summary: result.summary,
    overdue,
    items: result.items.map((item) => ({
      status: item.status,
      tag: item.tag,
      screenshots: item.row.origins,
      name: item.row.name,
      amount: item.amount,
      currency: item.row.currency,
      reason: item.reason,
    })),
  };
  console.log(JSON.stringify(report, null, 2));

  const { counts } = result.summary;
  return counts[STATUS.FAILED] || counts[STATUS.UNKNOWN] || counts[STATUS.NOT_ATTEMPTED] ? EXIT_PARTIAL : EXIT_OK;
}

async function main() {
  const [command, ...rest] = process.argv.slice(2);
  if (command === 'fetch') return fetchScreenshots(rest);
  if (command === 'record') return recordScreenshots(rest);
  throw new Error(usage());
}

main()
  .then((code) => { process.exitCode = code; })
  .catch((err) => {
    console.log(JSON.stringify({ status: 'error', error: err.message }, null, 2));
    process.exitCode = 1;
  });
