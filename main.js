const { MercantilReport } = require('./src/MercantilReport');
const { BanescoReport } = require('./src/BanescoReport');
const { BanescoVEReport } = require('./src/BanescoVEReport');
const { BinanceReport } = require('./src/BinanceReport');


// Saves an excel file with this format:
// Name | Tags | Income | Expense | Date | Note

var reportMercantil = new MercantilReport('mercantil.xlsx', 'mercantil_report.xlsx');
console.log(reportMercantil.buildExcel());
var reportBanesco = new BanescoReport('banesco.xls', 'banesco_report.xlsx');
console.log(reportBanesco.buildExcel());
var reportBanescoVE = new BanescoVEReport('banescove.xls', 'banescoVE_report.xlsx', 65);
console.log(reportBanescoVE.buildExcel());
var reportBinance = new BinanceReport('binance.csv', 'binance_report.xlsx');
console.log(reportBinance.buildExcel());