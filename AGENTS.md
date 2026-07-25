# sysvinit service generator — agent guide

## Project overview

This repo hosts a small Vue 3 + TypeScript web app built with Vite. The source lives in `src/` and is served via `index.html`. Static assets are under `public/`. Config files include `vite.config.ts` for build settings, `tsconfig.*.json` for TypeScript, `eslint.config.mjs` for lint rules and `stylelint.config.mjs` for CSS.

The app generates a sysvinit service script that users run as root. The generation logic lives in `src/service-template.ts`, deliberately free of Vue so it can be unit-tested; `src/App.vue` is only the UI around it.

## Guidelines

- Use **semantic commit messages** (e.g. `feat:`, `fix:`, `docs:`) and the same format for PR titles.
- Use **npm** for installing packages. `package-lock.json` is the committed lockfile and every CI job installs from it with `npm ci`.
- Run linting, type checks and tests before committing any code changes.
- Skip linting and type checks when editing only documentation or comments.
- Follow the style rules defined by Prettier and ESLint. Prettier settings: no semicolons, single quotes, width 100, two spaces. `@vue/eslint-config-prettier` is wired into `eslint.config.mjs`, so ESLint reports formatting violations.
- Node.js version is controlled via `.nvmrc`.
- Indentation is two spaces everywhere, and every line's leading indent must be a multiple of two — `editorconfig-checker` runs in CI and rejects odd indents such as a three-space list continuation in Markdown.

## Changing the generated script

`src/service-template.ts` emits a program that runs as root. Three rules:

- Interpolate user input through `shq()` (POSIX single-quoting), never raw.
- Validation belongs at the generator boundary, not in the UI. `generateService()` and `generateLogRotate()` call `assertValidOptions()` and throw on a service name or username outside `SAFE_NAME`, because the bare `<NAME>` form also reaches contexts that cannot be quoted at all (the LSB header comment, the logrotate stanza path). `fill()` is intentionally not exported so the check cannot be bypassed.
- Every generated variant must pass `shellcheck -s sh -S warning` and `dash -n`. Both are mandatory in CI; locally a missing binary skips the check and warns that validation is incomplete. Add a case to `src/__tests__/service-template.spec.ts` when you add an input.

## Linting, formatting and tests

```bash
npm ci             # once
prek install       # once, installs the pre-commit hooks

npm run lint       # ESLint, report only
npm run lint:fix   # ESLint with autofix
npm run lint:css   # Stylelint, report only
npm run lint:css:fix # Stylelint with autofix
npm run type-check # type-checks with vue-tsc
npm test           # Vitest, incl. shellcheck/dash validation of the output

npm run format     # formats using Prettier
npm run check      # everything the PR gate runs
```

Pre-commit hooks are managed with [prek](https://github.com/j178/prek), a drop-in
pre-commit runner (`pre-commit` works too). `.pre-commit-config.yaml` runs
Prettier, ESLint, Stylelint, actionlint, zizmor and the shell-validation tests,
so the lint failures this repo has hit before cannot reach a commit again.

Two config traps, both of which have bitten this repo:

- Do not add a `parserOptions.project` block to `eslint.config.mjs`. It conflicts with the `projectService` that `@vue/eslint-config-typescript` enables and turns every file into a fatal parse error — ESLint then reports errors while linting nothing.
- Every tsconfig must set `noEmit`. A referenced project without it makes `npm run type-check` emit compiled `.js` next to the sources.
