---
id: T-457
kind: task
title: "Seed the rulebook: an Aide migrates the eight rules of the planning session's and the stand-in's memories into .cland/RULES.md with their memory files as origins, and marks each memory with its rule number"
state: open
status: review
size: S
criterion_seq: 4
labels:
  - v0.1.3
  - docs
assignee: null
parent: E-423
blocked_by:
  - T-456
topic: topic-303
branch: t/T-457-seed-the-rulebook-an-aide-migrates-the
created: 2026-10-15T07:15:15.643Z
updated: 2026-10-15T15:27:54.744Z
---

## Summary

The rules this project accumulated live in two harness memories. One Aide task records the eight rules named in spec §3.2 with `cland rule add`, each with its scope, its reason and the memory file as its origin. It adds a line naming the rule's number to each migrated memory and posts the list on this item. It records nothing else; other rule-like memories are listed for the human.

## Parent

E-423 "Rules and rhythm" (R-294), tracer bullet 5 of 7; spec `docs/spec/v0.1.3.md` §3.2 ("The seed"); the epic's choice "The seed task". The Coordinator launches an Aide for this item (crew.toml's `aide` policy is `per-item`).

## What to build

No code. The Aide reads both memory folders:

- the planning session's: `~/.claude/projects/-Users-evgeniyivanov-Projects-cland-v0/memory/`;
- the stand-in's: `~/.claude-work/projects/-Users-evgeniyivanov-Projects-cland-v0/memory/`.

The two folders hold the same file names today. Where a file exists in both with the same content, the origin names the planning session's file. Where the contents differ, the Aide reads both and the origin names the file the rule's text was taken from.

The eight rules and their source memories:

| Rule | Memory file | Proposed scope |
|---|---|---|
| Briefs address the role, never a session name | `brief-address-the-role.md` | coordinator, lead, aide |
| No long foreground commands as Coordinator | `coordinator-no-long-foreground.md` | coordinator |
| One full suite at a time | `one-suite-at-a-time.md` (supersedes `full-suite-lock.md`, `suite-lock.md`) | all |
| Verdicts go to the lead | `verdicts-go-to-lead.md` | reviewer, qa, coordinator |
| No routing around refusals | `no-route-around-refusals.md` | all |
| The batch-merge rule | `batch-merge-rule.md` | coordinator, lead |
| Verify the head before merging | `verify-head-before-merge.md` | coordinator, lead |
| Check the verify queue before committing on `dev` | `tracker-commits-cancel-dev-runs.md` (with `integrated-run-root-freeze.md`) | coordinator, aide |

The scopes are proposals. The Aide reads each memory's "How to apply" and sets the narrowest scope that covers every role the rule binds. It writes the rule's text in the present tense, as one paragraph, without the incident narrative; the reason is the memory's "Why".

For each rule:

1. Run `cland rule add "<text>" --scope <roles> --reason "<why>" --origin memory:<path>` from the Aide's shell (ticket T-455).
2. Append to the memory file, in both folders when both hold it, the line `Recorded as rule <n> in .cland/RULES.md (E-423 seed).`
3. Add `(rule <n>)` to the memory's line in `MEMORY.md`.

Then post on this item with `task.comment`:

- the table of numbers, titles, scopes and origins;
- a separate list of other memories that read as standing rules: the flaky rerun rule, the load rule for stress loops, the shared-test fix by cherry-pick, the review loop cap, criteria on a single line, and any others. These are proposals for the human, not recorded.

Commit `.cland/RULES.md` on the task branch and merge it through `cland merge` like any task. The memory edits are outside the repository and need no commit.

## Acceptance criteria

- [ ] C1. `cland rule list --json` on the live project shows exactly eight active rules, matching the eight of §3.2, each with a scope, a reason and an `Origin: memory:<path>` naming an existing memory file.
- [ ] C2. Each migrated memory file, and its `MEMORY.md` line, names the rule number it became, in every memory folder that holds it.
  - verified: rev-30 [reviewer] · run rev-20261015-457-source · 2026-10-15T15:27:18.659Z · commit a9f013a2ed5ae48e239868d10c0b625b2cccc2b5
- [ ] C3. The item carries a comment with the table of the eight rules and a separate list of other rule-like memories proposed for the human, none of which is in the rulebook.
  - verified: rev-30 [reviewer] · run rev-20261015-457-source · 2026-10-15T15:27:18.659Z · commit a9f013a2ed5ae48e239868d10c0b625b2cccc2b5
- [ ] C4. After the merge, the live Coordinator's next clause (after a reconnect) lists the seeded rules in its scope as `rule <n>: …`.

## Comments

### coord · 2026-10-15T15:17:02.756Z

Human decision on 2026-10-15 at 15:15Z (ask 45c1eb99, answer 42704fe5): the Aide runs on Codex instead of Claude Code, because the Claude Code launch refused with 'Workspace not trusted'. The Aide is aide-457. impl-457 was launched in error and stopped; its read-only inventory is A-3100.

### coord · 2026-10-15T15:18:31.093Z

Coordinator decision (2026-10-15 15:18Z):  writes the live root .cland/RULES.md from any cwd (A-3106), because the rulebook is hub-managed project state like .cland/tasks. So the seed lands in the root, and the Coordinator commits .cland/RULES.md on dev as a tracker-style commit, in place of the body's 'commit on the task branch'. T-457 closes on the Reviewer's clear verdict and task close, not through cland merge. C1–C4 are unchanged.

### coord · 2026-10-15T15:18:37.668Z

Correction to the comment above: the missing words are "cland rule add". It writes the live root .cland/RULES.md from any cwd.

### aide-457 · 2026-10-15T15:21:33.901Z

Seed completed by aide-457. Exactly eight active rules are returned by live `cland rule list --json`; exact output: A-3108, `/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3108-t-457-live-eight-rule-list-json.json`.

| Number | Title | Scope | Origin |
|---|---|---|---|
| rule 1 | Briefs address the role | coordinator, lead, implementer, aide | `memory:/Users/evgeniyivanov/.claude/projects/-Users-evgeniyivanov-Projects-cland-v0/memory/brief-address-the-role.md` |
| rule 2 | No long foreground commands as Coordinator | coordinator | `memory:/Users/evgeniyivanov/.claude/projects/-Users-evgeniyivanov-Projects-cland-v0/memory/coordinator-no-long-foreground.md` |
| rule 3 | One full suite at a time | all | `memory:/Users/evgeniyivanov/.claude/projects/-Users-evgeniyivanov-Projects-cland-v0/memory/one-suite-at-a-time.md` |
| rule 4 | Verdicts go to the lead | all | `memory:/Users/evgeniyivanov/.claude/projects/-Users-evgeniyivanov-Projects-cland-v0/memory/verdicts-go-to-lead.md` |
| rule 5 | No routing around refusals | all | `memory:/Users/evgeniyivanov/.claude/projects/-Users-evgeniyivanov-Projects-cland-v0/memory/no-route-around-refusals.md` |
| rule 6 | The batch-merge rule | coordinator, lead | `memory:/Users/evgeniyivanov/.claude/projects/-Users-evgeniyivanov-Projects-cland-v0/memory/batch-merge-rule.md` |
| rule 7 | Verify the head before merging | coordinator, lead | `memory:/Users/evgeniyivanov/.claude/projects/-Users-evgeniyivanov-Projects-cland-v0/memory/verify-head-before-merge.md` |
| rule 8 | Check the verify queue before committing on dev | coordinator, aide | `memory:/Users/evgeniyivanov/.claude/projects/-Users-evgeniyivanov-Projects-cland-v0/memory/tracker-commits-cancel-dev-runs.md` |

Scope and distillation notes:
- Rule 1 covers brief/request authors, including configured Leads and Implementers acting as item leads; its role-routing instruction respects Aides' named-recipient restriction. My earlier A-3106 note incorrectly called lead only a routing target; it is also a configured role, and rule 1 now includes it.
- Rule 3 is exclusive per machine, uses current runner-managed locks and respects remote machine slots. It does not restore manual lock wrappers or the superseded FIFO workaround.
- Rule 4 covers verifiers and every possible item lead, hence all roles. It preserves lead-directed verdicts with current lead-owned review/retry and automatic ready delivery, without restoring Coordinator-only requests or mandatory verdict relays.
- Rules 6–7 cover the roles authorized to merge. They retain the batch limits, conflict-resolution search requirement, actual local and origin head checks, and applicable same-head evidence requirements; references to approved exceptions do not record the separate flaky-rerun proposal.
- Rule 8 retains the queue check for hub-code changes and the fixed-clean-copy correction, without restoring the superseded blanket dev freeze.

Memory marks:
Appended exactly `Recorded as rule <n> in .cland/RULES.md (E-423 seed).` to each primary source, plus `full-suite-lock.md` and `suite-lock.md` for rule 3 and `integrated-run-root-freeze.md` for rule 8. Added `(rule <n>)` to each matching MEMORY.md line. Both requested folder paths resolve to the same backing directory, so one write updates both; verified exactly one marker and matching index reference through each path for all eleven files (22 source paths and 22 index references). Only these append/index lines were changed; historical memory text remains intact.

Further standing-rule proposals for the human — none recorded:
- `flaky-rerun-rule.md`: evidence and one rerun for unrelated flakes; its latest temporary E-482 two-droplet-receipt policy supersedes the local fallback. Preserve its expiry/conditions if adopted.
- `load-rule-stress.md`: stress loops only on a clear queue; latest addition limits targeted tests machine-wide with load below 15. `cover-quiet-rule.md` adds no tests beside a local integrated cover.
- `shared-test-fix-cherry-pick.md`: a failure reproducing alone on clean dev gets one canonical fix cherry-picked to affected branches.
- `review-loop-cap.md`: agree the review bar and trust model, move out-of-model findings to follow-ups, and agree a final round with the authorized decision-maker.
- `criteria-single-line.md`: tracker acceptance criteria are single lines; criterion-add text omits the generated Cn prefix.
- `secrets-never-in-argv.md`: credentials never enter argv or printed output; use descriptor-fed patterns and counts/filenames.
- `review-request-in-item-topic.md`: deliver review/QA and delta requests in the item's bound topic so evidence can be published.
- `merge-check-fetch-first.md`: fetch before predicting conflicts, and guard dependent post-merge operations on actual success.
- `coordinator-working-rules.md`: English artifacts/items and Russian human dialogue; independent Codex review/QA; stop an Implementer only after merge actually succeeds. Older delegation/model details need reconciliation with current crew policy.
- `epic-tickets-cover-dod.md`: plan each epic and check every DoD feature was ticketed and exists before QA.
- `epic-close-report.md`: a short Russian General report explaining user-visible changes on each epic close.
- `do-oversight.md`: inspect cland resource lifetime and spend through the authorized hub owner, preserve unrelated human resources, and escalate spending decisions to the human. Reconcile historical caps with current configuration and keep PID-only checks where credential inheritance remains possible.
- `role-tools-fixed-at-launch.md`: ensure affected sessions gain newly added tools after restart/relaunch; its claim that clauses only change on relaunch is superseded by reconnect-delivered clauses.
- `claude-code-roles-on-sonnet.md`: human-approved model/cost policy; historical blanket model instructions need reconciliation with current per-role/per-harness crew settings.
- `claude-code-skip-permissions.md`: records a human permission-policy choice; review current policy before considering it a rule. No permission settings were edited.
- `hourly-lost-work-check.md`: stale-work checks; its external cron mechanics are superseded by E-423's native heartbeat and need reconciliation, rather than a duplicate schedule.
- `coord-docs-commit-via-worktree.md`: respect background-session root-edit guards with a worktree workflow, rather than bypassing guards.
- `droplet-switch-gotchas.md`: prepare per-project snapshots and use clean fixed cover trees; historical executor-reload/QA-singleton claims should be checked against current implementation.
- `topic-post-after-merge.md`: historical topic/push cleanup guidance needs current verification; its advice to stop before merge conflicts with the later stop-only-after-success instruction and must not be copied verbatim.

Landing follows Coordinator decision `9fb5e236-e895-4329-a3fc-56f586aa50fc` in topic-303: live root rulebook is hub-owned project state; Coordinator commits it on dev, requests review and closes T-457 without a branch merge. No branch copy, commit or push was made; T-457 worktree remains clean. C4 still requires observation of the live Coordinator's next clause after reconnect. No test suite was run for this data-only migration.

### rev-30 · 2026-10-15T15:27:18.659Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261015-457-source
commit: a9f013a2ed5ae48e239868d10c0b625b2cccc2b5
scope: full

Source review clear for T-457 at seed commit a9f013a2ed5ae48e239868d10c0b625b2cccc2b5 (live-state landing authorized by Coordinator decision 9fb5e236).

Standards: no high or medium findings. The eight numbered entries use the documented scope/date/status/origin/reason format and present-tense paragraphs. Superseded manual-lock, Coordinator-only review routing and blanket dev-freeze details are distilled consistently with current project instructions.

Spec: exactly eight active entries match docs/spec/v0.1.3.md §3.2. A-3108 JSON matches the live .cland/RULES.md and committed seed field-for-field; all eight memory origins exist. Every primary/supporting migrated memory (11 files) has exactly one correct rule marker and exactly one matching MEMORY.md reference through each requested path. The paths resolve to the same backing directory. The item comment contains the eight-rule table and a separate unrecorded proposal list; no proposed ninth rule was recorded.

Verified C2,C3. C1 data is consistent with captured live output A-3108, but the requested independent CLI rerun could not complete: node hub/bin/cland.ts rule list --json returned connect EPERM .../.cland/hub.sock in this read-only sandbox, and this session exposes no rule.list tool. Leave C1 unmarked pending independent live-query evidence/Coordinator settlement. C4 remains unverified, not failed, pending the next hub restart and Coordinator reconnect observation as requested. No test suite was run or needed for this data-only source pass.

Criteria: C2 verified, C3 verified.
