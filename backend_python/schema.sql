-- PostgreSQL schema for local SmartCity development.

CREATE TABLE IF NOT EXISTS zones (
    zone_id VARCHAR PRIMARY KEY,
    name TEXT,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    danger_score DOUBLE PRECISION DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS incidents (
    incident_id VARCHAR PRIMARY KEY,
    zone_id VARCHAR REFERENCES zones(zone_id),
    incident_type TEXT,
    payload JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_zone_danger ON zones (danger_score);
CREATE INDEX IF NOT EXISTS idx_incident_zone ON incidents (zone_id);
