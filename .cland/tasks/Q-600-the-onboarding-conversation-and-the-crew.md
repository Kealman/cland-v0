---
id: Q-600
kind: question
title: The onboarding conversation and the crew
state: open
labels:
  - wayfinder:grilling
assignee: null
parent: M-591
blocked_by:
  - Q-596
topic: null
branch: null
created: 2026-10-16T11:26:11.971Z
updated: 2026-10-16T12:29:57.594Z
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
