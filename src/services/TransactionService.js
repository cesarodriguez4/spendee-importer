const sources = require('../config/sources.json');
const categories = require('../config/categories.json');
const tags = require('../config/tags.json');
const payees = require('../config/payees.json');

const { Categorizer } = require('../core/Categorizer');
const { FileReader } = require('../core/FileReader');
const { CsvReader } = require('../core/CsvReader');
const { HtmlTableReader } = require('../core/HtmlTableReader');

const { MercantilParser } = require('../parsers/MercantilParser');
const { BancamigaParser } = require('../parsers/BancamigaParser');
const { BanescoParser } = require('../parsers/BanescoParser');
const { BanescoVEParser } = require('../parsers/BanescoVEParser');
const { BinanceParser } = require('../parsers/BinanceParser');
const { ExodusParser } = require('../parsers/ExodusParser');
const { SpendeeParser } = require('../parsers/SpendeeParser');
const { PayoneerParser } = require('../parsers/PayoneerParser');

const categorizer = new Categorizer(categories, tags, payees);
const xlsReader = new FileReader();
const csvReader = new CsvReader();
const htmlReader = new HtmlTableReader();

const SOURCES_META = [
  { id: 'mercantil', label: 'Mercantil (Panama)', accept: '.xlsx,.xls', options: [] },
  { id: 'banesco',   label: 'Banesco Panamá',       accept: '.xls,.xlsx', options: [] },
  {
    id: 'banescoVE', label: 'Banesco Venezuela',    accept: '.xls,.xlsx',
    options: [{ name: 'exchangeRate', label: 'Tasa de cambio (Bs/USD) — montos se exportan en USD', type: 'number', required: true, default: 650 }],
  },
  {
    id: 'bancamiga', label: 'Bancamiga (Venezuela)', accept: '.xls,.xlsx,.html,.htm',
    options: [{
      name: 'exchangeRate',
      label: 'Tasa de cambio (Bs/USD) — opcional; en blanco exporta en Bs',
      type: 'number', required: false,
    }],
  },
  { id: 'binance',   label: 'Binance',              accept: '.csv,.xlsx', options: [] },
  { id: 'payoneer',  label: 'Payoneer',             accept: '.csv,.xlsx', options: [] },
  {
    id: 'exodus',    label: 'Exodus',               accept: '.csv,.xlsx',
    options: [
      { name: 'startDate', label: 'Fecha desde', type: 'date', required: true },
      { name: 'endDate',   label: 'Fecha hasta', type: 'date', required: true },
      {
        name: 'wallet', label: 'Wallet/Moneda', type: 'select', required: true,
        choices: sources.exodus.wallets.map((w) => ({
          value: `${w.currency}|${w.wallet}`,
          label: `${w.currency} — ${w.wallet}`,
        })),
      },
    ],
  },
  { id: 'spendee',   label: 'Spendee → Wallet',     accept: '.csv,.xlsx,.xls', options: [] },
];

const REGISTRY = {
  mercantil: { reader: xlsReader, build: () => new MercantilParser(sources.mercantil) },
  banesco:   { reader: xlsReader, build: () => new BanescoParser(sources.banesco) },
  banescoVE: { reader: xlsReader, build: (opts) => new BanescoVEParser(sources.banescoVE, opts.exchangeRate) },
  bancamiga: { reader: htmlReader, build: (opts) => new BancamigaParser(sources.bancamiga, opts) },
  binance:   { reader: xlsReader, build: () => new BinanceParser(sources.binance) },
  payoneer:  { reader: xlsReader, build: () => new PayoneerParser(sources.payoneer) },
  exodus:    {
    reader: xlsReader,
    build: (opts) => {
      const [currency, wallet] = (opts.wallet || '').split('|');
      return new ExodusParser(sources.exodus, { currency, wallet, startDate: opts.startDate, endDate: opts.endDate });
    },
  },
  spendee:   { reader: csvReader, build: () => new SpendeeParser() },
};

// Odoo journal name for a source, '' when none is configured.
// `sources` has no entry for registry-only sources like spendee, hence the guard.
// Sources that keep a separate USD journal (Bancamiga) pick it by row currency:
// the parser already converted the amounts, so the journal has to match them.
function journalFor(source, currency) {
  const config = sources[source];
  if (!config) return '';
  if (currency === 'USD' && config.journalUSD) return config.journalUSD;
  return config.journal || '';
}

function getRows({ buffer, source, fileName = '', options = {} }) {
  const entry = REGISTRY[source];
  if (!entry) throw new Error(`Unknown source: ${source}`);

  const parser = entry.build(options);
  let rows;
  if (source === 'spendee') {
    rows = parser.parse(readSpendeeRows(buffer, fileName), categorizer);
  } else {
    rows = parser.parse(entry.reader.readBuffer(buffer), categorizer);
  }

  // Stamped here so it survives the JSON round-trip to /api/export, which only
  // receives the rows themselves — never the source or its options.
  for (const row of rows) {
    const journal = journalFor(source, row.currency);
    if (journal) row.journal = journal;
  }
  return rows;
}

function readSpendeeRows(buffer, fileName) {
  const isXlsx = /\.(xlsx|xls)$/i.test(fileName) || looksLikeXlsx(buffer);
  if (isXlsx) {
    const matrix = xlsReader.readBuffer(buffer);
    if (matrix.length === 0) return [];
    const [headers, ...dataRows] = matrix;
    return dataRows.map((cells) => {
      const obj = {};
      headers.forEach((h, idx) => { obj[h] = cells[idx] ?? ''; });
      return obj;
    });
  }
  return csvReader.readBuffer(buffer).rows;
}

function looksLikeXlsx(buffer) {
  return buffer && buffer.length >= 2 && buffer[0] === 0x50 && buffer[1] === 0x4b;
}

module.exports = { getRows, journalFor, SOURCES_META };
