# Architecture Profile

Generated: 2026-11-16

## Detected Patterns

Detected: none

Confidence: none — manual review required

No catalogued pattern reaches Medium confidence. The application is static
markup plus two source modules, with no layer, feature or module directories:

- `index.html` — all markup; no templating
- `src/service-template.ts` — pure generation logic and validation, imports
  nothing
- `src/main.ts` — UI wiring, imports `src/service-template.ts` and the
  stylesheet

## Detected Combination

None.

## Inferred Structural Rules

None inferred from a pattern.

## Ambiguities & Contradictions

`AGENTS.md` declares one boundary, which is the only structural rule `arch` can
validate against: the generation logic lives in `src/service-template.ts`,
deliberately free of the DOM so it can be unit-tested, and `src/main.ts` is only
the UI around it. Dependency direction is UI → generator, never the reverse;
validation rules are defined once there (`fieldValidity()`) and read by the UI.
At generation time the boundary holds: `src/service-template.ts` has no imports.
