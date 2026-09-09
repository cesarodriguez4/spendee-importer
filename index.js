const { FileReader } = require('./src/core/FileReader');
const { ExcelWriter } = require('./src/core/ExcelWriter');
const { OdooCsvWriter } = require('./src/core/OdooCsvWriter');
const { Categorizer } = require('./src/core/Categorizer');
const { Report } = require('./src/core/Report');
const { Row } = require('./src/core/Row');

const { MercantilParser } = require('./src/parsers/MercantilParser');
const { BanescoParser } = require('./src/parsers/BanescoParser');
const { BanescoVEParser } = require('./src/parsers/BanescoVEParser');
const { BinanceParser } = require('./src/parsers/BinanceParser');
const { PayoneerParser } = require('./src/parsers/PayoneerParser');
// const { ExodusParser } = require('./src/parsers/ExodusParser');

const categories = require('./src/config/categories.json');
const tags = require('./src/config/tags.json');
const sources = require('./src/config/sources.json');

const reader = new FileReader();
const writer = new ExcelWriter();
const csvWriter = new OdooCsvWriter();
const categorizer = new Categorizer(categories, tags);

const odooFormatter = {
  headers: () => Row.odooHeaders(),
  mapRow: (row) => row.toOdooArray(),
};

const reports = [
  new Report({
    reader, writer, categorizer,
    parser: new MercantilParser(sources.mercantil),
    sourcePath: 'mercantil.xlsx',
    outputPath: 'mercantil_report.xlsx',
  }),
  new Report({
    reader, writer, categorizer,
    parser: new BanescoParser(sources.banesco),
    sourcePath: 'banesco.xls',
    outputPath: 'banesco_report.xlsx',
  }),
  new Report({
    reader, writer, categorizer,
    parser: new BanescoVEParser(sources.banescoVE, 650),
    sourcePath: 'banescove.xls',
    outputPath: 'banescoVE_report.xlsx',
  }),
  new Report({
    reader, writer, categorizer,
    parser: new BinanceParser(sources.binance),
    sourcePath: 'binance.csv',
    outputPath: 'binance_report.xlsx',
  }),
  new Report({
    reader, writer, categorizer,
    parser: new PayoneerParser(sources.payoneer),
    sourcePath: 'payoneer.csv',
    outputPath: 'payoneer_report.xlsx',
  }),
];

const odooReports = [
  new Report({
    reader, writer: csvWriter, categorizer, formatter: odooFormatter,
    parser: new MercantilParser(sources.mercantil),
    sourcePath: 'mercantil.xlsx',
    outputPath: 'mercantil_odoo.csv',
  }),
  new Report({
    reader, writer: csvWriter, categorizer, formatter: odooFormatter,
    parser: new BanescoParser(sources.banesco),
    sourcePath: 'banesco.xls',
    outputPath: 'banesco_odoo.csv',
  }),
  new Report({
    reader, writer: csvWriter, categorizer, formatter: odooFormatter,
    parser: new BanescoVEParser(sources.banescoVE, 650),
    sourcePath: 'banescove.xls',
    outputPath: 'banescoVE_odoo.csv',
  }),
  new Report({
    reader, writer: csvWriter, categorizer, formatter: odooFormatter,
    parser: new BinanceParser(sources.binance),
    sourcePath: 'binance.csv',
    outputPath: 'binance_odoo.csv',
  }),
  new Report({
    reader, writer: csvWriter, categorizer, formatter: odooFormatter,
    parser: new PayoneerParser(sources.payoneer),
    sourcePath: 'payoneer.csv',
    outputPath: 'payoneer_odoo.csv',
  }),
];

for (const report of reports) {
  console.log(report.run());
}

for (const report of odooReports) {
  console.log(report.run());
}

// Exodus: uncomment and pass a date range to generate per-wallet reports.
// const { ExodusParser } = require('./src/parsers/ExodusParser');
// const exodusRange = { startDate: '2025-01-24', endDate: '2025-02-01' };
// for (const w of sources.exodus.wallets) {
//   new Report({
//     reader, writer, categorizer,
//     parser: new ExodusParser(sources.exodus, { ...w, ...exodusRange }),
//     sourcePath: 'exodus.csv',
//     outputPath: w.outputPath,
//   }).run();
// }
