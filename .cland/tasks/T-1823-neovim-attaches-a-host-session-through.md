---
id: T-1823
kind: task
title: Neovim attaches a host session through the `ssh -t` attach
state: closed
status: done
size: S
criterion_seq: 3
labels:
  - ready-for-agent
assignee: null
parent: E-1537
blocked_by: []
topic: topic-1488
branch: t/T-1823-neovim-attaches-a-host-session-through
created: 2026-11-12T10:07:20.159Z
updated: 2026-11-12T11:35:29.005Z
closed: 2026-11-12T11:35:29.005Z
---

## Summary

Attaching to a host session from Neovim opens a terminal that runs the hub's `ssh -t` attach for that host, as a local session runs its harness's attach. The hub already returns that command for host sessions (spec §3.2); this ticket proves the Neovim path on the fake transport and names the host in the attach note.

## What to build

Neovim keeps asking the hub for the attach command and running what it returns. The attach note names the session and its host while the command starts. A refusal from the hub, for instance a revoked host, shows the hub's reason in the note. After `:restart`, the attached host sessions attach again through the same command. No key binding is added.

## Acceptance criteria

- [x] C1. `↵` on a fake-host session in headless Neovim opens a terminal whose job runs the hub's SSH attach command with `-t` and reaches the fake host's attach (test).
  - done: impl-1823 · 2026-11-12T10:12:33.139Z
  - verified: rev-36 [reviewer] · run rev-36-1823-final-1 · 2026-11-12T10:40:42.140Z · commit 14f45969887614afcda6405ce46a712bae412a42
- [x] C2. The attach note names the session and its host, and an attach the hub refuses for a revoked host shows the hub's reason in the note (test).
  - done: impl-1823 · 2026-11-12T10:12:33.405Z
  - verified: rev-36 [reviewer] · run rev-36-1823-final-1 · 2026-11-12T10:40:42.140Z · commit 14f45969887614afcda6405ce46a712bae412a42
- [x] C3. After `:restart`, a host session that was attached is attached again through the same SSH command (test).
  - done: impl-1823 · 2026-11-12T10:12:33.818Z
  - verified: rev-36 [reviewer] · run rev-36-1823-final-1 · 2026-11-12T10:40:42.140Z · commit 14f45969887614afcda6405ce46a712bae412a42

## Blocked by

None (can start immediately)

## Notes

- Hot files: `nvim/lua/cland/sessions.lua`.
- Tests: new `nvim/test/host-attach.test.ts` (headless Neovim, `projectHub`, `fake-ssh`).
- Serves epic C3 (the Contents' attach line).

## Comments

### impl-1823 · 2026-11-12T10:12:31.164Z

Consumer scope: only transient Neovim attach note text changes; existing session.attach frame and command builder unchanged. Consumers inspected: sessions.lua show_in/reattach, state.lua process rows, shell.test.ts restart and attach regressions, sessions-lifecycle.test.ts, host-attach-routing.test.ts, host-attach.test.ts and fake-ssh.ts. No shared contract migration or wire recording regeneration required. New T3 headless fake-SSH case covers C1-C3; existing local restart regression remains green.

### rev-36 · 2026-11-12T10:18:46.008Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1823-source-1
commit: 14f45969887614afcda6405ce46a712bae412a42
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full source review clear, Standards and Spec both without findings; A-18987 records fixed base, six-file scope and evidence limits. Replacement head only corrects alphabetical T3 registration ordering. C1–C3 runtime verification remains pending configured same-head Linux evidence; no verified marks appended. No tests or probes executed by reviewer. Merge-batch T3/T4 and affected after-stage QA remain separate.

### rev-36 · 2026-11-12T10:40:42.140Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1823-final-1
commit: 14f45969887614afcda6405ce46a712bae412a42
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final same-head evidence clear; C1–C3 verified. A-19004 reconciles A-19003 configured run 9021f6c8, 6184 base case passes/684 file finishes plus separate 125 load outcomes, zero nonpass/skip, T0/T1/all fallback T2/changed T3/Web exit0. Named native attach/restart/refusal case passed 1.158205594s at reviewed head. Exact Linux/Neovim/browser provenance, qualified local transcript linkage and deferred unchanged T3 consumers recorded. Standards/Spec zero findings. Budget/ratchet notices remain report-only; full remaining T3, T4 and affected after-stage QA are separate. No reviewer execution or additional task run.

Criteria: C1 verified, C2 verified, C3 verified.

### coord · 2026-11-12T11:35:29.005Z

Merged a335caecfdf9cfd02093093027d6a2d7e080d299 onto dev.
