#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { destinationsFor, detectSource, expandOptions, getRows, SOURCES_META } = require('../src/services/TransactionService');
const { ExcelWriter } = require('../src/core/ExcelWriter');
const { OdooCsvWriter } = require('../src/core/OdooCsvWriter');
const { Row } = require('../src/core/Row');
const { PeriodLog, coveredRange, rangeOf } = require('../src/periods/PeriodLog');
const { STATUS } = require('../src/wallet');
const { createImporter } = require('../src/wallet/createImporter');

const EXIT_OK = 0;
const EXIT_USAGE = 1;
const EXIT_PARTIAL = 2;

const FLAGS = ['--apply', '--json', '--dry-run'];
const VALUES = ['source', 'output', 'odoo', 'category', 'account', 'accept'];

class UsageError extends Error {}

function usage() {
  return [
    'Usage: node scripts/import-to-wallet.js <file> [--source=<id>] [--apply] [--json]',
    '         [--account=<id>] [--accept=<tag,...>] [--category=<name>] [--output=<xlsx>] [--odoo=<csv>] [--<option>=<value>]',
    `Sources: ${SOURCES_META.map((s) => s.id).join(', ')}`,
    'Without --apply nothing is written to Wallet.',
  ].join('\n');
}

function parseArgs(argv) {
  const positional = argv.filter((arg) => !arg.startsWith('--'));
  if (positional.length !== 1) throw new UsageError('Expected exactly one file.');

  const flags = argv.filter((arg) => arg.startsWith('--'));
  const optionNames = new Set(SOURCES_META.flatMap((s) => s.options.map((o) => o.name)));
  const values = {};
  const options = {};

  for (const flag of flags) {
    if (FLAGS.includes(flag)) continue;
    const [, name, value] = /^--([^=]+)=(.*)$/.exec(flag) || [];
    if (VALUES.includes(name)) values[name] = value;
    else if (optionNames.has(name)) options[name] = value;
    else throw new UsageError(`Unknown argument: ${flag}`);
  }

  return {
    file: positional[0],
    apply: flags.includes('--apply'),
    json: flags.includes('--json'),
    source: values.source || '',
    output: values.output || '',
    odoo: values.odoo || '',
    category: values.category || '',
    account: values.account || '',
    accept: values.accept ? values.accept.split(',').map((tag) => tag.trim()) : [],
    options,
  };
}

function resolveSource({ source, buffer, fileName }) {
  if (source) {
    if (!SOURCES_META.some((meta) => meta.id === source)) throw new UsageError(`Unknown source: ${source}`);
    return source;
  }
  const detected = detectSource({ buffer, fileName });
  if (detected.source) return detected.source;

  const found = detected.candidates.length ? detected.candidates.join(', ') : 'none';
  const error = new UsageError(`Could not identify the source of ${fileName} (matches: ${found}). Use --source=<id>.`);
  error.status = 'source_ambiguous';
  error.candidates = detected.candidates;
  throw error;
}

function readRows({ buffer, source, fileName, options }) {
  const meta = SOURCES_META.find((s) => s.id === source);
  return expandOptions(source, options).flatMap((runOptions) => {
    const missing = meta.options.filter((o) => o.required && !runOptions[o.name]).map((o) => `--${o.name}`);
    if (missing.length) throw new UsageError(`Source "${source}" requires ${missing.join(', ')}.`);
    return getRows({ buffer, source, fileName, options: runOptions });
  });
}

function exportsDir() {
  const dir = path.join(__dirname, '..', 'exports');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function writeOdooFile(rows, output) {
  const outPath = path.join(exportsDir(), path.basename(output));
  fs.writeFileSync(outPath, OdooCsvWriter.buildExport(rows));
  return outPath;
}

// The movements are already out by the time this runs. A control file that can't
// be saved is worth a warning, not a failed import.
function recordPeriod({ source, range, via, fileName }) {
  try {
    const log = new PeriodLog();
    if (range) log.recordPeriod({ source, ...range, via, file: fileName });
    return { coveredThrough: log.coveredThrough(source) };
  } catch (err) {
    console.error(`Could not update the period control: ${err.message}`);
    return { coveredThrough: null, periodWarning: err.message };
  }
}

function writeSpreadsheet(rows, output) {
  const data = [
    Row.headersWithPayeeCurrency(),
    ...rows.map((row) => [...new Row(row).toArray(), row.payee ?? '', row.currency ?? '']),
  ];
  return new ExcelWriter(exportsDir()).write(path.basename(output), data, 'Wallet Import');
}

function describe(result, apply, period) {
  const lines = [
    `${result.source}: ${result.summary.total} row(s), ${result.summary.from} to ${result.summary.to}`,
    `Totals: ${Object.entries(result.summary.totals).map(([currency, total]) => `${total} ${currency}`).join(', ') || 'none'}`,
  ];
  for (const [status, count] of Object.entries(result.summary.counts)) lines.push(`  ${status}: ${count}`);

  for (const item of result.items) {
    if ([STATUS.NEW, STATUS.CREATED, STATUS.DUPLICATE].includes(item.status)) continue;
    lines.push(`  [${item.status}] row ${item.index} tag ${item.tag}: ${item.row.name} (${item.reason || 'no detail'})`);
  }
  if (result.summary.unmappedCategories?.length) {
    lines.push(`Categories not found in Wallet: ${result.summary.unmappedCategories.join(', ')}`);
  }
  if (apply && period.coveredThrough) lines.push(`Up to date through ${period.coveredThrough}.`);
  if (!apply) lines.push('Nothing was written. Use --apply to create the new rows.');
  return lines.join('\n');
}

function toJson(result, applied, period) {
  return {
    status: 'ok',
    applied,
    source: result.source,
    summary: result.summary,
    ...period,
    items: result.items.map((item) => ({
      index: item.index,
      status: item.status,
      tag: item.tag,
      date: item.row.date,
      name: item.row.name,
      amount: item.amount,
      currency: item.row.currency,
      accountId: item.accountId,
      id: item.id,
      match: item.match,
      reason: item.reason,
      errorType: item.errorType,
      fields: item.fields,
    })),
  };
}

function exitCodeFor(result) {
  const { counts } = result.summary;
  return counts[STATUS.FAILED] || counts[STATUS.UNKNOWN] || counts[STATUS.NOT_ATTEMPTED] ? EXIT_PARTIAL : EXIT_OK;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.odoo && (args.apply || args.output)) throw new UsageError('--odoo cannot be combined with --apply or --output.');

  const fullPath = path.resolve(args.file);
  if (!fs.existsSync(fullPath)) throw new UsageError(`File not found: ${fullPath}`);

  const fileName = path.basename(fullPath);
  const buffer = fs.readFileSync(fullPath);
  const source = resolveSource({ source: args.source, buffer, fileName });
  const rows = readRows({ buffer, source, fileName, options: args.options });
  const forced = args.category ? rows.map((row) => ({ ...row, category: args.category })) : rows;

  if (args.odoo) {
    const outPath = writeOdooFile(forced, args.odoo);
    const period = recordPeriod({ source, range: rangeOf(rows.map((row) => row.date)), via: 'odoo', fileName });
    const report = { status: 'ok', applied: false, source, rows: rows.length, output: outPath, ...period };
    console.log(args.json ? JSON.stringify(report, null, 2) : `Wrote ${rows.length} row(s) to ${outPath}`);
    return EXIT_OK;
  }

  if (args.output) {
    const outPath = writeSpreadsheet(forced, args.output);
    const report = { status: 'ok', applied: false, source, rows: rows.length, output: outPath };
    console.log(args.json ? JSON.stringify(report, null, 2) : `Wrote ${rows.length} row(s) to ${outPath}`);
    return EXIT_OK;
  }

  const destinations = destinationsFor(source);
  if (!destinations.includes('wallet')) {
    throw new UsageError(`"${source}" goes to ${destinations.join(' and ')}, not Wallet. Use --odoo=<csv>.`);
  }

  if (!process.env.WALLET_API_KEY) throw new UsageError('WALLET_API_KEY is not set. Use --output=<xlsx> for a file instead.');

  const importer = createImporter();
  const plan = await importer.plan({
    rows,
    source,
    accountId: args.account,
    forceCategory: args.category,
    accept: args.accept,
  });
  const result = args.apply ? await importer.execute(plan) : plan;
  const period = args.apply
    ? recordPeriod({ source, range: coveredRange(result.items), via: 'wallet', fileName })
    : {};

  console.log(args.json ? JSON.stringify(toJson(result, args.apply, period), null, 2) : describe(result, args.apply, period));
  return exitCodeFor(result);
}

main()
  .then((code) => { process.exitCode = code; })
  .catch((err) => {
    const json = process.argv.includes('--json');
    if (json) {
      console.log(JSON.stringify({
        status: err.status || 'error',
        error: err.message,
        candidates: err.candidates,
      }, null, 2));
    } else {
      console.error(err.message);
      if (err instanceof UsageError) console.error(usage());
      if (process.env.DEBUG) console.error(err.stack);
    }
    // WalletImporter.execute reports write failures itself, so reaching this
    // point means nothing was written.
    process.exitCode = EXIT_USAGE;
  });
