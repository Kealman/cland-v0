# hub/test/opencode-check.test.ts

T1, recorded documents and fake downloads; no native processes or network.
Run `node --test hub/test/opencode-check.test.ts`.

T-1501's red-first release-report case reproduces all twelve conservative
warnings against the pinned upstream documents and requires the reasons in the
informational output. It retains exit 0 for differences, exit 1 for probe errors,
and unchanged repository contents. The explanation is scoped to the exact
2.0.24 -> 2.2.5 pair; it neither suppresses warnings nor approves future versions.
Native runtime remains tested at 2.0.24. Reader examples are covered by
[opencode-client-membership](hub-test-opencode-client-membership.test.ts.md).

`hub/test/fixtures/opencode-{2.0.24,2.2.5}-contract.json` are exact projections of
these upstream documents, retrieved 2026-10-31:

- https://raw.githubusercontent.com/anomalyco/opencode/v2.0.24/packages/protocol/openapi.json
- https://raw.githubusercontent.com/anomalyco/opencode/v2.2.5/packages/protocol/openapi.json

To regenerate, retain only the ten `OPERATIONS` method/path entries and their
transitive `#/components/schemas/` references. Preserve schema contents including
documentation; do not normalize unions or strip fields. The fixtures intentionally
retain the old schema and the comparator's conservative warnings. Event source
checks in this test are synthetic; live `npm run check:opencode` downloads both
versions' three event files as well as their OpenAPI documents.
