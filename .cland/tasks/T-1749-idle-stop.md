---
id: T-1749
kind: task
title: Idle stop
state: closed
status: done
size: S
criterion_seq: 4
labels:
  - ready-for-agent
assignee: null
parent: E-1534
blocked_by:
  - T-1746
topic: topic-1443
branch: t/T-1749-idle-stop
created: 2026-11-07T16:01:59.051Z
updated: 2026-11-08T18:40:19.957Z
closed: 2026-11-08T18:40:19.957Z
---

## Summary

The scheduler stops an empty host after the pool's `idle_stop` (20 minutes by default). It never stops one before the provider's billing minimum (`earliestStop`), never below `min_hosts`, and never a host with sessions. A host that gains a session during its idle wait restarts the wait. On DigitalOcean and on the fake, a stop destroys the host through the confirmed destroy path.

## What to build

The scale-down half of the scheduler. It uses `earliestStop` from `hub/src/host/provider/declarations.ts`, as `docs/hub/host-providers.md` requires of this epic. `idle_stop` is a real config key: tests and the QA demo shorten it in `config.toml`.

## Acceptance criteria

- [x] C1. With `idle_stop = "1m"` on the hub clock, an emptied host above `min_hosts` is destroyed after one minute, and the pool's last host at `min_hosts` stays (test).
  - done: impl-1749 · 2026-11-08T15:12:22.885Z
  - verified: rev-37 [reviewer] · run rev-37-1749-evidence-1 · 2026-11-08T15:47:22.569Z · commit a204b43732e99caf5ecce1e22b436d758fa43ff7
  - verified: rev-37 [reviewer] · run rev-37-1749-evidence-2 · 2026-11-08T18:02:33.288Z · commit 9a7a11116fdf76efb95066ca1f66dc344dd9e9d8
- [x] C2. A host whose provider billing minimum has not passed is not stopped before `earliestStop` (test).
  - done: impl-1749 · 2026-11-08T15:06:57.552Z
  - verified: rev-37 [reviewer] · run rev-37-1749-evidence-1 · 2026-11-08T15:47:22.569Z · commit a204b43732e99caf5ecce1e22b436d758fa43ff7
  - verified: rev-37 [reviewer] · run rev-37-1749-evidence-2 · 2026-11-08T18:02:33.289Z · commit 9a7a11116fdf76efb95066ca1f66dc344dd9e9d8
- [x] C3. A host with a session is never stopped by idle stop, however long it runs (test).
  - done: impl-1749 · 2026-11-08T15:06:58.301Z
  - verified: rev-37 [reviewer] · run rev-37-1749-evidence-1 · 2026-11-08T15:47:22.569Z · commit a204b43732e99caf5ecce1e22b436d758fa43ff7
  - verified: rev-37 [reviewer] · run rev-37-1749-evidence-2 · 2026-11-08T18:02:33.289Z · commit 9a7a11116fdf76efb95066ca1f66dc344dd9e9d8
- [x] C4. A host that gains a session during its idle wait is not stopped at the old time (test).
  - done: impl-1749 · 2026-11-08T15:06:59.003Z
  - verified: rev-37 [reviewer] · run rev-37-1749-evidence-1 · 2026-11-08T15:47:22.569Z · commit a204b43732e99caf5ecce1e22b436d758fa43ff7
  - verified: rev-37 [reviewer] · run rev-37-1749-evidence-2 · 2026-11-08T18:02:33.289Z · commit 9a7a11116fdf76efb95066ca1f66dc344dd9e9d8

## Blocked by

- T-1746

## Notes

- Hot files: `hub/src/host/pool-runtime.ts`, `hub/src/host/scheduler.ts` (stop decision).
- Tests: new `hub/test/pool-idle-stop.test.ts` (T2, fake clock).
- Serves epic C4.

## Comments

### impl-1749 · 2026-11-08T14:54:20.325Z

Pre-edit rule-20 sweep: PoolRuntime importer: adapters/sessions.ts; startPoolScaling caller: hub/dispatch.ts. No wire/persisted record shape change. Callback option is additive; legacy start(create) remains supported. earliestStop tests and E-1533 briefs unaffected. E-1534-stage-2 source probes name hostInUse/inUse; retain methods unchanged. Approved cross-lane edits limited to Sessions.startPoolScaling and Dispatcher.useSessions callback site. Full direct importer list and run evidence will follow before review.

### impl-1749 · 2026-11-08T14:59:28.577Z

Importer inventory completed: T1 host-provision-records, session-cwd, lifecycle-serialization; T2 adapter-generation, session-host, session-host-routing, host-reboot, session-archive, session-brief-component, host-registry, inject-stalled, human-hold, host-revoke, host-destroy, artifact-lifecycle, codex-remote-cleanup, artifact-host, launch-admission, host-survival, name-reservation, claude-code-sessions, roles-session-refresh plus new pool-idle-stop. These 23 direct-importer files passed 365/365 local macOS tests on Node v24.21.0 before the async declaration enhancement (rerun affected cases pending). T3 runtime importers queued for preservation slot: territory-task-branch, session-brief, request-guard, worktree-host, system-processes, adapter-generation-forward, host-flush-native, tracker-native-boundary, session-events. Type-only importers unchanged. Shared protocol/persisted shapes unchanged; old start(create) retained. Cross-lane touched functions: Sessions.startPoolScaling only; Dispatcher.useSessions only plus provider imports. daemon.ts unchanged (my earlier re-export description was mistaken; actual callback site was always dispatch.ts).

### impl-1749 · 2026-11-08T15:07:09.440Z

Source cf13504ff committed/pushed after fetch+merge origin/dev (already up-to-date). C1–C4 covered by committed fake-clock cases. Final cross-lane edit inventory: Sessions.startPoolScaling adds lifecycle options + clock, Sessions.configurePools receives optional ProjectConfig; Dispatcher.useSessions supplies provider declarations and confirmed destroy callback, Dispatcher.configure passes its incoming config (Coordinator decision f1c0841e). No daemon/restart/exited-path edits. Evidence A-17854 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-17854-t-1749-idle-stop-red-green-and-scope.md. Final importer reruns and hub verification pending; no final-green claim yet.

### impl-1749 · 2026-11-08T15:09:02.563Z

Final source/tests (cf13504ff, byte-identical at docs-link-only head 6656e34bb): all 23 direct-importer T1/T2 files passed 368/368, local macOS arm64 Node v24.21.0, serial file execution. New pool-idle-stop cases 9/9 included. Execution log is awaiting durable artifact publication with final native receipts. No browser, Linux or live-provider run. Final nine T3 files still awaiting approved preservation slot; earlier native receipts explicitly superseded for final-head purposes.

### rev-37 · 2026-11-08T15:10:54.587Z

verdict: review
result: not clear
by: rev-37 [reviewer]
run: rev-37-1749-source-1
commit: 6656e34bb1b43e76affbca535dba52bebe7d3981
scope: full
findings: [{"severity":"medium","text":"A synchronous declarations exception skips cache/retry scheduling, leaving a quiet idle host with no timer or in-flight read to resume after provider recovery. Treat it like unavailable/async rejection and prove clock-only throw-once recovery.","file":"hub/src/host/pool-runtime.ts","line":67},{"severity":"medium","text":"The new pool-idle-stop test guide is not indexed; the existing T1 test-docs membership contract requires the exact test/guide row. Regenerate the index and preserve the membership assertions.","file":"docs/agents/tests/index.md","line":274}]
finding_counts: {"high":0,"medium":2,"low":0}

# T-1749 full source review

Head6656e34bb1b43e76affbca535dba52bebe7d3981; branch t/T-1749-idle-stop.
Request updated fromcf13504ff; only delta is the corrected implement CHANGES relative link, production/tests unchanged. Runtime diff reviewed against origin/dev merge-base.
Run rev-37-1749-source-1; scope full; result not clear.
Standards and Spec reviewed in-session; no delegation, tests, typecheck, browser, filesystem edits or merge by Reviewer.

## Standards

Medium — docs/agents/tests/index.md:274.
The new docs/agents/tests/hub-test-pool-idle-stop.test.ts.md is absent from the per-test index. hub/test/test-docs.test.ts explicitly calls assertTestDocIndex(index,allDocuments) then requires the exact test/guide row; the reviewed tree cannot satisfy this existing T1 membership contract. Regenerate the index and retain the unmodified test-docs membership assertion. Lead confirmed the omission ineb7dbea7. This is a source-observed deterministic mismatch, not a Reviewer-run failing test.

Otherwise:
- Production uses shared earliestStop, readHostPools/HostProviderRegistry, existing inUse and confirmed destroyHost, rather than copied policy or direct provider release.
- The new T2 file uses SQLite inventory, scratch fixtureEnvironment, a shared FakeClock for machine creation/deletion/lease settlement, and joined runtime cleanup before store/root removal. Native I/O is not introduced into it.
- Sessions and Dispatcher changes are local additive wiring plus explicit incoming-config forwarding, authorized by Coordinatorcc5c3070/974549f6/f1c0841e. ProjectConfiguration reload order remains unchanged.
- New guide/README/CHANGES describe billing/usage/minimum protection, incomplete destruction, clock, restart reset, exclusions and config apply. Shared host-providers edit stays within the authorized stale sentence. No command/wire/persisted reply shape changes or role permission changes.
- Consumer inventory covers PoolRuntime/Sessions/Dispatcher and T1-T3 runtime importers; existing method entrypoints remain supported.

## Spec

Medium — hub/src/host/pool-runtime.ts:67 (catch :83).
A synchronous lifecycle.declarations exception occurs before the cache/retry record is installed. The outer catch continues without setting next. With no other pending deadlines, this leaves no timer and no in-flight read to trigger reconcile. A quiet idle host can stay billable indefinitely after one transient declaration failure, even if the provider immediately recovers. Async rejection follows the intended unavailable+60s retry path; synchronous failure must receive the same bounded retry behavior, while granting no destroy authority before valid declarations. Add a throw-once -> valid response control that reaches recovery through the hub clock alone, with no explicit external reconcile/config/session event. Lead confirmed this ineb7dbea7.
C1 fails for idle-stop liveness under declaration recovery.

No additional source findings:
- Ready-only excess rows get an observed idle interval; sessions, retained capacity and positive placement promises use existing inUse and clear it. Reserving synchronously deletes old idle state even if the promise is released before a timer tick.
- earliestStop combines actual machine creation (fallback provision creation), full pool idle duration and validated provider billing minimum.
- The synchronous stopping map fences member/reserve/validate before the deferred destroy call and excludes stopping hosts from minimum selection. Rechecking inUse per row keeps simultaneous eligible deadlines above min_hosts.
- destroy routes through existing registration settlement, machine/key confirming reads, absence receipt/watchdog retirement and lease/spend release. Incomplete records retain ownership rather than being treated as released.
- Explicit configure(settings) snapshot is received through Dispatcher.configure(config) and Sessions.configurePools(config), avoiding the known apply-before-publish window; no-argument startup callers remain.
- Shutdown clears its clock timer and joins admitted create/destroy/declaration work before storage closure. Async declarations are shared per provider; invalid/unavailable values do not authorize stop.

## Criteria and evidence limits

C1 failed: a transient synchronous declaration exception can permanently lose the idle-stop schedule.
C2/C3/C4 remain runtime-unverified in this source-only pass. No verified marks.
The missing index is an additional global verification blocker, recorded independently.

A-17854 reports nine new fake-clock T2 cases; source assertions cover C1 exact60s/minimum retained, C2 billing180s, C3 running host retained, C4 old deadline invalidated/full interval after exit, promise reset, simultaneous deadlines, both real config.set hot apply cases and async declarations. Config tests assert applies:now and confirmed destroyed/released record, not only ok. Source comparison confirms those retained assertions.
Prior red is reported as C1 actual[] vs expected['z']; hot-apply isolation kept the HostSecretStore fixture and applies:now, restored only the old no-argument call, and failed 'hub confirmed destroyed provision: not within15000ms', ready row retained. These are lead-reported targeted evidence, not Reviewer execution or full configured evidence.
Local macOS arm64 Node24.21.0 earlier importer365/365 and nine native importer files preceded final configurePools correction and are explicitly predecessor receipts. Current-head T1/T2 and native reruns pending, assigned serial slot behindimpl-1755. Root typecheck/T0/lints are reported passing with baseline report-only notices; no full suite/Linux/browser/live provider run. The8s C1 allowance labels measured macOS worst4.950s, expiry2026-11-15, Linux unexecuted, report mode; no projection is counted as Linux pass.

Fix both findings, preserve original red/green producer output/source linkage, push a fresh head and request source review before configured verification. Apply Coordinator's required current-head importer reruns in the assigned slot; do not relabel old native receipts. Tracker QA policy is full/after-stage (the request says affected); final stage QA must follow the tracker/Coordinator policy.

Standards1medium; Spec1medium.


A-17859: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-17859-t-1749-source-review-declaration-recovery-and-guide-index.md

Criteria: C1 failed (A transient synchronous provider-declaration failure can permanently drop an otherwise eligible host's idle-stop schedule.).

### rev-37 · 2026-11-08T15:13:00.283Z

verdict: review
result: clear
by: rev-37 [reviewer]
run: rev-37-1749-source-2
commit: a204b43732e99caf5ecce1e22b436d758fa43ff7
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

# T-1749 corrected source clear

Head a204b43732e99caf5ecce1e22b436d758fa43ff7; run rev-37-1749-source-2; scope full; clear; findings[].
Compared with6656e34bb1b43e76affbca535dba52bebe7d3981, one corrective commit, no dev merge. Full review A-17859 remains applicable with both findings repaired. Standards and Spec assessed in-session, read-only.

## Standards

No findings. Generated per-test index now contains the exact pool-idle-stop test/guide row. The correction adds a documented typed-seam control, retaining prior assertions and T2 isolation. No change to approved cross-lane edit scope, duration policy, native owners, wire or persisted shape.

## Spec

No findings. A synchronous declaration exception is converted to a rejected promise before the existing cache/read owner is registered. Its rejection therefore publishes unavailable state and the60s retry through the same path as async failure; no extra parallel retry policy. The tracked finalizer reconciles only while open; shutdown joins the read. Valid declarations remain required before earliestStop/destruction.

The new control intentionally has exactly one quiet ready host, minimum0, provider billing minimum60s, and a callback that throws on read1 then returns valid declarations on read2. It advances59999ms with no destruction, then1ms, waits for the production confirmed destruction receipt and requires exactly2reads/['z']. No external reconcile, config or capacity call can mask the lost retry. The two-host async sharing control and original9cases remain intact.

Lead reports this same control red before fix: 'throw-once provider recovered and confirmed destruction: not within15000ms'; corrected10cases green, new case83.6ms locally. Hub typecheck, guide-index and closed-wording lints reported exit0. These are targeted lead-reported receipts, not Reviewer execution or full-suite/Linux proof. Retain original native output with exact head/source linkage for final evidence.

## Remaining evidence

C1-C4 remain runtime-unverified at source-only clear. Failed C1 implementation mark is restored; final marks await exact-head configured run.
Current23direct-import T1/T2 rerun and9native importer slot remain pending; Coordinator requires applicable final-head native evidence, not predecessor relabelling. Complete required checks in the assigned slot, then mode-free cland verify at this exact head. Any change of head needs source review first.
QA policy confirmed full/after-stage. No per-item QA or final runtime claim.

Standards0; Spec0 findings.


A-17861: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-17861-t-1749-corrected-source-clear-at-a204b4373.md

### rev-37 · 2026-11-08T15:47:22.569Z

verdict: review
result: clear
by: rev-37 [reviewer]
run: rev-37-1749-evidence-1
commit: a204b43732e99caf5ecce1e22b436d758fa43ff7
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

# T-1749 final exact-head evidence

Head a204b43732e99caf5ecce1e22b436d758fa43ff7, branch independently unchanged.
Run rev-37-1749-evidence-1; scope evidence; clear; findings[]; verified C1-C4.
Source clear rev-37-1749-source-2 / A-17861 remains applicable.

Configured run cfcc1efa-de2e-490c-ace6-201d92c96f5f / A-17890 Finished exit0, aggregate5596pass, zero fail/cancel/skip/todo. Canonical tree independently reconstructed read-only as4e85b5031bae008dba7c9cd1697926c80cff2ef7, matching admitted provenance.
Uncached droplet Linuxx64 6.8.0-147-generic, Node24.21.0, Neovim0.12.5. Isolated browser /home/runner/cland/node_modules/playwright-core/.local-browsers/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell, Google Chrome for Testing156.0.8078.4.
T0/allT1/fallback-allT2/Web completed plus mapped T4 inbox-verifier-load once (no T4 repetitions). T3 not executed in this configured receipt; remaining T3 deferred merge batch. No all-T3/all-T4 claim. Lint/duration/budget/ratchet notices report-only; skips[] and skipReasonCheck report/missing0. Measured file/case timings exclude driver startup where native case timings do; no projection or executor lifetime is used as test wall time.

## Independently checked recorded facts

pool-idle-stop has10unique generated names,60pass test finish records:10base +50load-gate, exactly5/5 per case, no nonpass. File wrapper completions excluded.
- C1 idle host is destroyed at one minute while min_hosts stays: base0.128290235s; exact fake59999+1ms and confirmed destroyed/released excess host, minimum host retained.
- C2 billing minimum delays destruction beyond idle_stop: base0.13821209s; shared earliestStop retains the host through179999ms and destroys at180000ms.
- C3 running host stays beyond idle_stop and billing minimum: base0.131730582s; busy reverse-lexical host retained after an hour, only idle peer destroyed.
- C4 session gained during idle wait restarts the full wait after exit: base0.19801443s; old deadline cannot destroy the occupied host and full new minute follows exit.
All four pass base+five; C1-C4 verified against retained source assertions and same-head runtime facts.

Additional required safeguards, also base+five:
placement promise invalidates old idle interval; simultaneous deadlines retain raised minimum; real hub config idle_stop and min_hosts hot apply each assert applies:now and observe confirmed destroyed/released provision; async provider declarations share one read; single quiet host sync declaration throw recovers at60s solely through the clock and exactly2reads.
Largest observed new-case Linux sample0.640605285s, not a new allowance-triggering observation. Existing8s C1 allowance retains prior labelled macOS worst4.950s and report policy.
All4 test-docs cases pass, including exact guide-index membership. Both pool-scale and session-pool-placement compatibility files have passing file completion receipts.
Mapped T4 '100-frame verifier delivery bursts never scan retained message history' passes base once,2.063880502s; it supplies no repetition/stress claim beyond that execution.

## Supplemental current-head importer receipts

A-17865 raw targeted local macOS arm64 Node24.21.0:369pass, zero fail/cancel/skip/todo across23direct-import T1/T2 files per item inventory. It is a separate targeted aggregate, not added to5596.
A-17881 records current-head local macOS arm64 Node24.21.0 serial preservation slot:
adapter-generation-forward2, host-flush-native4, request-guard12, session-brief2, session-events2, system-processes57, territory-task-branch16, tracker-native-boundary29, worktree-host32. Nine per-file EXIT0 receipts,156pass total including nested cases; each summary zero fail/cancel/skip/todo. Native signal not separately recorded. Generated named outcomes inspected in the raw artifact; no browser/Linux/container/live-provider proof supplied by this local run.
Lead reports owner-checked lock release and source unchanged. No predecessor substitution: these receipts name a204b4373, whereas the earlier365-case/nine-native pre-config-fix run remains historical and not final proof. Current configured receipt separately establishes the exact head/tree.

Both source findings are resolved, no outstanding findings. No Reviewer test/typecheck/browser, edits or native runs occurred. Full after-stage QA remains required by tracker; this review verdict is not QA or real DigitalOcean/network destruction proof.


A-17895: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-17895-t-1749-final-idle-stop-evidence-at-a204b4373.md

Criteria: C1 verified, C2 verified, C3 verified, C4 verified.

### impl-1749 · 2026-11-08T17:39:10.465Z

Coordinator-authorized merge of origin/dev d57dd0205 (includes T-1755 100937ae and T-1752) committed/pushed at 9a7a11116. Conflicts resolved retaining usage(host)/shared #used helper; lifecycle callbacks moved into Dispatcher.#startPoolScaling; restoreSessions keeps attach → restoreHosts → scale; configurePools(config) pass-through retained; README contains all 3 pointers; durations parsed with duplicate-key rejection and preserves both allowances once. No further dev merge planned. Prior a204b4373 receipts are predecessor evidence, not current-head verification. Revalidation includes 29 T1/T2 direct importers/explicit requested cases and 10 T3 (host-restart plus 9 Sessions/Dispatcher importers); T0 underway. Delta review and fresh verify follow.

### rev-37 · 2026-11-08T17:40:56.082Z

verdict: review
result: clear
by: rev-37 [reviewer]
run: rev-37-1749-delta-1
commit: 9a7a11116fdf76efb95066ca1f66dc344dd9e9d8
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

# T-1749 authorized merge delta source review

Head9a7a11116fdf76efb95066ca1f66dc344dd9e9d8.
Parents a204b43732e99caf5ecce1e22b436d758fa43ff7 (prior final clear A-17895) and d57dd0205a64631c1fde43bf1d8acf5ed105ff23 (authorized dev with T-1755/T-1752 and earlier landings).
Run rev-37-1749-delta-1; scope delta; source clear; findings[].
Coordinator authorization verified directly: 5a13e91c resolution plan and e50eb2bc merge-dev instruction in topic-1443. This requires fresh verify; no configured carry waiver.

## Standards

No findings. Reviewed both parent comparisons, all merged task-owned runtime hunks, configuration/startup owners, incoming capacity extraction, docs/index and duration metadata. PoolRuntime.usage/#used, Sessions.hostUsage and the used/promised accounting helper remain intact; reserve uses exactly that helper with its existing credit parameter. Idle fences/minimum handling coexist with these methods rather than replacing them.

The complete merged duration allow map equals the two-parent union, values intact; no duplicate JSON object keys anywhere in either parent or merged durations file. Budget mode stays report. README retains idle-stop, restart-recovery and host-status pointers. All task-specific tests and guide-index row remain.

## Spec

No findings. Dispatcher idle callback body is moved from useSessions into T-1752's #startPoolScaling helper with the same hub clock/provider declarations/confirmed destroy callback. restoreSessions still calls useSessions(sessions,false), awaits restoreHosts(), then starts scaling. The daemon and host-restart module are byte-identical to incoming dev, preserving attach -> restore lease owners -> scale. Synchronous declaration throw normalization and shared60s retry are retained. Explicit incoming configurePools(config) -> PoolRuntime.configure(config.hosts) is retained, so the apply-before-publish fix is not lost.

pool-idle-stop.test.ts is byte-identical to prior reviewed final head. No additional feature or policy change introduced by this resolution. Incoming host status/stop, retained-generation recovery and UI work keep their dev behavior; their original reviews/evidence remain predecessor context, not newly executed checks here.

## Evidence and remaining criteria

C1-C4 remain runtime-unverified at this new head; old verified marks are stale. Prior a204b4373 configured cfcc1efa/A-17890 and final A-17895 remain historical exact-head evidence, not a merged-head pass.
Lead reports full typecheck/static/tier checks green, final test lint finishing;29lower-tier/importer+explicit T2 files and10T3 files (host-restart plus merged Sessions/Dispatcher runtime importers) are running in Coordinator-approved parallel review/native slot. No complete merged-head aggregate or configured receipt was supplied or claimed at this source pass.

Finish those authorized checks, retain exact-head commands/native exit/signal and named outcomes, then submit fresh mode-free cland verify at9a7a11116. Final evidence review follows its result and merged-head preservation. Any source/head change needs source review first. QA policy remains full/after-stage.
Reviewer read only; no tests/typecheck/browser/edits/merge.
Standards0; Spec0 findings.


A-17916: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-17916-t-1749-authorized-merge-source-delta-at-9a7a11116.md

### impl-1749 · 2026-11-08T17:42:22.209Z

Merged-head 9a7a11116 supplemental receipts complete. T0: root typecheck, test:static, lint-tiers and lint-tests exit 0; known report-only notices, zero refusals. T1/T2 direct-importer census plus requested files: 29 files, 452/452 pass (A-17917). Adds pool-scale, session-pool-placement, waiting-launch, host-restart-reconcile, host-status and host-stop to prior 23-file inventory; pool-idle-stop retained. T3: 10 files, 157/157 pass (A-17918): host-restart 1; adapter-generation-forward 2; host-flush-native 4; request-guard 12; session-brief 2; session-events 2; system-processes 57; territory-task-branch 16; tracker-native-boundary 29; worktree-host 32. Serial native execution under approved preservation slot; owner-checked release after cleanup. All supplemental runtime evidence macOS arm64 Node v24.21.0, no browser/Linux claim. Captures secret-scanned before artifact publication. Delta source clear A-17916. Fresh mode-free configured verification submitted at unchanged head; older a204b4373 suite is predecessor evidence only.

### rev-37 · 2026-11-08T18:02:33.289Z

verdict: review
result: clear
by: rev-37 [reviewer]
run: rev-37-1749-evidence-2
commit: 9a7a11116fdf76efb95066ca1f66dc344dd9e9d8
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

# T-1749 merged-head final evidence

Head9a7a11116fdf76efb95066ca1f66dc344dd9e9d8, branch independently unchanged.
Run rev-37-1749-evidence-2; scope evidence; clear; findings[]; verifiedC1-C4.
Delta source clear rev-37-1749-delta-1 / A-17916 remains applicable. This is fresh merged-head evidence, not carry of a204b4373/A-17895.

Configured run7320897b-bf30-46b0-a657-4924792dc74c / A-17922 Finished exit0;5627pass, zero fail/cancel/skip/todo. Canonical tree independently reconstructed read-only as0afd511a053b1d0273a0819768983b0a7266826d, matching exact admitted head/tree.
Uncached droplet c-8lon1 Linuxx64 6.8.0-147-generic, Node24.21.0, Neovim0.12.5.
Isolated Headless Shell1248 binary /home/runner/cland/node_modules/playwright-core/.local-browsers/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell; Google Chrome for Testing156.0.8078.4.
T0/allT1/fallback-allT2/Web completed, mapped host-restart T3 once, mapped inbox-verifier-load T4 base-only/no repetitions. Other T3 and T4 unexecuted here; no all-T3 or all-T4 claim. Budget/lint/ratchet notices report-only; skips[] and skipReasonCheck report/missing0. Executor lifetime1066s/cost$0.0740 is telemetry, not test wall time.

## Recorded outcomes apart from exit status

Independently streamed finish records with type=test, excluding file wrappers:
- pool-idle-stop10unique generated names,60passing records:10base+50load, exactly5/5 per case, no nonpass.
- host-restart1base pass: 'restart keeps the live host and exits the deleted host, settles spend, and restores watchdog ownership',7.226962471s.
- host-restart-reconcile12unique,72pass records:12base+60load.
- host-status4base, host-stop4base, host-spend10base, host-registry5base+5load, pool-scale19base, session-pool-placement21base, waiting-launch20base, test-docs4base, inbox-verifier-load1base; all outcomes pass.

C1 verified: exact60s excess-host confirmed destruction/minimum retention passes base+five, including simultaneous raised minimum and the single quiet throw-once provider's clock-only60s recovery.
C2 verified: billing minimum180s control passes base+five; source still calls shared earliestStop with creation/idle/billing facts.
C3 verified: running reverse-lexical host retained beyond idle/minimum duration passes base+five, with idle peer alone destroyed; placement-promise protection remains separately green.
C4 verified: gaining a session invalidates the old deadline and restarts a full interval after exit, base+five. Placement promise short interval case also base+five.
Both real hub config.set hot-apply tests pass base+five with applies:now and confirmed destroyed/released receipt; async declarations sharing and index membership pass. All new idle-stop observations under0.639s Linux; existing8s allowance remains prior measured macOS metadata/report policy.

## Current merged-head local preservation

A-17917 raw lower-tier/requested integration output:452pass, zero fail/cancel/skip/todo across29T1/T2 files; final reported producer exit0, local macOS arm64 Node24.21.0. Source head unchanged per lead; raw output is aggregate, not a separate per-file exit ledger.
A-17918 raw native capture names head9a7a11116 and platform, with10FILE EXIT0 receipts and157passes, each native summary zero fail/cancel/skip/todo:
adapter-generation-forward2, host-flush-native4, host-restart1, request-guard12, session-brief2, session-events2, system-processes57, territory-task-branch16, tracker-native-boundary29, worktree-host32.
Serial assigned preservation lock; lead reports joined cleanup and owner-checked release. Signal not separately recorded. These local receipts are supplemental, not added to5627, not Linux/browser/provider/network evidence, and not predecessor substitution.

The fresh configured restart/idle/status outcomes cover the merged attach→restore→scale wiring and preserved shared capacity helper after delta review. No outstanding source/review findings. Prior source reds remain historical; no ignored failed current-head run. Full after-stage QA remains required separately.
Reviewer performed source/log reads only, no tests/typecheck/browser, edits or merge.


A-17924: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-17924-t-1749-final-merged-head-evidence-at-9a7a11116.md

Criteria: C1 verified, C2 verified, C3 verified, C4 verified.

### coord · 2026-11-08T18:40:19.957Z

Merged ba3e6e17f65aea30a39aab5c71fad284b62d7a27 onto dev.
