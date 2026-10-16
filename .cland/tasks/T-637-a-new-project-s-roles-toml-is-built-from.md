---
id: T-637
kind: task
title: A new project's roles.toml is built from the installed harnesses, Claude Code roles on auto, and the Aide gets sub-agents
state: open
status: backlog
size: M
labels:
  - v0.1.4
  - hub
assignee: null
parent: E-611
blocked_by:
  - T-629
  - T-630
  - T-631
topic: null
branch: null
created: 2026-10-16T16:04:13.028Z
updated: 2026-10-16T16:04:14.566Z
---

## Summary

`cland init` writes a `roles.toml` built from the harnesses installed at that moment, valid with only one, with every Claude Code role on `permissions = "auto"` and every Codex role on `approval = "never"` with its role's sandbox, and a `crew.toml` that gives the Aide sub-agents. `cland update` never changes an existing `roles.toml` (spec v0.1.4 §3.5, map decision 12).

## What to build

- **Installed harnesses.** Found as doctor finds them: the binary on the PATH, its override variable, and the installers' own folders (`~/.local/bin`, `~/.opencode/bin`, as setup's prototype searches).
- **Each role's harness.** A role keeps its shipped harness when it is installed (the Coordinator, Leads and the Aide on Claude Code, the Implementer on OpenCode, the Reviewer and QA on Codex); otherwise it takes the first installed in the order Claude Code, Codex, OpenCode. With none installed, init writes the shipped mapping and its report says that no harness was found.
- **Model and effort.** A role on its shipped harness keeps its shipped model and effort; a role moved to another harness gets that harness's default model (`model = ""`) and an effort it takes (Claude Code `max`, Codex `high`, OpenCode none).
- **The guard.** Claude Code roles get `permissions = "auto"`, never `skip`, which only the human's explicit choice writes. Codex roles get `approval = "never"` with the role's sandbox: the Reviewer `read-only`, the Implementer `workspace-write`, QA `danger-full-access` (T-65), the Aide `workspace-write`, the Coordinator and Leads as the Coordinator decides (README question). OpenCode roles carry no `permissions`, `approval` or `sandbox` key: OpenCode keeps its own settings.
- **The build is recorded.** The template's header names the harnesses it was built from, so that setup (E-613) can tell a file nobody has edited and rebuild it after installing a harness, if the plan says so.
- **The other writer.** A hub started on a project without `roles.toml` writes the same template from the harnesses installed then. The built-in fallback the hub uses for keys a file leaves out stays the shipped mapping on every machine.
- **Crew.** The crew template sets `subagents = true` under `[crew.aide]`.
- **Update.** `cland update` leaves an existing `roles.toml` and `crew.toml` byte-identical, as today. The hub README's table of role defaults follows the new template.

## Acceptance criteria

- [ ] C1. `cland init` with only the fake Claude Code on the PATH writes a roles.toml whose six roles all launch on claude-code with `permissions = "auto"`, and the hub loads it without error (init test).
- [ ] C2. With only the fake Codex installed, every role launches on codex with `approval = "never"`, `model = ""`, an effort Codex takes and its role's sandbox (Reviewer read-only, Implementer workspace-write, QA danger-full-access, Aide workspace-write, Coordinator and Lead as decided).
- [ ] C3. With all three installed the roles keep their shipped harnesses and models with the Claude Code ones on auto, and with none installed init writes the shipped mapping and its report says no harness was found.
- [ ] C4. No template role carries `skip`, and no OpenCode role carries `permissions`, `approval` or `sandbox` (template test over every installed set).
- [ ] C5. A new project's crew.toml has `subagents = true` under `[crew.aide]`, and `cland crew show` reports it.
- [ ] C6. `cland update` on a project with an edited roles.toml and crew.toml leaves both byte-identical (update test).
- [ ] C7. A hub started without roles.toml writes the template from the harnesses installed then, while the built-in fallback for missing keys is the same on every machine (test with two PATHs).
- [ ] C8. The template's header records the harnesses it was built from, and a check reports whether a roles.toml is still exactly the template it records (unit test).
- [ ] C9. Demo: in a scratch project with one installed fake harness, `cland init`, `cland role list` and an Aide launch show the valid template and, on Claude Code, a launch with `--permission-mode auto`.
