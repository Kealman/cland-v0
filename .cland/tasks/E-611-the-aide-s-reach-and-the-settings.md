---
id: E-611
kind: epic
title: The Aide's reach and the settings commands
state: closed
criterion_seq: 6
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
updated: 2026-10-19T06:12:00.518Z
closed: 2026-10-19T06:12:00.518Z
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
  - verified: qa-676 [qa] · run qa-2026-10-19-1 · 2026-10-19T06:11:29.358Z · commit e7de5ca728a990243bcaf830fd730743195bead7
- [ ] C2. An Aide imports GitHub issues with `task.import` and publishes `dev` with `cland push`, and `cland task import-github` without `--repo` reads the `github` remote, then `origin`.
  - verified: qa-676 [qa] · run qa-2026-10-19-1 · 2026-10-19T06:11:29.358Z · commit e7de5ca728a990243bcaf830fd730743195bead7
- [ ] C3. `permissions = "auto"` launches Claude Code with `--permission-mode auto` and is the template default for Claude Code roles, `skip` only on the human's choice, while Codex keeps `approval = "never"` with its sandbox and OpenCode its own settings.
  - verified: qa-676 [qa] · run qa-2026-10-19-1 · 2026-10-19T06:11:29.358Z · commit e7de5ca728a990243bcaf830fd730743195bead7
- [ ] C4. `cland role launch` sets a role's launch fields and `cland config set` a config value, each refusing what the hub cannot read, and `cland models <harness>` lists the harness's model ids.
  - verified: qa-676 [qa] · run qa-2026-10-19-1 · 2026-10-19T06:11:29.358Z · commit e7de5ca728a990243bcaf830fd730743195bead7
- [ ] C5. A new project's `crew.toml` gives the Aide sub-agents and its `roles.toml` is built from the installed harnesses, valid with one, and `cland update` never changes an existing `roles.toml`.
  - verified: qa-676 [qa] · run qa-2026-10-19-1 · 2026-10-19T06:11:29.358Z · commit e7de5ca728a990243bcaf830fd730743195bead7
- [ ] C6. An unpinned Claude Code launch passes `CLAUDE_CONFIG_DIR` only when the hub inherited it or the account pins one (T-603), and a rule title is never cut silently and can be edited (T-608).
  - verified: qa-676 [qa] · run qa-2026-10-19-1 · 2026-10-19T06:11:29.359Z · commit e7de5ca728a990243bcaf830fd730743195bead7

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

### qa-676 · 2026-10-19T06:11:29.359Z

verdict: qa
result: clear
by: qa-676 [qa]
run: qa-2026-10-19-1
commit: e7de5ca728a990243bcaf830fd730743195bead7
findings: [{"severity":"medium","text":"X: bug found aside T-829 (Bugs,S). dk X showed 3 scratch processes after both hubs stopped; final inventory confirmed 3 surviving fake harnesses and 3 spokes. Coordinator ruling62134372 excludes this hygiene failure from E-611's criterion gate; X remains FAIL. Lease destruction confirmed."}]
finding_counts: {"high":0,"medium":1,"low":0}

| Case | Result | Command / observation | Evidence |
| --- | --- | --- | --- |
| G0 | PASS | clean named dev SHA, committed brief, Node24.21.0 | [G0.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5809-e-611-qa-qa-2026-10-19-1-complete-demo-evidence/G0.txt) |
| G1 | PASS | 13 children closed and13 merge commits ancestors; criteria C1-C6 match | [G1.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5809-e-611-qa-qa-2026-10-19-1-complete-demo-evidence/G1.txt), [G1-epic.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5809-e-611-qa-qa-2026-10-19-1-complete-demo-evidence/G1-epic.json), [G1-children.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5809-e-611-qa-qa-2026-10-19-1-complete-demo-evidence/G1-children.json) |
| G2 | PASS | QA verifier hold acquired | [G1-epic.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5809-e-611-qa-qa-2026-10-19-1-complete-demo-evidence/G1-epic.json) |
| D0 | PASS | one active demo960280c4 exactS deadline07:13:51.264Z | [D0-start.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5809-e-611-qa-qa-2026-10-19-1-complete-demo-evidence/D0-start.json) |
| BUILD-D1 | FAIL — superseded brief expectation | command -v nvim found no PATH entry; approved resolver correction below supersedes this expectation. | [D1-build.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5809-e-611-qa-qa-2026-10-19-1-complete-demo-evidence/D1-build.txt) |
| BUILD-D1-corrected | PASS | node nvim/bin/nvim-path.ts; resolved binary prints NVIM v0.12.5, pin is v0.12.5: match. | [BUILD-D1-corrected.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5809-e-611-qa-qa-2026-10-19-1-complete-demo-evidence/BUILD-D1-corrected.txt), [D1-build.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5809-e-611-qa-qa-2026-10-19-1-complete-demo-evidence/D1-build.txt), [request.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5809-e-611-qa-qa-2026-10-19-1-complete-demo-evidence/request.txt) |
| K0 | PASS | eight kit files transferred and cksum match | [K0-result.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5809-e-611-qa-qa-2026-10-19-1-complete-demo-evidence/K0-result.txt), [K0-local.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5809-e-611-qa-qa-2026-10-19-1-complete-demo-evidence/K0-local.txt), [K0-remote.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5809-e-611-qa-qa-2026-10-19-1-complete-demo-evidence/K0-remote.txt) |
| S1 | PASS | scratchP1 init/local lock/executor/fake-only PATH/territory remotes; hub running | [S1.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5809-e-611-qa-qa-2026-10-19-1-complete-demo-evidence/S1.txt) |
| A1 | PASS | dk A1: all specified process/clause/grant/lifecycle lines match | [A1.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5809-e-611-qa-qa-2026-10-19-1-complete-demo-evidence/A1.txt) |
| A2 | PASS | dk A2: all specified process/clause/grant/lifecycle lines match | [A2.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5809-e-611-qa-qa-2026-10-19-1-complete-demo-evidence/A2.txt) |
| A3 | PASS | dk A3: all specified process/clause/grant/lifecycle lines match | [A3.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5809-e-611-qa-qa-2026-10-19-1-complete-demo-evidence/A3.txt) |
| A4 | PASS | dk A4: all specified process/clause/grant/lifecycle lines match | [A4.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5809-e-611-qa-qa-2026-10-19-1-complete-demo-evidence/A4.txt) |
| A5 | PASS | dk A5: specified permissions/import/push/remotes and audit checks match | [A5.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5809-e-611-qa-qa-2026-10-19-1-complete-demo-evidence/A5.txt) |
| A6 | PASS | droplet scratch ck_A6; expected assertions observed | [A6.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5809-e-611-qa-qa-2026-10-19-1-complete-demo-evidence/A6.txt) |
| B1 | PASS | dk B1: specified permissions/import/push/remotes and audit checks match | [B1.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5809-e-611-qa-qa-2026-10-19-1-complete-demo-evidence/B1.txt) |
| B2 | PASS | dk B2: specified permissions/import/push/remotes and audit checks match | [B2.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5809-e-611-qa-qa-2026-10-19-1-complete-demo-evidence/B2.txt) |
| B3 | PASS | dk B3: specified permissions/import/push/remotes and audit checks match | [B3.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5809-e-611-qa-qa-2026-10-19-1-complete-demo-evidence/B3.txt) |
| B4 | PASS | Aide release/sync and Implementer import/push refused; push wording forbidden:push equivalent; territory unchanged,GitHub refs0 | [B4.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5809-e-611-qa-qa-2026-10-19-1-complete-demo-evidence/B4.txt) |
| C1 | PASS | dk C1: launch flags/templates/settings/refusals match brief;unchanged file checks pass | [C1.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5809-e-611-qa-qa-2026-10-19-1-complete-demo-evidence/C1.txt) |
| C2 | PASS | dk C2: launch flags/templates/settings/refusals match brief;unchanged file checks pass | [C2.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5809-e-611-qa-qa-2026-10-19-1-complete-demo-evidence/C2.txt) |
| D1 | PASS | dk D1: launch flags/templates/settings/refusals match brief;unchanged file checks pass | [D1.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5809-e-611-qa-qa-2026-10-19-1-complete-demo-evidence/D1.txt) |
| D2 | PASS | dk D2: launch flags/templates/settings/refusals match brief;unchanged file checks pass | [D2.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5809-e-611-qa-qa-2026-10-19-1-complete-demo-evidence/D2.txt) |
| D3 | PASS | dk D3: launch flags/templates/settings/refusals match brief;unchanged file checks pass | [D3.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5809-e-611-qa-qa-2026-10-19-1-complete-demo-evidence/D3.txt) |
| D4 | PASS | dk D4: launch flags/templates/settings/refusals match brief;unchanged file checks pass | [D4.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5809-e-611-qa-qa-2026-10-19-1-complete-demo-evidence/D4.txt) |
| D5 | PASS | droplet scratch ck_D5; expected assertions observed | [D5.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5809-e-611-qa-qa-2026-10-19-1-complete-demo-evidence/D5.txt) |
| D6 | PASS | droplet scratch ck_D6; expected assertions observed | [D6.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5809-e-611-qa-qa-2026-10-19-1-complete-demo-evidence/D6.txt) |
| D7 | PASS | droplet scratch ck_D7; expected assertions observed | [D7.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5809-e-611-qa-qa-2026-10-19-1-complete-demo-evidence/D7.txt) |
| E1 | PASS | droplet scratch ck_E1; expected assertions observed | [E1.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5809-e-611-qa-qa-2026-10-19-1-complete-demo-evidence/E1.txt) |
| E2 | PASS | droplet scratch ck_E2; expected assertions observed | [E2.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5809-e-611-qa-qa-2026-10-19-1-complete-demo-evidence/E2.txt) |
| E3 | PASS | droplet scratch ck_E3; expected assertions observed | [E3.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5809-e-611-qa-qa-2026-10-19-1-complete-demo-evidence/E3.txt) |
| E4 | PASS | droplet scratch ck_E4; expected assertions observed | [E4.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5809-e-611-qa-qa-2026-10-19-1-complete-demo-evidence/E4.txt) |
| F1 | PASS | droplet scratch ck_F1; expected assertions observed | [F1.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5809-e-611-qa-qa-2026-10-19-1-complete-demo-evidence/F1.txt) |
| F2 | PASS | droplet scratch ck_F2; expected assertions observed | [F2.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5809-e-611-qa-qa-2026-10-19-1-complete-demo-evidence/F2.txt) |
| F3 | PASS | droplet scratch ck_F3; expected assertions observed | [F3.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5809-e-611-qa-qa-2026-10-19-1-complete-demo-evidence/F3.txt) |
| X | FAIL | dk X: both hubs stopped, session lists running=0; scratch process count 3. Bug found aside T-829; non-gating by explicit requester ruling. | [X.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5809-e-611-qa-qa-2026-10-19-1-complete-demo-evidence/X.txt) |
| T1 | PASS | droplet: node --test --test-reporter=spec hub/test/aide.test.ts; exit0 fail0; 3/3 tests passed | [T1.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5809-e-611-qa-qa-2026-10-19-1-complete-demo-evidence/T1.txt), [T1-full.log](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5809-e-611-qa-qa-2026-10-19-1-complete-demo-evidence/T1-full.log) |
| T2 | PASS | droplet: node --test --test-reporter=spec hub/test/permissions.test.ts; exit0 fail0; 13/13 tests passed | [T2.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5809-e-611-qa-qa-2026-10-19-1-complete-demo-evidence/T2.txt), [T2-full.log](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5809-e-611-qa-qa-2026-10-19-1-complete-demo-evidence/T2-full.log) |
| T3 | PASS | droplet: node --test --test-reporter=spec hub/test/lead-launch.test.ts; exit0 fail0; 4/4 tests passed | [T3.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5809-e-611-qa-qa-2026-10-19-1-complete-demo-evidence/T3.txt), [T3-full.log](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5809-e-611-qa-qa-2026-10-19-1-complete-demo-evidence/T3-full.log) |
| T4 | PASS | droplet: node --test --test-reporter=spec hub/test/lead-permissions.test.ts; exit0 fail0; 2/2 tests passed | [T4.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5809-e-611-qa-qa-2026-10-19-1-complete-demo-evidence/T4.txt), [T4-full.log](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5809-e-611-qa-qa-2026-10-19-1-complete-demo-evidence/T4-full.log) |
| T5 | PASS | droplet: node --test --test-reporter=spec hub/test/aide-permissions.test.ts; exit0 fail0; 2/2 tests passed | [T5.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5809-e-611-qa-qa-2026-10-19-1-complete-demo-evidence/T5.txt), [T5-full.log](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5809-e-611-qa-qa-2026-10-19-1-complete-demo-evidence/T5-full.log) |
| T6 | PASS | droplet: node --test --test-reporter=spec hub/test/aide-import-cli.test.ts; exit0 fail0; 2/2 tests passed | [T6.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5809-e-611-qa-qa-2026-10-19-1-complete-demo-evidence/T6.txt), [T6-full.log](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5809-e-611-qa-qa-2026-10-19-1-complete-demo-evidence/T6-full.log) |
| T7 | PASS | droplet: node --test --test-reporter=spec hub/test/aide-component.test.ts; exit0 fail0; 5/5 tests passed | [T7.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5809-e-611-qa-qa-2026-10-19-1-complete-demo-evidence/T7.txt), [T7-full.log](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5809-e-611-qa-qa-2026-10-19-1-complete-demo-evidence/T7-full.log) |
| T8 | PASS | droplet: node --test --test-reporter=spec hub/test/push.test.ts; exit0 fail0; 13/13 tests passed | [T8.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5809-e-611-qa-qa-2026-10-19-1-complete-demo-evidence/T8.txt), [T8-full.log](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5809-e-611-qa-qa-2026-10-19-1-complete-demo-evidence/T8-full.log) |
| T9 | PASS | droplet: node --test --test-reporter=spec hub/test/roles-launch-permissions.test.ts; exit0 fail0; 3/3 tests passed | [T9.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5809-e-611-qa-qa-2026-10-19-1-complete-demo-evidence/T9.txt), [T9-full.log](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5809-e-611-qa-qa-2026-10-19-1-complete-demo-evidence/T9-full.log) |
| T10 | PASS | droplet: node --test --test-reporter=spec hub/test/claude-code-environment.test.ts; exit0 fail0; 5/5 tests passed | [T10.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5809-e-611-qa-qa-2026-10-19-1-complete-demo-evidence/T10.txt), [T10-full.log](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5809-e-611-qa-qa-2026-10-19-1-complete-demo-evidence/T10-full.log) |
| T11 | PASS | droplet: node --test --test-reporter=spec hub/test/session-resume-component.test.ts; exit0 fail0; 3/3 tests passed | [T11.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5809-e-611-qa-qa-2026-10-19-1-complete-demo-evidence/T11.txt), [T11-full.log](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5809-e-611-qa-qa-2026-10-19-1-complete-demo-evidence/T11-full.log) |
| T12 | PASS | droplet: node --test --test-reporter=spec hub/test/codex-adapter.test.ts; exit0 fail0; 12/12 tests passed | [T12.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5809-e-611-qa-qa-2026-10-19-1-complete-demo-evidence/T12.txt), [T12-full.log](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5809-e-611-qa-qa-2026-10-19-1-complete-demo-evidence/T12-full.log) |
| T13 | PASS | droplet: node --test --test-reporter=spec hub/test/opencode-adapter.test.ts; exit0 fail0; 14/14 tests passed | [T13.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5809-e-611-qa-qa-2026-10-19-1-complete-demo-evidence/T13.txt), [T13-full.log](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5809-e-611-qa-qa-2026-10-19-1-complete-demo-evidence/T13-full.log) |
| T14 | PASS | droplet: node --test --test-reporter=spec hub/test/role-launch.test.ts; exit0 fail0; 13/13 tests passed | [T14.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5809-e-611-qa-qa-2026-10-19-1-complete-demo-evidence/T14.txt), [T14-full.log](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5809-e-611-qa-qa-2026-10-19-1-complete-demo-evidence/T14-full.log) |
| T15 | PASS | droplet: node --test --test-reporter=spec hub/test/roles-editor.test.ts; exit0 fail0; 11/11 tests passed | [T15.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5809-e-611-qa-qa-2026-10-19-1-complete-demo-evidence/T15.txt), [T15-full.log](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5809-e-611-qa-qa-2026-10-19-1-complete-demo-evidence/T15-full.log) |
| T16 | PASS | droplet: node --test --test-reporter=spec hub/test/config-set.test.ts; exit0 fail0; 8/8 tests passed | [T16.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5809-e-611-qa-qa-2026-10-19-1-complete-demo-evidence/T16.txt), [T16-full.log](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5809-e-611-qa-qa-2026-10-19-1-complete-demo-evidence/T16-full.log) |
| T17 | PASS | droplet: node --test --test-reporter=spec hub/test/plan-approval-reload.test.ts; exit0 fail0; 2/2 tests passed | [T17.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5809-e-611-qa-qa-2026-10-19-1-complete-demo-evidence/T17.txt), [T17-full.log](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5809-e-611-qa-qa-2026-10-19-1-complete-demo-evidence/T17-full.log) |
| T18 | PASS | droplet: node --test --test-reporter=spec hub/test/models.test.ts; exit0 fail0; 6/6 tests passed | [T18.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5809-e-611-qa-qa-2026-10-19-1-complete-demo-evidence/T18.txt), [T18-full.log](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5809-e-611-qa-qa-2026-10-19-1-complete-demo-evidence/T18-full.log) |
| T19 | PASS | droplet: node --test --test-reporter=spec nvim/test/launcher-component.test.ts; exit0 fail0; 8/8 tests passed | [T19.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5809-e-611-qa-qa-2026-10-19-1-complete-demo-evidence/T19.txt), [T19-full.log](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5809-e-611-qa-qa-2026-10-19-1-complete-demo-evidence/T19-full.log) |
| T20 | PASS | droplet: node --test --test-reporter=spec hub/test/roles-template.test.ts; exit0 fail0; 6/6 tests passed | [T20.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5809-e-611-qa-qa-2026-10-19-1-complete-demo-evidence/T20.txt), [T20-full.log](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5809-e-611-qa-qa-2026-10-19-1-complete-demo-evidence/T20-full.log) |
| T21 | PASS | droplet: node --test --test-reporter=spec hub/test/roles-template-component.test.ts; exit0 fail0; 2/2 tests passed | [T21.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5809-e-611-qa-qa-2026-10-19-1-complete-demo-evidence/T21.txt), [T21-full.log](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5809-e-611-qa-qa-2026-10-19-1-complete-demo-evidence/T21-full.log) |
| T22 | PASS | droplet: node --test --test-reporter=spec hub/test/crew.test.ts; exit0 fail0; 8/8 tests passed | [T22.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5809-e-611-qa-qa-2026-10-19-1-complete-demo-evidence/T22.txt), [T22-full.log](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5809-e-611-qa-qa-2026-10-19-1-complete-demo-evidence/T22-full.log) |
| T23 | PASS | droplet: node --test --test-reporter=spec hub/test/aide-migration.test.ts; exit0 fail0; 7/7 tests passed | [T23.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5809-e-611-qa-qa-2026-10-19-1-complete-demo-evidence/T23.txt), [T23-full.log](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5809-e-611-qa-qa-2026-10-19-1-complete-demo-evidence/T23-full.log) |
| T24 | PASS | droplet: node --test --test-reporter=spec hub/test/claude-code-adapter.test.ts; exit0 fail0; 6/6 tests passed | [T24.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5809-e-611-qa-qa-2026-10-19-1-complete-demo-evidence/T24.txt), [T24-full.log](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5809-e-611-qa-qa-2026-10-19-1-complete-demo-evidence/T24-full.log) |
| T25 | PASS | droplet: node --test --test-reporter=spec hub/test/rule-sessions.test.ts; exit0 fail0; 3/3 tests passed | [T25.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5809-e-611-qa-qa-2026-10-19-1-complete-demo-evidence/T25.txt), [T25-full.log](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5809-e-611-qa-qa-2026-10-19-1-complete-demo-evidence/T25-full.log) |
| D14 | PASS | local freshness after all cases: current=true | [D14-dev.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5809-e-611-qa-qa-2026-10-19-1-complete-demo-evidence/D14-dev.txt), [D14-status.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5809-e-611-qa-qa-2026-10-19-1-complete-demo-evidence/D14-status.json) |
| D15 | PASS | hub confirmed released and destroyed comment; lifetime701769ms cost$0.048733958333333334 | [D15-stop.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5809-e-611-qa-qa-2026-10-19-1-complete-demo-evidence/D15-stop.json), [D15-after.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5809-e-611-qa-qa-2026-10-19-1-complete-demo-evidence/D15-after.json), [D15-comments.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5809-e-611-qa-qa-2026-10-19-1-complete-demo-evidence/D15-comments.txt) |

Findings, by severity:

- High: none.
- Medium — X, bug found aside **T-829** (Bugs, S, qa-found). `dk X` stopped both scratch hubs with exit 0 and both session lists reported zero running, but the process count was 3 after five seconds. Read-only probes found the original children 3823/4642/5411 and surviving fake Claude parents 3780/4597/5368, all reparented to pid 1. The parents belong to aide-1, worker-1 and impl-1, which the clean hub restart had marked exited. None was a kit helper. The initial matched children exited before exact classification. The final cwd-aware inventory found six survivors: fake harnesses 3780/4597/5368 and their real cland spokes 3787/4606/5382, all executable basename node. See [F2](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5809-e-611-qa-qa-2026-10-19-1-complete-demo-evidence/F2.txt), [X](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5809-e-611-qa-qa-2026-10-19-1-complete-demo-evidence/X.txt), [safe probe](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5809-e-611-qa-qa-2026-10-19-1-complete-demo-evidence/X-diagnostic.txt), [classification](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5809-e-611-qa-qa-2026-10-19-1-complete-demo-evidence/X-classification.txt), and [pre-release inventory](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5809-e-611-qa-qa-2026-10-19-1-complete-demo-evidence/X-before-release.txt). No signals, fixes, or scratch reruns were applied; lease destruction cleans the survivors.
- Low: no new finding. D7 reproduces the already-filed **T-828** push help wording (`Coordinator’s shell or human`), which omits the Aide. B2 demonstrates that the Aide push succeeds. The requester explicitly excluded it as a new finding.

Requester rulings and verdict scope:

- BUILD-D1 is a duplicate ID in the brief: the build check is named BUILD-D1 here, while the role settings case keeps D1. Both were executed. A project rule requiring unique check IDs was proposed to the Coordinator.
- Ruling f31708de-636c-4b76-890d-3329afed4826 corrects the Neovim PATH expectation: the pinned binary is installed outside PATH and resolved with `node nvim/bin/nvim-path.ts`. The original FAIL stays visible; BUILD-D1-corrected PASS supersedes that erroneous brief expectation. T19 remains unchanged.
- Ruling 62134372-fd11-4237-ad9a-edb604ce8afb classifies X as run hygiene with no E-611 criterion and explicitly removes it from the verdict gate. **X remains FAIL**, filed as T-829. The verdict is **clear for C1–C6 under this ruling**, not a claim that every original brief check passed.

Criterion marks for this run:

| Criterion | Result | Checks |
| --- | --- | --- |
| C1 | PASS / verified | A1–A6, T1–T4 |
| C2 | PASS / verified | B1–B4, T5–T8 |
| C3 | PASS / verified | C1, C2, E2, T9–T13 |
| C4 | PASS / verified | D1–D7, T14–T19 |
| C5 | PASS / verified | E1, E3, E4, T20–T22 |
| C6 | PASS / verified | C1, E2, F1–F3, T10, T24, T25 |

Run and lease:

- Item E-611; run `qa-2026-10-19-1`; tested full SHA `e7de5ca728a990243bcaf830fd730743195bead7`; brief committed at the same SHA. Thirteen children were closed and all thirteen merge commits were ancestors.
- Executor droplet; machine `cland-v0-960280c4`; one lease `960280c4-a6c2-4c71-bc8d-ef8f570f16d4`; Linux x86_64; Node v24.21.0; Neovim v0.12.5. Created 2026-10-19T05:58:53.045Z; deadline 2026-10-19T07:13:51.264Z. Final state **released**; lifetime **701769 ms**; total remote cost **$0.04873396**. Costs in per-case records are cumulative snapshots and must not be summed.
- Total wall time from hold acquisition through final accounting: approximately 777.4 seconds; total billed remote cost $0.04873396.
- Part S used the eight-file committed kit, transferred with matching checksums. Part T ran **25 files / 161 tests**, sequentially on the same lease. No flaky rerun was needed. No full-suite verify was submitted, as the requester and brief expressly prohibited it.
- G0–G2, D14 and D15 were local read-only/control checks; execution cases were remote. D14 reports freshness.current=true. D15 confirms release with the hub’s created/destroyed comments. Scratch hubs and fakes were isolated from the live root and external services.

Accepted coverage limits:

- Aide shell actions were end-to-end through the fake harness; its tool used a real spoke with the Aide identity. Human prompts used the UI frame. GitHub issues came from fake gh; push used a local Git territory.
- Origin fallback is covered by T6; Codex/OpenCode launch policies by T12/T13; launcher model focus by T19; signed-out notices by T24; rule delivery to running sessions by T25; Aide migration by T23. Existing sessions retaining their old explicit config directory is the accepted T-603 limit.
- No real harness/model, external GitHub, live workbench, or root Aide migration was exercised. The root migration remains the Coordinator’s responsibility.

Full request and correction record: [request.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5809-e-611-qa-qa-2026-10-19-1-complete-demo-evidence/request.txt). Exact committed brief: [brief.md](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5809-e-611-qa-qa-2026-10-19-1-complete-demo-evidence/brief.md). Every case record: [run-records.jsonl](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5809-e-611-qa-qa-2026-10-19-1-complete-demo-evidence/run-records.jsonl).

Evidence bundle: A-5809, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5809-e-611-qa-qa-2026-10-19-1-complete-demo-evidence

Verdict report A-5810: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5810-e-611-qa-verdict-c1-c6-clear-x-failure-filed-t-829.md

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified.

### coord · 2026-10-19T06:12:00.518Z

Closed on QA clear qa-2026-10-19-1 at e7de5ca7 (C1–C6; evidence A-5809, report A-5810). Found aside: T-829 (restart leaves live harness sessions), T-828 (push help line).
