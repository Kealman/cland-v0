---
id: T-1795
kind: task
title: The ADR, the v0.1.2 §3.13 amendment and the logins notes
state: open
status: review
size: S
criterion_seq: 4
labels:
  - ready-for-agent
assignee: null
parent: E-1535
blocked_by: []
topic: topic-1477
branch: t/T-1795-the-adr-the-v0-1-2-3-13-amendment-and
created: 2026-11-09T12:44:13.008Z
updated: 2026-11-11T09:14:25.420Z
---

## Summary

Record spec §3.12's decision: cland stores the keys the human enters through stdin and the metadata of disk logins (names, volume and snapshot ids, states). It never reads a login disk's contents and never keeps a harness's session tokens; the local registry stays names and paths. A new ADR carries the decision, spec v0.1.2 §3.13 gets an appended amendment, and `docs/hub/logins.md` describes the implementation for agents.

## What to build

Three documents, with no existing paragraph rewritten:
- **The ADR.** A new ADR in `docs/adr/` (question 16) states what cland stores for logins and what it never stores, including the terms boundary on Claude.ai and ChatGPT credentials. It links spec v0.4 §3.7 and §3.12 and GLOSSARY's Login, Login disk and Key login.
- **The amendment.** A dated amendment appended to spec v0.1.2 §3.13 links the ADR.
- **`docs/hub/logins.md`.** A new file describing the states, binding, release, snapshots, the key store, the cards and reconciliation as built, written for agents.

## Acceptance criteria

- [x] C1. A new ADR in `docs/adr/` states what cland stores and never stores for logins, and links spec v0.4 §3.7 and §3.12.
  - done: impl-1795 · 2026-11-11T09:08:19.255Z
  - verified: rev-35 [reviewer] · run rev-35-1795-source-1 · 2026-11-11T09:14:25.420Z · commit 478f0a97988eed61c1cb5b1c71306ac143d86681
- [x] C2. Spec v0.1.2 §3.13 carries an appended, dated amendment naming logins on hosts and linking the ADR, with no existing paragraph changed.
  - done: impl-1795 · 2026-11-11T09:08:19.464Z
  - verified: rev-35 [reviewer] · run rev-35-1795-source-1 · 2026-11-11T09:14:25.420Z · commit 478f0a97988eed61c1cb5b1c71306ac143d86681
- [ ] C3. `docs/hub/logins.md` exists and covers login states, binding, release, snapshots, the key store, the login cards and reconciliation.
- [x] C4. The closed-item wording lint passes on the three files (test).
  - done: impl-1795 · 2026-11-11T09:08:20.813Z

## Blocked by

None (can start immediately; the plan places it in the last stage, so the notes describe what landed)

## Notes

- Hot files: `docs/adr/0009-<slug>.md` (new), `docs/spec/v0.1.2.md` (an appended section only), `docs/hub/logins.md` (new).
- Tests: the closed-item wording lint (T1).
- Serves epic C10.

## Comments

### impl-1795 · 2026-11-11T09:07:45.908Z

Documentation-only scope; no shared contract, wire shape, schema, policy or logic change and no additive registration entries. Existing docs/hub/logins.md is preserved and extended, per Coordinator decision a876a500. Stage-4 as-built additions follow authorized dev landings; final C3/ready follows T-1794. Initial content assertion red: AssertionError: C1: login storage ADR is missing. Candidate wording lint on Node v24.21.0/macOS: fixture controls passed; 715 documents/1811 tracker items, 0 findings. No runtime tiers, native/browser cases or provider operations run.

### rev-35 · 2026-11-11T09:14:25.420Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1795-source-1
commit: 478f0a97988eed61c1cb5b1c71306ac143d86681
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-18630 initial three-file source review: Standards0/Spec0 in Coordinator-approved initial scope. Git tree d7e261c9d5fd28de4f713018f68266508d62a68f; 73 additive lines. Original spec and notes byte-preserved, every new link/fragment resolves. ADR/spec boundary matches glossary/v0.4 and landed stage1–3 owners; pool live Codex reads and remote no-idle-poll wording supported by source. C1/C2 verified. C3 intentionally open per a876a500 for additive as-built stage4 notes after authorized landings and delta reviews; final ready after T-1794. C4 local candidate lint is reported but original producer evidence/configured receipt not reviewed, so remains unverified. No Reviewer tests/native/browser/provider experiments or runtime coverage claim. Hold released; keep claim idle per Coordinator sequence. Final criteria/configured evidence and after-stage dev QA remain separate.

Criteria: C1 verified, C2 verified.
