# hub/test/suite-duration-budget.test.ts

T1 duplicate-parser cases plant raw JSON through parseDurationManifest. Preserve the exact first/current values, last-key-wins returned object, escaped decoded keys, equal/triple duplicates, files/tests/allow map coverage and nested-map non-match. Capture console warnings only; no child process, native module or clock wait is needed. Duplicate diagnostics remain report-only independently of budget enforcement.

Exercise durationAllowanceStanzas through explicit passing, failing, skipped and legacy outcome-less samples at a fixed UTC date. Keep literals for the exact 80% threshold, worst passing sample, 1.5x headroom and year-boundary seven-day expiry. Lint the generated entries with an open container owner and assert the input manifest is unchanged.

Exercise taskDurationReport with planted T3/T4 receipts: the summary counts printed JSON stanza lines, including one object with multiple entries. Keep zero-output cases for empty, below-threshold, failed/skipped, T4-only and missing-owner samples, plus the local macOS evidence label. No child process or real-time sample is needed for these reporting rules.
