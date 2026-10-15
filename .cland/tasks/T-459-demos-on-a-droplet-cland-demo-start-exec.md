---
id: T-459
kind: task
title: "Demos on a droplet: cland demo start, exec and stop lease a droplet for an epic's QA demo at a named dev commit, and the hub accepts the demo's verdict while dev moves on files outside the epic's surfaces"
state: open
status: review
size: L
criterion_seq: 7
labels:
  - v0.1.3
  - hub
  - docs
assignee: null
parent: E-423
blocked_by:
  - T-335
topic: topic-296
branch: t/T-459-demos-on-a-droplet-cland-demo-start-exec
created: 2026-10-15T07:15:15.838Z
updated: 2026-10-15T14:09:15.330Z
---

## Summary

Epic demos freeze `dev` today, because QA runs them in the root at the `dev` tip and reports BLOCKED when `dev` moves. This ticket gives QA a hub-held demo lease: a droplet acquired within `remote_budget` and the daily cap, with the demo commit delivered and prepared as for a suite run, Neovim included. Commands run on the droplet through `cland demo exec`. The hub then accepts an epic verdict whose commit is behind the tip when the later commits touch none of the epic's surfaces, using the surfaces T-335 reads from the `Item:` trailers.

## Parent

E-423 "Rules and rhythm" (R-294), tracer bullet 7 of 7; spec `docs/spec/v0.1.3.md` §3.4 ("Demos off dev"), `docs/spec/v0.1.2.md` §3.14 (the remote executor); the epic's choices "The demo lease" and "Fresh demo verdicts". Builds on E-271 (Remote executors) and T-347 (the remote budget).

## What to build

**The lease (`hub/src/executor/droplet/lease.ts`, `droplet.ts`, `prepare.ts`, `spend.ts`).** A demo lease is a third holder of droplet capacity, beside verification and E-387's sharded close runs.

- `cland demo start <epic> [--commit <sha>]` asks the hub for a droplet for the epic. The commit defaults to the `dev` tip.
- The hub acquires the droplet within `remote_budget` and the daily cap, delivers the commit and prepares it as for a suite run, Neovim included.
- It answers with the lease id, the commit and the droplet's lifetime.
- When no remote slot or budget is left, the command says so with the reason and exits non-zero. QA then runs the demo locally at the same commit.
- `cland demo exec <epic> -- <command…>` runs one command on the droplet as the ordinary user, in the delivered tree, and returns its stdout, stderr and exit code. `cland --headless --qa <case.lua>` runs there the same way.
- `cland demo stop <epic>` releases the droplet.
- The lease also ends at the epic's verdict or at its lifetime (`lifetime` of the remote executor), whichever comes first, through the existing watchdog.
- The droplet's create, its destroy and its cost each post on the epic as a comment.
- Callers: QA holding the epic's hold, the Coordinator and the human. Any other session is refused with `forbidden`.
- The DigitalOcean token is never stored. Sessions never call the provider.
- Frames: `demo.start`, `demo.exec`, `demo.stop` and `demo.status`, plus `hub/src/cli/demo.ts` and its entry in `usage.ts`.

**Fresh demo verdicts (`hub/src/tracker/gate-verdicts.ts`, `freshness.ts`).**

- An epic's QA verdict names its commit.
- The hub accepts it when that commit is on `dev` and every commit after it on `dev` touches none of the epic's surfaces. The surfaces are the files changed by the merges of the epic's tickets, read from `Item:` trailers through the helper T-335 adds for the merge hold.
- A later commit that touches a surface makes the verdict stale. The refusal names the commit and the files.

**The `qa` skill (`.agents/skills/qa/`).**

- The recorder runs each case of an epic demo through `cland demo exec`. Cases that need macOS run locally at the same commit, and the verdict says which ran where.
- The re-check of `dev` after the cases applies the freshness rule above instead of reporting BLOCKED on any move.
- The verdict's evidence names the executor, the commit, the lifetime and the cost.
- When `demo start` reports no slot or budget, the skill runs the demo locally, and the T-335 hold stays in force.

**Tests** run against E-271's fake DigitalOcean API and fake machine (`hub/test/fakes/digitalocean/`). A real droplet is QA's check and never part of `npm test`.

## Acceptance criteria

- [x] C1. `cland demo start <epic>` against the fake DigitalOcean API acquires a droplet within `remote_budget` and the daily cap, delivers the `dev` tip (or `--commit`), prepares it with Neovim, and reports the lease, commit and lifetime.
  - done: impl-459 · 2026-10-15T13:33:29.136Z
- [x] C2. `cland demo exec <epic> -- <cmd>` returns the command's output and exit code from the delivered tree as the ordinary user, and a `cland --headless --qa` case runs there the same way.
  - done: impl-459 · 2026-10-15T13:33:30.300Z
- [x] C3. `cland demo stop`, the epic's verdict and the lease lifetime each release the droplet, and the create, destroy and cost are posted on the epic.
  - done: impl-459 · 2026-10-15T13:33:31.300Z
- [x] C4. With no slot or budget left, `demo start` refuses with the reason and starts nothing, and a session other than QA, the Coordinator or the human is refused with `forbidden`.
  - done: impl-459 · 2026-10-15T13:33:31.967Z
- [x] C5. The hub accepts an epic verdict at a commit behind the `dev` tip when the later commits touch no file the epic's merges changed, and refuses it naming the commit and files when one does.
  - done: impl-459 · 2026-10-15T13:33:32.697Z
- [x] C6. The `qa` skill runs epic cases through `cland demo exec`, runs macOS cases locally at the same commit, applies the freshness rule after the cases, and names executor, commit, lifetime and cost in the evidence.
  - done: impl-459 · 2026-10-15T13:42:15.127Z
- [x] C7. `hub/README.md` describes the demo lease, its commands, budget sharing and the freshness rule.
  - done: impl-459 · 2026-10-15T13:33:34.141Z
  - verified: rev-30 [reviewer] · run rev-20261015-459-source-2 · 2026-10-15T13:42:55.913Z · commit 05cff0dd5e3a0fd1a8fcef0c44e0668a95c2985b

## Comments

### impl-459 · 2026-10-15T13:20:56.747Z

Read task, E-423 choices, release spec §3.4 and safety constraints. Implementing demo leases on existing DropletExecutor lifecycle/watchdog/budget, plus epic QA freshness and recorder/docs. Tests will use fake DO/SSH only; proposed public frame and verdict seams sent to lead.

### impl-459 · 2026-10-15T13:37:38.227Z

Implementation complete. A-3026 is the review guide (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3026-t-459-implementation-and-review-guide.md). Targeted checks green: demo.test.ts 7 cases; epic-close.test.ts 14; skills-qa.test.ts 16; executor-run.test.ts 18; freshness.test.ts 6; follows.test.ts 10. Typecheck, shard lint and diff whitespace checks pass. Every new demo test stayed under 5 seconds locally; no duration exemptions needed. No real droplets were used. Fetched and merged origin/dev before review. Per-item qaPolicy is none; real-droplet demo remains the epic QA scope.

### rev-30 · 2026-10-15T13:40:32.256Z

verdict: review
result: not clear
by: rev-30 [reviewer]
run: rev-20261015-459-source
commit: 57fd1e7609a5caf3a4db32253a653868f4772210
scope: full

Source review not clear at 57fd1e7609a5caf3a4db32253a653868f4772210.

Medium — .agents/skills/qa/qa-record.sh:34 (used by the new epic-demo workflow at SKILL.md:36): the recorder still accepts only T-<digits>. Recording this epic as E-423 exits 64 before demo execution or evidence append; substituting T-423 records the wrong canonical item/evidence directory. hub/test/demo.test.ts:102 masks the gap by recording hard-coded T-1 instead of its created epic id. Accept canonical planning-container item ids safely, update the skill invocation, and exercise remote run plus note/local fallback recording with the actual epic id. This blocks C6.

Standards: no additional findings against AGENTS.md, documented executor/test practices or the code-review baseline. The narrow Machine.result wrapper keeps transport errors separate from normal command exit 255, shell-quotes arguments and defaults SSH to runner; token removal remains in machineEnv. Demo metadata reuses existing slot reservation, spend ledger, tagged cleanup and watchdog paths.
Spec: C1–C5 source paths otherwise look consistent. Named commits resolve on dev and committed-object delivery avoids dirty root input; demo controls enforce QA epic hold/Coordinator/human authorization; stop/verdict/deadline reconciliation shares release/accounting. Surface-aware QA admission/close/cache uses Item-trailer task merges, includes renamed/deleted paths and every intervening commit (including reverted changes), and rechecks at publication. Stage QA remains separate. C7 README covers the commands, sharing, lifetime and freshness.

Reviewed git diff 53292737320dd085686dcd1cd8cf64a89c03facb...57fd1e7609a5caf3a4db32253a653868f4772210, two commits, 23 files; both Standards and Spec axes directly, no sub-agents permitted by role. git diff --check passes. A-3026 reports fake-only targeted validation; no real droplets or Reviewer tests/edits. C1–C5 and C7 remain unverified in this not-clear source pass; no full verification should run until a revised head receives source clearance.

Criteria failed: C6 — Canonical epic ids are rejected by the recorder, so the epic demo cannot record run/note evidence under its actual item id.

Criteria: C6 failed (Recorder accepts only T-<digits>; canonical epic ids such as E-423 fail before recording demo evidence.).

### impl-459 · 2026-10-15T13:42:28.605Z

Addressed C6 source-review finding in 05cff0dd: safe canonical item ids in recorder, actual epic id in skill/test/evidence paths, and prefix traversal validation. A-3040 records delta and red/green evidence. Targeted demo 7/7, skills-qa 16/16 and typecheck pass. Re-review requested at the pushed head before verification.

### rev-30 · 2026-10-15T13:42:55.913Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261015-459-source-2
commit: 05cff0dd5e3a0fd1a8fcef0c44e0668a95c2985b
scope: full

Source re-review clear at 05cff0dd5e3a0fd1a8fcef0c44e0668a95c2985b; no high, medium or low findings remain.

Standards: no findings. The recorder's one-letter uppercase kind prefix followed by digits remains a single safe path component, preserving traversal/nondigit rejection while admitting canonical epic and configured planning-kind ids.
Spec: prior C6 blocker resolved. qa-record.sh:34 now accepts E-423/I-42; the skill uses E-423 consistently for lease and evidence item; demo.test.ts uses its created epic id and checks both line.item and the canonical capture path. skills-qa tests exercise E/I note records and unsafe input rejection. A-3040 reports the exact recorder case red with exit 64 before the fix and green after; demo 7/7, skills-qa 16/16, typecheck and shell syntax pass.

The rest of source review rev-20261015-459-source stands: no additional findings in shared lifecycle, authorization, committed-object delivery, surface-aware freshness admission/close/cache, or remote capture flow. Reviewed delta 57fd1e76..05cff0dd is one commit/four files; no other design changes. git diff --check passes; current branch matches requested head. Both review axes performed directly; role disables delegation.

C7 verified from README source. C1–C6 remain unverified pending accepted same-head post-source cland verify; the C6 done mark at this fixed head supersedes the earlier failed mark. No real droplets or Reviewer tests/edits. Per-item QA policy none/after-stage; real-droplet demo is epic QA.

Criteria: C7 verified.
