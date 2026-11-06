---
id: T-1722
kind: task
title: Remote host layouts name the Claude Code mod directory, so Claude Code sessions launch on a host
state: open
status: ready
size: S
criterion_seq: 3
labels:
  - ready-for-agent
assignee: null
parent: E-1532
blocked_by: []
regression_of: T-1601
found_by: qa
topic: topic-1405
branch: t/T-1722-remote-host-layouts-name-the-claude-code
created: 2026-11-06T11:10:45.203Z
updated: 2026-11-06T12:11:06.284Z
---

## Summary

`remoteHostLayout` (hub/src/host/remote-layout.ts) never sets `modDir`, and nothing in hub/src supplies one for an ssh Host. The Claude Code adapter therefore refuses every launch on a remote host with `remote layout has no mod directory yet` (hub/src/adapters/claude-code.ts:483). Only in-process test fixtures inject a `modDir`, which is how the E-1532 tests pass. A CLI-started hub, and a real host, cannot run Claude Code, so E-1532's C5 ("sessions of all three harnesses run on a host") and its Definition-of-done demo fail for Claude Code. The DoD brief writer found this on 2026-11-06.

## What to build

- The remote layout names the mod directory inside the host's installed code tree for its version (`<code>/mod/cland`, next to `hub/bin/cland.ts`), and a host configuration can still override it.
- For fake hosts, the registry's fake branch points `modDir` at the installed tree's `mod/cland`, as it already does for `node`, `cli` and `spoke`.
- The adapter's refusal stays for a layout that truly has no mod directory.
- Rule 20 sweep: every reader of `HostLaunchLayout.modDir` and of the remote layout, including the launch-layout and host-launch-layout tests.
- Whether the code tree on a real host contains `mod/cland` is E-1533's question (images or the ready-time code delivery); this item only makes the layout name it.

## Acceptance criteria

- [x] C1. `remoteHostLayout(home)` returns a `modDir` of `<code>/hub/mod/cland` (where LOCAL_MOD_DIR sits in the installed tree) for the running version, and a configured override wins (test).
  - done: impl-1722 · 2026-11-06T11:42:29.674Z
  - verified: rev-35 [reviewer] · run rev-35-1722-final-1 · 2026-11-06T12:11:05.366Z · commit d0822fd18652c1a7a9e4a0c749ec7221cc630cec
- [x] C2. A CLI-started hub with a fake host launches a Claude Code item session on it, and the session reaches running with its mod bridge connected through the tunnel (test, red before the fix).
  - done: impl-1722 · 2026-11-06T11:42:35.436Z
  - verified: rev-35 [reviewer] · run rev-35-1722-final-1 · 2026-11-06T12:11:05.366Z · commit d0822fd18652c1a7a9e4a0c749ec7221cc630cec
- [x] C3. A layout without a mod directory is still refused with the existing message (test).
  - done: impl-1722 · 2026-11-06T11:42:35.880Z
  - verified: rev-35 [reviewer] · run rev-35-1722-final-1 · 2026-11-06T12:11:05.366Z · commit d0822fd18652c1a7a9e4a0c749ec7221cc630cec

## Comments

### impl-1722 · 2026-11-06T11:12:55.361Z

Rule 20 sweep (rg modDir, HostLaunchLayout, remoteHostLayout across hub/shared/nvim/web/docs/qa/.agents): production readers are ClaudeCodeAdapter (optional fallback/refusal/plugin-dir), localHost and remoteHostLayout producers, projectSshHosts fake/config overlay, sshHost layout pass-through; no wire/persisted shape change. Tests: host-contract local deep-equal unchanged; host-ssh-registry adds default/override/fake assertions; host-records computes expected via remoteHostLayout; host-attach and host-attach-routing only use attach paths; remote-discovery-host uses layout for discovery; claude-code-remote, claude-code-remote-files, host-launch-layout, host-revoke-native, host-survival-native and host-ssh-contract inject explicit mods and remain unchanged. ssh-host-fixture intentionally has no mod, retained for refusal regression. Docs ssh-host default needs correction; adapters-and-sessions optional refusal remains valid. QA E-1532 stage 2 historical no-mod refusal remains true for missing layouts; stages 3/4/6 derive paths, unaffected. No startup probes or other tier consumers found. C2 adds CLI-started real registry test (no injected layout).

### coord · 2026-11-06T11:13:40.682Z

Correction (coord, 2026-11-06): the Claude Code mod sits at `hub/mod/cland` in the installed tree (LOCAL_MOD_DIR), not at a root `mod/cland`. Read every `mod/cland` in this body as `<code>/hub/mod/cland`; C1 is edited to match. Raised by impl-1722.

### impl-1722 · 2026-11-06T11:14:11.253Z

Coordinator decision c7794649: C1 uses <code>/hub/mod/cland, matching installed LOCAL_MOD_DIR; original ticket path omitted hub/. Test seams authorized in brief: remoteHostLayout default/override, CLI-started hub real fake-host registry with item launch + positive mod-bridge receipt, adapter missing-mod refusal.

### impl-1722 · 2026-11-06T11:43:27.244Z

Implemented/pushed d0822fd18652c1a7a9e4a0c749ec7221cc630cec. Evidence A-17089 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-17089-t-1722-red-green-preservation-evidence.md): red CLI exact missing-mod refusal before source fix; required seven files green on macOS arm64 Node24.21 local, final layout18/18, T0 npm run check exit0. C2 native job mod-bridge acknowledgment + running/item/persisted host/session identity/stop receipts. C3 existing original refusal regression retained unchanged (redundant draft removed). All C1–C3 done; source review assigned rev-35. Linux and mode-free suite pending source verdict. Preservation lock released.

### rev-35 · 2026-11-06T11:44:54.372Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1722-source-1
commit: d0822fd18652c1a7a9e4a0c749ec7221cc630cec
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-17092: full source clear at d0822fd18, no findings. Remote versioned/default and fake installed mod paths match LOCAL_MOD_DIR; config overrides last; existing missing-mod refusal untouched. Inspected CLI/production-registry native bridge control, helper cleanup ownership, consumer inventory/docs and Coordinator-approved 8s Linux-projected/no-sample allowance. A-17089 local summary evidence qualified, no Reviewer execution. C1–C3 remain unverified pending same-head configured evidence; real host code delivery remains T-1723. QA none/after-stage.

### impl-1722 · 2026-11-06T12:10:19.241Z

Configured same-head verification green: run7da35b9b, A-17102, d0822fd18652c1a7a9e4a0c749ec7221cc630cec. Droplet Linux x64 c-8 nyc1 Node24.21.0, 1305s lifetime/$0.0906; Headless Shell1248 Chrome for Testing156.0.8078.4. T0/allT1/fallback allT2/changed T3 claude-code-remote once/Web complete; 5194 pass, zero fail/cancel/skip/todo. C2 exact generated case passed in4.589207438s (A-17102 line27358), under authorized8s allowance. Other T3 deferred; T4 not run. Budgets/lint report-only. Source review already clear; Reviewer notified to settle exact-head result. No source changes or reruns; tree clean.

### rev-35 · 2026-11-06T12:11:05.366Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1722-final-1
commit: d0822fd18652c1a7a9e4a0c749ec7221cc630cec
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-17104: final same-head review clear. Independently read A-17102 run7da35b9b exit0: hub5194pass/zero fail,cancel,skip,todo; base5058pass/empty failure arrays. Execution tree c0003256e3b3fbcc0aa3bcda47f7dd6a41f6d80f independently matches source projection. C1 registry default/override/fake controls, C2 exact CLI bridge4.589207438s, C3 unchanged missing-mod refusal all pass. T0/T1/allT2/changedT3 27identities once/Web completed; remainingT3 deferred,T4 unexecuted. Uncached Linuxx64 Node24.21/Nvim0.12.5 droplet c8nyc1, HeadlessShell1248/CfT156.0.8078.4. A-17094 original macOS evidence retains transcribed-exit/working-tree linkage limits and actual red. Budgets/lint/ratchet advisory; 8s cap remains sufficient. Real-host code delivery remains T-1723; no fullT3/T4 claim.

Criteria: C1 verified, C2 verified, C3 verified.
