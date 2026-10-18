---
id: T-609
kind: task
title: "`cland init` outside a repository walks up and takes HOME as the project root because of ~/.cland"
state: open
status: in progress
size: M
criterion_seq: 3
labels:
  - bug
  - hub
  - init
assignee: null
parent: E-612
blocked_by:
  - T-639
topic: topic-496
branch: t/T-609-cland-init-outside-a-repository-walks-up
created: 2026-10-16T14:15:41.938Z
updated: 2026-10-18T09:34:30.136Z
---

## Summary

On 2026-10-16 at about 12:41Z, a prototype `cland init` run in a non-empty folder with no git repository looked upward for a project root. It took the human's HOME as the project, because HOME holds `~/.cland/`, the hub's per-user state directory (executor/spend.json). It wrote cland's config, AGENTS.md, docs/agents, 44 skills, 44 symlinks and 11 hooks into HOME, and put `worktree.bgIsolation` into the global `~/.claude/settings.json`. Undoing that by hand also deleted `~/.cland/executor/spend.json`, the shared droplet spend ledger. The prototype uses the same root-finding logic as dev. Reported by the cland-design session; the human asked for this item in v0.1.4.

## Acceptance criteria

- [x] C1. `cland init` (and `update`) works only on the current directory or `--dir`. When the root it finds differs from the cwd, it refuses and names both paths.
  - done: impl-609 · 2026-10-18T09:28:56.395Z
- [x] C2. HOME is never accepted as a project root, and a test proves `cland init` in a non-repository folder under a HOME that holds the hub's state directory writes nothing outside that folder.
  - done: impl-609 · 2026-10-18T09:29:01.013Z
- [ ] C3. The hub's per-user state directory no longer shares its name with the project marker. For example, it moves to `~/.local/state/cland`, with a one-time migration of executor/spend.json.
  - failed: rev-31 [reviewer] · 2026-10-18T09:34:30.136Z · note Old-ledger hubs cannot see new-path reservations, so serialized mixed-version admissions can exceed the shared cap.

## Comments

### impl-609 · 2026-10-18T09:25:45.897Z

Implemented root validation before provisioning: cwd/positional target must match discovered root, HOME aliases refuse, linked worktrees/subfolders refuse with both paths. Red test reproduced unintended ancestor provisioning; T1 root regressions now pass. Spend state defaults to XDG_STATE_HOME/cland (fallback ~/.local/state/cland), with retained legacy bytes, atomic verified publication, conservative lease reconciliation, and a once-only durable migration log. Coordinator clarification at 5025447d-8dcf-4a02-9e2d-99ef91a01111 governs migration; no real HOME/state touched. Initial typecheck and test lint passed; finishing targeted safety evidence before review.

### rev-31 · 2026-10-18T09:34:30.136Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261018-609-source-1
commit: 25d86aebad13811fa044584608e7615f6666d3a4
scope: full
findings: [{"severity":"medium","text":"Publishing reservations only to the new ledger leaves live old readers with stale totals; two locks do not prevent mixed-version over-admission.","file":"hub/src/executor/droplet/spend.ts","line":73}]
finding_counts: {"high":0,"medium":1,"low":0}

Full source review at 25d86aebad13811fa044584608e7615f6666d3a4, fixed base 23244cfa9f1dbf53b75c2c1455d4fc9bb46f460d. Reviewed C1–C3, spec v0.1.4 §3.2/3.8 and independently read Coordinator clarification 5025447d-8dcf-4a02-9e2d-99ef91a01111 (copy and verify, retain old bytes, atomic/idempotent, conservative spend, one log with both paths). No Reviewer tests run.

## Standards
No findings. Root/migration tests use scratch HOME, filesystem markers, injected process identities and FakeClock at T1. A-5123 raw logs show root 4/4 and spend 8/8 with no failures/skips/cancellations or mismatch receipts; existing init 13/13 and host-gate evidence are retained. No new processes or waits.

## Spec
Medium M1 — hub/src/executor/droplet/spend.ts:73 (C3): two-ledger coexistence can over-admit spend. New reservations are published only to the new path, while retained legacy state remains readable by older live hubs. Acquiring both locks serializes access but does not make new reservations visible to old readers. At cap 10 with legacy reserved 6, a new hub can admit 4, then an old hub still sees 6 and admits another 4. Reconciliation later discovers 14 only after the cap was exceeded. The implementation explicitly accepts later legacy writes, so this is an active migration boundary, not just a stale backup. Lead confirmed there is no enforced old-writer fence or Coordinator exclusion (beee9d1a-ea73-485b-b3fc-fb69b5f39b26), and is escalating compatibility disposition. Establish safe admission during coexistence or an explicit enforced rollout boundary without violating retained-legacy-byte requirements, then obtain fresh source review if the head changes.

Root validation itself has no findings: target paths are physically resolved, ancestor/linked-worktree mismatch refuses before provisioning and names both paths, and HOME aliases refuse. Migration otherwise preserves old bytes, merges unique lease identities conservatively, consumes migrated shard reservations, publishes with fsync/atomic rename and verifies bytes, and records a stable receipt. Existing fault and reconciliation tests do not model an old reader admitting after a new-only reservation.

C1/C2 final execution evidence remains pending; C3 fails the coexistence admission boundary. No exact-head verification authorized by this verdict.

Standards: 0 findings. Spec: 1 medium finding.
Artifact A-5141.

Criteria: C3 failed (Old-ledger hubs cannot see new-path reservations, so serialized mixed-version admissions can exceed the shared cap.).
