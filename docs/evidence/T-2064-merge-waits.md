# T-2064 merge setup inventory

## Review correction and evidence scope

A-22677 identified missing continuation ownership and insufficient campaign
provenance at source1 (`9cdd713832bb44c15d917f23d1f7afc246daaedc`).
A-22676 remains historical evidence from a changing-source worktree. It proves
selected passing attempts, not five executions of the final reviewed tree.
There were no retained per-round source hashes or snapshots and no raw exported
worker liveness/stop/join receipts. The optional fake-clock callback changed
during round five. Source reasoning about its inactive native branch is not
execution-identity proof. All original reds and intermediate failed attempts
remain failures. C1 still requires fresh fixed-reviewed-head Mac and Linux
receipts, obtained after source clearance under Coordinator capacity.

`mergeTest` installs `mergeOwner` before the callback acquires anything, including
separate owners for subtests because their teardown precedes the parent return.
The existing `fixtureWork` seam retains whole callbacks and each admitted
original setup/predicate. Each named observation has a separate deadline;
expiration does not remove its producer from ownership. Abort fences admission.
`fenceFixtureCleanup` joins the originals before resource shutdown, and only
successful resource/hub closure permits directory removal and seam release.
`ownDirectory` installs that same positive writer barrier on direct removal,
not only the test's after hook. The added tracker start and rebase/index/merge
view setup use separately named admitted steps. Public final assertions remain.

The shared owner controls in merge-recovery cover startup observation timeout,
callback cancellation, and rejected resource close. They independently attempt
actual guarded directory removal and normal cleanup, check the retained root
and unreleased seam, then require original writer completion, positive resource
closure, root removal and seam release after repair. Removing original-step
enrolment made the timeout control fail `resource closure follows the original
producer: false !== true`; restoration passed all three controls. The full T2
file passed 65/65 locally on macOS Node 24.21.0. These controls prove the owner
seam; they do not replace the pending fixed-head native campaign.

Source2 review A-22679 found that real context mock restoration was still
outside that fence. Source3 intercepts restoration on the actual node:test
MockTracker returned by the context: `reset`, `restoreAll`, and its timer
`reset` stay deferred until the owner's successful release phase. The context
and framework see the same tracker, so framework teardown cannot independently
restore the mocked method or timers after resource shutdown rejects. The release
then runs the original tracker reset and restores the original API descriptors.
This applies to all migrated mock callers, including merge-recovery's method
and timer mocks and host-allow-list's filesystem mocks; explicit restoration
APIs in those files and their merge helpers were searched.

The new T2 merge-case control uses the real node:test context MockTracker,
the actual filesystem readFile property under the outer fake-native launch guard, and
Node mock timers. It invokes the real context restoration APIs after both
normal cleanup and direct guarded directory removal reject. It separately
checks native method identity/call handling, timer identity/queued callback
execution, retained storage and rejected closure, then repairs the closer and
requires actual native/timer restoration, disabled timer state and root removal.
Before the fence it failed `native seam survives independent context teardown`.
Removing only the timer reset fence failed `actual timer seam remains installed`.
Both complete restoration paths pass with the fence installed. The control
replays the framework's reset API on its actual tracker; it does not claim that
an intentionally failed nested node:test case completed successfully.

Scope: tests only; no production contract, help bytes, tier or role change.
The public observation is `task.view`: persisted `status === ready` together
with the latest hub review's `current === true`. The bounded setup uses the
shared load-scaled `eventually` default, without a fixed delay or retrying a
merge effect. All original landing, refusal and recovery assertions remain.
The forged-header case observes `Tracker.mergeViewAsync`, the public owner
view that selects accepted hub evidence even when a later file-only header
occupies the detail view's latest-verdict annotation. The observation fixture
now starts its owned Tracker after registering its stop hook, so background
freshness and ready transitions actually run before setup waits.
Rebase fixtures explicitly refresh the owner's Git tips before observing that
state, so cached current evidence at the old tip cannot satisfy setup. After
the forged header is written, the fixture indexes it through `rescanAsync`
before observing the authoritative merge view.

Search: `review(`, `task.comment`, review verdict literals, ready/current,
`type: 'merge'`, CLI merge calls, and importers of merge-support and
merge-native-support across hub/test, nvim/test, web/test and QA. Reviewed
T-2050 and T-2055 source changes and their consumer audits. No live database
was opened, queried or copied.

| Consumer | Disposition |
| --- | --- |
| merge-native-support.ts | Its clear review setup now observes both ready and current review before returning. All callers below retain their final assertions. |
| merge.test.ts | Shared setup covers direct post-review merges. First case already waits for ready through CLI task view. |
| merge-recovery-native.test.ts | Shared setup covers all clear reviews, including close-write obstruction installed only after ready persistence. Recovery retries operate on existing landing receipts. |
| merge-checkout.test.ts, merge-checkout-lifecycle.test.ts | Shared setup before native conflict/checkout/lock fault injection. |
| host-allow-list.test.ts | Shared setup before immediate merge/lease revocation. |
| prune-process-lifecycle.test.ts | Imports native helpers; lifecycle cleanup assertions retained. |
| merge-policy.test.ts | Explicit waits before documentation landing, each queue-conflict admission, successful QA landing, configured-base landing and close-subscriber measurement. File-restoration case already observes ready frames; rebase cases observe settled task state before merging. Override and provenance refusals intentionally do not require ready. Assessment-only cases do not invoke task merge. |
| merge-gate.test.ts | Explicit setup wait before final classified merge and both sides of the controlled freshness-race case. Criteria cases already observe ready. Missing/invalid/stale/claimant/provenance verdict tests intentionally exercise refusal states. |
| merge-recovery.test.ts / merge-component-support.ts (T2) | Injected Git, manual tips and FakeClock. Direct non-override merges now call `f.ready(work)`, advancing the fixture clock while observing public ready/current state. `f.merge` defaults to an explicit fixture override to exercise cleanup independently of verdict admission. Controlled verdict/role refusal tests retain their deliberate boundaries. |
| merge-queue.test.ts (T2) | Shared fixture explicitly completes the same-head verification receipt and advances FakeClock until public task.view ready. Changed-head fixture repeats that setup. Negative admission cases intentionally set nonready states; synthetic batch/report fixtures construct their ready state explicitly. |
| merge-queue-unit.test.ts (T1) | Explicit ready edit and awaited freshness refresh; no asynchronous verdict-to-merge transition. |
| merge-batches.test.ts, merge-batch-dependencies.test.ts, merge-override.test.ts | Injected queue callbacks or pure override policy; no post-verdict task admission. |
| scenarios/ticket-flow.test.ts | Existing current-review and ready observations before legacy criteria refusal/success; configured verification flow waits for new-head ready. |
| nvim/test, web/test, QA | No additional direct post-verdict task merge setup found. Historical briefs describe normal reviewed/verified workflow; no fixture migration or frozen wire/help change. |

## Red before fix

macOS arm64, Node 24.21.0, local targeted T3, base 40f68c7d9.
Eight owned `/usr/bin/yes` workers were launched from initial load below 12.
Documentation merge failed with
<!-- cland-allow-closed-wording: historical diagnostic names a disposable fixture task, not the project tracker item -->
`review-pending: T-1: review is still checking freshness; try again`.
Close-write recovery failed with
`merge-not-ready: T-1: status backlog; ready required`.
The queue-conflict case passed in this reproduction; its original red is
<!-- cland-allow-closed-wording: historical diagnostic names a disposable fixture task, not the project tracker item -->
preserved in A-22674 (857f8e7c), where T-4 returned review-pending instead of
merge-conflict. No red reproduction is claimed for that case locally.

The first attempted load launch ended with its command owner and supplied no
stress evidence. The persistent owned launch was positively observed with eight
live workers near 98% CPU each. Only its runs count as loaded evidence.

## Validation

Targeted local results, Linux configured verification and final reviewed head
are recorded in the accompanying session artifact. These targeted observations
are not a full T3 or integrated cover pass. Timing budgets remain report-only.
No browser or provider call was used. Native Git runs only in disposable roots
using the existing shared fixture environment.

Historically, on the source1 worktree locally: merge-policy 26/26, merge-gate 7/7,
merge-recovery-native 12/12 (T3), and merge-recovery 62/62 (T2) passed.
The conservative T1 import scan found no known reachable T1 files and four
unsupported-grammar files; all four were run rather than treated as absent:
suite-remote-budget 19/19, suite-task-selection 11/11,
verification-tier-receipts 4/4 and web-notifications 5/5 passed. No T1 coverage
is borrowed from a different tier.

Immediate post-verdict merge can also return review-pending for a client; the
Coordinator filed that separate follow-up as T-2065. Production stays unchanged.
