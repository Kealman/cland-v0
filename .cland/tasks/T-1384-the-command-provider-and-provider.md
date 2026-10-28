---
id: T-1384
kind: task
title: 'The command provider and provider selection: an argv run with the bytes on stdin and no remote secret, and provider = "" turning transcription off'
state: closed
status: done
size: S
criterion_seq: 4
labels:
  - ready-for-agent
assignee: null
parent: E-1311
blocked_by:
  - T-1383
topic: topic-1132
branch: t/T-1384-the-command-provider-and-provider
created: 2026-10-27T23:37:27.222Z
updated: 2026-10-28T01:35:56.411Z
closed: 2026-10-28T01:35:56.411Z
---

## Summary

The second provider runs `[speech] command` as an argv array with no shell. The original bytes go on stdin, with `CLAND_SPEECH_MIME` and `CLAND_SPEECH_LANGUAGE` in an environment free of remote secrets. It reads the transcript from stdout. A factory picks `elevenlabs`, `command` or none from `[speech]` and the resolved secrets.

## What to build

**The `command` provider.**
- It spawns `argv[0]` with the remaining arguments, never through a shell.
- The environment is `withoutExecutorCredentials(process.env)`, plus `CLAND_SPEECH_MIME` and `CLAND_SPEECH_LANGUAGE` (empty to detect).
- The bytes are written to stdin, and stdout is read as UTF-8, trimmed and capped at 1 MiB.
- A non-zero exit or a signal is `command-failed`, with the tail of stderr (at most 2 KiB), redacted.
- An empty argv, or an `argv[0]` that cannot be found, is `not-configured`.
- At the deadline it sends SIGTERM, then SIGKILL after a short grace, and reports `timeout`.
- It is never retried.

**Selection.** `speechProvider(settings.speech, secrets)` returns:
- the ElevenLabs provider with the key from the `ELEVENLABS_API_KEY` override or `speech.elevenlabs_key`;
- the command provider;
- or `null` for `provider = ""`, which callers treat as "off", distinct from not-configured.

`resolveCommand(argv, env)` reports whether `argv[0]` resolves, as an absolute executable or on `PATH`, for doctor (ticket 14). The data-use constant (`SPEECH_DATA_USE`, one line per provider) lives here, for `cland remote status` and T-1369.

Spec §3.6 (the `command` provider, providers in 0.3, data use); research §7 "The `command` provider contract".

## Acceptance criteria

- [x] C1. A fake command script receives the exact note bytes on stdin and prints a transcript that comes back as `text`, and an argument containing spaces and `$(…)` reaches it literally (test).
  - done: impl-1384 · 2026-10-28T00:31:13.606Z
  - verified: rev-26 [reviewer] · run rev-20261028-1384-evidence-2 · 2026-10-28T01:07:42.948Z · commit f5ee6f445daaed91aa014c6f7ead3763bb6f72d9
  - verified: rev-26 [reviewer] · run rev-20261028-1384-evidence-3-merged · 2026-10-28T01:28:56.733Z · commit 55c230e86b8a8b744051bdf968135cb86911c8be
- [x] C2. With made-up `CLAND_TELEGRAM_TOKEN`, `ELEVENLABS_API_KEY`, `XAI_API_KEY` and `DIGITALOCEAN_TOKEN` in the hub's environment, the command's environment contains none of them and has `CLAND_SPEECH_MIME=audio/ogg` and `CLAND_SPEECH_LANGUAGE` (test).
  - done: impl-1384 · 2026-10-28T00:31:19.928Z
  - verified: rev-26 [reviewer] · run rev-20261028-1384-evidence-2 · 2026-10-28T01:07:42.949Z · commit f5ee6f445daaed91aa014c6f7ead3763bb6f72d9
  - verified: rev-26 [reviewer] · run rev-20261028-1384-evidence-3-merged · 2026-10-28T01:28:56.733Z · commit 55c230e86b8a8b744051bdf968135cb86911c8be
- [x] C3. A command exiting 3 rejects with `command-failed` and a bounded stderr tail with the made-up key redacted, a missing `argv[0]` with `not-configured`, and a command sleeping past the deadline is killed and rejects with `timeout` (test).
  - done: impl-1384 · 2026-10-28T00:51:38.713Z
  - verified: rev-26 [reviewer] · run rev-20261028-1384-evidence-2 · 2026-10-28T01:07:42.949Z · commit f5ee6f445daaed91aa014c6f7ead3763bb6f72d9
  - verified: rev-26 [reviewer] · run rev-20261028-1384-evidence-3-merged · 2026-10-28T01:28:56.733Z · commit 55c230e86b8a8b744051bdf968135cb86911c8be
- [x] C4. `provider = ""` selects no provider, `provider = "elevenlabs"` without a key selects one that rejects with `not-configured`, and `provider = "command"` selects the command provider (test).
  - done: impl-1384 · 2026-10-28T00:31:20.344Z
  - verified: rev-26 [reviewer] · run rev-20261028-1384-evidence-2 · 2026-10-28T01:07:42.949Z · commit f5ee6f445daaed91aa014c6f7ead3763bb6f72d9
  - verified: rev-26 [reviewer] · run rev-20261028-1384-evidence-3-merged · 2026-10-28T01:28:56.733Z · commit 55c230e86b8a8b744051bdf968135cb86911c8be

## Notes

Shared files: hub/src/speech/ (new)

## Comments

### impl-1384 · 2026-10-28T00:26:54.060Z

Consumer inventory before shared speech retry-policy extension: production speech/index.ts (transcribeNote), ElevenLabsProvider, and speech/elevenlabs.ts imports; tests speech.test.ts plus fakes/speech/exchange.ts. No production transcribeNote caller yet (voice pipeline is T-1388). Search covered hub/src, hub/test, docs, qa and shipped .agents/skills, including T3/T4 guides; no wire shape changes. Config's speech shape, remote factory settings, persisted configuration readers and their config-set/init tests remain unchanged. Existing providers keep the cloud default; an optional provider retry policy will opt command out, with a legacy provider regression retained. New speechProvider factory, resolveCommand and SPEECH_DATA_USE exports are additive; later doctor/status/voice consumers use them. Tests use native subprocess seam because no hub frame invokes speech yet.

### rev-26 · 2026-10-28T00:33:35.130Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261028-1384-source-1
commit: 002e34cce49c337db161d42272f9526ab98f4103
scope: full
findings: [{"severity":"medium","text":"M1 Standards: changed CONFIG_USAGE lacks owning frozen commands.json migration; new speech-command guide lacks per-test index row. Retain unchanged help/docs guard red and green.","file":"hub/src/cli/usage.ts","line":71},{"severity":"medium","text":"M2 Standards: real command exit/signals/TERM-KILL/PID lifecycle tests classified T2; native lifecycle belongs T3, with explicit header/guide reason.","file":"hub/test/tiers.json","line":463},{"severity":"medium","text":"M3 Spec: signals target immediate child only; grandchild holding inherited stdout/stderr can keep close and retry=false transcription pending forever after deadline. Own/cancel/drain descendants with bounded incomplete outcome and native regression.","file":"hub/src/speech/command.ts","line":28},{"severity":"medium","text":"M4 Standards: teardown joins work without independent bound; readiness performance.now/readFile loop at test47–49 does not bound asynchronous read. Use registered idempotent cancel/drain owner and shared bounded setup receipts; omitted/aborted controls retain native close/root assertions.","file":"hub/test/fakes/speech/command.ts","line":13}]
finding_counts: {"high":0,"medium":4,"low":0}

Full consolidated source audit A-12998: Standards3 medium, Spec1 medium. Source-only review inspected argv/stdin/filter/caps/errors/resolution/off/selection/retry policy and all changed consumers. A-12997 local macOS7/13 passes/typecheck is targeted summary, not configured/Linux proof. C3 blocked by process-tree cancellation; other runtime criteria pending. Push all corrections and request fresh source review before verification; no further dev merge unless Coordinator directs. QA none.

Criteria: C3 failed (Deadline cancellation can leave a descendant retaining stdio alive, preventing native close and timeout settlement.).

### rev-26 · 2026-10-28T00:36:26.550Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261028-1384-source-2
commit: f06913280dc02656618773ddd6e27d43fe84b368
scope: full
findings: [{"severity":"medium","text":"M5 Standards: unconditional rescue SIGKILL precedes descendant ESRCH assertion at122, so test-side cleanup can create the production cancellation outcome. Establish descendant disappearance/native settlement before rescue, keep bounded failure-only cleanup separate, and prove bypassed group cancellation fails.","file":"hub/test/speech-command.test.ts","line":119}]
finding_counts: {"high":0,"medium":1,"low":0}

Full source2 A-13000 (artifact id recorded in topic) has M1–M4 source corrections inspected: frozen/index, T3 lifecycle, dedicated process-group TERM/KILL plus bounded incomplete drainage, registered setup/read/drain owner. One new Standards medium M5 remains; no independent production Spec finding. Local9/13/5/3/typecheck claims are not configured/Linux proof; rescued descendant green does not prove production-caused disappearance. Runtime C1–C4 remain pending. Fix/push/request source review before verification; no dev merge unless Coordinator directs.

### rev-26 · 2026-10-28T00:39:14.014Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261028-1384-source-3
commit: baac7717fc1f17ad62a4537eb9ba2c5a3e3bb0a8
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full source3 clear, A-13001. M5 native timeout/no-incomplete/parent+descendant disappearance assertions now precede failure-only rescue; bounded rescue outcomes separate. File observer retains pre-armed events, single-flight actual PID-file reads, bounded/cancellable/joined cleanup. Production source unchanged from source2; M1 frozen/index, M2 T3 lifecycle, M3 process-group deadline/bounded incomplete drainage and M4 registered disposal remain resolved. A-13000 local negative-control summaries and reported macOS9/9/typecheck are targeted, not configured/Linux proof. C1–C4 runtime-unverified. One mode-free run at unchanged head, original-record final review; changed T3 identities must actually execute. No dev merge unless Coordinator directs. QA none.

### rev-26 · 2026-10-28T00:51:05.401Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261028-1384-evidence-1
commit: baac7717fc1f17ad62a4537eb9ba2c5a3e3bb0a8
scope: evidence
findings: [{"severity":"medium","text":"M6 runtime: A-13004:19464 'Missing expected exception: production cancellation reaped descendant before rescue'; signal0 did not establish ESRCH after provider settlement. Item-owned native exit/reaping boundary unresolved; preserve pre-rescue assertion and live-survivor negative control.","file":"hub/test/speech-command.test.ts","line":125}]
finding_counts: {"high":0,"medium":1,"low":0}

Original evidence not clear, A-13005. Exact-head a8e73460/A-13004 exit1:3518 ordinary pass/1 fail plus30 separate load pass;3549 is combined, not ordinary count. T0/allT1/fallback allT2 green; changed T3 command8/9 red, one base execution/no repeats. Web/T4/remainingT3 unexecuted. Root cause live-versus-unreaped descendant unclassified by this log, not a shared-defect claim. Other8 command identities and13 legacy speech ordinary cases passed, but C3 fails and runtime marks remain pending. Linux droplet provenance, host gate reuse, report-only diagnostics and infrastructure lifetime retained in artifact. Diagnose/correct, fresh source review before any configured retry. QA none.

Criteria: C3 failed (Configured Linux descendant deadline case fails the production-caused descendant disappearance assertion before rescue.).

### rev-26 · 2026-10-28T00:52:21.614Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261028-1384-source-4
commit: f5ee6f445daaed91aa014c6f7ead3763bb6f72d9
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full source4 clear, A-13006. Correction requires native close plus owned process-group ESRCH before terminated command settles; two-second bounded incomplete drainage retained, all timers cleared on observed completion. Pre-rescue assertions/live-survivor negative controls/registered fixture owner unchanged; README+guide migrated. Coordinator6fabc57d requested whole-group boundary. Prior A-13004 remains failed old-head partial Linux evidence, not corrected-head proof. Reported local macOS9/13 passes/typecheck are distinct. C1–C4 runtime pending. One mode-free configured retry at unchanged head then original-record review including changed T3; no dev merge unless Coordinator directs. QA none.

### rev-26 · 2026-10-28T01:07:42.949Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261028-1384-evidence-2
commit: f5ee6f445daaed91aa014c6f7ead3763bb6f72d9
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final original-record evidence clear, A-13009. Exact-head d7337b00/A-13008 exit0: independent3812 ordinary passes+30 separate load passes, zero fail/skip/cancel. All9 changed T3 command identities pass once, including pre-rescue descendant/native-group completion .188064174s; max command .290566992s. C1 bytes/literal argv, C2 filtered env/metadata, C3 errors/missing/deadline/tree/ownership and C4 off/selection/resolution independently inspected. Existing cloud13 ordinary pass; legacy policy actual5/5 load separate. T0/allT1/fallback allT2/changedT3/Web complete; remainingT3/T4 unexecuted. Host typecheck reused; budgets/lint/T3-growth report-only. Old A-13004 remains failed at prior head. Source4 unchanged, QA none. Coordinator owns landing/separate cover.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified.

### impl-1384 · 2026-10-28T01:10:42.775Z

Merge-conflict recovery authorized by Coordinator after queue drop. origin/dev2a1efeaca merged; conflicts restricted to CONFIG_USAGE and owning commands.json row, resolved to preserve command speech argv/stdin/no-retry/off lines plus artifacts.max_upload_mb/restart line. HUB_USAGE artifact.upload and upstream TASK_USAGE chunks preserved automatically. Consumer search in hub/test+nvim/test covered HUB_USAGE/TASK_USAGE/CONFIG_USAGE/frozenUsage, literal changed help wording, artifact.upload, artifacts.max_upload_mb/maxUploadMb and speech identifiers/metadata; no Neovim matches. Matched files: artifact-upload, speech-command, web-authority, init-config, config-set, gateway, secrets-environment. Generic CLI consumers: cli-help, cli-command-help, cli-usage, cli-usage-compatibility, cli-usage-merge; additionally speech and config-reload/component run per Coordinator. All targeted files run sequentially before delta review.

### rev-26 · 2026-10-28T01:13:39.960Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261028-1384-source-5-delta
commit: 55c230e86b8a8b744051bdf968135cb86911c8be
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Authorized merge-delta clear, A-13017. Parents f5ee6f445 + landed dev2a1efeaca; queue conflict/Coordinator2f310943 authorize merge. CONFIG_USAGE preserves command speech plus upload-limit/restart lines; exact owning frozen-row equality checked, only expected HUB_USAGE/CONFIG_USAGE changes versus prior task parent. Speech production/tests/fixture byte-identical to source4; landed upload authority/config/redactor integration inspected, no findings. A-13016 local serial17/185/typecheck is targeted summary, not new-head configured/Linux proof. Old A-13008 verification remains stale. One mode-free run at unchanged new head then original-record final review; no further dev merge unless directed. QA none.

### rev-26 · 2026-10-28T01:28:56.733Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261028-1384-evidence-3-merged
commit: 55c230e86b8a8b744051bdf968135cb86911c8be
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

New merged-head original evidence clear, A-13020. 7de64852/A-13018 exit0 at55c230e86:3818 ordinary passes plus30 separate load passes; all9 command T3 cases executed once/pass, max .283579852s and descendant .182289047s. Named C1–C4/error/cancellation/ownership/selection facts checked; legacy speech13 pass with5/5 policy load separate. T0/allT1/fallback allT2/changedT3/Web complete; remainingT3/T4 deferred. Host gate reused, budgets/lint/T3growth report-only. Delta A-13017 unchanged; fresh C1–C4 replace stale old-head marks. A-13004 remains failed prior receipt. QA none; Coordinator owns re-enqueue/landing.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified.

### coord · 2026-10-28T01:35:56.411Z

Merged cc1a941da2b556e7054bea4acf0bde42bb495d97 onto dev.
