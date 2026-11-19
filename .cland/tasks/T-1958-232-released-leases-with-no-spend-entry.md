---
id: T-1958
kind: task
title: 232 released leases with no spend entry log executor-lease-spend-missing on every compaction pass (about 760,000 lines a day), and the lease-index migration leaves no log line
state: open
status: review
size: S
criterion_seq: 3
labels:
  - needs-triage
assignee: null
parent: E-1883
blocked_by: []
regression_of: T-1950
topic: topic-1640
branch: t/T-1958-232-released-leases-with-no-spend-entry
created: 2026-11-18T06:13:57.102Z
updated: 2026-11-19T02:52:53.832Z
---

## Summary

After restart #83 (2026-11-18, dev 303b482b8), T-1950's lease index (`.cland/run/executor/lease-index.json`, version 1) keeps 232 of 4,221 leases: released leases that have no spend entry, so they never settle. Every compaction pass logs `executor-lease-spend-missing` for all 232: 7,424 lines in the first 14 minutes, about 760,000 a day, into a hub.log that is already 763 MB. The one-off migration also leaves no log line, so an operator cannot tell from the log that the index was built.

## What to build

A released lease without a spend entry reaches a terminal state of its own: a recorded unknown spend (rule 17: never a zero) whose receipt says no ledger entry existed, after which it leaves the hot index. The missing-spend diagnostic is logged once per lease, never once per pass. The migration logs one structured line with the counts it read, indexed and settled.

## Acceptance criteria

- [x] C1. With a fake leases root holding released leases that lack spend entries, repeated compaction passes log the missing-spend diagnostic once per lease, record an unknown spend with its receipt, and leave the hot index (test counts log lines and index entries over N passes).
  - done: impl-1958 · 2026-11-19T02:50:39.417Z
- [x] C2. The lease-index migration emits one structured log line with its read, indexed and settled counts, and a rerun on an existing index emits none (test).
  - done: impl-1958 · 2026-11-19T02:50:39.849Z
- [x] C3. Every reader of a lease's spend state (doctor, status, the spend ledger, the CLI) shows unknown for these leases and never zero; the reader list follows rule 41 (test).
  - done: impl-1958 · 2026-11-19T02:50:40.288Z

## Comments

### impl-1958 · 2026-11-19T00:46:25.715Z

Consumer inventory (rules 20/41): lease.ts readIndex/readLeases/readLeaseHistory/readDemoLeases/writeLease; spend.ts observe/reconcile/settleSpend/inspectSpend/inspectHostSpendSnapshot; droplet.ts compaction/release/inspect; dispatch executor.status/reap; cli/executor.ts forwards summary and JSON; spend-hubs.ts reads only path/legacyRetirement. Web sessions/verification.ts now accepts optional unknownLeases with an older-wire regression. doctor/hosts.ts reads host.status pool spend only; host/status.ts uses hosts-category totals/billing only, so verify-category unknown historical receipts are unaffected. No doctor executor-spend reader exists. Neovim plan/panels and demo/suite accounting read provider lifetime/cost receipts rather than ledger spend; unchanged. Ledger cost:null plus additive identity-bound spendReceipt preserves existing numeric known totals; unknownLeases names exclusions. Search covered field/function names, raw spend.json, costUsd, todayCostUsd and category readers in hub/web/nvim/shared, all tiers, docs, QA briefs and shipped skills. Frozen cli-usage fixture unchanged: no usage bytes changed. QA E-612/E-1538 migration readers and known-cost fixtures unchanged. Direct ledger/compaction tests include executor-lease-index/spend/admission/lock-liveness/retirement, pool-spend-cap, host-spend/status/restart/watchdog/provider and suite/demo accounting; known-entry shapes unchanged. T-1968 no-write guard preserved.

### impl-1958 · 2026-11-19T00:53:23.420Z

At head 4168ee2aedfdd73c9bf815a8cefbea7834c4e617, local macOS Node v24.21.0: serial targeted T1 selection passed 940 tests in 92 files, no failures/cancellations/skips. Production importingTests selected 89 files; three unknown-graph T1 files (suite-remote-budget indirect require, verification-tier-receipts and web-notifications vm loader) were conservatively added. No T2/T3/T4/Web browser or configured verify receipt yet. Red-before-fix: C1 diagnostics 8 versus expected 2; C2 migration actual [] versus expected one structured count receipt. C1 now also covers interrupted index publication, restart/rebuild deduplication and ordinary settlement preserving unknown bytes; C3 covers ledger, category summary, executor JSON/text and old/new Web wire model. Doctor is host-only and unaffected.

### rev-36 · 2026-11-19T01:16:42.310Z

verdict: review
result: not clear
by: rev-36 [reviewer]
run: rev-36-1958-source-1
commit: 4168ee2aedfdd73c9bf815a8cefbea7834c4e617
scope: full
findings: [{"severity":"medium","text":"Reconciliation does not merge the new terminal unknown-spend receipt. Supported primary/legacy duplicates can discard the receipt or replace unknown cost with a legacy numeric zero. Preserve unknown state through one shared reconciliation policy and cover both ledger orders and conflicting duplicates.","file":"hub/src/executor/droplet/spend.ts","line":44},{"severity":"medium","text":"writeLease can publish the first lease index from legacy directory IDs without emitting the migration receipt. Subsequent compaction sees an existing index and never logs it. Cover every first-publication owner with the same once-only structured read/indexed/settled counts, retaining the no-write guard.","file":"hub/src/executor/droplet/lease.ts","line":200},{"severity":"medium","text":"New consumers grant settlement authority to any truthy spendReceipt, while readExisting validates only the old numeric fields. Malformed reason, foreign project/lease identity or mismatched release metadata can remove a lease from the hot index. Validate and bind the receipt once before any reader or settlement consumer trusts it.","file":"hub/src/executor/droplet/spend.ts","line":189},{"severity":"medium","text":"Both new callbacks (lines 19 and 58) use a helper that joins normal-path work before cleanup, but lack a separately named setup deadline and whole-case timeout/signal admission fencing. Enroll the affected caller sequences before acquisition and preserve their launch guard, cleanup joins and final assertions.","file":"hub/test/executor-lease-index.test.ts","line":19}]
finding_counts: {"high":0,"medium":4,"low":0}

Full Standards and Spec source review at exact head 4168ee2aedfdd73c9bf815a8cefbea7834c4e617 (tree 178a1c307c97b9b2686326a7041fc3ec58ca8dd4), against a6f2006b15c70ca108cf9d129825d5b2cad23ae4. Four medium findings; none high or low. The Implementer confirmed all four gaps in e68d27e4-fbcb-47e2-921d-1beafa906006. Detailed findings, positive source checks, consumer dispositions and evidence limits are retained in A-21472.

The new transaction checks absence again under ledger ownership and durably records unknown spend before diagnostic/index cleanup. Existing no-write and confirmed-release preservation guards remain. Those positives do not cover the four paths above.

A-21463 and additive A-21469 retain the local macOS Node v24.21.0 invocation: 92 distinct files, all T1 at this pin, with the reported completion of 940 passes and zero failures/cancellations/skips. The full raw stream was removed before review; invocation-time tree/native receipts and the complete generated-case census are unavailable. Existing mixed-ledger tests do not cover the new receipt permutations. No T2/T3/T4, Web browser, configured verification or QA pass is claimed; Reviewer ran no tests or probes.

C1, C2 and C3 failed; no criterion verified. This consolidated verdict releases the source/experiment pin for the scoped corrections. Request fresh source review at the resulting immutable head before configured verification, with any runtime work subject to the Coordinator's window.

Criteria: C1 failed (Terminal unknown receipt reconciliation/validation and the new callbacks' setup and cancellation ownership are incomplete.), C2 failed (writeLease can first-publish the index without the migration event; the new control also lacks separate setup and cancellation ownership.), C3 failed (Primary/legacy reconciliation can discard unknown metadata or promote it to zero, and receipt identity/reason/release bindings are not validated.).

### impl-1958 · 2026-11-19T01:26:46.678Z

Source1 correction inventory before fresh review: readExisting and every terminal-spend consumer now use exported hasUnknownSpend to validate reason/project/lease/release/date/category/cost; newly created receipts are validated before ledger admission. Reconciliation preserves a valid terminal unknown alongside primary/legacy pending or zero duplicates in both orders; read-only migration preserves legacy bytes while publishing the merged primary. Both first-index publishers use publishIndex; all production writeLease calls were searched across hub/src, including DropletRun and Demos, and now forward the executor/run logger. Direct tests/fixtures keep optional logging; no CLI usage bytes changed. New fake-only callbacks use native-free caseDeadlines/fixtureWork with the same TestContext normal/abort owner, separate root/seed bounds, per-effect admission and original-work join before cleanup. Normal/abort/timeout held-setup controls preserve the root and fence the subsequent write. Existing launch guard, interruption, hot-index counts and bounded-history assertions retained. No dev merge after first source review.

### impl-1958 · 2026-11-19T01:32:58.981Z

M4 acquisition-boundary follow-through: fakeOnlyFixture now accepts an optional FixtureStep and uses it for guard setup, root acquisition and callback entry. Existing two-argument callers retain behavior. Caller search: executor-contract, suite-t3-interactions, executor-lease-index, recording-host, executor-launch-boundary and host-create-admission tests; no production consumers. New held-guard control positively observes admitted guard setup, closes the owner, and requires the next root acquisition and callback to remain unadmitted. Native-free TestContext normal/abort ownership follows the Coordinator decision. Corrected lease-index file now passes 20 tests. Fresh head is 921d3a6650483d80689d1d4f682fd7ef081a68da (tree 86e5e2c7484a0105807efdb10ec06965d75570d6); c00a675b0 has a separate completed 946-pass T1 receipt, which will not substitute for the new head.

### impl-1958 · 2026-11-19T01:45:39.143Z

Fresh source-review head 3fcdaf574e89aa9e8336d08048efd496d07b390c, tree 701f3eda087eaa8f002ef525331de644d435c088, pushed with a clean worktree. Same 92 selected T1 files reran at this exact head: 947 pass, no failures/cancellations/skips, printed selected-process duration 150062.171084 ms (not full-suite wall time). Full npm run test:lint and npm run typecheck each exited 0 at this head; lint has existing report-only notices and zero refusals. A-21484 preserves the full exact invocation, file/tier dispositions, original/output hashes, publication-redacted test/static logs, earlier intermediate green T1 runs, and the 921d3a665 TS2322 typecheck failure before its type-only spy correction. Seven Boolean assignment labels and private workspace prefixes were redacted only in export copies; positive-control scan passed before publication. Staged copies removed. C1–C3 done marks renewed; Reviewer verification and configured T2/T3/T4/Web evidence remain pending. No dev merge after source1.

### rev-36 · 2026-11-19T01:49:59.265Z

verdict: review
result: not clear
by: rev-36 [reviewer]
run: rev-36-1958-source-2
commit: 3fcdaf574e89aa9e8336d08048efd496d07b390c
scope: full
findings: [{"severity":"medium","text":"publishIndex invokes the migration logger after the index is durable but before writeLease publishes lease.json. A synchronous diagnostic-sink throw rejects the append and skips that record; the newly forwarded DropletRun logger can also route an already obtained native status receipt into the broad unknown-status catch. Contain ancillary diagnostic failure without masking real persistence errors, with a throwing-sink regression through the publication and writer/status owner.","file":"hub/src/executor/droplet/lease.ts","line":54}]
finding_counts: {"high":0,"medium":1,"low":0}

Fresh full Standards and Spec source review at 3fcdaf574e89aa9e8336d08048efd496d07b390c, tree 701f3eda087eaa8f002ef525331de644d435c088, fixed base a6f2006b15c70ca108cf9d129825d5b2cad23ae4. One medium finding, none high or low. Detailed source, consumer and retained-evidence checks are in A-21485.

The original reconciliation, receipt validation and caller ownership findings are addressed. Both first-index owners now share publication/count/no-write semantics and all production writers forward the logger, but that new ancillary failure path remains. The Implementer confirmed no omitted preservation boundary or approved disposition in 1da8c835-b1fe-471f-b6d5-6681c42df8eb. Coordinator d022553e's native-free T1 ownership choice is preserved; no process-cleanup import migration is requested.

A-21484 retains the exact final 92-file T1 invocation and 947 positive outcomes on local macOS Node v24.21.0, plus full lint/typecheck completions reported exit 0. Reviewer checked the required reporter records and exported-log hashes. Redacted export/raw/native provenance limits, report-only notices and the earlier TS2322 failed typecheck remain explicit. No configured verification, T2/T3/T4/Web browser or QA pass is claimed. Reviewer ran no tests or probes.

C2 failed; C1/C3 remain done but unverified. No criteria verified in this source pass. The consolidated verdict releases the source/experiment pin for the scoped diagnostic-preservation correction. Preserve the resolved policies and assertions; request fresh immutable-head source review before configured verification under the Coordinator's window.

Criteria: C2 failed (The shared migration diagnostic can abort first lease publication after its index checkpoint and replace a selected native status outcome.).

### impl-1958 · 2026-11-19T02:00:49.351Z

Source3 review requested at pushed clean head 5f0c2c8c13021f64acbac68e9c81009ac86c477f (tree dfdadf79c59318653e9b586c44374b9157a6472f). Migration sink exceptions are ancillary: one primary attempt and at most one contained secondary notice; no delivery claimed if both throw. The real writer/status regression was red, now preserves lease.json and the exact fake-transport completion receipt, while an actual lease-record rename error still propagates. At this exact head local macOS Node v24.21.0: 948 passing tests across the confirmed 92 T1 files, zero failures/skips; full lint/typecheck exit 0, existing advisory lint notices and zero refusals. A-21489 preserves exact command, complete redacted outputs, original/export hashes and deferred tier/native/browser limits. No configured verify submitted; awaiting source verdict and Coordinator window.

### rev-36 · 2026-11-19T02:02:18.939Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1958-source-3
commit: 5f0c2c8c13021f64acbac68e9c81009ac86c477f
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear at exact head 5f0c2c8c13021f64acbac68e9c81009ac86c477f, tree dfdadf79c59318653e9b586c44374b9157a6472f, fixed base a6f2006b15c70ca108cf9d129825d5b2cad23ae4. Full Standards and Spec review; no findings. A-21491 records source, consumer, documentation and retained-evidence checks.

The source2 medium is resolved: only migration diagnostic callbacks are caught, with one contained secondary notice. Index publication and lease-record writes retain their original error paths. The owned fake regression proves persisted lease.json and the exact DropletRun.status receipt under both throwing-sink modes, no recovery probe or diagnostic replay, and independent propagation of the actual lease-record rename error. Source1's reconciliation/validation, both first-publication owners, and native-free setup/cancellation ownership corrections remain intact. Clean local head/tree/origin match; no dev merge after review.

A-21489 retains the exact 92-file T1 invocation: local macOS Node v24.21.0, 948 passes with zero failures/cancellations/skips, full lint/typecheck completions reported exit 0, zero lint refusals and existing report-only notices. Reviewer independently checked the required named positive reporter entries, pinned tiers and exported-file hashes. Redacted capture and shell-observation provenance limits remain explicit; historical failed/partial records are retained. No configured verification, T2/T3/T4/Web browser or QA pass is inferred. Reviewer ran no tests or probes.

C1/C2/C3 remain done but unverified; this source verdict verifies none. The Implementer may request the Coordinator's configured verification window at this unchanged head. Final evidence settlement requires same-head owner/tier results and exact generated case receipts. Any head change needs fresh source review.

### rev-36 · 2026-11-19T02:26:22.552Z

verdict: review
result: not clear
by: rev-36 [reviewer]
run: rev-36-1958-evidence-1
commit: 5f0c2c8c13021f64acbac68e9c81009ac86c477f
scope: evidence
findings: [{"severity":"medium","text":"Four local SSH recovery controls fail 'one enter event despite repeated failed polls', actual 2 expected 1, because their generic event-stream consumer was not migrated for the new migration event. Coordinator disposition 3cc73ce8 attributes this to T-1958: preserve the intended enter/leave boundary with specific event assertions and update the consumer inventory.","file":"hub/test/executor-droplet-component.test.ts","line":520},{"severity":"medium","text":"The parallel-acquires shared-spend case is cancelled with 'test timed out after 120000ms' (structured timedOut, 120.006778071 s); the owner also reports hung at 236 s. Root cause remains unattributed. Preserve this failed partial receipt and obtain the Coordinator-authorized diagnosis/disposition before retry; advisory duration budgets are not the failure cause.","file":"hub/test/suite-accounting.test.ts","line":409}]
finding_counts: {"high":0,"medium":2,"low":0}

Configured evidence not clear for run 18348b69-5922-4a58-abb1-50a8f1e81a91 / A-21494 at unchanged source-clear 5f0c2c8c13021f64acbac68e9c81009ac86c477f. Producing owner auto exit 1; failed partial, not superseded by completed task positives. Full audit and exact failure output are retained in A-21495.

A-21494:35053–35119 records each SSH failure as 'one enter event despite repeated failed polls', 2 !== 1, at test:520. Lines35121–35123 record the separate accounting timeout; structured finish:31366 is cancelled/timedOut120.006778071 s. Coordinator disposition 3cc73ce8, relayed in ee8f0302, attributes the event consumer failures to T-1958 and authorizes correction; timeout remains unattributed with bounded diagnosis after hold release.

T0/T1 exit0; T2 exit1. All230 T1 file receipts passed. Of435 T2 files,391 have file finishes (389 pass,2 fail), with44 Neovim files unexecuted. All248 T3/17 T4/55 Web files are unexecuted; browser binary/version null. Base terminal records6164 =6159 pass/4 fail/1 cancelled, including82 nested identities; separate265 passing load repetitions. The owner's6428 completed-before-interruption count excludes cancellation and includes those repetitions; no file envelope is counted as a test. Eleven named task/control identities each retain a positive base finish and five positive load finishes, including unknown reconciliation, validation, both publishers, throwing sinks, ownership and old-wire model. These do not make this round clear or verify criteria.

Provenance pins runtime tree a8af525ad7cecd8783cabee34d2420b6ea58bd05, cached:null, Linux x64 6.8.0-147-generic droplet c-8 ams3, Node v24.21.0/Neovim v0.12.5,2 workers. T0 host100.209s is a step; droplet lifetime1040s/$0.0722 is executor accounting. Lint/budget/ratchet notices remain report-only. Reviewer ran no tests/probes and source remains clean.

C2 failed; C1/C3 remain done but unverified. No criteria verified. This consolidated settlement releases the evidence pin for the Coordinator-authorized consumer correction and bounded diagnosis; it permits no configured retry at an unreviewed head. Preserve A-21494 and every outcome. Fresh source review and Coordinator window are required before another configured run.

Criteria: C2 failed (The added migration event leaves four existing SSH event-stream consumer controls failing in the configured run.).

### impl-1958 · 2026-11-19T02:38:39.552Z

Second-pass null-spend consumer census (rule 41), after configured failure A-21494 and decision fa36ad81. Search covered cost equality/inequality/nullish/default/destructured forms, .cost field access, raw spend.json/SpendEntry/SpendLedger/ledger helpers in product, fakes, all test tiers, Neovim/Web, fixtures, QA and skills. Dispositions:

PRODUCT (hub/src/executor/droplet/spend.ts):
- hasUnknownSpend/readExisting: validation, not a pending classifier; malformed receipts refuse. Reconcile validates/preserves terminal unknown before numeric duplicate merging.
- totals reserved: already excludes hasUnknownSpend; numeric spent is explicitly known subtotal paired with unknownLeases in views.
- settleSpend fast path + locked path: already exclude hasUnknownSpend; terminal unknown cannot become numeric settlement.
- compactLeaseHistory: already treats validated unknown as settled; inspectSpend and inspectHostSpendSnapshot expose unknown count (the snapshot skips null numeric costs after counting unknown).
- reconcile shard suppression, reserveSpend group lookup and releaseShardSpend: their null predicates are restricted to the owned synthetic lease key reserved:<run>; terminal unknown is produced only for actual UUID droplet lease identities. These synthetic reservations are removed/replaced on real admission, or settled to numeric zero on release; no released real unknown row can match the group key. Unaffected identity-specific reservation paths.
- hostSpendMutation pool list, hostSpendReservation, renewHostSpend, settleHostSpend and cancelHostSpend: pendingHostEntry/category hosts filters first. hasUnknownSpend rejects receipts on host-category rows. No verification unknown row enters these host reservation paths. Host period totals and billing likewise filter hosts; unaffected.
- All other product .cost matches are session/token usage, runtime weight estimates or storage prices, not per-user spend ledger state. CLI/Web executor readers forward normalized inspectSpend data; no raw null-as-pending parser there.

TEST/RAW READERS:
- suite-accounting.test.ts:414-415 (T2): MISSED/MIGRATED. beforeCreate's count/find of all cost:null rows incorrectly enrolls terminal unknown rows after two rejected peer acquisitions. Now selects cost:null && !hasUnknownSpend with the production validated policy; still asserts exactly one pending reservation and reservation0.0625. The actual minimized head case goes red before and green after this change; no cost is rewritten to zero.
- executor-lock-liveness.test.ts:143 (T1): fixture pre-reserves all17 concrete leases, then asserts every seeded lease has a numeric final cost; no absent ledger entry is seeded. Its null-count-zero is a known-final-cost assertion, not a generic pending read. Remains unchanged; T1 already executed.
- suite-dry-run.test.ts:86 (T3): sums reservations in a fresh fixture ledger with no native acquisitions or released legacy history. Unknown receipts cannot be generated by dry-run; zero sum asserts no reservation side effect. Unchanged; T3 deferred.
- suite-close-component.test.ts:134 (T2): waits for numeric final costs for exact already-reserved shard run IDs; an unknown cost intentionally does not satisfy known settlement. :240 captures the two synthetic shard reservations before either first provider create in a fresh ledger (no prior released rows). Both unchanged; included in prior configured T2, fresh configured selection pending.
- host-watchdog.test.ts:50 (T3): known host reservation at entries[0] must receive numeric host settlement; no verify unknown producer. Unchanged; T3 deferred.
- host-lease.test.ts:190 (T2): a fresh host-only fixture's failed pre-provider create must leave only numeric-zero cancellations/no pending hosts. Verification unknown receipts are invalid for these rows. Unchanged.
- executor-admission-lock.test.ts:92,99 (T2): exact two owned synthetic shard reservations remain null while release lock is held, then both become numeric on confirmed release-intent processing. No absent actual lease reservation/unknown-history branch. Both checks intentionally assert known fixture settlement; unchanged.
- suite-close.test.ts:73-74,113 (T3): inspects exactly two synthetic reservations before either provider create, then requires all known reserved shards numeric after stopped cleanup. Fresh ledger; no unknown-history enrollment. Unchanged; T3 deferred.
- executor-spend.test.ts entry helper (T1): constructs known/pending rows via parameter cost; unchanged old fixture grammar. Actual unknown coverage is now in executor-lease-index.test.ts (T1) through both observe/migration orders, malformed receipts, status and compaction.
- init-machine.ts raw SpendEntry/SpendLedger and legacyLedger/ledger helpers: types/JSON persistence only, no classifier; callers above own interpretation. Existing two-ledger known rows remain unchanged.
- No fake-provider/model helper has another raw ledger null-as-pending classifier; fake-opencode cost fields are independent LLM usage/price fixtures. Frozen protocol cost message IDs and CLI-usage bytes are unrelated; no fixture byte shape changed.

EVENT CONSUMERS (separate from cost census): executor-droplet-component.test.ts (T2) local SSH enter/recovery and provider-loss controls now filter the exact hold-enter/hold-leave event kinds while retaining counts, order, run, diagnostic and state assertions. The new migration diagnostic may coexist without altering those controls. This file was an omitted event consumer and is now explicitly included.

The failed configured round remains failed/partial. Unchanged T2 readers were exercised only to the extent A-21494 records; later tiers/browser are unexecuted, not borrowed proof. New affected-file receipts will be retained before narrow review.

### impl-1958 · 2026-11-19T02:50:55.194Z

Narrow consumer correction pushed at 147f3ea23cf9aaf2a93f6135336d0bed8feb73b9 (tree8eb536ddb832a1ff8a70f80799a6bc1668be78d3); review request delivered. Exact-head local macOS arm64 Node24.21.0: selected92 T1 files948 pass; affected suite-accounting/executor-droplet-component T2 files52 pass; no failures/skips; full lint/typecheck exit0, lint130 existing report-only findings and zero refusals. A-21503 retains the required dev-pass/head-timeout comparison, minimized red/fixed probe, original and exported hashes, sealed launchers, complete redacted logs and second-pass reader census. All comparison commands closed/drained; scratch roots, instrumentation and staged files removed; worktree clean. T-1994 tracks the separate masked fake-callback failure. Failed configured run18348b69 remains failed/partial. No new configured run until source clear and a new Coordinator window.

### rev-36 · 2026-11-19T02:52:53.832Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1958-source-4
commit: 147f3ea23cf9aaf2a93f6135336d0bed8feb73b9
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear at 147f3ea23cf9aaf2a93f6135336d0bed8feb73b9, tree 8eb536ddb832a1ff8a70f80799a6bc1668be78d3. Full source pass uses the cleared 5f0c2c8c1 production basis and checks the four-file consumer correction; no findings. A-21504 retains the source/census/evidence audit. No production, shared guard, wire, tier or duration changes; no dev merge. Clean HEAD/tree/local origin match.

SSH hold assertions now select exact event kinds while retaining count/order/run/original diagnostic/state checks. Accounting uses shared validated hasUnknownSpend to distinguish pending from terminal unknown, still demands exactly one reservation of0.0625, explicitly retains both refused peers' null unknown receipts, and completes the later fresh acquisition. File-specific guides and the expanded cost-null reader census match these changes.

A-21503 preserves the Coordinator-authorized dev-pass/pristine-head-timeout differential and dirty minimized red/fixed copies, with base/effective-tree and controller/test timeout scopes distinguished. The separate callback-to500 masking defect is T-1994 per fa36ad81. The earlier run18348b69/A-21494 remains failed partial; these local checks do not rewrite it.

Exact new-head local macOS arm64 Node24.21.0 evidence:948 passes in92 T1 files;52 passes in the two affected T2 files; full lint/typecheck reported exit0, refusals0, existing report-only notices. Reviewer checked named four SSH, provider-loss and parallel-acquire positive records, pinned command tiers and all14 exported hashes. Redacted/native/browser limits remain explicit; no configured/later-tier/Web browser acceptance is inferred. Reviewer ran no tests or probes.

C1/C2/C3 remain done but unverified; no criterion verified in this source pass. The Implementer may request a new Coordinator configured-verification window at this fixed head. Final settlement requires same-head owner and exact task/consumer receipts with unexecuted phase limits. A changed head needs fresh source review.
