# Informational OpenCode check before a cland release

Run `npm run check:opencode` from the cland source checkout before the release dry run. Other projects retain their own release checks.

This opt-in network probe compares the newest stable OpenCode 2.x OpenAPI wire operations and event names with the version the adapter was built against. It prints compatible operations or differences and writes nothing to the repository. The adapter's behavioural checks remain in place.

Include differences as a note in the release report and continue to the dry run. Compatibility differences exit 0; only a network or probe failure exits nonzero. If the probe cannot complete, record that failure in the report. The check is informational and does not stop the release.

For the exact 2.0.24 -> 2.2.5 comparison, the check appends the T-1501 schema
review reasons while preserving all twelve warnings. Include both in the report.
These are recorded schema-reader checks; native runtime coverage remains at
2.0.24. Do not extend this assessment to another tag. See the per-test guides for
`hub/test/opencode-check.test.ts` and `opencode-client-membership.test.ts`.
