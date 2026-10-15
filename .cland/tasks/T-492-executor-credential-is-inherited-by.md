---
id: T-492
kind: task
title: Executor credential is inherited by launched sessions and test processes, and surfaced in a session's process listing
state: open
status: backlog
size: S
labels:
  - ready-for-agent
  - security
assignee: null
parent: C-325
blocked_by: []
topic: null
branch: null
created: 2026-10-15T12:07:01.208Z
updated: 2026-10-15T12:08:07.203Z
---

## Summary

The hub's DigitalOcean credential reaches every session the hub launches, and every test process those sessions start, through the inherited environment. At 12:06Z on 2026-10-15 an Implementer's routine `pgrep -fl` admission check printed process lines that contained the credential into its own tool output. That output is model context, so it went to the harness's model provider. No value was written to the tracker, artifacts or the repository. Only the hub's executor needs the credential.

## Acceptance criteria

- [ ] C1. Sessions launched by the hub (every harness, every role) start without `DIGITALOCEAN_TOKEN` or any other executor secret in their environment. A test proves it for a launched fake session.
- [ ] C2. Local verify and test processes started by `cland verify`, `run-suite.ts` and the Neovim harness drop executor secrets from child environments. The executor's own droplet calls keep working with the hub's in-process copy.
- [ ] C3. Find the exact process whose command line carried the credential (impl-455 saw it in a `pgrep -fl` listing of test:nvim npm processes) and fix that path, so no cland or test process puts a secret in argv.
- [ ] C4. Docs (`docs/verification-shards.md` or the executor doc) state that the credential lives only in the hub's environment.

## Comments

### coord · 2026-10-15T12:08:07.203Z

Human decision on 2026-10-15 at 12:07Z (ask aa197b46, answer a7ae0d42): no rotation. T-492 goes through the normal queue. The crew's PID-only process-check rule stays in force until this merges.
