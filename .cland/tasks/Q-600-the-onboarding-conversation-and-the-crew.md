---
id: Q-600
kind: question
title: The onboarding conversation and the crew
state: closed
labels:
  - wayfinder:grilling
assignee: cland-design
parent: M-591
blocked_by:
  - Q-596
topic: null
branch: null
created: 2026-10-16T11:26:11.971Z
updated: 2026-10-16T15:06:50.449Z
closed: 2026-10-16T15:06:50.449Z
---

## Question

The onboarding conversation and the crew, on the onboarding prototype: the questions per human role and the rules they become; Wayfinder on an empty project and the Aide's sub-agents; the existing-project study and the GitHub import; the crew proposal, `cland crew set` and the new `cland role set`; the roles template without the three-harness assumption; the welcome artifact and the ladder; the Coordinator's start.

## Comments

### human · 2026-10-16T11:51:44.380Z

Open questions raised by the onboarding prototype (Q-596, prototype/onboarding fabe4301), to be decided here with the human after the live try:

1. `task.import` sits outside the Aide's fixed tool boundary (`decide()` in permissions.ts): grant it to the Aide so the onboarding imports on confirmation, or keep the import as the human's command?
2. `cland task import-github` defaults to the `origin` remote, which init renames to `github`: fall back to `github`?
3. `cland init` refuses shallow clones ("shallow update not allowed" into the territory): support them or document the full-clone requirement?
4. A new project has no categories; only `task migrate` seeds them, yet every clause files into them: should init seed Bugs, Tech debt, Follow-ups and Ideas? (The prototype skill creates them.)
5. `cland role set` already assigns roles to sessions, so the launch-field command needs another name (`cland role launch <role> --harness … --model … --account …`?).
6. Who commits init's and the onboarding's files on dev before a Coordinator exists: setup after init, the Aide at the end of the onboarding, or the Coordinator's first brief?
7. Keep "who is the human" and "what do they decide" as two rounds, or merge them?
8. Is a rule ("Build with …") the right home for the stack, or the map's Notes / a doc?
9. Should "I approve epic plans" also set `[plan] approval = "human"` in config.toml?
10. The Aide launches without `permissions = "skip"`, so every command prompts during the onboarding: make skip the Aide's template default?

### human · 2026-10-16T12:29:57.594Z

11. Verification for any stack (the human, during the live try, 2026-10-16): `cland verify` is hard-wired to this project's npm scripts (suite-worker.ts runs `npm run typecheck` then `npm test` / `npm test --workspace hub` / `npm run test:nvim`; the droplet prepare runs `npm ci` and the Neovim pin, the run checks package-lock.json and nvim/NVIM_VERSION, the host gate runs typecheck again; coverage selection assumes node --test and V8 coverage; `[verification]` in config.toml names no command). The onboarding Aide therefore tried to pick a stack to fit verify. Proposal: `[verification] prepare`, `check` and `test` commands in config.toml (and the droplet's toolchain prepare), coverage selection as an optional Node extension, the onboarding writing these with the stack; an epic in the 0.1.4 cut.

### human · 2026-10-16T12:35:57.129Z

12. The Aide cannot edit root files (the human, live try, 2026-10-16): Claude Code refuses Edit and Write in the shared root checkout from a background session ("Call EnterWorktree first"); the Coordinator already works around it with a detached worktree and a fast-forward (memory coord-docs-commit-via-worktree). The onboarding Aide therefore failed to write `.cland/roles.toml`. Consequence for the design: every setting the onboarding writes needs a cland command run from the shell, never a file edit: `cland crew set` and `cland rule add` exist; roles.toml launch fields need the new launch command (question 5); config.toml needs `cland config set <section.key> <value>` (verification commands, plan approval); the skill must say so.

### human · 2026-10-16T12:40:02.192Z

Decision on question 12 (the human, 2026-10-16, during the live try): sessions must edit project files directly, not through worktree workarounds; cland controls what a session may do at the hub and role level, not through harness settings. `cland init` and `cland update` write `"worktree": {"bgIsolation": "none"}` into the project's `.claude/settings.json` (managed, next to the hooks; Claude Code 2.1.143+ reads it: 'worktree', the default, blocks Edit/Write in the main checkout until EnterWorktree; 'none' lets background sessions edit the working copy), and the adapter's launch `--settings` carries the same key so a project whose file lacks it still gets it. The memory workaround (detached worktree + fast-forward for Coordinator docs commits) becomes unnecessary. CLI commands for settings (crew set, rule add, the launch-field command, config set) stay useful but are no longer the only way.

### human · 2026-10-16T12:43:52.803Z

13. The tour must teach, not remind (the human, live try, 2026-10-16, on the prototype's ladder text): it assumed the reader knows how cland works (sessions, roles, the hub, items, topics, verify, the territory, the workbench keys). The welcome note and the spoken tour explain each concept in plain words and, per ladder step, what it means in practice, what the human will see and do, and who acts. This overrides "no explanatory prose" for the onboarding: the onboarding is where the explaining happens.

14. The human never runs commands (the human, same try): by default a session acts for the human, the Aide or the Coordinator, asking permission when needed; the wording is "when you say ok, I will launch…", "ask me to…", "when we finish, I…", never "run this in your terminal" or "press l to launch", unless the human asks for the commands. Consequence: the Aide needs to launch and stop sessions on the human's word (session.launch, stop, resume: today the clause reserves them for the Coordinator, so nobody can start the first Coordinator without the human's keystrokes); the import, the config writes and the Coordinator's launch are the Aide's acts; the setup step's own commands are run by setup, not by the human. Proposal: the Aide gets session.launch/stop/resume for every role on the human's say-so; during a build the Coordinator keeps crew staffing; the principle becomes a seeded rule ("sessions run commands for the human; the human is asked for a decision, never for a keystroke") and a line in every clause.

### human · 2026-10-16T12:50:57.951Z

From the first live try's transcript (sandbox-empty, 2026-10-16 12:08–12:34Z, the human as a developer on a toy 2048): rounds went who-you-are → rules → what to build → stack (crew's decision, verify-compatible) → three tasks T-1→T-2→T-3 filed directly with the decisions in T-1's comment (no map: "no fog, fits one session", wayfinder's own rule) → categories → crew table → the roles.toml edit refused (bg isolation) → the ladder text → "onboarding finished", with a brief for the human to launch the Coordinator by hand. The human's reaction:

15. Order: after the questions are answered, propose to START (launch the Coordinator and the work), and only once the work is going offer the tutorial: "do you want to learn everything cland can do?" and, on yes, a staged briefing (what works how, which keys, where to look), stoppable at any stage. The ladder text at the end was no tutorial.

16. The planning stage must be visible and real: the human did not see a Wayfinder stage producing the work and felt the Coordinator would have nothing to do. Proposal: planning stays with the Aide and the human in the onboarding (the Coordinator never decides what to build; it plans and runs epics). On an empty project the Aide either charts a map (destination, fog, first tickets) when there is fog, or files the first release with its tasks (or an epic) when there is none, and shows the result ("release R-1 'first playable' with T-1 to T-3 in the items panel"); on an existing project the same after the study and the import ("what next" becomes the first release). The Coordinator is launched, on the human's ok, only when there is something ready to work: the Aide says so and otherwise continues the planning with the human. The Coordinator's launch brief: commit what init and the onboarding wrote and work the first release.

Also observed: the hub truncates a rule's title to 80 characters and rule.edit has no title field (filed as a bug); the Aide bypassed the edit refusal through a shell edit when told to (now moot with bgIsolation none); the Aide left the onboarding's files uncommitted for the Coordinator's first brief (question 6).

### human · 2026-10-16T12:51:47.467Z

Fact from the prototype (36c09717): every cland call from a session's shell carries that session's identity, so the hub refuses session.launch and task.import from the Aide's terminal exactly as from its tools; no role may import today, and only the workbench or a terminal that is no session's can launch. The Aide cannot relaunch itself, so permissions = "skip" applies from its next launch (setup should launch the Aide with the chosen permissions). Consequence: questions 1, 10 and 14 are hub permission changes (the Aide's tool list), not skill wording.

### human · 2026-10-16T15:00:42.408Z

17. A model listing per harness for the crew step (from the second run): the Aide needed several probes to find OpenCode's id for GLM 5.3 Flash (`opencode models` printed nothing); proposal: `cland models <harness>` (doctor-style probe of the harness's model list, cached) used by the onboarding and by the launcher's model field.

### human · 2026-10-16T15:06:50.361Z

## Resolution

Decided with the human on 2026-10-16 after two live onboarding runs and the setup run ("все да" with one correction on the defaults):

1. The Aide's rights: `session.launch`, `session.stop` and `session.resume` for any role on the human's word (the Coordinator first of all), `task.import`, and `push` for the onboarding's commit. During a build the Coordinator keeps the crew's staffing; the Aide launches only when the human asks.
2. The Aide commits on dev everything init and the onboarding wrote, at the end of the onboarding, and runs `cland push`; the Coordinator's launch brief is then "work release R-n".
3. Template defaults: `crew.toml` gives the Aide sub-agents (`aide.subagents = true`); the roles template is built from the installed harnesses (a project on one harness is valid); `cland init` seeds the four categories (Bugs, Tech debt, Follow-ups, Ideas). Permissions are NOT switched off by default: that is the human's conscious choice. Claude Code roles default to auto mode (a new `permissions = "auto"` → `--permission-mode auto`; today only "" and "skip" exist); Codex roles keep their sandbox with `approval = "never"` (the sandbox is the guard); OpenCode keeps its own settings. The onboarding's crew round offers "turn the prompts off" (skip) explicitly, with the trade-off, and records the answer; an existing roles.toml is never changed by an update.
4. Settings through commands, never by hand for sessions that lack the tools: `cland role launch <role> --harness … --model … --effort … --account … --permissions …` (`role set` is taken), `cland config set <section.key> <value>`, `cland models <harness>` (a probe of the harness's model list, cached, for the crew step and the launcher), and `cland task import-github` without `--repo` reads the `github` remote, then `origin`.
5. Verification for any stack: `[verification] prepare`, `check` and `test` in config.toml; the droplet executor runs the same `prepare`; coverage selection applies only to cland's own node commands; the onboarding records the commands with the stack. An epic of its own in 0.1.4.
6. A map only when there is fog; otherwise the first release with its tasks and criteria; on an existing project the same after the study and the import (closed issues untouched); `cland init` refuses a shallow clone with the line "the territory needs the full history".
7. WELCOME.md and TOUR.md of the prototype are the accepted wording and the spec's source for the onboarding; the tour speaks the human's language while rules, items and briefs stay in English; the answer "I approve epic plans" in the rules round sets `[plan] approval = "human"`.

Observed risks for the implementation: Claude Code's auto-mode classifier refused the Aide's own `cland role list` after it set skip for its role ("self-modification"); with auto as the default, the Aide's edits of its own launch settings must go through `cland role launch` and may still be flagged, so the crew step applies the Aide's own change last and says that it takes effect at the next launch. The rule title limit is T-608.
