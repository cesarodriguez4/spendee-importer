#!/usr/bin/env node

const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { matchesDateFormat } = require('../src/core/dateParser');
const { PeriodLog } = require('../src/periods/PeriodLog');
const { trackedSources } = require('../src/periods/trackedSources');
const { SOURCES_META } = require('../src/services/TransactionService');

const VIAS = ['wallet', 'odoo', 'board', 'manual'];

function usage() {
  return [
    'Usage:',
    '  node scripts/periods.js status [--json]',
    `  node scripts/periods.js add --source=<id> --from=<YYYY-MM-DD> --to=<YYYY-MM-DD> [--via=${VIAS.join('|')}]`,
  ].join('\n');
}

function readFlag(argv, name) {
  const flag = argv.find((arg) => arg.startsWith(`--${name}=`));
  return flag ? flag.slice(name.length + 3) : '';
}

function printStatus(argv) {
  const status = new PeriodLog().status({ sources: trackedSources() });
  if (argv.includes('--json')) {
    console.log(JSON.stringify({ status: 'ok', sources: status }, null, 2));
    return;
  }
  for (const entry of status) {
    const behind = entry.daysBehind === null ? 'no record' : `${entry.daysBehind} day(s) behind`;
    const flag = entry.overdue ? ' OVERDUE' : '';
    console.log(`${entry.label}: through ${entry.coveredThrough || '-'} (${behind})${flag}, last screenshot ${entry.lastScreenshot || '-'}`);
    for (const gap of entry.gaps) console.log(`  possible gap: ${gap.from} to ${gap.to} (${gap.days} days)`);
  }
}

function addPeriod(argv) {
  const source = readFlag(argv, 'source');
  const from = readFlag(argv, 'from');
  const to = readFlag(argv, 'to');
  const via = readFlag(argv, 'via') || 'manual';

  if (!SOURCES_META.some((meta) => meta.id === source)) throw new Error(`Unknown source: ${source}`);
  if (!VIAS.includes(via)) throw new Error(`Unknown via: ${via}`);
  if (!matchesDateFormat(from, 'YYYY-MM-DD') || !matchesDateFormat(to, 'YYYY-MM-DD')) {
    throw new Error('--from and --to must be YYYY-MM-DD.');
  }
  if (from > to) throw new Error('--from is after --to.');

  new PeriodLog().recordPeriod({ source, from, to, via });
  console.log(`Recorded ${source}: ${from} to ${to} (${via}).`);
}

function main() {
  const [command, ...rest] = process.argv.slice(2);
  if (command === 'status') return printStatus(rest);
  if (command === 'add') return addPeriod(rest);
  throw new Error(usage());
}

try {
  main();
} catch (err) {
  console.error(err.message);
  process.exitCode = 1;
}
