# sysvinit service generator — agent guide

## Project overview

This repo hosts a small TypeScript web app built with Vite, with no runtime
dependencies. `index.html` holds the markup, `src/main.ts` wires it to the
generator, and `src/tab-group.ts` defines the `<tab-group>` custom element that
shows the three outputs as tabs. Static assets are under `public/`. Config files
are `vite.config.ts` (build and Vitest), `tsconfig.json`, `eslint.config.mjs`
and `.stylelintrc.json`.

The app generates a sysvinit service script that users run as root. The
generation logic lives in `src/service-template.ts`, deliberately free of the
DOM so it can be unit-tested; `src/main.ts` is only the UI around it.

## Guidelines

- Use **semantic commit messages** (e.g. `feat:`, `fix:`, `docs:`) and the same
  format for PR titles.
- Use **npm** for installing packages. `package-lock.json` is the committed
  lockfile and every CI job installs from it with `npm ci`.
- Run `npm run check` before committing any code change; it runs lint, type
  check, formatting check and tests. Setup and the individual commands are in
  `CONTRIBUTING.md`.
- Skip linting and type checks when editing only documentation or comments.
- Follow the style rules defined by Prettier and ESLint. Prettier settings: no
  semicolons, single quotes, width 100, two spaces. Prettier is not wired into
  ESLint; `npm run format:check` enforces it.
- Markdown prose is hard-wrapped at 80 by Prettier (`proseWrap: always` plus a
  `printWidth` override for `*.md`), which is what keeps markdownlint's MD013
  satisfied at its default. Do not hand-wrap; run `npm run format`.
- Node.js version is controlled via `.nvmrc`.
- Indentation is two spaces everywhere, and every line's leading indent must be
  a multiple of two — `editorconfig-checker` runs in CI and rejects odd indents
  such as a three-space list continuation in Markdown.

## Changing the generated script

`src/service-template.ts` emits a program that runs as root. Three rules:

- Interpolate user input through `shq()` (POSIX single-quoting), never raw.
- Validation belongs at the generator boundary, not in the UI.
  `generateService()` and `generateLogRotate()` throw on a service name or
  username outside `SAFE_NAME`, because the bare `<NAME>` form also reaches
  contexts that cannot be quoted at all (the LSB header comment, the logrotate
  stanza path). `fieldValidity()` is the only definition of the rules: the UI
  reads it, so never re-implement a rule in `src/main.ts` or as an HTML
  `pattern`. `fill()` is intentionally not exported so the check cannot be
  bypassed.
- Every generated variant must pass `shellcheck -s sh -S warning` and `dash -n`.
  Both are mandatory in CI; locally a missing binary skips the check and warns
  that validation is incomplete. Add a case to
  `src/__tests__/service-template.spec.ts` when you add an input.

## Tests and coverage

`npm test` runs Vitest with coverage and fails below 100% lines, branches,
functions and statements over `src/**/*.ts` (`thresholds` in `vite.config.ts`).
Add tests for new code; do not add coverage exclusions. The UI test
(`src/__tests__/main.spec.ts`) runs under happy-dom and loads the real
`index.html`, so markup and code cannot drift apart unnoticed.

Insert test markup through a `<template>` (`template.innerHTML = html`, then
`replaceChildren(template.content)`), never with `innerHTML` on a connected
element. happy-dom's `innerHTML` connects each element before parsing its
children, which no browser does, so a custom element such as `<tab-group>` finds
no children and throws. Both UI specs already do this.

Pre-commit hooks are managed with [prek](https://github.com/j178/prek), a
drop-in pre-commit runner (`pre-commit` works too). `.pre-commit-config.yaml`
runs Prettier, ESLint, Stylelint, actionlint, zizmor and the tests with
coverage, so the lint failures this repo has hit before cannot reach a commit
again.

Config traps, all of which have bitten this repo:

- Do not add a `parserOptions.project` block to `eslint.config.mjs`. It
  conflicts with the `projectService` the config enables and turns every file
  into a fatal parse error — ESLint then reports errors while linting nothing.
- `tsconfig.json` must keep `noEmit`. `npm run type-check` is plain `tsc`, so
  without it every `.ts` file is compiled to a `.js` next to its source.
- Do not reintroduce `baseUrl`. It is deprecated in TypeScript 6 and stops
  working in 7; `type-check` fails with TS5101 while it is present.
- Keep the tsconfig file comment-free. TypeScript accepts JSONC, but the
  `check-json` pre-commit hook and MegaLinter's `jsonlint` parse strict JSON and
  will reject `//` comments. Record the reasoning here instead.
- `tsconfig.json` turns on every TypeScript 6 strictness option beyond `strict`,
  which TS 6 enables by default along with `noUncheckedSideEffectImports`. Two
  stay short of their strictest. `skipLibCheck` is `true` because happy-dom 21's
  declarations import `UnderlyingDefaultSource` from `node:stream/web`, which
  `@types/node` exports only from version 25, and this project runs Node 24; try
  `false` again after either upgrades. `isolatedDeclarations` is off because it
  requires declaration output (TS5069), which this app does not produce.
