# hub/test/verification-tree.test.ts

The startup preparation case uses disposable native Git and fresh Node processes
at fake versions 0.4.0 and 0.4.1. It checks that this repository has committed its
managed ignore migration, upgrades a legacy versioned header once, commits that
baseline, then proves the next version leaves the covered candidate clean.
The child reports its management version as a positive control for the override.
An actual ignore-policy edit must dirty the candidate and change the committed
identity. No hub process or live database is needed. Run this native file under
the project's exclusive test slot; the fixture environment isolates HOME, XDG,
Git configuration and credentials. Lead T-1877 owns this case.

T-1422 uses sealed disposable native Git to distinguish tracker-only commits,
source edits, edit/revert history and rulebook changes. Endpoint equality does
not erase intervening edits. Missing or rewritten ancestry remains unknown.
No real platform, credentials, browser or hub process is used.

T-1336 extends tracker-only protection to `docs/`, `qa/briefs/` and
`hub/test/durations.json`. Retain the `flake` result and previous checkpoint shape,
with `not reproduced (intermittent)` in the human report and both run/log receipts.
Native Git tests cover each metadata path, source changes and reverted source;
the production-frame component case checks the Coordinator notice and no Bug.
