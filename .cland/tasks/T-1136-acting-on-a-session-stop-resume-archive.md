---
id: T-1136
kind: task
title: "Acting on a session: Stop, Resume, Archive, Capabilities and the session's page"
state: open
status: review
size: M
criterion_seq: 7
labels:
  - ready-for-agent
assignee: null
parent: E-418
blocked_by:
  - T-1132
topic: topic-873
branch: t/T-1136-acting-on-a-session-stop-resume-archive
created: 2026-10-22T15:16:15.750Z
updated: 2026-10-22T23:41:06.653Z
---

## Summary

Stop, Resume, Archive and Capabilities work from the selected row and from the session's page, Stop and Archive after a confirmation in place.

## Parent

E-418 (§3.2, P22; §3.6 the session's page, P30; v0.1.2 §3.5; tracer step 3).

## What to build

- **The actions.** The unfolded row and the session's page carry Stop (`x`), Resume (`r`), Archive (`d`) and Capabilities (`c`), each where it applies: Stop on a live session, Resume and Archive on a stopped one.
- **Confirmations.** Stop and Archive ask once, in place: the actions give way to one line naming the session, where Enter or Confirm runs it and Esc or Cancel leaves it. Resume and Capabilities do not ask.
- **Resume** relaunches through the harness's own resume, keeping the name, role and claim; when the harness cannot resume, the hub's answer says so and the row offers a fresh launch with the same brief (v0.1.2 §3.5).
- **Capabilities** shows the session's adapter capability table read-only (the state signals, history, usage, model change, approval relay, terminal), or that the session has no adapter.
- **The session's page** holds the session's model, account, usage and capabilities with the same four actions and confirmations. On the desktop it opens with ⌘Enter in the other pane; the narrow slice opens it on a tap or Enter.

A refused or failed action shows its reason in place; the cookie's refused actions stay refused. Neovim's `sessions.lua` (stop and the capability float) defines the behaviour.

## Acceptance criteria

- [x] C1. `x` on a busy fake session asks for a confirmation in place, Esc leaves it running, and Enter stops it as `cland session list` reads (Web test with the fake harness).
  - done: impl-1136 · 2026-10-22T23:21:46.925Z
  - verified: rev-26 [reviewer] · run rev-20261022-1136-final-1 · 2026-10-22T23:36:00.379Z · commit c361576fadcf03c3bd803056dc97fcf0dcb8b878
- [x] C2. `r` on the stopped session resumes it with its name and role, as `cland session list` reads (Web test with the fake harness).
  - done: impl-1136 · 2026-10-22T23:21:47.019Z
  - verified: rev-26 [reviewer] · run rev-20261022-1136-final-1 · 2026-10-22T23:36:00.379Z · commit c361576fadcf03c3bd803056dc97fcf0dcb8b878
- [x] C3. `d` on a stopped session asks for a confirmation and archives it, and it leaves Stopped for the archive (Web test).
  - done: impl-1136 · 2026-10-22T23:21:47.101Z
  - verified: rev-26 [reviewer] · run rev-20261022-1136-final-1 · 2026-10-22T23:36:00.379Z · commit c361576fadcf03c3bd803056dc97fcf0dcb8b878
- [x] C4. `c` shows the session's adapter capability table read-only, and a session without an adapter says so (Web test).
  - done: impl-1136 · 2026-10-22T23:21:47.302Z
  - verified: rev-26 [reviewer] · run rev-20261022-1136-final-1 · 2026-10-22T23:36:00.379Z · commit c361576fadcf03c3bd803056dc97fcf0dcb8b878
- [x] C5. The session's page shows the model, account, usage and capabilities and runs the same four actions with the same confirmations (Web test).
  - done: impl-1136 · 2026-10-22T23:21:47.390Z
  - verified: rev-26 [reviewer] · run rev-20261022-1136-final-1 · 2026-10-22T23:36:00.379Z · commit c361576fadcf03c3bd803056dc97fcf0dcb8b878
- [x] C6. A resume the harness cannot perform shows the hub's reason and offers a fresh launch with the same brief (Web test with the fake harness).
  - done: impl-1136 · 2026-10-22T23:21:47.479Z
  - verified: rev-26 [reviewer] · run rev-20261022-1136-final-1 · 2026-10-22T23:36:00.379Z · commit c361576fadcf03c3bd803056dc97fcf0dcb8b878
- [x] C7. `web/README.md` documents the actions, the confirmations and the session's page (docs).
  - done: impl-1136 · 2026-10-22T23:21:47.568Z
  - verified: rev-26 [reviewer] · run rev-20261022-1136-source-1 · 2026-10-22T23:25:17.610Z · commit c361576fadcf03c3bd803056dc97fcf0dcb8b878
  - verified: rev-26 [reviewer] · run rev-20261022-1136-final-1 · 2026-10-22T23:36:00.379Z · commit c361576fadcf03c3bd803056dc97fcf0dcb8b878
  - verified: rev-26 [reviewer] · run rev-20261022-1136-source-2 · 2026-10-22T23:40:22.844Z · commit 57b26eed5f4d27bc197435452094b909e40a85d0
  - verified: rev-26 [reviewer] · run rev-20261022-1136-source-3 · 2026-10-22T23:41:06.653Z · commit 810fb3413ceabdba1dc020f217cfc7dd514a45c8

## Comments

### impl-1136 · 2026-10-22T23:20:20.195Z

Implemented the shared row/page Stop, Resume, Archive and Capabilities flow with in-place confirmations and hub-reason/fresh-brief handling; narrow tap/Enter opens the page. Test-first at the epic's public fake-harness/Headless Shell seams. Nine new action cases pass locally on macOS arm64 (current uncommitted tree; no suite/gate claim), plus Sessions, area slots, palette and key-context browser files. No new action test exceeded 4 seconds on successful samples. Source checks underway; review will precede hub verification. QA policy is affected after-stage, with no per-item QA criteria or brief.

### rev-26 · 2026-10-22T23:25:17.610Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261022-1136-source-1
commit: c361576fadcf03c3bd803056dc97fcf0dcb8b878
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear at c361576f; A-9513 records Standards and Spec, no findings. Shared row/page confirmation and resume/fresh handling retain native button Enter, pending duplicate guard, actual hub refusal reasons and offline no replay; capabilities and responsive page routing match the item. Nine new Web cases and affected regressions reviewed at their documented sealed fake-harness seams. C7 verified by matching docs. C1–C6 remain runtime-unverified pending mode-free configured verification at this exact unchanged head. A-9507 targeted/check claims are supporting local development evidence, not a configured or Linux pass; original receipt retention requested. Affected QA remains after-stage; no merge performed.

Criteria: C7 verified.

### rev-26 · 2026-10-22T23:36:00.379Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261022-1136-final-1
commit: c361576fadcf03c3bd803056dc97fcf0dcb8b878
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final evidence clear; C1–C7 verified. A-9541 audits same-head 38e66ace/A-9537: exit 0, 2539 passed with zero failed/cancelled/skipped, Linux c-8 lon1 T1/all-T2 hub+Neovim/Web and host T0 reused, not repeated remotely. All nine owned Web action cases have successful distinct receipts (1.053–2.495s); no owned 5/5 load or allowance claimed. Generic lint/duration/ratchet warnings retained in report mode, including actual Web wall 56.913s>40s and missing owned file baseline. Source clear A-9513 plus runtime settles all criteria; precommit A-9517 remains supporting provenance. No T3/T4/QA pass or merge claimed; affected QA remains after-stage.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified, C7 verified.

### rev-26 · 2026-10-22T23:40:22.844Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261022-1136-source-2
commit: 57b26eed5f4d27bc197435452094b909e40a85d0
scope: delta
findings: [{"severity":"low","text":"L1: Area overview still describes the Sessions page as AreaObjects ID/title details, while SessionPage now renders facts and shared actions. The dedicated Sessions section is correct; update the overview to remove the contradiction.","file":"web/README.md","line":183}]
finding_counts: {"high":0,"medium":0,"low":1}

Delta source clear at57b26eed; A-9556 audits Coordinator-authorized conflict merge. Session actions, Enter guard, Shell callback and tests unchanged; accepted Artifacts source retained. Palette keeps Sessions22/Artifacts20 plus both labels; combined docs and tier entries retain both features. One low overview docs contradiction at README:183, no high/medium findings. C7 established by correct dedicated section; C1–C6 await fresh configured mode-free same-head evidence. A-9552 remains supporting merged precommit targeted provenance, old A-9537/A-9541 historical at c361576f. No merge/QA pass claimed.

Criteria: C7 verified.

### rev-26 · 2026-10-22T23:41:06.653Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261022-1136-source-3
commit: 810fb3413ceabdba1dc020f217cfc7dd514a45c8
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Docs-only delta clear at810fb341; A-9560. L1 resolved: overview now correctly describes SessionPage facts/capabilities and shared SessionActions. Only README changed from source-clear57b26eed; no runtime/test or merge changes, no new tests needed for prose. C7 verified; C1–C6 await new mode-free configured same-head evidence. Existing source audits carry forward; old runtime receipt remains historical atc361576f. No remaining findings, QA or merge claim.

Criteria: C7 verified.
