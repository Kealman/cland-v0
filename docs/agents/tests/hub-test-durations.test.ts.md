# hub/test/durations.test.ts

The T-1244 historical probe regression needs native Git because linked-worktree
project discovery caused the defect. Use suiteUnit's sealed environment and
scratch root. Commit an open allowance owner, close it on live dev, and first
assert ordinary duration admission rejects the closed owner. Materialize the
pinned commit through DevT3Probes' default repository and assert its candidate
lint succeeds, while live admission still rejects. Repository cleanup stops
owned fixture writers before deletion. No hub process or real provider runs.

The preparation matrix starts from a legacy linked worktree, a clone interrupted
before checkout with a different HEAD, and a no-checkout clone whose HEAD already
matches. Each must materialize the exact test source before linting. Put an
untracked receipt into the completed checkout and assert the next idle reuse
preserves it. The T1 reopened-probe control in dev-t3-search.test.ts separately
proves an admitted worker never re-enters checkout or starts another job.
