---
id: T-289
kind: task
title: "Claude Code launches can skip permissions: a roles.toml launch option passes --dangerously-skip-permissions"
state: closed
status: done
rank: 1730
criterion_seq: 3
labels:
  - ready-for-agent
assignee: null
parent: T-216
blocked_by: []
topic: topic-172
branch: t/T-289-claude-code-launches-can-skip
created: 2026-10-12T12:05:11.282Z
updated: 2026-10-12T12:15:19.370Z
---

Human request (2026-10-12): hub-launched Claude Code sessions should be able to run with `claude --dangerously-skip-permissions`, chosen per role in roles.toml, the same way Codex roles choose `approval` and `sandbox`.

Why: today the Claude Code adapter (hub/src/adapters/claude-code.ts, #launch) passes `--bg --session-id --name --model --effort --mcp-config --settings --plugin-dir` and nothing about permissions, so a launched session takes the user's global permission mode (here `auto`, whose classifier refused the Coordinator's own docs edits and tracker work twice today). Setting `permissions.defaultMode = bypassPermissions` in .claude/settings.local.json only applied after a stale pre-spawned `--bg-spare` process was killed, and the human wants the explicit flag, which is the documented way.

Scope:
- A Claude Code launch option in roles.toml, e.g. `[coordinator.launch] permissions = "skip"` (values: "" the harness's own, "skip" = --dangerously-skip-permissions); documented next to the Codex approval/sandbox options in the roles.toml comments and docs.
- The adapter appends the flag on launch and on relaunch/resume; the CLI check at hub start warns when the flag is unsupported by the installed claude.
- Default off; the project's roles.toml sets it for the Coordinator (and other Claude Code roles) per the human's decision for this machine.
- Tests at the adapter seam (argument list), no real harness needed.

Relates to T-272 (accounts and limits) only loosely; it is a launch option, not an account one.

## Acceptance criteria

- [ ] C1. The option is documented beside Codex's approval and sandbox: the default roles.toml comments, hub/README.md and docs/review-and-qa.md. (The start-up CLI check warning was waived by the stand-in under D24 on 2026-10-12.)
- [ ] C2. This project's .cland/roles.toml sets permissions = "skip" for the Coordinator and the other Claude Code launch tables (lead), per the human's decision of 2026-10-12; `npm run typecheck` and the targeted tests pass, and cland verify is green.
- [ ] C3. permissions in [<role>.launch] takes "" (the default) or "skip"; "skip" appends --dangerously-skip-permissions on launch and on relaunch/resume; any other value is refused at launch naming the two values

## Comments

### coord · 2026-10-12T12:10:49.312Z

Waivers recorded (the stand-in cland-impl under D24, 2026-10-12, consistent with the human's "minimal, no tests" instruction): the adapter-seam tests and the start-up CLI check warning are waived for this item; C1 was edited to the docs part only. The branch was implemented in the human's shell (claim "human"); the Coordinator acts as its lead for review, verify and merge. Topic: topic-172.

### human · 2026-10-12T12:11:49.038Z

Merged 71ecabed5a61b130a55b73e52fe294f95d9aa5e2 onto dev.
Human override: Human decision 2026-10-12: land the Coordinator's --dangerously-skip-permissions launch option at once, without review or suite; the auto-mode classifier blocks the Coordinator's own work until it runs with the flag. Review follows later.
