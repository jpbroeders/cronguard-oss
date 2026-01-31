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

// Migration definitions - add new migrations at the end with incrementing version
interface Migration {
  version: number
  description: string
  up: (db: Database.Database) => void
}

const migrations: Migration[] = [
  {
    version: 1,
    description: 'Add pause functionality columns to monitors',
    up: (database) => {
      // Check if columns already exist (for databases created with new schema)
      const columns = database.prepare(`PRAGMA table_info(monitors)`).all() as { name: string }[]
      const columnNames = columns.map(c => c.name)

      if (!columnNames.includes('paused')) {
        database.exec(`ALTER TABLE monitors ADD COLUMN paused INTEGER NOT NULL DEFAULT 0`)
      }
      if (!columnNames.includes('paused_at')) {
        database.exec(`ALTER TABLE monitors ADD COLUMN paused_at TEXT`)
      }
      if (!columnNames.includes('paused_until')) {
        database.exec(`ALTER TABLE monitors ADD COLUMN paused_until TEXT`)
      }
      if (!columnNames.includes('pause_reason')) {
        database.exec(`ALTER TABLE monitors ADD COLUMN pause_reason TEXT`)
      }
    }
  }
]

function runMigrations(database: Database.Database) {
  // Create migrations table if it doesn't exist
  database.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      description TEXT NOT NULL,
      applied_at TEXT NOT NULL
    )
  `)

  // Get applied migrations
  const applied = database.prepare(`SELECT version FROM schema_migrations`).all() as { version: number }[]
  const appliedVersions = new Set(applied.map(m => m.version))

  // Run pending migrations in order
  const insertMigration = database.prepare(`
    INSERT INTO schema_migrations (version, description, applied_at)
    VALUES (?, ?, ?)
  `)

  for (const migration of migrations) {
    if (!appliedVersions.has(migration.version)) {
      console.log(`Running migration ${migration.version}: ${migration.description}`)

      database.transaction(() => {
        migration.up(database)
        insertMigration.run(migration.version, migration.description, new Date().toISOString())
      })()

      console.log(`Migration ${migration.version} completed`)
    }
  }
}

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

  // Create base tables if they don't exist (for new databases)
  db.exec(`
    CREATE TABLE IF NOT EXISTS monitors (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      schedule TEXT NOT NULL,
      interval_minutes INTEGER NOT NULL,
      grace_minutes INTEGER NOT NULL DEFAULT 15,
      last_ping TEXT,
      created_at TEXT NOT NULL,
      paused INTEGER NOT NULL DEFAULT 0,
      paused_at TEXT,
      paused_until TEXT,
      pause_reason TEXT
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

  // Run migrations for existing databases
  runMigrations(db)

  return db
}

// Prepared statements for performance
export function prepareStatements(db: Database.Database) {
  return {
    getAllMonitors: db.prepare(`
      SELECT id, name, schedule, interval_minutes, grace_minutes, last_ping, created_at,
             paused, paused_at, paused_until, pause_reason
      FROM monitors
      ORDER BY created_at DESC
    `),

    getMonitor: db.prepare(`
      SELECT id, name, schedule, interval_minutes, grace_minutes, last_ping, created_at,
             paused, paused_at, paused_until, pause_reason
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
      INSERT INTO monitors (id, name, schedule, interval_minutes, grace_minutes, last_ping, created_at,
                           paused, paused_at, paused_until, pause_reason)
      VALUES (@id, @name, @schedule, @intervalMinutes, @graceMinutes, @lastPing, @createdAt,
              @paused, @pausedAt, @pausedUntil, @pauseReason)
    `),

    updateMonitor: db.prepare(`
      UPDATE monitors
      SET name = @name, schedule = @schedule, interval_minutes = @intervalMinutes,
          grace_minutes = @graceMinutes, last_ping = @lastPing,
          paused = @paused, paused_at = @pausedAt, paused_until = @pausedUntil,
          pause_reason = @pauseReason
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

    pauseMonitor: db.prepare(`
      UPDATE monitors
      SET paused = 1, paused_at = @pausedAt, paused_until = @pausedUntil, pause_reason = @pauseReason
      WHERE id = @id
    `),

    resumeMonitor: db.prepare(`
      UPDATE monitors
      SET paused = 0, paused_at = NULL, paused_until = NULL, pause_reason = NULL
      WHERE id = ?
    `),

    getPausedMonitorsToResume: db.prepare(`
      SELECT id
      FROM monitors
      WHERE paused = 1 AND paused_until IS NOT NULL AND paused_until <= ?
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
