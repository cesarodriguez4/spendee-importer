const path = require('path');
const xlsx = require('node-xlsx');

class FileReader {
  constructor(baseDir = path.join(__dirname, '..', '..')) {
    this.baseDir = baseDir;
  }

  read(relativePath) {
    const fullPath = path.join(this.baseDir, relativePath);
    const sheets = xlsx.parse(fullPath);
    return sheets[0].data;
  }
}

module.exports = { FileReader };
