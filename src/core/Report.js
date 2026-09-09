const { Row } = require('./Row');

class Report {
  constructor({ reader, parser, categorizer, writer, sourcePath, outputPath, formatter }) {
    this.reader = reader;
    this.parser = parser;
    this.categorizer = categorizer;
    this.writer = writer;
    this.sourcePath = sourcePath;
    this.outputPath = outputPath;
    this.formatter = formatter;
  }

  run() {
    const raw = this.reader.read(this.sourcePath);
    const rows = this.parser.parse(raw, this.categorizer);
    const headers = this.formatter ? this.formatter.headers() : Row.headers();
    const mapRow = this.formatter ? this.formatter.mapRow : (row) => row.toArray();
    const sheetData = [headers, ...rows.map(mapRow)];
    this.writer.write(this.outputPath, sheetData);
    return `File created for ${this.sourcePath}`;
  }
}

module.exports = { Report };
