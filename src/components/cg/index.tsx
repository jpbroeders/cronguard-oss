// Shared design-system primitives ported from cronguard.
//
// - CGMark, CGLogo: brand
// - StatusBadge, StatusBar: status chips & rails
// - Heartbeat: per-monitor sparkline (HTML divs, not SVG)
// - HB: pre-baked heartbeat sequences for mockups
// - I/Ico: inline 16x16 icon set

import { cloneElement } from 'react'
import type { CSSProperties, ReactElement, SVGProps } from 'react'
import { CGMark } from '../CGMark'

// ─── Brand ──────────────────────────────────────────────────────────────

export { CGMark }
export { AppFrame } from './AppFrame'
export { StatTile, Tab } from './StatTile'
export { IncidentBanner, type IncidentBannerData } from './IncidentBanner'

export function CGLogo({ size = 24, showWordmark = true }: { size?: number; showWordmark?: boolean }) {
  return (
    <div className="row gap-10" style={{ alignItems: 'center' }}>
      <CGMark size={size} />
      {showWordmark && (
        <div className="col" style={{ gap: 0, lineHeight: 1 }}>
          <span
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: size * 0.66,
              fontWeight: 600,
              letterSpacing: '-0.02em',
              color: 'var(--fg)',
            }}
          >
            Cronguard
          </span>
        </div>
      )}
    </div>
  )
}

// ─── Status ─────────────────────────────────────────────────────────────

export type MonitorStatus = 'healthy' | 'late' | 'down' | 'paused'

export const STATUS: Record<MonitorStatus, { label: string; color: string; soft: string }> = {
  healthy: { label: 'Healthy', color: 'var(--healthy)', soft: 'var(--healthy-soft)' },
  late: { label: 'Late', color: 'var(--late)', soft: 'var(--late-soft)' },
  down: { label: 'Down', color: 'var(--down)', soft: 'var(--down-soft)' },
  paused: { label: 'Paused', color: 'var(--paused)', soft: 'var(--paused-soft)' },
}

export function StatusBadge({
  status,
  label,
  pulse,
}: {
  status: MonitorStatus
  label?: string
  pulse?: boolean
}) {
  const s = STATUS[status]
  return (
    <span className={`cg-badge is-${status}`}>
      {pulse ? (
        <span style={{ color: s.color, display: 'inline-flex' }}>
          <span className="cg-pulse" />
        </span>
      ) : (
        <span className="cg-dot" />
      )}
      {label || s.label}
    </span>
  )
}

export function StatusBar({ status }: { status: MonitorStatus }) {
  return <span className={`cg-statusbar is-${status}`} />
}

// ─── Heartbeat ──────────────────────────────────────────────────────────

export type HBKind = 'ok' | 'late' | 'miss' | 'idle'

export function Heartbeat({
  items,
  height = 22,
  bar = 3,
  gap = 2,
}: {
  items: HBKind[]
  height?: number
  bar?: number
  gap?: number
}) {
  return (
    <span className="cg-heart" style={{ height, gap }}>
      {items.map((kind, i) => {
        const h =
          kind === 'idle'
            ? 4
            : kind === 'miss'
              ? Math.round(height * 0.55)
              : kind === 'late'
                ? Math.round(height * 0.75)
                : Math.round(height * (0.45 + ((i * 13) % 11) / 18))
        const cls =
          kind === 'miss' ? 'b miss' : kind === 'late' ? 'b late' : kind === 'idle' ? 'b faint' : 'b'
        return <span key={i} className={cls} style={{ width: bar, height: h }} />
      })}
    </span>
  )
}

// ─── Icons ──────────────────────────────────────────────────────────────

type IconProps = SVGProps<SVGSVGElement>

const baseIcoProps = { viewBox: '0 0 16 16', fill: 'none', stroke: 'currentColor', strokeWidth: 1.5 } as const

const iconPaths: Record<string, React.ReactElement> = {
  dot: <svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="3" fill="currentColor" /></svg>,
  list: <svg {...baseIcoProps}><path d="M3 4h10M3 8h10M3 12h10" strokeLinecap="round" /></svg>,
  bell: <svg {...baseIcoProps}><path d="M4 11V7a4 4 0 0 1 8 0v4l1 1H3l1-1zM7 13a1 1 0 0 0 2 0" strokeLinecap="round" strokeLinejoin="round" /></svg>,
  graph: <svg {...baseIcoProps}><path d="M3 12V4M7 12V8M11 12V6M3 12h10" strokeLinecap="round" /></svg>,
  team: <svg {...baseIcoProps}><circle cx="6" cy="6" r="2.2" /><circle cx="11.5" cy="6.5" r="1.6" /><path d="M2.5 13c0-2 1.5-3.2 3.5-3.2s3.5 1.2 3.5 3.2M10 13c0-1.5 1.2-2.4 2.6-2.4s2 .6 2.4 1.4" strokeLinecap="round" /></svg>,
  cog: <svg {...baseIcoProps}><circle cx="8" cy="8" r="2.2" /><path d="M8 1.5v1.7M8 12.8v1.7M14.5 8h-1.7M3.2 8H1.5M12.6 3.4l-1.2 1.2M4.6 11.4l-1.2 1.2M12.6 12.6l-1.2-1.2M4.6 4.6L3.4 3.4" strokeLinecap="round" /></svg>,
  doc: <svg {...baseIcoProps}><path d="M4 2h5l3 3v9H4z" /><path d="M9 2v3h3M6 8h4M6 11h4" strokeLinecap="round" /></svg>,
  plus: <svg {...baseIcoProps} strokeWidth={1.7}><path d="M8 3v10M3 8h10" strokeLinecap="round" /></svg>,
  search: <svg {...baseIcoProps}><circle cx="7" cy="7" r="4" /><path d="M13 13l-2.7-2.7" strokeLinecap="round" /></svg>,
  filter: <svg {...baseIcoProps}><path d="M2 4h12M4.5 8h7M6.5 12h3" strokeLinecap="round" /></svg>,
  copy: <svg {...baseIcoProps}><rect x="3" y="3" width="8" height="8" rx="1.5" /><path d="M6 5h7v8" strokeLinecap="round" /></svg>,
  arrow: <svg {...baseIcoProps}><path d="M3 8h10M9 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" /></svg>,
  pause: <svg {...baseIcoProps}><path d="M6 4v8M10 4v8" strokeLinecap="round" /></svg>,
  play: <svg viewBox="0 0 16 16" fill="currentColor"><path d="M5 3l8 5-8 5z" /></svg>,
  chevron: <svg {...baseIcoProps}><path d="M6 4l4 4-4 4" strokeLinecap="round" /></svg>,
  external: <svg {...baseIcoProps}><path d="M7 4H3v9h9V9M10 3h3v3M13 3l-5 5" strokeLinecap="round" strokeLinejoin="round" /></svg>,
  check: <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={2}><path d="M3.5 8.5l3 3 6-7" strokeLinecap="round" strokeLinejoin="round" /></svg>,
  alert: <svg {...baseIcoProps}><path d="M8 2l6.5 11.5h-13z" strokeLinejoin="round" /><path d="M8 7v3M8 11.5v.5" strokeLinecap="round" /></svg>,
  globe: <svg {...baseIcoProps}><circle cx="8" cy="8" r="5.5" /><path d="M2.5 8h11M8 2.5c2 2 2 9 0 11M8 2.5c-2 2-2 9 0 11" /></svg>,
  shield: <svg {...baseIcoProps}><path d="M8 1.5l5 1.5v4.5c0 3-2.5 5.5-5 6-2.5-.5-5-3-5-6V3z" /></svg>,
  zap: <svg {...baseIcoProps}><path d="M9 1L3 9h4l-1 6 6-8H8z" strokeLinejoin="round" /></svg>,
  clock: <svg {...baseIcoProps}><circle cx="8" cy="8" r="5.5" /><path d="M8 5v3.5l2 1.5" strokeLinecap="round" /></svg>,
  trash: <svg {...baseIcoProps}><path d="M3 5h10M6 5V3.5h4V5M5 5l.6 8h4.8L11 5" strokeLinejoin="round" strokeLinecap="round" /></svg>,
  edit: <svg {...baseIcoProps}><path d="M11 2.5l2.5 2.5L6 12.5 3 13l.5-3z" strokeLinejoin="round" /></svg>,
  grid: <svg {...baseIcoProps}><rect x="2.5" y="2.5" width="4.5" height="4.5" rx="0.8" /><rect x="9" y="2.5" width="4.5" height="4.5" rx="0.8" /><rect x="2.5" y="9" width="4.5" height="4.5" rx="0.8" /><rect x="9" y="9" width="4.5" height="4.5" rx="0.8" /></svg>,
  mail: <svg {...baseIcoProps}><rect x="2" y="3.5" width="12" height="9" rx="1.5" /><path d="M2 5l6 4 6-4" strokeLinejoin="round" /></svg>,
  webhook: <svg {...baseIcoProps}><circle cx="5" cy="11.5" r="1.5" /><circle cx="11" cy="11.5" r="1.5" /><circle cx="8" cy="4" r="1.5" /><path d="M6.5 11.5h3M5.7 10.2L7.3 5.7M10.3 10.2 8.7 5.7" strokeLinecap="round" /></svg>,
  code: <svg {...baseIcoProps} strokeWidth={1.6}><path d="M6 5L2.5 8 6 11M10 5l3.5 3-3.5 3" strokeLinecap="round" strokeLinejoin="round" /></svg>,
}

export type IconName = keyof typeof iconPaths

export function I({ name, size = 16, style }: { name: IconName; size?: number; style?: CSSProperties }) {
  const el = iconPaths[name] as ReactElement<IconProps> | undefined
  if (!el) return null
  return (
    <span style={{ display: 'inline-flex', flexShrink: 0, width: size, height: size, ...(style || {}) }}>
      {cloneElement(el, { width: size, height: size })}
    </span>
  )
}
