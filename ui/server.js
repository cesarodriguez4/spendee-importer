const path = require('path');
const express = require('express');
const multer = require('multer');

const { getRows, SOURCES_META } = require('../src/services/TransactionService');
const { ExcelWriter } = require('../src/core/ExcelWriter');
const { Row } = require('../src/core/Row');

const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

app.use(express.json({ limit: '20mb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/sources', (req, res) => {
  res.json(SOURCES_META);
});

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
    const { rows, fileName = 'report.xlsx', format } = req.body;
    if (!Array.isArray(rows)) return res.status(400).json({ error: 'rows must be an array' });
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`UI server running at http://localhost:${PORT}`);
});
