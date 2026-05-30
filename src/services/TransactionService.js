const sources = require('../config/sources.json');
const categories = require('../config/categories.json');
const tags = require('../config/tags.json');
const payees = require('../config/payees.json');

const { Categorizer } = require('../core/Categorizer');
const { FileReader } = require('../core/FileReader');
const { CsvReader } = require('../core/CsvReader');

const { MercantilParser } = require('../parsers/MercantilParser');
const { BanescoParser } = require('../parsers/BanescoParser');
const { BanescoVEParser } = require('../parsers/BanescoVEParser');
const { BinanceParser } = require('../parsers/BinanceParser');
const { ExodusParser } = require('../parsers/ExodusParser');
const { SpendeeParser } = require('../parsers/SpendeeParser');

const categorizer = new Categorizer(categories, tags, payees);
const xlsReader = new FileReader();
const csvReader = new CsvReader();

const SOURCES_META = [
  { id: 'mercantil', label: 'Mercantil (Panama)', accept: '.xlsx,.xls', options: [] },
  { id: 'banesco',   label: 'Banesco Panamá',       accept: '.xls,.xlsx', options: [] },
  {
    id: 'banescoVE', label: 'Banesco Venezuela',    accept: '.xls,.xlsx',
    options: [{ name: 'exchangeRate', label: 'Tasa de cambio (Bs/USD) — montos se exportan en USD', type: 'number', required: true, default: 650 }],
  },
  { id: 'binance',   label: 'Binance',              accept: '.csv,.xlsx', options: [] },
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
  binance:   { reader: xlsReader, build: () => new BinanceParser(sources.binance) },
  exodus:    {
    reader: xlsReader,
    build: (opts) => {
      const [currency, wallet] = (opts.wallet || '').split('|');
      return new ExodusParser(sources.exodus, { currency, wallet, startDate: opts.startDate, endDate: opts.endDate });
    },
  },
  spendee:   { reader: csvReader, build: () => new SpendeeParser() },
};

function getRows({ buffer, source, fileName = '', options = {} }) {
  const entry = REGISTRY[source];
  if (!entry) throw new Error(`Unknown source: ${source}`);

  const parser = entry.build(options);
  if (source === 'spendee') {
    const rows = readSpendeeRows(buffer, fileName);
    return parser.parse(rows, categorizer);
  }
  const raw = entry.reader.readBuffer(buffer);
  return parser.parse(raw, categorizer);
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

module.exports = { getRows, SOURCES_META };
