---
id: T-2112
kind: task
title: cland merge fails with "stdout maxBuffer length exceeded" once a tracked file passes 16 MB (protocol-frames.json at 20 MB on T-1944)
state: closed
status: done
size: S
criterion_seq: 2
labels:
  - needs-triage
assignee: null
parent: E-2074
blocked_by: []
topic: topic-1799
branch: t/T-2112-cland-merge-fails-with-stdout-maxbuffer
created: 2026-11-26T18:00:20.115Z
updated: 2026-11-27T01:23:24.849Z
closed: 2026-11-27T01:23:24.849Z
---

## Summary

On 2026-11-26, `cland merge T-1944` failed twice with `cland: stdout maxBuffer length exceeded` and the item was not enqueued. T-1944's branch grows `nvim/test/fixtures/protocol-frames.json` from 14,525,076 bytes on dev to 20,083,278 bytes. Several hub git reads use a 16 MB `maxBuffer` (for example `hub/src/territory.ts:32`, `hub/src/suite-shards.ts:189` and `:229`), and one of them in the merge or admission path reads that blob in full. Dev's copy is already at 14.5 MB, so the next fixture growth breaks merges for everyone.

## What to build

Find the merge-path read that buffers the whole blob, and make it stream or size-check the content instead of buffering it, or refuse with a named, actionable error when a file exceeds a declared limit. Keep the other reads bounded.

## Acceptance criteria

- [x] C1. Enqueueing a branch that changes a tracked file larger than 16 MB either succeeds or refuses with a message naming the file and the limit; it never fails with a raw maxBuffer error (test).
  - verified: rev-35 [reviewer] · run rev-35-2112-evidence-1 · 2026-11-26T21:06:37.679Z · commit bff8dea283704eab27f288f78300d70467481590
  - done: impl-2112 · 2026-11-26T21:40:29.718Z
  - verified: rev-35 [reviewer] · run rev-35-2112-evidence-2 · 2026-11-26T22:59:10.420Z · commit 0b94239a4ddcb5dbc16029247fc5231834a34acb
- [x] C2. The hub's task-ready watcher handles a ready item whose branch rewrites a tracked file larger than 16 MB without a maxBuffer error, so the item can be enqueued (test).
  - verified: rev-35 [reviewer] · run rev-35-2112-evidence-1 · 2026-11-26T21:06:37.679Z · commit bff8dea283704eab27f288f78300d70467481590
  - done: impl-2112 · 2026-11-26T21:40:29.962Z
  - verified: rev-35 [reviewer] · run rev-35-2112-evidence-2 · 2026-11-26T22:59:10.420Z · commit 0b94239a4ddcb5dbc16029247fc5231834a34acb

## Comments

### impl-2112 · 2026-11-26T19:25:04.009Z

Consumer census: taskPatch in tracker/verdict-git.ts is consumed by Freshness.patch (freshness.ts), which supplies verdict freshness, merge admission and task-ready watchers. gitIn callers include tracker/tracker.ts and artifacts, stage QA, follows, freshness and territory tests. Proposed additive optional streaming patch method on Git retains injected/older callable shape. Other git reads retain 16 MiB bounds. Tests will exercise both ready transition and public merge in merge-queue.test.ts with stageCase whole-case owner and guarded native fakes.

### rev-35 · 2026-11-26T19:38:21.420Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-2112-source-1
commit: 045ada74f38ddf4cd29567593dc2405f7df05ecd
scope: full
findings: [{"severity":"medium","text":"M1: new pending Git producers register only a close-count assertion; no pre-acquisition releaseOnClose action drives their cancellation before stageCase joins the original callback. TestContext abort/observation expiry lacks release-before-join ownership and positive cleanup fencing.","file":"hub/test/large-patch-fixture.ts","line":14},{"severity":"medium","text":"M2: every fake kill emits close synchronously, so the join controls cannot detect omission of Promise.all(native close receipts). Add an independently held close and a whole-owned rejection/cancellation proof that retains result/root/seams until that close is released and joined.","file":"hub/test/large-patch-fixture.ts","line":48}]
finding_counts: {"high":0,"medium":2,"low":0}

Source not clear; A-23594 records standards/spec findings and explicit correction bar. Claimant dfc23e03 confirms no covering cancellation owner, delayed-close control or approved exclusion at this head. Retain public20MiB watcher/ready/enqueue, bounded stream/scalar output, legacy-callable and six outcome assertions. Add early shared-owner stop/release enrollment and independent held-close proof with the full proof continuation joined before root/native seam release. Production streaming design/ordinary16MiB read limits show no separate functional blocker in this pass; no redesign, allowance or retier requested. A-23593 remains scoped authored local macOS/fake evidence, not configured/native Git proof; C1/C2 unverified. Hold released for scoped correction; request fresh committed-head source review before verification. No Reviewer edits or test/probe/run.

Criteria: C1 failed (New transport acceptance controls lack pre-acquisition cancellation ownership and an independent native-close barrier proof; current immediate-close cases do not establish the claimed cleanup boundary.), C2 failed (The new ready/enqueue fixture has no release-before-join stop owner for pending streamed Git on case cancellation or observation expiry; correct its ownership/control coverage before runtime verification.).

### rev-35 · 2026-11-26T19:47:47.667Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-2112-source-2
commit: 82fa7b7fbb27085a46c0e17c535b7fc76b1456b6
scope: full
findings: [{"severity":"medium","text":"M1-R: after awaited tempProject, the nested proof registers its native stop owner and launches Git outside a new admission step. Cancellation during that setup can consume one-shot releases first, missing the late owner and allowing a post-seal launch; current controls cancel only after children started.","file":"hub/test/merge-queue.test.ts","line":155},{"severity":"medium","text":"M2-R: dispose is blocked in original-work join before directory hooks, so stat(root)/restore refusal never exercise adoptRoot's removal guard while close is held. Add an independently observed real guarded-removal attempt and supervised continuation; retain held-close/result/root/restoration final assertions.","file":"hub/test/merge-queue.test.ts","line":174}]
finding_counts: {"high":0,"medium":2,"low":0}

Correction not clear; A-23596 records the finite remaining bar. Ordinary early stop enrollment, retained signal, encompassing outer supervisor and independent held native close now resolve those parts of M1/M2; keep them. Remaining gaps are late setup admission and actual root-guard exercise, both explicitly confirmed absent/no exclusion by claimant b7f92cfd. Production diff empty; no new functional transport issue identified. Preserve public20MiB ready/enqueue, byte/queue limits, all outcomes, close-join mutation sensitivity and final continuation/ENOENT/seam assertions. No broader redesign/native campaign/allowance/retier requested. A-23595 is scoped authored local fake evidence; configured proof still pending. Hold released for these corrections and fresh committed-head review; no Reviewer edits or test/probe/run.

Criteria: C1 failed (New controls still allow a late native fixture enrollment after cancellation during root setup; source ownership correction is incomplete.), C2 failed (The claimed guarded-root retention proof checks presence before reaching the removal guard; actual guarded cleanup coverage remains incomplete.).

### rev-35 · 2026-11-26T19:55:08.400Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-2112-source-3
commit: bff8dea283704eab27f288f78300d70467481590
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected source clear; A-23606 records standards/spec review. M1-R resolved by post-root step re-entry and controlled cancellation-during-setup proof retaining late root capture, sealed receipt, no native admission, joined cleanup/ENOENT/restoration. M2-R resolved by direct ownDirectory cleanup with separate real guard-chain entry and beforeRemove admission receipts, supervised removal continuation and retained independent close/result/original-writer/seam assertions; omission sensitivity reported in A-23605. Prior early-stop/outer-supervisor/join sensitivity fixes remain. Production/fixture unchanged from preceding review; public20MiB ready/enqueue, scalar/queue bounds and all outcomes retained. No new design/contract/default/tier/allowance changes. Local74/74 and adjacent/static results remain authored macOS/fake evidence, not configured/native Git proof; reachable count is selection only. C1/C2 intentionally unverified pending same-head configured result and actual case/phase receipts. No findings; hold released, request Coordinator verify window. No Reviewer edits or test/probe/run.

### rev-35 · 2026-11-26T21:06:37.679Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-2112-evidence-1
commit: bff8dea283704eab27f288f78300d70467481590
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final same-head evidence clear; A-23632 records independent42408d74/A-23631 audit. Producer code0/empty cause, unfinished[], complete0 T0/T1/T2/selected248 T3/Web at canonical668ed4907527e9d0531109baa150cc0cc981371a. Exact public large-patch ready/enqueue case passes base+5 distinct loads, retaining >=40MiB synthetic consumption and queue bound. All nine other new outcomes/setup/held-close cases also pass base+5; changed merge-queue74 and adjacent unit/ready/summary/request/epic/freshness/native-ready/merge files pass. Source3 early cancellation, sealed late setup, independent close and direct root-guard receipts therefore have actual runtime coverage. Large-patch test remains guarded synthetic Git-stream/public-flow proof, not a native20MiB repository claim. Paired9764basepass/12explicit prerequisite skips plus50loadpass; known3 finish-only accounting records separate. Other28 T3/18 T4 unexecuted, advisory checks and cache limits retained. Linuxc8nyc1 Node24.21/Nvim0.12.5 workers2; isolated HeadlessShell1248/Chrome156.0.8078.4. C1/C2 verified; prior source failures/local red history retained, findings none, no Reviewer changes or additional run.

Criteria: C1 verified, C2 verified.

### impl-2112 · 2026-11-26T21:39:21.327Z

Merge-batch follow-up: 278aa098 failed the startup import probe cli-imports.test.ts::CLI commands load only their own source closure within the import budgets. task list --json loads56 total/38 help=18 implementation modules vs17; cli/task.ts imports verdict-git.ts, whose new static patch-id import adds1. Coordinator approved lazy import inside Git.patchId. Existing native probe reproduced red, then all3cases green at55total/17implementation; unchanged budgets/help counts. Consumer census now explicitly includes this runtime CLI resolver probe. Functional172cases and full typecheck green; full lint pending before delta review. Previous task green remains previous-head evidence, batch stays red.

### rev-35 · 2026-11-26T21:42:39.955Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-2112-source-4
commit: 0b94239a4ddcb5dbc16029247fc5231834a34acb
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Delta source clear; A-23642 reviews only approved lazy-import correction from bff8dea28. Static patch-id import removed; Git.patchId checks abort before await import, and unchanged streamedPatchId rechecks before native acquisition afterward. Callable shape/Freshness/stream semantics/owners/limits unchanged. CLI budgets,38 help count and test assertions unchanged; guide matches. Actual batch diagnostic A-23637:16125 is56total/18implementation vs task17, not39extra implementation modules. A-23641 native CLI3/3 and local functional/static green remain authored scoped macOS evidence, not configured proof. Earlier42408d74 stays previous-head green and failed278aa098 stays red. C1/C2 intentionally unverified at this new head pending configured result; inspect actual CLI budget and functional/close receipts with execution limits. No findings; hold released, request new Coordinator window. No Reviewer edits or test/probe/run.

### rev-35 · 2026-11-26T22:59:10.420Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-2112-evidence-2
commit: 0b94239a4ddcb5dbc16029247fc5231834a34acb
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final C1/C2 evidence clear at lazy-import head; A-23654 records independent0bde53dd/A-23653 audit. Producer code0/empty cause, unfinished[], complete0 T0/T1/T2/selected248 T3/Web at canonical6e1f332dc3de629bd3257c1001e3175d510a9b7b. All ten exact public20MiB ready/enqueue/outcome/setup/held-close cases pass base+5 distinct loads; merge-queue74 and adjacent/native-ready files pass. Explicit limit: CLI-imports has no receipt in this task log; A-23641 remains authored native macOS3/3 and source4/A-23642 establishes unchanged-budget lazy import. Its Linux integration receipt belongs to the next full batch; this verdict does not clear or bypass failed278aa098. Previous42408d74 remains previous-head green. Paired9764pass/12prerequisite skips+50loaded pass; known3 finish-only records separate, other28 T3/18 T4 unexecuted. Linuxc8nyc1 Node24.21/Nvim0.12.5 workers2, isolated HeadlessShell1248/Chrome156.0.8078.4; advisory/cache scope retained. C1/C2 verified; findings none, no Reviewer changes or additional run.

Criteria: C1 verified, C2 verified.

### coord · 2026-11-27T01:23:24.849Z

Merged f24c4aaf92f63d825ecb53cd974095198d957f0c onto dev.
