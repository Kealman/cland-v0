# hub/test/durations.test.ts

Historical probe fixtures provide an empty root node_modules directory before
native clone checkout. Their synthetic manifests declare no dependencies;
production probe preparation links that directory without invoking npm. This
keeps the historical duration-owner assertion independent of dependency setup.

The T-1244 historical probe regression needs native Git because linked-worktree
project discovery caused the defect. Use suiteUnit's sealed environment and
scratch root. Commit an open allowance owner, close it on live dev, and first
assert ordinary duration admission rejects the closed owner. Materialize the
pinned commit through DevT3Probes' default repository and assert its candidate
lint succeeds, while live admission still rejects. Repository cleanup stops
owned fixture writers before deletion. No hub process or real provider runs.

The preparation matrix starts from an owned legacy linked worktree, a clone interrupted
before checkout with a different HEAD, and a no-checkout clone whose HEAD already
matches. Each must materialize the exact test source before linting. Put an
untracked receipt into the completed checkout and assert the next idle reuse
preserves it. The T1 reopened-probe control in dev-t3-search.test.ts separately
proves an admitted worker never re-enters checkout or starts another job.

Create the owned legacy checkout with `checkoutMergeBatch`, so its producer
captures the same private marker and directory identity as production batches.
Derive its admitted tree with the shared `committedTreeOrThrow` reader, matching
production preparation, and assert it differs from the full `HEAD^{tree}` because
the fixture commits its allowance owner in `.cland/tasks`. Keep this contract
across all six historical preparation variants; raw Git trees are not candidate
verification identities.
The separate unmarked upgrade case deliberately uses raw fixture Git and first
asserts `removeMergeBatch` refuses it. Seed that candidate in the probe checkpoint,
admit its replacement clone through the default repository, reopen the owner and
observe a completed probe receipt. Check the replacement is gone, the original
directory identity and sentinel bytes are unchanged, and its durable secondary
diagnostic survives. The historical cases use `suiteCase` with native Git,
separate setup/step bounds and fixture-owned cleanup; their executor is scripted.
The completed-legacy control admits its worker before reopening the probe owner;
after a positive worker-completion receipt, the probe must return that result
while preserving the unmarked root and diagnostic. This covers cleanup without
re-entering checkout or creating another worker.
Its diagnostic-failure variant rejects only the retained-root metadata write
after worker completion. Assert the selected green receipt and original run
survive, the existing receipt reason and structured persistence error each stay
within 2048 JSON-encoded bytes, and the structured line retains the root and
original ownership cause. Restore storage, call the same completed probe again,
and observe positive diagnostic persistence without another admitted worker.
