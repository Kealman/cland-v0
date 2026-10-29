# hub/test/dev-t3-search.test.ts

T-1232 injects a failing search report followed by a throwing blocked notice at
the T1 durable controller seam. Assert the tick resolves, the original error
remains in the store and the secondary failure is logged. Release the report
fault, advance FakeClock and join the tick; assert the persisted reported receipt.
The shared suiteUnit fixture seals its environment and owns teardown.

T-1244 injects current dev through SearchBoundary and retains the old persisted
checkpoint shape as a restart control: no tip field must trigger a probe before
an old culprit can file. Complete green tips with non-tracker history evidence skip historical probes; a tip moving from
green back to red resumes diagnosis and retains its red receipt. Existing
original-head calls remain the rerun when dev has not moved.

T-1422 keeps the previous report and checkpoint shapes. Inject non-tracker history
evidence beside the existing currentDev boundary. Tracker-only tips report an
`not reproduced (intermittent)` naming red and green run ids; missing/null history stays
inconclusive. Old already-fixed checkpoints must recheck history before reporting,
while the no-tip legacy checkpoint still requires its native probe.

T-1336 extends tracker-only protection to `docs/`, `qa/briefs/` and
`hub/test/durations.json`. Retain the `flake` result and previous checkpoint shape,
with `not reproduced (intermittent)` in the human report and both run/log receipts.
Native Git tests cover each metadata path, source changes and reverted source;
the production-frame component case checks the Coordinator notice and no Bug.
