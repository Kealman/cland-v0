---
id: T-1781
kind: task
title: Snapshots as backups, and `cland login snapshot`
state: closed
status: done
size: L
criterion_seq: 6
labels:
  - ready-for-agent
assignee: null
parent: E-1535
blocked_by:
  - T-1777
topic: topic-1464
branch: t/T-1781-snapshots-as-backups-and-cland-login
created: 2026-11-09T12:44:10.095Z
updated: 2026-11-10T10:09:30.956Z
closed: 2026-11-10T10:09:30.956Z
---

## Summary

Snapshots become backups: one after each sign-in, and one at most daily while a login is in use, taken under `fsfreeze`. Only the last two are kept. A host stop never waits for one: a snapshot due at release is taken of the detached volume afterwards, and a provider rate limit defers it to the retry time. `cland login snapshot <name>` takes one on demand.

## What to build

A snapshot scheduler on the hub clock:
- An in-use login gets a daily timer from its last snapshot. Its snapshot runs `loginDisk freeze`, then `snapshotVolume`, then `loginDisk thaw`; the thaw runs even when the snapshot fails.
- A detached volume is snapshotted directly.
- After a new snapshot is confirmed, the hub deletes the older ones beyond two, each with a confirming read, and keeps the ids on the row.
- A refusal with a retry time (DigitalOcean allows one snapshot per volume per 10 minutes) is retried at that time and never blocks a release.
- A snapshot pending at a hub stop resumes from the row at the next start.

T-1777's after-sign-in snapshot goes through this module. The `login.snapshot` frame and `cland login snapshot` are added.

## Acceptance criteria

- [x] C1. A successful sign-in leaves exactly one snapshot, and a third snapshot of a login deletes the oldest, leaving the last two ids on the row (test).
  - done: impl-1781 · 2026-11-10T08:18:17.067Z
  - verified: rev-36 [reviewer] · run rev-36-1781-final-1 · 2026-11-10T08:52:59.971Z · commit c0c3433dfabaa3246ead1c5f19bb5151eb5fb330
  - verified: rev-36 [reviewer] · run rev-36-1781-final-2 · 2026-11-10T09:30:33.121Z · commit e82955b062a3ad409869889e1dd9c51d7d2d0416
- [x] C2. On the hub clock, an in-use login is snapshotted once per 24 h under freeze and thaw, and its disk is thawed when the snapshot fails (test).
  - done: impl-1781 · 2026-11-10T08:18:17.345Z
  - verified: rev-36 [reviewer] · run rev-36-1781-final-1 · 2026-11-10T08:52:59.971Z · commit c0c3433dfabaa3246ead1c5f19bb5151eb5fb330
  - verified: rev-36 [reviewer] · run rev-36-1781-final-2 · 2026-11-10T09:30:33.121Z · commit e82955b062a3ad409869889e1dd9c51d7d2d0416
- [x] C3. A host stop with a snapshot due completes its deletion first, and the detached volume is snapshotted afterwards (test).
  - done: impl-1781 · 2026-11-10T07:52:30.187Z
  - verified: rev-36 [reviewer] · run rev-36-1781-final-1 · 2026-11-10T08:52:59.971Z · commit c0c3433dfabaa3246ead1c5f19bb5151eb5fb330
  - verified: rev-36 [reviewer] · run rev-36-1781-final-2 · 2026-11-10T09:30:33.121Z · commit e82955b062a3ad409869889e1dd9c51d7d2d0416
- [x] C4. A rate-limited snapshot is retried at the provider's retry time and not before, and no host stop waits for it (test).
  - done: impl-1781 · 2026-11-10T07:52:30.525Z
  - verified: rev-36 [reviewer] · run rev-36-1781-final-1 · 2026-11-10T08:52:59.971Z · commit c0c3433dfabaa3246ead1c5f19bb5151eb5fb330
  - verified: rev-36 [reviewer] · run rev-36-1781-final-2 · 2026-11-10T09:30:33.121Z · commit e82955b062a3ad409869889e1dd9c51d7d2d0416
- [x] C5. `cland login snapshot <name>` snapshots a ready or in-use disk login, and is refused for a key login naming that it has no disk (test).
  - done: impl-1781 · 2026-11-10T08:29:23.016Z
  - verified: rev-36 [reviewer] · run rev-36-1781-final-1 · 2026-11-10T08:52:59.972Z · commit c0c3433dfabaa3246ead1c5f19bb5151eb5fb330
  - verified: rev-36 [reviewer] · run rev-36-1781-final-2 · 2026-11-10T09:30:33.121Z · commit e82955b062a3ad409869889e1dd9c51d7d2d0416
- [x] C6. A snapshot due while the hub is stopped is taken after the next start (test).
  - done: impl-1781 · 2026-11-10T08:07:07.465Z
  - verified: rev-36 [reviewer] · run rev-36-1781-final-1 · 2026-11-10T08:52:59.972Z · commit c0c3433dfabaa3246ead1c5f19bb5151eb5fb330
  - verified: rev-36 [reviewer] · run rev-36-1781-final-2 · 2026-11-10T09:30:33.121Z · commit e82955b062a3ad409869889e1dd9c51d7d2d0416

## Blocked by

- T-1777

## Notes

- Hot files: `hub/src/host/login-snapshots.ts` (new), `hub/src/host/login-signin.ts` (the after-sign-in call), `hub/src/host/logins.ts` (snapshot ids), `hub/src/cli/login.ts` (`snapshot`). Registration points: `hub/src/protocol.ts`, `hub/src/hub/dispatch.ts`.
- Tests: new `hub/test/login-snapshots.test.ts` (T2, fake clock, the fake provider's `snapshotWindowMs`).
- Serves epic C3.

## Comments

### impl-1781 · 2026-11-10T07:46:41.873Z

Rule-20 sweep: A-18303 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-18303-t-1781-transitive-consumer-sweep.json) lists 688 transitive suite consumers and 15 unknowns counted as reached. Explicit consumers: host logins/records/login-signin/login-add and provider provider/fake/digitalocean/registry; CLI login/login-terminal/usage/help/socket-client; protocol, dispatch, web-authority, shared/wire; login-records/signin/list/add/add-component/host-pin/terminal tests, provider contract/volume tests, docs/hub/logins and host-providers, session-permissions, implement skill, QA E-1533 and E-1535-stage-1. Shared seams: additive optional backup metadata and LoginRecords notification/update API; new login.snapshot frame; shared snapshotLoginDisk sign-in hook; scheduler registration and read-only binding resolution. Existing row and frame fields retained; old metadata rows remain valid. No binding mutations or other lanes logic edits. Registration entries are additive only in protocol, dispatch, web-authority and help.

### rev-36 · 2026-11-10T07:57:54.962Z

verdict: review
result: not clear
by: rev-36 [reviewer]
run: rev-36-1781-source-1
commit: 466f32b5ddf88daef6561e83ca98bd3bc75be173
scope: full
findings: [{"severity":"medium","text":"ownDirectory is registered before raw t.after DB/scheduler closes, and replacement schedulers also bypass shared resource cleanup. Active work can outlive root/storage on failure; guide's join ordering is not established. Author confirms no omitted owner. Prearm shared attempt-all scheduler-before-DB-before-directory cleanup and a held-operation early-failure control.","file":"hub/test/login-snapshots.test.ts","line":17},{"severity":"high","text":"Freeze that takes effect then rejects leaves frozen=false and skips thaw; successful snapshot can clear backup.pending before thaw, losing required native recovery on crash/incomplete thaw. No durable freeze/thaw owner exists (author confirms). Persist intent and completed snapshot/thaw progress through positive settlement; cover effect-then-error and restart/held-thaw, without blindly repeating snapshots.","file":"hub/src/host/login-snapshots.ts","line":26},{"severity":"high","text":"Captured resolve/writer/host target is not revalidated across inventory/freeze/provider awaits before effects or metadata writes; release/rebind can change ownership. Author confirms no other serializer/fence. Add target authorization checkpoints/held-await tests and coordinate a release-admission seam with T-1779; deferred T-1778 phase support does not supply this fence.","file":"hub/src/host/login-snapshots.ts","line":74},{"severity":"medium","text":"In-use legacy row with no backup.lastAt and null lastSignIn computes now+DAY on every evaluation, including the callback, and never snapshots. Type permits it; no invariant excludes it (author confirms). Persist an initial deadline/reference and cover null-timestamp clock/restart behavior.","file":"hub/src/host/login-snapshots.ts","line":51}]
finding_counts: {"high":2,"medium":2,"low":0}

Consolidated A-18309: Standards1medium/Spec3(2high,1medium); all four gaps confirmed in d1b26dd2/56102afe. No runtime criteria verified. Approved rate-refusal sign-in and release-hook-only/T-1779 scope preserved. Coordinate any release-admission/pending-phase merge; fix then fresh source review before mode-free verify. A-18307 remains narrative candidate/local evidence, A-18303 inventory not execution proof; retain available original producers/freshness limits and normalize consumer dispositions. Recording fixtures alone do not prove ordinary catalog execution. Remaining full T3/T4/after-stage QA separate; no full task-head T3 run requested.

Criteria: C2 failed (Freeze uncertainty and incomplete/crashed thaw lack a durable recovery obligation.), C6 failed (Timestamp-less valid in-use rows perpetually move their daily deadline forward and never back up.).

### impl-1781 · 2026-11-10T08:04:02.319Z

Review remediation extends rule-20 persisted-record sweep: optional backup.freeze (host, target identity, volumeId), receipt, releasing and initialAt are read/written only through LoginRecords and LoginSnapshots; production dispatch resolver captures provision/registration/host identity, and sign-in helper delegates authorization. Existing JSON/SQLite row readers remain additive-compatible. All graph and explicit consumers from A-18303 remain in scope; no old field removed. beginRelease is the approved T-1779 integration seam; no release logic edited.

### rev-36 · 2026-11-10T08:11:37.107Z

verdict: review
result: not clear
by: rev-36 [reviewer]
run: rev-36-1781-source-2
commit: 75a3ae65ebf311a268ffcffaad330440e5d0bf1a
scope: full
findings: [{"severity":"high","text":"beginRelease can thaw independently while snapshotVolume still awaits provider serialization/GET/API pacing; its eventual POST has no actual-send release authority guard. Outer authorize checks cannot prevent an unfrozen late effect. Author confirms. Coordinator d11ede81 approves narrow optional pre-send authorization/not-sent seam, both-provider contract and queued successful send-after-release regression.","file":"hub/src/host/login-snapshots.ts","line":61},{"severity":"high","text":"Old in-flight receipt can be checkpointed onto a login whose volume changed; retained receipt is then accepted without checking receipt.volumeId and can populate new-volume history on restart. No invariant excludes replacement; author confirms. Validate retained volume identity and forbid checkpointing old outcomes onto changed-volume rows, with race/restart controls.","file":"hub/src/host/login-snapshots.ts","line":45}]
finding_counts: {"high":2,"medium":0,"low":0}

Source-2 A-18312: Standards0 remaining/Spec2high. Earlier durable thaw ownership, row/host outer-await checks, persisted legacy anchor and shared cleanup improvements are present; no runtime criteria verified. Approved L/additive release scope, T-1779 callers, deferred T-1778 phase integration and separately filed cland-auth.sh idempotency defect preserved. Extend snapshotVolume callers/implementations sweep and retain original producers/freshness limits; A-18310 remains narrative local candidate evidence. Fix both, fresh source review before verify; no full task-head T3 or provenance-only rerun requested, batch/T4/after-stage QA separate.

Criteria: C1 failed (Retained old-volume receipt can be published into a changed login volume's snapshot history.), C2 failed (Queued provider snapshot may send after release has thawed/deleted/detached because actual send lacks the release fence.).

### impl-1781 · 2026-11-10T08:16:48.711Z

Provider send seam sweep (Coordinator approval d11ede81): snapshotVolume callers are LoginSnapshots plus shared host-provider-contract, host-provider-{volumes,digitalocean-volumes}, and login-snapshots fixtures; implementations are FakeHostProvider and DigitalOceanHostProvider. DigitalOceanApi.volumeSnapshot sole production caller is DigitalOceanHostProvider, now forwarding optional MutationScope; existing API pacing users remain unchanged. QA E-1533 calls snapshotVolume without options and retains prior behavior. Optional synchronous authorization and additive not-sent outcome preserve omitted-options behavior; sign-in and CLI explicitly handle the new non-success state. Provider/API/logins transitive graph now 704 reached plus 15 unknowns counted reached (new artifact). Persisted receipt readers validate volume identity; updateCreatingDisk refuses volume replacement while snapshot ownership is retained. Existing consumer/old-wire dispositions from A-18303 remain.

### rev-36 · 2026-11-10T08:21:16.117Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1781-source-3
commit: a1742323f4eea61bc991049273183c40da0ececa
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected source clear A-18322; Standards/Spec0 findings. Optional synchronous provider authorize reaches DO actual POST after GET/pacing via MutationScope and fake copy edge; defined not-sent handled by scheduler/CLI/sign-in. Both-provider positive/refusal contract, actual POST-pacing and queued successful-send-after-release controls present. Retained/new receipt volume checks, guarded outcome checkpoints and replacement fence resolve foreign-volume history defect. Earlier durable thaw/host ownership/legacy anchor/resource cleanup fixes remain. No runtime criteria verified. Coordinator-approved seam/L/release scope retained; T-1779 callers and authorized T-1778 phase merge remain separate. Submit mode-free exact-head verify; normalize A-18318 graph tiers and reconcile named/file receipts/provenance. A-18321 remains narrative candidate/local evidence, earlier native/catalog freshness limits retained. Full remaining T3/T4/after-stage QA separate; no full task-head T3 or provenance-only run requested.

### rev-36 · 2026-11-10T08:22:34.605Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1781-source-4
commit: 90edf3560d81aadddb69f7be1b00e0cc61e141a9
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-18323 source delta clear: exactly adjacent manifest entries reordered lexically; both T2, no membership/runtime/test/docs changes. Branch ref matches90edf356. A-18322 source analysis/dependency limits retained. Prior submission was pre-run refusal, no runtime receipt. Submit mode-free verify here; no criteria verified until same-head named/file/provenance evidence. Remaining T3/T4/after-stage QA separate.

### rev-36 · 2026-11-10T08:29:05.003Z

verdict: review
result: not clear
by: rev-36 [reviewer]
run: rev-36-1781-evidence-1
commit: 90edf3560d81aadddb69f7be1b00e0cc61e141a9
scope: evidence
findings: [{"severity":"medium","text":"A-18324 run297a9599 fails cli-usage-compatibility's actual deepStrictEqual: production LOGIN_USAGE adds login snapshot but frozen row still starts login list. Migrate only the approved LOGIN_USAGE row and obtain fresh source/configured evidence; no shared-defect or advisory-only classification.","file":"hub/test/fixtures/cli-usage/commands.json"}]
finding_counts: {"high":0,"medium":1,"low":0}

A-18325 records independently read failure at same source-clear head90edf356. Exit1, T0passed/T1failed; completed1743/1742pass1fail, no full runtime pass. T2/Web/snapshot runtime unexecuted, no criteria verified. Linuxx64 kernel147 Node24.21/Nvim0.12.5 uncached tree3156a342, browsernull. Report-only duration/lint are separate. Correct approved golden row, fresh source delta before a fresh mode-free run; current red preserved.

Criteria: C5 failed (Configured T1 fails the new snapshot command's frozen usage contract; runtime T2/Web acceptance is unexecuted.).

### impl-1781 · 2026-11-10T08:29:06.161Z

Verification297a9599 at90edf3560 failed the T1 command-help golden: all command usage exports retain their pre-refactor bytes. T0 passed; T2 and Web did not run. Exact mismatch isolated to LOGIN_USAGE prefix; Coordinator confirms this is an owning-row golden update, not shared defect. Updated only LOGIN_USAGE in fixtures/cli-usage/commands.json, preserving blank separators, exports.json and help.txt composition. Local cli-usage-compatibility T1 + cli-help T2 pass10/10. These frozen-data consumers are explicit rule-20 additions/dispositions; prior transitive graph already reaches their test importers. Fresh source delta review required before resubmission.

### rev-36 · 2026-11-10T08:29:42.613Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1781-source-5
commit: c0c3433dfabaa3246ead1c5f19bb5151eb5fb330
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source delta clear: exact one LOGIN_USAGE golden row gains shipped login snapshot line; unrelated fixture/runtime/test bytes unchanged, branch matches. Repairs A-18324 expected/actual mismatch. Source analysis A-18322/A-18323 retained. Failed297a9599 remains failed; local author-reported10/10 not Linux proof. Fresh mode-free verify unchanged required; no runtime criteria verified. Remaining T3/T4/after-stage QA separate.

### impl-1781 · 2026-11-10T08:30:40.849Z

Normalized rule-20 disposition correction: QA E-1533.md line323 has an exact historical snapshotVolume signature guard. Coordinator decision31d13701: historical, not replayed; pinned closed-epic evidence is never replayed against later heads. Keep the single optional-options signature and leave that brief unchanged; no overload. If automated committed-brief corpus checks fail, quote output and stop for Coordinator. Existing omitted-options runtime callers remain compatible separately. Source c0c3433df unchanged and cleared.

### impl-1781 · 2026-11-10T08:52:12.731Z

Configured exact-head evidence: c0c3433df, ed56a54c/A-18333 green5825/5825 T0,T1,T2 fallback-all,Web on Linux droplet; no skips/cache. Final provenance/source-consumer disposition artifact A-18338, named completion receipts A-18334, normalized graph dispositions A-18336 (473 completed +246 T3/T4 deferred;15 unknown graph nodes counted reached). All23 snapshot +1CLI +3provider new cases have base+5 passing name-only repetitions. Previous297a9599 remains failed. Full T3 merge-batch, T4/QA stage occasions, and original macOS native producer limits remain explicit. Final Reviewer evidence verdict requested at unchanged head.

### rev-36 · 2026-11-10T08:52:59.972Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1781-final-1
commit: c0c3433dfabaa3246ead1c5f19bb5151eb5fb330
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final evidence clear A-18339; C1–C6 verified within approved release-seam scope. Independently parsed all23 snapshot+1CLI+3provider new identities, each base+5pass (162pass finishes), max1.017575182s. Current runed56a54c/A-18333 exit0/5825pass/zero fail-cancel-skip-todo; T0/allT1/fallbackallT2/Web complete, T3/T4 unexecuted. Independently reconciled719 graph paths:81T1+340T2+52Web=473passing base file finishes,246T3/T4 deferred. Sign-in5, add-component5, list2, DO17, fake15, pacing24, corrected usage1 pass. Uncached Linuxx64 kernel147 Node24.21/Nvim0.12.5, tree36aa8301, HeadlessShell1248/CfT156, skips[]/missing0. Source A-18327/A-18322 retained. C3/C4 establish approved release-owner seam, not T-1779 actual callers; authorized T-1778 phase integration, known shared thaw defect, earlier native/catalog capture limits and historical QA disposition retained. Prior297a9599 remains failed; report-only advisories separate. Full T3/batch,T4,after-stage QA pending; no further task run requested.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified.

### impl-1781 · 2026-11-10T09:05:22.638Z

Coordinator-authorized dev integration e82955b06 merges landed T-1783/a6d28fd1e. Resolved only docs appended-section conflict and owning LOGIN_USAGE golden conflict, retaining key and snapshot usage; auto-merged CLI/dispatch have one registration for each behavior. Local merged-tree T1/T2 login/key/snapshot/help batch83/83, native login-add1/1 +login-terminal2/2 in preservation slot, full repo typecheck and tier-map lint pass. A-18346 records exact scope and limits. Old ed56a54c green is prior-head only; fresh delta review then mode-free verify required. All criteria done marks retained; old verified marks correctly stale.

### rev-36 · 2026-11-10T09:06:19.380Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1781-delta-source-1
commit: e82955b062a3ad409869889e1dd9c51d7d2d0416
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Authorized merge delta source clear: parentsc0c3433d+a6d28fd1e verified. Both docs/help lanes and CLI/dispatcher registrations retained once; snapshot scheduler/provider/API/sign-in/rows unchanged from own prior clear, landed key path retained. No new findings or runtime marks. A-18346 local merged-candidate reports qualified; old greened56a54c is prior-head only. Submit fresh mode-free verify unchanged and refresh named/file/consumer/provenance facts. Approved release/T-1779/pending-phase T-1778/shared-thaw and T3/T4/after-stage boundaries retained.

### impl-1781 · 2026-11-10T09:27:41.896Z

Merged-head e82955b06 verification bbb02ecf/A-18352 green5833/5833, T0+Linux T1/T2 fallback-all/Web complete. Refreshed named receipts A-18353, current graph/normalized dispositions A-18354 (705+15unknown,474 completed+246 T3/T4 deferred), final evidence note A-18355. All27 new identities base+5 passing repetitions; key6 and secret-resolution3/secrets7 cases complete. Full T3 batch/T4/after-stage QA remain deferred; actual T-1779 release callers and Coordinator-directed T-1778 phase integration remain outside current scope. Final same-head Reviewer evidence verdict requested.

### rev-36 · 2026-11-10T09:30:33.121Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1781-final-2
commit: e82955b062a3ad409869889e1dd9c51d7d2d0416
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Merged-head final evidence clear; C1–C6 verified. A-18356 records the independent review of bbb02ecf/A-18352: 5833/5833 passing, zero failures/cancellations/skips, T0/all T1/fallback all T2/Web complete. All 27 new snapshot/CLI/provider identities have base plus five passing repetitions; all six inherited key-login cases pass. Refreshed graph accounts for 474 passing lower-tier/Web files and 246 explicitly deferred T3/T4 files. Source clearance A-18347 remains applicable at unchanged e82955b0. Report-only advisories retained; full T3/T4, agreed cross-task integrations and affected after-stage QA remain separate. Prior failed 297a9599 remains red. See A-18356 for provenance and qualified local-native evidence limits.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified.

### coord · 2026-11-10T10:09:30.956Z

Merged 0e4ab826cb8626cb20ecf46058f4c4b3a2164d9e onto dev.
