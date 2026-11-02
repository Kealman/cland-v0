---
id: T-1623
kind: task
title: The transport kind, and outbound refused
state: closed
status: done
size: S
criterion_seq: 4
labels:
  - ready-for-agent
assignee: null
parent: E-1538
blocked_by: []
topic: topic-1340
branch: t/T-1623-the-transport-kind-and-outbound-refused
created: 2026-11-02T03:34:18.244Z
updated: 2026-11-02T15:14:56.528Z
closed: 2026-11-02T15:14:56.528Z
---

## Summary

One module declares the transport kind, with `ssh` as the only value 0.4.0 accepts, and one parser that every reader of a transport kind uses. A `transport` in any `[hosts.<pool>]` table is checked at hub start and reload. `outbound` is refused with a message naming 0.4.x, and any other value with a message naming `ssh`.

Hot files: new `hub/src/host/transport-kind.ts` [E-1532 and E-1533 import it], `hub/src/init/config.ts` [E-1534 owns `[hosts]`; one interim call only]

## Acceptance criteria

- [x] C1. A transport kind type with `ssh` as its only member lives in one module, with one parser that every place reading a transport kind uses (test).
  - done: impl-1623 · 2026-11-02T14:07:09.694Z
  - verified: rev-35 [reviewer] · run rev-35-1623-final-1 · 2026-11-02T14:31:48.603Z · commit a9f769363aa764a8de535cd4461846f1e205621f
- [x] C2. `transport = "outbound"` in any `[hosts.<pool>]` table is refused at hub start and at `cland hub reload` through the existing config refusal, with a message naming 0.4.x (test).
  - done: impl-1623 · 2026-11-02T14:07:09.809Z
  - verified: rev-35 [reviewer] · run rev-35-1623-final-1 · 2026-11-02T14:31:48.603Z · commit a9f769363aa764a8de535cd4461846f1e205621f
- [x] C3. Any other transport value is refused with a message naming `ssh` as the only value 0.4.0 accepts (test).
  - done: impl-1623 · 2026-11-02T14:07:11.075Z
  - verified: rev-35 [reviewer] · run rev-35-1623-final-1 · 2026-11-02T14:31:48.603Z · commit a9f769363aa764a8de535cd4461846f1e205621f
- [x] C4. `transport = "ssh"`, or a pool without `transport`, is accepted, and the rest of a `[hosts]` table is read as today (test).
  - done: impl-1623 · 2026-11-02T14:07:11.180Z
  - verified: rev-35 [reviewer] · run rev-35-1623-final-1 · 2026-11-02T14:31:48.603Z · commit a9f769363aa764a8de535cd4461846f1e205621f

## Notes

Shared files: see Hot files

## Comments

### impl-1623 · 2026-11-02T14:02:31.013Z

Rule 20 inventory at b8b1a95be (includes landed T-1587–1591): searched transport/TransportKind/.transport across hub/src (including colocated tests), hub/test, nvim, .agents, docs and QA. HostRecord in host/records.ts owns the sole current host transport reader (get/list SQL rows) and duplicate literal type: migrate these to TransportKind/parseTransportKind. host-records.test.ts asserts the unchanged ssh row shape; retain and extend for invalid persisted kinds. Config currently ignores hosts: add one call to interim validator. Agent protocol/client, git-daemon and fake ssh carry bytes, no kind field to parse. Transport carrier module does not yet exist. Neovim hub.lua/init.lua/qa.lua/init.lua and launcher/explorer fixtures use socket/stdio client transport, unrelated and unchanged. Spoke/MCP stdio transport, dispatcher edge transport, selectionTransport for verifier selection, suite test local transport variables are unrelated. Shipped briefs/spec/docs describe future carrier/provider imports, not executable readers. New public API: host/transport-kind.ts exports type TransportKind = 'ssh' and parseTransportKind(value: unknown): TransportKind (throws). E-1532/E-1533 must import it; E-1534 replaces interim config validator using same parser. Coordinator authorized narrowly fatal daemon startup classification only for hosts.<pool>.transport refusals; other hosts keys retain existing ignored/default behavior.

### rev-35 · 2026-11-02T14:09:01.644Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1623-source-1
commit: a9f769363aa764a8de535cd4461846f1e205621f
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Fullsourceclear,nofindings. Sharedssh-onlytype/parser consumedbyconfig explicitpooltransports and HostRecordsget/list; oldSSHshape/generatedproducers unchanged,invalidpersistedvalues use samepolicy. Interimvalidator checks onlyexplicittransport,leavesotherhostskeysasbefore. Read actualCoordinator8b16ffc8 narrowdaemonfatalapproval; classifierhandles hosts.<pool>.transport includingemptyquotedpool without broadhostsfatalprefix. Sealedstart/reloadcontrols coversecondpooloutbound/unknown/nonstring,retainedconfig/validrestore,omittedssh and malformedneighbor. Help+frozenHUB_USAGE/docs/skill/changeguide/tiers migrated,fullassertionsretained. No role/carrier/schema expansion. Consumerinventory independentlycheckedfield/type/functionreaders. C1–C4 awaitnamedexactheadqueued parser/config/records plus preservation/fullhelp facts;reportedlocalMac7/host9/config20/frozen1/static targetsonly. A-15862 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-15862-t-1623-source-review-at-a9f769363.md). QAafterstage unchanged. Reviewer ran no tests/browser and made no edits.

### rev-35 · 2026-11-02T14:31:48.603Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1623-final-1
commit: a9f769363aa764a8de535cd4461846f1e205621f
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-1623 final evidence at a9f769363aa764a8de535cd4461846f1e205621f. Scope: evidence. Source remains clear under rev-35-1623-source-1 / A-15862; current branch tip equals that reviewed head.

Standards: no findings. Spec: no findings. C1–C4 verified.

Independently streamed A-15870's actual named timing outcomes:
- transport-kind 1 pass: shared ssh-only parser, outbound reservation and other-value refusal messages (C1–C3).
- transport-config 5 pass: outbound/tcp/false refusal at startup and actual CLI reload, retained active config and valid restoration; ssh/omitted transport and malformed non-transport neighbors preserved; empty quoted pool refused (C2–C4).
- transport-records 1 pass: get/list reject invalid persisted transport using the same policy while preserving prior ssh row shapes (C1/C4).
- unchanged host-records 9 pass and config-set 20 pass; frozen usage compatibility 1 pass and native cli-help 7 pass, including aggregate full help and hub help.

Run 60cfc3ee-900d-467b-a7bc-b43cbe9d5906 / A-15870: exit 0, 4762 pass, zero fail/cancel/skip/todo. T0/T1/fallback all T2/Web completed. T3 deferred to merge batch; T4 unexecuted. This is task verification, not full merge-batch coverage.

Provenance: head above, tree 857533e7512c4209d94ba0cab601aec22b846eb8, uncached droplet c-8 sfo2, Linux x64 6.8.0-142-generic, Node v24.21.0, Neovim v0.12.5. Browser /home/runner/cland/node_modules/playwright-core/.local-browsers/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell, Google Chrome for Testing 156.0.8078.4. Host typecheck at that tree was not repeated remotely. Budget/lint/skip-reason checks report-only; skips [] / missing reason count 0. Executor lifetime 1222 s / $0.0848 are billing facts, not suite wall time. No projection counted as execution.

C1 also relies on source review's complete reader/consumer inspection and shared parser imports. Local A-15860 remains supplementary; queued evidence suffices for named criteria and preservation. QA affected/after-stage, no per-item brief. Reviewer ran no tests/browser and made no edits.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified.

### coord · 2026-11-02T15:14:56.528Z

Merged c3cb1eeb5830f74819a024988af5ce53ea3a52a6 onto dev.
