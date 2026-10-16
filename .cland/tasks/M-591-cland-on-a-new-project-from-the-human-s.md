---
id: M-591
kind: map
title: "cland on a new project: from the human's direction to spec v0.1.4, a setup prototype, an onboarding prototype and the epics"
state: open
labels:
  - wayfinder:map
assignee: null
parent: null
blocked_by: []
topic: null
branch: null
created: 2026-10-16T11:26:11.049Z
updated: 2026-10-16T12:43:53.005Z
---

## Destination

Spec v0.1.4 (`docs/spec/v0.1.4.md`) complete and the v0.1.4 epics published under the release item R-577 "cland on a new project": a deterministic `cland init` (cland itself installed from the checkout on the human's machine; the one-command install deferred), the interactive `cland setup` (harnesses, accounts, the favourite harness, the Aide launched in the terminal), the onboarding the Aide leads from a skill on an empty or an existing project, the curated skill set edited in place, and the welcome artifact; built after v0.1.3 ships and before v0.2.

## Notes

Charted on 2026-10-16 in the cland-design session from the human's voice direction of the same day, after one grilling round whose thirteen answers are listed below. This map stands on its own because a map cannot sit under a release. Skills: research, prototype (an `onboarding` skill tried on two sandbox projects; a runnable `cland setup`), grilling. Standing preferences: every artifact in English; sub-agents never use the hub; research on research/<name> branches and prototypes on prototype/<name>, never merged; sandboxes are throwaway folders outside this repository, never this project's hub; `cland task import-github` exists already (found while charting), so the existing-project onboarding uses it rather than a new importer.

Settled before charting (grilling round 1, 2026-10-16):

1. The theme becomes the content of v0.1.4 (R-577, renamed; its carried-over hygiene epics stay); the way is a wayfinder map, then spec v0.1.4 and epics; the build after v0.1.3, before v0.2.
2. cland is never copied into a project: one install command from the GitHub tag (`npm install -g github:Kealman/cland-v0#<tag>` or the form the research confirms) puts `cland` on the PATH; the npm registry later.
3. Two commands: `cland init` stays deterministic and ends with "next: cland setup"; `cland setup` is the interactive part. Glossary terms Setup and Onboarding; no "wizard" term.
4. Skills: `skills-lock.json` and `skills/PATCHES.md` go; `.agents/skills/` holds a curated set edited in place; init copies it whole; a skill edited inside a project belongs to the project and `cland update` reports it "kept, edited" instead of overwriting; the keep/drop list is proposed by the design session and approved by the human.
5. `cland setup` checks the three harnesses (binary, version, login), shows the install command for a missing one and runs it on confirmation, waits for the human's login in the same terminal and re-checks, registers the logged-in accounts in `~/.config/cland/accounts.toml`, then asks for the favourite harness, which runs the Aide. Doctor requires a harness only when a role uses it, `gh` only with a `github` remote; setup downloads Neovim.
6. Setup starts the hub, launches the Aide normally with the onboarding brief and attaches its terminal in place, without Neovim; on exit it prints "open the workbench: cland". The trust prompts of Claude Code and Codex get a deterministic answer found by research.
7. The onboarding is a skill named `onboarding` in the curated set, edited in place like the others; setup's brief is short ("/onboarding; project: empty | existing; harnesses: …; human's harness: …"); both scenarios live in one skill with a common tail (crew, rules, tour).
8. On an empty folder `cland init` runs `git init`, creates `main`, a first commit with AGENTS.md and `.cland/`, then the territory; an existing project's `master` or any default branch is accepted.
9. The Aide first asks the human's role and what they want to decide themselves; the answers become rules in the rulebook, not a config field; later questions follow the rules.
10. On an empty project the Aide runs Wayfinder: what to build, the destination, the fog; the map and its research become the tracker's first items; then the stack and the crew. The default `crew.toml` gives the Aide sub-agents (`aide.subagents = true`).
11. On an existing project the Aide studies structure, stack, tests, docs and history, finds the current tracker; the cland tracker becomes the only source; open GitHub issues are imported on confirmation (closed ones untouched); other trackers are out of scope.
12. The Aide proposes the crew from the installed harnesses and the answers (roles, harness and model per role, pool sizes, heartbeat) and records it through `cland crew set` and a new `cland role set` for launch fields; the roles template no longer assumes three harnesses: a project on Claude Code alone is valid.
13. The tour is a ladder: (1) the Aide, the tracker and the rules; (2) the Coordinator and an Implementer, the item → branch → review → merge → verify loop; (3) the full crew with a reviewer pool, QA, leads and epic plans; (4) remote executors, accounts, the web. The onboarding ends with a "Welcome aboard" artifact in General (crew, rules, ladder, first steps). The onboarding does not launch the Coordinator; the Aide says when and how.
14. (During the live try, 2026-10-16.) Sessions edit project files directly: `cland init` and `cland update` write `"worktree": {"bgIsolation": "none"}` into the project's `.claude/settings.json` and the launch settings carry the same key; cland controls a session's reach at the hub and role level, never through harness isolation.
15. (During the live try, 2026-10-16.) The onboarding teaches: the tour and the welcome note explain cland's concepts and each ladder step in plain words for a newcomer. The human never runs commands by default: the Aide or the Coordinator acts for them and asks permission when needed ("when you say ok, I will launch…"); the Aide's reach (launching the Coordinator, the import, config writes) follows in Q-600.

## Decisions so far

- [Install from the GitHub tag: one command on a fresh machine](Q-592, .cland/tasks/Q-592-install-from-the-github-tag-one-command.md): no `npm install -g` form works today (root workspaces with an npm bug, type stripping refused under node_modules, hub dependencies never installed, no root version and a 22 MB package, the Neovim cache inside the package, a private repository, the sh wrapper); seven fixes prototyped, after which `npm install -g github:Kealman/cland-v0#vX.Y.Z` installs in 7 s; the root version equals the tag and `cland release` refuses a mismatch; today's checkout line recorded for the docs.
- [The skill set: keep or drop each of the 38 vendored skills](Q-595, .cland/tasks/Q-595-the-skill-set-keep-or-drop-each-of-the.md): keep 17 (three weak), drop 21 with a reason each; 16 copies differ from upstream while PATCHES.md records 4, so each kept skill gets a metadata header with its origin and changes; `cland update` cannot detect an edit today (no hashes in the manifest): record SHA-256 per file and refresh untouched, keep edited, add new, remove dropped-untouched; the human decides in Q-598.
- [The skill set and the skills policy](Q-598, .cland/tasks/Q-598-the-skill-set-and-the-skills-policy.md): keep 15 vendored skills (21 with cland's own and onboarding), drop 23; lock and PATCHES.md deleted, a metadata header per kept skill, the Codex listing fixed; `cland update` keeps SHA-256 per file: untouched refreshed, edited kept and reported, new added, dropped removed when untouched; old manifests get one last overwrite with a warning.

- [Harness setup facts: install, login, trust and accounts](Q-593, .cland/tasks/Q-593-harness-setup-facts-install-login-trust.md): curl installers and blocking logins for all three harnesses, `claude auth status --json` carries the identity, Codex's identity comes from the app-server's account/read, OpenCode's login is optional; trust is deterministic (Claude Code: hasTrustDialogAccepted in the profile's .claude.json under its lock; Codex: trust_level through config/batchWrite; OpenCode: none); the terminal Aide is a normal hub launch plus the harness's attach command, never a hand-started harness; T-603 stands; follow-ups: doctor's Codex range and env keys as credentials.
- [Prior art: terminal setup wizards and first-run tours](Q-594, .cland/tasks/Q-594-prior-art-terminal-setup-wizards-and.md): ordered idempotent steps (detect, offer, confirm, run the vendor command with inherited stdio, detect again; the re-check decides); without a terminal never prompt, report open steps and exit 1, `--yes` for harmless questions only, `--json` as doctor; no library, a readline prompter with one interface per question; tests with a fake prompter and fake harnesses on the PATH.
## Not yet specified

- Verification for any stack: `cland verify` runs this project's npm scripts by name (typecheck, test, the hub and nvim modes, `npm ci` on the droplet, coverage selection over node --test); a non-Node project has no verification today. The commands belong in `[verification]` of config.toml, written by the onboarding with the stack; the shape is decided in Q-600 and the epic in the cut (raised by the human during the live try, 2026-10-16).
- The onboarding questions per human role (developer-architect, designer, product owner, mixed) and how the Aide picks them; waits on the onboarding prototype.
- What `cland update` does to a project's skills when cland's set changes (new skills added, dropped ones retired?) and how an edited skill is detected; waits on the skills triage.
- The welcome artifact's content and whether the workbench's empty state points at it; waits on the prototype.
- Accounts registration beyond "the logged-in account per harness" (names, limits): v0.1.2 §3.13 is the base.
- Whether v0.1.4 adds a getting-started page or the manual stays the reference; E-426's docs demo (QA follows hub/README.md from `cland init`) overlaps.
- The package version stuck at 0.1.0 (`cland --version` and the managed marks): whether `cland release` bumps it; decided in the cut.

## Out of scope

- The one-command install on a fresh machine (Q-592's seven fixes, the public repository question): deferred by the human on 2026-10-16; 0.1.4 assumes cland installed from the checkout on the human's machine, who tests there first; the research stands for a later release.
- Trackers other than GitHub Issues (Linear, Jira): no import; the cland tracker is the only source.
- Publishing cland to the npm registry: later; 0.1.4 installs from the GitHub tag.
- Installing harnesses silently or holding harness credentials: setup shows and runs install commands on confirmation; logins are the human's own, in the terminal.
- The web workbench's onboarding: v0.2 takes the setup result as it is.
- A machine-wide cland configuration beyond `~/.config/cland/accounts.toml`, and several projects in one place.
