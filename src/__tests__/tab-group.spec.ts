// @vitest-environment happy-dom
import { describe, expect, expectTypeOf, it, vi } from 'vitest'

import { TabGroup } from '../tab-group'

/** Three tabs; the second's label is wrapped, as an icon or emphasis would be. */
const fixture = `
  <tab-group>
    <tab-list>
      <button id="t1" type="button">One</button>
      <button id="t2" type="button"><span>Two</span></button>
      <button id="t3" type="button">Three</button>
    </tab-list>
    <tab-panel id="p1"><p>First</p><textarea></textarea></tab-panel>
    <tab-panel id="p2">Second</tab-panel>
    <tab-panel id="p3">Third</tab-panel>
  </tab-group>`

/**
 * Insert markup the way a browser's `innerHTML` does: parsed whole, then
 * connected, so `<tab-group>` has its children when it wires itself up.
 * happy-dom's own `innerHTML` connects each element before parsing its
 * children, which no browser does.
 */
const mount = (html = fixture): void => {
  const template = document.createElement('template')
  template.innerHTML = html
  document.body.replaceChildren(template.content)
}

const tabs = (): HTMLButtonElement[] =>
  Array.from(document.querySelectorAll<HTMLButtonElement>('tab-list > button'))
/** The tab at `index`; fails the test when there is none. */
const tab = (index: number): HTMLButtonElement => {
  const element = tabs()[index]
  if (!element) throw new Error(`no tab at index ${index}`)
  return element
}
const panels = (): HTMLElement[] => Array.from(document.querySelectorAll<HTMLElement>('tab-panel'))
const selected = (): number =>
  tabs().findIndex((tab) => tab.getAttribute('aria-selected') === 'true')

/** Press a key on `target` the way a browser delivers it, and return the event. */
const key = (target: Element, name: string, init: KeyboardEventInit = {}): KeyboardEvent => {
  const event = new KeyboardEvent('keydown', {
    key: name,
    bubbles: true,
    cancelable: true,
    ...init
  })
  target.dispatchEvent(event)
  return event
}

describe('<tab-group>', () => {
  it('wires roles and links each tab to its panel', () => {
    mount()
    expect(document.querySelector('tab-list')?.getAttribute('role')).toBe('tablist')
    expect(
      tabs().map((tab) => [tab.getAttribute('role'), tab.getAttribute('aria-controls')])
    ).toEqual([
      ['tab', 'p1'],
      ['tab', 'p2'],
      ['tab', 'p3']
    ])
    expect(
      panels().map((panel) => [
        panel.getAttribute('role'),
        panel.getAttribute('aria-labelledby'),
        panel.getAttribute('tabindex')
      ])
    ).toEqual([
      ['tabpanel', 't1', '0'],
      ['tabpanel', 't2', '0'],
      ['tabpanel', 't3', '0']
    ])
  })

  it('upgrades <tab-group> to TabGroup, and a tag-name query is typed so', () => {
    mount()
    const group = document.querySelector('tab-group')
    expect(group).toBeInstanceOf(TabGroup)
    // Checked by tsc (npm run type-check), not at run time: the
    // HTMLElementTagNameMap entry in tab-group.ts gives the query this type.
    expectTypeOf(group).toEqualTypeOf<TabGroup | null>()
  })

  it('selects the first tab on connect without moving focus', () => {
    mount()
    expect(tabs().map((tab) => tab.getAttribute('aria-selected'))).toEqual([
      'true',
      'false',
      'false'
    ])
    expect(tabs().map((tab) => tab.getAttribute('tabindex'))).toEqual(['0', '-1', '-1'])
    expect(panels().map((panel) => panel.hidden)).toEqual([false, true, true])
    expect(document.activeElement).toBe(document.body)
  })

  it('selects and focuses a clicked tab, including a click on its content', () => {
    mount()
    tab(1).querySelector('span')?.click()
    expect(selected()).toBe(1)
    expect(document.activeElement).toBe(tab(1))
    expect(panels().map((panel) => panel.hidden)).toEqual([true, false, true])

    tab(2).click()
    expect(selected()).toBe(2)
  })

  it.each([
    ['ArrowRight', 0, 1],
    ['ArrowRight', 2, 0],
    ['ArrowLeft', 0, 2],
    ['ArrowLeft', 1, 0],
    ['Home', 2, 0],
    ['End', 0, 2]
  ])('%s from tab %i selects tab %i', (name, start, expected) => {
    mount()
    tab(start).click()
    const event = key(tab(start), name)
    expect(selected()).toBe(expected)
    expect(document.activeElement).toBe(tab(expected))
    // Unprevented, Home and End would also scroll the page.
    expect(event.defaultPrevented).toBe(true)
  })

  it.each([
    ['Tab, which moves focus into the panel', 'Tab', {}, () => tab(0)],
    ['Alt+ArrowLeft, the browser back shortcut', 'ArrowLeft', { altKey: true }, () => tab(0)],
    ['Ctrl+Home', 'Home', { ctrlKey: true }, () => tab(0)],
    ['Meta+End', 'End', { metaKey: true }, () => tab(0)],
    [
      'an arrow key in a panel textarea',
      'ArrowRight',
      {},
      () => document.querySelector('textarea') as Element
    ]
  ])('leaves %s alone', (_, name, init, target) => {
    mount()
    const event = key(target(), name, init)
    expect(selected()).toBe(0)
    expect(event.defaultPrevented).toBe(false)
  })

  it('ignores a click outside the tabs', () => {
    mount()
    document.querySelector<HTMLElement>('tab-panel p')?.click()
    document.querySelector<HTMLElement>('tab-list')?.click()
    expect(selected()).toBe(0)
  })

  // happy-dom rethrows a connectedCallback error at the inserting call. A
  // browser reports it as an uncaught error instead and leaves the group unwired.
  it.each([
    [
      'no tab list',
      '<tab-group><tab-panel id="p"></tab-panel></tab-group>',
      '<tab-group> needs a <tab-list> with at least one <button>'
    ],
    [
      'an empty tab list',
      '<tab-group><tab-list></tab-list></tab-group>',
      '<tab-group> needs a <tab-list> with at least one <button>'
    ],
    [
      'fewer panels than tabs',
      fixture.replace('<tab-panel id="p3">Third</tab-panel>', ''),
      '<tab-group> has 3 tabs but 2 panels'
    ],
    [
      'more panels than tabs',
      fixture.replace('</tab-group>', '<tab-panel id="p4">Fourth</tab-panel></tab-group>'),
      '<tab-group> has 3 tabs but 4 panels'
    ],
    [
      'a tab without an id',
      fixture.replace(' id="t2"', ''),
      '<tab-group> needs an id on every tab and panel'
    ],
    [
      'a panel without an id',
      fixture.replace(' id="p2"', ''),
      '<tab-group> needs an id on every tab and panel'
    ]
  ])('rejects markup with %s', (_, html, message) => {
    expect(() => mount(html)).toThrow(message)
  })

  it('registers once when the module is evaluated again', async () => {
    // main.spec.ts re-imports main.ts, and so this module, for every test; a
    // second define() of the same name throws.
    vi.resetModules()
    await expect(import('../tab-group')).resolves.toBeDefined()
    expect(customElements.get('tab-group')).toBeDefined()
  })
})
