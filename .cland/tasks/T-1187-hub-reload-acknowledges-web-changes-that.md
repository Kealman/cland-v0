---
id: T-1187
kind: task
title: Hub reload acknowledges [web] changes that the running web edge ignores
state: open
status: in progress
size: S
criterion_seq: 1
labels:
  - ready-for-agent
assignee: null
parent: E-1197
blocked_by: []
topic: topic-1002
branch: t/T-1187-hub-reload-acknowledges-web-changes-that
created: 2026-10-23T21:39:31.010Z
updated: 2026-10-24T20:56:54.235Z
---

## Summary

`cland hub reload` accepts changes to `[web]` settings (bind, port, origin, dist) and publishes the newly parsed config. But the web edge is created once from the startup config: `hub/src/hub/daemon.ts` around line 419 builds it, and `STARTUP_FIELDS` in `hub/src/hub/configuration.ts` doesn't include `web`. So a reloaded `[web]` change is acknowledged while the running edge keeps its old values. impl-1186 found this by reading the source on 2026-10-23 at 21:39Z; no test or probe was run. T-1186 documents that `[web]` changes need a hub stop and start.

## What to build

Treat `web` as a startup field, so that a reload that changes it is refused with a message naming the restart. Alternatively, rebind the edge on reload. Pick whichever matches how the other startup fields behave.

## Acceptance criteria

- [ ] C1. Changing `[web] origin`, `bind` or `port` and running `cland hub reload` is either refused with a message naming a restart, or applied to the running edge. No reload acknowledges a `[web]` change that the edge ignores (test).
  - failed: rev-23 [reviewer] · 2026-10-24T20:56:54.235Z · note Functional implementation accepted, but new documentation fails the existing docs guard and config-set per-file guidance is missing; corrected-head source clearance/runtime evidence required.

## Comments

### impl-1187 · 2026-10-24T20:52:04.076Z

Implementation seam: the existing T2 sealed CLI → in-process projectHub configuration reload boundary proves C1 at the cheapest tier that includes the actual command; no hub-process lifecycle or browser is needed. Choose startup-field refusal for the whole web table, preserving the established atomic last-good config/roles pair.

Rule 20 consumer inventory (searched production, shared wire, Neovim/Web, skills, QA, probes and every test tier before changing behavior): ProjectConfiguration.reload/fresh/set and daemon reload/SIGHUP/auto-refresh; Dispatcher hub.reload and config.set; CLI hub reload/config set; shared/wire hub.reload request and hub/src/protocol.ts status types; journal event readers. No wire field or error class changes: existing generic restart-required error is extended to web. Neovim/Web have no reload caller; browser hub.reload is denied by web-authority. Shipped role grant/usage entries only name the command and remain valid. Startup probe project-probes.test.ts, tool-arguments, roles-template/component/snapshot/launch/custom-roles, journal-flush, executor-prepare-component, plan-approval-reload, config-set and config-reload T2 tests plus T3 config-reload.test.ts do not edit web and are unaffected. T4 has no matching reload consumer. QA briefs E-412 stages 2/3, E-611, E-425 retain their authority/reload examples (no web reload expectation). Existing successful CLI wire shape stays unchanged and covered by the existing reload tests. Update usage help, hub README, docs/agents test guidance and implement skill/CHANGES; no role grant or clause change required.

### impl-1187 · 2026-10-24T20:53:49.504Z

C1 implemented with web as an existing startup-only field (also makes config set web.* report restart). Local macOS checks on the uncommitted task tree: config-reload-component.test.ts 10/10 and config-set.test.ts 11/11, sequential single-file T2 runs; npm run typecheck green. No T3/T4 or browser run locally; no duration/load gate claimed. Red control before the source change: all four generated web.<key> cases failed with actual CLI output `config reloaded: {...}` and exit 0 instead of 1. Green asserts exact restart refusal plus retained budget/config provenance/web status/role model. Equivalent parsed defaults/normalized origin reload successfully, removing configured origin refuses. Help/README/per-file test guidance and upstream skill CHANGES updated; existing role clause needs no extra lines or grant changes. Fetched origin/dev and merged (already up to date) before first review.

### rev-23 · 2026-10-24T20:56:54.235Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-20261024-1187-source
commit: 47947fb9dfcc76d56303559d44a963dd3c360112
scope: full
findings: [{"severity":"medium","text":"M1: new reload guide heading fails existing test-docs exact test-path heading contract; use '# hub/test/config-reload-component.test.ts' and preserve the guard.","file":"docs/agents/tests/hub-test-config-reload-component.test.ts.md","line":1},{"severity":"medium","text":"M2: new config-set regression lacks its exact path-derived per-file guide/index entry; move its specific guidance into hub-test-config-set.test.ts.md per rule16.","file":"hub/test/config-set.test.ts","line":105}]
finding_counts: {"high":0,"medium":2,"low":0}

T-1187 full source review — not clear

Head47947fb9dfcc76d56303559d44a963dd3c360112/tree22056731ceb51358ac22710e68f23d2ab5c7491c, sole parent/fixed base fdcea0b958178e2b34c69b5f19fc22dbe8da1626. git diff fdcea0b9...47947fb9:10files,98insertions7deletions; one commit47947fb9. Scope full, run rev-20261024-1187-source. Both Standards/Spec axes reviewed in-session under crew no-subagent constraint. Static read-only Git/source/tracker/artifact inspection only; no test/probe/browser/fetch/mutation. C1 claimant done, runtime verification not established.

## Standards
M1 medium — docs/agents/tests/hub-test-config-reload-component.test.ts.md:1 uses '# Configuration reload component tests'. Existing hub/test/test-docs.test.ts:23–25 requires an exact '# <repository test path>.test.ts' heading and derives the guide filename from it. Current heading has no match, deterministically reaches the guard's 'hub-test-config-reload-component.test.ts.md: test file heading' assertion. This is a static finding, not a claim that Reviewer ran the guard. Change heading to '# hub/test/config-reload-component.test.ts' and validate the existing targeted docs guard at the corrected head before another source request. Do not change the guard.

M2 medium — the new config-set.test.ts:105–115 regression has file-specific guidance only in another file's guide, docs/agents/tests/hub-test-config-reload-component.test.ts.md:13–15. No docs/agents/tests/hub-test-config-set.test.ts.md/index row exists at this head. Rule16 and docs/agents/tests.md:3 place file-specific guidance in the exact path-derived guide. Add that guide/index entry with '# hub/test/config-set.test.ts', describing persisted web.origin/restart receipt, pending reloadable save refusal and last-good loaded budget assertion; reference the reload guide for shared atomic-pair behavior. Existing complete assertions should remain.

No other standards finding. T2 is the lowest suitable real CLI→socket→in-process projectHub seam. New cases use tempProject, shared sealed account/Git environment builders and fake adapters; CLI itself is the subject, no new infrastructure child/browser/wall wait. Harness registers daemon.stop/process-log drain before owned directory removal. CLI exec terminal receipt precedes final status/role readbacks; no missing observer ordering or relaxed bound. Manifest declares both touched files T2. Existing successful CLI reload/client wire path remains unchanged. Skill provenance CHANGES appended; help/frozen fixture, README and implement skill accurately describe startup-only web settings. No new role grant/clause, dependency or unrelated abstraction. No material smell finding.

## Spec
No functional finding against C1. Adding web to existing STARTUP_FIELDS reuses isDeepStrictEqual comparison before any apply/config/roles/provenance publication. Parsed bind/port/dist/origin changes reject with 'web changed: restart required', leaving the loaded pair intact. Default/normalized equivalent web tables remain equal. Explicit reload, SIGHUP and role auto-refresh use the same ProjectConfiguration reload guard. The daemon's web listener is startup-owned, so refusal is consistent with existing startup fields and the issue's permitted approach. config.set web.* saves with applies restart through the same field list; later reloadable edits return saved/not-applied while pending web differs. Existing authorization and generic failure/reply shapes stay unchanged.

Four generated tests 'hub reload refuses changed web.origin/bind/port/dist with restart guidance and retains the config/roles pair' change budget+roles alongside web and retain terminal code1/restart error, old budget, config provenance, web status and role model. Equivalent-parsed-settings case accepts defaults/normalized HTTPS origin then refuses removing origin. New config-set case asserts disk readback/applies restart then pending live-budget save remains unpublished. No fake edge rebind or assertion weakening. A separate browser/native process test is unnecessary for rejecting before publication; existing T3 config-reload owns SIGHUP/PID lifecycle.

Rule20 pre-edit item inventory covers reload/fresh/set, daemon/CLI/SIGHUP, dispatch/protocol/shared wire/journal, no Web-authorized reload caller, role examples, QA E412/E611/E425, startup probes and T1/T2/T3 consumers; T4 no matching consumer. Reviewed relevant callers and startup edge/parse semantics. Existing generic client result/error contract is preserved; no new wire field or outcome class. Persisted config remains on disk for restart; loaded provenance/roles retain prior objects on rejection. No consumer found that requires successful web reload.

A-11408 is an implementation/local-evidence summary, not full original command/stdout/exit/native timing envelopes. It reports macOS local uncommitted working tree subsequently committed47947fb9: four pre-change false-success red cases (actual exit0/'config reloaded' instead of1), reload-component10/10, config-set11/11 and root typecheck pass. It does not retain literal per-case original red/green output or native file timings/process exits; no exact per-run tree captured. These are lead-reported partial local facts, not independently executed/fully audited receipts. Preserve available original commands/stdout/exits/native timings with source/platform attribution and explicit missing-record limits; do not rerun merely to transcribe evidence. No T3/T4/browser/load/configured-suite evidence yet.

Consolidated fix set M1–M2 only; functional guard/tests accepted. Hold verification until corrected pushed head receives fresh source verdict. Restore claimant C1 done after correction if this not-clear mark removes it. Source clearance then permits one ordinary mode-free configured verify at unchanged corrected head, followed by original evidence review. No per-itemQA(none/after-stage), stage/landing/merge claim.

Standards2medium findings; Spec0functional findings.

Durable audit A-11421.

Criteria: C1 failed (Functional implementation accepted, but new documentation fails the existing docs guard and config-set per-file guidance is missing; corrected-head source clearance/runtime evidence required.).
