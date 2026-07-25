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

const has = (bin: string): boolean => spawnSync('sh', ['-c', `command -v ${bin}`]).status === 0

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

  it('renders an injection attempt inert', () => {
    const script = generateService(opts({ service: 'x; touch /tmp/PWNED #' }))
    expect(script).toContain(`NAME='x; touch /tmp/PWNED #'`)
    // The payload must never reach an executable position.
    expect(script).not.toMatch(/^PIDFILE=\/run\/x; touch/m)
  })
})

describe('generated logrotate config', () => {
  it('targets the service log', () => {
    expect(generateLogRotate(opts())).toContain('/var/log/my-service.log {')
  })
})

// These are the checks that would have caught the $NAME, &> and non-POSIX
// defects on first run. Skipped rather than silently passing when the binary is
// absent, so a missing tool never reads as a clean result.
describe('shell validation of the generated script', () => {
  const cases: ServiceOptions[] = [
    opts(),
    opts({ service: 'svc_2', username: 'www_data', command: '/bin/true' }),
    opts({ command: '/usr/bin/node /srv/app.js --opt="x y"' }),
    opts({ description: 'Line one\n# hijacked' })
  ]

  it.runIf(has('dash'))('parses under dash', () => {
    for (const c of cases) {
      const result = spawnSync('dash', ['-n', asFile(generateService(c))], { encoding: 'utf8' })
      expect(result.stderr, `dash -n failed for ${JSON.stringify(c)}`).toBe('')
      expect(result.status).toBe(0)
    }
  })

  it.runIf(has('shellcheck'))('passes shellcheck with no warnings or errors', () => {
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

  it.runIf(has('shellcheck'))('reports which shell validators ran', () => {
    // Visible in test output so an absent validator is never mistaken for a pass.
    expect(execFileSync('shellcheck', ['--version'], { encoding: 'utf8' })).toContain('ShellCheck')
  })
})
