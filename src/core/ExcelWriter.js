const fs = require('fs');
const path = require('path');
const xlsx = require('node-xlsx');

class ExcelWriter {
  constructor(outputDir = path.join(__dirname, '..', '..', 'exports')) {
    this.outputDir = outputDir;
  }

  write(fileName, rows, sheetName = 'mySheetName') {
    const buffer = xlsx.build([{ name: sheetName, data: rows }]);
    const fullPath = path.join(this.outputDir, fileName);
    fs.writeFileSync(fullPath, buffer);
    return fullPath;
  }
}

module.exports = { ExcelWriter };
