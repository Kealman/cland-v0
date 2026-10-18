---
id: T-636
kind: task
title: Existing projects get the Aide's new tools once, at the hub's first 0.1.4 start
state: open
status: in progress
size: S
criterion_seq: 5
labels:
  - v0.1.4
  - hub
assignee: null
parent: E-611
blocked_by:
  - T-628
  - T-630
topic: topic-523
branch: t/T-636-existing-projects-get-the-aide-s-new
created: 2026-10-16T16:04:12.845Z
updated: 2026-10-18T16:28:32.786Z
---

## Summary

Every existing `roles.toml` lists the Aide's tools explicitly and cland never rewrites the file, so without a migration an existing project, this repository included, never gets the Aide's reach. At its first start of 0.1.4 the hub appends `session.launch`, `session.stop`, `session.resume`, `task.import` and `push` to an explicit `[aide.permissions] tools` list, once, and reports the change in Agents (the human's comment on E-611, 2026-10-16).

## What to build

- At start, when `[aide.permissions] tools` exists and lacks any of the five tools, the hub appends the missing ones with the roles.toml editor, keeping every other line and the list's order, and marks the file so the migration never runs again on it: a human who removes a tool afterwards keeps it removed. The mark is a comment line under the table (recommended; see the README's open question).
- One Agents notice names the tools added and says that a running Aide gets them only at its next launch, since role tools are fixed at launch.
- A file with no `tools` key under `[aide.permissions]` already takes the built-in list: nothing is written. A file that already holds the five, or carries the mark, is left alone. A file that does not parse is left unchanged and the notice says the migration waits for a valid file.
- The Aide's clause in an existing file still says it cannot launch, stop or resume sessions or `cland push`: what the migration does with it follows the Coordinator's answer (recommended: replace that line with the 0.1.4 lines when it matches the shipped v0.1.3 text exactly, else name it in the notice for the human).

## Acceptance criteria

- [ ] C1. A hub started on a project whose roles.toml lists the v0.1.3 Aide tools appends the five tools, keeps every other line, writes the mark and posts one Agents notice naming them (frame-protocol test).
  - failed: rev-30 [reviewer] · 2026-10-18T16:28:32.786Z · note Valid roles needing migration are discarded on publication failure; hub silently uses built-in policy and will not retry until another edit.
- [x] C2. A second start writes nothing, and neither does a start after the human removed one of the added tools again.
  - done: impl-636 · 2026-10-18T16:25:37.913Z
- [x] C3. A roles.toml without an `[aide.permissions] tools` list, one that already holds the five tools and one that does not parse are left byte-identical, the last with an Agents notice.
  - done: impl-636 · 2026-10-18T16:25:39.628Z
- [x] C4. The existing Aide clause line that forbids launching, stopping, resuming and `cland push` is handled as the Coordinator decided, verified in the same test.
  - done: impl-636 · 2026-10-18T16:25:42.417Z
- [x] C5. After the migration and the Aide's relaunch, the Aide in that project launches a session from its shell (frame-protocol test with the fake harnesses).
  - done: impl-636 · 2026-10-18T16:25:44.445Z

## Comments

### impl-636 · 2026-10-18T16:21:43.350Z

Implementation started. Acceptance criteria pre-agree the frame-protocol seam; using T2 projectHub with in-process fake harnesses for C1/C5 and pure source-span editing tests for file preservation. E-611's 2026-10-16 Coordinator decision settles C4: replace only the verbatim v0.1.3 restriction, flag custom clauses in the migration notice. Safety: only temporary fixture roles.toml files.

### rev-30 · 2026-10-18T16:28:32.786Z

verdict: review
result: not clear
by: rev-30 [reviewer]
run: rev-20261018-636-source
commit: 280f97b555c7da87193c50fa2540d6123c1af24d
scope: full
findings: [{"severity":"medium","text":"M1: a migration write failure or concurrent-edit refusal skips loading valid roles and falls back to DEFAULTS; current attemptStamp then prevents refresh. Preserve valid human policy or refuse startup, distinguish publication errors from invalid syntax, and cover injected write failure/concurrent edit.","file":"hub/src/hub/configuration.ts","line":69}]
finding_counts: {"high":0,"medium":1,"low":0}

Source not clear. M1 at configuration.ts69: #roles starts DEFAULTS; writeRolesFile rejection skips parseRoles assignment and outer catch treats valid source as unreadable. attemptStamp then records current stamp, preventing fresh from loading it. Valid custom grants/launch settings can be ignored after an I/O or concurrent-edit failure. Separate parse and publication handling, preserve valid policy or fail startup, keep concurrent edits reloadable, and add failure-path controls. Other source-span, marker/no-op, exact shipped-line/custom-warning and fake-shell-frame paths have no additional findings. C4 matches E-611 D51. C1 failed; no criterion verified on this not-clear. Do not verify this head; corrected head needs new source review. No Reviewer execution.

Criteria: C1 failed (Valid roles needing migration are discarded on publication failure; hub silently uses built-in policy and will not retry until another edit.).
