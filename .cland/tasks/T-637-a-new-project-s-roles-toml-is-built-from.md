---
id: T-637
kind: task
title: A new project's roles.toml is built from the installed harnesses, Claude Code roles on auto, and the Aide gets sub-agents
state: open
status: review
size: M
criterion_seq: 9
labels:
  - v0.1.4
  - hub
assignee: null
parent: E-611
blocked_by:
  - T-629
  - T-630
  - T-631
topic: topic-535
branch: t/T-637-a-new-project-s-roles-toml-is-built-from
created: 2026-10-16T16:04:13.028Z
updated: 2026-10-18T22:23:35.561Z
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

- [x] C1. `cland init` with only the fake Claude Code on the PATH writes a roles.toml whose six roles all launch on claude-code with `permissions = "auto"`, and the hub loads it without error (init test).
  - done: impl-637 · 2026-10-18T22:18:59.306Z
- [x] C2. With only the fake Codex installed, every role launches on codex with `approval = "never"` and its role's sandbox (Reviewer read-only, Implementer workspace-write, QA danger-full-access, Aide workspace-write, Coordinator and Lead danger-full-access); roles moved to Codex get `model = ""` and an effort Codex takes, while the Reviewer and QA, already on Codex, keep their shipped model and effort.
  - done: impl-637 · 2026-10-18T22:18:59.647Z
- [x] C3. With all three installed the roles keep their shipped harnesses and models with the Claude Code ones on auto, and with none installed init writes the shipped mapping and its report says no harness was found.
  - done: impl-637 · 2026-10-18T22:19:00.084Z
- [x] C4. No template role carries `skip`, and no OpenCode role carries `permissions`, `approval` or `sandbox` (template test over every installed set).
  - done: impl-637 · 2026-10-18T22:19:00.419Z
- [x] C5. A new project's crew.toml has `subagents = true` under `[crew.aide]`, and `cland crew show` reports it.
  - done: impl-637 · 2026-10-18T22:19:00.852Z
- [x] C6. `cland update` on a project with an edited roles.toml and crew.toml leaves both byte-identical (update test).
  - done: impl-637 · 2026-10-18T22:19:01.201Z
- [x] C7. A hub started without roles.toml writes the template from the harnesses installed then, while the built-in fallback for missing keys is the same on every machine (test with two PATHs).
  - done: impl-637 · 2026-10-18T22:22:37.901Z
- [x] C8. The template's header records the harnesses it was built from, and a check reports whether a roles.toml is still exactly the template it records (unit test).
  - done: impl-637 · 2026-10-18T22:19:01.966Z
- [x] C9. Demo: in a scratch project with one installed fake harness, `cland init`, `cland role list` and an Aide launch show the valid template and, on Claude Code, a launch with `--permission-mode auto`.
  - done: impl-637 · 2026-10-18T22:19:02.396Z

## Comments

### impl-637 · 2026-10-18T22:18:59.294Z

Implemented at 62fe456e (pushed local territory): deterministic installed-harness template; shared doctor lookup for PATH, overrides and installer folders; init + hub startup + RolesFile writers; stable parser fallback; exact-template check; Aide sub-agents; README mapping. Lowest-tier red→green: Claude-only provision, Aide crew flag, hub startup auto launch. Host typecheck and test:lint green (184 report-only existing findings; new files qualify T1/T2). Focused files green serially: roles-template 0.275s (6), roles-template-component 0.342s (2), crew 12.586s (8), init 9.489s (14), roles-snapshot 0.910s (10). Scratch CLI demo log A-5604 and replay script A-5605 prove init, role list, crew show, native --permission-mode auto and actual update byte preservation. Coordinator confirmed retention rule and Coordinator/Lead Codex danger-full-access. Parser/OpenCode inherited-policy gap intentionally deferred by Coordinator; follow-up id pending. No per-item QA required (qaPolicy none, after-stage).

### rev-30 · 2026-10-18T22:20:49.080Z

verdict: review
result: not clear
by: rev-30 [reviewer]
run: rev-20261018-637-source
commit: 62fe456e61f6f969a4b0debc8cdb75490eaad5cf
scope: full
findings: [{"severity":"medium","text":"M1: installer-folder candidates count as installed but resolved executable paths are discarded before adapter construction; adapters still launch bare names when no override exists. Installer-only harness selection therefore creates unusable launch defaults. Share the resolution with launch and prove an installer-only handoff without PATH/override rescue.","file":"hub/src/doctor/harnesses.ts","line":26}]
finding_counts: {"high":0,"medium":1,"low":0}

Source not clear. M1: installer-folder-only binaries are selected as installed but their resolved paths never reach projectSessions/adapters; without PATH entry/override native commands remain bare and fail ENOENT. A-5606 traces discovery-to-spawn and the masked coverage gap; claimant is correcting before verification. Other template policy/model/crew/fallback preservation and isolated demo remain positive. Explicit Coordinator-deferred effective OpenCode policy gap is T-821, separate from M1. Fresh source review required; no verification at this head.

Criteria: C7 failed (Installed-set startup selection accepts installer-only binaries, but native adapters do not use those resolved paths and cannot launch them when absent from PATH.).

### impl-637 · 2026-10-18T22:22:37.887Z

M1 corrected at c2809796, pushed to origin. Cause: discovery accepted installer-folder executables but adapters launched bare commands. Shared harnessBinary now supplies discovery-selected binary to all three adapter defaults; explicit options/overrides remain authoritative. Added red→green native Claude command-boundary control (selected .local/bin/claude vs launched bare claude), plus sync resolver checks for all three binaries. Installer-only real CLI demo has no Claude override and excludes installer folder from PATH: A-5607 log, A-5608 script. Host npm run check passed: raw A-5610. Serial focused receipts A-5609: template6, component2, Claude environment5, OpenCode policy5, Codex native12 all green. No dev merge after first review. Deferred inherited OpenCode policy is T-821.

### rev-30 · 2026-10-18T22:23:35.561Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261018-637-source-correction
commit: c280979658f0ad2182c2c07aeb23fc9e8f5a572c
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear at c2809796. M1 resolved: shared executable resolver now feeds all native adapter defaults, preserving explicit bin/override precedence and missing-command behavior. Installer-only command-boundary test and scratch CLI demo exclude PATH/Claude override rescue; raw five focused files30/30 pass. A-5611 retains both axes, initial template audit/M1 history, demo environment and explicit T-821 deferral. C1–C9 await accepted exact-head runtime; no findings or per-item QA.
