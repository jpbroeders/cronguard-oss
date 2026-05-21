import { I, type IconName, type MonitorStatus } from './index'

export function StatTile({
  label,
  value,
  status,
  delta,
  icon,
  pulse,
}: {
  label: string
  value: string | number
  status?: MonitorStatus
  delta?: string
  icon?: IconName
  pulse?: boolean
}) {
  const color = status ? `var(--${status})` : undefined

  return (
    <div className="cg-stat">
      <div className="label">
        <span>{label}</span>
        {status && pulse && (
          <span style={{ color, marginLeft: 'auto', display: 'inline-flex' }}>
            <span className="cg-pulse" />
          </span>
        )}
        {status && !pulse && (
          <span style={{ color, marginLeft: 'auto', display: 'inline-flex' }}>
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: 'currentColor',
                display: 'inline-block',
              }}
            />
          </span>
        )}
        {icon && !status && (
          <span style={{ color: 'var(--muted)', marginLeft: 'auto', display: 'inline-flex' }}>
            <I name={icon} size={14} />
          </span>
        )}
      </div>
      <div className="num" style={status ? { color } : undefined}>
        {value}
      </div>
      {delta && <div className="delta">{delta}</div>}
    </div>
  )
}

export function Tab({
  label,
  count,
  active,
  accent,
  onClick,
}: {
  label: string
  count?: number
  active?: boolean
  accent?: boolean
  onClick?: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        height: 28,
        padding: '0 10px',
        borderRadius: 'var(--radius-sm)',
        background: active ? 'var(--surface-2)' : 'transparent',
        border: active ? '1px solid var(--border)' : '1px solid transparent',
        color: active ? 'var(--fg)' : 'var(--fg-2)',
        fontSize: 12.5,
        fontWeight: 500,
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
      }}
    >
      {label}
      {count != null && (
        <span
          style={{
            fontSize: 11,
            fontFamily: 'var(--font-mono)',
            color: accent ? 'var(--down)' : 'var(--muted)',
            background: accent ? 'var(--down-soft)' : 'transparent',
            padding: accent ? '1px 5px' : 0,
            borderRadius: 4,
          }}
        >
          {count}
        </span>
      )}
    </button>
  )
}
