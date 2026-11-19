---
id: T-1960
kind: task
title: "artifact-lifecycle.test.ts never exits on macOS after T-1950: every test passes, then the process stays alive, so every local macOS cover stalls in T2"
state: closed
status: done
size: S
criterion_seq: 3
labels:
  - ready-for-agent
assignee: null
parent: E-1883
blocked_by: []
regression_of: T-1950
topic: topic-1618
branch: t/T-1960-artifact-lifecycle-test-ts-never-exits
created: 2026-11-18T06:49:04.433Z
updated: 2026-11-19T06:16:41.590Z
closed: 2026-11-18T09:16:43.444Z
---

## Summary

The E-1883 stage-1 macOS cover 34ba2b0d (local darwin arm64, 1 worker, dev 303b482b8, A-21068) stalled in T2: `hub/test/artifact-lifecycle.test.ts` printed its last test and then produced no output for 10 minutes (`stalled: no output for 10 min; command exit pending; stdout open; stderr open`; live node pids 86106, 86838, 92718). Run alone on this Mac the file reproduces the hang deterministically, and a bisect in a detached worktree names T-1950 (91d59bbe8). Its tests pass (one case fails intermittently, a different one each run), but the node process never exits. The Linux droplet cover 053dc5d6 at the same tree passed the file.

## Evidence

Bisect, one run each of `node --test hub/test/artifact-lifecycle.test.ts` in a detached worktree, local darwin arm64, Node v24.21.0, coord, 2026-11-18 06:40–06:50Z:
- ca5f70ca4 (last green macOS cover b9aa8554): 37/37 pass, exits in 5 s.
- 54e153e08 (T-1951), 5718742e4 (T-1954) and 6d2b1231a (T-1947): 37/37 pass, exit in 6–7 s.
- 91d59bbe8 (T-1950): killed by a 120 s alarm, twice. In one run, 32 cases passed and "a failed promotion rollback names the unindexed copy when both the index and filesystem refuse writes" failed.
- 303b482b8 (tracker commit on top): killed by a 120 s alarm, twice.
- In the cover, "manual-delete rollback retries failed backup housekeeping after exclusive file restoration" failed (80 ms) before the stall.

The file starts hubs through the harness (`startHub`, `inProcessSpoke`). It doesn't import T-1950's `no-sync-filesystem.ts`, so the suspects are T-1950's hub-side changes, such as a lease-index compaction timer, watcher or migration handle that hub stop doesn't close, or its changed test helpers.

## Acceptance criteria

- [x] C1. The handle that keeps the process alive is named with evidence (for example `process.getActiveResourcesInfo()` or an after() leak report), and hub stop closes it (test).
  - done: impl-1960 · 2026-11-18T07:24:53.216Z
  - verified: rev-35 [reviewer] · run rev-35-1960-evidence-1 · 2026-11-18T08:13:02.785Z · commit 5749818fe0b9ca46fbf4932db4dd221737ab01ff
- [x] C2. `artifact-lifecycle.test.ts` exits on its own after its last test on macOS, 5/5 runs alone, and the intermittent case failures are explained or fixed (evidence).
  - done: impl-1960 · 2026-11-18T07:24:53.509Z
  - verified: rev-35 [reviewer] · run rev-35-1960-evidence-1 · 2026-11-18T08:13:02.785Z · commit 5749818fe0b9ca46fbf4932db4dd221737ab01ff
- [x] C3. A guard fails any harness hub that leaves a live timer, watcher or handle from the lease index after stop, so the next such leak is caught on Linux too (test).
  - done: impl-1960 · 2026-11-18T07:43:38.283Z
  - verified: rev-35 [reviewer] · run rev-35-1960-evidence-1 · 2026-11-18T08:13:02.785Z · commit 5749818fe0b9ca46fbf4932db4dd221737ab01ff

## Comments

### impl-1960 · 2026-11-18T06:59:33.509Z

Diagnosis and red/green evidence: A-21096. Consumer inventory A-21097 lists 821 field/function/import matches across hub/test, nvim/test, web/test, shared, test-support, docs and skills. startHub, inProcessSpoke, hubResources and guardDirectoryRemoval keep their signatures; production and wire contracts unchanged. All consumers retain explicit close compatibility; root-bearing startHub callers gain pre-removal closure and a post-stop resource assertion. inProcessSpoke already uses ordered onCleanup. Only artifact-lifecycle registers its separately created socket edge and second SQLite connection differently. Pending filesystem request accounting also applies to projectHub and existing hubResources users; their own fake-harness tests pass. Frozen help bytes, startup wire probes and tier assignments are unaffected.

### impl-1960 · 2026-11-18T07:01:24.106Z

Final local lint receipt: npm run test:lint exited 0, test lint refusals 0. Advisory output retained: 130 report-only findings in 63 files; Site import boundary missing ../scripts/capture-safety.ts; CLI install baseline T-1484 TypeScript dependency; build guard tiers report-only web/build.ts. Sequential T1 consumer checks paused after 6 files when load1=20.572; each completed file started below 20. Typecheck final run now admitted at load below 20. Original red and 5/5 natural exits are in A-21096.

### impl-1960 · 2026-11-18T07:07:39.620Z

Evidence/census corrections during pinned review (no source edit or new experiment): A-21103 supplements A-21096 with retained exact invocations, native completions, diagnostic natural exits, literal ENOTEMPTY/active-handle excerpts, source epochs and missing hash/scan controls. A-21097 omitted qa/; A-21105 lists and assesses the 16 matching QA briefs, including indirect resource census effects and login owner root retention. The previous 'all consumers' claim was incomplete. Rejected-close caching, drained-after-error, and absent whole-callback ownership are conceded gaps; holding correction for consolidated review verdict.

### rev-35 · 2026-11-18T07:10:34.012Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1960-source-1
commit: 64d9b38bb0737160eb33b72847606ef0239bbeea
scope: full
findings: [{"severity":"medium","text":"Standards/rules9/12/42: three new callbacks have no pre-acquisition whole-callback owner or separate setup bound. The timer control at43 enters finally only after await startHub, so startup rejection can bypass clearInterval. Pre-enroll normal/signal ownership, adopt/join late root/hub/timer work before disposal; retain product/root/leak assertions. Confirmedf693b26c.","file":"hub/test/fake-harness.test.ts","line":19},{"severity":"medium","text":"Standards/rules12/20/41: closing permanently caches a rejected promise and suppresses later recovery/root-guard retries. Reset alone is insufficient because hubResources.check:28 disables hook/scope before asserting, preventing a fresh trustworthy drain after failure. Share in-flight/cache positive completion, preserve/reestablish observation until positive drain, cover failed-close→retry and inventory negative/retry consumers. No approved contract/disposition; confirmedf693b26c/f239477c.","file":"hub/test/harness.ts","line":75},{"severity":"medium","text":"Standards/rules12/39/42: resources.check success sets drained=true even if original close failed, so root guard at83 can authorize deletion without a positive owner-close receipt. A sampled empty resource table is not ownership completion. Test real ownDirectory refusal/retained root across rejected close, then confirmed recovery/removal, preserving sibling guard attempts and original errors. Confirmedf693b26c.","file":"hub/test/harness.ts","line":78}]
finding_counts: {"high":0,"medium":3,"low":0}

A-21107 full source review at Git treee39e1862e982d0d8eb6bb10293ad892b57004163 / fixed base303b482b82f898df49c31449b70417880005152f: Standards3medium,Spec0 independent. Intended successful-path barrier/ordered fixture cleanup addresses observed hookFailed ENOTEMPTY with TCPServerWrap resources; all artifact assertions retained. A-21103 qualifies original/diagnostic exit142 incomplete runs, two diagnostic37/37 natural exits and final precommit5×37/37 success before alarm30, source ordering/native/hash limits. C1/C2 positive local support retained but runtime unverified; C3failed on new failure-path proof.19selectedT1files196named/aggregate pass independently parsed; T2fake-harness9/T3process-cleanup69 reported; full lint/typecheckexit0/zero refusals130advisory. A-21097 omitted16QAbriefs; additiveA-21105 now distinguishes those consumers without justifying failed-close semantics. No configured/Linux fresh guard/browser/provider evidence. Consolidate correction/fresh clean-head source review before verify; retain priorN5sourceepoch and follow Coordinator native capacity for affected confirmation. Reviewer static reads only; hold released.

Criteria: C3 failed (New guard/tests lack whole-callback ownership, recoverable resource observation and a positive original-close receipt before root removal.).

### impl-1960 · 2026-11-18T07:20:43.315Z

Consolidated correction committed as 606fada47ed8413355be76459270b5210527cd19 (tree bbd3e6370b1565947c6a0fc94930016f52a82a4d), test-only; no hub/src diff. M1: caseDeadlines normal/signal whole-callback ownership and named setup/behavior waits enrolled before all new root/hub/timer acquisition; late hub assignment stays inside original producer and cleanup is enrolled before awaiting it. M2: failed close releases only the in-flight cache; successful native close is retained separately while observer stays active on resource failure. check's four observer turns run outside owned scope. M3: root guard always joins full close; resource sampling cannot mark owner closed. Actual ownDirectory refusal, retained root, sibling attempt and recovered removal are asserted. Original registered-adapter negative test uses direct createHub, with known typed fixture error, both adapter disposal receipts, actual Store close receipt, native close settlement and a resource check; disposal registered before acquisition and bound as root guard. Broader production duplicate-close defect filed by Coordinator as T-1961, excluded here.

### impl-1960 · 2026-11-18T07:25:14.881Z

Fresh clean-head review requested at 606fada47, tree bbd3e6370b1565947c6a0fc94930016f52a82a4d. A-21114 retains final corrected-head test/lint/typecheck receipts, exact command/native source epoch facts, earlier red and failed correction attempts, and a positively controlled publication scan. Final artifact5/5 (37 pass each) and harness11/11 have native exit0; affected T1 consumers196/196 across19files; full lint0/refusals0 and full typecheck0. A-21112 records shared helper retry/negative-close dispositions. No production changes ship; native duplicate-close follow-up is T-1961. Configured verification has not been submitted.

### rev-35 · 2026-11-18T07:34:14.772Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1960-source-2
commit: 606fada47ed8413355be76459270b5210527cd19
scope: full
findings: [{"severity":"medium","text":"The three new manual-removal roots (:27/:40/:96) are acquired through raw t without adoption inside their original producer. Cleanup snapshots directory steps before awaiting the whole-case owner; cancellation can register these roots after the snapshot, leaving late acquisition unremoved. Use captured/adopted outer fixture parents and separate child subject roots, retaining the parent until original callbacks and resources join (A-21120 final bounded bar).","file":"hub/test/fake-harness.test.ts","line":27}]
finding_counts: {"high":0,"medium":1,"low":0}

Full reworked source pass: Standards 1 medium, Spec 0; M2/M3 resolved. A-21120 records the final bounded correction bar per Coordinator 58f83303, retained positive 5×37 artifact/11 harness/196 T1 receipts and explicit epoch/provenance limits. C1/C2 remain qualified positive local evidence, not configured verification. No production/larger ownership expansion requested. Pin released by verdict; fresh clean pushed corrected head needs source review before configured verification.

Criteria: C3 failed (The three new root/guard controls do not yet retain late root acquisition through cancellation and whole-case cleanup; see M1 and A-21120.).

### impl-1960 · 2026-11-18T07:36:02.307Z

Final bounded M1 correction: 3e991caee3c6df154aeef70c10c020420f86f2aa, tree2aeefd9e961623ee72e83b2b776dffdc30f41840. Delta from606fada47 is only fake-harness.test.ts (16 additions/4 deletions). Three manual-removal subjects now live beneath captured/adopted outer parents, adopted inside original acquisition producers. Parent/child acquisition hooks use run.fixtures, so cleanup's captured hook runs after callback join and sees late directories. Existing hub cleanup or guard reset is enrolled before parent acquisition; child has subject owner guards without whole-callback self-join. M2/M3 observer/positive-close behavior and direct negative receipts are unchanged. No production or broader root migration.

### rev-35 · 2026-11-18T07:42:01.174Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1960-source-3
commit: 3e991caee3c6df154aeef70c10c020420f86f2aa
scope: full
findings: [{"severity":"medium","text":"The two resource-bearing outer parents guard callback/acquisition join but not positive hub closure. Captured cleanup continues after hub.close rejects, and parent-first recursive removal bypasses the child's rejecting guard. Keep these new parents behind the positive stop barrier too; no broader helper/production migration required. A-21123.","file":"hub/test/fake-harness.test.ts","line":28}]
finding_counts: {"high":0,"medium":1,"low":0}

Full review of 3e991caee: Standards 1 medium, Spec 0. Late acquisition corrected; single remaining failure is Coordinator bar point 3. Four-part final bar confirmed to Coordinator dffdb9ac. A-21122 positive 11/11 and 37/37 local runs retained with exact source epochs; prior five-run/T1 evidence remains at606. C1/C2 positive local evidence retained, no configured verification claimed. A-21123 settles this source only; reported successor5749818fe is not reviewed here. Pin released; successor needs fresh request/check evidence.

Criteria: C3 failed (New resource-bearing parent roots can still be deleted after rejected hub close; bounded parent-retention correction required (A-21123).).

### impl-1960 · 2026-11-18T07:43:39.044Z

Final capped review requested at5749818fe0b9ca46fbf4932db4dd221737ab01ff/tree f0f407576be468b18d1d4609b14f7696e0a69a0c. Per Coordinator5f056fad/A-21123, both new resource-bearing parents now share positive stopHub owner with captured cleanup before acquisition. Current-head evidence A-21124: harness11/11 natural exit, full lint0/0 refusals, full typecheck0. Earlier artifact37/37 at3e991caee and five artifact/T1-196 receipts at606fada47 retain their original epochs. No configured verification yet, no broader migration/production changes.

### rev-35 · 2026-11-18T07:45:09.047Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1960-source-4
commit: 5749818fe0b9ca46fbf4932db4dd221737ab01ff
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full consolidated source clear; Standards 0, Spec 0. A-21130 confirms the final four-point bar from Coordinator dffdb9ac/5f056fad. Two new resource-bearing parents now join the original callbacks/acquisitions then the same positive hub-close owner, retaining parent and child after rejected close; all manual/refusal/sibling/recovery assertions and M2/M3 behavior preserved. No production/helper-wide migration or new out-of-bar finding. A-21124 current-head 11/11 harness/full lint/typecheck positives retained; older artifact37/37 and N5/T1 confirmations keep their epochs. C1/C2/C3 implementation-done with qualified evidence; no configured verification mark yet. Clean exact head can request Coordinator mode-free window; final same-head evidence pending. Pin released.

### impl-1960 · 2026-11-18T07:48:58.481Z

Configured mode-free run9b5f2429-f523-412f-931f-113982eab271 admitted at reviewed5749818fe, CLI exit0, addressed torev-35 andimpl-1960. Host T0 log line105 records exit0/duration89.997s; Coordinator verify window released. Canonical step tree5f0a0755074e07151f6c05142979b8cac151de20; commandnpm run check. Final test-tier/executor result remains pending; no configured pass claimed.

### impl-1960 · 2026-11-18T08:11:56.198Z

Configured run9b5f2429/A-21140 at reviewed5749818fe completed autoexit0:6706/6706, nofail/cancel/skip/todo. T0localhostgate0; T1/T2/Web0 on droplet linuxx64 Node24.21.0, Neovim0.12.5, c-8ams3, lifetime1350s,cost$0.0937,workers2. T3explicitly deferred to merge batch; no T3 task-pass claim. Advisory budgets/lint remain report-only. Head unchanged/clean; final same-head evidence settlement held byrev-35. No resubmit or newsource.

### rev-35 · 2026-11-18T08:13:02.785Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1960-evidence-1
commit: 5749818fe0b9ca46fbf4932db4dd221737ab01ff
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final exact-head evidence clear, C1/C2/C3 verified. A-21141 independently audits owner code0/empty cause for9b5f2429/A-21140 at source-cleared5749818fe:6706 ordinary case passes,710 positive file envelopes, complete225T1/430T2/55Web plus235 separate load passes. Artifact37 positive cases/file; harness11 positive cases/file; all5 new cleanup/leak/refusal/recovery identities each base+5 loads. MacN5 at606 and extra37/37 at3e retain source epochs; static blob equality confirms final artifact/shared shutdown implementations unchanged. Final-current-head local harness/lint/typecheck positives retained. Capped four-point bar met; T-1961/wider migration excluded. Remaining248T3/17T4 unexecuted, NeovimT2 executed, report-only advisories retained; producing snapshot5f0a0755 distinct from Git treef0f40757. No tests/probes by Reviewer; pin released.

Criteria: C1 verified, C2 verified, C3 verified.

### coord · 2026-11-18T09:16:43.444Z

Merged 3d6faf22a4fed5f726bdf4956b1c93d9f49c0d9b onto dev.

### coord · 2026-11-19T06:16:35.057Z

Seen again 2026-11-19 06:15Z: two orphaned `node --test` processes from artifact-lifecycle.test.ts (pids 18984 and 30247), ppid 1, 23.5 h old, still running after their sessions ended. v0-6a sent them SIGTERM on my request.

### coord · 2026-11-19T06:16:41.590Z

Correction to my comment above: those two processes started around 2026-11-18 06:40Z. That's during my own bisect runs at 91d59bbe8 and 303b482b8, before this fix landed at 09:16Z. They're leftovers from the pre-fix hang, not a new leak after the fix, so no reopen is needed.
