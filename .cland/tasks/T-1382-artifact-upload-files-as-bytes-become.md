---
id: T-1382
kind: task
title: "artifact.upload: files as bytes become the human's artifacts on one new message, without a ▣ post, under the [artifacts] limit"
state: closed
status: done
size: M
criterion_seq: 5
labels:
  - ready-for-agent
assignee: null
parent: E-1311
blocked_by: []
topic: topic-1126
branch: t/T-1382-artifact-upload-files-as-bytes-become
created: 2026-10-27T23:37:26.682Z
updated: 2026-10-28T01:07:55.640Z
closed: 2026-10-28T01:07:55.640Z
---

## Summary

The one protocol gains `artifact.upload`. Each file comes with a name, a MIME type and its bytes, and the frame names the topic, an optional caption, kind, addressees and reply. In one step it creates the artifacts and one new message of the human's carrying them, with no ▣ post. `[artifacts] max_upload_mb` bounds each file.

## What to build

**Shared contract change:** a new client request. Consumers to migrate:
- the `ClientRequest` union and its request guards in `protocol.ts`, and the `shared/wire` types;
- the gateway's authority table: `artifact.upload` with `topic.send`'s rule, so General or a reply in the replied message's topic, while `topic.send` with `artifacts` stays refused;
- the web authority table;
- the audit record, and `hub serve`'s usage line on what remotes may do;
- the tests of both authority tables.

Neovim, the web client, skills and QA briefs gain no call in this ticket. Sessions are refused with `forbidden`.

**Behaviour.**
- The hub validates every file before writing anything:
  - at most 10 files;
  - a name made safe, and a MIME type of the `type/subtype` form or `application/octet-stream`;
  - each file within `max_upload_mb`.
- It creates `file` artifacts whose extension follows the name and MIME rule in the assumptions, attributed to `human`. It then sends one human message with the caption as its text, `via` from the edge, and `to`, `kind` and `replyTo` validated as `topic.send` validates them, carrying all the artifacts.
- The artifacts and the message register in one store transaction under the existing artifact creation queue. A refusal or a failure leaves neither an index entry nor a file.
- Artifact subscription events still fire. No `▣ … ·` message is posted.
- An upload that carries an ingress message id the hub already stored returns that message and creates nothing.
- Socket clients send `data` as base64 within the 1 MiB frame. The in-hub edges hand Buffers beside the frame on their conversation, and the frame minus its bytes passes the same authority and audit path.
- The result is `{ message, artifacts }`.

`[artifacts] max_upload_mb = 50` gets its type, default, template line, parse rule and `config set` validation, so `cland init` renders it and `cland update` adds it to an existing managed file. Spec §3.6 and §3.1; ADR 0003 (one protocol).

## Acceptance criteria

- [x] C1. One `artifact.upload` with a PNG and a PDF from a human socket client makes exactly one General message from `human` carrying both artifacts with `.png` and `.pdf` paths, the caption as its text, and no `▣` message in the topic (test).
  - done: impl-1382 · 2026-10-27T23:44:26.236Z
  - verified: rev-31 [reviewer] · run rev-20261028-1382-final1 · 2026-10-28T00:21:40.905Z · commit 8960afce4836a76d89ed4359bbac924deff9cfcc
- [x] C2. A file one byte over `max_upload_mb`, or an eleventh file, is refused with a validation error and leaves no artifact index entry, no file under `.cland/artifacts` and no message (test).
  - done: impl-1382 · 2026-10-27T23:44:26.341Z
  - verified: rev-31 [reviewer] · run rev-20261028-1382-final1 · 2026-10-28T00:21:40.905Z · commit 8960afce4836a76d89ed4359bbac924deff9cfcc
- [x] C3. Through an injected gateway remote, an upload into General with Buffers beside the frame records `via = "telegram"`, an upload into an item topic without a reply is refused as `forbidden` by the gateway table, and a replay with the same ingress id returns the first message without new artifacts (test).
  - done: impl-1382 · 2026-10-27T23:44:27.299Z
  - verified: rev-31 [reviewer] · run rev-20261028-1382-final1 · 2026-10-28T00:21:40.905Z · commit 8960afce4836a76d89ed4359bbac924deff9cfcc
- [x] C4. A session's `artifact.upload` is refused as `forbidden`, and `topic.send` with `artifacts` from a remote stays refused (test).
  - done: impl-1382 · 2026-10-27T23:44:27.921Z
  - verified: rev-31 [reviewer] · run rev-20261028-1382-final1 · 2026-10-28T00:21:40.905Z · commit 8960afce4836a76d89ed4359bbac924deff9cfcc
- [x] C5. `cland init` renders `max_upload_mb = 50` under `[artifacts]`, `cland update` adds it to a managed config that lacks it, and `cland config set artifacts.max_upload_mb 0` is refused (test).
  - done: impl-1382 · 2026-10-27T23:44:28.168Z
  - verified: rev-31 [reviewer] · run rev-20261028-1382-final1 · 2026-10-28T00:21:40.905Z · commit 8960afce4836a76d89ed4359bbac924deff9cfcc

## Notes

Shared files: hub/src/protocol.ts, shared/wire/index.ts, hub/src/hub/dispatch.ts, hub/src/hub/artifacts.ts, hub/src/hub/store.ts, hub/src/remote/authority.ts, hub/src/hub/web-authority.ts, hub/src/init/config.ts

## Comments

### impl-1382 · 2026-10-27T23:39:04.803Z

Rule 20 consumer inventory: searched hub/, shared/, web/, nvim/, .agents/, qa/, docs/ for artifact.create, authority tables and artifacts configuration (146 files). Changed consumers: protocol ClientRequest/guard, shared/wire ClientRequest, dispatcher Conversation/remote native send, gateway authority, exhaustive web authority, audit summary, init config type/default/template/parser (config set derives keys and update renders parsed config), gateway/web authority tests and init template assertion. Existing artifact readers/store records and workbench/nvim/skills/QA clients retain the same Artifact and TopicMessage shapes and do not call the new frame; old frames remain accepted. Existing RemoteSend callbacks retain optional-argument compatibility. No persisted schema migration. New frame/fake tests retain previous topic.send and forged-ingress controls. Native bytes travel as an optional Buffer array alongside the frame.

### impl-1382 · 2026-10-27T23:48:27.725Z

Review correction and Coordinator boundary decision b03116cb: original upload bytes are never rewritten; every MIME is refused with code secret-in-upload if it contains an exact raw UTF-8 byte match for any configured or rotated registered secret. Refusal includes only a redacted file name, no value or setting name, and creates no message/index/file. Caption/body retain text redaction. Producer regression has text/binary positive controls and clean byte preservation. Additional rule-20 consumers found in review: cli-usage frozen HUB_USAGE/CONFIG_USAGE rows and unchanged compatibility/full-help/hub-help guards; ProjectConfiguration STARTUP_FIELDS owns all artifacts settings, so documented activation is restart; shared RemoteRedactor gains additive containsSecret used by upload dispatch through HubBase/daemon options (old injection optional).

### rev-31 · 2026-10-27T23:50:44.381Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261027-1382-source1
commit: f193c64632bd345d8408df67f82412643c6e419e
scope: full
findings: [{"severity":"medium","text":"M1 [Standards/rules16,20]: HUB_USAGE and CONFIG_USAGE changed but their commands.json frozen rows did not. Existing cli-usage-compatibility full export equality and root/hub cli-help exact-byte guards disagree. Reproduce with unchanged guards and migrate only the two owning frozen rows; preserve assertions/template.","file":"hub/src/cli/usage.ts","line":25},{"severity":"medium","text":"M2 [Standards/rule16]: max_upload_mb help/README says applies after hub reload, but ProjectConfiguration treats the whole artifacts section as startup-only: config set returns applies:restart and reload refuses artifacts changed:restart required (configuration.ts22/160–163/195–196). Align activation guidance and preserve/regress actual restart behavior, without relaxing retention policy.","file":"hub/src/cli/usage.ts","line":71},{"severity":"high","text":"M3 [Spec§3.12/Coordinator b03116cb]: Native sidecar bytes are written without the registered-secret check. Caption redaction and old manually-redacted artifact.create controls do not protect this producer. Exact raw-byte matches against every configured/registered shared-redactor value must refuse all MIME uploads (secret-in-upload plus safe filename, no secret/value name disclosure), before file/index/message publication. Never rewrite accepted bytes; add actual native/base64 text+binary secret-refusal and clean-byte preservation controls. Decision b03116cb resolves untouched-byte semantics.","file":"hub/src/hub/artifact-upload.ts","line":45},{"severity":"low","text":"L1 [Standards/redundant publication]: sendFromHuman already publishes every attachment after commit at core.ts3183. This explicit artifactChanged loop schedules a second artifact model frame for each uploaded file. Keep one owner/publication path.","file":"hub/src/hub/dispatch.ts","line":1742}]
finding_counts: {"high":1,"medium":2,"low":1}

Consolidated full source not clear; A-12953 carries Standards2medium+1low/Spec1high and supporting source/decision references. Pin f193c6463/tree8a5d9991 only; later correction7ddbce0cc is not reviewed by this verdict. Transaction/queue/authority/ingress/base64/init-update designs otherwise align, existing assertions retained. A-12938 is local macOS selected-note evidence, no Linux/suite proof; later A-12952 remains successor evidence pending review. C1–C5 claimant done/runtime-unverified; no unrelated criterion marked as an executed failure. Correct all consolidated findings, preserve native red/green captures and frozen guard sources, and request fresh full source at the pushed successor before configured verification. No extra dev merge/per-item QA requested; Coordinator owns separate shared-contract verify all. Reviewer read-only, no tests or probes.

### rev-31 · 2026-10-27T23:53:03.361Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261027-1382-source2
commit: 563e6e2592355947a4c9014972173271faf75d1e
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected full source clear, A-12954: Standards0/Spec0 findings. Exact pushed successor563e6e259/tree12986b7d, no dev merge since original f193c6463. M1 owning frozen HUB_USAGE/CONFIG_USAGE rows independently equal pinned exports; guard sources/template unchanged. M2 restart guidance agrees with unchanged startup policy and new actual CLI config-set/reload regression. M3 same project RemoteRedactor registry flows daemon→HubBase→Dispatcher→upload: exact raw-byte secret matches for every MIME, private copies of validated bytes, checks before preparation and before commit, typed safe secret-in-upload refusal, no accepted-byte rewriting. New producer control covers made-up secret text/binary on native and socket paths, no persisted effects and clean-byte equality. L1 duplicate publication removed; original upload test asserts exactly two artifact frames. Original unaffected queue/store transaction/authority/ingress/init-update audit A-12953 carries; docs/skill/typed result consumers align. A-12938/A-12952 and request-level red/green are selected local macOS evidence only, no Linux/suite claim. C1–C5 remain runtime-unverified. Submit one configured mode-free verify at unchanged reviewed head then request original generated-case/load/phase/provenance evidence review; report any actual Linux new>=3s identities. No extra dev merge/per-item QA requested; Coordinator owns separate shared-contract verify all. Reviewer read-only, no execution.

### impl-1382 · 2026-10-28T00:03:54.345Z

Missing consumer found by Linux run 9992b728/A-12969: HubCore.sendFromHuman's blank-text refusal is consumed by prompt.send/attachedSend; artifacts.test.ts::forced prompt attachment keeps the saved text in its artifact and a refused post keeps the draft expected false at line219 and got true. Local original single-case reproduction failed identically. Expanded inventory: hub/test/artifacts.test.ts, prompt-races.test.ts, inject-stalled.test.ts, nvim-artifacts-rules.test.ts; nvim/test/artifact-render.test.ts, artifact-scenario.ts, artifacts.test.ts, stub-hub.ts and protocol/artifacts recording; web/test/composer.test.ts/phone-composer.test.ts callers through topic.send. Preserve all their wire/refusal shapes. Fix explicitly opts only artifact.upload into empty attached captions via default-false internal producer parameter; no frame flag or legacy send change. Re-run artifact/prompt/composer files serially and obtain fresh source review before verify.

### rev-31 · 2026-10-28T00:04:55.028Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261028-1382-evidence1
commit: 563e6e2592355947a4c9014972173271faf75d1e
scope: evidence
findings: [{"severity":"medium","text":"M4 [Spec/shared consumer regression]: Blank text now succeeds whenever artifacts are present, so existing prompt.send of an empty saved draft succeeds and marks it sent. Original A-12969 shows true !== false at artifacts.test.ts219 in 'forced prompt attachment keeps the saved text in its artifact and a refused post keeps the draft'. dispatch.ts1272–1278 passes empty saved prompt plus its draft artifact. Preserve that unchanged refusal/draft assertion and confine captionless admission to the internal upload producer, retaining ordinary prompt/topic-send behavior. Expand the missing prompt/composer consumer inventory and request fresh source before successor verify.","file":"hub/src/hub/core.ts","line":3139}]
finding_counts: {"high":0,"medium":1,"low":0}

Configured evidence not clear, A-12972 audits original A-12969/9992b728 at563e6e259. Actual item-owned assertion fail at test219; source2 review missed the empty-prompt consumer. T0/T1 pass, T2 fails; changedT3/mappedT4/Web unexecuted and Neovim completion absent. Independent partial counts3111ordinarypass/1fail plus30separate loadpasses; four upload identities eachbase+5pass and startup-limitbase+5pass do not make the task gate green. C1–C5 remain unverified; no unrelated criterion is mislabelled as an executed failure. Linuxdropletc-8lon1 Node24.21/Neovim0.12.5 workers2,lifetime522s/$0.0363; hostgateTREE67a6cf8e reused; no executed browser evidence. Duration/lint report-only limits retained. Preserve existing guard and original red; narrow upload-only correction, fresh full source then configured successor run. No unchanged-head retry/dev merge/per-item QA requested. Coordinator owns shared-contract verify all. Reviewer read-only.

### rev-31 · 2026-10-28T00:05:50.344Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261028-1382-source3
commit: 8960afce4836a76d89ed4359bbac924deff9cfcc
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected full source clear, A-12974. M4 resolved at8960afce/treeeb9a7835: sendFromHuman's internal uploadCaption defaultsfalse and only artifact.upload suppliestrue with validated nonempty artifacts. Ordinary prompt.send/attachedSend/topic.send/other callers keep previous blank-text refusal; no frame/API flag. Entire3file diff checked; no dev merge, unchanged original consumer tests/guards and upload assertions. Prior M1/M2/M3/L1 fixes from A-12954 carry. A-12973 selected macOS correction note retains actual original-test red and local artifacts15/prompt-races6/upload4/desktopcomposer8twice/phonecomposer6/typecheck greens and isolated HeadlessShell limits; no current Linux/full proof. Old A-12969 remains failed partial original-head evidence, not reused green. C1–C5 unverified. Submit one configured mode-free verify at unchanged8960afce then final original-log named outcomes including previously failing prompt identity, phases/load/executor/browser review. No extra merge/per-item QA requested; Coordinator owns shared-contract verify all. Reviewer read-only.

### rev-31 · 2026-10-28T00:21:40.905Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261028-1382-final1
commit: 8960afce4836a76d89ed4359bbac924deff9cfcc
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final corrected-head evidence clear; A-12990 independently audits original A-12989/ebb9593e at8960afce/treeeb9a7835.3787ordinary pass,zero fail/cancel/skip/TODO plus30 separate loadpass for six exact identities×5. Four upload cases, startup-limit case and web-authority upload eachbase+5/5; maxnew0.620267939s,no new>=3s allowance. C1–C5 verified across exact message/files/rollback/nativevia/ingress/session+gateway refusals/secret-producer/init-update/config guards. Prior failing exact empty-prompt identity now passes0.101611063s with original assertion/draft check unchanged; artifacts15/gateway20/webauthority45/configset20/init13/help5/compat1 current ordinary passes. T0/allT1/fallback all hub+NeovimT2/changedT3init13once/mappedT4guard1once/Web complete; remainingT3/otherT4/fullsoak absent. Addedphasewall7.700s T3/2.304s T4 excludesmachinewait; no repetitions there,Web0newfiles/0requiredreps. Linuxx64c-8lon1 Node24.21/Neovim0.12.5 HeadlessShell156.0.8078.4/v1248 workers2,lifetime785s/$0.0545 machineaccounting. HostgateTREE5c681a0f reused,not secondremote typecheck. Budgets/lint/ratchet report-only;134findings/61files,one missing baseline and existing overruns retained. OldfailedA-12969 remains prior-head partial evidence. No integrated-all/liveplatform claim; Coordinator owns ready/enqueue/separate shared-contract verify all. No extra merge/run/per-item QA requested. Reviewer read-only.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified.

### coord · 2026-10-28T01:07:55.640Z

Merged 2a1efeaca65252d483d6eb350add46f064253335 onto dev.
