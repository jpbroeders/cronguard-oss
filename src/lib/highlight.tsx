// Tiny zero-dependency syntax highlighter — enough to make snippets readable
// without pulling in Prism/Shiki. Returns React nodes (not raw HTML) so user-
// supplied content (e.g. auth header values) can't break out of the markup.
//
// Token classes are defined in globals.css:
//   tk-c (comment) - tk-s (string) - tk-k (keyword) - tk-n (number) - tk-p (placeholder)
//
// We don't try to be a real parser. We tokenize left-to-right with a fixed
// rule order — first match wins. Strings and comments come first so their
// contents aren't re-tokenized as keywords.

import { Fragment, type ReactNode } from 'react'

interface Rule {
  // sticky regex anchored to current position (must use the `y` flag)
  re: RegExp
  cls: string
}

// Comment styles per language. Missing entries get no line comments.
const COMMENT_RE: Record<string, RegExp | null> = {
  curl: /#[^\n]*/y,
  bash: /#[^\n]*/y,
  k8s: /#[^\n]*/y,
  python: /#[^\n]*/y,
  ruby: /#[^\n]*/y,
  powershell: /#[^\n]*/y,
  node: /\/\/[^\n]*/y,
  go: /\/\/[^\n]*/y,
  java: /\/\/[^\n]*/y,
  csharp: /\/\/[^\n]*/y,
  rust: /\/\/[^\n]*/y,
  php: /(?:\/\/|#)[^\n]*/y,
}

// Keywords per language. Conservative lists to avoid false matches inside
// identifiers / library names.
const KEYWORDS: Record<string, string[]> = {
  bash: ['set', 'if', 'then', 'fi', 'else', 'echo', 'export'],
  curl: [],
  k8s: [],
  python: ['import', 'from', 'def', 'return', 'if', 'else', 'for', 'in', 'class'],
  ruby: ['require', 'def', 'end', 'do', 'class', 'module'],
  powershell: ['param', 'foreach', 'if', 'else'],
  node: ['async', 'await', 'function', 'const', 'let', 'var', 'try', 'catch', 'return', 'if', 'else', 'new'],
  go: ['package', 'import', 'func', 'return', 'var', 'if', 'else'],
  java: ['public', 'class', 'static', 'void', 'import', 'new', 'throws', 'Exception', 'String', 'long'],
  csharp: ['using', 'var', 'await', 'new'],
  rust: ['use', 'fn', 'let', 'mut', 'async', 'await', 'pub', 'match', 'as', 'unwrap'],
  php: ['function', 'return', 'if', 'else'],
}

function buildRules(language: string): Rule[] {
  const rules: Rule[] = []

  const cre = COMMENT_RE[language]
  if (cre) rules.push({ re: cre, cls: 'tk-c' })

  // Strings: double / single / backtick, with escapes.
  rules.push({ re: /"(?:\\.|[^"\\\n])*"/y, cls: 'tk-s' })
  rules.push({ re: /'(?:\\.|[^'\\\n])*'/y, cls: 'tk-s' })
  rules.push({ re: /`(?:\\.|[^`\\])*`/y, cls: 'tk-s' })

  // The placeholder we ask users to swap out — make it pop.
  rules.push({ re: /YOUR_MONITOR_ID/y, cls: 'tk-p' })

  // Numbers.
  rules.push({ re: /\b\d[\d_.]*\b/y, cls: 'tk-n' })

  const kw = KEYWORDS[language]
  if (kw && kw.length > 0) {
    const pattern = new RegExp(`\\b(?:${kw.join('|')})\\b`, 'y')
    rules.push({ re: pattern, cls: 'tk-k' })
  }

  return rules
}

export function highlightCode(code: string, language: string): ReactNode {
  const rules = buildRules(language)
  const out: ReactNode[] = []
  let i = 0
  let plain = ''
  let key = 0

  const flushPlain = () => {
    if (plain) {
      out.push(<Fragment key={key++}>{plain}</Fragment>)
      plain = ''
    }
  }

  while (i < code.length) {
    let matched = false
    for (const rule of rules) {
      rule.re.lastIndex = i
      const m = rule.re.exec(code)
      if (m && m.index === i) {
        flushPlain()
        out.push(
          <span key={key++} className={rule.cls}>
            {m[0]}
          </span>,
        )
        i += m[0].length
        matched = true
        break
      }
    }
    if (!matched) {
      plain += code[i]
      i++
    }
  }
  flushPlain()
  return out
}
