---
id: T-1205
kind: task
title: qa-demo-record.ts refuses a PASS with missing fact keys or step errors and scans for secrets before publishing
state: open
status: review
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
updated: 2026-10-24T22:16:00.268Z
---

## Summary

In the v0.2 demos a recorder logged a premature PASS (E-420 gate 00), and a walk saved raw one-time sign-in links to logs (E-420 walk 2). Retro A-10321, triage A-10327.

## Acceptance criteria

- [x] C1. A run with a missing expected fact key or a recorded step error cannot record PASS (test).
  - done: impl-1205 · 2026-10-24T22:15:59.953Z
- [x] C2. A saved capture containing a sign-in token or provider key is redacted or refused before publishing (test).
  - done: impl-1205 · 2026-10-24T22:16:00.180Z

## Comments

### impl-1205 · 2026-10-24T22:08:56.285Z

Contract inventory before editing (rule 20): qa-demo-record.ts is called only by .agents/skills/qa/qa-record.sh; qa skill Epic demos documents it. qa-record.sh consumes result/evidence and message/stderr/remote_output, retaining existing keys. Headless producer nvim/lua/cland/qa.lua and nvim/test/qa.test.ts currently have no facts fields: preserve legacy results when no expectations are declared. Recorder CLI coverage is hub/test/skills-qa.test.ts with skills-qa-headless-fixture.ts; skills-qa-catalogue / qa-shipped-catalogue and QA lint inspect shipped cases/skills. QA_DEMO_EPIC usage in qa/briefs/E-{413,414,415,416,420,614,617,678}.md and qa skill only invokes the existing shell interface; keep it compatible. No production snapshot/list clients, startup probes or persisted readers consume a demo envelope; runs.jsonl fields remain unchanged. Planned seams: pure result validation/scanning at T1, plus the existing sealed qa-record.sh CLI boundary at T2 to assert durable blocked/pass receipts and withheld unsafe captures. No native hub/browser needed.

### impl-1205 · 2026-10-24T22:11:18.384Z

Consumer inventory completion: rg across all QA_DEMO_EPIC references also found the existing native remote recorder and recovery contract in hub/test/demo.test.ts (T3). It expects unchanged PASS/evidence/accounting and BLOCKED/error diagnostics plus retained remote output on recoverable failures; these shapes are retained. QA briefs E-{387,413,414,415,416,417,418,419,420,423,424,425,426,468,578,611,613,614,615,616,617,676,677,678,1006}.md use the unchanged QA_DEMO_EPIC shell entry; none declares fact fields today. No prior expectedFacts/expected_facts consumers exist. New QA_EXPECTED_FACTS is an optional local JSON-array file naming required own keys in result.facts, without argv credentials/patterns. Existing no-manifest results remain valid. T1 missing-fact/error/secret controls and T2 actual recorder controls each failed before wiring the gate.
