---
id: T-1728
kind: task
title: After a recipe or hook change, droplet runs keep booting the old snapshot and status says "inspection deferred", not stale
state: closed
status: done
size: S
criterion_seq: 3
labels: []
assignee: null
parent: E-1883
blocked_by: []
regression_of: T-1709
topic: topic-1652
branch: t/T-1728-after-a-recipe-or-hook-change-droplet
created: 2026-11-06T18:48:43.508Z
updated: 2026-11-19T12:39:00.079Z
closed: 2026-11-19T12:39:00.079Z
---

## Summary

When the running hub's recipe or the project's provision hook no longer matches the snapshot key, droplet runs still boot the old image, and no notice says so. `cland executor status` reports `unknown (inspection deferred)` instead of the stale parts. T-1709's note expected the restart after landing to trigger one rebuild; in practice only an explicit `cland executor prepare` rebuilds.

## What happened

- On 2026-11-06, the hub was restarted (#70) after T-1709 landed.
- Cover 2424aed9 then acquired two droplets from the old image 250987220. That snapshot's key still had `nvim` and `provision: none`.
- At the same time, `executor status` printed `unknown (inspection deferred)` for the snapshot.
- Coord ran `cland executor prepare`, which built cland-v0-35e1dc609f89 with the new key (`recipe`, `provisionPath` and `provision` digest).
- `acquire` in `hub/src/executor/droplet/droplet.ts` reads the snapshot and uses its image without comparing the key with the current recipe and hook.

## What to build

- A run that finds the snapshot key stale against the running hub's recipe and the committed hook gets one notice naming the stale parts, addressed to the Coordinator, with "run cland executor prepare".
- `executor status` shows `stale: <parts>` once the hub has computed the key, rather than leaving it deferred indefinitely.
- Booting the old image stays allowed (it is still a working image); no automatic rebuild.

## Acceptance criteria

- [x] C1. With a snapshot whose key lacks `recipe` or differs in `provision`, a droplet run posts one notice naming the stale parts and `cland executor prepare`, and the run still starts (test).
  - verified: rev-39 [reviewer] · run rev-20261119-1728-final-6 · 2026-11-19T11:24:30.669Z · commit ffe1454ae470dbdc46ab5c4651eaef4e9afcdd6e
  - done: impl-1728 · 2026-11-19T11:24:42.565Z
- [x] C2. `cland executor status` reports `stale: <parts>` for that snapshot, and `current` after a prepare with the matching key (test).
  - done: impl-1728 · 2026-11-19T09:52:59.014Z
  - verified: rev-39 [reviewer] · run rev-20261119-1728-final-6 · 2026-11-19T11:24:30.669Z · commit ffe1454ae470dbdc46ab5c4651eaef4e9afcdd6e
- [x] C3. The executor test files (`executor-droplet`, `executor-prepare`, `executor-safety`) pass with no test edited.
  - done: impl-1728 · 2026-11-19T10:20:46.811Z
  - verified: rev-39 [reviewer] · run rev-20261119-1728-c3-5 · 2026-11-19T10:56:19.933Z · commit ffe1454ae470dbdc46ab5c4651eaef4e9afcdd6e
  - verified: rev-39 [reviewer] · run rev-20261119-1728-final-6 · 2026-11-19T11:24:30.669Z · commit ffe1454ae470dbdc46ab5c4651eaef4e9afcdd6e

## Comments

### impl-1728 · 2026-11-19T09:40:52.282Z

Consumer census: key producers/readers are executor/droplet/{prepare,droplet,run,snapshot-recovery,dependencies}.ts and host/provider/{pool-image,digitalocean}.ts; hub dispatch/suites/demos route controls and acquisitions, CLI executor renders summary/JSON, spend-hubs probes status (3s timeout). Regression fixtures/readers: prepare-key, executor-prepare{,-component,-retry}, executor-{run,droplet,snapshot-confirmation,safety,safety-component,liveness,admission,admission-lock}, demo-release-component, remote-{fixture,scripted}, droplet-fixture, scripted-machine and state-inventory; wire/protocol keeps opaque executor status. Docs: hub/README, docs/hub/running and implementation/running, docs/agents/tests/executor-prepare guidance, QA briefs E-1531/1532/1533/1534/1535/1536/1537/1538/1539 and older executor briefs consume status summaries only. Frozen commands.json pins help, unchanged. No key/schema removal planned: same persisted legacy keys and response shape; status freshness text and advisory acquisition notice only. Host pool keys use same comparator but separate image policy and stay unaffected. Test seams: existing scripted executor acquire and inspect public methods, with fake provider/transport/key/base boundaries; real status RPC confirms Agents delivery. No native provisioning.

### impl-1728 · 2026-11-19T09:54:40.663Z

Implementation head 0cd6c03578b7de837359e13a3ead65f5ae506bc3 pushed; source review requested. Evidence A-21697. 85 reachable/conservative T1 files 918/918; T2 prepare component 31/31 and retirement component 2/2; preliminary unchanged T3 executor files 37/37 serial macOS fake-provider tests, native slot released. Whole-project typecheck and full test:lint passed; configured verify pending clear review/window. Consumer update: registeredHubSpendStatus timeout now 7s to cover 5s local-only status producer; original prepare T3 polling predicates keep old deferred text but exact final assertions still passed. All C1-C3 marked done.

### rev-35 · 2026-11-19T10:03:32.561Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1728-source-1
commit: 0cd6c03578b7de837359e13a3ead65f5ae506bc3
scope: full
findings: [{"severity":"medium","text":"Spec/Standards M1: both new snapshotNotice callbacks discard core.noticeTo's string|null receipt. #noticeStale treats any normal return as durable publication and persists suppression, so a missing publication receipt can permanently lose the advisory across restart. Require a positive owner receipt before marking it notified, share that boundary across dispatcher/Suites, and cover unavailable publication followed by successful retry.","file":"hub/src/hub/dispatch.ts","line":348},{"severity":"medium","text":"Spec/Standards M2: advisory meta reads/writes, including clearing a current key, sit outside failure containment. Their exception escapes the awaited #noticeStale call and rejects acquire, turning the new advisory into an acquisition gate. Keep advisory publication/checkpoint failures secondary with bounded diagnostics and no false suppression receipt; prove the original run still starts when advisory persistence alone fails.","file":"hub/src/executor/droplet/droplet.ts","line":361},{"severity":"medium","text":"Standards M3: new Store/backend owners are not pre-enrolled; awaited mkdir/writeFile precede try/finally, replacement construction is unprotected, and rejected backend.close lacks a positive resource/root/control fence. Whole-callback joining alone does not own these resources. Pre-own each acquisition, join original work, stop backend before DB/root removal, and retain DB/root/native guard on unconfirmed close; exercise setup abort and rejected cleanup through registered owners.","file":"hub/test/executor-prepare-component.test.ts","line":267},{"severity":"medium","text":"Standards/Spec M4: replacement unknown freshness text breaks unchanged raw readiness consumers in executor-prepare.test.ts:144/229/266. They reject only the old exact deferred string, so the new timeout/failure value is accepted as completed inspection before final current/stale assertions. Preserve compatible incomplete-state semantics while exposing the reason, or obtain authorized C3 clarification and migrate all consumers; keep final assertions and prove >5s then later-completion behavior.","file":"hub/src/executor/droplet/droplet.ts","line":389}]
finding_counts: {"high":0,"medium":4,"low":0}

Full source NOT CLEAR at clean0cd6c03578b7de837359e13a3ead65f5ae506bc3/treefad01a23, parent/base8431152d. A-21701 records4medium findings,nohigh/low: nullable Agents publication receipt discarded before durable suppression; advisory metadata exceptions escape into acquire; new backend/store resources lack pre-enrolled setup/replacement/rejected-close ownership and positive guard fence; unknown-text transition breaks unchanged native readiness consumers144/229/266. Leadbbe173bb/a83a7136 confirms no missing controls/approved exceptions. Preserve local committed/no-fetch5s inspection, base-consumption validation, legacy fields and explicit-only prepare. Compatible incomplete-state semantics can expose reasons without editing C3 files; otherwise obtain authorized C3 clarification before migration. A-21697 selectedworking-tree918T1/31T2/localretirement2 and preliminary unchangedT3 14+6+17 greens retain scopes/reds; not configured/frozen-head failure-path proof. Request records committed-headtypecheck/full lint0; unknown raw/source/native/scan facts stay unknown. C1/C3failed,C2doneunverified,nothingverified. Hold released for bounded corrections and fresh immutable-head source review before configured verification. Reviewer static source/log/consumer inspection only.

Criteria: C1 failed (Advisory suppression lacks a positive publication receipt, advisory metadata errors can gate acquisition, and new backend/store fixtures lack complete resource/root/control settlement.), C3 failed (Unchanged native tests use the old exact deferred-text readiness predicate; replacement unknown reasons can be consumed as completed inspection on the supported >5s timeout path.).

### impl-1728 · 2026-11-19T10:09:08.765Z

Revision consumer inventory: snapshotNotice now returns the producing core message id or null through one exported executorSnapshotNotice factory shared by Dispatcher and Suites; all callback producers and fake sinks are migrated. snapshot.inspectionReason is additive, only present on incomplete status; CLI and existing wire/status readers remain opaque, and all three protected raw executor-prepare predicates retain the exact unknown (inspection deferred) value. The new timeout test checks both that legacy readiness fence and the reason before the later positive completion. No old snapshot or response field is removed. New backend/store owners are pre-enrolled before setup and replacements; registered disposal and root/control guards require positively confirmed closure.

### rev-35 · 2026-11-19T10:24:42.627Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1728-source-2
commit: 8aa2d94f63525cd5b90ec592c247ce664f77e9e1
scope: full
findings: [{"severity":"medium","text":"Standards M1 (residual M3): the new rejection control owns a child snapshot-owner directory, but its containing fixture root has only the original-body join. When registered disposal rejects, parent recursive cleanup can bypass the child's exact resource-close guard. Fence the newly created containing parent on positive child-owner closure and exercise registered parent cleanup, retaining separate root/DB/control receipts; manual child removal refusal is insufficient.","file":"hub/test/executor-prepare-component.test.ts","line":403},{"severity":"medium","text":"Standards M2 (residual M3): new Store(path) can open DatabaseSync and throw during schema/migration before owner.store is assigned. With store/backend absent, close then marks the owner closed and permits root/control release despite the captured acquisition having no close receipt. Use the constructor's injected open seam to pre-own the native connection and cover wrapper-construction rejection; keep this bounded to snapshotCase.","file":"hub/test/executor-prepare-component.test.ts","line":264},{"severity":"low","text":"Standards L1: the outer advisory catch makes metadata/publication failures non-gating but discards their known secondary reason. Retain a bounded, redacted diagnostic through a nonthrowing path without changing acquisition or claiming publication/suppression; this diagnostic loss is non-blocking on its own.","file":"hub/src/executor/droplet/droplet.ts","line":353}]
finding_counts: {"high":0,"medium":2,"low":1}

Full revised source NOT CLEAR at clean8aa2d94f63525cd5b90ec592c247ce664f77e9e1/tree3e42dcb8, parent0cd6c035, base8431152d/no dev merge. A-21711 records2medium residual-M3 ownership findings plus1low secondary diagnostic loss. New child control guards only snapshot-owner; containing f.root can recursively bypass it after registered dispose rejects. New Store can throw after native open before owner.store assignment, then absent wrapper/backend lets close falsely mark closed. Lead646a1d2a/b0217bab confirms no omitted fences/approved dispositions. Bounded fixes: positive parent resource guard through registered cleanup; constructor open-seam capture/fallback positive close in this helper, no Store/helper-wide redesign. Original M1 positive shared exact-id notice receipt, M2 non-gating read/write/clear/prepare-reset containment, and M4 compatible deferred freshness/additive reason are addressed. Outer catch still silently loses known secondary advisory cause (low/nonblocking). A-21709 selected918T1/36T2/fullcompiler+lint0 retains source epochs; preliminary native14/6/confirmed17 precede final refinements, earlier missing-exit safety remains incomplete. No configured/Web/T4 proof. C1failed,C2/C3doneunverified,nothingverified. Hold released for bounded fixes/fresh immutable-head source review before verification. Reviewer static inspection only.

Criteria: C1 failed (New fixture ownership still lacks a positive containing-parent fence and native DB capture on Store-constructor rejection; these paths can remove storage or select closed before resources are confirmed closed.).

### rev-39 · 2026-11-19T10:44:21.506Z

verdict: review
result: clear
by: rev-39 [reviewer]
run: rev-20261119-1728-source-3
commit: ffe1454ae470dbdc46ab5c4651eaef4e9afcdd6e
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-1728 corrected source review CLEAR
Commitffe1454ae470dbdc46ab5c4651eaef4e9afcdd6e
Git tree92c5a11232ced82e34aab94edeac5a35fee660ee
Base8431152db4252c852896053dcff283c439248590
Reviewrev-20261119-1728-source-3, scope full.

## Standards
Clear; no findings. Residual ownershipM1 is resolved: snapshotCase.adoptRoot adds both original-work and positive resource-closure fences to original fixture root; both negative controls additionally guard their containing parent. Registered process-cleanup hooks are exercised. The final-removal control stays at zero attempts during failure, with separate parent/child stat, DB usability/native-isOpen and guard-retention receipts. Positive repair then invokes the actual containing-parent remover and confirms both directories absent. This closes the parent-recursive bypass rather than relying only on child refusal.
ResidualM2 is resolved: the existing injected Store open callback captures DatabaseSync in the pre-enrolled owner before configuration/schema/wrapper return. Constructor rejection retains that raw handle. Cleanup stops a returned backend, then returned Store or captured native DB, and requires native isOpen=false before closed selection. New constructor-rejection/native-close-rejection test exercises the registered cleanup and independent handle/root/control receipts. No production Store change or unrelated helper migration.
L1 is resolved: advisory metadata and successful-prepare reset failures use the same shared credential-list/bounded redactor diagnostic path (maximum500characters), contained even if logger throws. Tests plant a bearer value, assert redacted secondary reason and active lease, and deliberately reject the diagnostic sink. No failure reclassifies successful acquisition/prepare.

## Spec
Clear; no findings. Previously resolved publication receipt, non-gating metadata and compatible readiness corrections remain: shared executorSnapshotNotice returns producing core's exact id|null for both executor owners; suppression follows positive exact id only, with real Agents history/null-retry proof. Advisory read/write/clear/reset failures remain secondary; old image acquisition and explicit-only rebuild policy retained. Inspection uses local committed key/base,5s budget, shared in-flight work, fresh base validation, compatible exact "unknown (inspection deferred)" and additive inspectionReason; no fetch from status. Spend-hub caller timeout7s covers producer's5s local bound. Docs/skill change record reflect conditions, legacy compatibility and cleanup evidence.
Consumer inventory and direct field/callback searches cover production callers, status/wire readers, previous deferred predicates, tests/fixtures/briefs and frozen CLI-help bytes (help unchanged). The three protected native test files executor-droplet, executor-prepare and executor-safety have no diff from base; C3's unchanged-file condition is established, but passing them at the reviewed build remains run-dependent.

Evidence: A-21721 retains scoped earlier epochs and reports local macOS Node24.21.0 fake provider/transport only. Literal companion summaries inspected:37/37 component and918/918 selected/conservativeT1(85files), zero fail/cancel/skip. Command walls31.998234791s/140.870678584s have different scopes, not suite timing or speedup. Whole-project typecheck reportedexit0; full lint log0refusals/129advisory findings62files. These targeted candidate checks are not configured verification or allT1/T2/native coverage. Earlier A-21709 native14+6+confirmed17 observations and missing-exit epoch retain their preliminary/source limits; no new native/T3/Web/T4/browser/cloud/loaded/configured run at this head. Export redactions/scanner facts are author's retained report; unknown raw/invocation/native provenance remains unknown.

No criteria verified in this source pass: C1/C2 behavior and C3 required passing native files await same-head configured/scoped runtime evidence; source assertions/unchanged-file check do not substitute. Earlier verdicts A-21701/A-21711 remain historical, all their current findings addressed. Reviewer read exact source/diffs, consumers, docs and artifact receipts; diff whitespace check passes. No Reviewer edits/tests/probes/browser/commits/merges.
Standards0/Spec0 findings. Source clear permits configured verification at exact head under Coordinator window.
A-21722: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-21722-t-1728-source-clear-containing-roots-native-store-handle-and-diagnostics.md

### rev-39 · 2026-11-19T10:52:32.829Z

verdict: review
result: not clear
by: rev-39 [reviewer]
run: rev-20261119-1728-evidence-4
commit: ffe1454ae470dbdc46ab5c4651eaef4e9afcdd6e
scope: evidence
findings: [{"severity":"medium","text":"Required configured81d5f3dc failed clean-worktree gate on untracked T-1728-exact-droplet.log after T0. No T1/T2/Web execution/counts; evidence incomplete, no snapshot source defect inferred.","file":"hub/src/executor/droplet/run.ts","line":43}]
finding_counts: {"high":0,"medium":1,"low":0}

T-1728 configured evidence NOT CLEAR
Headffe1454ae470dbdc46ab5c4651eaef4e9afcdd6e
Reviewrev-20261119-1728-evidence-4, scope evidence.
Run81d5f3dc-63eb-4b0f-930e-783e272f3e9c/A-21724 failed after T0. Literal producing hub result:
dirty or changed worktree cannot be bundled for droplet: ?? T-1728-exact-droplet.log

Medium — hub/src/executor/droplet/run.ts:43 is the expected clean-worktree gate that reports the untracked capture, not a diagnosed source defect there. Configured T1/T2/Web never executed; counts/outcomes are unavailable, not zero/pass. T0 completed exit0 in136.386s. T3 remains merge-batch deferred in this run; independent C3 native work was separately granted and is not evidence completed by this failed configured run. C1 required configured evidence failed; C2/C3 remain unverified. Source-clear A-21722 remains valid if head/source unchanged.

Exact reviewed head matches hub latest verify record. Producer snapshot treea5be3c01ad61d846abd62e9c9b16a394a5e32404; no cache. Droplet c-8nyc1/cland-v0-4c4cd01c, platform/Node/browser/machine-health unavailable because no executed remote suite receipt. Producer lifetime109.245s/cost$0.0075864583, not test wall time. Projected tier timings/counts and report-only advisories do not establish executed tests.

Keep failed launch/bundling round recorded. Lead/Coordinator owns preservation of the native capture and clean-tree retry/window decision; no Reviewer file mutation, resubmission or runtime experiment. Same-head C3 receipts, when complete, remain separate. No findings against snapshot advisory behavior are inferred.

A-21725: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-21725-t-1728-configured-bundle-failure-from-untracked-native-log.md

Criteria: C1 failed (Required configured81d5f3dc failed bundling due to untracked native capture log; T1/T2/Web unexecuted, final behavior evidence incomplete.).

### rev-39 · 2026-11-19T11:24:30.670Z

verdict: review
result: clear
by: rev-39 [reviewer]
run: rev-20261119-1728-final-6
commit: ffe1454ae470dbdc46ab5c4651eaef4e9afcdd6e
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-1728 final evidence CLEAR
Headffe1454ae470dbdc46ab5c4651eaef4e9afcdd6e; Git tree92c5a11232ced82e34aab94edeac5a35fee660ee.
Reviewrev-20261119-1728-final-6, scope evidence.
Approved clean-tree retry73314802-b280-4356-98d3-123e22ac8d5e/A-21748 passed at exact source-cleared head, no cache. Producer snapshot treea5be3c01ad61d846abd62e9c9b16a394a5e32404 is distinct from source Git tree.

Independent structured completions:6,957 ordinary passes and40 separate load repetitions; zero fail/cancel/skip. T0/T1/all fallbackT2/Web exit0. Configured T3 remains merge-batch deferred, T4 unexecuted. No all-tier claim.
executor-prepare-component has37/37 ordinary passes. Eight exact new generated cases have5/5 load passes each (40):
- snapshot status names recipe and hook drift after a slow local inspection
- stale snapshot acquisition reports each changed key once and keeps preparation explicit
- snapshot advisory metadata read failure never gates acquisition
- snapshot advisory metadata write failure never gates acquisition
- snapshot advisory metadata clear failure never gates acquisition
- Agents publication retries a null core receipt before suppressing a stale snapshot notice
- snapshot owner cleanup fences root, database and controls until rejected closure is confirmed
- failed Store construction retains its native handle and containing parent until registered cleanup closes it

C1: source-reviewed exact durable publication/suppression and run-continuation assertions now have ordinary+load receipts. Active acquisitions survive metadata and deliberately throwing diagnostic sink failures; no implicit builder/image. Prior persisted snapshot shape remains readable. C2: recipe/provision stale parts, compatible deferred timeout/reason and later completed/current/base-moved observations pass; native prepare current-after-matching-key final assertions are independently covered by same-head C3 receipt. No missing/unknown observation is called current or a pass.
C3: A-21727/A-21728 and separate markrev-20261119-1728-c3-5 retain exact-head serial unloaded local macOS Node24.21.0 native test commands14/14 executor-droplet,6/6 executor-prepare,17/17 executor-safety, explicit tool exits0/zero fail/cancel/skip. Source review independently confirmed all three files byte-unchanged from base8431152d. These native fixture runs use fake cloud/provider and isolated disposable roots; they are separate from configured Linux execution and are not cloud/Web/T4/loaded proof.

Configured provenance:Linuxx64droplet c-8nyc1/kernel6.8.0-147-generic/Node24.21.0/Neovim0.12.5/workers2. Actual suite-browser /home/runner/cland/node_modules/playwright-core/.local-browsers/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell, Google Chrome for Testing156.0.8078.4. Producer lifetime1392.452s/cost$0.0966980556(summary1392s/$0.0967), not test wall time. Lint129/62 and duration/ratchet advisories report-only.

Earlier81d5f3dc/A-21724 remains failed after T0 on the untracked-log bundle gate; it has no T1/T2/Web runtime proof and is not relabelled green. Exact-head native capture receipts and the approved retry remain separate ordered evidence. Earlier preliminary native/missing-exit epochs keep their prior limitations.
Standards/Spec:no findings. All source findings from A-21701/A-21711 remain resolved as recorded in A-21722. VerifyC1,C2,C3. Reviewer only inspected pinned source and durable receipts; no tests/probes/browser/file edits/commits/merges.
A-21749: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-21749-t-1728-final-clear-configured-retry-and-unchanged-native-receipts.md

Criteria: C1 verified, C2 verified, C3 verified.

### coord · 2026-11-19T12:39:00.079Z

Merged 5e3a2005c80cd62166b635f132a037a2aedf62fd onto dev.
