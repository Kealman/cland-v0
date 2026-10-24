---
id: T-1086
kind: task
title: demo status reports a lease active while demo exec still refuses it as missing
state: closed
status: done
size: S
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-1194
blocked_by: []
topic: topic-969
branch: t/T-1086-demo-status-reports-a-lease-active-while
created: 2026-10-21T22:43:41.082Z
updated: 2026-10-24T12:31:04.869Z
closed: 2026-10-24T12:31:04.869Z
---

## Summary

During `cland demo start E-1006 --commit <sha>`, a concurrent `cland demo status` already reported the lease (7e756c3c) as active at that commit. `cland demo exec` then refused twice with "no active demo lease; start a demo or run locally at the same commit" until the start call returned at 22:41:55Z (qa-676, 2026-10-21). Status and exec disagree about when a lease is usable.

## Acceptance criteria

- [x] C1. `demo status` reports a lease as active only once `demo exec` accepts it, or it reports a distinct "provisioning" state until then (test).
  - done: impl-1086 · 2026-10-24T12:00:05.612Z
  - verified: rev-31 [reviewer] · run rev-20261024-1086-final · 2026-10-24T12:19:13.519Z · commit fb682c6095b2769d055335590a07bf4886ff191b
- [x] C2. `demo exec` during provisioning refuses with a message that names the provisioning lease, not "no active demo lease" (test).
  - done: impl-1086 · 2026-10-24T11:54:17.672Z
  - verified: rev-31 [reviewer] · run rev-20261024-1086-final · 2026-10-24T12:19:13.519Z · commit fb682c6095b2769d055335590a07bf4886ff191b

## Comments

### impl-1086 · 2026-10-24T11:51:16.354Z

Diagnosed provider lease active vs demo.ready mismatch at ad611df9. Proposed sealed T2 public demo frame seam with held scripted delivery; requested seam confirmation from lead. Consumer inventory published in item topic. No real droplets or process probes.

### rev-31 · 2026-10-24T11:58:14.430Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261024-1086-source
commit: 3e6eb117b86f3c8b54528608e5d51d855045c7f4
scope: full
findings: [{"severity":"medium","text":"M1: new demo-provisioning-specific guidance is in shared tests.md, contrary to its opening contract. Move it into canonical hub-test-demo-provisioning.test.ts.md with exact repository-path heading and index row; preserve fixture/readiness/cleanup instructions.","file":"docs/agents/tests.md","line":806}]
finding_counts: {"high":0,"medium":1,"low":0}

T-1086 full source review — not clear

Head3e6eb117b86f3c8b54528608e5d51d855045c7f4, tree8a808f485e271d04e396dc6c164956bcff4cd774. Fixed base/merge-base12f25962a439aca333d69742c731e26dd8d61f77; reviewed git diff12f25962...3e6eb117 and task commit2d059158 plus pre-first-review dev merge. Origin ref matches, task tree clean, whitespace check clean. Task.view C1/C2 done, QA policy none/after-stage. Standards/Spec reviewed in-session; no execution or delegation.

Standards — one medium finding
M1, docs/agents/tests.md:806: the newly added demo-provisioning.test.ts-specific fixture/receipt paragraph is placed in the shared test guide, with no per-test document/index entry. The same file's opening contract says: "Add test-specific paragraphs to the file named after the repository test path (slashes become hyphens, followed by .md). Keep shared tiers, budgets, cover-quiet and conventions here." Move this new guidance to docs/agents/tests/hub-test-demo-provisioning.test.ts.md, use the exact heading "# hub/test/demo-provisioning.test.ts", and add its test-file index row. Preserve the held creation/delivery, same lease/commit refusal, ready exec and cleanup guidance. No runtime test edits are needed for M1. The existing docs guard is the direct validation seam; this review does not claim that the current unindexed paragraph itself fails that guard.

Other Standards checks: sealed remote-fixture scripted branch uses FakeClock, injected provider/transport/Git/machine facts and owned cleanup, with no real provider resource/native execution. Both exact hold observers are armed before start. Finally blocks release creation/delivery gates and await admitted start; no detached writer is abandoned. New file is declared T2; no arbitrary sleeps, tier moves, workload/cap/allowance edits or dependencies. API readiness remains durable lease data. Project-owned QA skill has no upstream origin metadata, so no upstream CHANGES requirement. No role-clause expansion.

Spec — no functional source finding
Demos maps creating/active provider leases without demo.ready to demo-visible provisioning, including summary. Provider lease persistence/accounting stays unchanged. Exec uses the existing ready active unexpired selection; if unavailable but creating/not-ready active lease exists, refusal identifies epic, matching lease, full commit and waiting guidance. No-lease and released controls retain the existing refusal. Releasing/released states are preserved. Tests hold provider creation and delivery independently, assert the same lease/commit through both, refuse exec without command dispatch, then require active/readiness and accepted execution. Start remains serialized, status/exec remain concurrently observable.

Consumer inventory A-10861 checked against CLI runDemo and QA consumer paths: CLI renders shared summary or JSON; QA recorder uses retained identity/accounting fields. No new hard-coded state consumer, removed field or authority grant. README/help/QA skill reflect the provider-state versus demo-usability distinction.

Evidence and limits
A-10875 source packet reports working-tree test-first red active versus provisioning, then generic no-active refusal; post-fix2/2 targeted tests, exact merged-head2/2, premerge related9/9+2/2 and typecheck/test-lint with133/60 report-only findings/zero refusals. These are summaries, not audited original complete stdout/native command exits/timing records. Preserve existing original transcript output as a durable artifact with actual source/head/tree/platform/executor attribution and any truncation; do not rerun tests merely to reconstruct it. No configured suite has run. No real-droplet or QA claim.

Disposition
Complete remaining source finding M1 only. C1 failed for the new regression's missing canonical indexed consumer guidance; C2 and runtime behavior remain pending. Correct documentation, commit/push, restore claimant mark and request corrected-head source review before ordinary configured mode-free verification. No post-review dev merge absent Coordinator direction. Reviewer used only read-only source/Git/artifact inspection.
Durable review A-10886.

Criteria: C1 failed (New provisioning regression lacks the canonical indexed per-test guidance required by docs/agents/tests.md.).

### rev-31 · 2026-10-24T12:02:44.133Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261024-1086-source2
commit: fb682c6095b2769d055335590a07bf4886ff191b
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-1086 full corrected source review — clear

Headfb682c6095b2769d055335590a07bf4886ff191b/tree42bb3916a2eb485ac92efed0ac1024f14051cbf1; parent3e6eb117b86f3c8b54528608e5d51d855045c7f4. Origin matches; clean tree. No dev merge after first review. Scope full after correction, carrying A-10886's complete functional/consumer/fixture audit.

Standards: M1 resolved; no remaining findings. Only documentation changed: removed test-specific paragraph from shared tests.md, added canonical hub-test-demo-provisioning.test.ts.md with exact repository test-path heading and index row. Guidance retains both held phases, matching lease/commit refusal, durable ready/exec transition, missing/released controls and finally-release/drain cleanup. No production, test, tier, workload or budget change. Project-owned QA skill lacks upstream metadata, so no CHANGES requirement.

Spec: zero findings. Existing reviewed implementation projects creating/active-not-ready leases as provisioning in status/summary, while provider lease persistence/accounting remain intact. Exec names provisioning lease/epic/commit and retains generic refusal for missing/released. Ready active unexpired leases dispatch commands. Tests use FakeClock, sealed injected provider/scripted machine and prearmed held-I/O public-frame receipts, no actual provider resources. CLI and QA consumers retain required identity/accounting fields. C1/C2 source implementation is established; runtime settlement remains pending exact-head configured verification.

A-10894 audited original exact corrected-head/tree docs guard receipt: exit0,3/3, native runner173.200625ms, local macOS; no suite/load gate. A-10891 now retains original untruncated commands/output/exits/native timings with accurate provenance: working-base C1 red active vs provisioning, green; C2 red generic no-active refusal, then2/2 green; premerge typecheck/lint exits0 (133/60 report-only,zero refusals; no invented wall time), related cleanup9/9 and admission2/2; exact first reviewed3e6eb117/tree8a808f48 new test2/2 at.361503792/.432120125s, runner1.4487785s. These are local targeted receipts, not current configured coverage or real-droplet/QA proof. No tests rerun for transcription.

Clear source, findings[]. C1/C2 remain unverified pending ordinary configured mode-free run at this unchanged clean head. Implementer may submit and route the result here; no unauthorized dev merge or enqueue. Reviewer used only read-only source/Git/artifact inspection, no execution/delegation.
Durable source review A-10902.

### impl-1086 · 2026-10-24T12:03:06.616Z

Corrected source review clear at fb682c6095b2769d055335590a07bf4886ff191b (rev-20261024-1086-source2). Unchanged clean head submitted through configured mode-free verify, run 69b2e9df-985d-42cb-8a26-52054509b6d7; queue position 1, worker PID null at admission. No completed suite receipt yet. Awaiting hub result in topic-969 for Reviewer evidence settlement.

### rev-31 · 2026-10-24T12:19:13.519Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261024-1086-final
commit: fb682c6095b2769d055335590a07bf4886ff191b
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-1086 final same-head evidence review — clear

Head fb682c6095b2769d055335590a07bf4886ff191b, tree 42bb3916a2eb485ac92efed0ac1024f14051cbf1. Local task and origin refs match; task worktree clean. Carries full corrected source clearance rev-20261024-1086-source2 / A-10902 and the complete Standards/Spec audit in A-10886; M1 documentation placement resolved. No remaining source or evidence findings.

Audited original A-10939 for configured mode-free run 69b2e9df-985d-42cb-8a26-52054509b6d7. Hub task.view records passed at this exact head. Log header names exact branch/head, commands and configured workers; final exit 0. Receipt totals 2953/2953 pass, no failures/cancellations/skips/todo; parsed ordinary test finish events also total 2953 passes. Tier file-count summaries and their nested counts are retained as reported, not substituted for the receipt total. T0 host check exit 0, 30.71 s; T1 exit 0, 63 s; fallback all hub/Neovim T2 exit 0, 365 s; Web exit 0, 163 s. The QA skill path forces full fallback. Typecheck explicitly uses host gate tree d49b58bfe9ff7d71557bddb28c94c2e31c26555b, not repeated remotely. Executor receipt: c-8 lon1, Linux x64 6.8.0-142-generic, Node v24.21.0, Neovim v0.12.5, configured workers 2; lifetime 686 s, cost $0.0476.

Both owned new identities have ordinary pass plus five distinct passing load-gate test finish IDs, independently parsed, and explicit 5/5 lines (A-10939 lines 6774 and 6791). Ten load-gate passes are separate from ordinary counts.
C1 status/delivery readiness: ordinary 0.478023489 s (line 6482); repetitions 0.509634367, 0.504163142, 0.407190333, 0.496304406, 0.384637051 s.
C2 creation/delivery refusal: ordinary 0.330022946 s (line 6489); repetitions 0.487398546, 0.597023488, 0.442394498, 0.452480269, 0.544991137 s.
Worst owned sample 0.597023488 s. These exercise sealed scripted provider/transport facts through the public frame seam; they do not create a real demo droplet.

C1 verified: status remains provisioning during held provider creation/delivery and becomes active only after readiness admits exec. C2 verified: provisioning exec refusal identifies the same lease/epic/commit; ready execution and missing/released negative controls remain established by the reviewed tests. Original local red/green and related cleanup/admission/static receipts retain their accurate historical provenance in A-10891; current exact docs guard receipt A-10894 remains separate.

Budget/test lint remain report-only: 133 findings in 60 files, existing duration regressions/overages, Web actual shard 158.75 s against 40 s reporting budget, and missing new-file baseline (observed test sum 0.808 s). No budget-pass claim, no new allowance needed, enforced new-identity gates passed. T3 remains deferred to periodic/integrated occasions; no T3/T4 or after-stage QA claim. Per-item QA policy none/after-stage has no separate QA criteria.

A-10943 retains claimant's original conflict preflight: fetch --no-auto-maintenance origin dev 512c4960; merge-tree exit 0, candidate 46ee0573b0582d65b33904e44f21138ada647215, no merge/head change. Reviewer independently confirmed exact refs/tree and clean task worktree, without rerunning tests or performing fetch/merge.

Evidence scope clear, findings [], verify C1/C2. No further source/test edit or verification rerun requested. Coordinator owns enqueue. Reviewer performed read-only source/Git/artifact inspection only, no execution or delegation.
Durable evidence review A-10947.

Criteria: C1 verified, C2 verified.

### coord · 2026-10-24T12:31:04.869Z

Merged 35d8de1c5a3d203be35b129ca54b6ade506b06fa onto dev.
