import stylelint from 'stylelint'

import base from '@ivuorinen/stylelint-config'

// Base config is @ivuorinen/stylelint-config. Two workarounds are needed for
// upstream bugs in that package at 1.3.5; both become no-ops once it is fixed.
//
//  1. We import the package root rather than extending the `/css` subpath its
//     postinstall writes into .stylelintrc.json. In 1.3.5,
//     `exports["./css"]` mistakenly maps to ./scss/index.*, and
//     scss/index.cjs extends '../css', which stylelint resolves as a module
//     name and cannot find — so the generated config fails outright.
//  2. The package declares `stylelint: ^17.6.0` but still lists 17 stylistic
//     rules that stylelint removed in v16, so every run reports them as
//     "Unknown rule" and exits 2. Setting them to null does not help: stylelint
//     normalises null to [], which still counts as configured. They have to be
//     removed from the rule set, which is what the filter below does.
//
// The filter is derived from stylelint's own rule registry instead of a
// hardcoded list, so it drops nothing once upstream drops them itself. Plugin
// rules (namespaced with "/") are not in that registry and are kept as-is.
const known = new Set(Object.keys(stylelint.rules))
const isLive = (name) => name.includes('/') || known.has(name)

const { rules, ...rest } = base

export default {
  ...rest,
  rules: Object.fromEntries(Object.entries(rules).filter(([name]) => isLive(name)))
}
