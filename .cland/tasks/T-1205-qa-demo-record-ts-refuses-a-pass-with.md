---
id: T-1205
kind: task
title: qa-demo-record.ts refuses a PASS with missing fact keys or step errors and scans for secrets before publishing
state: closed
status: done
size: S
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-1196
blocked_by: []
topic: topic-1011
branch: t/T-1205-qa-demo-record-ts-refuses-a-pass-with
created: 2026-10-24T06:46:05.322Z
updated: 2026-10-25T00:02:39.650Z
closed: 2026-10-25T00:02:39.650Z
---

## Summary

In the v0.2 demos a recorder logged a premature PASS (E-420 gate 00), and a walk saved raw one-time sign-in links to logs (E-420 walk 2). Retro A-10321, triage A-10327.

## Acceptance criteria

- [x] C1. A run with a missing expected fact key or a recorded step error cannot record PASS (test).
  - done: impl-1205 · 2026-10-24T23:42:42.993Z
  - verified: rev-26 [reviewer] · run rev-20261024-1205-final-1 · 2026-10-24T23:56:58.436Z · commit e7eed6328a7a0926a3514f4f1ca46c143704b664
- [x] C2. A saved capture containing a sign-in token or provider key is redacted or refused before publishing (test).
  - done: impl-1205 · 2026-10-24T23:42:43.129Z
  - verified: rev-26 [reviewer] · run rev-20261024-1205-final-1 · 2026-10-24T23:56:58.436Z · commit e7eed6328a7a0926a3514f4f1ca46c143704b664

## Comments

### impl-1205 · 2026-10-24T22:08:56.285Z

Contract inventory before editing (rule 20): qa-demo-record.ts is called only by .agents/skills/qa/qa-record.sh; qa skill Epic demos documents it. qa-record.sh consumes result/evidence and message/stderr/remote_output, retaining existing keys. Headless producer nvim/lua/cland/qa.lua and nvim/test/qa.test.ts currently have no facts fields: preserve legacy results when no expectations are declared. Recorder CLI coverage is hub/test/skills-qa.test.ts with skills-qa-headless-fixture.ts; skills-qa-catalogue / qa-shipped-catalogue and QA lint inspect shipped cases/skills. QA_DEMO_EPIC usage in qa/briefs/E-{413,414,415,416,420,614,617,678}.md and qa skill only invokes the existing shell interface; keep it compatible. No production snapshot/list clients, startup probes or persisted readers consume a demo envelope; runs.jsonl fields remain unchanged. Planned seams: pure result validation/scanning at T1, plus the existing sealed qa-record.sh CLI boundary at T2 to assert durable blocked/pass receipts and withheld unsafe captures. No native hub/browser needed.

### impl-1205 · 2026-10-24T22:11:18.384Z

Consumer inventory completion: rg across all QA_DEMO_EPIC references also found the existing native remote recorder and recovery contract in hub/test/demo.test.ts (T3). It expects unchanged PASS/evidence/accounting and BLOCKED/error diagnostics plus retained remote output on recoverable failures; these shapes are retained. QA briefs E-{387,413,414,415,416,417,418,419,420,423,424,425,426,468,578,611,613,614,615,616,617,676,677,678,1006}.md use the unchanged QA_DEMO_EPIC shell entry; none declares fact fields today. No prior expectedFacts/expected_facts consumers exist. New QA_EXPECTED_FACTS is an optional local JSON-array file naming required own keys in result.facts, without argv credentials/patterns. Existing no-manifest results remain valid. T1 missing-fact/error/secret controls and T2 actual recorder controls each failed before wiring the gate.

### rev-26 · 2026-10-24T23:39:27.706Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261024-1205-source-1
commit: 164b18ce22cca6479a61806e273488d0175b99ba
scope: full
findings: [{"severity":"medium","text":"M1: both new per-test guides have descriptive rather than exact test-path headings; unchanged test-docs guard requires '# hub/test/qa-demo-policy.test.ts' and '# hub/test/skills-qa.test.ts'.","file":"docs/agents/tests/hub-test-qa-demo-policy.test.ts.md","line":1},{"severity":"medium","text":"M2: serialized stdout scan does not scan parsed result/metadata or envelope.stderr strings. JSON short escapes hide tab/newline Bearer whitespace from the scanner, allowing decoded secret diagnostics/metadata to be published. Scan parsed strings before any copy, with actual-recorder escaped metadata/stderr negative controls.","file":".agents/skills/qa/qa-demo-record.ts","line":57},{"severity":"medium","text":"M3: new direct execFileSync Git init/commit setup violates T2 native-process contract; preserve build-stamp assertion through adequate non-native setup or justified T3 seam without widening CLI exemptions/dropping assertions.","file":"hub/test/skills-qa.test.ts","line":171}]
finding_counts: {"high":0,"medium":3,"low":0}

A-11541 consolidated full audit: Standards M1/M3; Spec M2, all medium, no further findings. Independent fact manifest/PASS error+exit policy, additive confined Lua sidecar, old-wire controls and decoded-capture-before-copy sequence otherwise accepted. Consumer inventory checked through native recovery/accounting and skills provisioner. Local A-11540 is implementation-tree summary, not current-head configured proof. Preserve original outputs/exits/timings/source limits, correct findings and restore done marks, request fresh committed-head source review before verification. No extra dev merge/QA/landing; Reviewer read-only/no tests.

Criteria: C1 failed (New fact/recorder test coverage has invalid per-test headings and native Git setup in T2 (M1/M3).), C2 failed (Parsed JSON metadata/stderr can carry recognized bearer credentials past serialized-text preflight (M2).).

### rev-26 · 2026-10-24T23:43:20.719Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261024-1205-source-2
commit: e7eed6328a7a0926a3514f4f1ca46c143704b664
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-11543 corrected full source clear carries A-11541 accepted work; M1–M3 corrected, no findings. Exact guide headings/unchanged docs guard; parsed envelope keys/strings scanned before parsed stderr assignment/copy, escaped bearer actual-recorder negatives preserve no leak/no partial files/no cleanup plus safe positive; T2 native Git removed in favor of filesystem ref fixture, original build regex retained+exact equality, tier exemptions unchanged. A-11542 preserves actual red/green with correction-tree limits: policy5/T2enforce19/docs3/typecheck green, no suite/browser/T3/T4/Web claim. C1/C2 remain runtime-unverified; one unchanged-head e7eed632 ordinary mode-free verify then original-receipt evidence review. No extra dev merge/QA/landing.

### rev-26 · 2026-10-24T23:56:58.436Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261024-1205-final-1
commit: e7eed6328a7a0926a3514f4f1ca46c143704b664
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-11545 audits original A-11544 exact-head mode-free209dbd96: 3102 ordinary test/437 file passes; separately55 actual repetitions across five T1+six T2 identities5/5. Policy5/5/recorder19/19 pass. Final assertions establish missing facts/caught errors BLOCKED, decoded capture and parsed escaped-metadata secrets withheld without leak/partial files/cleanup acknowledgement, complete false-zero/legacy safe publication/readback+ack, actual envelope sidecar error refusal. Parsed-metadata base2.383338083 s/worst repetition2.516148961 s exceed report-only2 s budget, expressly not enforced performance pass; warnings/tier diagnostics retained, no changed-recorder mismatch. Host gate tree1eb28834 reused/not remote repeated; selectedT0/T1/fallback bothT2/Web green. T3/T4/native remote lease-accounting/integration/QA excluded; synthetic recorder evidence only. A-11543 source clear/local limits carried; C1/C2 verified. Lead fresh read-only dev conflict-check/ready with timing limits; Coordinator enqueue/merge.

Criteria: C1 verified, C2 verified.

### impl-1205 · 2026-10-24T23:57:46.371Z

Ready at e7eed6328a7a0926a3514f4f1ca46c143704b664: full source A-11543 and final exact-head evidence A-11545 clear; C1/C2 verified; mode-free verify 209dbd96 (A-11544) passed selected T0/T1/fallback T2/Web. Fresh fetch origin/dev ef23458a and read-only merge-tree exited 0 (tree 651b76ce); clean worktree, no head change. T0 host gate reused, runtime Linux droplet; T3/T4/native lease-accounting/QA excluded. Report-only parsed-metadata case 2.383 s base/2.516 s worst repetition exceeds 2 s, no enforced performance pass. Ready/conflict-check artifact retains provenance and demo advisories. Coordinator owns enqueue/merge.

### coord · 2026-10-25T00:02:39.650Z

Merged f0f152ded76171a27b7874a4cc40b1efd4c94606 onto dev.
