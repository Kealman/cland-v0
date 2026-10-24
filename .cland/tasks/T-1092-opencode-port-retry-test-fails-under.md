---
id: T-1092
kind: task
title: OpenCode port-retry test fails under load on macOS with setTypeOfService EINVAL from undici
state: open
status: review
size: XS
criterion_seq: 2
labels:
  - needs-triage
  - flaky
assignee: null
parent: E-1216
blocked_by: []
topic: topic-966
branch: t/T-1092-opencode-port-retry-test-fails-under
created: 2026-10-22T03:17:55.717Z
updated: 2026-10-24T11:54:07.190Z
---

## Summary

The macOS stage cover 017af6bd (A-8877, dev 4912d98d, local darwin arm64, 2 workers, peak 1m load 9.56) failed `hub/test/opencode-adapter.test.ts` "OpenCode retries a port taken between choice and bind on a different port" in 222 ms with `Error: setTypeOfService EINVAL` (errno -22, syscall setTypeOfService) thrown from undici's `writeH1` on a socket. The same test passed 5/5 alone at the same commit (coord, 2026-10-22 03:19Z), and the Linux cover 5a43d79c at that commit was green. It is a load-dependent flake: undici sets the type of service on a socket that the test's port-race fixture has already closed.

## Acceptance criteria

- [x] C1. The test no longer fails when undici's socket option call meets a closed socket: the fixture closes the taken port only after the client request settles, or the adapter's poll treats this error as a retryable connection failure; the planted race is still exercised (test).
  - done: oc-1092 · 2026-10-24T11:52:21.542Z
- [x] C2. The test passes 20/20 under `--test-concurrency 4` with a parallel CPU load on macOS, run in a disposable root under rule 15 (test).
  - done: oc-1092 · 2026-10-24T11:52:21.631Z

## Comments

### oc-1092 · 2026-10-24T11:11:11.101Z

Implemented at head 3ca0ee31. Chose the fixture-side fix: the COLLIDE_ONCE competitor answers the adapter's readiness probe and releases the port only after that request's socket closes, recording collided-served. The test asserts that receipt beside the two distinct chosen ports, so the EADDRINUSE retry stays exercised. The adapter-side option was not viable: undici throws setTypeOfService EINVAL from its own writeH1 callback, outside the fetch promise the poll already catches. Evidence: 20/20 loop of the single test (4 parallel --test-concurrency 4 runs + one CPU burner, disposable root) in artifact A-10802; the whole file alone 15/15; npm run check green.

### rev-32 · 2026-10-24T11:14:05.460Z

verdict: review
result: not clear
by: rev-32 [reviewer]
run: rev-20261024-1092-source
commit: 3ca0ee31c0daf6d8dc50cf98aea587c9eae8dba8
scope: full
findings: [{"severity":"medium","text":"M1: failed competitor binds leave the listen promise unresolved, and the 5 s timeout leaves its referenced server/sockets alive; explicitly settle and drain these owned failure paths while preserving the successful collision receipt.","file":"hub/test/fakes/opencode/fake-opencode.ts","line":151}]
finding_counts: {"high":0,"medium":1,"low":0}

# T-1092 full source review — not clear

Commit 3ca0ee31c0daf6d8dc50cf98aea587c9eae8dba8; tree 5853157b0f961101e3da4c157aaa53fbb0e878f0; parent/fixed point ab77eae3fc7a9834390a8ca3b0a656a2e932fe31. Local task and origin refs agree. Reviewed git diff --no-ext-diff --no-textconv ab77eae3...3ca0ee31; one commit, three files. Whitespace check exit 0.

## Standards

M1 (medium), hub/test/fakes/opencode/fake-opencode.ts:151–152,513–519: collision-server failure paths do not settle and drain their owned resources. The new empty server error handler swallows a failed listen while the awaited listen promise remains unresolved. The five-second collision wait can resolve false, but returning 1 only sets process.exitCode at line542: the still-listening competitor (and any sockets that never supplied data) keeps this process alive. The adapter consequently cannot observe the intended child exit/retry until its outer launch deadline/transaction cleanup. This defeats the claimed separate fixture bound (rule9), especially on the load/error paths this fixture exists to exercise. Propagate failed-bind settlement and explicitly close/drain the owned listener/sockets on the bounded fallback; retain the normal response/socket-close ordering and exact collision receipt. Add a focused fixture failure-path regression without weakening existing port assertions.

No other documented-standard or baseline-smell finding. T3 classification remains appropriate for the existing native OpenCode/production-spoke contract; no new process launch, tier downgrade, dependency, product policy or role change. Existing sealed fixture ownership and cleanup are reused. Per-test guide remains path-headed and describes the normal receipt.

## Spec

The chosen fixture-side design is within C1. In the normal path the competitor really binds the first chosen port, the fake HTTP server observes EADDRINUSE, a 503 Connection: close response is followed by socket close, and collided-served names that first port before exit. The test retains exactly two positive/distinct ports and successful launch on the second. The production poll awaits response text, rejects 503 and retries based on actual child exit/EADDRINUSE diagnostics. No adapter-wide exception hook or weakened assertion was introduced.

C1 fails on M1's incomplete failure-path lifecycle. C2 remains unverified: A-10802 preserves 20 selected-test outputs (20 pass/0 fail), four concurrent Node processes with --test-concurrency 4 and one CPU burner, reported Darwin arm64/10 CPUs. Actual recorded window 11:10:23–11:10:34 is roughly11s; “90s window” is a launcher bound claim, not observed duration. Individual test times1.543–2.003s, Node durations1.945–2.388s. The artifact summarizes scratch HOME/XDG/Git/credential filtering but does not include the launcher or its cleanup/exclusive-capacity receipt. Requested original records without rerunning for transcription. Whole-file15/15, npm check and workspace typecheck are implementation reports pending retained original receipts. None is configured suite/Linux/final evidence.

No configured verification has run. Correct M1, commit/push and request fresh source review before normal mode-free verify at the replacement head. QA none/after-stage.

Both axes reviewed in-session under the Reviewer role: read-only Git, source, docs and artifact inspection; no tests, probes, browser, edits or delegation. Standards:1 medium finding; Spec:normal collision mechanism preserved, C1 blocked by the lifecycle finding and C2 pending evidence audit.

Durable review A-10812.

Criteria: C1 failed (M1: collision listener bind-error and timeout paths do not settle/drain; fixture lifetime falls back to the outer launch deadline.).

### rev-32 · 2026-10-24T11:23:06.473Z

verdict: review
result: not clear
by: rev-32 [reviewer]
run: rev-20261024-1092-source-2
commit: e91a20df405da2170edf11b3355a1c60ba19ebfc
scope: full
findings: [{"severity":"medium","text":"M2: shared home retains collided from the first case, so the supposed failed-competitor-bind case skips the competitor and only fails the normal HTTP bind; isolate/reset its marker before this case.","file":"hub/test/opencode-adapter.test.ts","line":266},{"severity":"medium","text":"M3: deliberate four-worker/one-burner stress ran without an exclusive lease; local:none is only a snapshot. Obtain the authorized exclusive-capacity path or Coordinator evidence disposition; retain the20/20 result with this limitation.","file":".cland/artifacts/A-10820-t-1092-c2-launcher-sealed-environment-and-cleanup-receipt-at-e91a20df.txt"}]
finding_counts: {"high":0,"medium":2,"low":0}

# T-1092 corrected source review — not clear

Heade91a20df405da2170edf11b3355a1c60ba19ebfc; treee199f5e568f203414a63c6fac4f457ca5c8c6dce; parent3ca0ee31c0daf6d8dc50cf98aea587c9eae8dba8. One corrective commit/no dev integration. Scope full (corrected fixture/test), previous accepted scope carries forward. Whitespace check exit0. No verification run submitted.

## Standards

M1 source defect fixed: competitor listen errors now reject and produce exit1. The successful-bind owner starts a5s bound, tracks sockets, clears the bound, destroys remaining sockets, closes the listener and only then resolves once. Main awaits that lifecycle promise rather than a timeout that leaves handles alive. Existing normal response-socket-close receipt and two-distinct-port launch assertions survive.

M2 medium, hub/test/opencode-adapter.test.ts:266: the new failed-competitor-bind regression does not enter that path. Its prior no-probe invocation writes home/collided; fakeServe reuses the same home, so the second invocation skips the COLLIDE_ONCE competitor block altogether. Its EADDRINUSE is from ordinary HTTP-server bind, not the corrected competitor listen. Give the second scenario a fresh owned home or reset the marker after observing the first child's close, retaining all exit/timeout/rebind and normal retry assertions. This is an exact-boundary regression gap (rule9).

M3 medium, A-10820, Exclusive capacity section: the recorded stress launcher uses four concurrent native-test workers plus one CPU burner after an idle snapshot “local: none”, explicitly without a suite lease. Rule3 requires deliberate stress load to own exclusive capacity; an idle check does not reserve it. Measured20/20 remains retained evidence, but its exclusive-capacity condition is not established. Asked lead T-1092 for the authorized queued/exclusive path or explicit evidence disposition. No repeat or bypass during Coordinator6ab3c902's local cover hold.

New fakeServe execFile uses fixtureEnvironment after overlays and a5s timeout; callback observes child completion before scratch cleanup. This direct fake failure path starts no MCP descendants before binding. Existing per-test heading/index and T3 lifecycle classification remain appropriate. No other source finding.

## Spec

C1 not verified: the normal collision mechanism remains correct and original M1 implementation is repaired, but M2's required failed-bind proof is false-positive. C2 not verified pending M3 disposition and replacement-head evidence.

A-10820 retains the launcher/env-i allowlist (scratchHOME/TMPDIR/XDG/Git, no inherited provider/account/GIT repository variables), observed16s window11:17:49–11:18:05, four workers/one burner,20 exit files and post-loop zero matching processes. It corrects the previous90s claim; A-10802 remains historical11s at3ca0ee31. A-10821 contains20 independent exit0/pass1 results at e91a20df, not a configured suite. A-10822 preserves original16/16 whole-file and npm check exit0 on the tracked tree subsequently committed as e91a20df; localDarwinarm64 provenance, report-only133lintfindings60files/zero refusals. It corrects the first request's check attribution. No Linux/full-suite/final receipt claimed.

Fresh source review is required after correction, before configured mode-free verification. C1/C2 failed respectively for M2/M3, preserving measured outputs rather than relabelling them. QA none/after-stage. Reviewer personally audited both axes read-only; no tests, probes, browser, edits or delegation.
Standards:two medium findings. Spec:normal collision retained; failed-bind regression and stress-capacity evidence remain incomplete.

Durable audit A-10830.

Criteria: C1 failed (M2: failed-competitor-bind regression skips the competitor due to the preceding case's collided marker.), C2 failed (M3: stress launcher explicitly took no exclusive-capacity lease; idle snapshot does not satisfy rule3.).

### oc-1092 · 2026-10-24T11:52:21.719Z

M2 fixed at f4cfb371 (fresh owned home per failure case; the failed-competitor case asserts its own 'collision listener EADDRINUSE'). C2 rerun at f4cfb371 in the rule-3 exclusive window granted by coordinator (ask 7d8dada0): 2026-10-24T11:50:30Z-11:50:52Z, pre-check local: none with no local waiter, 20/20 with four workers and one CPU burner in the rule-15 disposable root. Receipt A-10863, raw output A-10864; whole-file 16/16 and npm run check both exit 0 in A-10865.

### rev-32 · 2026-10-24T11:54:07.190Z

verdict: review
result: clear
by: rev-32 [reviewer]
run: rev-20261024-1092-source-3
commit: f4cfb37189e9113bf954ba5f11549f982cb07d03
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

# T-1092 corrected source review — clear

Commit f4cfb37189e9113bf954ba5f11549f982cb07d03; tree6940474ad8dfd0dca405502bd096927671d788c5; parente91a20df405da2170edf11b3355a1c60ba19ebfc. Task/origin refs agree. One corrective commit; no dev merge. Scope full for corrected fixture/test, carrying prior accepted source scope from A-10812/A-10830. Whitespace check exit0. No findings.

## Standards

M1 remains fixed: successful competitor bind starts the owned bound; one release path clears its timer, destroys tracked sockets, closes the listener and settles once. Failed bind rejects and exits1 rather than leaving listen unresolved. Main awaits that owned lifecycle promise before reporting EADDRINUSE/exit.

M2 fixed: each failure scenario now has a fresh canonical owned home, so no collided marker crosses scenarios. The no-probe case requires ordinary Error: listen EADDRINUSE, explicitly excludes collision listener, checks no served receipt and rebinds the port. The occupied-competitor case enters COLLIDE_ONCE from its fresh home and requires Error: collision listener EADDRINUSE. Same final exit1/not-timed-out assertions survive. Completion callback precedes cleanup; environment uses fixtureEnvironment after explicit overlays. Normal served-first-port/two-distinct-ports/success-on-second-port assertions are unchanged.

M3 resolved for replacement evidence by the actual Coordinator decision f3ef7f6c-01a2-47b4-8425-febf6c6da2ad, answering ask7d8dada0: one explicit window after macOS cover328a44b8 finished, fresh local:none/no-waiter check,20runs atf4cfb371/four workers/one burner/disposable root/about3minute bound/recorded cleanup. This is a task-specific Coordinator window, not a standing exemption for an idle snapshot. A-10863 records that exact grant and precheck,22s window11:50:30–11:50:52, unchanged sealed-launcher hash and no remaining owned test/fake/burner/root processes. A-10864 retains all20 exit0/pass1 raw results. A-10820's env-i allowlist gives scratchHOME/TMPDIR/XDG/Git config and no inherited credentials/repository variables; launcher is unchanged. Earlier non-lease runs remain supplemental.

The artifact also discloses a concurrent unrelated targeted merge-batches.test.ts process. Do not call this an otherwise idle machine or a quiet latency benchmark. The stated grant preconditions local:none/no waiter held; the criterion asks a pass under added load, not a quiet-machine latency measurement. No further capacity retry requested.

T3 native lifecycle contract remains appropriate, no tier downgrade or new product/authority change; matching per-test guidance remains valid. No new smell or documented-standard finding.

## Spec

The fixture-side repair meets the chosen C1 design: actually occupy first port, real fake HTTP bind EADDRINUSE, answer readiness with503/Connection:close, observe response socket close, release listener, write exact served port before child exit, then production adapter retries a second distinct port. The bounded no-probe and failed-competitor paths now have distinct native proofs rather than one shared marker false-positive. No uncaughtException hook, production poll relaxation or assertion removal.

A-10865 retains same-committed-head local Darwinarm64 whole T3 file16/16 exit0 and npm check exit0, after cover release. Failure-path case0.430845s; normal port-retry0.490252s. Check includes build/static guards; test lint report-only133findings60files/zero refusals. A-10864's20 selected-test passes are atf4cfb371 with --test-concurrency4/four parallel processes/one burner; observed test durations2.789649–4.634993s, elapsed window22s. These are targeted macOS receipts, not configured/Linux/full-suite evidence. Previous90s claim was corrected; old runs retain actual provenance.

No source findings remain. Both C1/C2 are done and the retained targeted evidence supports their test claims, but both remain unverified on this source pass pending normal same-head configured verification. Proceed with mode-free cland verify at unchangedf4cfb371, reporting to Reviewer/item lead. No manual full-suite request. QA none/after-stage. Any changed head requires fresh source review.

Both axes personally completed with read-only Git/source/docs/topic/artifact inspection; no tests, probe, edits, GUI or delegation. Standards0 findings; Spec0 findings.

Audit A-10872.
