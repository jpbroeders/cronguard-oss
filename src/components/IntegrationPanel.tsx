'use client'

import { useEffect, useMemo, useState } from 'react'
import { LANGUAGES, getCodeExample } from '@/lib/code-examples'
import { highlightCode } from '@/lib/highlight'
import { I } from '@/components/cg'

interface IntegrationPanelProps {
  baseUrl: string
  // When provided, the example placeholder `YOUR_MONITOR_ID` is replaced with
  // this real id so the snippet is copy-paste ready.
  monitorId?: string | null
  // Visual variant. `card` matches the dashboard's integration card.
  // `flush` removes the outer borders so it can sit inside a drawer / modal.
  variant?: 'card' | 'flush'
  initialLanguage?: string
  headerSlot?: React.ReactNode
}

export function IntegrationPanel({
  baseUrl,
  monitorId,
  variant = 'card',
  initialLanguage = 'curl',
  headerSlot,
}: IntegrationPanelProps) {
  const [activeLanguage, setActiveLanguage] = useState(initialLanguage)
  const [copied, setCopied] = useState(false)

  const snippet = getCodeExample(activeLanguage, baseUrl || 'https://your-domain')
  const resolved = monitorId ? snippet.replaceAll('YOUR_MONITOR_ID', monitorId) : snippet
  const highlighted = useMemo(
    () => highlightCode(resolved, activeLanguage),
    [resolved, activeLanguage],
  )

  async function copy() {
    try {
      await navigator.clipboard.writeText(resolved)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Best-effort — falls back silently if clipboard is blocked.
    }
  }

  const wrapperClass = variant === 'card' ? 'cg-card' : ''
  const wrapperStyle: React.CSSProperties =
    variant === 'card' ? { overflow: 'hidden' } : { display: 'flex', flexDirection: 'column', minHeight: 0, flex: 1 }

  return (
    <div className={wrapperClass} style={wrapperStyle}>
      {headerSlot}

      <div
        style={{
          display: 'flex',
          borderBottom: '1px solid var(--border)',
          overflowX: 'auto',
        }}
      >
        {LANGUAGES.map((lang) => (
          <button
            key={lang.id}
            type="button"
            onClick={() => setActiveLanguage(lang.id)}
            style={{
              padding: '10px 14px',
              fontSize: 12,
              fontFamily: 'var(--font-mono)',
              background: activeLanguage === lang.id ? 'var(--bg)' : 'transparent',
              color: activeLanguage === lang.id ? 'var(--accent)' : 'var(--muted)',
              borderBottom:
                activeLanguage === lang.id
                  ? '2px solid var(--accent)'
                  : '2px solid transparent',
              border: 'none',
              cursor: 'pointer',
              fontWeight: activeLanguage === lang.id ? 600 : 400,
              whiteSpace: 'nowrap',
            }}
          >
            {lang.name}
          </button>
        ))}
      </div>

      <div
        className="cg-code-block"
        style={{
          border: 0,
          borderRadius: 0,
          padding: '20px 22px',
          position: 'relative',
          flex: variant === 'flush' ? 1 : undefined,
          overflow: 'auto',
        }}
      >
        <pre
          style={{
            margin: 0,
            fontFamily: 'var(--font-mono)',
            fontSize: 13,
            lineHeight: 1.7,
            whiteSpace: 'pre',
          }}
        >
          <code>{highlighted}</code>
        </pre>
        <button
          type="button"
          onClick={copy}
          className="cg-btn is-sm is-ghost"
          style={{ position: 'absolute', top: 12, right: 12, height: 24, padding: '0 10px' }}
        >
          <I name="copy" size={12} /> {copied ? 'Copied' : 'Copy'}
        </button>
      </div>

      {!monitorId && (
        <div
          style={{
            padding: '12px 16px',
            borderTop: '1px solid var(--border)',
            background: 'var(--surface-2)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 12,
            color: 'var(--muted)',
          }}
        >
          <I name="alert" size={13} style={{ color: 'var(--late)' }} />
          <span>
            Replace{' '}
            <code
              className="mono"
              style={{
                padding: '1px 5px',
                background: 'var(--bg)',
                border: '1px solid var(--border)',
                borderRadius: 4,
                color: 'var(--accent)',
              }}
            >
              YOUR_MONITOR_ID
            </code>{' '}
            with a monitor ID from the list above.
          </span>
        </div>
      )}
    </div>
  )
}

interface CodeDrawerProps {
  open: boolean
  onClose: () => void
  baseUrl: string
  monitorId: string
  monitorName?: string
}

export function CodeDrawer({
  open,
  onClose,
  baseUrl,
  monitorId,
  monitorName,
}: CodeDrawerProps) {
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const pingUrl = `${baseUrl || 'https://cronguard.app'}/api/ping/${monitorId}`

  return (
    <>
      <div className="cg-drawer-back" onClick={onClose} aria-hidden />
      <aside className="cg-drawer" role="dialog" aria-label="Integration snippet">
        <div
          className="cg-card-h"
          style={{ flexShrink: 0 }}
        >
          <div className="col" style={{ gap: 2, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>Get code</div>
            <div
              style={{
                fontSize: 12,
                color: 'var(--muted)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {monitorName ? `For ${monitorName}` : 'Drop into your job'}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="cg-btn is-sm is-ghost"
            style={{ height: 24, padding: '0 6px' }}
            aria-label="Close"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div
          style={{
            padding: '12px 14px',
            borderBottom: '1px solid var(--border)',
            flexShrink: 0,
          }}
        >
          <div className="cg-eyebrow" style={{ marginBottom: 6 }}>
            Ping URL
          </div>
          <div
            className="mono"
            style={{
              padding: '8px 10px',
              background: 'var(--bg)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              fontSize: 11.5,
              color: 'var(--fg-2)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
            title={pingUrl}
          >
            {pingUrl}
          </div>
        </div>

        <IntegrationPanel
          baseUrl={baseUrl}
          monitorId={monitorId}
          variant="flush"
        />
      </aside>
    </>
  )
}
