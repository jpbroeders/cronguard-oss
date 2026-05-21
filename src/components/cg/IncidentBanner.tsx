import type { ReactNode } from 'react'
import { I } from './index'

export interface IncidentBannerData {
  count: number
  monitorName: string
  duration: string
  detail?: string
}

export function IncidentBanner({
  data,
  onSnooze,
  onAcknowledge,
  onInvestigate,
}: {
  data: IncidentBannerData
  onSnooze?: () => void
  onAcknowledge?: () => void
  onInvestigate?: () => void
}) {
  return (
    <div
      style={{
        borderRadius: 'var(--radius)',
        border: '1px solid color-mix(in oklab, var(--down) 35%, transparent)',
        background:
          'linear-gradient(180deg, color-mix(in oklab, var(--down) 12%, var(--bg-elev)), var(--bg-elev))',
        padding: '14px 16px',
        marginBottom: 16,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
      }}
    >
      <div className="row gap-12" style={{ alignItems: 'center' }}>
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            background: 'var(--down-soft)',
            color: 'var(--down)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <span style={{ color: 'var(--down)', display: 'inline-flex' }}>
            <span className="cg-pulse" />
          </span>
        </div>
        <div className="col" style={{ gap: 2 }}>
          <div style={{ fontSize: 13.5, fontWeight: 600 }}>
            <span style={{ color: 'var(--down)' }}>
              {data.count} incident{data.count === 1 ? '' : 's'} active
            </span>
            <span style={{ color: 'var(--muted)', fontWeight: 400 }}>
              {' '}· {data.monitorName} hasn&apos;t pinged for {data.duration}
            </span>
          </div>
          {data.detail && (
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>{data.detail}</div>
          )}
        </div>
      </div>
      <div className="row gap-8">
        {onSnooze && (
          <button type="button" onClick={onSnooze} className="cg-btn is-sm is-ghost">
            <I name="pause" size={13} /> Snooze 1h
          </button>
        )}
        {onAcknowledge && (
          <button type="button" onClick={onAcknowledge} className="cg-btn is-sm">
            Acknowledge
          </button>
        )}
        {onInvestigate && (
          <button type="button" onClick={onInvestigate} className="cg-btn is-sm is-primary">
            Investigate <I name="arrow" size={13} />
          </button>
        )}
      </div>
    </div>
  )
}

export function InlineActionBar({ children }: { children: ReactNode }) {
  return <div className="row gap-8">{children}</div>
}
