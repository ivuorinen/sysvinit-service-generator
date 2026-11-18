// <tab-group>: a tab interface for index.html's generated outputs.
//
// Follows the WAI-ARIA Authoring Practices tabs pattern
// (https://www.w3.org/WAI/ARIA/apg/patterns/tabs/) with automatic activation:
// moving focus to a tab also selects it, which the pattern recommends when a
// panel can be shown without delay. Markup:
//
//   <tab-group>
//     <tab-list aria-labelledby="…">
//       <button id="…" type="button">…</button> …
//     </tab-list>
//     <tab-panel id="…">…</tab-panel> …
//   </tab-group>
//
// Only <tab-group> is a defined element. <tab-list> and <tab-panel> are plain
// custom-named tags, and the tabs are native buttons, which bring focus and
// click handling with them. The nth button controls the nth panel.
//
// The element reads its children when it is connected, so they must exist by
// then. They do when this module loads as a module script (deferred until the
// page is parsed, so define() upgrades the finished markup) and for markup
// inserted with innerHTML or a fragment. A classic script that defines the
// element before the parser reaches its children would not meet that.

export class TabGroup extends HTMLElement {
  private tabs: HTMLButtonElement[] = []
  private panels: HTMLElement[] = []

  constructor() {
    super()
    // Listeners go on the element itself, once: connectedCallback runs again
    // whenever the element is moved, and adding them there would stack copies.
    // Children are not read here; the parser can construct the element before
    // it has parsed them.
    this.addEventListener('click', (event) => this.onClick(event))
    this.addEventListener('keydown', (event) => this.onKeydown(event))
  }

  /**
   * Find the tabs and panels and apply the pattern's roles and links.
   *
   * Markup that cannot be wired throws before anything is changed, so the
   * group is never left half-wired. A browser does not pass an error from a
   * custom-element callback back to the code that inserted the element: it
   * reports it as an uncaught error (the console, window's `error` event), the
   * rest of the page keeps running, and this group stays unwired, all panels
   * visible. happy-dom rethrows it instead, which the tests rely on.
   */
  connectedCallback(): void {
    const list = this.querySelector(':scope > tab-list')
    const tabs = list ? Array.from(list.querySelectorAll<HTMLButtonElement>(':scope > button')) : []
    const panels = Array.from(this.querySelectorAll<HTMLElement>(':scope > tab-panel'))
    if (!list || tabs.length === 0) {
      throw new Error('<tab-group> needs a <tab-list> with at least one <button>')
    }
    if (panels.length !== tabs.length) {
      throw new Error(`<tab-group> has ${tabs.length} tabs but ${panels.length} panels`)
    }
    // The ids are authored, not generated: index.html labels each textarea by
    // its tab's id.
    if (![...tabs, ...panels].every((element) => element.id)) {
      throw new Error('<tab-group> needs an id on every tab and panel')
    }

    this.tabs = tabs
    this.panels = panels
    list.setAttribute('role', 'tablist')
    tabs.forEach((tab, index) => {
      const panel = panels[index]
      tab.setAttribute('role', 'tab')
      tab.setAttribute('aria-controls', panel.id)
      panel.setAttribute('role', 'tabpanel')
      panel.setAttribute('aria-labelledby', tab.id)
      // Each panel opens with plain text, not a focusable control, so the
      // pattern makes the panel itself the next Tab stop after the tab list.
      panel.tabIndex = 0
    })
    this.select(0)
  }

  /**
   * Show panel `index` and mark its tab selected.
   *
   * Only the selected tab is in the Tab order (a roving tabindex); the others
   * are reached with the arrow keys. Focus is left alone, so selecting on
   * connect does not pull focus to the page's tabs.
   */
  private select(index: number): void {
    this.tabs.forEach((tab, i) => {
      const isSelected = i === index
      tab.setAttribute('aria-selected', String(isSelected))
      tab.tabIndex = isSelected ? 0 : -1
      this.panels[i].hidden = !isSelected
    })
  }

  /** Select and focus `index`, as a click or key press does. */
  private activate(index: number): void {
    this.select(index)
    this.tabs[index].focus()
  }

  private onClick(event: MouseEvent): void {
    // contains(), not `target === tab`: the click can land on markup inside
    // the button's label.
    const index = this.tabs.findIndex((tab) => tab.contains(event.target as Node))
    if (index >= 0) this.activate(index)
  }

  private onKeydown(event: KeyboardEvent): void {
    // Keys pressed inside a panel (Home in a textarea) bubble up to here too;
    // only a focused tab is ours to handle. Modified keys are browser and
    // assistive-technology shortcuts, such as Alt+Left for back.
    const index = this.tabs.indexOf(event.target as HTMLButtonElement)
    if (index < 0 || event.altKey || event.ctrlKey || event.metaKey) return

    const count = this.tabs.length
    const moves: Record<string, number> = {
      ArrowLeft: (index - 1 + count) % count,
      ArrowRight: (index + 1) % count,
      Home: 0,
      End: count - 1
    }
    const next = moves[event.key]
    if (next === undefined) return
    // Home and End would otherwise also scroll the page.
    event.preventDefault()
    this.activate(next)
  }
}

// main.ts is evaluated again in tests (vi.resetModules), which re-runs this
// module; a second define() of the same name throws.
if (!customElements.get('tab-group')) customElements.define('tab-group', TabGroup)
