const fs = require('fs');
const path = require('path');

function fixMojibake(text) {
  if (!text.includes('Ã')) return text;
  try {
    const fixed = Buffer.from(text, 'latin1').toString('utf8');
    if (fixed.includes('�')) return text;
    return fixed;
  } catch {
    return text;
  }
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 1; }
        else { inQuotes = false; }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field); field = '';
    } else if (ch === '\n') {
      row.push(field); field = '';
      rows.push(row); row = [];
    } else if (ch === '\r') {
      // skip; \n will close the row
    } else {
      field += ch;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => !(r.length === 1 && r[0] === ''));
}

class CsvReader {
  constructor(baseDir = path.join(__dirname, '..', '..')) {
    this.baseDir = baseDir;
  }

  read(relativePath) {
    const fullPath = path.isAbsolute(relativePath)
      ? relativePath
      : path.join(this.baseDir, relativePath);
    return this.#parseText(fs.readFileSync(fullPath, 'utf8'));
  }

  readBuffer(buffer) {
    return this.#parseText(buffer.toString('utf8'));
  }

  #parseText(rawText) {
    const text = fixMojibake(rawText);
    const matrix = parseCsv(text);
    if (matrix.length === 0) return { headers: [], rows: [] };
    const [headers, ...dataRows] = matrix;
    const rows = dataRows.map((cells) => {
      const obj = {};
      headers.forEach((h, idx) => { obj[h] = cells[idx] ?? ''; });
      return obj;
    });
    return { headers, rows };
  }
}

module.exports = { CsvReader, parseCsv, fixMojibake };
