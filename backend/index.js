require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();

app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json());

// ── Routes ──────────────────────────────────────────────
app.use('/safe-route',    require('./routes/safeRoute'));
app.use('/danger-score',  require('./routes/dangerScore'));
app.use('/incidents',     require('./routes/incidents'));
app.use('/report',        require('./routes/report'));
app.use('/cluster-info',  require('./routes/clusterInfo'));

// ── Health check ─────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    dataSource: process.env.DATA_SOURCE,
    time: new Date().toISOString()
  });
});

// ── Global error handler ──────────────────────────────────
app.use((err, req, res, next) => {
  console.error('[ERROR]', err.message);
  res.status(500).json({ error: 'Internal server error', detail: err.message });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
  console.log(`Data source: ${process.env.DATA_SOURCE}`);
});

const cors = require("cors");
app.use(cors());