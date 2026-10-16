---
id: T-635
kind: task
title: cland models <harness> lists the harness's model ids from a cached probe
state: open
status: in progress
size: M
labels:
  - v0.1.4
  - hub
assignee: null
parent: E-611
blocked_by: []
topic: topic-391
branch: t/T-635-cland-models-harness-lists-the-harness-s
created: 2026-10-16T16:04:12.499Z
updated: 2026-10-16T16:08:07.830Z
---

## Summary

`cland models <harness>` lists the model ids the harness offers, from a probe of its model list that the hub caches, so the onboarding's crew round names only a model the harness lists and the launcher's model field can offer them. In the live run `opencode models` printed nothing and the Aide needed several probes to find an id (Q-600 question 17).

## What to build

- **The command.** `cland models claude-code | codex | opencode [--account <name>] [--refresh] [--json]` prints one id per line, the harness's default marked, then where the list came from and its age ("probed now", "cached 3 h ago"). `--json` prints `{harness, account, models: [{id, default}], source, probedAt}`. The usage text lists it.
- **Through the hub.** The hub probes in the environment it launches the harness with (cland's own OpenCode database, an account's directory with `--account`), so the list is the one a launch would see. Any session may read it; the launcher reads the same answer.
- **The probes.**
  - OpenCode: the OpenCode server's model list, as the adapter already reads it to pick a free model, never the `opencode models` command; a server that answers an empty list just after start is asked again until it lists models or a short timeout passes (the fake OpenCode answers an empty list for its first 400 ms).
  - Codex: the model list of a short-lived Codex app-server.
  - Claude Code: as the Coordinator decides (open question in the README); the source line names it.
- **The cache.** Per harness and account, kept by the hub across restarts, for a lifetime the plan sets (recommended 24 hours). A call within it answers from the cache; `--refresh` probes again. A failed probe answers the cached list with its age, or, with no cache, fails with the probe's error. A harness that is not installed fails with doctor's not-installed line.
- **The fakes.** The fake Codex answers the app-server model list; the fake OpenCode's model list is used as it is; both count their probes for the tests.

## Acceptance criteria

- [ ] C1. `cland models opencode` and `cland models codex` print the ids the fake OpenCode server and the fake Codex app-server list, the default marked (new CLI test against a temporary project's hub).
- [ ] C2. A second call within the cache's lifetime answers without a probe and `--refresh` probes again, as the fakes' probe counts show.
- [ ] C3. The OpenCode probe waits out the fake's empty first answer and returns its models.
- [ ] C4. `cland models claude-code` prints Claude Code's list with its source named, as decided for Claude Code.
- [ ] C5. A failing probe answers the cached list with its age, or with no cache fails with the probe's error, and a harness not installed fails with doctor's not-installed line.
- [ ] C6. `--account <name>` probes in that account's environment and keeps its cache apart from the default's, and `--json` prints the documented shape.

## Comments

### impl-635 · 2026-10-16T16:08:07.830Z

Implementation started. Scope: hub models.list frame and durable 24-hour per-harness/account cache, CLI rendering, native short-lived probes, and isolated fake-driven tests for C1–C6.
