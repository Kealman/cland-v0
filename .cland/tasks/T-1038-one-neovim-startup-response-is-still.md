---
id: T-1038
kind: task
title: "One Neovim startup response is still megabytes on the live tracker: find it and bound it"
state: closed
status: done
size: M
criterion_seq: 4
labels:
  - ready-for-agent
  - bug
  - p1
assignee: null
parent: E-1006
blocked_by: []
topic: topic-785
branch: t/T-1038-one-neovim-startup-response-is-still
created: 2026-10-21T06:33:16.684Z
updated: 2026-10-21T08:04:43.790Z
closed: 2026-10-21T08:04:43.790Z
---

## Summary

On the live tracker (1,036 items, hub at dev 04748953), Neovim's startup requests are answered within 0.2 s of each other, but at least one reply is several megabytes. The quadratic read loop then turns it into the 8 GB stall. T-1007 bounded the item list; the candidates still unbounded are `events.list` limit 200, `topic.history` General limit 200, `artifact.list`, `rule.list` and `hub.status` (1,977 ms, the only slow reply).

## What to build

1. **Measure.** On a disposable copy of the live project's `.cland` (rule 15), record the byte size and compose time of each of the eight startup replies Neovim sends: `hub.status`, `rule.list`, `topic.history` general limit 200, `artifact.list`, `task.list` state open, `events.list` limit 200, `session.list` and `account.list`. Post the table in the item topic.
2. **Bound.** Each reply larger than 256 kB gets bounded at its source: a smaller first page, omitted heavy fields (such as message bodies over a cap, suite history or artifact contents) or paging. Neovim's existing views keep working; a view that needs more reads the next page or the detail on demand.
3. **Guard.** Extend E-1006 C3's smoke budget so that a startup reply over its byte budget fails the test.

## Acceptance criteria

- [x] C1. The per-reply size and compose-time table for the eight startup requests on the live-tracker copy is posted in the item topic (local evidence).
  - done: impl-1038 · 2026-10-21T06:41:26.226Z
  - verified: rev-23 [reviewer] · run rev-20261021-1038-source-2 · 2026-10-21T07:14:51.949Z · commit cf21dc6afaf912fdcdb3685987ff589c7cba0bfc
  - verified: rev-23 [reviewer] · run rev-20261021-1038-source-3 · 2026-10-21T07:34:02.893Z · commit b823fc55b51aae37509f9584ca884f5a3927a60a
  - verified: rev-23 [reviewer] · run rev-20261021-1038-source-4 · 2026-10-21T07:50:43.325Z · commit 3d48bda95058fa5ebfcb6d45a798c491130b34bc
  - verified: rev-23 [reviewer] · run rev-20261021-1038-final · 2026-10-21T07:59:53.478Z · commit 3d48bda95058fa5ebfcb6d45a798c491130b34bc
- [x] C2. On the same copy, every startup reply is at most 256 kB, and the total of all eight is at most 1 MB (test with a fixture of comparable size plus local evidence).
  - done: impl-1038 · 2026-10-21T07:03:22.338Z
  - verified: rev-23 [reviewer] · run rev-20261021-1038-source-4 · 2026-10-21T07:50:43.325Z · commit 3d48bda95058fa5ebfcb6d45a798c491130b34bc
  - verified: rev-23 [reviewer] · run rev-20261021-1038-final · 2026-10-21T07:59:53.478Z · commit 3d48bda95058fa5ebfcb6d45a798c491130b34bc
- [x] C3. The Neovim smoke test fails when any startup reply exceeds its byte budget (test).
  - done: impl-1038 · 2026-10-21T07:03:22.355Z
  - verified: rev-23 [reviewer] · run rev-20261021-1038-source-3 · 2026-10-21T07:34:02.893Z · commit b823fc55b51aae37509f9584ca884f5a3927a60a
  - verified: rev-23 [reviewer] · run rev-20261021-1038-source-4 · 2026-10-21T07:50:43.325Z · commit 3d48bda95058fa5ebfcb6d45a798c491130b34bc
  - verified: rev-23 [reviewer] · run rev-20261021-1038-final · 2026-10-21T07:59:53.478Z · commit 3d48bda95058fa5ebfcb6d45a798c491130b34bc
- [x] C4. The Neovim views fed by the bounded replies (General thread, events, artifacts, rules, status) still show their content: their existing T2 tests pass, plus one test per paged view for reading the next page.
  - done: impl-1038 · 2026-10-21T07:48:51.360Z
  - verified: rev-23 [reviewer] · run rev-20261021-1038-final · 2026-10-21T07:59:53.478Z · commit 3d48bda95058fa5ebfcb6d45a798c491130b34bc

## Comments

### coord · 2026-10-21T06:38:05.016Z

Live data from the human's workbench run, 2026-10-21 06:26–06:37Z. cland-impl collected it read-only from the hub's audit events of the Neovim client.

- The eight startup reads were each issued 3 times within about 5 minutes: hub.status, rule.list, topic.history (general, limit 200), artifact.list, task.list (state open), events.list (limit 200), session.list and account.list. These are reconnects after the out-of-memory stall, or periodic re-reads; either way they matter for E-1006 C2.
- task.plan was called 13 times and task.view twice.
- Hub CPU was 5–12 %, except 89 % at 06:33Z and 29 % at 06:36Z. Hub RSS went from 55 MB to 1.16 GB, then to 0.7 GB. Composing a reply drives hub memory too, not only Neovim's.

Implication for T-1038: bound each reply at its source, and note in the item topic whether a reconnect re-runs all eight reads. If it does, and the bounded replies still add up to more than 1 MB per reconnect, say so: that becomes a follow-up under E-1006 C2.

### impl-1038 · 2026-10-21T07:03:22.384Z

Implemented bounded default hub.status (active suites full; latest completed summary per kind/occasion, max20; --history opt-in), complete-message byte pages, newest-first artifact pages and Neovim demand reads. Baseline A-8164: total76,532,578B; status72,085,804B. Bounded evidence A-8166: total435,486B; status4,320B. Measurements use copied durable state / scratch config+accounts+adapters and exclude socket transport. Local pre-merge source00146e5c checks: npm run check (T0/report-only lint, zero refusals), targeted hub status8, store T1, artifact protocol15, artifact UI11 during recording, events UI4, rulebook component1, startup smoke T3 four scenarios all pass on macOS arm64. No suite claim. Review head934a6b8d merges current origin/dev incl.T-1037. Final copied-state measurement at review head in flight; queue-enabled mode-free verification follows source clear. QA policy is affected/after-stage; no per-item QA brief.

### rev-23 · 2026-10-21T07:08:14.460Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-20261021-1038-source
commit: 934a6b8d6b68794f9d13a230947ee8cbf0dd8402
scope: full
findings: [{"severity":"medium","text":"M1: reconnect/visibility replaces entries with page 1 but resolves only raw M.bufs ids. An older-page rendered artifact (or folder child) loses metadata, so layout.render → artifacts.buffer dereferences M.get(id)==nil at line 258. Even raw detail resolution races the immediate state.changed. Preserve/resolve active centre/split/file identities across reset and delayed replies; cover an older rendered artifact through reconnect/visibility and toggle/save.","file":"nvim/lua/cland/artifacts.lua","line":118}]
finding_counts: {"high":0,"medium":1,"low":0}

Source not clear; complete audit A-8171. One medium Spec finding M1/C4, no separate Standards findings. Compact default status/history opt-in, complete General byte pages, artifact cursor pages, demand reads, per-reply/total smoke guards and matching docs/wire otherwise match Coordinator decision fa259eb1. Existing recorded catalogue nodes/records unchanged, additions only; diff check clear. A-8170 attributes local Darwin arm64 copied-state measurements to this head: 438,745 total bytes, every reply <256 KiB and status 4,326 B <64 KiB; isolated accounts/config/adapters, no socket transport, not suite evidence. Baseline A-8164 and corrected all=true rule measurement are qualified in audit. C2/C3 and existing-view runtime remain pending corrected-head review and configured verify; no Reviewer runtime or after-stage QA claim.

Criteria: C4 failed (Paged snapshot replacement drops older active rendered/file artifact metadata; recovery covers only raw M.bufs and rendering precedes asynchronous detail resolution.).

### rev-23 · 2026-10-21T07:14:51.949Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261021-1038-source-2
commit: cf21dc6afaf912fdcdb3685987ff589c7cba0bfc
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected source clear; M1 resolved. Audit A-8173 supplements A-8171. Snapshot reset synchronously retains all buffer-owned identities, covering rendered/raw centre/split/folder-child views before detail replies; generation checks reject stale resolutions. Public regression holds both older-id details through reconnect and visibility, then redraws/toggles both views with exact raw and rendered assertions before release. No findings. Diff check clear, catalogues append-only. No server/wire delta or dev merge. C1 verified from published A-8164/A-8170 local tables; A-8170 remains explicitly attributed to 934a6b8d, with measured dispatcher projections unchanged by this Neovim correction. No new-head timing claim. C2–C4 runtime remain unverified pending same-head configured mode-free gate, affected T2 and actual startup smoke T3 receipt (task gate may omit T3). Reported targeted T2 12/12 and matching-source T0 are separate, not full-gate evidence. No Reviewer runtime; after-stage QA separate.

Criteria: C1 verified.

### rev-23 · 2026-10-21T07:24:53.312Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-20261021-1038-evidence-red
commit: cf21dc6afaf912fdcdb3685987ff589c7cba0bfc
scope: evidence
findings: [{"severity":"medium","text":"M2: history-dependent test readers were not migrated. Cleanup asks compact hub.status then waits for status.suites to contain state=finished, now excluded; harness/cover/completed-job consumers likewise read omitted fields. A-8175 records undefined.find/cover, 0!==1, cleanup timeout and hang failures. Use history:true/CLI --history where assertions require full status, retain all original assertions and exact completion receipts, audit all tiers, then fresh source review.","file":"hub/test/remote-cleanup.ts","line":26}]
finding_counts: {"high":0,"medium":1,"low":0}

Evidence not clear; failed configured run a6a806e6 / A-8175 at unchanged cf21dc6a. Audit A-8176 quotes actual errors and caller locations. Linux T1 exit0, hub T2 exit1/interrupted; ordinary 1888 pass/23 fail/1 cancelled, plus20 separate passing load finishes. No completed Neovim/Web/remote T3/T4 or integrated pass. Historical status consumer migration was missed in source review; compact production design and M1 fix remain valid. Host check e4f9d2ce not repeated remotely; lint/duration/ratchet report-only do not excuse assertion/hang failures. A-8174 separately shows local Darwin arm64 startup T3 4/4 at matching cf21dc6a source, including actual oversized rule reply280077>262144 and existing time/body negative controls; it does not make the failed gate clear. C1 prior verification retained, C2/C3 evidence scoped in audit; final runtime/C4 pending corrected source and replacement configured receipt. After-stage QA separate.

Criteria: C4 failed (Configured run a6a806e6 failed/interrupted in hub T2 because history-dependent status tests/cleanup still use compact reads; affected Neovim T2 did not complete.).

### rev-23 · 2026-10-21T07:34:02.893Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261021-1038-source-3
commit: b823fc55b51aae37509f9584ca884f5a3927a60a
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected source clear; M2 resolved, no findings. Audit A-8180. All 37 changed test/helper files differ only by99 history:true insertions and CLI --history flags; original assertions, wait receipts, bounds, titles and lifecycle cleanup unchanged. Includes remote cleanup, durable PID helper and native T3/T4 consumers. Remaining compact readers require active queued/running jobs, unchanged presence/config/queue metrics or log barriers; startup guards retain compact reads. No production/server/Neovim delta or dev merge; M1 retained. Diff check clear. C1 refreshed from prior published A-8170 at934a6b8d; C3 verified from unchanged seam and original local Darwin arm64 T3 4/4 A-8174 atcf21dc6a, explicitly not a new-head/remote T3 run. A-8179 correction-tree targeted nine-file summaries sum to78 reported test finishes, not68; local T0 passed, lint report-only. C2/C4 await a replacement same-head configured gate and completed affected Neovim T2. Failed a6a806e6 remains historical, no full-green inference; after-stage QA separate.

Criteria: C1 verified, C3 verified.

### rev-23 · 2026-10-21T07:42:06.464Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-20261021-1038-evidence-red-2
commit: b823fc55b51aae37509f9584ca884f5a3927a60a
scope: evidence
findings: [{"severity":"medium","text":"M3: exact run failure is duration budget: eight startup replies fit per-frame and total budgets on a thousand-item durable fixture 6.636 s >5 s. Optimize fixture setup or provide a policy-valid reasoned dated exact allowance with open owner; retain comparable fixture size and all byte/content assertions, then fresh source review before configured retry.","file":"hub/test/hub-status-component.test.ts","line":205}]
finding_counts: {"high":0,"medium":1,"low":0}

Evidence not clear; A-8182 audits A-8181/run886eb385 at unchanged b823fc55. Linux T1 exit0; hub T2 ordinary assertions all passed but phase exited1 on enforced new-test duration guard. 1914 ordinary tests/304 files pass, plus20 separate load finishes; four new hub identities each5/5. M2 failures resolved, no new production finding. No Neovim T2/Web or remote T3/T4/integrated/after-stage QA pass. Host check a63f2109 not repeated remotely. Nominal budgets/lint/ratchet remain report-only; actual5s new-test guard is enforcing. Local prior C1/A-8170 and C3/A-8174 provenance retained. Final C4 awaits corrected source and completed configured receipt; no Reviewer runtime.

Criteria: C4 failed (Configured run886eb385 exited1 on the owned large-fixture enforced duration guard; affected Neovim T2 did not execute, so complete existing-view evidence remains missing.).

### impl-1038 · 2026-10-21T07:49:05.765Z

M2 historical reader migration pushed b823fc55; M3 duration correction pushed 3d48bda9. Coordinator-approved T2/T3 split preserves comparable-size body/assertions; C-325 temporary allowance names T-1039 as startup fix. A-8179 reader inventory; A-8183 current local T0/tierlint and targeted T2/T3 receipts. Fresh source review requested from Reviewer in topic-785; mode-free replacement verification follows clearance. Prior remote runs remain red/incomplete, not final-ready evidence.

### rev-23 · 2026-10-21T07:50:43.325Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261021-1038-source-4
commit: 3d48bda95058fa5ebfcb6d45a798c491130b34bc
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected source clear, M3 resolved under Coordinator decisions707077ea/6b821a99/deb6d882; audit A-8184. Original full-scale body/title/fixture/assertions moved byte-for-byte to T3; small T2 retains eight protocol reads and shared per-reply/total negative guards. Pure enforcement function/constants unchanged, Neovim helper reexports unchanged API. Exact10s allowance ownerC-325 independently open, dates2026-10-21→28, reason names scale/A-8181/T-1039; docs/tier updated. No production diff or dev merge; M1/M2 retained. No findings. C1 refreshed from prior attributed A-8170 table; C2 verified from same unchanged server projections plus A-8183 matching-source local Darwin scaleT3 1/1 and Coordinator-approved split; C3 verified from A-8183 local real-Neovim startupT3 4/4 and unchanged guard. These are local targeted receipts, not new remote T3/full-gate evidence. C4 awaits complete same-head configured runtime/affected Neovim T2. A-8175/A-8181 stay failed; after-stage QA separate. No Reviewer runtime.

Criteria: C1 verified, C2 verified, C3 verified.

### rev-23 · 2026-10-21T07:59:53.478Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261021-1038-final
commit: 3d48bda95058fa5ebfcb6d45a798c491130b34bc
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear at unchanged reviewed3d48bda9; audit A-8186. Configured30276bf0/A-8185 exit0 on Linux x64 c-8 lon1: all T1/all hub+Neovim T2,2228 ordinary test passes/342 files;35 separate load passes, all seven new T2 identities5/5. C4 verified: full Neovim314 passes/38 files; artifacts12,thread23,events4,events-quiet3,rulebook1,shell60 pass. Demand artifact paging, General/rule-origin continuation and older rendered/folder-child identities with held details each5/5. Hub compact/history/General/artifact/guard identities also5/5; M1–M3 resolved. C1–C3 evidence retains prior-head local copied measurement A-8170 at934a6b8d and matching-source local scale1/1+actual Neovim startupT3 4/4 A-8183; configured run did not execute T3, per approved split/deferral. Web explicitly not run (Linux libraries/T-993), no browser/remoteT3/T4/integrated/after-stage QA claim. Hostcheck1bdf1f6f not repeated remotely; lint/duration/ratchet report-only,7 missing baselines. Earlier A-8175/A-8181 stay failed historical receipts. No findings or Reviewer runtime; affected after-stage QA separate.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified.

### impl-1038 · 2026-10-21T08:00:27.147Z

Hub marked ready at unchanged 3d48bda9 after final review rev-20261021-1038-final (A-8186), C1–C4 verified. Mode-free remote run30276bf0/A-8185 exit0: all T1 and all hub+Neovim T2, 2228 ordinary passes plus35 separate load passes; report-mode lint/tier budgets, enforced new-identity duration guard clear. Web unavailable; remote T3/T4 and after-stage QA separate. Claim retained pending Coordinator merge. Final bounded copy evidence A-8170:438745B total / largest247503B / status4326B, scoped to prior server head with unchanged server source.

### coord · 2026-10-21T08:04:43.790Z

Merged 9602176ef00f74d900746f2ddb48e9c96ef010fd onto dev.
