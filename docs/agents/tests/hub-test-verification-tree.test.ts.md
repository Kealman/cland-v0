# hub/test/verification-tree.test.ts

T-1422 uses sealed disposable native Git to distinguish tracker-only commits,
source edits, edit/revert history and rulebook changes. Endpoint equality does
not erase intervening edits. Missing or rewritten ancestry remains unknown.
No real platform, credentials, browser or hub process is used.

T-1336 extends tracker-only protection to `docs/`, `qa/briefs/` and
`hub/test/durations.json`. Retain the `flake` result and previous checkpoint shape,
with `not reproduced (intermittent)` in the human report and both run/log receipts.
Native Git tests cover each metadata path, source changes and reverted source;
the production-frame component case checks the Coordinator notice and no Bug.
