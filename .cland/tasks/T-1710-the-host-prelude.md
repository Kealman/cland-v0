---
id: T-1710
kind: task
title: The host prelude
state: open
status: review
size: S
criterion_seq: 4
labels:
  - ready-for-agent
assignee: null
parent: E-1533
blocked_by: []
topic: topic-1404
branch: t/T-1710-the-host-prelude
created: 2026-11-06T10:48:04.642Z
updated: 2026-11-06T11:12:08.387Z
---

## Summary

The user-data that runs before anything else on a new host does six things. It installs the hub-generated host key the hub pins. It sets sshd's `StreamLocalBindUnlink yes`, `ClientAliveInterval 15`, `ClientAliveCountMax 4` and `MaxSessions 32`. It deletes the provider's volume automount rule (DigitalOcean's `99-digitalocean-automount.rules`). It installs the login-disk helper `cland-auth` with its one sudoers line for `runner`. It writes Codex's `config.toml` with `cli_auth_credentials_store = "file"`. And it sets none of the stray API keys.

Hot files: `hub/src/host/prelude.ts` (new), `hub/src/host/cland-auth.sh` (new), `hub/test/host-prelude.test.ts` (new)

## What to build

- `renderPrelude({ hostKey, hostPublicKey, providerSteps })`, where the provider contributes its own steps (DigitalOcean: the automount rule);
- the `cland-auth` helper (mount, unmount, freeze, thaw), accepting only volume names and `/cland/auth/<harness>-<login>` paths, and ending every process on a mount before unmounting it, as the prototype's helper does.

## Acceptance criteria

- [x] C1. The rendered user-data installs the given host key pair and writes an sshd drop-in with `StreamLocalBindUnlink yes`, `ClientAliveInterval 15`, `ClientAliveCountMax 4`, `MaxSessions 32` and `PasswordAuthentication no` (test).
  - done: impl-1710 · 2026-11-06T10:57:25.226Z
- [x] C2. The DigitalOcean rendering removes `99-digitalocean-automount.rules`, installs `cland-auth` with the sudoers line `runner ALL=(root) NOPASSWD: /usr/local/sbin/cland-auth`, and writes Codex's `cli_auth_credentials_store = "file"` (test).
  - done: impl-1710 · 2026-11-06T10:57:26.295Z
- [x] C3. With sentinel values for `DIGITALOCEAN_TOKEN`, the project secret, the messenger tokens and `ANTHROPIC_API_KEY`, `ANTHROPIC_AUTH_TOKEN`, `OPENAI_API_KEY`, `CODEX_API_KEY` and `CODEX_ACCESS_TOKEN` in the hub's environment, the user-data contains none of those values and assigns none of those names (test).
  - done: impl-1710 · 2026-11-06T10:57:27.038Z
- [x] C4. `cland-auth` exits non-zero without acting on a volume name or mount path outside its patterns or an unknown operation (test).
  - done: impl-1710 · 2026-11-06T10:57:28.252Z

## Comments

### impl-1710 · 2026-11-06T10:51:16.615Z

Rule 20 sweep: searched renderPrelude, cland-auth, providerSteps, hostPublicKey and automount rule across hub/src, hub/test (all tiers), nvim, web, docs, qa/briefs and shipped .agents/skills. Only docs/spec/v0.4.md describes this new contract; no existing production/client/fixture/startup/persisted-reader consumers. Host, wire, config and executor contracts unchanged. Authorized seams C1-C4: renderPrelude output and script execution with stubbed commands. Prototype host-root.sh read only, never merged.

### impl-1710 · 2026-11-06T10:54:52.407Z

Deliberate narrowing of prototype cleanup: helper operates only on the requested login path and checks the exact expected volume source before signals, freeze or thaw. It does not unmount other paths found for a volume. Persistent writers after bounded TERM/KILL observation refuse unmount and keep the disk mounted. Stubbed tests cover mismatched source with no signal and persistent-writer refusal. All C1-C4 red receipts observed: missing module, missing helper installation, temporarily injected environment sentinel, empty helper accepting invalid input.

### rev-35 · 2026-11-06T11:03:52.559Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1710-source-1
commit: c3a811abe8e8cdb2510dc5ab7e9f28530be4f031
scope: full
findings: [{"severity":"high","text":"One source check does not own the mount across later privileged effects. Concurrent helper calls can unmount/remount after validation; fuser -k -m without -M can then signal the containing/root filesystem when the path is no longer a mount, or effects can hit a replacement volume. Serialize the admitted mount/device operation and revalidate exact mount/source at every effect with mountpoint-only signal safeguards/equivalent. Add fully stubbed disappearance/replacement/concurrency controls; no real privileged probe.","file":"hub/src/host/cland-auth.sh","line":43},{"severity":"medium","text":"Every nonzero fuser probe becomes positive absence, with diagnostics discarded, including missing command127 and probe errors. No separate absence receipt exists. Distinguish confirmed no-users from unavailable/failed observation and refuse mutation on unknown; retain bounded native diagnostics/status. Stub error/missing-command cases; preserve persistent-writer refusal.","file":"hub/src/host/cland-auth.sh","line":23}]
finding_counts: {"high":1,"medium":1,"low":0}

A-17060: full source not clear: high stale mount-source authority across concurrent helper effects, medium unknown fuser errors treated as absence. Both confirmed by Implementer b8391892; no external owner/intended exception. Renderer explicit inputs/quoting/sshd/helper/sudoers/file-store and positive-control sentinel scanner inspected; no environment read. Invalid-input/mismatch/persistent-writer tests do not cover disappearing/replaced mounts or failed observations. Add stubbed controls and request fresh pinned source before configured verify; no real disk/signal probe requested. C1–C4 remain unverified; no new executed failure fabricated. Diffcheck clean; T1/T3/docs/index/consumer narrowing inspected. No Reviewer execution; affected after-stageQA per item.

### impl-1710 · 2026-11-06T11:11:26.489Z

Source rework for rev-35-1710-source-1: all helper operations share a root-owned flock, mount admission pins ID and exact source and every later effect revalidates it; fuser signals include -M. Writer census requires successful positive census of the helper lock plus silent candidate no-user exit1 and fresh mount receipt; diagnostics/status errors and failed signals retain the mount. New stub controls cover missing/error census, no-user control failure, missing/replaced/late-changed mount, lock contention, signal errors and valid scratch-device mount. Old implementation red controls returned0 for census errors and denied-lock stub; disabled-freshness mutation made the retained mount-change test red. All12 final targeted cases passed on macOS Node24.21.0 with inherited CLAND variables removed; no native privileged operation or provider. Duration allowance C-216 6s expires2026-11-13 records worst3.644519s; no Linux/repetition proof claimed. No dev merge or verify; awaiting fresh source pin.
