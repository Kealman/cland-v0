---
id: T-1246
kind: task
title: Neovim session attach finds no background session after T-1012 sealed fixture environments
state: closed
status: done
size: S
criterion_seq: 2
labels:
  - bug
  - ready-for-agent
assignee: null
parent: E-1196
blocked_by: []
regression_of: T-1012
topic: topic-988
branch: t/T-1246-neovim-session-attach-finds-no
created: 2026-10-24T13:30:29.183Z
updated: 2026-10-24T14:01:09.369Z
closed: 2026-10-24T14:01:09.369Z
---

## Summary

The periodic dev T3 4954e966 at 699a44dd (A-11081) failed `nvim/test/sessions-lifecycle.test.ts` "Claude Code, Codex and OpenCode sessions launched from the UI show in the panel with live state, attach on Enter, and a killed one turns unknown with the death in the hub log". The failure reads `the screen never showed coord attached in the centre within 15000 ms`, and the attach pane prints `no background session <id>` then `[Process exited 1]`. Coord ran it alone on local macOS at both commits: at 5e29a5f2^ it passes 1/1, at 5e29a5f2 (T-1012, sealed Neovim fixture environments) it fails 1/1 with the same message. T-1012's sealing likely gives the attach terminal a different fake Claude Code home or session identity than the hub used to launch, so the fake `claude attach` cannot find the session.

## Acceptance criteria

- [x] C1. The attach terminal launched from Neovim gets the same sealed fake-harness paths (FAKE_CLAUDE_HOME and the others) as the hub's launch, from the one shared fixture environment; T-1012's sealing stays intact, with no inherited parent variables (test).
  - done: impl-1246 · 2026-10-24T13:34:36.301Z
  - verified: rev-31 [reviewer] · run rev-20261024-1246-final · 2026-10-24T13:55:08.153Z · commit 31713e2b0dcadf481a037ce6520c89781e531c5c
- [x] C2. sessions-lifecycle.test.ts passes alone and in a mode-free run, and a search of nvim/test finds no other launch/attach pair split across environments (listed in the ready report).
  - done: impl-1246 · 2026-10-24T13:51:38.875Z
  - verified: rev-31 [reviewer] · run rev-20261024-1246-final · 2026-10-24T13:55:08.153Z · commit 31713e2b0dcadf481a037ce6520c89781e531c5c

## Comments

### impl-1246 · 2026-10-24T13:34:36.812Z

Implemented at 31713e2b: one accountFixtureEnvironment supplies fake homes, account paths and XDG roots to both startDaemon and startClient; child sealing remains unchanged. Original node --test nvim/test/sessions-lifecycle.test.ts red at 847b7c28: 0/1, exact output “no background session fc6a85ec” (A-11087). Same command on the committed source tree passes 1/1 (3356.22275 ms total); existing client-component sealing controls pass 6/6. Both targeted runs: local Darwin arm64, no suite load gate. Neovim typecheck passed. Launch/attach audit: sessions-lifecycle is the only real fake-harness launch+attach pair; layers launches without attaching; shell, shell-fixture, palette and graph attach scripted stub commands; launcher-component uses stub launch replies; scenarios/workbench uses spoke message flows, not native harness attachment. C2 mode-free evidence pending source-clear review.

### rev-31 · 2026-10-24T13:46:02.134Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261024-1246-source
commit: 31713e2b0dcadf481a037ce6520c89781e531c5c
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-1246 full source review — clear

Head31713e2b0dcadf481a037ce6520c89781e531c5c, tree d4c9d54d26d678f0c545927bdfd6a8b852ec85ed, fixed base/parent847b7c2839a504c58c17ec46410363b6faabe8da. Command git diff847b7c28...31713e2b; one-file sessions-lifecycle.test.ts correction. Task/origin refs match; task tree clean; whitespace check clean. C1 claimant done; C2 intentionally pending configured execution. QA none/after-stage/no brief or separate criteria. Both axes reviewed in-session; no subagents.

## Standards

No findings. The existing worker-owned accountFixtureEnvironment now builds the one explicit input object used by startDaemon and startClient, instead of letting their separate sealing roots choose different account defaults. The object includes only owned fake-Claude inputs, explicit fake Codex/OpenCode homes/timings and a fixture PATH. accountFixtureEnvironment itself uses the common fixtureEnvironment after overrides; provider/account credentials and all inherited Git configuration/repository variables are filtered. The downstream CLI/Neovim builders still apply their final filters; no parent-environment spread or filter removal introduced.

This sharing concerns explicit harness/account paths, not a demand that unrelated child HOME values match. Neovim retains its own disposable HOME/Git config; explicit CLAUDE_CONFIG_DIR/CODEX_HOME/XDG/fake homes are shared. fakeClaude initializes the account fixture before recording its private control-helper launch environment; using the same worker defaults now aligns fakeClaude.sessions() with the hub and attach client as well.

New assertions read the owned Neovim environment and compare FAKE_CLAUDE_HOME,FAKE_CODEX_HOME,FAKE_OPENCODE_HOME,CLAUDE_CONFIG_DIR,CODEX_HOME,XDG_CONFIG_HOME,XDG_DATA_HOME to the explicit shared object. No secrets or full environment are printed. The existing poisoned-parent/default-client sealing tests remain unchanged and supply the independent negative control. Real hub/fake-native launch/terminal attach/death/stop lifecycle remains appropriately T3; no new process, bound, workload, permission, product setting, role clause, test title or duration key change. No separate smell finding.

## Spec

No findings. Source establishes C1's requested one sealed fixture environment across launch and attach, while preserving T-1012 child sealing. All original three-harness panel/model/live-state and terminal-print assertions remain; killed Claude unknown/death log and stopped Codex confirmation/final log assertions remain. New path comparisons supplement these behavioral receipts, not replace them.

Inspected account-fixture-env, shared fixture-environment, startDaemon/CLI launch, Neovim final child builder and fakeClaude.sessions(). The original mismatch is consistent with fake Claude comparing the saved config directory against the attach environment. A-11087 retains actual original local failure: screen never showed coord attached within15000ms, fake “no background session fc6a85ec”; the earlier wrong reported id was corrected in topic before this review. Reviewer performed no reproduction.

C2 audit in task comment checked against relevant source/searches: sessions-lifecycle is the native fake-harness launch+terminal attach pair; layers launches fake Claude without attachment; shell/shell fixture, palette and graph use scripted stub attach commands; launcher-component uses recorded replies; workbench scenarios use spoke message flows. No additional split native launch/attach pair found. Keep this audit list in the ready report.

Local retained receipts A-11089/A-11090: Darwin arm64 targeted lifecycle1/1, no skips/fails, native case3027.125667ms/runner3356.22275ms; client-component sealing6/6,runner1907.948125ms. No suite gates, no configured/Linux proof. Neovim typecheck/static lint success is reported, with report-only test-lint census; original command/exit/source metadata is not embedded in the provided plain stdout logs. Preserve available original invocation/output/exits/provenance and missing-record limits durably without rerunning for transcription or inventing overall wall time. Existing native outputs remain useful local proof of the correction.

Disposition: full source clear, findings []. C1/C2 runtime marks await ordinary configured mode-free verify at this unchanged clean head, including the changed T3 file's actual selected execution and outcome. Submit configured verification and route its original result to rev-31/topic-988. After the required receipt completes, update C2 claimant mark with its audit/result; no claimed pass before execution. Keep source stable, no unauthorized dev merge or enqueue. Reviewer used only read-only source/Git/tracker/docs/artifact reads, no tests/probes/process signals/browser or delegation.

Standards0findings; Spec0findings.
Durable audit A-11113.

### impl-1246 · 2026-10-24T13:52:26.098Z

C2 completed: configured mode-free run 37d707ac at unchanged reviewed 31713e2b passed 1232/1232 on Linux x64 droplet c-8 lon1 (A-11123). T0, all T1, selected Neovim T2, changed sessions-lifecycle T3 once, Web smoke; remaining T3 deferred. Lint/T3 ratchet report-only, lifecycle's prior 5s budget report observed 5.617s. C1/C2 marked done; final evidence review requested. A-11125 retains original local invocation/output/exit/source provenance and complete native launch/attach audit (no other split pair). After-run conflict check: fresh origin/dev 847b7c28, merge-tree exit 0, head remains 31713e2b and worktree clean; no merge or enqueue.

### rev-31 · 2026-10-24T13:55:08.153Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261024-1246-final
commit: 31713e2b0dcadf481a037ce6520c89781e531c5c
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-1246 final evidence review — clear

Unchanged source-reviewed head31713e2b0dcadf481a037ce6520c89781e531c5c, tree d4c9d54d26d678f0c545927bdfd6a8b852ec85ed; origin task ref matches. Carries full Standards/Spec source clearance A-11113 / rev-20261024-1246-source. Independently inspected task.verify, original configured log A-11123, original local stdout A-11087/A-11089/A-11090 and retained provenance/audit A-11125. No runtime execution by Reviewer.

Configured mode-free 37d707ac-4576-4023-8d3e-50b7044bf3d1 exited0 at that exact head: 1232 ordinary tests/pass, zero fail/cancelled/skipped. T0 host check exit0, all T1 exit0; selected Neovim T2 (41 files/344 identities) exit0; changed sessions-lifecycle T3 once exit0; Web smoke exit0. This is the configured selection for an all-nvim change, not all hub T2, all T3/T4 or full Web. The named lifecycle finish is an explicit native Linux pass at5.617371512s; file finish6.390979872s. Changed-duration phase reports one passing identity, one base execution/no repetitions,6.542s added selected wall; no load proof claimed. Remaining T3 remains periodic/integrated; T4 absent.

Linux x64 6.8.0-142-generic, Node24.21, Neovim0.12.5; c-8 lon1 droplet cland-v0-1134ce69, workers2, lifetime265s, cost$0.0184. T0 envelope24.513s refers to the host gate; log says reused tree d863d28987e0dab9e4aa792702fdf3ba2242c2bd, not an exact-head remote rerun. Test lint133/60 and T3 ratchet/duration notices are report-only. The unchanged lifecycle identity exceeded its existing5s budget at5.617s, with5.503s prior timing; this is not a new identity or a failed gate, and no allowance/baseline was fabricated.

Local proof stays separate: Darwin arm64/Node24.21, final precommit source tree committed unchanged as31713e2b. A-11089 alone1/1, test3.027125667s, Node runner3.356222750s; A-11090 sealing6/6, Node runner1.907948125s. A-11125 records original commands/sessions/final exit0 metadata and missing overall wall measurements. Original red A-11087 at847b7c28 was an observed no-background-session failure; superseded intermediate account-root attempt remains failed and is not used as green proof. No transcription reruns.

C1 verified: same accountFixtureEnvironment feeds hub launch and Neovim terminal attach, with explicit fake/provider paths and child-side exact-value assertions; downstream sealing and separate owned HOME/Git defaults remain. Source audit inspected this environment's consumers; configured lifecycle and sealing controls pass.

C2 verified: lifecycle passes alone locally and in configured native Linux changed-T3 execution. The retained audit lists sessions-lifecycle as the sole native launch/attach pair; layers only launches, shell/palette/graph attach scripted stubs, launcher-component uses recorded replies and workbench uses spoke flows. Independent source search in the full review agreed. The ready report must retain this inventory. A-11125's clean merge-tree against observed origin/dev847b7c28 is a read-only conflict observation, not a merge or future guarantee; reviewed head unchanged.

Both criteria done and now verified. Final evidence clear, zero findings; no extra runs, source changes, enqueues, QA or landing claim. Coordinator owns enqueue.
Durable review A-11131.

Criteria: C1 verified, C2 verified.

### coord · 2026-10-24T14:01:09.369Z

Merged 32b505ff9764e4ac2d4ee9eccdfb2576b883a98c onto dev.
