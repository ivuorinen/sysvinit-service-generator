# Project Overview

This repo hosts a small Vue 3 + TypeScript web app built with Vite. The source lives in `src/` and is served via `index.html`. Static assets are under `public/`. Config files include `vite.config.ts` for build settings, `tsconfig.*.json` for TypeScript, and `eslint.config.mjs` for lint rules.

# Guidelines

- Use **semantic commit messages** (e.g. `feat:`, `fix:`, `docs:`) and the same format for PR titles.
- Use **Yarn** for installing packages.
- Run linting and type checks before committing any code changes.
- Skip linting and type checks when editing only documentation or comments.
- Follow the style rules defined by Prettier and ESLint. Prettier settings: no semicolons, single quotes, width 100, two spaces.
- Node.js version is controlled via `.nvmrc` (22.17.0).

# Linting & Formatting

Install dependencies and run tools with Yarn:

```bash
yarn install  # once

yarn lint        # runs ESLint with autofix
yarn type-lint   # checks TypeScript using ts-standard
yarn type-fix    # fixes TypeScript style issues

yarn format      # formats using Prettier
```

No automated tests are defined.
