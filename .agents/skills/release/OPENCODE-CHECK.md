# Informational OpenCode check before a cland release

Run `npm run check:opencode` from the cland source checkout before the release dry run. Other projects retain their own release checks.

This opt-in network probe compares the newest stable OpenCode 2.x OpenAPI wire operations and event names with the version the adapter was built against. It prints compatible operations or differences and writes nothing to the repository. The adapter's behavioural checks remain in place.

Include differences as a note in the release report and continue to the dry run. Compatibility differences exit 0; only a network or probe failure exits nonzero. If the probe cannot complete, record that failure in the report. The check is informational and does not stop the release.
