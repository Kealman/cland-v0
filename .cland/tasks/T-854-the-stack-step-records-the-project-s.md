---
id: T-854
kind: task
title: The stack step records the project's `[verification]` commands with `cland config set`, and no npm wording is left
state: open
status: planned
size: S
labels:
  - v0.1.4
  - ready-for-agent
assignee: null
parent: E-616
blocked_by:
  - T-853
topic: null
branch: null
created: 2026-10-19T08:10:02.748Z
updated: 2026-10-19T08:10:09.156Z
---

## Summary

The stack becomes a rule, "Build with <stack>; checks: <commands>". On the same yes its commands go into `[verification] prepare`, `check` and `test` through `cland config set` (§3.4 step 6, §3.7, D51 decision 9). The prototype's advice to fit the npm scripts, wrap other tools in them, or add them as a criterion goes.

## What to build

- **SKILL.md §4.**
  - The rule is recorded as before.
  - Then come `cland config set verification.test "<line>"` (required: verify refuses without it), `verification.check` when the stack has a fast gate, and `verification.prepare` when its checks need an install. Each runs under POSIX `sh -c`, per D51 decision 12.
  - The Aide reads the values back with `cland config set`'s result, or by reading `config.toml`.
  - The paragraph about `npm run typecheck`/`npm test` and `pretypecheck` is deleted.
  - When a command cannot be named yet, because the project has no test runner, the first task gets a criterion to add one, and the step records the key once that task names it. Recommended: record a placeholder only if verify accepts one (open question 5).
- **EXISTING.md step 1.** The tests bullet asks the study for the commands that would serve as `prepare`, `check` and `test`, instead of whether `npm run typecheck` and `npm test` exist.
- **T2 case.** An Aide runs `config set verification.test "python3 -m unittest"`, `verification.check "python3 -m compileall -q ."` and `verification.prepare "true"`, and the hub reads each back verbatim. This is QA's toy stack from D51 decision 13.

## Acceptance criteria

- [ ] C1. SKILL.md §4 records the stack rule and then `verification.test`, `verification.check` and `verification.prepare` through `cland config set`, with `test` required and the other two optional (source review).
- [ ] C2. No file of the onboarding skill names `npm run typecheck`, `npm test`, `pretypecheck` or another npm-specific verification line (T1 assertion in skills-onboarding.test.ts).
- [ ] C3. EXISTING.md's study asks for the project's prepare, check and test commands (source review).
- [ ] C4. Run as an Aide against an in-process hub, the three `cland config set verification.*` lines with the python3 values are accepted and read back verbatim (T2).
