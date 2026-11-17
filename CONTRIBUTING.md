# Contributing

Thank you for helping with the sysvinit service generator. It is a small
TypeScript web app, built with Vite, that generates a sysvinit init script and a
logrotate config. Users run the generated script as root, so changes to it are
held to the checks below.

## Development setup

The Node.js version is pinned in `.nvmrc`.

```bash
npm ci        # install from the committed package-lock.json
prek install  # install the pre-commit hooks (pre-commit works too)
npm run dev   # start the dev server
```

## Code style

ESLint (type-aware TypeScript rules), Stylelint and Prettier are configured in
the repository. Run every check the pull-request gate runs with:

```bash
npm run check
```

`npm run lint:fix`, `npm run lint:css:fix` and `npm run format` apply the
autofixes.

## Testing

```bash
npm test
```

Vitest fails the run below 100% line, branch, function and statement coverage of
`src/`. Cover new code with tests; do not exclude it.

The suite also validates the generated script with `shellcheck -s sh -S warning`
and `dash -n`. Both are mandatory in CI. Locally, a missing binary skips that
check with a `[skipped] … validation is INCOMPLETE` warning, so install both
before changing `src/service-template.ts`.

## Commit messages

Use semantic commit messages (`feat:`, `fix:`, `docs:`, …) and the same format
for pull-request titles.

## Pull requests

Pull requests to `main` run the `Build` workflow (lint, Stylelint, Prettier,
type check, tests with coverage, build), MegaLinter and dependency review. The
code owners in `.github/CODEOWNERS` review every change.

## License

Contributions are made under the project's [MIT License](LICENSE).
