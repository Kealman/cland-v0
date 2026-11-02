# hub/test/project-probes.test.ts

Bare-root merge admission uses the hub's injected read-only Git probe in component
fixtures; the production boundary runs native Git. `project-probes.test.ts` proves
the injected bare fact still refuses while imports, merge preflight and cleanup
retain the zero-child census.

Run through `node hub/test/run-suite.ts hub hub/test/project-probes.test.ts`
with `CLAND_SUITE_WORKERS=4` in a sealed fixture environment. The runner captures
the native lock identity once before workers start and supplies the test-only
`CLAND_TEST_LOCK_IDENTITY`; harness imports and fixture operations still count
in the zero-child census. Direct harness callers without this runner value
capture the live identity on first use.
