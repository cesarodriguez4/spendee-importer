const fs = require('fs');
const path = require('path');
const xlsx = require('node-xlsx');

const NAMED_ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  aacute: 'á', eacute: 'é', iacute: 'í', oacute: 'ó', uacute: 'ú',
  Aacute: 'Á', Eacute: 'É', Iacute: 'Í', Oacute: 'Ó', Uacute: 'Ú',
  ntilde: 'ñ', Ntilde: 'Ñ', uuml: 'ü', Uuml: 'Ü',
};

function decodeEntities(text) {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, body) => {
    if (body[0] === '#') {
      const code = body[1] === 'x' || body[1] === 'X'
        ? parseInt(body.slice(2), 16)
        : parseInt(body.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    return NAMED_ENTITIES[body] ?? match;
  });
}

function looksLikeHtml(buffer) {
  // Bancamiga ships an HTML <table> under an .xls extension. Sniff the first
  // bytes so a genuine spreadsheet still falls through to node-xlsx.
  const head = buffer.subarray(0, 512).toString('latin1').trimStart();
  return /^<(table|html|!doctype|tr)\b/i.test(head);
}

function decodeBuffer(buffer) {
  // Sample statements come in three flavours: ASCII, raw latin1, and UTF-8 that
  // already contains U+FFFD baked in by the bank's server. Testing for U+FFFD
  // in the decoded text would misfire on the third, so probe the bytes instead.
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch {
    return buffer.toString('latin1');
  }
}

function cellText(html) {
  return decodeEntities(html.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
}

function parseHtmlTable(text) {
  const rows = [];
  const rowPattern = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch;
  while ((rowMatch = rowPattern.exec(text)) !== null) {
    const cells = [];
    const cellPattern = /<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi;
    let cellMatch;
    while ((cellMatch = cellPattern.exec(rowMatch[1])) !== null) {
      cells.push(cellText(cellMatch[1]));
    }
    rows.push(cells);
  }
  return rows;
}

class HtmlTableReader {
  constructor(baseDir = path.join(__dirname, '..', '..')) {
    this.baseDir = baseDir;
  }

  read(relativePath) {
    return this.readBuffer(fs.readFileSync(path.join(this.baseDir, relativePath)));
  }

  readBuffer(buffer) {
    if (!looksLikeHtml(buffer)) return xlsx.parse(buffer)[0].data;
    return parseHtmlTable(decodeBuffer(buffer));
  }
}

module.exports = { HtmlTableReader, decodeEntities, looksLikeHtml, decodeBuffer };
