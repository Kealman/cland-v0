---
id: T-455
kind: task
title: "Rulebook: .cland/RULES.md with numbered rules, read and written by cland rule add, edit, retire, list and show, and reloaded by the hub when the file changes"
state: open
status: in progress
size: M
labels:
  - v0.1.3
  - hub
assignee: null
parent: E-423
blocked_by: []
topic: null
branch: t/T-455-rulebook-cland-rules-md-with-numbered
created: 2026-10-15T07:15:15.459Z
updated: 2026-10-15T07:16:41.019Z
---

## Summary

The project's rules live in the Coordinator's harness memory today, where another harness cannot read them and nobody can see them whole (Q-378). This ticket adds the rulebook as a committed project file, `.cland/RULES.md`, and the `cland rule` commands that read and write it through the hub. The hub re-reads the file when it changes, as it does `roles.toml`. Getting rules into clauses, briefs and deliveries is ticket T-456.

## Parent

E-423 "Rules and rhythm" (R-294), tracer bullet 3 of 7; spec `docs/spec/v0.1.3.md` §3.2; the epic's choices "The file's shape", "Rule ids beside item ids", "The commands and tools" and "Who records a rule", and the 2026-10-14 amendment (plain numbers, no letter prefix); ADR 0002.

## What to build

**The file.** `.cland/RULES.md` starts with a one-line header. Each rule is written:

```markdown
## 3 One suite at a time
Scope: all
Date: 2026-10-14
Status: active
Origin: memory:~/.claude/projects/-Users-evgeniyivanov-Projects-cland-v0/memory/one-suite-at-a-time.md
Reason: two full suites at once cascade into flaky failures.

Run at most one full suite at a time machine-wide; targeted single-file runs are free.
```

- `Scope:` is `all` or a comma-separated list of role names from `roles.toml`.
- `Status:` is `active` or `retired <date>`.
- `Origin:` takes one of these forms:
  - `message:<topic>/<msg_id>`, a human message in a thread;
  - `session:<name>`, an Aide;
  - `shell`;
  - `workbench`;
  - `memory:<path>`, the seed.
- The rule's text is the paragraph after the fields.
- Numbers count up in the file and are never reused. A retired rule stays in the file.

**Parser and writer.** Add a hub module, for example `hub/src/rules/rulebook.ts`, with a pure parse and render pair.

- The writer is the hub. It writes atomically, preserves every other rule byte for byte, and assigns the next number as one more than the highest ever written.
- The hub watches the file as it watches `roles.toml`, so a hand edit or a merge that changes it is re-read.
- A file that does not parse is logged with the line and the reason. The last good version stays in force.
- `cland init` writes an empty rulebook with its header. The header comment in `.cland/.gitignore` names `RULES.md` among the committed files.

**Frames and CLI.** Add frames `rule.add`, `rule.edit`, `rule.retire`, `rule.list` and `rule.show` to `hub/src/protocol.ts`, and `hub/src/cli/rule.ts` wired into the CLI and `usage.ts`:

- `cland rule add <text> --scope <roles>|all --reason <text> [--title <t>] [--origin memory:<path>]`
- `cland rule edit <n> [--text t] [--scope s] [--reason r]`
- `cland rule retire <n> --reason <text>`
- `cland rule list [--all] [--role r]`. Active rules only by default; `--role` filters to the rules in that role's scope.
- `cland rule show <n>`
- Each command takes `--json`. A rule is addressed by its plain number. Printed output writes it `rule <n>`, never `R-<n>`, because `R-` is the release prefix.

**Who may write.** The CLI acts as its caller (`hub/src/cli/actor.ts`).

- The human's shell records origin `shell`, or the `--origin memory:<path>` it names.
- An Aide's shell records `session:<aide-name>`, or `memory:<path>` when it names one. The seed task (04) relies on that.
- Any other session's shell is refused with `forbidden` and the reason: Coordinators record through the `rule.add` tool from a human message (ticket T-456), and other roles propose a rule to the Coordinator.
- An edit or retirement keeps the rule's number and origin and updates `Date:`. A retirement appends its reason to `Reason:`.

**Tests** use the CLI against a temporary project through `hub/test/harness.ts`, and the parser has unit tests.

## Acceptance criteria

- [ ] C1. `cland rule add "…" --scope implementer --reason "…"` from the human's shell writes `## 1 <title>` with `Scope`, `Date`, `Status: active`, `Origin: shell` and `Reason` lines and the text to `.cland/RULES.md`, and the next add gets `2`.
- [ ] C2. `cland rule edit 1 --scope all` and `cland rule retire 1 --reason "…"` rewrite only that rule, keeping its number and origin; a retired rule stays in the file and its number is never reused.
- [ ] C3. `cland rule list --all --json` returns active and retired rules with every field, `cland rule list` returns active ones only, `--role r` filters by scope, and `cland rule show <n>` prints one rule written as `rule <n>`.
- [ ] C4. A hand edit of `.cland/RULES.md` is re-read without a hub restart, and a file that does not parse is logged with its line while the last good rulebook stays in force.
- [ ] C5. From an Aide's shell `cland rule add --origin memory:<path>` records that origin, and from an Implementer's or a Coordinator's shell `cland rule add` is refused with `forbidden` and a reason.
- [ ] C6. `cland init` writes an empty rulebook with its header, and `.cland/.gitignore`'s header names `RULES.md` as committed.
- [ ] C7. `hub/README.md` describes the rulebook file, its fields and origins, the `rule <n>` form, the `cland rule` commands and who may write.
