---
id: E-611
kind: epic
title: The Aide's reach and the settings commands
state: open
labels:
  - epic
  - v0.1.4
  - ready-for-agent
assignee: null
parent: R-577
blocked_by: []
topic: topic-556
branch: null
created: 2026-10-16T15:34:13.285Z
updated: 2026-10-19T06:10:46.631Z
---

## Summary

The Aide gets the reach the onboarding needs: on the human's word it launches, stops and resumes sessions of any role, imports GitHub issues and pushes `dev`. Claude Code roles default to auto mode instead of a prompt per command or no guard at all, every setting the onboarding records gets a command of its own, and two bugs the live tries met (T-603, T-608) are fixed.

## Goal

A session acts for the human, and the human is asked for decisions, never for keystrokes. In the two live onboarding runs (Q-596) the Aide could not start the Coordinator or import the open issues: the Aide's fixed tool boundary (v0.1 §3.3) refuses it `session.launch`, `session.stop`, `session.resume` and `push`, no role holds `task.import`, and a `cland` call from a session's shell is checked as that session's own (prototype/onboarding 36c09717), so the human had to type the commands. The onboarding edited `.cland/roles.toml` by hand for lack of a command, needed several probes to find a model id (OpenCode's `models` printed nothing), and could run Claude Code roles only with a prompt per command or with every guard off. An unpinned Claude Code launch runs on an empty profile, signed out and untrusted (T-603), and a rule title is cut at 80 characters without a word (T-608).

## Contents

- **The Aide's tools** (Q-600 resolution 1). The Aide's fixed tool boundary and its default grants gain `session.launch`, `session.stop` and `session.resume` for any role, the Coordinator first of all, `task.import`, and `push` for the onboarding's commit. The grants cover its `session.launch` tool and its `cland` calls from the shell, the only place where `cland session stop`, `cland session resume`, `cland task import-github` and `cland push` run. Its clause says it launches, stops and resumes sessions only on the human's word, and that during a build the Coordinator keeps the crew's staffing.
- **`permissions = "auto"`** (Q-600 resolution 3). A new value of `[<role>.launch] permissions` launches Claude Code with `--permission-mode auto`. The roles template writes it for every Claude Code role; `skip` (`--dangerously-skip-permissions`) is written only on the human's explicit choice. Codex roles keep their sandbox with `approval = "never"`, the sandbox being the guard, and OpenCode keeps its own settings.
- **`cland role launch <role> --harness … --model … --effort … --account … --permissions …`** (Q-600 resolution 4). Sets the `[<role>.launch]` fields of `.cland/roles.toml` and refuses a value the hub cannot read. `cland role set` keeps its meaning: it assigns a role to a session.
- **`cland config set <section.key> <value>`** (Q-600 resolution 4). Sets one value of `.cland/config.toml` and refuses a key or value the hub cannot read: `plan.approval` for the onboarding's answer "I approve epic plans", and the `[verification]` commands of "Verification for any stack".
- **`cland models <harness>`** (Q-600 question 17, resolution 4). The harness's model ids from a probe of its model list, cached, for the onboarding's crew round and the launcher's model field.
- **`cland task import-github` without `--repo`** reads the `github` remote, then `origin` (Q-600 question 2): `cland init` renames a clone's `origin` to `github`.
- **Template defaults** (Q-600 resolution 3, map decision 12). A new project's `crew.toml` gives the Aide sub-agents (`aide.subagents = true`). Its `roles.toml` is built from the installed harnesses, so a project on one harness is valid. `cland update` never changes an existing `roles.toml`.
- **T-603.** An unpinned Claude Code launch, and its resume, pass `CLAUDE_CONFIG_DIR` only when the hub inherited it or the account pins a directory; the signed-out notice and the launch remedy print the variable only when it is set. The prototype fix with its test (prototype/onboarding 7acc4890) does not cover sessions recorded before the change, which keep the explicit default on relaunch.
- **T-608.** A rule title is never cut silently: the limit is announced in the tool's description and in the add result with the full text kept, or the limit goes; `rule.edit` changes a title.

Not in this epic: `cland setup` and the onboarding skill, which use these tools ("Setup: the guided step ending in the workbench", "The onboarding skill and the newcomer's first page"); the `[verification]` keys themselves ("Verification for any stack").

Left to the spec (§3.5) and the plan:

- When the roles template is built from the installed harnesses: at `cland init` from the harnesses installed then, and whether `cland setup` rebuilds a template nobody has edited after it installs a harness.
- How `cland models` probes each harness, and how long its cache lives.

## Tracer-bullet order

1. **The Aide's session tools.** The grants, the clause and the refusals for other roles. Demo: in a scratch project with the fake harnesses, an Aide launches a Coordinator with its tool and an Implementer from its shell, stops and resumes them from its shell, and an Implementer making the same calls is refused.
2. **Import and push.** `task.import` and `push` for the Aide, and the remote fallback. Demo: an Aide imports a fake repository's open issues through a fake `gh` in a project whose GitHub remote is `github`, then runs `cland push`.
3. **Auto mode and the template defaults.** `permissions = "auto"`, the roles template from the installed harnesses, `aide.subagents`. Demo: a project with one installed harness gets a valid roles template with its Claude Code roles on `auto`, and a Claude Code launch carries `--permission-mode auto`.
4. **The settings commands.** `cland role launch`, `cland config set`, `cland models`. Demo: each writes or lists a value that `cland role list`, the hub and the launcher read back, and a wrong value is refused with its reason.
5. **The two bugs.** Demo: a launch from a clean hub environment spawns Claude Code without `CLAUDE_CONFIG_DIR` while a pinned account still gets its directory, and a long rule title is kept or announced as cut, then changed with `rule.edit`.

## Definition of done

QA runs the demo below on `dev` with the fake harnesses, through the demo lease where no macOS is needed, playing the human through the `cland` CLI, and records a clear verdict on this epic with each checkbox verified by its id; the epic then closes.

In a scratch project, QA asks an Aide to launch a Coordinator, then to stop and resume it, and sees an Implementer refused the same calls. The Aide imports a fake repository's open issues and runs `cland push`. `cland role launch`, `cland config set` and `cland models` write and list values the hub reads back, and refuse a wrong one. A project on one installed harness gets a valid crew and roles template with its Claude Code roles on auto mode. A Claude Code launch from a clean hub environment carries no `CLAUDE_CONFIG_DIR`, and a long rule title is kept or announced, and can be edited.

- [ ] C1. An Aide launches, stops and resumes a session of any role, with its tool or `cland` in its shell, its clause limits that to the human's word, and every other role keeps its refusals.
- [ ] C2. An Aide imports GitHub issues with `task.import` and publishes `dev` with `cland push`, and `cland task import-github` without `--repo` reads the `github` remote, then `origin`.
- [ ] C3. `permissions = "auto"` launches Claude Code with `--permission-mode auto` and is the template default for Claude Code roles, `skip` only on the human's choice, while Codex keeps `approval = "never"` with its sandbox and OpenCode its own settings.
- [ ] C4. `cland role launch` sets a role's launch fields and `cland config set` a config value, each refusing what the hub cannot read, and `cland models <harness>` lists the harness's model ids.
- [ ] C5. A new project's `crew.toml` gives the Aide sub-agents and its `roles.toml` is built from the installed harnesses, valid with one, and `cland update` never changes an existing `roles.toml`.
- [ ] C6. An unpinned Claude Code launch passes `CLAUDE_CONFIG_DIR` only when the hub inherited it or the account pins one (T-603), and a rule title is never cut silently and can be edited (T-608).

## Constraints

- **Standing rules.** Every artifact, item, commit and doc in English. Sub-agents never use the hub: the cland tools belong to the session that started them. Only `cland release` pushes to GitHub: commit on the task branch `t/<id>-<slug>` in its worktree, push it to `origin`, the local territory, and reach `dev` only through `cland merge` and its verdict gate. Suites run through `cland verify` (D25 and D29 of v0.1 §4). The hub's frame protocol is the first test seam (a real hub, a real spoke, the CLI against a temporary project; `hub/test/harness.ts`), the fake harnesses in `hub/test/fakes/` the second, with the Neovim UI headless from the protocol's other side; no new seams inside the hub. Items are written through `cland task` and the task tools, never as hand-written item files. The DigitalOcean token is never stored.
- **The prototypes.** prototype/onboarding and prototype/setup are never merged; the implementation takes from them what fits (Q-601 resolution 5), T-603's fix included.
- **ADRs.** 0001 (Roles are hub-held state): the Aide's reach is a grant in the hub's permission table and a line in its clause, never a harness setting.
- **Tests.** The grants are tested through the frame protocol with the fake harnesses, both from a session's tools and from `cland` calls in its shell; `cland models` against fake harnesses that list models; T-603 against the adapter, as the prototype's test does.
- **Risks.**
  - Role tools are fixed at launch: a running Aide gets the new tools only after the hub restarts and the Aide is relaunched.
  - Claude Code's auto-mode classifier refused the Aide's own `cland role list` after it set `skip` for its role ("self-modification", Q-600). The Aide's change to its own launch settings goes through `cland role launch`, may still be flagged, and takes effect at its next launch.
  - An Aide that launches sessions could compete with the Coordinator's staffing; its clause keeps its launches to the human's word.
  - Every existing `roles.toml` lists the Aide's tools explicitly and `cland update` never changes it, so an existing project, this one included, gets the new grants only when its list gains them; the plan says how that list is extended.
- **Order.** First in the hub lane, with no blocker, since it is small and unblocks the rest: "Setup: the guided step ending in the workbench" and "Verification for any stack" wait for it, and so does "The onboarding skill and the newcomer's first page" in the skills lane.

## Links

- Spec: `docs/spec/v0.1.4.md`, §3.5 (The Aide's reach and the defaults), §3.8 (Hygiene) and §4 (The cut).
- Items: map M-591, decisions 12 and 15; Q-600 (questions 1, 2, 5, 10, 12, 14 and 17, the prototype's facts and the resolution); Q-596 (the refusals the live runs met); T-603 and T-608, filed in Bugs (C-325); Q-593 (where T-603 was found).
- Prototype: prototype/onboarding 7acc4890 (T-603's fix and its test) and 36c09717 (a session's shell carries its identity), never merged.
- Code: `hub/src/roles/permissions.ts` (`decide`), `hub/src/roles/default-roles.ts`, `hub/src/roles/config.ts`, `hub/src/adapters/contract.ts` (`PERMISSIONS`), `hub/src/adapters/claude-code.ts`, `hub/src/crew.ts`, `hub/src/cli/role.ts`, `hub/src/init/config.ts`, `hub/src/cli/task-import.ts`, `hub/src/rules/file.ts`.
- Skills: `plan-epic`, `qa`.
- GLOSSARY: Aide, Role, Role clause, Crew, Adapter.

## Plan

```yaml
stages:
  - name: reach, adapter and settings commands
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-629
        - T-630
      - - T-603
        - T-631
      - - T-628
        - T-632
      - - T-633
        - T-634
      - - T-635
      - - T-608
  - name: existing projects, new templates and the launcher
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-636
        - T-637
      - - T-638
```

## Comments

### human · 2026-10-16T15:36:05.821Z

On the flagged risk (existing roles.toml files list the Aide's tools explicitly and update never rewrites them): the design session's recommendation for the plan is a one-time migration at the first hub start of 0.1.4 that appends the new Aide tools (session.launch, session.stop, session.resume, task.import, push) to an existing [aide.permissions] tools list and reports the change in Agents, so this repository's Aide gets the reach without a hand edit; the fixed boundary in decide() widens accordingly.

### coord · 2026-10-16T16:04:29.444Z

Coordinator decisions on the ticket cut (D51), 2026-10-16: (1) the migration records 'once' as a comment line in roles.toml; (2) it replaces the v0.1.3 Aide clause line ('cannot launch, stop, resume or push') when verbatim; (3) Codex sandbox for the Coordinator and Leads: danger-full-access; T-630 proves the Aide's cland push under its sandbox with a test; (4) fallback harness order Claude Code, Codex, OpenCode, model empty, that harness's default effort; (5) the template is built at init and rebuilt by setup only while unedited (rebuild in E-613); (6) cland models claude-code returns a static alias list labelled static; cache per harness and account for 24 h; (7) cland role launch: human, Coordinator and Aide, not a Lead; needs a running hub; (8) cland config set refuses a config.toml without the managed mark; (9) T-634 stays in E-611; (10) T-638 stays in E-611; (11) T-603 and T-608 have criteria (T-608 keeps the whole title); (12) this repo's Aide gets its reach after T-636 merges, the hub restarts and the Aide is relaunched: on the stage-2 close checklist, before the demo.

### hub · 2026-10-19T06:00:07.599Z

demo 960280c4-a6c2-4c71-bc8d-ef8f570f16d4 created: droplet cland-v0-960280c4, commit e7de5ca728a990243bcaf830fd730743195bead7, deadline 2026-10-19T07:13:51.264Z.

### hub · 2026-10-19T06:10:46.631Z

demo 960280c4-a6c2-4c71-bc8d-ef8f570f16d4 destroyed: lifetime 701769 ms; cost $0.0487.
