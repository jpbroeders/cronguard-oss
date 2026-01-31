import { Monitor, Ping, generateId, getMonitorStatus, parseScheduleInterval } from './types'
import { getDb, prepareStatements } from './db'

// Lazy-initialized prepared statements
let stmts: ReturnType<typeof prepareStatements> | null = null

function getStmts() {
  if (!stmts) {
    const db = getDb()
    stmts = prepareStatements(db)
  }
  return stmts
}

// Row types from database
interface MonitorRow {
  id: string
  name: string
  schedule: string
  interval_minutes: number
  grace_minutes: number
  last_ping: string | null
  created_at: string
}

interface PingRow {
  id: string
  timestamp: string
  status: 'success' | 'failure'
  duration: number | null
  message: string | null
  ip: string | null
}

function rowToMonitor(row: MonitorRow, pings: Ping[]): Monitor {
  const monitor: Monitor = {
    id: row.id,
    name: row.name,
    schedule: row.schedule,
    intervalMinutes: row.interval_minutes,
    graceMinutes: row.grace_minutes,
    status: 'down',
    lastPing: row.last_ping,
    nextExpected: null,
    pings,
    createdAt: row.created_at
  }
  monitor.status = getMonitorStatus(monitor)
  return monitor
}

function rowToPing(row: PingRow): Ping {
  return {
    id: row.id,
    timestamp: row.timestamp,
    status: row.status,
    duration: row.duration ?? undefined,
    message: row.message ?? undefined,
    ip: row.ip ?? undefined
  }
}

export function getAllMonitors(): Monitor[] {
  const s = getStmts()
  const monitorRows = s.getAllMonitors.all() as MonitorRow[]

  return monitorRows.map(row => {
    const pingRows = s.getPingsForMonitor.all(row.id) as PingRow[]
    const pings = pingRows.map(rowToPing)
    return rowToMonitor(row, pings)
  })
}

export function getMonitor(id: string): Monitor | null {
  const s = getStmts()
  const row = s.getMonitor.get(id) as MonitorRow | undefined
  if (!row) return null

  const pingRows = s.getPingsForMonitor.all(id) as PingRow[]
  const pings = pingRows.map(rowToPing)
  return rowToMonitor(row, pings)
}

export function createMonitor(name: string, schedule: string, graceMinutes: number = 15): Monitor {
  const s = getStmts()
  const intervalMinutes = parseScheduleInterval(schedule)

  const monitorData = {
    id: generateId(),
    name,
    schedule,
    intervalMinutes,
    graceMinutes,
    lastPing: null,
    createdAt: new Date().toISOString()
  }

  s.insertMonitor.run(monitorData)

  return {
    ...monitorData,
    status: 'down',
    nextExpected: null,
    pings: []
  }
}

export function updateMonitor(id: string, updates: Partial<Monitor>): Monitor | null {
  const existing = getMonitor(id)
  if (!existing) return null

  const s = getStmts()

  const schedule = updates.schedule ?? existing.schedule
  const intervalMinutes = updates.schedule
    ? parseScheduleInterval(updates.schedule)
    : existing.intervalMinutes

  const updateData = {
    id,
    name: updates.name ?? existing.name,
    schedule,
    intervalMinutes,
    graceMinutes: updates.graceMinutes ?? existing.graceMinutes,
    lastPing: updates.lastPing ?? existing.lastPing
  }

  s.updateMonitor.run(updateData)

  return getMonitor(id)
}

export function deleteMonitor(id: string): boolean {
  const s = getStmts()
  const result = s.deleteMonitor.run(id)
  return result.changes > 0
}

export function recordPing(id: string, success: boolean = true, duration?: number, message?: string, ip?: string): Ping | null {
  const s = getStmts()

  // Check if monitor exists
  const monitorRow = s.getMonitor.get(id) as MonitorRow | undefined
  if (!monitorRow) return null

  const ping: Ping = {
    id: generateId(),
    timestamp: new Date().toISOString(),
    status: success ? 'success' : 'failure',
    duration,
    message,
    ip
  }

  const db = getDb()
  const transaction = db.transaction(() => {
    s.insertPing.run({
      id: ping.id,
      monitorId: id,
      timestamp: ping.timestamp,
      status: ping.status,
      duration: ping.duration ?? null,
      message: ping.message ?? null,
      ip: ping.ip ?? null
    })
    s.updateMonitorLastPing.run(ping.timestamp, id)
  })

  transaction()
  return ping
}

export function getStats() {
  const s = getStmts()
  const all = getAllMonitors()

  const pingCount = s.countPings.get() as { count: number }

  return {
    total: all.length,
    healthy: all.filter(m => m.status === 'healthy').length,
    late: all.filter(m => m.status === 'late').length,
    down: all.filter(m => m.status === 'down').length,
    totalPings: pingCount.count
  }
}
