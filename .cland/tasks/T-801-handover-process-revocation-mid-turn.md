---
id: T-801
kind: task
title: 'handover-process: "revocation mid-turn…" failed once on a droplet (7.5 s) in an unrelated task run'
state: open
status: review
size: XS
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-482
blocked_by: []
topic: topic-518
branch: t/T-801-handover-process-revocation-mid-turn
created: 2026-10-18T12:59:15.093Z
updated: 2026-10-18T16:27:05.569Z
---

## Summary

hub/test/handover-process.test.ts, "revocation mid-turn: the human reassigns while the launched Coordinator is busy; its next call is refused and the revocation reaches it", failed after 7.47 s in T-645's droplet run 2b7bf0f0 (A-5301, line 32479). That run also hit the 75 min timeout. T-645 changes only release and version code, and the test hasn't failed in the day's other droplet logs. The failure detail was lost with the hung shard's reporter (T-799).

## Acceptance criteria

- [x] C1. The file passes 20/20 alone on Linux, or the cause is named from a reproduction.
  - done: impl-801 · 2026-10-18T16:23:51.005Z
  - verified: rev-30 [reviewer] · run rev-20261018-801-source · 2026-10-18T16:25:33.681Z · commit b8322a4c62f524fb7006b1d09ada01899d6700e2
- [x] C2. Any wall-clock wait in the case is replaced by an observed event or a FakeClock step, keeping every assertion.
  - done: impl-801 · 2026-10-18T16:23:53.505Z

## Comments

### impl-801 · 2026-10-18T16:22:06.418Z

Baseline handover-process file passed locally (9.19 s). Event-controlled delayed-driver probe waited for pong: Plan the week before role.set: old generic refusal assertion still passed (11.00 s), because a later revocation-turn send was forbidden. Tightening audit selection to the original request's reply_to made that schedule fail (undefined role vs null), demonstrating that the original 2.5 s window does not guarantee mid-turn revocation. Historical droplet failure cause remains unproven; requested C1 evidence decision from Coordinator. Implementing an explicit per-session fake turn barrier; keep every existing assertion.

### impl-801 · 2026-10-18T16:24:11.073Z

Evidence correction/final: audit uses normalized replyTo, not reply_to. A-5416 was invalid and archived. Corrected diagnostic mutation A-5420 plus red log A-5419 release the fake before role.set and observe the successful Plan answer; original-request forbidden audit assertion fails in 3.59 s. Correct ordering passes in 2.84 s and final 4.00 s (A-5422). Coordinator decision a8e2b96e accepts the reproduced ordering defect for C1 without 20 Linux repetitions; it is the most likely cause of the original lost droplet failure, but unproven. Lint and root typecheck pass. origin/dev fetched and fast-forwarded before first review. Commit b8322a4c62f524fb7006b1d09ada01899d6700e2 pushed to local origin. No separate QA required (qaPolicy scope none).

### rev-30 · 2026-10-18T16:25:33.681Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261018-801-source
commit: b8322a4c62f524fb7006b1d09ada01899d6700e2
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear. C1 verified under primary a8e2b96e: corrected A-5419/A-5420 early-release control reproduces missing mid-turn ordering; most likely historical cause but unproven, no20x Linux claim. Test replaces2500ms turn guess with per-session file-event barrier, observes held ID and busy state, then acknowledges reassignment/new clause/authoritative coordinator before release. Matching released ID and tool-result observation precede downstream notice/audit checks. Every original assertion remains; audit selection now requires original request replyTo. Existing fixture teardown stops fake sessions before home deletion even with held turn. Native T3 retained, no new processes/numeric waits/allowances. A-5422 independently confirms1/1 final green with no skips; lint/typecheck reported green. Standards/spec:no findings. C2 awaits exact-head post-source mode-free droplet evidence; no Reviewer execution or per-item QA.

Criteria: C1 verified.

### impl-801 · 2026-10-18T16:27:05.569Z

Verification admission explicitly refused (hub message 8da722af, 2026-10-18T16:26:54Z): spend.json.lock acquisition deadline reached after 60001 ms. No run admitted. Stopped submission under rule 5 and reported blocker to lead T-801/Coordinator. Source clear b8322a4c remains unchanged; awaiting admission repair before gate evidence.
