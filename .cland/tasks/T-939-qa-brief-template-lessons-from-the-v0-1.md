---
id: T-939
kind: task
title: "QA brief template: lessons from the v0.1.4 epic demos"
state: closed
status: done
size: XS
criterion_seq: 2
labels:
  - qa-found
  - ready-for-agent
assignee: null
parent: C-216
blocked_by: []
topic: topic-693
branch: t/T-939-qa-brief-template-lessons-from-the-v0-1
created: 2026-10-20T05:13:34.829Z
updated: 2026-10-20T05:32:32.074Z
closed: 2026-10-20T05:32:32.074Z
---

## Summary

The nine v0.1.4 DoD demos (2026-10-20) found the same kinds of brief defects several times. The QA skill's BRIEF.md and STAGE-BRIEF.md should warn against them so later briefs avoid them.

## What to build

A short "probes that mislead" section in the QA skill's brief templates, one line each:
- a process probe must not match its own shell (pgrep bracket trick, or exclude the probe's tree); E-614;
- a file-change probe by mtime alone is confounded by live sessions rewriting the same file; judge by isolation; E-613;
- a "ran" marker grep must not count the configuration echo line; E-614;
- a successful droplet prepare logs to the run's delivery.log, not the suite log; E-614;
- speed criteria judge measured walls, never projections; E-677;
- slots that are due or queued before the build count even when their result lands later; E-678;
- "no skip" must name platform-only cases and where they are covered; E-578;
- helper or function names in a brief are re-checked with grep at the build, because renames happen; E-578.

## Acceptance criteria

- [x] C1. BRIEF.md and STAGE-BRIEF.md in the QA skill carry the section; `cland init`'s copy of the skill matches if it ships these templates.
  - verified: rev-31 [reviewer] · run rev-20261020-939-source · 2026-10-20T05:15:52.409Z · commit 715e8640d957b53e2e4c4d4de751b5f7ad686b24
  - verified: rev-31 [reviewer] · run rev-20261020-939-source-corrected · 2026-10-20T05:20:06.654Z · commit b66b94618c03cdcdc277c5da4e1c71c1ab50503c
  - verified: rev-31 [reviewer] · run rev-20261020-939-final · 2026-10-20T05:28:33.466Z · commit b66b94618c03cdcdc277c5da4e1c71c1ab50503c
  - done: impl-939 · 2026-10-20T05:28:47.422Z
- [x] C2. A mode-free `cland verify` at the reviewed head is green.
  - verified: rev-31 [reviewer] · run rev-20261020-939-final · 2026-10-20T05:28:33.466Z · commit b66b94618c03cdcdc277c5da4e1c71c1ab50503c
  - done: impl-939 · 2026-10-20T05:28:48.007Z

## Comments

### impl-939 · 2026-10-20T05:14:21.522Z

Implementation: added the eight requested 'Probes that mislead' lessons to both QA templates. The shipped source is the same .agents/skills tree, resolved by hub/src/init/skills.ts SKILLS_SOURCE; no duplicate copy requires editing. Source review and exact-head mode-free verification pending.

### rev-31 · 2026-10-20T05:15:52.409Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261020-939-source
commit: 715e8640d957b53e2e4c4d4de751b5f7ad686b24
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear, no findings; A-7066. Both brief templates contain identical eight-line sections covering every requested lesson. Init provisions the same .agents/skills source bytes; no duplicate template copy exists to update. C1 verified by content and provisioning-source inspection; C2 awaits exact-head configured mode-free verify.

Criteria: C1 verified.

### impl-939 · 2026-10-20T05:18:57.188Z

First mode-free run bee43097 (A-7075) failed only the existing QA catalogue section-parity assertion: qa/briefs/T-62.md lacked the new section. Targeted file reproduced (4/5 pass), then passed 5/5 after adding the same section to that shipped example brief. No runtime/test changes. New head requires fresh source review before verification; no dev merge taken.

### rev-31 · 2026-10-20T05:19:15.066Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261020-939-runtime
commit: 715e8640d957b53e2e4c4d4de751b5f7ad686b24
scope: evidence
findings: [{"severity":"medium","text":"The shipped qa/briefs/T-62.md lacks the new Probes that mislead section, failing the required ordered-section parity test.","file":"hub/test/skills-qa-catalogue.test.ts","line":44}]
finding_counts: {"high":0,"medium":1,"low":0}

Runtime not clear at original source-reviewed 715e8640; A-7078. Complete raw audit: 562 ordinary receipts, 561 pass and one deterministic owned T1 failure. Earlier source review missed the existing shipped-example section contract. The replacement-head request is received and will be reviewed separately; this records the failed parent evidence.

Criteria: C2 failed (A-7075 / bee43097 exits 1: shipped QA brief/template section parity fails; T2 not run.).

### rev-31 · 2026-10-20T05:20:06.654Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261020-939-source-corrected
commit: b66b94618c03cdcdc277c5da4e1c71c1ab50503c
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected source clear; A-7081. Delta only adds the same eight-line section to qa/briefs/T-62.md. Independently confirmed all three sections identical and ordered template/example headings now match the existing contract. M1 resolved with test unchanged; original template/provisioning review A-7066 remains applicable. C1 reverified; C2 requires wholly green configured mode-free verify at replacement b66b9461, retaining failed parent A-7075.

Criteria: C1 verified.

### impl-939 · 2026-10-20T05:27:55.362Z

Mode-free exact-head verification 207c814d-84b0-4a65-a3a8-675ae22dd605 is green at b66b94618c03cdcdc277c5da4e1c71c1ab50503c: 1920/1920 pass, 0 failures/skips. Linux droplet c-8 lon1, lifetime 410 s, cost $0.0285; log A-7095. Reviewed head unchanged. Waiting Reviewer final verdict; no merge enqueued.

### rev-31 · 2026-10-20T05:28:33.466Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261020-939-final
commit: b66b94618c03cdcdc277c5da4e1c71c1ab50503c
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear; A-7097 independently audits complete A-7095 / 207c814d at unchanged replacement head. 1920 ordinary passes, host check/all T1/fallback all T2 green, no tier mismatch or hard budget failure. Previously failing parity case passes at raw line 41640; all five catalogue tests pass, M1 resolved. C1/C2 verified; prior C2 failed mark is reconciled by this wholly green replacement receipt. A-7075 retained as failed-parent evidence. Claimant done marks remain its responsibility; no merge action.

Criteria: C1 verified, C2 verified.

### coord · 2026-10-20T05:32:32.074Z

Merged 6380e048ae92facd396db6fe8a3265bf055a6a97 onto dev.
