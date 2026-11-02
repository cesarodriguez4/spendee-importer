const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const express = require('express');
const multer = require('multer');

const { getRows, SOURCES_META } = require('../src/services/TransactionService');
const { ExcelWriter } = require('../src/core/ExcelWriter');
const { OdooCsvWriter } = require('../src/core/OdooCsvWriter');
const { Row } = require('../src/core/Row');
const { PeriodLog, rangeOf } = require('../src/periods/PeriodLog');
const { trackedSources } = require('../src/periods/trackedSources');

const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

app.use(express.json({ limit: '20mb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/sources', (req, res) => {
  res.json(SOURCES_META);
});

app.get('/api/status', (req, res) => {
  try {
    res.json({ sources: new PeriodLog().status({ sources: trackedSources() }) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// A failed control update must never cost the user their download.
function recordOdooExport(source, rows, fileName) {
  if (!SOURCES_META.some((meta) => meta.id === source)) return;
  try {
    const range = rangeOf(rows.map((row) => row.date));
    if (range) new PeriodLog().recordPeriod({ source, ...range, via: 'odoo', file: fileName });
  } catch (err) {
    console.error(`Could not update the period control: ${err.message}`);
  }
}

app.post('/api/preview', upload.single('file'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const { source } = req.body;
    const options = req.body.options ? JSON.parse(req.body.options) : {};
    const rows = getRows({ buffer: req.file.buffer, source, fileName: req.file.originalname, options });
    res.json({ rows: rows.map((r) => ({ ...r })) });
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/export', (req, res) => {
  try {
    const { rows, fileName = 'report.xlsx', format, source } = req.body;
    if (!Array.isArray(rows)) return res.status(400).json({ error: 'rows must be an array' });

    if (format === 'odoo') {
      const fullBuffer = OdooCsvWriter.buildExport(rows);
      recordOdooExport(source, rows, fileName);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.send(fullBuffer);
      return;
    }

    // Tanto "wallet" como "spendee" exportan con Monto único + Payee + Currency
    const withPayee = format
      ? (format === 'spendee' || format === 'wallet')
      : rows.some((r) => r.payee != null || r.currency != null);
    const headers = withPayee ? Row.spendeeHeaders() : Row.headers();
    const data = [
      headers,
      ...rows.map((r) => {
        if (withPayee) {
          const amount = r.income != null && r.income !== '' ? Number(r.income) : Number(r.expense);
          return [r.date, r.name, r.category, r.tags, amount, r.payee ?? '', r.currency ?? ''];
        }
        return [r.date, r.name, r.category, r.tags, r.expense, r.income];
      }),
    ];
    const buffer = ExcelWriter.buildBuffer(data);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(buffer);
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: err.message });
  }
});

if (require.main === module) {
  // Local only by default: the status card shows financial data. Set HOST to widen.
  const PORT = process.env.PORT || 3000;
  const HOST = process.env.HOST || '127.0.0.1';
  app.listen(PORT, HOST, () => {
    console.log(`UI server running at http://${HOST}:${PORT}`);
  });
}

module.exports = { app };
