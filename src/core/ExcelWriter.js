const fs = require('fs');
const path = require('path');
const xlsx = require('node-xlsx');

class ExcelWriter {
  constructor(outputDir = path.join(__dirname, '..', '..', 'exports')) {
    this.outputDir = outputDir;
  }

  write(fileName, rows, sheetName = 'mySheetName') {
    const buffer = ExcelWriter.buildBuffer(rows, sheetName);
    const fullPath = path.join(this.outputDir, fileName);
    fs.writeFileSync(fullPath, buffer);
    return fullPath;
  }

  static buildBuffer(rows, sheetName = 'mySheetName') {
    return xlsx.build([{ name: sheetName, data: rows }]);
  }
}

module.exports = { ExcelWriter };
