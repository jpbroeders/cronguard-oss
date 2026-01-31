export interface Monitor {
  id: string
  name: string
  schedule: string // cron expression or human readable
  intervalMinutes?: number // parsed interval in minutes
  graceMinutes: number // how long to wait before alerting
  status: 'healthy' | 'late' | 'down' | 'paused'
  lastPing: string | null
  nextExpected: string | null
  pings: Ping[]
  createdAt: string
  paused: boolean
  pausedAt: string | null
  pausedUntil: string | null
  pauseReason: string | null
}

export interface Ping {
  id: string
  timestamp: string
  status: 'success' | 'failure'
  duration?: number
  message?: string
  ip?: string
}

export interface Alert {
  id: string
  monitorId: string
  type: 'late' | 'down' | 'recovered'
  message: string
  sentAt: string
  channel: 'email' | 'slack' | 'webhook'
}

export function generateId(): string {
  return crypto.randomUUID()
}

// Parse schedule string to get interval in minutes
export function parseScheduleInterval(schedule: string): number {
  const lower = schedule.toLowerCase()
  
  // "Every X minutes"
  const minutesMatch = lower.match(/every\s+(\d+)\s*min/)
  if (minutesMatch) return parseInt(minutesMatch[1])
  
  // "Every minute"
  if (lower.includes('every minute')) return 1
  
  // "Every X hours"
  const hoursMatch = lower.match(/every\s+(\d+)\s*hour/)
  if (hoursMatch) return parseInt(hoursMatch[1]) * 60
  
  // "Every hour"
  if (lower.includes('every hour')) return 60
  
  // "Every day" / "Daily"
  if (lower.includes('every day') || lower.includes('daily')) return 24 * 60
  
  // "Every week" / "Weekly"
  if (lower.includes('every week') || lower.includes('weekly')) return 7 * 24 * 60
  
  // Default: assume daily if can't parse
  return 24 * 60
}

export function getMonitorStatus(monitor: Monitor): Monitor['status'] {
  // Check if monitor is paused
  if (monitor.paused) {
    // Check if auto-resume time has passed
    if (monitor.pausedUntil) {
      const resumeTime = new Date(monitor.pausedUntil).getTime()
      if (Date.now() >= resumeTime) {
        // Should be resumed, but return paused status
        // The background job will handle the actual resume
        return 'paused'
      }
    }
    return 'paused'
  }

  if (!monitor.lastPing) return 'down'

  const lastPingTime = new Date(monitor.lastPing).getTime()
  const now = Date.now()
  const graceMs = monitor.graceMinutes * 60 * 1000

  // Get interval from stored value or parse from schedule
  const intervalMinutes = monitor.intervalMinutes || parseScheduleInterval(monitor.schedule)
  const intervalMs = intervalMinutes * 60 * 1000

  // Expected next ping = last ping + interval
  const expectedNextPing = lastPingTime + intervalMs

  // Late if: now > expected (but within grace)
  // Down if: now > expected + grace
  const timeSinceExpected = now - expectedNextPing

  if (timeSinceExpected > graceMs) {
    return 'down'
  }

  if (timeSinceExpected > 0) {
    return 'late'
  }

  return 'healthy'
}
