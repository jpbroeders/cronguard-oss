'use client'

import type { ReactNode } from 'react'
import { CGLogo, I, type IconName } from './index'

type Route = 'monitors' | 'incidents' | 'integrations' | 'settings'

interface Stats {
  total?: number
  down?: number
  late?: number
  healthy?: number
  paused?: number
}

interface AppFrameProps {
  activeRoute?: Route
  stats?: Stats
  onNavigate?: (route: Route) => void
  title: ReactNode
  subtitle?: ReactNode
  headerRight?: ReactNode
  children: ReactNode
}

export function AppFrame({
  activeRoute = 'monitors',
  stats,
  onNavigate,
  title,
  subtitle,
  headerRight,
  children,
}: AppFrameProps) {
  return (
    <div
      className="cg-app row"
      style={{
        alignItems: 'stretch',
        background: 'var(--bg)',
        color: 'var(--fg)',
        minHeight: '100vh',
        display: 'flex',
        width: '100%',
      }}
    >
      <SideNav active={activeRoute} stats={stats} onNavigate={onNavigate} />
      <div className="col fill" style={{ minWidth: 0, flex: 1 }}>
        <TopBar title={title} subtitle={subtitle} right={headerRight} />
        <div style={{ background: 'var(--bg)', flex: 1, overflow: 'auto' }}>{children}</div>
      </div>
    </div>
  )
}

// ─── SideNav ────────────────────────────────────────────────────────────

interface SideNavProps {
  active: Route
  stats?: Stats
  onNavigate?: (route: Route) => void
}

function SideNav({ active, stats, onNavigate }: SideNavProps) {
  const items: {
    id: Route
    label: string
    icon: IconName
    count?: number
    accent?: 'down' | null
    soon?: boolean
  }[] = [
    { id: 'monitors', label: 'Monitors', icon: 'list', count: stats?.total },
    {
      id: 'incidents',
      label: 'Incidents',
      icon: 'alert',
      count: stats?.down,
      accent: stats?.down ? 'down' : null,
    },
    { id: 'integrations', label: 'Integrations', icon: 'webhook', soon: true },
    { id: 'settings', label: 'Settings', icon: 'cog', soon: true },
  ]

  return (
    <aside
      style={{
        width: 218,
        borderRight: '1px solid var(--border)',
        background: 'var(--bg-elev)',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        minHeight: '100vh',
      }}
    >
      {/* Logo */}
      <div
        style={{
          padding: '16px 14px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <CGLogo size={22} />
      </div>

      {/* Nav */}
      <nav className="cg-sidenav">
        {items.map((it) => {
          const inner = (
            <>
              <span className="ico">
                <I name={it.icon} size={15} />
              </span>
              <span style={it.soon ? { color: 'var(--muted)' } : undefined}>{it.label}</span>
              {it.soon ? (
                <span
                  style={{
                    marginLeft: 'auto',
                    fontSize: 9.5,
                    fontWeight: 600,
                    letterSpacing: '0.05em',
                    textTransform: 'uppercase',
                    padding: '2px 6px',
                    borderRadius: 4,
                    background: 'var(--surface-3)',
                    color: 'var(--muted)',
                  }}
                >
                  Soon
                </span>
              ) : (
                it.count != null && it.count > 0 && (
                  <span
                    className="count"
                    style={{ color: it.accent === 'down' ? 'var(--down)' : 'var(--muted)' }}
                  >
                    {it.count}
                  </span>
                )
              )}
            </>
          )

          if (it.soon) {
            return (
              <div
                key={it.id}
                className="cg-sidenav-item"
                style={{ cursor: 'not-allowed', opacity: 0.55 }}
                title={`${it.label} — coming soon`}
              >
                {inner}
              </div>
            )
          }

          return (
            <button
              key={it.id}
              type="button"
              onClick={() => onNavigate?.(it.id)}
              className={`cg-sidenav-item${active === it.id ? ' is-active' : ''}`}
              style={{
                textDecoration: 'none',
                background: 'transparent',
                border: 'none',
                width: '100%',
                textAlign: 'left',
                font: 'inherit',
                cursor: 'pointer',
              }}
            >
              {inner}
            </button>
          )
        })}
      </nav>

      <div className="fill" />

      {/* Footer pill — open source notice */}
      <div style={{ padding: 12, borderTop: '1px solid var(--border)' }}>
        <a
          href="https://github.com/jpbroeders/cronguard-oss"
          target="_blank"
          rel="noreferrer"
          className="row gap-8"
          style={{
            padding: '6px 8px',
            textDecoration: 'none',
            color: 'var(--muted)',
            fontSize: 11.5,
          }}
        >
          <I name="external" size={12} />
          <span>Open source · self-hosted</span>
        </a>
      </div>
    </aside>
  )
}

// ─── TopBar ─────────────────────────────────────────────────────────────

function TopBar({
  title,
  subtitle,
  right,
}: {
  title: ReactNode
  subtitle?: ReactNode
  right?: ReactNode
}) {
  return (
    <header
      style={{
        height: 56,
        borderBottom: '1px solid var(--border)',
        padding: '0 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
        background: 'var(--bg-elev)',
        flexShrink: 0,
      }}
    >
      <div className="col" style={{ gap: 1 }}>
        <div style={{ fontSize: 14.5, fontWeight: 600, letterSpacing: '-0.01em' }}>{title}</div>
        {subtitle && <div style={{ fontSize: 12, color: 'var(--muted)' }}>{subtitle}</div>}
      </div>
      <div className="row gap-8">{right}</div>
    </header>
  )
}
