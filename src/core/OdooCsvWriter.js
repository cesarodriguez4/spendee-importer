const fs = require('fs');
const path = require('path');
const { Row } = require('./Row');

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
    const fullPath = path.join(this.outputDir, fileName);
    fs.writeFileSync(fullPath, OdooCsvWriter.buildBuffer(rows));
    return fullPath;
  }

  static buildCsv(rows) {
    return rows
      .map((row) => row.map(escapeCsvCell).join(','))
      .join('\n');
  }

  static buildBuffer(rows) {
    const bom = Buffer.from([0xEF, 0xBB, 0xBF]);
    return Buffer.concat([bom, Buffer.from(OdooCsvWriter.buildCsv(rows), 'utf8')]);
  }

  // The file Odoo imports, from Rows or from the plain objects the browser sends.
  static buildExport(rows) {
    return OdooCsvWriter.buildBuffer([
      Row.odooHeaders(),
      ...rows.map((r) => Row.odooArrayFromPlain(r)),
    ]);
  }
}

module.exports = { OdooCsvWriter, escapeCsvCell, buildCsv };
