const { MercantilReport } = require('./src/MercantilReport');
const { BanescoReport } = require('./src/BanescoReport');

// Saves an excel file with this format:
// Name | Tags | Income | Expense | Date | Note

var reportMercantil = new MercantilReport('mercantil.xlsx', 'mercantil_report.xlsx');
console.log(reportMercantil.buildExcel());
var reportBanesco = new BanescoReport('banesco.xlsx', 'banesco_report.xlsx');
console.log(reportBanesco.buildExcel());