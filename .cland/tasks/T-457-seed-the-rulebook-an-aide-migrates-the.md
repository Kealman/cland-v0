---
id: T-457
kind: task
title: "Seed the rulebook: an Aide migrates the eight rules of the planning session's and the stand-in's memories into .cland/RULES.md with their memory files as origins, and marks each memory with its rule number"
state: open
status: in progress
size: S
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
updated: 2026-10-15T15:17:10.569Z
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
- [ ] C3. The item carries a comment with the table of the eight rules and a separate list of other rule-like memories proposed for the human, none of which is in the rulebook.
- [ ] C4. After the merge, the live Coordinator's next clause (after a reconnect) lists the seeded rules in its scope as `rule <n>: …`.

## Comments

### coord · 2026-10-15T15:17:02.756Z

Human decision on 2026-10-15 at 15:15Z (ask 45c1eb99, answer 42704fe5): the Aide runs on Codex instead of Claude Code, because the Claude Code launch refused with 'Workspace not trusted'. The Aide is aide-457. impl-457 was launched in error and stopped; its read-only inventory is A-3100.
