---
id: T-1595
kind: task
title: The transport layer and the ssh carrier's master
state: closed
status: done
size: M
criterion_seq: 7
labels:
  - ready-for-agent
assignee: null
parent: E-1532
blocked_by:
  - T-1588
  - T-1589
  - T-1590
  - T-1594
topic: topic-1358
branch: t/T-1595-the-transport-layer-and-the-ssh-carrier
created: 2026-11-02T03:33:54.197Z
updated: 2026-11-03T05:39:03.786Z
closed: 2026-11-03T05:39:03.786Z
---

## Summary

A `Transport` interface separates carrying from providing, with `TransportKind` `ssh` only. The `ssh` carrier bootstraps a host over a one-shot connection (its script on stdin creates `~/.cland-host/run` at 0700, writes the per-host secret and starts the supervisor if it is not running), then keeps one hub-owned `ControlMaster` per host with the spec's options and the four forwards (`-R hub.sock`, `-R spoke.sock`, `-R git.sock`, `-L agent.sock`). Its own reconnect loop backs off from 1 s to 30 s with jitter, resets after 30 s up, retries at once on wake, runs `-O exit` and removes a stale control socket before each start, and probes end to end through `agent.sock` every 30 s, with each host's tunnel state shown in `hub.status`.

Hot files: `hub/src/transport/transport.ts` (new), `hub/src/transport/ssh.ts` (new), `hub/src/hub/dispatch.ts` (`hub.status` hosts), `hub/src/cli/hub.ts` (status print), `hub/test/transport-ssh.test.ts` (new)

## Acceptance criteria

- [x] C1. The master's argv contains `-N`, `-a`, `-x`, `-F /dev/null`, `BatchMode=yes`, `IdentitiesOnly=yes`, `ExitOnForwardFailure=yes`, `ServerAliveInterval=15`, `ServerAliveCountMax=4`, `StrictHostKeyChecking=yes` and the host's own `UserKnownHostsFile`, and the four forwards, all Unix-socket paths with no port on any listening side (test).
  - done: impl-1595 · 2026-11-03T03:14:12.376Z
  - verified: rev-35 [reviewer] · run rev-35-1595-final-1 · 2026-11-03T03:54:18.365Z · commit ec89a9084544ee11e114dd2116c455eb8bf06064
  - verified: rev-35 [reviewer] · run rev-35-1595-final-2 · 2026-11-03T04:53:12.878Z · commit ee744a6167e49b4ff213ea56896878161001ddc3
- [x] C2. Bootstrap passes the per-host secret only on stdin, never in argv, and a second bootstrap on a host whose supervisor lives starts nothing new (test).
  - done: impl-1595 · 2026-11-03T03:14:12.577Z
  - verified: rev-35 [reviewer] · run rev-35-1595-final-1 · 2026-11-03T03:54:18.365Z · commit ec89a9084544ee11e114dd2116c455eb8bf06064
  - verified: rev-35 [reviewer] · run rev-35-1595-final-2 · 2026-11-03T04:53:12.878Z · commit ee744a6167e49b4ff213ea56896878161001ddc3
- [x] C3. With an injected clock, consecutive failures back off 1, 2, 4 … 30 s with jitter. A master that stayed up 30 s resets the backoff, and a wall-clock jump retries at once (test).
  - done: impl-1595 · 2026-11-03T03:14:12.901Z
  - verified: rev-35 [reviewer] · run rev-35-1595-final-1 · 2026-11-03T03:54:18.365Z · commit ec89a9084544ee11e114dd2116c455eb8bf06064
  - verified: rev-35 [reviewer] · run rev-35-1595-final-2 · 2026-11-03T04:53:12.878Z · commit ee744a6167e49b4ff213ea56896878161001ddc3
- [x] C4. Before each start the carrier runs `-O exit` on the control path and removes a leftover control socket, and a new master after a SIGKILL multiplexes (`-O check` succeeds) (test).
  - done: impl-1595 · 2026-11-03T03:31:00.639Z
  - verified: rev-35 [reviewer] · run rev-35-1595-final-1 · 2026-11-03T03:54:18.365Z · commit ec89a9084544ee11e114dd2116c455eb8bf06064
  - verified: rev-35 [reviewer] · run rev-35-1595-final-2 · 2026-11-03T04:53:12.878Z · commit ee744a6167e49b4ff213ea56896878161001ddc3
- [x] C5. On a fake host, a master killed with SIGKILL is back with all four forwards and a successful probe within 10 s (test).
  - done: impl-1595 · 2026-11-03T03:14:13.448Z
  - verified: rev-35 [reviewer] · run rev-35-1595-final-1 · 2026-11-03T03:54:18.365Z · commit ec89a9084544ee11e114dd2116c455eb8bf06064
  - verified: rev-35 [reviewer] · run rev-35-1595-final-2 · 2026-11-03T04:53:12.878Z · commit ee744a6167e49b4ff213ea56896878161001ddc3
- [x] C6. The probe runs every 30 s through `agent.sock`, and `hub.status` and `cland hub status` show each host's tunnel state (`up`, `connecting`, `down`), its time since, its last probe and its reconnect count (test).
  - done: impl-1595 · 2026-11-03T03:14:13.656Z
  - verified: rev-35 [reviewer] · run rev-35-1595-final-1 · 2026-11-03T03:54:18.365Z · commit ec89a9084544ee11e114dd2116c455eb8bf06064
  - verified: rev-35 [reviewer] · run rev-35-1595-final-2 · 2026-11-03T04:53:12.878Z · commit ee744a6167e49b4ff213ea56896878161001ddc3
- [x] C7. A host whose pinned key differs from the host's own is never connected, and the refusal is logged without key material (test).
  - done: impl-1595 · 2026-11-03T03:31:00.853Z
  - verified: rev-35 [reviewer] · run rev-35-1595-final-1 · 2026-11-03T03:54:18.365Z · commit ec89a9084544ee11e114dd2116c455eb8bf06064
  - verified: rev-35 [reviewer] · run rev-35-1595-final-2 · 2026-11-03T04:53:12.879Z · commit ee744a6167e49b4ff213ea56896878161001ddc3

## Notes

Shared files: `hub/src/transport/transport.ts` (sole owner; E-1538 adds kind validation and its contract test without changing members); `hub.status` `hosts` field (owned here)

## Comments

### impl-1595 · 2026-11-03T03:03:58.591Z

Coordinator decision 5d260d01: (1) protocol.ts may add only optional HubStatus.hosts with matching shared/wire type, apart from T-1596 admission edits; second landing merges dev only when asked. (2) stable Transport {kind,host,start,stop,wake,status}, per-project registry feeds hub.status; T-1625 adds validation/contract tests without member changes. (3) bootstrap uses configured installed supervisor/agent command; code delivery remains T-1606. (4) additive supervisor --check reuses original PID/birth liveness check; unchanged T-1594 tests must pass.

### impl-1595 · 2026-11-03T03:07:48.937Z

Rule20 pre-change hub.status inventory: A-16142 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16142-t-1595-status-contract-consumer-inventory.md) records 292 field/frame consumers including production web/Neovim/CLI, startup probes, shipped skill examples, QA briefs and every test tier. Only producer/optional types/CLI migrate; existing fields retained, other readers ignore additions. New missing-hosts client regression covers older hub shape.

### rev-35 · 2026-11-03T03:21:37.414Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1595-source-1
commit: ad76fa25186d35681e28bdc9739f436c92a3a781
scope: full
findings: [{"severity":"high","text":"UserKnownHostsFile selects the per-host file but GlobalKnownHostsFile is not disabled. -F /dev/null ignores config files, not OpenSSH's compiled-in global host-key databases. OpenSSH combines user/system host keys, so a server key trusted globally can be accepted even when this host's private pin differs; bootstrap can then send the host secret to that admitted server. Make the per-host pin the exclusive trust source and add a wrong-private-pin/matching-global-key regression; the current fake checks only the private file and cannot expose this C7 bypass.","file":"hub/src/transport/ssh.ts","line":31},{"severity":"medium","text":"The result of -O exit is discarded; even a timeout/refusal returns false and execution unlinks the control socket and starts a replacement. A previous live master whose exit was not confirmed can lose its control path while retaining forwards, violating the one-master/positive-release boundary (rules12/25,C4). Distinguish positive old-owner absence from unknown/failed exit; retain/fence the old socket until confirmed cleanup. Add a held/refused exit control with an independently owned live master and assert no unlink/new master before its absence receipt.","file":"hub/src/transport/ssh.ts","line":104},{"severity":"low","text":"The UserKnownHostsFile -o value embeds an unquoted path in SSH config syntax. A valid project directory containing spaces is parsed as multiple known-hosts filenames, so the private pin is not read and strict bootstrap fails. Quote/escape that configuration value and cover a scratch project path with spaces while preserving the exact selected file.","file":"hub/src/transport/ssh.ts","line":31}]
finding_counts: {"high":1,"medium":1,"low":1}

Full source not clear:1high/1medium/1low. High ssh.ts31: per-host pin is not exclusive because GlobalKnownHostsFile defaults remain enabled; -F disables config loading, not trust databases. OpenSSH primary docs/source linked in A-16146 confirm combined user/system key lookup; current fake models only private trust. Medium ssh.ts104: -O exit result ignored then control socket unlinked despite failed/unknown exit; require positive old-master absence/fence and held/refused-exit regression. Low ssh.ts31: quote UserKnownHostsFile config value for project paths with spaces. C4/C7 failed; other criteria runtime-unverified. Coordinator-approved interface/status/supervisor/code-delivery seams respected, no admission-frame edits. Local A-16145 targeted macOS/static summaries not queued proof. No Reviewer reproduction/tests/probes/browser/edits; source causal traces only. Fresh corrected-head source review before verification. Detail A-16146: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16146-t-1595-source-review-exclusive-pinning-and-master-cleanup-receipts.md.

Criteria: C7 failed (Per-host UserKnownHostsFile is not exclusive: OpenSSH default global host-key files remain trusted and can admit a different private pin before bootstrap sends the host secret.), C4 failed (Failed or unknown -O exit is ignored before unlinking the control socket and starting another master; old live ownership is not positively settled.).

### impl-1595 · 2026-11-03T03:25:07.745Z

Coordinator decision5ba557cb approves endpoint-based old-owner absence: after -O exit require native ENOENT/ECONNREFUSED before exact-path unlink; other outcomes fenced with 1→30s backoff/path-free status reason; single flight per project/host tested with concurrent starts. No PID parsed from -Ocheck/no persisted signals. A-16146 red controls reproduced pre-fix: refused live master control path was unlinked (stat ENOENT); matching scratch global trust admitted mismatched private pin (master present true vs expected false). Consumer search extended for reason (additive optional HubStatus hosts member) and fake authenticate/parseSsh/UserKnownHostsFile across fake-ssh, fake-scp, fake-ssh/transport tests. Existing fake callers without scratch global override retain no-global behavior; quoted file list/default global semantics added solely to test the real OpenSSH trust boundary.

### rev-35 · 2026-11-03T03:33:13.308Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1595-source-2
commit: ec89a9084544ee11e114dd2116c455eb8bf06064
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected full source clear; all A-16146 findings resolved, no findings. Alternate OpenSSH trust disabled, private path config-quoted; negative scratch-global and spaces controls present. Control unlink now requires native exact-endpoint ENOENT/ECONNREFUSED plus socket close, per independently read Coordinator5ba557cb; live/unknown endpoint fenced with normal backoff/path-free status reason. Independent old-master negative preserves inode/no replacement until native absence; concurrent distinct carriers admit one. Optional status reason/CLI/wire/docs/consumer inventory migrated additively, old reply regression retained. Prior full review of bootstrap/options/clock/probe/supervisor integration carries forward; no admission-frame or Transport-member changes. C1–C7 runtime-unverified pending fresh same-head mode-free verify and named carrier/policy/status/supervisor/fake-SSH preservation facts. Local A-16149 targeted darwinarm64 Node24.21/static evidence is not queued/Linux/Web proof. Reviewer ran no tests/probes/browser and made no edits. Detail A-16150: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16150-t-1595-corrected-source-review-exclusive-trust-and-fenced-endpoints.md.

### impl-1595 · 2026-11-03T03:53:38.906Z

Final evidence ready at unchanged source-reviewed ec89a9084544ee11e114dd2116c455eb8bf06064. Independently streamed A-16157 named timing/finish facts: all6 carrier cases plus policy1/status1 pass, policy/status each also5/5 load-gate repetitions. Run3fea0b51 exit0,4868pass/zero fail/cancel/skip/todo; tree4ce600a73ff0ce98fe455d665cfe8234d31a806c, executor droplet c-8sfo2 Linuxx64 6.8.0-142-generic Node24.21.0/Nvim0.12.5; isolated HeadlessShell1248 GoogleChromeForTesting156.0.8078.4. T0/allT1/fallbackallT2/changedT3 carrier6/Web complete; remainingT3 deferred, T4 unexecuted. Budget/lint/ratchet/skip reports report-only; skips[]/missing0; native lifetime1028s/$0.0714 is not suite wall time. A-16158 retains raw supervisor3/fakeSSH9 local macOS preservation stdout/exit0, with explicit predecessor working-tree/source-equality provenance; not relabelled Linux/same-head native execution. Fresh origin/dev fetcha5e82b77e21d77c5103636f45877023f5997ee4a, merge-tree exit0/treead998b3d60c4bedb9507a81043bdd2ad2209c505; no merge/head/source changes. Reviewer is completing same-head final evidence review; QA affected/after-stage separate.

### rev-35 · 2026-11-03T03:54:18.365Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1595-final-1
commit: ec89a9084544ee11e114dd2116c455eb8bf06064
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final evidence clear; C1–C7 verified, no findings. Exact-head3fea0b51/A-16157 exit0,4868 pass/zero fail/cancel/skip/todo. Independently streamed all carrier6/policy1/status1 facts, including refused live-master cleanup/concurrent ownership and wrong-private-pin/matching-global trust plus path-spaces negative controls. Retained final10s recovery/cadence/secret/forward assertions inspected, whole-test timing not claimed as recovery latency. A-16158 raw supervisor3/fakeSSH9 named outputs and native exits0 are explicitly pre-commit local darwinarm64 Node24.21 evidence with relevant-source equality, not exact-commit/Linux preservation. Source correction unchanged; no unresolved findings. Uncached Linux x64 c-8sfo2 Node24.21/Nvim0.12.5, isolated Headless Shell1248/Chrome for Testing156.0.8078.4; T0/T1/allT2/changed carrierT3 sixcases/Web complete,remainingT3 batch-deferred,T4 unexecuted. Budget/lint/ratchet/skip diagnostics report-only. QA affected/after-stage separate. Reviewer ran no tests/probes/browser or edits. Detail A-16159: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16159-t-1595-final-evidence-ssh-recovery-exclusive-pinning-and-preservation.md.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified, C7 verified.

### rev-35 · 2026-11-03T04:26:22.183Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1595-delta-source-1
commit: ee744a6167e49b4ff213ea56896878161001ddc3
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Authorized merge delta source clear, no findings. Independently checked both parents and combined resolutions: admission/revocation dispatch is incoming dev verbatim apart from the additive tunnelStatuses import and hub.status.hosts expression; carrier and Hub admission docs both retained. Transport directory, SSH/policy/status tests and supervisor script unchanged from reviewed ec89a9084. Optional protocol/shared-wire hosts and three transport tier/index entries coexist with incoming changes. C1–C7 remain runtime-unverified at new head; prior A-16157 is predecessor evidence, not this merge receipt. Fresh mode-free verification may follow source clear; cover-quiet remains in force and local T0 queues behind its slot per Coordinator ef30a22e. Reviewer ran no tests/typecheck/probes/browser or edits. Both Standards and Spec axes have zero findings. Detail A-16163: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16163-t-1595-authorized-merge-delta-source-review.md.

### rev-35 · 2026-11-03T04:53:12.879Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1595-final-2
commit: ee744a6167e49b4ff213ea56896878161001ddc3
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Merged-head final evidence clear; C1–C7 verified, no findings. Exact-head queued5e41a09e/A-16164 exit0,4925 pass/zero fail/cancel/skip/todo. Independently streamed carrier6/policy1/status1 plus incoming host-secret-admission16, host-agent-boundary2, help7, layout16 and placement11 ordinary pass outcomes. Source unchanged since delta clear A-16163. A-16158 supervisor3/fakeSSH9 remains qualified predecessor/pre-commit local darwinarm64 Node24.21/native exit0 evidence with relevant-source linkage, not exact-commit/Linux native execution; incoming CLI revoke addition leaves serve path intact. Uncached Linux x64 c-8sfo2 Node24.21/Nvim0.12.5, runner tree ed233d00383106f8b1bb52cf3fbfcc7c46c7d51c, isolated Headless Shell1248/Chrome for Testing156.0.8078.4. T0/T1/allT2/Web and selectedT3 carrier6/allow-list10/git-daemon4 passed; remainingT3 batch-deferred,T4 unexecuted. Budgets/lint/incomplete ratchet/skip-reason diagnostics report-only, skips[]/missing0. Retained10s recovery assertion passed; whole-case timing is not recovery latency. QA affected/after-stage separate. Reviewer ran no local checks/browser/edits under cover-quiet. Detail A-16165: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16165-t-1595-merged-head-final-evidence-review.md.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified, C7 verified.

### impl-1595 · 2026-11-03T04:53:16.323Z

Merged-head verify5e41a09e/A-16164 exit0,4925pass/zero fail/cancel/skip/todo at delta-reviewed ee744a6167e49b4ff213ea56896878161001ddc3, treeed233d00383106f8b1bb52cf3fbfcc7c46c7d51c. Independently parsed actual named timing outcomes: carrier6,policy1,status1,unchangedhost-secret-admission16 allpass; policy/status also5/5 load-gate. Linuxx64droplet Node24.21/Nvim0.12.5, isolated HeadlessShell1248 ChromeForTesting156.0.8078.4. T0/T1/fallbackallT2/selectedT3(3files20identities once)/Web complete; remainingT3 deferred,T4 unexecuted; budget/ratchet/lint/skip reports report-only, skips[]/missing0. Native preservation3+9 retains A-16158 predecessor/macOS limits; no current remote native preservation claimed. Freshfetch origin/devbf486cb6, merge-treeexit0/tree8b95caee; head clean/unchanged,no merge. Merged-head evidence artifact posted for final review; local quiet honored.

### coord · 2026-11-03T05:39:03.786Z

Merged e21b64bffa6ccec52b4457285cca27d9052fadf3 onto dev.
