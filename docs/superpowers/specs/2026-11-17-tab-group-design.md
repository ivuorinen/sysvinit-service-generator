# Tab group for the generated outputs — design

Date: 2026-11-17. Size: small change.

## Intent

The page does not clearly show that it produces two files (the service script
and the logrotate config) plus the commands to run after saving them: the script
is always visible and the other two sit in collapsed `<details>` below it. Put
all three in one tab group so each is an equal, visible choice.

Written from scratch as a custom element, in the spirit of
[magic-spells/tab-group](https://magic-spells.github.io/tab-group/demo/) but not
derived from its code; only its README was read. The custom element is also
meant as a readable example of how one is built.

## Goals

- One `<tab-group>` holding three tabs: **Service script**, **Logrotate
  config**, **Shell commands**. Service script is selected on load.
- Each panel keeps what its section has today: the "Save as" path (both files),
  the read-only textarea, and its copy button. The shell panel gets a one-line
  note, "Run after saving the service script:". (The approved draft said "both
  files", but the commands only touch the service script and the README calls
  the logrotate config optional.)
- Full WAI-ARIA tabs pattern and WCAG 2.2 AA, listed below.

## Accessibility

- Roles set by the element: `tablist` on `<tab-list>`, `tab` on each button,
  `tabpanel` on each `<tab-panel>`.
- `aria-selected` on every tab; `aria-controls` from tab to panel;
  `aria-labelledby` from panel to tab. Unselected panels carry `hidden`, which
  also removes them from the accessibility tree.
- The tab list is named by a visible `<h2>Generated files</h2>` through
  `aria-labelledby`, which also gives the page a heading to navigate to.
- Keyboard: only the selected tab is in the Tab order (roving `tabindex`).
  Left/Right move to the previous/next tab and select it, wrapping at the ends;
  Home/End go to the first/last. Selection follows focus (automatic activation),
  as the pattern recommends when panels show instantly.
- Each panel gets `tabindex="0"`: it starts with non-focusable text (the "Save
  as" line), so the pattern makes the panel itself reachable.
- Visible `:focus-visible` outline on tabs and panels, at least 3:1 against the
  background.
- The selected tab is shown by more than colour: a thick underline plus the
  accent text colour.
- Tabs are at least 24×24 CSS px.
- Textareas stay named: each is labelled by its tab and described by its "Save
  as" line, as today.
- No animation, so there is nothing for `prefers-reduced-motion` to switch off.
  Colours come from the existing tokens, so both colour schemes work.

## Non-goals

Tabs added or removed at runtime, enter/exit animations, a change event, an
`active` attribute or property API, disabled tabs, vertical orientation,
remembering the tab across reloads, `#hash` deep links.

Copying an output gives no confirmation, visible or announced. That gap predates
this change and stays out of it.

## Anti-goals

- Tabs a keyboard or screen-reader user cannot operate.
- Breaking today's behaviour of hiding every output while a field is invalid.
- Coverage below 100%, or a coverage exclusion.

## Approaches

- **Buttons marked up as tabs in `index.html`, ~35 lines in `src/tabs.ts`.**
  Least code; the ARIA wiring is written out per tab in the HTML.
- **A small custom element — chosen.** One class, `TabGroup`, registered as
  `<tab-group>`, finds its tabs and panels and applies the roles, states and
  keyboard handling itself, so the markup stays short. More code than the first;
  picked because seeing how a custom element is built is part of the point.
- **CSS-only radio buttons.** Rejected: assistive technology announces radio
  buttons, not tabs, and the page needs JavaScript anyway.

## Decided

- Only `<tab-group>` is defined as a custom element. `<tab-list>` and
  `<tab-panel>` are plain custom-named tags for readable markup and styling; the
  tabs are native `<button type="button">` elements, which bring focus and click
  handling for free.
- Tab and panel ids are written in `index.html`, because each textarea's label
  refers to its tab's id. The element pairs the nth button with the nth panel.
- The class lives in `src/tab-group.ts` and is imported by `src/main.ts`.

## Left to the builder

- Mismatched tab and panel counts, or a missing id: fail at load with an error
  naming the problem, the way `byId` in `src/main.ts` does, rather than
  rendering a half-wired group.
- `main.spec.ts` re-imports `main.ts` for every test (`vi.resetModules`), and
  `customElements.define` throws on a second definition of the same name, so
  registration must tolerate being run more than once in one window.
- Tests for every key and click path, in their own spec or in `main.spec.ts`.
