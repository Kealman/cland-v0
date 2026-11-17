---
id: T-1925
kind: task
title: A local SSH client failure (macOS user lookup down) marks healthy droplet runs "remote machine lost" after 300 s
state: open
status: review
size: S
criterion_seq: 2
labels: []
assignee: null
parent: E-1883
blocked_by: []
topic: topic-1574
branch: t/T-1925-a-local-ssh-client-failure-macos-user
created: 2026-11-16T22:17:45.854Z
updated: 2026-11-17T00:17:30.636Z
---

## Summary

On 2026-11-16 at 17:26Z the hub's Mac lost sysmond and its local user lookup (`ssh-keygen`: "No user exists for uid 501"). The hub's SSH status checks to healthy droplets then failed locally for 300 s, and runs 9759d489, 8ca3360e and c830a7ae were all finished at 17:31:31–17:31:32Z with cause "remote machine lost", although the failure was on the hub's side. A local SSH client failure should not discard remote runs as if their machines were gone.

## Evidence

- impl-1922 (topic-1568): the three runs' result.json say cause='remote machine lost'; their suite.log files hold no inspection or recovery diagnostic. The droplet run status in executor/droplet/run.ts marks a run lost after 300000 ms of failed SSH status against an active provider, or on a 404 or absent resource.
- The next run, f78c050a, failed at `ssh-keygen` with `No user exists for uid 501`.

## Acceptance criteria

- [x] C1. When the SSH status check fails because the local client cannot run (a fake ssh that fails before connecting, with a user-lookup or key error) while the provider reports the droplet active, the run is not marked "remote machine lost"; it holds as "local SSH client unavailable" and resumes once the client works again (test, red before the fix).
  - done: impl-1925 · 2026-11-17T00:10:06.350Z
- [x] C2. A droplet that the provider reports gone, or that stays unreachable while the local client works, is still marked lost as today (test).
  - done: impl-1925 · 2026-11-17T00:10:06.826Z

## Comments

### impl-1925 · 2026-11-16T23:54:47.273Z

Rule 20 consumer inventory before edit: searched RunStatus, unreachableSince, remote machine lost, MachineTransport, machine command failed across hub/web/nvim/shared/docs/.agents/qa (all tiers). Runtime: executor/{executor,local}, droplet/{run,machine,lease,dependencies,droplet}, hub/{suites,merge-batches}. Fixtures/tests: executor-contract, executor-prepare-component, executor-run (T3), suite-accounting, remote-scripted, scripted-machine, suite-component/unit fixtures, suite-human/task-card/merge-queue/suite-close-recovery/verify-submission/suite-soak/merge-batches. Docs/briefs: running.md, executor-prepare-retry guide, qa/briefs/{T-271,E-1533}. Plan retains RunStatus wire shape and unknown state with optional existing cause='local SSH client unavailable'; no terminal outcome/cause change. Existing unknown replies without cause remain supported. Machine's internal typed local-failure fact consumed only by DropletRun; current callers otherwise retain Error semantics. Only active-provider confirmation permits local-client hold; 404/absent/lifetime and ordinary unreachable behavior remain. Status recovery clears durable unreachableSince.

### impl-1925 · 2026-11-16T23:58:43.876Z

Implementation evidence A-20478. Final T2 status fixture completed 8/8 passes after replacing incomplete Provider assertion with mocked DigitalOceanApi.droplet; full root npm run typecheck passes on macOS Node24.21. Earlier 32/32 across executor component/contract/prepare-component. Prior red explicitly showed lost after 300001 fake ms for local lookup/key/binary failures. No real SSH/provider or browser. Rule36 preflight: fetched origin/dev, merge reports already up to date; npm run test:static and lint-tests in progress, closed wording already 0 findings. No per-item QA (none/after-stage).

### impl-1925 · 2026-11-17T00:03:49.556Z

Coordinator scope decision 40597d08 (topic-1574): C1 requires operator-visible structured hub log event once on entering local SSH hold and once leaving, with run id, cause and transport error text; keep persisted job/wire/UI shapes unchanged. Must add red-before-fix event tests. Source cac1c809d pinned pending review verdict; confirmed test-fixture whole-work owner missing, to fix alongside log evidence. Shared fix T-1923 15757e4d4 authorized as unmodified own commit after verdict.

### rev-36 · 2026-11-17T00:05:46.514Z

verdict: review
result: not clear
by: rev-36 [reviewer]
run: rev-36-1925-source-1
commit: cac1c809d1c2eb3e5f2d9f9031fe0e5f5c03be0f
scope: full
findings: [{"severity":"medium","text":"New statusFixture and callbacks have no pre-acquisition whole-work owner joining status/writeLease/readLease continuations before normal/signal root disposal. tempProject only owns removal; success-path awaits cannot fence a cancelled callback. Claimant confirms no earlier owner. Enroll shared ownership before acquisition, adopt the root and join the complete scenario before removal.","file":"hub/test/executor-droplet-component.test.ts","line":48},{"severity":"medium","text":"The local-client hold cause is returned only through internal RunStatus; Suites discards cause for unknown receipts, so the operator sees no named local cause. Coordinator40597d08 requires one structured hub-log entry on hold entry and one on leave with run id, cause and bounded/redacted transport error text, plus red-before-fix coverage, while persisted job/wire/UI shapes stay unchanged. No such reporting owner exists at this head.","file":"hub/src/executor/droplet/run.ts","line":236}]
finding_counts: {"high":0,"medium":2,"low":0}

Full source not clear A-20486: Standards1medium at componentfixture:48, pending status/writeLease/readLease work has no whole-scenario owner before root disposal (claimant confirms). Spec1medium at run.ts:236, unknown cause is internal-only and Suites discards it; Coordinator40597d08 clarifies required entry/leave structured hub logs with run/cause/transport error text and red-first coverage, no persisted/wire/UI change. Active-provider tiebreaker, typed local classification and404/null/lifetime/ordinary-network controls otherwise accepted; C2unverified. A-20484 retains original dirty-candidate red/green commands/completion/unknowns and full consumer inventory; no configured pass or Reviewer runtime. C1failed; consolidate ownership+logging and separately posted shared15757e4d4, fresh exact-head source review before verification/window. Hold released.

Criteria: C1 failed (Named local-client hold is not operator-observable and the new status scenarios lack pre-acquisition whole-work cleanup ownership.).

### impl-1925 · 2026-11-17T00:10:19.308Z

Rework committed/pushed at 1ef31bd95d6a27ce6575a199c11310eb9de57ed8; fresh source review delivered to reviewer. A-20489 preserves red-before-fix structured event evidence and green normal-path cases; A-20484 retains original source failure and full consumer inventory. C1 now includes Coordinator-required visible log transitions; caseDeadlines pre-acquisition/whole-sequence owner joins status/lease continuations. Shared T-1923 is byte-identical patch61fc1b519 from15757e4d4, stable patch id ca1055f0f1fa1bcd7cd2b9c0c935301d9d365422. Final full typecheck green; targeted33/33+priority1/1 local macOS Node24.21. Static/lint preflight still finishing; no suite/QA/browser receipt. Configured verify remains gated by fresh source clear and Coordinator window.

### rev-36 · 2026-11-17T00:17:30.636Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1925-source-2
commit: 1ef31bd95d6a27ce6575a199c11310eb9de57ed8
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full source clear A-20495: Standards0/Spec0. Both A-20486 findings resolved: pre-acquisition shared whole-case ownership joins/fences status and lease I/O before normal/signal directory cleanup; retained production DropletRun emits deduplicated enter/leave via actual hub LogFn with run/cause/original bounded transport error, including recovery/loss/release. Coordinator40597d08 scope met without persisted/wire/UI change. Active-provider/local classification and ordinary-network/404/null/lifetime/provider-unknown controls retained. Authorized shared15757e4d4 cherry-pick61fc1b519 independently stable-patch-identical ca1055f0f1fa1bcd7cd2b9c0c935301d9d365422. A-20484/A-20489 retain local red/green excerpts/consumer dispositions/unknowns; final preflight0 with report-only lint122/59. C1/C2 implementation accepted but unverified until completed same-head configured evidence or explicit Coordinator waiver. No Reviewer runtime. Hold released; claimant follows Coordinator window before verify.
