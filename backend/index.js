require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();

app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(express.text({ type: ['text/csv', 'text/plain'] }));

// ── Global Context Middleware ─────────────────────────────
app.use((req, res, next) => {
  req.dataSource = req.headers['x-data-source'] || process.env.DATA_SOURCE || 'mock';
  next();
});

// ── Routes ──────────────────────────────────────────────
app.use('/safe-route',    require('./routes/routePainter'));
app.use('/danger-score',  require('./routes/safetyScorecard'));
app.use('/incidents',     require('./routes/dynamicHeatmap'));
app.use('/report',        require('./routes/incidentReporting'));
app.use('/cluster-info',  require('./routes/comfortDashboard'));

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
