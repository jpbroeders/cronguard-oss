import Database from 'better-sqlite3'
import { existsSync, mkdirSync } from 'fs'
import { join } from 'path'

const DATA_DIR = join(process.cwd(), 'data')
const DB_PATH = join(DATA_DIR, 'cronguard.db')

function ensureDataDir() {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true })
  }
}

let db: Database.Database | null = null

// Graceful shutdown handling
function setupShutdownHandlers() {
  const shutdown = () => {
    if (db) {
      try {
        db.pragma('wal_checkpoint(TRUNCATE)')
        db.close()
        db = null
      } catch {
        // Ignore errors during shutdown
      }
    }
  }

  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
  process.on('beforeExit', shutdown)
}

export function getDb(): Database.Database {
  if (db) return db

  ensureDataDir()
  db = new Database(DB_PATH)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  // Set up shutdown handlers on first connection
  setupShutdownHandlers()

  // Create tables if they don't exist
  db.exec(`
    CREATE TABLE IF NOT EXISTS monitors (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      schedule TEXT NOT NULL,
      interval_minutes INTEGER NOT NULL,
      grace_minutes INTEGER NOT NULL DEFAULT 15,
      last_ping TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS pings (
      id TEXT PRIMARY KEY,
      monitor_id TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('success', 'failure')),
      duration INTEGER,
      message TEXT,
      ip TEXT,
      FOREIGN KEY (monitor_id) REFERENCES monitors(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_pings_monitor_timestamp
    ON pings(monitor_id, timestamp DESC);
  `)

  return db
}

// Prepared statements for performance
export function prepareStatements(db: Database.Database) {
  return {
    getAllMonitors: db.prepare(`
      SELECT id, name, schedule, interval_minutes, grace_minutes, last_ping, created_at
      FROM monitors
      ORDER BY created_at DESC
    `),

    getMonitor: db.prepare(`
      SELECT id, name, schedule, interval_minutes, grace_minutes, last_ping, created_at
      FROM monitors
      WHERE id = ?
    `),

    getPingsForMonitor: db.prepare(`
      SELECT id, timestamp, status, duration, message, ip
      FROM pings
      WHERE monitor_id = ?
      ORDER BY timestamp DESC
      LIMIT 75
    `),

    insertMonitor: db.prepare(`
      INSERT INTO monitors (id, name, schedule, interval_minutes, grace_minutes, last_ping, created_at)
      VALUES (@id, @name, @schedule, @intervalMinutes, @graceMinutes, @lastPing, @createdAt)
    `),

    updateMonitor: db.prepare(`
      UPDATE monitors
      SET name = @name, schedule = @schedule, interval_minutes = @intervalMinutes,
          grace_minutes = @graceMinutes, last_ping = @lastPing
      WHERE id = @id
    `),

    deleteMonitor: db.prepare(`DELETE FROM monitors WHERE id = ?`),

    insertPing: db.prepare(`
      INSERT INTO pings (id, monitor_id, timestamp, status, duration, message, ip)
      VALUES (@id, @monitorId, @timestamp, @status, @duration, @message, @ip)
    `),

    updateMonitorLastPing: db.prepare(`
      UPDATE monitors SET last_ping = ? WHERE id = ?
    `),

    countMonitors: db.prepare(`SELECT COUNT(*) as count FROM monitors`),

    countPings: db.prepare(`SELECT COUNT(*) as count FROM pings`),

    countMonitorsByStatus: db.prepare(`
      SELECT
        SUM(CASE WHEN last_ping IS NULL THEN 1 ELSE 0 END) as no_ping,
        COUNT(*) as total
      FROM monitors
    `),
  }
}
