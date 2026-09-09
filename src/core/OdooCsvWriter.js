const fs = require('fs');
const path = require('path');

function escapeCsvCell(value) {
  const str = value == null ? '' : String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function buildCsv(rows) {
  return rows
    .map((row) => row.map(escapeCsvCell).join(','))
    .join('\n');
}

class OdooCsvWriter {
  constructor(outputDir = path.join(__dirname, '..', '..', 'exports')) {
    this.outputDir = outputDir;
  }

  write(fileName, rows) {
    const csvText = OdooCsvWriter.buildCsv(rows);
    const bom = Buffer.from([0xEF, 0xBB, 0xBF]);
    const buffer = Buffer.concat([bom, Buffer.from(csvText, 'utf8')]);
    const fullPath = path.join(this.outputDir, fileName);
    fs.writeFileSync(fullPath, buffer);
    return fullPath;
  }

  static buildCsv(rows) {
    return rows
      .map((row) => row.map(escapeCsvCell).join(','))
      .join('\n');
  }
}

module.exports = { OdooCsvWriter, escapeCsvCell, buildCsv };
