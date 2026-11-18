// @vitest-environment happy-dom
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { generateLogRotate, generateService, type ServiceOptions } from '../service-template'

/**
 * index.html's body: the tests drive the same markup the browser loads. A path,
 * not `new URL(…, import.meta.url)`: happy-dom replaces the global `URL`, and
 * `readFileSync` rejects its instances.
 */
const page = new DOMParser().parseFromString(
  readFileSync(join(import.meta.dirname, '../../index.html'), 'utf8'),
  'text/html'
)
page.querySelectorAll('script').forEach((script) => script.remove())
const markup = page.body.innerHTML

/** Must match the `value` attributes in index.html. */
const defaults: ServiceOptions = {
  service: 'my-service',
  description: 'This command does something',
  username: 'root',
  command: '/usr/local/bin/command'
}

const checked = ['service', 'username', 'command'] as const

/**
 * Load the markup and a fresh copy of the UI module, as a page load does.
 * `resetModules` re-runs main.ts's top level, so no test sees another's state.
 *
 * The markup goes in through a template, parsed whole and then connected, as a
 * browser does. happy-dom's `innerHTML` connects each element before parsing
 * its children, and from the second test on `<tab-group>` is already defined,
 * so it would wire itself up with no tabs.
 */
const load = async (html = markup): Promise<void> => {
  const template = document.createElement('template')
  template.innerHTML = html
  document.body.replaceChildren(template.content)
  vi.resetModules()
  await import('../main')
}

/** The element with `id`; fails the test when the markup lacks it. */
const get = <T extends HTMLElement>(id: string, type: new () => T): T => {
  const element = document.getElementById(id)
  expect(element, `#${id}`).toBeInstanceOf(type)
  return element as T
}

/** Edit an input the way a user does: set the value, then fire `input`. */
const type = (id: string, value: string): void => {
  const input = get(id, HTMLInputElement)
  input.value = value
  input.dispatchEvent(new Event('input'))
}

/**
 * Collect errors thrown by event listeners. happy-dom reports them as window
 * `error` events instead of rethrowing from `dispatchEvent`, so without this a
 * listener that throws mid-update would leave every assertion before the throw
 * passing.
 */
const listenerErrors = (): unknown[] => {
  const errors: unknown[] = []
  window.addEventListener('error', (event) => errors.push(event.error))
  return errors
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('UI', () => {
  it('renders every output for the default inputs', async () => {
    await load()
    expect(get('output', HTMLElement).hidden).toBe(false)
    expect(get('summary', HTMLElement).textContent).toBe('')
    expect(get('service-path', HTMLElement).textContent).toBe('/etc/init.d/my-service')
    expect(get('logrotate-path', HTMLElement).textContent).toBe('/etc/logrotate.d/my-service')
    expect(get('service-script', HTMLTextAreaElement).value).toBe(generateService(defaults))
    expect(get('logrotate', HTMLTextAreaElement).value).toBe(generateLogRotate(defaults))
    expect(get('shell-commands', HTMLTextAreaElement).value).toBe(
      'sudo chmod +x /etc/init.d/my-service && sudo update-rc.d my-service defaults'
    )
    for (const id of checked) {
      expect(get(id, HTMLInputElement).getAttribute('aria-invalid')).toBe('false')
      expect(get(`${id}-error`, HTMLElement).hidden).toBe(true)
    }
  })

  it('regenerates every output as the user types', async () => {
    await load()
    const options: ServiceOptions = {
      service: 'web',
      description: 'Web front end',
      username: 'www-data',
      command: '/usr/bin/node /srv/app.js'
    }
    type('service', options.service)
    type('description', options.description)
    type('username', options.username)
    type('command', options.command)
    expect(get('service-script', HTMLTextAreaElement).value).toBe(generateService(options))
    expect(get('logrotate', HTMLTextAreaElement).value).toBe(generateLogRotate(options))
    expect(get('service-path', HTMLElement).textContent).toBe('/etc/init.d/web')
    expect(get('logrotate-path', HTMLElement).textContent).toBe('/etc/logrotate.d/web')
    expect(get('shell-commands', HTMLTextAreaElement).value).toBe(
      'sudo chmod +x /etc/init.d/web && sudo update-rc.d web defaults'
    )
  })

  it('groups the outputs in tabs, the service script first', async () => {
    await load()
    const tabs = Array.from(document.querySelectorAll('tab-group > tab-list > button'))
    expect(tabs.map((tab) => tab.textContent.trim())).toEqual([
      'Service script',
      'Logrotate config',
      'Shell commands'
    ])
    const labelId = document.querySelector('tab-list')?.getAttribute('aria-labelledby') ?? ''
    expect(document.getElementById(labelId)?.textContent).toBe('Generated files')
    expect(get('tab-service', HTMLButtonElement).getAttribute('aria-selected')).toBe('true')
    expect(
      ['panel-service', 'panel-logrotate', 'panel-shell'].map((id) => get(id, HTMLElement).hidden)
    ).toEqual([false, true, true])
    // Each textarea is named by its tab, so a screen reader announces which
    // file it holds.
    for (const id of ['service-script', 'logrotate', 'shell-commands']) {
      const labelledBy = get(id, HTMLTextAreaElement).getAttribute('aria-labelledby') ?? ''
      expect(document.getElementById(labelledBy)?.getAttribute('role'), id).toBe('tab')
    }
    expect(get('panel-shell', HTMLElement).textContent).toContain(
      'Run after saving the service script:'
    )
  })

  it('keeps the selected tab while a field is invalid', async () => {
    await load()
    get('tab-logrotate', HTMLButtonElement).click()
    type('service', 'my app')
    type('service', 'my-service')
    expect(get('tab-logrotate', HTMLButtonElement).getAttribute('aria-selected')).toBe('true')
    expect(get('panel-logrotate', HTMLElement).hidden).toBe(false)
    expect(get('output', HTMLElement).hidden).toBe(false)
  })

  it.each([
    ['service', 'my app'],
    ['username', '-x'],
    ['command', '   ']
  ] as const)('flags an invalid %s and hides the outputs until it is fixed', async (id, bad) => {
    await load()
    const errors = listenerErrors()

    type(id, bad)
    expect(get(id, HTMLInputElement).getAttribute('aria-invalid')).toBe('true')
    expect(get(`${id}-error`, HTMLElement).hidden).toBe(false)
    for (const other of checked.filter((name) => name !== id)) {
      expect(get(`${other}-error`, HTMLElement).hidden).toBe(true)
    }
    expect(get('output', HTMLElement).hidden).toBe(true)
    expect(get('summary', HTMLElement).textContent).toBe(
      'Fix the highlighted fields to generate a service script.'
    )
    expect(errors).toEqual([])

    type(id, defaults[id])
    expect(get(id, HTMLInputElement).getAttribute('aria-invalid')).toBe('false')
    expect(get(`${id}-error`, HTMLElement).hidden).toBe(true)
    expect(get('output', HTMLElement).hidden).toBe(false)
    expect(get('summary', HTMLElement).textContent).toBe('')
  })

  it.each([
    ['copy-service', 'service-script'],
    ['copy-logrotate', 'logrotate'],
    ['copy-shell', 'shell-commands']
  ])('%s writes #%s to the clipboard', async (button, source) => {
    const writeText = vi.fn(() => Promise.resolve())
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    await load()
    get(button, HTMLButtonElement).click()
    await vi.waitFor(() => expect(writeText).toHaveBeenCalledOnce())
    expect(writeText).toHaveBeenCalledWith(get(source, HTMLTextAreaElement).value)
  })

  it.each([
    ['rejects the write', { clipboard: { writeText: () => Promise.reject(new Error('denied')) } }],
    ['is unavailable', {}]
  ])('selects the text for a manual copy when the clipboard %s', async (_, stub) => {
    vi.stubGlobal('navigator', stub)
    await load()
    const source = get('service-script', HTMLTextAreaElement)
    get('copy-service', HTMLButtonElement).click()
    await vi.waitFor(() => expect(document.activeElement).toBe(source))
    expect(source.selectionStart).toBe(0)
    expect(source.selectionEnd).toBe(source.value.length)
  })

  it('fails at load, naming the element, when the markup lacks one', async () => {
    await expect(load(markup.replace('id="command"', 'id="cmd"'))).rejects.toThrow(
      'index.html has no <HTMLInputElement> with id "command"'
    )
  })
})
