'use client'

import { useState, useEffect, useCallback } from 'react'
import { Monitor, parseScheduleInterval } from '@/lib/types'
import { ThemeToggle } from '@/components/ThemeToggle'
import {
  AppFrame,
  StatTile,
  Tab,
  IncidentBanner,
  I,
  StatusBar,
  StatusBadge,
  Heartbeat,
  type HBKind,
} from '@/components/cg'
import { IntegrationPanel, CodeDrawer } from '@/components/IntegrationPanel'

interface Stats {
  total: number
  healthy: number
  late: number
  down: number
  paused: number
  totalPings: number
}

interface ToastMessage {
  id: number
  type: 'success' | 'error'
  message: string
}

const SCHEDULE_PRESETS = [
  'Every 5 minutes',
  'Every 15 minutes',
  'Every hour',
  'Daily',
  'Weekly',
] as const

function formatRelativeTime(dateStr: string | null) {
  if (!dateStr) return 'Never'
  const diff = Date.now() - new Date(dateStr).getTime()
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (days > 0) return `${days}d ago`
  if (hours > 0) return `${hours}h ago`
  if (minutes > 0) return `${minutes}m ago`
  return 'Just now'
}

// Build a 30-bar heartbeat: real pings (newest → rightmost) plus synthesized
// `miss` bars for gaps larger than (interval + grace). Bars at the left are
// padded with faint `idle` slots so all rows have equal width.
function buildHeartbeat(monitor: Monitor): HBKind[] {
  const target = 30
  if (monitor.paused && monitor.pings.length === 0) {
    return Array(target).fill('idle') as HBKind[]
  }

  const intervalMinutes = monitor.intervalMinutes || parseScheduleInterval(monitor.schedule)
  const intervalMs = intervalMinutes * 60 * 1000
  const graceMs = monitor.graceMinutes * 60 * 1000

  // pings are newest-first; reverse so oldest-first for iteration.
  const oldest = [...monitor.pings].reverse()
  const bars: HBKind[] = []

  for (let i = 0; i < oldest.length; i++) {
    bars.push(oldest[i].status === 'success' ? 'ok' : 'miss')

    if (i < oldest.length - 1) {
      const next = new Date(oldest[i + 1].timestamp).getTime()
      const here = new Date(oldest[i].timestamp).getTime()
      const gap = next - here
      if (gap > intervalMs + graceMs) {
        const missedCount = Math.min(Math.ceil(gap / intervalMs) - 1, target)
        for (let j = 0; j < missedCount; j++) bars.push('miss')
      }
    }
  }

  // Tail: monitor is currently overdue → append late or miss bars.
  if (monitor.lastPing) {
    const sinceLast = Date.now() - new Date(monitor.lastPing).getTime()
    if (sinceLast > intervalMs + graceMs) {
      const overdue = Math.min(Math.ceil((sinceLast - graceMs) / intervalMs), target)
      for (let i = 0; i < overdue; i++) bars.push('miss')
    } else if (sinceLast > intervalMs) {
      bars.push('late')
    }
  }

  if (bars.length < target) {
    return [...(Array(target - bars.length).fill('idle') as HBKind[]), ...bars]
  }
  return bars.slice(-target)
}

export default function Dashboard() {
  const [monitors, setMonitors] = useState<Monitor[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [newMonitor, setNewMonitor] = useState({ name: '', schedule: '', graceMinutes: 15 })
  const [editingMonitor, setEditingMonitor] = useState<Monitor | null>(null)
  const [baseUrl, setBaseUrl] = useState('')
  const [codeDrawerMonitor, setCodeDrawerMonitor] = useState<{ id: string; name: string } | null>(null)
  const [createdMonitor, setCreatedMonitor] = useState<{ id: string; name: string } | null>(null)
  const [statusFilter, setStatusFilter] = useState<'all' | 'late' | 'down'>('all')
  const [refreshInterval, setRefreshInterval] = useState(30)
  const [toasts, setToasts] = useState<ToastMessage[]>([])

  const showToast = useCallback((type: 'success' | 'error', message: string) => {
    const id = Date.now()
    setToasts(prev => [...prev, { id, type, message }])
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 4000)
  }, [])

  const fetchData = useCallback(async () => {
    try {
      const [monitorsRes, statsRes] = await Promise.all([
        fetch('/api/monitors'),
        fetch('/api/monitors?stats=true')
      ])

      if (monitorsRes.ok) {
        setMonitors(await monitorsRes.json())
      }
      if (statsRes.ok) {
        setStats(await statsRes.json())
      }
    } catch (err) {
      console.error('Failed to fetch data:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setBaseUrl(window.location.origin)
    }
    fetchData()
    const interval = setInterval(fetchData, refreshInterval * 1000)
    return () => clearInterval(interval)
  }, [refreshInterval, fetchData])

  async function handleCreateMonitor() {
    if (!newMonitor.name || !newMonitor.schedule) return

    try {
      const res = await fetch('/api/monitors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newMonitor)
      })

      if (res.ok) {
        const created = await res.json()
        showToast('success', 'Monitor created successfully')
        fetchData()
        setCreatedMonitor({ id: created.id, name: created.name ?? newMonitor.name })
      } else {
        const data = await res.json()
        showToast('error', data.error || 'Failed to create monitor')
      }
    } catch (err) {
      console.error('Failed to create monitor:', err)
      showToast('error', 'Failed to create monitor')
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this monitor?')) return

    try {
      const res = await fetch(`/api/monitors?id=${id}`, { method: 'DELETE' })
      if (res.ok) {
        showToast('success', 'Monitor deleted')
        fetchData()
      } else {
        const data = await res.json()
        showToast('error', data.error || 'Failed to delete monitor')
      }
    } catch (err) {
      console.error('Failed to delete monitor:', err)
      showToast('error', 'Failed to delete monitor')
    }
  }

  async function handleUpdateMonitor() {
    if (!editingMonitor) return

    try {
      const res = await fetch('/api/monitors', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingMonitor.id,
          name: editingMonitor.name,
          schedule: editingMonitor.schedule,
          graceMinutes: editingMonitor.graceMinutes
        })
      })

      if (res.ok) {
        setEditingMonitor(null)
        showToast('success', 'Monitor updated')
        fetchData()
      } else {
        const data = await res.json()
        showToast('error', data.error || 'Failed to update monitor')
      }
    } catch (err) {
      console.error('Failed to update monitor:', err)
      showToast('error', 'Failed to update monitor')
    }
  }

  async function handlePauseMonitor(id: string) {
    try {
      const res = await fetch('/api/pause', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      })

      if (res.ok) {
        showToast('success', 'Monitor paused')
        fetchData()
      } else {
        const data = await res.json()
        showToast('error', data.error || 'Failed to pause monitor')
      }
    } catch (err) {
      console.error('Failed to pause monitor:', err)
      showToast('error', 'Failed to pause monitor')
    }
  }

  async function handleResumeMonitor(id: string) {
    try {
      const res = await fetch('/api/resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      })

      if (res.ok) {
        showToast('success', 'Monitor resumed')
        fetchData()
      } else {
        const data = await res.json()
        showToast('error', data.error || 'Failed to resume monitor')
      }
    } catch (err) {
      console.error('Failed to resume monitor:', err)
      showToast('error', 'Failed to resume monitor')
    }
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          <div style={{
            width: 32, height: 32,
            border: '2px solid var(--accent)',
            borderTopColor: 'transparent',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
          }} />
          <span style={{ color: 'var(--muted)', fontSize: 13 }}>Loading monitors…</span>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    )
  }

  const firstDown = monitors.find(m => m.status === 'down')

  return (
    <>
      <AppFrame
        activeRoute={statusFilter === 'down' ? 'incidents' : 'monitors'}
        stats={stats ? { total: stats.total, down: stats.down, late: stats.late, healthy: stats.healthy, paused: stats.paused } : undefined}
        onNavigate={(route) => {
          if (route === 'incidents') setStatusFilter('down')
          else if (route === 'monitors') setStatusFilter('all')
        }}
        title="Monitors"
        subtitle={stats ? `${stats.total} monitor${stats.total === 1 ? '' : 's'} · ${stats.healthy} healthy · ${stats.down} down` : 'Loading…'}
        headerRight={
          <>
            <select
              value={refreshInterval}
              onChange={(e) => setRefreshInterval(Number(e.target.value))}
              aria-label="Auto-refresh interval"
              style={{
                height: 28,
                padding: '0 8px',
                fontSize: 12,
                background: 'var(--surface)',
                border: '1px solid var(--border-strong)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--fg)',
                cursor: 'pointer',
              }}
            >
              <option value={30}>30s</option>
              <option value={60}>1m</option>
              <option value={300}>5m</option>
            </select>
            <button
              type="button"
              onClick={() => setShowModal(true)}
              className="cg-btn is-sm is-primary"
            >
              <I name="plus" size={13} /> New monitor
            </button>
            <ThemeToggle />
          </>
        }
      >
        <div style={{ padding: '20px 24px 32px' }}>
          {/* Onboarding strip — only for new installs with zero monitors */}
          {monitors.length === 0 && (
            <OnboardingStrip onCreateClick={() => setShowModal(true)} />
          )}

          {/* Incident banner */}
          {firstDown && stats && (stats.down > 0 || stats.late > 0) && (
            <IncidentBanner
              data={{
                count: stats.down,
                monitorName: firstDown.name,
                duration: formatRelativeTime(firstDown.lastPing),
                detail: `Expected ${firstDown.schedule.toLowerCase()} · grace ${firstDown.graceMinutes}m`,
              }}
            />
          )}

          {/* Stats */}
          {stats && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 18 }}>
              <StatTile label="Total monitors" value={stats.total} icon="grid" />
              <StatTile label="Healthy" value={stats.healthy} status="healthy" />
              <StatTile label="Late" value={stats.late} status="late" pulse={stats.late > 0} />
              <StatTile label="Down" value={stats.down} status="down" pulse={stats.down > 0} />
              <StatTile label="Paused" value={stats.paused} status="paused" />
            </div>
          )}

          {/* Monitors Section */}
          <div className="cg-card" style={{ overflow: 'hidden' }}>
            <div className="cg-card-h">
              <div className="row gap-8">
                <Tab
                  label="All"
                  count={stats?.total ?? 0}
                  active={statusFilter === 'all'}
                  onClick={() => setStatusFilter('all')}
                />
                <Tab
                  label="Active incidents"
                  count={(stats?.down ?? 0) + (stats?.late ?? 0)}
                  accent
                  active={statusFilter === 'down'}
                  onClick={() => setStatusFilter('down')}
                />
                <Tab
                  label="Late"
                  count={stats?.late ?? 0}
                  active={statusFilter === 'late'}
                  onClick={() => setStatusFilter('late')}
                />
              </div>
              <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>
                auto-refresh <span className="mono">{refreshInterval >= 60 ? `${refreshInterval / 60}m` : `${refreshInterval}s`}</span>
              </span>
            </div>

            {monitors.length === 0 ? (
              <div style={{ padding: '64px 32px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
                <div style={{
                  width: 56, height: 56,
                  borderRadius: 16,
                  background: 'var(--accent-soft)',
                  color: 'var(--accent)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <I name="graph" size={28} />
                </div>
                <div className="col" style={{ gap: 6, alignItems: 'center' }}>
                  <div style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: 20,
                    fontWeight: 600,
                    letterSpacing: '-0.015em',
                  }}>
                    No monitors yet
                  </div>
                  <div style={{ fontSize: 13.5, color: 'var(--muted)', maxWidth: 360 }}>
                    Create your first monitor to start tracking your cron jobs. It takes about 30 seconds.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowModal(true)}
                  className="cg-btn is-primary"
                  style={{ marginTop: 4 }}
                >
                  <I name="plus" size={13} /> Create monitor
                </button>
              </div>
            ) : monitors.filter((m) => statusFilter === 'all' || m.status === statusFilter).length === 0 ? (
              <div style={{ padding: '48px 32px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                <div style={{ fontSize: 13.5, color: 'var(--muted)' }}>
                  No {statusFilter} monitors
                </div>
                <button
                  type="button"
                  onClick={() => setStatusFilter('all')}
                  className="cg-btn is-sm is-ghost"
                  style={{ color: 'var(--accent)' }}
                >
                  Show all monitors
                </button>
              </div>
            ) : (
              <>
                <div
                  className="cg-list-h"
                  style={{ gridTemplateColumns: '3px 1.4fr 0.9fr 100px 90px 130px' }}
                >
                  <span></span>
                  <span>Monitor</span>
                  <span>Heartbeat · last 30</span>
                  <span>Last ping</span>
                  <span>Status</span>
                  <span style={{ textAlign: 'right' }}>Actions</span>
                </div>

                <div className="cg-list">
                  {monitors
                    .filter((m) => statusFilter === 'all' || m.status === statusFilter)
                    .map((monitor) => {
                      const hb = buildHeartbeat(monitor)
                      return (
                        <div
                          key={monitor.id}
                          className="cg-list-row"
                          style={{ gridTemplateColumns: '3px 1.4fr 0.9fr 100px 90px 130px' }}
                        >
                          <StatusBar status={monitor.status} />

                          <div className="col" style={{ gap: 2, minWidth: 0 }}>
                            <span
                              className="name"
                              style={{
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {monitor.name}
                            </span>
                            <div className="sub">
                              {monitor.schedule} · {monitor.graceMinutes}m grace
                              {monitor.paused && monitor.pauseReason ? ` · ${monitor.pauseReason}` : ''}
                            </div>
                          </div>

                          <Heartbeat items={hb} height={20} />

                          <div className="when" suppressHydrationWarning>{formatRelativeTime(monitor.lastPing)}</div>

                          <StatusBadge
                            status={monitor.status}
                            pulse={monitor.status === 'down' || monitor.status === 'late'}
                          />

                          <div
                            className="row gap-4"
                            style={{ justifyContent: 'flex-end', color: 'var(--muted)' }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            {monitor.paused ? (
                              <button
                                type="button"
                                onClick={() => handleResumeMonitor(monitor.id)}
                                className="cg-btn is-sm is-ghost"
                                style={{ height: 24, padding: '0 6px' }}
                                title="Resume monitor"
                              >
                                <I name="play" size={12} />
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handlePauseMonitor(monitor.id)}
                                className="cg-btn is-sm is-ghost"
                                style={{ height: 24, padding: '0 6px' }}
                                title="Pause monitor"
                              >
                                <I name="pause" size={12} />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => setCodeDrawerMonitor({ id: monitor.id, name: monitor.name })}
                              className="cg-btn is-sm is-ghost"
                              style={{ height: 24, padding: '0 6px' }}
                              title="Get code"
                              aria-label="Get integration code"
                            >
                              <I name="code" size={12} />
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingMonitor(monitor)}
                              className="cg-btn is-sm is-ghost"
                              style={{ height: 24, padding: '0 6px' }}
                              title="Edit"
                            >
                              <I name="edit" size={12} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(monitor.id)}
                              className="cg-btn is-sm is-ghost"
                              style={{ height: 24, padding: '0 6px', color: 'var(--down)' }}
                              title="Delete"
                            >
                              <I name="trash" size={12} />
                            </button>
                          </div>
                        </div>
                      )
                    })}
                </div>
              </>
            )}
          </div>

          {/* Integration guide — empty-state only.
              Shown when the user has 0 monitors or none have ever pinged. */}
          {(monitors.length === 0 || monitors.every((m) => m.lastPing === null)) && (
            <div style={{ marginTop: 20 }}>
              <IntegrationPanel
                baseUrl={baseUrl}
                variant="card"
                headerSlot={
                  <div className="cg-card-h">
                    <div className="col" style={{ gap: 2 }}>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>Integration</div>
                      <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                        Add a simple HTTP call to your cron job
                      </div>
                    </div>
                  </div>
                }
              />
            </div>
          )}
        </div>
      </AppFrame>

      {/* Create Monitor Modal */}
      {showModal && (() => {
        const closeAndReset = () => {
          setShowModal(false)
          setCreatedMonitor(null)
          setNewMonitor({ name: '', schedule: '', graceMinutes: 15 })
        }
        return (
        <div className="cg-modal-back" onClick={closeAndReset}>
          <div
            className="cg-modal"
            onClick={(e) => e.stopPropagation()}
            style={{ width: 820, maxWidth: '95%' }}
          >
            <div className="cg-card-h">
              <div style={{ fontSize: 14, fontWeight: 600 }}>
                {createdMonitor ? 'Add this to your job' : 'New monitor'}
              </div>
              <button
                type="button"
                onClick={closeAndReset}
                className="cg-btn is-sm is-ghost"
                style={{ height: 24, padding: '0 6px' }}
                aria-label="Close"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {createdMonitor ? (
              <>
                <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', background: 'var(--surface-2)' }}>
                  <div className="row gap-10" style={{ alignItems: 'center', marginBottom: 12 }}>
                    <span style={{
                      width: 28, height: 28,
                      borderRadius: '50%',
                      background: 'var(--healthy-soft)',
                      color: 'var(--healthy)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      <I name="check" size={14} />
                    </span>
                    <div className="col" style={{ gap: 2, minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 600 }}>
                        {createdMonitor.name} is ready
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                        Drop this HTTP call into your job — first ping completes setup.
                      </div>
                    </div>
                  </div>
                  <div className="cg-eyebrow" style={{ marginBottom: 6 }}>Ping URL</div>
                  <div
                    className="mono"
                    style={{
                      padding: '8px 12px',
                      background: 'var(--bg)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: 12,
                      color: 'var(--fg-2)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                    title={`${baseUrl || 'https://cronguard.app'}/api/ping/${createdMonitor.id}`}
                  >
                    {baseUrl || 'https://cronguard.app'}/api/ping/{createdMonitor.id}
                  </div>
                </div>
                <IntegrationPanel
                  baseUrl={baseUrl}
                  monitorId={createdMonitor.id}
                  variant="flush"
                />
                <div style={{ padding: '12px 20px 16px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', background: 'var(--surface)' }}>
                  <button type="button" onClick={closeAndReset} className="cg-btn is-sm is-primary">
                    <I name="check" size={12} /> Done — start monitoring
                  </button>
                </div>
              </>
            ) : (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0 }}>
                  {/* LEFT — form */}
                  <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14, borderRight: '1px solid var(--border)' }}>
                    <div>
                      <label className="cg-label">Name</label>
                      <input
                        type="text"
                        value={newMonitor.name}
                        onChange={(e) => setNewMonitor({ ...newMonitor, name: e.target.value })}
                        placeholder="e.g. Postgres nightly backup"
                        className="cg-input"
                        autoFocus
                      />
                    </div>

                    <div>
                      <label className="cg-label">Schedule</label>
                      <div className="row" style={{ flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                        {SCHEDULE_PRESETS.map((preset) => {
                          const isActive = newMonitor.schedule === preset
                          return (
                            <button
                              key={preset}
                              type="button"
                              onClick={() => setNewMonitor({ ...newMonitor, schedule: preset })}
                              style={{
                                height: 26,
                                padding: '0 10px',
                                borderRadius: 999,
                                fontSize: 11.5,
                                fontWeight: 500,
                                cursor: 'pointer',
                                background: isActive ? 'var(--accent-soft)' : 'transparent',
                                color: isActive ? 'var(--accent)' : 'var(--fg-2)',
                                border: isActive ? '1px solid transparent' : '1px solid var(--border)',
                              }}
                            >
                              {preset}
                            </button>
                          )
                        })}
                      </div>
                      <input
                        type="text"
                        value={newMonitor.schedule}
                        onChange={(e) => setNewMonitor({ ...newMonitor, schedule: e.target.value })}
                        placeholder="e.g. Every 5 minutes"
                        className="cg-input"
                      />
                      <p className="cg-hint">Use: Every X minutes, Every hour, Daily, Weekly</p>
                    </div>

                    <div>
                      <label className="cg-label">Grace period</label>
                      <div style={{ position: 'relative' }}>
                        <input
                          type="number"
                          value={newMonitor.graceMinutes}
                          onChange={(e) => setNewMonitor({ ...newMonitor, graceMinutes: parseInt(e.target.value) || 15 })}
                          className="cg-input"
                          style={{ paddingRight: 48 }}
                        />
                        <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', fontSize: 12 }}>min</span>
                      </div>
                      <p className="cg-hint">How long to wait before alerting</p>
                    </div>
                  </div>

                  {/* RIGHT — live preview */}
                  <div style={{ padding: 20, background: 'var(--surface-2)', display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <span className="cg-eyebrow">Preview</span>

                    <div style={{
                      background: 'var(--surface)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius)',
                      padding: '12px 14px',
                      display: 'grid',
                      gridTemplateColumns: '3px 1fr auto',
                      gap: 12,
                      alignItems: 'center',
                    }}>
                      <span style={{ width: 3, height: 26, borderRadius: 2, background: 'var(--paused)' }} />
                      <div className="col" style={{ gap: 2, minWidth: 0 }}>
                        <div style={{
                          fontSize: 13.5,
                          fontWeight: 500,
                          color: newMonitor.name ? 'var(--fg)' : 'var(--muted)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}>
                          {newMonitor.name || 'Monitor name'}
                        </div>
                        <div className="mono" style={{ fontSize: 11.5, color: 'var(--muted)' }}>
                          {newMonitor.schedule || 'Schedule'} · {newMonitor.graceMinutes || 15}m grace
                        </div>
                      </div>
                      <span className="cg-badge is-paused" style={{ fontSize: 10.5 }}>
                        Pending first ping
                      </span>
                    </div>

                    <div>
                      <div className="cg-eyebrow" style={{ marginBottom: 6 }}>Ping URL</div>
                      <div style={{
                        padding: '8px 12px',
                        background: 'var(--bg)',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-sm)',
                        fontFamily: 'var(--font-mono)',
                        fontSize: 11.5,
                        color: 'var(--muted)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}>
                        {baseUrl || 'https://cronguard.app'}/api/ping/<span style={{ color: 'var(--accent)' }}>your-monitor-id</span>
                      </div>
                      <p className="cg-hint">Available after creation. Any GET or POST counts as a ping.</p>
                    </div>

                    <div style={{
                      padding: '12px 14px',
                      background: 'var(--surface)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-sm)',
                    }}>
                      <div className="cg-eyebrow" style={{ marginBottom: 6 }}>We&apos;ll watch for</div>
                      <div className="col gap-8">
                        <div className="row gap-8" style={{ fontSize: 12 }}>
                          <span style={{ color: 'var(--accent)', display: 'inline-flex' }}>
                            <I name="check" size={11} />
                          </span>
                          <span style={{ color: 'var(--fg-2)' }}>
                            A ping every <strong style={{ color: 'var(--fg)' }}>{newMonitor.schedule || '—'}</strong>
                          </span>
                        </div>
                        <div className="row gap-8" style={{ fontSize: 12 }}>
                          <span style={{ color: 'var(--accent)', display: 'inline-flex' }}>
                            <I name="check" size={11} />
                          </span>
                          <span style={{ color: 'var(--fg-2)' }}>
                            Alert after <strong style={{ color: 'var(--fg)' }}>{newMonitor.graceMinutes || 15} min</strong> of silence
                          </span>
                        </div>
                        <div className="row gap-8" style={{ fontSize: 12 }}>
                          <span style={{ color: 'var(--accent)', display: 'inline-flex' }}>
                            <I name="check" size={11} />
                          </span>
                          <span style={{ color: 'var(--fg-2)' }}>
                            Recovery notification when it pings again
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div style={{ padding: '12px 20px 16px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8, justifyContent: 'space-between', background: 'var(--surface)' }}>
                  <button type="button" onClick={closeAndReset} className="cg-btn is-sm is-ghost">
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleCreateMonitor}
                    disabled={!newMonitor.name || !newMonitor.schedule}
                    className="cg-btn is-sm is-primary"
                    style={!newMonitor.name || !newMonitor.schedule ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}
                  >
                    <I name="plus" size={12} /> Create monitor
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
        )
      })()}

      {/* Edit Monitor Modal */}
      {editingMonitor && (
        <div className="cg-modal-back" onClick={() => setEditingMonitor(null)}>
          <div className="cg-modal" onClick={(e) => e.stopPropagation()}>
            <div className="cg-card-h">
              <div style={{ fontSize: 14, fontWeight: 600 }}>Edit monitor</div>
              <button
                type="button"
                onClick={() => setEditingMonitor(null)}
                className="cg-btn is-sm is-ghost"
                style={{ height: 24, padding: '0 6px' }}
                aria-label="Close"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label className="cg-label">Name</label>
                <input
                  type="text"
                  value={editingMonitor.name}
                  onChange={(e) => setEditingMonitor({ ...editingMonitor, name: e.target.value })}
                  className="cg-input"
                />
              </div>
              <div>
                <label className="cg-label">Schedule</label>
                <input
                  type="text"
                  value={editingMonitor.schedule}
                  onChange={(e) => setEditingMonitor({ ...editingMonitor, schedule: e.target.value })}
                  className="cg-input"
                />
                <p className="cg-hint">Use: Every X minutes, Every hour, Daily, Weekly</p>
              </div>
              <div>
                <label className="cg-label">Grace period</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="number"
                    value={editingMonitor.graceMinutes}
                    onChange={(e) => setEditingMonitor({ ...editingMonitor, graceMinutes: parseInt(e.target.value) || 15 })}
                    className="cg-input"
                    style={{ paddingRight: 48 }}
                  />
                  <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', fontSize: 12 }}>min</span>
                </div>
                <p className="cg-hint">How long to wait before alerting</p>
              </div>
            </div>

            <div style={{ padding: '12px 20px 16px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8, justifyContent: 'flex-end', background: 'var(--surface)' }}>
              <button type="button" onClick={() => setEditingMonitor(null)} className="cg-btn is-sm">
                Cancel
              </button>
              <button type="button" onClick={handleUpdateMonitor} className="cg-btn is-sm is-primary">
                Save changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Per-monitor integration drawer */}
      <CodeDrawer
        open={codeDrawerMonitor !== null}
        onClose={() => setCodeDrawerMonitor(null)}
        baseUrl={baseUrl}
        monitorId={codeDrawerMonitor?.id ?? ''}
        monitorName={codeDrawerMonitor?.name}
      />

      {/* Toast Notifications */}
      <div style={{
        position: 'fixed',
        bottom: 20,
        right: 20,
        zIndex: 200,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}>
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="cg-card"
            style={{
              padding: '10px 14px',
              borderColor: toast.type === 'success'
                ? 'color-mix(in oklab, var(--healthy) 30%, var(--border))'
                : 'color-mix(in oklab, var(--down) 30%, var(--border))',
              background: toast.type === 'success'
                ? 'color-mix(in oklab, var(--healthy) 8%, var(--surface))'
                : 'color-mix(in oklab, var(--down) 8%, var(--surface))',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              boxShadow: 'var(--shadow-md)',
              minWidth: 240,
            }}
          >
            <span style={{ color: toast.type === 'success' ? 'var(--healthy)' : 'var(--down)', display: 'inline-flex' }}>
              <I name={toast.type === 'success' ? 'check' : 'alert'} size={14} />
            </span>
            <span style={{ fontSize: 13, color: 'var(--fg)', fontWeight: 500 }}>
              {toast.message}
            </span>
          </div>
        ))}
      </div>
    </>
  )
}

function OnboardingStrip({ onCreateClick }: { onCreateClick: () => void }) {
  const steps = [
    {
      label: 'Create monitor',
      detail: 'Give your job a name and schedule',
      state: 'active' as const,
    },
    {
      label: 'Add curl to your job',
      detail: 'Drop a single HTTP call at the end',
      state: 'pending' as const,
    },
    {
      label: 'Wait for first ping',
      detail: "We'll watch — silence triggers an alert",
      state: 'pending' as const,
    },
  ]

  return (
    <div
      className="cg-card"
      style={{
        marginBottom: 16,
        padding: '16px 18px',
        background: 'linear-gradient(180deg, color-mix(in oklab, var(--accent) 6%, var(--surface)), var(--surface))',
        borderColor: 'color-mix(in oklab, var(--accent) 22%, var(--border))',
      }}
    >
      <div className="row spread" style={{ marginBottom: 12 }}>
        <div className="col" style={{ gap: 2 }}>
          <span className="cg-eyebrow" style={{ color: 'var(--accent)' }}>
            Get started
          </span>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--fg)' }}>
            Three steps to your first monitor
          </div>
        </div>
        <button type="button" onClick={onCreateClick} className="cg-btn is-sm is-primary">
          <I name="plus" size={13} /> Create monitor
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 0, alignItems: 'stretch' }}>
        {steps.map((step, idx) => {
          const isActive = step.state === 'active'
          return (
            <div
              key={step.label}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 12,
                padding: '12px 14px',
                borderRight: idx < steps.length - 1 ? '1px solid var(--border)' : undefined,
              }}
            >
              <div
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 12,
                  fontWeight: 600,
                  flexShrink: 0,
                  background: isActive ? 'var(--accent)' : 'var(--surface-2)',
                  color: isActive ? 'var(--accent-fg)' : 'var(--muted)',
                  border: isActive ? '1px solid var(--accent)' : '1px solid var(--border)',
                }}
              >
                {idx + 1}
              </div>
              <div className="col" style={{ gap: 2, minWidth: 0 }}>
                <div style={{
                  fontSize: 13,
                  fontWeight: 500,
                  color: isActive ? 'var(--fg)' : 'var(--muted)',
                }}>
                  {step.label}
                </div>
                <div style={{
                  fontSize: 11.5,
                  color: isActive ? 'var(--fg-2)' : 'var(--muted)',
                  opacity: isActive ? 1 : 0.7,
                }}>
                  {step.detail}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
