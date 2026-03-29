const axios = require('axios');

const API_BASE = 'http://localhost:5000';
const HEADERS = { 'Content-Type': 'text/csv', 'x-data-source': 'mock' };

const testIncidents = [
  { lat: 12.9716, lng: 77.5946, type: 'poor_lighting', severity: 4 },
  { lat: 12.9750, lng: 77.5960, type: 'broken_cctv', severity: 5 },
  { lat: 12.9700, lng: 77.5900, type: 'suspicious_activity', severity: 3 },
  { lat: 12.9800, lng: 77.6000, type: 'felt_followed', severity: 5 },
  { lat: 12.9650, lng: 77.5850, type: 'poor_lighting', severity: 2 }
];

async function seed() {
  console.log('--- STARTING SMARTCITY DATA SEEDING ---');
  
  for (const inc of testIncidents) {
    const csv = `lat,lng,incident_type,severity,source\n${inc.lat},${inc.lng},${inc.type},${inc.severity},seed_script`;
    try {
      await axios.post(`${API_BASE}/report`, csv, { headers: HEADERS });
      console.log(`[SEED] Dispatched ${inc.type} at ${inc.lat}, ${inc.lng}`);
    } catch (err) {
      console.error(`[ERROR] Failed to seed: ${err.message}`);
    }
  }

  console.log('--- SEEDING COMPLETE ---');
  console.log('Verify at: http://localhost:5000/incidents?format=csv');
}

seed();
