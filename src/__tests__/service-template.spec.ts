import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import {
  SAFE_NAME,
  generateLogRotate,
  generateService,
  oneLine,
  shq,
  type ServiceOptions
} from '../service-template'

const defaults: ServiceOptions = {
  service: 'my-service',
  description: 'This command does something',
  username: 'root',
  command: '/usr/local/bin/command'
}

const opts = (overrides: Partial<ServiceOptions> = {}): ServiceOptions => ({
  ...defaults,
  ...overrides
})

/** Write a generated script to a temp file and return its path. */
const asFile = (script: string): string => {
  const path = join(mkdtempSync(join(tmpdir(), 'svc-')), 'init.sh')
  writeFileSync(path, script)
  return path
}

const isPresent = (bin: string): boolean =>
  spawnSync('sh', ['-c', `command -v ${bin}`]).status === 0

const CI = process.env.CI === 'true' || process.env.CI === '1'

/**
 * Decide whether a shell-validator test runs.
 *
 * In CI it always runs, so a missing validator fails the suite rather than
 * quietly reducing coverage — a skipped test still yields a green `npm test`,
 * which would make the guarantee in AGENTS.md untrue. Locally it is skipped
 * with a warning so contributors without the binaries are not blocked.
 */
const validatorRuns = (bin: string): boolean => {
  if (CI) return true
  if (isPresent(bin)) return true
  console.warn(`[skipped] ${bin} not found - generated-script validation is INCOMPLETE`)
  return false
}

describe('shell quoting', () => {
  it('wraps values in single quotes', () => {
    expect(shq('plain')).toBe("'plain'")
  })

  it('neutralises shell metacharacters', () => {
    expect(shq('x; rm -rf /')).toBe("'x; rm -rf /'")
    expect(shq('$(whoami)')).toBe("'$(whoami)'")
    expect(shq('`id`')).toBe("'`id`'")
  })

  it('closes and reopens the quote around an embedded single quote', () => {
    expect(shq("it's")).toBe("'it'\\''s'")
  })
})

describe('description sanitising', () => {
  it('collapses newlines so they cannot escape the comment block', () => {
    expect(oneLine('one\ntwo')).toBe('one two')
    expect(oneLine('one\r\n\r\ntwo')).toBe('one two')
  })
})

describe('name validation', () => {
  it.each(['my-service', 'svc_1', 'a.b', 'X9'])('accepts %s', (name: string) => {
    expect(SAFE_NAME.test(name)).toBe(true)
  })

  it.each(['', 'my service', 'x;y', 'a/b', '$x', 'a`b', 'a|b'])('rejects %j', (name: string) => {
    expect(SAFE_NAME.test(name)).toBe(false)
  })
})

describe('generated service script', () => {
  it('assigns every shell variable it references', () => {
    const script = generateService(opts())

    // Regression guard: $NAME was referenced in four places but never assigned,
    // which made start() report success unconditionally.
    expect(script).toMatch(/^NAME='my-service'$/m)
    expect(script).toMatch(/^SCRIPT='\/usr\/local\/bin\/command'$/m)
    expect(script).toMatch(/^RUNAS='root'$/m)
  })

  it('leaves no unsubstituted placeholder', () => {
    expect(generateService(opts())).not.toMatch(/<[A-Z_]+>/)
    expect(generateLogRotate(opts())).not.toMatch(/<[A-Z_]+>/)
  })

  it('uses POSIX redirection rather than the &> bashism', () => {
    const script = generateService(opts())
    expect(script).not.toContain('&>')
    expect(script).toContain('>> \\"$LOGFILE\\" 2>&1')
  })

  it('pins the shell so behaviour does not depend on the target user login shell', () => {
    expect(generateService(opts())).toContain('su -s /bin/sh -c "$CMD" "$RUNAS"')
  })

  it('quotes the service name where update-rc.d consumes it', () => {
    expect(generateService(opts())).toContain('update-rc.d -f "$NAME" remove')
  })

  it('declares Short-Description and uses /run for the pidfile', () => {
    const script = generateService(opts())
    expect(script).toMatch(/^# Short-Description: /m)
    expect(script).toContain('PIDFILE=/run/$NAME.pid')
    expect(script).not.toContain('/var/run/')
  })

  it('keeps a multi-line description inside the INIT INFO block', () => {
    const script = generateService(opts({ description: 'Line one\n# hijacked' }))
    const header = script.slice(0, script.indexOf('### END INIT INFO'))
    expect(header).toContain('# Description:       Line one # hijacked')
    expect(header.split('\n').filter((l) => l.trim() !== '' && !l.startsWith('#'))).toEqual([])
  })

  it('renders a command containing quotes and spaces without breaking quoting', () => {
    const script = generateService(opts({ command: '/usr/bin/node /srv/app.js --opt="x y"' }))
    expect(script).toContain(`SCRIPT='/usr/bin/node /srv/app.js --opt="x y"'`)
  })

  it('sets a non-zero exit status for an unknown action', () => {
    // LSB reserves 2 for invalid or excess arguments; exiting 0 would hide
    // usage errors from callers and monitoring.
    expect(generateService(opts())).toMatch(/echo "Usage: \$0 [^"]+"\n\s+#[^\n]*\n\s+exit 2\nesac/)
  })
})

describe('generator boundary validation', () => {
  // The generators are the trust boundary, not App.vue: a direct caller must not
  // be able to reach the unquotable <NAME> contexts (LSB comment, logrotate
  // stanza path) with arbitrary input.
  const bad = ['x; touch /tmp/PWNED #', 'my app', 'a/b', '$(id)', 'a`b', '']

  it.each(bad)('generateService rejects service name %j', (service: string) => {
    expect(() => generateService(opts({ service }))).toThrow(/Invalid service name/)
  })

  it.each(bad)('generateLogRotate rejects service name %j', (service: string) => {
    expect(() => generateLogRotate(opts({ service }))).toThrow(/Invalid service name/)
  })

  it.each(bad)('generateService rejects username %j', (username: string) => {
    expect(() => generateService(opts({ username }))).toThrow(/Invalid username/)
  })

  it.each(['', '   '])('generateService rejects empty command %j', (command: string) => {
    expect(() => generateService(opts({ command }))).toThrow(/Command cannot be empty/)
  })

  it('accepts a description containing shell metacharacters and newlines', () => {
    // Only the name and username are charset-restricted; the description is a
    // free-text comment, sanitised rather than rejected.
    expect(() =>
      generateService(opts({ description: '$(id); rm -rf /\nsecond line' }))
    ).not.toThrow()
  })
})

describe('$-sequences in user input are substituted verbatim', () => {
  // Regression guard: string replacements make $$, $&, $`, $' and $1 special,
  // so `--pid $$` emitted `--pid $` and `$&` emitted the placeholder itself.
  const dollars = ['$$', '$&', '$`', "$'", '$1', '$<NAME>']

  // Asserted against shq(command) rather than a raw-quoted literal: an input
  // containing a single quote is legitimately re-quoted, so only shq() defines
  // the correct output. A mangled $-sequence still fails this.
  it.each(dollars)('keeps %j intact in the command', (seq: string) => {
    const command = `/usr/bin/foo ${seq} --end`
    const script = generateService(opts({ command }))
    expect(script).toContain(`SCRIPT=${shq(command)}`)
    expect(script).not.toContain('<COMMAND_Q>')
  })

  // The definitive check: let a real shell parse the emitted assignment and
  // confirm it yields the original string back, byte for byte.
  it.runIf(validatorRuns('dash'))('round-trips through a real shell', () => {
    for (const seq of dollars) {
      const command = `/usr/bin/foo ${seq} --end`
      const script = generateService(opts({ command }))
      const assignment = script.split('\n').find((l) => l.startsWith('SCRIPT='))
      const out = spawnSync('dash', ['-c', `${assignment}\nprintf '%s' "$SCRIPT"`], {
        encoding: 'utf8'
      })
      expect(out.stderr, `dash rejected ${assignment ?? '<missing>'}`).toBe('')
      expect(out.stdout, `round-trip failed for ${JSON.stringify(seq)}`).toBe(command)
    }
  })

  it.each(dollars)('keeps %j intact in the description', (seq: string) => {
    const script = generateService(opts({ description: `costs ${seq} more` }))
    expect(script).toContain(`costs ${seq} more`)
    expect(script).not.toContain('<DESCRIPTION>')
  })

  it('emits a shell PID reference unchanged', () => {
    const script = generateService(opts({ command: '/usr/bin/foo --pid $$' }))
    expect(script).toContain("SCRIPT='/usr/bin/foo --pid $$'")
  })

  // Substitution must be a single pass. Chained .replace() calls re-scanned
  // already-substituted text, so a command containing the literal <NAME> was
  // rewritten into the service name.
  it.each(['<NAME>', '<DESCRIPTION>', '<COMMAND_Q>', '<NAME_Q>'])(
    'does not re-substitute %s appearing inside the command',
    (literal: string) => {
      const command = `/usr/bin/foo ${literal} --end`
      const script = generateService(opts({ command }))
      expect(script).toContain(`SCRIPT='${command}'`)
      expect(script).not.toContain(`/usr/bin/foo my-service`)
    }
  )

  it('does not re-substitute a placeholder appearing inside the description', () => {
    const script = generateService(opts({ description: 'see <NAME> for details' }))
    expect(script).toContain('see <NAME> for details')
  })
})

describe('generated logrotate config', () => {
  it('targets the service log', () => {
    expect(generateLogRotate(opts())).toContain('/var/log/my-service.log {')
  })
})

// These are the checks that would have caught the $NAME, &> and non-POSIX
// defects on first run. Mandatory in CI (see validatorRuns).
describe('shell validation of the generated script', () => {
  const cases: ServiceOptions[] = [
    opts(),
    opts({ service: 'svc_2', username: 'www_data', command: '/bin/true' }),
    opts({ command: '/usr/bin/node /srv/app.js --opt="x y"' }),
    opts({ description: 'Line one\n# hijacked' })
  ]

  it.runIf(validatorRuns('dash'))('parses under dash', () => {
    expect(isPresent('dash'), 'dash is required to validate the generated script').toBe(true)
    for (const c of cases) {
      const result = spawnSync('dash', ['-n', asFile(generateService(c))], { encoding: 'utf8' })
      expect(result.stderr, `dash -n failed for ${JSON.stringify(c)}`).toBe('')
      expect(result.status).toBe(0)
    }
  })

  it.runIf(validatorRuns('shellcheck'))('passes shellcheck with no warnings or errors', () => {
    expect(isPresent('shellcheck'), 'shellcheck is required to validate the generated script').toBe(
      true
    )
    for (const c of cases) {
      // -S warning: fail on warning and error, allow style/info notes.
      const result = spawnSync(
        'shellcheck',
        ['-s', 'sh', '-S', 'warning', asFile(generateService(c))],
        { encoding: 'utf8' }
      )
      expect(result.stdout, `shellcheck failed for ${JSON.stringify(c)}`).toBe('')
      expect(result.status).toBe(0)
    }
  })

  it.runIf(validatorRuns('shellcheck'))('records the shellcheck version used', () => {
    expect(execFileSync('shellcheck', ['--version'], { encoding: 'utf8' })).toContain('ShellCheck')
  })
})
