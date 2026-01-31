'use client'

import { useState, useEffect, useCallback } from 'react'
import { Monitor, parseScheduleInterval } from '@/lib/types'
import { ThemeToggle } from '@/components/ThemeToggle'

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

const LANGUAGES = [
  { id: 'curl', name: 'cURL' },
  { id: 'bash', name: 'Bash' },
  { id: 'python', name: 'Python' },
  { id: 'node', name: 'Node.js' },
  { id: 'go', name: 'Go' },
  { id: 'php', name: 'PHP' },
  { id: 'ruby', name: 'Ruby' },
  { id: 'java', name: 'Java' },
  { id: 'csharp', name: 'C#' },
  { id: 'rust', name: 'Rust' },
  { id: 'powershell', name: 'PowerShell' },
]

function getCodeExample(language: string, baseUrl: string): string {
  const url = `${baseUrl}/api/ping/YOUR_MONITOR_ID`

  const examples: Record<string, string> = {
    curl: `# Simple ping
curl -fsS "${url}"

# With timeout
curl -fsS --max-time 10 "${url}"

# Report failure on error
./my-script.sh && curl -fsS "${url}" \\
  || curl -fsS "${url}" -X POST -d '{"success":false}'`,

    bash: `#!/bin/bash
set -e

# Your job logic here
echo "Running backup..."

# Ping CronGuard on success
curl -fsS "${url}"`,

    python: `import requests

def main():
    # Your job logic here
    print("Running scheduled task...")

    # Ping on success
    requests.get("${url}")

if __name__ == "__main__":
    main()`,

    node: `// Simple ping
fetch("${url}");

// With error handling
async function runJob() {
  try {
    await doSomething();
    await fetch("${url}");
  } catch (error) {
    await fetch("${url}", {
      method: "POST",
      body: JSON.stringify({ success: false })
    });
  }
}`,

    go: `package main

import "net/http"

func main() {
    // Your job logic here
    runJob()

    // Ping CronGuard
    http.Get("${url}")
}`,

    php: `<?php
// Your job logic here
runBackup();

// Ping CronGuard
file_get_contents("${url}");`,

    ruby: `require 'net/http'

# Your job logic here
run_backup

# Ping CronGuard
Net::HTTP.get(URI("${url}"))`,

    java: `import java.net.http.*;
import java.net.URI;

public class CronJob {
    public static void main(String[] args) {
        // Your job logic here
        runJob();

        // Ping CronGuard
        HttpClient.newHttpClient()
            .send(HttpRequest.newBuilder()
                .uri(URI.create("${url}"))
                .GET().build(),
            HttpResponse.BodyHandlers.ofString());
    }
}`,

    csharp: `using System.Net.Http;

// Your job logic here
await RunJob();

// Ping CronGuard
await new HttpClient().GetAsync("${url}");`,

    rust: `use reqwest;

#[tokio::main]
async fn main() {
    // Your job logic here
    run_job().await;

    // Ping CronGuard
    reqwest::get("${url}").await.unwrap();
}`,

    powershell: `# Your job logic here
& .\\backup.ps1

# Ping CronGuard
Invoke-WebRequest -Uri "${url}" -Method GET`,
  }

  return examples[language] || examples.curl
}

export default function Dashboard() {
  const [monitors, setMonitors] = useState<Monitor[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [newMonitor, setNewMonitor] = useState({ name: '', schedule: '', graceMinutes: 15 })
  const [editingMonitor, setEditingMonitor] = useState<Monitor | null>(null)
  const [copying, setCopying] = useState<string | null>(null)
  const [activeLanguage, setActiveLanguage] = useState('curl')
  const [baseUrl, setBaseUrl] = useState('')
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
        setShowModal(false)
        setNewMonitor({ name: '', schedule: '', graceMinutes: 15 })
        showToast('success', 'Monitor created successfully')
        fetchData()
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

  async function handlePauseMonitor(id: string, reason?: string, until?: string) {
    try {
      const res = await fetch('/api/pause', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, reason, until })
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

  async function copyToClipboard(text: string, id: string) {
    try {
      await navigator.clipboard.writeText(text)
      setCopying(id)
      setTimeout(() => setCopying(null), 2000)
    } catch {
      // Fallback for older browsers or when clipboard API fails
      const textArea = document.createElement('textarea')
      textArea.value = text
      textArea.style.position = 'fixed'
      textArea.style.left = '-9999px'
      document.body.appendChild(textArea)
      textArea.select()
      try {
        document.execCommand('copy')
        setCopying(id)
        setTimeout(() => setCopying(null), 2000)
      } catch {
        showToast('error', 'Failed to copy to clipboard')
      }
      document.body.removeChild(textArea)
    }
  }

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

  function buildPingDisplay(monitor: Monitor): Array<{ type: 'ping' | 'missed' | 'late'; ping?: typeof monitor.pings[0]; timestamp?: number }> {
    const intervalMinutes = monitor.intervalMinutes || parseScheduleInterval(monitor.schedule)
    const intervalMs = intervalMinutes * 60 * 1000
    const graceMs = monitor.graceMinutes * 60 * 1000
    const result: Array<{ type: 'ping' | 'missed' | 'late'; ping?: typeof monitor.pings[0]; timestamp?: number }> = []

    if (monitor.lastPing) {
      const lastPingTime = new Date(monitor.lastPing).getTime()
      const now = Date.now()
      const timeSinceLastPing = now - lastPingTime

      if (timeSinceLastPing > intervalMs && timeSinceLastPing <= intervalMs + graceMs) {
        result.push({ type: 'late', timestamp: now })
      } else if (timeSinceLastPing > intervalMs + graceMs) {
        const missedCount = Math.floor((timeSinceLastPing - graceMs) / intervalMs)
        for (let i = 0; i < missedCount; i++) {
          result.push({ type: 'missed', timestamp: now - (i * intervalMs) })
        }
      }
    }

    for (let i = 0; i < monitor.pings.length; i++) {
      const ping = monitor.pings[i]
      result.push({ type: 'ping', ping })

      if (i < monitor.pings.length - 1) {
        const currentTime = new Date(ping.timestamp).getTime()
        const nextTime = new Date(monitor.pings[i + 1].timestamp).getTime()
        const gap = currentTime - nextTime

        if (gap > intervalMs + graceMs) {
          const missedCount = Math.ceil(gap / intervalMs) - 1
          for (let j = 0; j < missedCount; j++) {
            result.push({ type: 'missed', timestamp: currentTime - ((j + 1) * intervalMs) })
          }
        }
      }
    }

    return result.slice(0, 75)
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return (
          <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center">
            <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
        )
      case 'late':
        return (
          <div className="w-6 h-6 rounded-full bg-amber-500/20 flex items-center justify-center animate-pulse">
            <svg className="w-4 h-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        )
      case 'down':
        return (
          <div className="w-6 h-6 rounded-full bg-red-500/20 flex items-center justify-center animate-pulse">
            <svg className="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
          </div>
        )
      case 'paused':
        return (
          <div className="w-6 h-6 rounded-full bg-gray-500/20 flex items-center justify-center">
            <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25v13.5m-7.5-13.5v13.5" />
            </svg>
          </div>
        )
      default:
        return (
          <div className="w-6 h-6 rounded-full bg-gray-500/20 flex items-center justify-center">
            <div className="w-2 h-2 rounded-full bg-gray-400" />
          </div>
        )
    }
  }

  const getStatusTextClass = (status: string) => {
    switch (status) {
      case 'healthy': return 'text-emerald-500'
      case 'late': return 'text-amber-500'
      case 'down': return 'text-red-500'
      case 'paused': return 'text-gray-500'
      default: return 'text-gray-400'
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
          <span className="text-[var(--muted)] text-sm">Loading monitors...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen grid-bg relative">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-[var(--card-border)] bg-[var(--background)]/80 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/25">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-tight">CronGuard</h1>
              <p className="text-xs text-[var(--muted)]">Cron Job Monitoring</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-[var(--muted)]">Refresh:</span>
              <select
                value={refreshInterval}
                onChange={(e) => setRefreshInterval(Number(e.target.value))}
                className="px-2 py-1.5 bg-[var(--card)] border border-[var(--card-border)] rounded-lg text-sm cursor-pointer"
              >
                <option value={30}>30s</option>
                <option value={60}>1m</option>
                <option value={300}>5m</option>
              </select>
            </div>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* Stats Grid */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
            <div className="stat-card total p-5 border border-[var(--card-border)] animate-fade-in animate-delay-1">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[var(--muted)] text-sm font-medium mb-1">Total</p>
                  <p className="text-3xl font-bold tracking-tight">{stats.total}</p>
                </div>
                <div className="w-12 h-12 rounded-full bg-indigo-500/10 flex items-center justify-center">
                  <svg className="w-6 h-6 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="stat-card healthy p-5 border border-[var(--card-border)] animate-fade-in animate-delay-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[var(--muted)] text-sm font-medium mb-1">Healthy</p>
                  <p className="text-3xl font-bold tracking-tight text-emerald-500">{stats.healthy}</p>
                </div>
                <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center">
                  <svg className="w-6 h-6 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="stat-card warning p-5 border border-[var(--card-border)] animate-fade-in animate-delay-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[var(--muted)] text-sm font-medium mb-1">Late</p>
                  <p className="text-3xl font-bold tracking-tight text-amber-500">{stats.late}</p>
                </div>
                <div className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center">
                  <svg className="w-6 h-6 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="stat-card danger p-5 border border-[var(--card-border)] animate-fade-in animate-delay-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[var(--muted)] text-sm font-medium mb-1">Down</p>
                  <p className="text-3xl font-bold tracking-tight text-red-500">{stats.down}</p>
                </div>
                <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center">
                  <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="stat-card paused p-5 border border-[var(--card-border)] animate-fade-in animate-delay-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[var(--muted)] text-sm font-medium mb-1">Paused</p>
                  <p className="text-3xl font-bold tracking-tight text-gray-500">{stats.paused}</p>
                </div>
                <div className="w-12 h-12 rounded-full bg-gray-500/10 flex items-center justify-center">
                  <svg className="w-6 h-6 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25v13.5m-7.5-13.5v13.5" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Monitors Section */}
        <div className="card overflow-hidden animate-fade-in" style={{ animationDelay: '0.5s' }}>
          <div className="p-5 border-b border-[var(--card-border)] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold">Monitors</h2>
              <div className="flex rounded-lg overflow-hidden border border-[var(--card-border)]">
                {(['all', 'late', 'down'] as const).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setStatusFilter(filter)}
                    className={`px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                      statusFilter === filter
                        ? 'bg-[var(--accent)] text-white'
                        : 'hover:bg-[var(--card-border)]'
                    }`}
                  >
                    {filter}
                  </button>
                ))}
              </div>
            </div>
            <button
              onClick={() => setShowModal(true)}
              className="btn btn-primary gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              New Monitor
            </button>
          </div>

          {monitors.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-16 h-16 rounded-2xl bg-[var(--card-border)] flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-[var(--muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium mb-2">No monitors yet</h3>
              <p className="text-[var(--muted)] text-sm mb-4">Create your first monitor to start tracking your cron jobs.</p>
              <button onClick={() => setShowModal(true)} className="btn btn-primary">
                Create Monitor
              </button>
            </div>
          ) : monitors.filter((m) => statusFilter === 'all' || m.status === statusFilter).length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-[var(--muted)]">No {statusFilter} monitors</p>
              <button onClick={() => setStatusFilter('all')} className="text-[var(--accent)] text-sm mt-2 hover:underline">
                Show all monitors
              </button>
            </div>
          ) : (
            <div className="divide-y divide-[var(--card-border)]">
              {monitors
                .filter((monitor) => statusFilter === 'all' || monitor.status === statusFilter)
                .map((monitor) => (
                <div key={monitor.id} className="p-5 hover:bg-[var(--card-border)]/30 transition-colors">
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div className="flex items-center gap-3">
                      {getStatusIcon(monitor.status)}
                      <div>
                        <h3 className="font-medium">{monitor.name}</h3>
                        <p className="text-sm text-[var(--muted)] mono">
                          {monitor.schedule} · {monitor.graceMinutes}m grace
                        </p>
                        {monitor.paused && monitor.pauseReason && (
                          <p className="text-xs text-gray-500 mt-1">
                            Paused: {monitor.pauseReason}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className={`text-sm font-medium capitalize ${getStatusTextClass(monitor.status)}`}>
                          {monitor.status}
                        </p>
                        <p className="text-xs text-[var(--muted)]">
                          {formatRelativeTime(monitor.lastPing)}
                        </p>
                      </div>
                      {monitor.paused ? (
                        <button
                          onClick={() => handleResumeMonitor(monitor.id)}
                          className="p-2 text-[var(--muted)] hover:text-emerald-500 hover:bg-emerald-500/10 rounded-lg transition-colors"
                          title="Resume monitor"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
                          </svg>
                        </button>
                      ) : (
                        <button
                          onClick={() => handlePauseMonitor(monitor.id)}
                          className="p-2 text-[var(--muted)] hover:text-gray-500 hover:bg-gray-500/10 rounded-lg transition-colors"
                          title="Pause monitor"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25v13.5m-7.5-13.5v13.5" />
                          </svg>
                        </button>
                      )}
                      <button
                        onClick={() => setEditingMonitor(monitor)}
                        className="p-2 text-[var(--muted)] hover:text-[var(--accent)] hover:bg-[var(--accent)]/10 rounded-lg transition-colors"
                        title="Edit monitor"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDelete(monitor.id)}
                        className="p-2 text-[var(--muted)] hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                        title="Delete monitor"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {/* Ping URL */}
                  <div className="flex items-center gap-2 p-3 bg-[var(--background)] rounded-lg border border-[var(--card-border)]">
                    <code className="flex-1 text-sm text-[var(--muted)] truncate">
                      {baseUrl}/api/ping/{monitor.id}
                    </code>
                    <button
                      onClick={() => copyToClipboard(`${baseUrl}/api/ping/${monitor.id}`, monitor.id)}
                      className="px-3 py-1 text-xs font-medium text-[var(--accent)] hover:bg-[var(--accent)]/10 rounded transition-colors"
                    >
                      {copying === monitor.id ? '✓ Copied' : 'Copy'}
                    </button>
                  </div>

                  {/* Ping History */}
                  {(monitor.pings.length > 0 || monitor.status === 'down') && (
                    <div className="mt-3">
                      <p className="text-xs text-[var(--muted)] mb-2">Recent activity</p>
                      <div className="flex gap-0.5">
                        {buildPingDisplay(monitor).map((item, idx) => (
                          <div
                            key={idx}
                            className={`h-6 flex-1 max-w-[12px] rounded-sm transition-all hover:scale-110 ${
                              item.type === 'missed'
                                ? 'bg-red-500'
                                : item.type === 'late'
                                  ? 'bg-amber-500 animate-pulse'
                                  : item.ping?.status === 'success'
                                    ? 'bg-emerald-500'
                                    : 'bg-red-400'
                            }`}
                            title={
                              item.type === 'missed'
                                ? `Missed`
                                : item.type === 'late'
                                  ? `Late - waiting`
                                  : `${item.ping?.status} - ${item.ping ? new Date(item.ping.timestamp).toLocaleString() : ''}`
                            }
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Integration Guide */}
        <div className="card mt-8 overflow-hidden animate-fade-in" style={{ animationDelay: '0.6s' }}>
          <div className="p-5 border-b border-[var(--card-border)]">
            <h2 className="text-lg font-semibold">Integration Guide</h2>
            <p className="text-sm text-[var(--muted)] mt-1">Add a simple HTTP call to your cron job</p>
          </div>

          {/* Language Tabs */}
          <div className="border-b border-[var(--card-border)] overflow-x-auto">
            <div className="flex">
              {LANGUAGES.map((lang) => (
                <button
                  key={lang.id}
                  onClick={() => setActiveLanguage(lang.id)}
                  className={`lang-tab ${activeLanguage === lang.id ? 'active' : ''}`}
                >
                  {lang.name}
                </button>
              ))}
            </div>
          </div>

          {/* Code Block */}
          <div className="p-5">
            <div className="code-block relative">
              <pre>
                <code>{getCodeExample(activeLanguage, baseUrl || 'https://your-domain')}</code>
              </pre>
              <button
                onClick={() => copyToClipboard(getCodeExample(activeLanguage, baseUrl || 'https://your-domain'), 'code')}
                className="absolute top-3 right-3 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white text-xs font-medium rounded transition-colors"
              >
                {copying === 'code' ? '✓ Copied' : 'Copy'}
              </button>
            </div>

            <div className="mt-4 p-4 rounded-lg bg-indigo-500/10 border border-indigo-500/20">
              <p className="text-sm text-[var(--foreground)]">
                <span className="font-medium">Tip:</span>{' '}
                <span className="text-[var(--muted)]">
                  Replace <code className="mono px-1 py-0.5 bg-[var(--card)] rounded text-[var(--accent)]">YOUR_MONITOR_ID</code> with
                  your monitor ID from the list above.
                </span>
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Create Monitor Modal */}
      {showModal && (
        <div className="fixed inset-0 modal-backdrop flex items-center justify-center z-50 p-4">
          <div
            className="card w-full max-w-md p-6 animate-fade-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold">New Monitor</h3>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 hover:bg-[var(--card-border)] rounded-lg transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Name</label>
                <input
                  type="text"
                  value={newMonitor.name}
                  onChange={(e) => setNewMonitor({ ...newMonitor, name: e.target.value })}
                  placeholder="e.g., Daily Backup"
                  className="w-full px-4 py-2.5 bg-[var(--background)] border border-[var(--card-border)] rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Schedule</label>
                <input
                  type="text"
                  value={newMonitor.schedule}
                  onChange={(e) => setNewMonitor({ ...newMonitor, schedule: e.target.value })}
                  placeholder="e.g., Every 5 minutes"
                  className="w-full px-4 py-2.5 bg-[var(--background)] border border-[var(--card-border)] rounded-lg"
                />
                <p className="text-xs text-[var(--muted)] mt-1.5">Use: Every X minutes, Every hour, Daily, Weekly</p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Grace Period</label>
                <div className="relative">
                  <input
                    type="number"
                    value={newMonitor.graceMinutes}
                    onChange={(e) => setNewMonitor({ ...newMonitor, graceMinutes: parseInt(e.target.value) || 15 })}
                    className="w-full px-4 py-2.5 bg-[var(--background)] border border-[var(--card-border)] rounded-lg pr-16"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--muted)] text-sm">min</span>
                </div>
                <p className="text-xs text-[var(--muted)] mt-1.5">How long to wait before alerting</p>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 px-4 py-2.5 border border-[var(--card-border)] rounded-lg font-medium hover:bg-[var(--card-border)] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateMonitor}
                className="flex-1 btn btn-primary"
              >
                Create Monitor
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Monitor Modal */}
      {editingMonitor && (
        <div className="fixed inset-0 modal-backdrop flex items-center justify-center z-50 p-4">
          <div
            className="card w-full max-w-md p-6 animate-fade-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold">Edit Monitor</h3>
              <button
                onClick={() => setEditingMonitor(null)}
                className="p-2 hover:bg-[var(--card-border)] rounded-lg transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Name</label>
                <input
                  type="text"
                  value={editingMonitor.name}
                  onChange={(e) => setEditingMonitor({ ...editingMonitor, name: e.target.value })}
                  className="w-full px-4 py-2.5 bg-[var(--background)] border border-[var(--card-border)] rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Schedule</label>
                <input
                  type="text"
                  value={editingMonitor.schedule}
                  onChange={(e) => setEditingMonitor({ ...editingMonitor, schedule: e.target.value })}
                  className="w-full px-4 py-2.5 bg-[var(--background)] border border-[var(--card-border)] rounded-lg"
                />
                <p className="text-xs text-[var(--muted)] mt-1.5">Use: Every X minutes, Every hour, Daily, Weekly</p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Grace Period</label>
                <div className="relative">
                  <input
                    type="number"
                    value={editingMonitor.graceMinutes}
                    onChange={(e) => setEditingMonitor({ ...editingMonitor, graceMinutes: parseInt(e.target.value) || 15 })}
                    className="w-full px-4 py-2.5 bg-[var(--background)] border border-[var(--card-border)] rounded-lg pr-16"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--muted)] text-sm">min</span>
                </div>
                <p className="text-xs text-[var(--muted)] mt-1.5">How long to wait before alerting</p>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setEditingMonitor(null)}
                className="flex-1 px-4 py-2.5 border border-[var(--card-border)] rounded-lg font-medium hover:bg-[var(--card-border)] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateMonitor}
                className="flex-1 btn btn-primary"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notifications */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`px-4 py-3 rounded-lg shadow-lg animate-fade-in flex items-center gap-2 ${
              toast.type === 'success'
                ? 'bg-emerald-500 text-white'
                : 'bg-red-500 text-white'
            }`}
          >
            {toast.type === 'success' ? (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            )}
            <span className="text-sm font-medium">{toast.message}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
