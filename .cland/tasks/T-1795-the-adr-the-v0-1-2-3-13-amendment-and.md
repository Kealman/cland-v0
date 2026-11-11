---
id: T-1795
kind: task
title: The ADR, the v0.1.2 §3.13 amendment and the logins notes
state: open
status: planned
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-1535
blocked_by: []
topic: null
branch: null
created: 2026-11-09T12:44:13.008Z
updated: 2026-11-11T09:03:52.522Z
---

## Summary

Record spec §3.12's decision: cland stores the keys the human enters through stdin and the metadata of disk logins (names, volume and snapshot ids, states). It never reads a login disk's contents and never keeps a harness's session tokens; the local registry stays names and paths. A new ADR carries the decision, spec v0.1.2 §3.13 gets an appended amendment, and `docs/hub/logins.md` describes the implementation for agents.

## What to build

Three documents, with no existing paragraph rewritten:
- **The ADR.** A new ADR in `docs/adr/` (question 16) states what cland stores for logins and what it never stores, including the terms boundary on Claude.ai and ChatGPT credentials. It links spec v0.4 §3.7 and §3.12 and GLOSSARY's Login, Login disk and Key login.
- **The amendment.** A dated amendment appended to spec v0.1.2 §3.13 links the ADR.
- **`docs/hub/logins.md`.** A new file describing the states, binding, release, snapshots, the key store, the cards and reconciliation as built, written for agents.

## Acceptance criteria

- [ ] C1. A new ADR in `docs/adr/` states what cland stores and never stores for logins, and links spec v0.4 §3.7 and §3.12.
- [ ] C2. Spec v0.1.2 §3.13 carries an appended, dated amendment naming logins on hosts and linking the ADR, with no existing paragraph changed.
- [ ] C3. `docs/hub/logins.md` exists and covers login states, binding, release, snapshots, the key store, the login cards and reconciliation.
- [ ] C4. The closed-item wording lint passes on the three files (test).

## Blocked by

None (can start immediately; the plan places it in the last stage, so the notes describe what landed)

## Notes

- Hot files: `docs/adr/0009-<slug>.md` (new), `docs/spec/v0.1.2.md` (an appended section only), `docs/hub/logins.md` (new).
- Tests: the closed-item wording lint (T1).
- Serves epic C10.
