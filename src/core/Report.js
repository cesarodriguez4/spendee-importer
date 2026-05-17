const { Row } = require('./Row');

class Report {
  constructor({ reader, parser, categorizer, writer, sourcePath, outputPath }) {
    this.reader = reader;
    this.parser = parser;
    this.categorizer = categorizer;
    this.writer = writer;
    this.sourcePath = sourcePath;
    this.outputPath = outputPath;
  }

  run() {
    const raw = this.reader.read(this.sourcePath);
    const rows = this.parser.parse(raw, this.categorizer);
    const sheetData = [Row.headers(), ...rows.map((row) => row.toArray())];
    this.writer.write(this.outputPath, sheetData);
    return `Excel file created for ${this.sourcePath}`;
  }
}

module.exports = { Report };
