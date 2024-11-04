const { MercantilReport } = require('./src/MercantilReport');
const { BanescoReport } = require('./src/BanescoReport');
const { BanescoVEReport } = require('./src/BanescoVEReport');


// Saves an excel file with this format:
// Name | Tags | Income | Expense | Date | Note

var reportMercantil = new MercantilReport('mercantil.xlsx', 'mercantil_report.xlsx');
console.log(reportMercantil.buildExcel());
var reportBanesco = new BanescoReport('banesco.xlsx', 'banesco_report.xlsx');
console.log(reportBanesco.buildExcel());
var reportBanescoVE = new BanescoVEReport('banescove.xls', 'banescoVE_report.xlsx', 50);
console.log(reportBanescoVE.buildExcel());