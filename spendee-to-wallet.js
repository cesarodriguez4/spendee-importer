const path = require('path');
const { CsvReader } = require('./src/core/CsvReader');
const { ExcelWriter } = require('./src/core/ExcelWriter');
const { SpendeeParser } = require('./src/parsers/SpendeeParser');
const { Row } = require('./src/core/Row');

const input = process.argv[2];
if (!input) {
  console.error('Usage: node spendee-to-wallet.js <input.csv> [<output.xlsx>]');
  process.exit(1);
}

const base = path.basename(input, path.extname(input));
const output = process.argv[3] || `${base}_wallet.xlsx`;

const { rows: rawRows } = new CsvReader().read(input);
const rows = new SpendeeParser().parse(rawRows);
const data = [Row.headers(), ...rows.map((r) => r.toArray())];
const fullPath = new ExcelWriter().write(output, data);
console.log(`Wrote ${rows.length} transactions to ${fullPath}`);
