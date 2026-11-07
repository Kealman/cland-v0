---
id: T-1730
kind: task
title: A host's version handoff installs the whole runtime tree, so an upgraded host keeps its CLI, spoke and Claude Code mod
state: closed
status: done
size: M
criterion_seq: 4
labels:
  - ready-for-agent
assignee: null
parent: E-1533
blocked_by:
  - T-1723
topic: topic-1422
branch: t/T-1730-a-host-s-version-handoff-installs-the
created: 2026-11-06T20:59:24.215Z
updated: 2026-11-07T07:55:23.860Z
closed: 2026-11-07T07:55:23.860Z
---

## Summary

T-1723 delivers cland's whole runtime tree to a host at ready, under `<home>/.cland-host/code/<version>` as an atomic version symlink to an immutable generation. The later version handoff (`agentVersionHandoff`, E-1532) still installs only the host agent's closure into `code/<version>`, and `verifyAgentPackage` refuses version symlinks. So a host made ready at V1 and handed V2 ends up with a closure-only V2: the layout's CLI, spoke and `hub/mod/cland` are missing. Claude Code and spoke sessions then fail on that host after the hub upgrade. T-1723's source reviewer found it, outside that item's additive ready-delivery scope.

## What to build

- One code-tree shape per version on a host. The version handoff installs the same whole runtime tree as ready delivery, through `deliverRuntime` or its generation and pointer mechanism, instead of a closure-only package.
- `verifyAgentPackage` and the supervisor's version selection accept the version symlink and verify through it.
- Old generations stay for running readers, as in T-1723.

## Acceptance criteria

- [x] C1. A fake host made ready with the whole runtime at V1 and then handed V2 has `hub/bin/cland.ts`, `hub/bin/cland-spoke.ts` and `hub/mod/cland` under `code/V2`, each matching the V2 manifest digest (test, red before the fix).
  - done: impl-1730 · 2026-11-07T06:00:19.959Z
  - verified: rev-35 [reviewer] · run rev-35-1730-final-1 · 2026-11-07T06:43:44.449Z · commit bce79b583b0c13ffabafce937bbc48602a79d987
- [x] C2. After that handoff, the agent restarts on V2, and a Claude Code session on the host launches with its mod bridge connected (test).
  - done: impl-1730 · 2026-11-07T06:20:34.672Z
  - verified: rev-35 [reviewer] · run rev-35-1730-final-1 · 2026-11-07T06:43:44.449Z · commit bce79b583b0c13ffabafce937bbc48602a79d987
- [x] C3. A V1 reader running during the handoff keeps its generation until it exits (test).
  - done: impl-1730 · 2026-11-07T06:00:21.266Z
  - verified: rev-35 [reviewer] · run rev-35-1730-final-1 · 2026-11-07T06:43:44.449Z · commit bce79b583b0c13ffabafce937bbc48602a79d987
- [x] C4. The existing version-handoff cases in `host-agent-restart` and `host-agent-closure` pass, migrated only where they assumed a closure-only tree, with each migration named in a comment (test).
  - done: impl-1730 · 2026-11-07T06:20:34.923Z
  - verified: rev-35 [reviewer] · run rev-35-1730-final-1 · 2026-11-07T06:43:44.449Z · commit bce79b583b0c13ffabafce937bbc48602a79d987

## Comments

### impl-1730 · 2026-11-07T05:56:44.163Z

Rule 20 sweep before edits: searched entire tracked tree including hidden skills for agentBundle, deliverAgent, INSTALL_AGENT, agent-manifest, verifyAgentPackage, agentVersionHandoff, supervisor.sh, host-agent-restart and host-agent-closure. Production: code-delivery (handoff changes to runtime; standalone delivery retained), registry (same API), agent/package (accept sibling runtime pointer and both manifests), entry (both manifests), supervisor (both manifests/selection), remote-layout/CLI usage (paths unchanged). Tests: restart migrates only handoff cases; closure regenerated and legacy compatibility kept; runtime-delivery adds ready-to-handoff digest/reader proof; Claude-remote adds upgraded runtime bridge proof. transport-ssh, reboot-native, ssh-registry, push-on-ref-move, supervisor remain preservation consumers with unchanged API. QA briefs E-1466, E-1532 and stages 2/3/4, E-1533-stage-2 use existing paths/launch flow, unaffected; no wire shape removed. Docs host-agent and runtime/restart test guides updated. durations/tiers/index are metadata consumers. Shared bundle shape stays version/files/path/sha256/bytes; legacy closure verifier regression retained. Pre-agreed seams: native fake-host handoff and real delivered file digests; remote Claude frame launch and mod bridge receipt; existing closure compatibility.

### impl-1730 · 2026-11-07T06:02:10.994Z

Coordinator scope decision 237710ec-16f3-4e65-bdc4-69ae7e544e01: whole-runtime handoff compatibility starts at v0.4.0 (R-1530), the first host release. Independently ran git ls-tree -r --name-only v0.3.2 -- hub/src/host/agent/supervisor.sh hub/src/host/agent/package.ts: exit0, no paths. Pre-v0.4 symlink-rejecting agents occur only on unreleased dev builds; no compatibility migration owner required. First v0.4 hosts are made ready with whole runtime through T-1718. V1 from this item sources to next-version symlink is the forward guard. Will document boundary in docs/code after source pass; submitted head remains pinned.

### rev-35 · 2026-11-07T06:03:56.767Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1730-source-1
commit: 7e428b782004a1a851f1dbc7ad0801914b066396
scope: full
findings: [{"severity":"medium","text":"Selection verifies code/$version, signals the old child, then realpaths the mutable version pointer again. No publication exclusion exists, so a concurrent same-version delivery can replace the pointer between verification and launch. Capture and use the verifier's exact canonical generation before any signal, with a held pointer-replacement regression; do not re-resolve the selected alias after validation.","file":"hub/src/host/agent/supervisor.sh","line":64},{"severity":"medium","text":"The migrated `++commands===2` fault now drops a successful reuse-probe reply, not the accepted installer reply. Initial missing-version probe rejects before increment; install is success1, first publication is intercepted, reuse probe is success2. C4's lost-install boundary is therefore no longer exercised. Intercept the explicit installer phase after native success and retain all install/publication/no-replay/retained-worker assertions.","file":"hub/test/host-agent-restart.test.ts","line":70},{"severity":"low","text":"Document Coordinator237710ec's v0.4 compatibility boundary and identify the current-source V1→V2 composition guard. A pre-change dev supervisor still rejects symlinked versions; no released host agent existed at v0.3.2, so no pre-v0.4 compatibility implementation is required, but the claimed upgrade coverage must state that limit.","file":"docs/agents/host-agent.md","line":286}]
finding_counts: {"high":0,"medium":2,"low":1}

A-17380 separates Standards/Spec findings. Capture exact verified generation before signal/launch and restore phase-specific lost-install control; document Coordinator237710ec's v0.4 boundary/current-source guard. Pre-v0.4 dev agents are explicitly outside compatibility scope; git ls-tree v0.3.2 independently confirms no host supervisor/package shipped. C1/C3 remain runtime-unverified. All32 closure source hashes match; candidate raw/provenance limits A-17371–78 retained. Fresh committed source review before seven-file directed preservation/configured verification; after-stage full QA separate.

Criteria: C2 failed (Supervisor can verify generation A then resolve and launch B after a mutable version-pointer replacement.), C4 failed (Migrated lost-install interception drops a reuse-probe reply and no longer exercises accepted native install reply loss.).

### impl-1730 · 2026-11-07T06:04:10.322Z

Rule20 return-contract extension sweep before edit: verifyAgentPackage callers are INSTALL_AGENT staging/occupied verification, agent entry --verify, supervisor selection and restart verification assertions (rg entire tree). They ignore return except supervisor, which will consume the verified canonical generation string. No wire/persisted field changes. Existing throws and legacy package acceptance remain; supervisor captures returned identity before signalling. Add deterministic native pointer-swap regression at the signal helper boundary.

### rev-35 · 2026-11-07T06:21:25.203Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1730-source-2
commit: bce79b583b0c13ffabafce937bbc48602a79d987
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-17396 corrected source clear: verifier returns canonical checked generation captured before signal and reused through launch; positive native pointer-swap control; actual successful installer phase now loses reply with retained original publication/replay/worker assertions. v0.4 scope boundary documented per Coordinator237710ec. All32 closure source hashes match. A-17392–95 mutable correction red/green/setup-failure/provenance limits preserved; no current-head runtime claim. C1–C4 remain unverified pending exact-head directed seven-file preservation and configured verify; after-stage QA separate.

### rev-35 · 2026-11-07T06:21:52.063Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1730-source-2-reference-correction
commit: bce79b583b0c13ffabafce937bbc48602a79d987
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Reference correction only to rev-35-1730-source-2: authoritative artifact is A-17398, not A-17396. This records the same completed source review/result/head/evidence limits, not a new runtime pass. Verified canonical generation captured before signal/launch, actual successful installer reply-loss control with retained assertions, and v0.4 boundary documentation resolve prior findings. All32 closure source hashes match. C1–C4 remain runtime-unverified pending same-head seven-file preservation/configured verification; A-17392–95 mutable candidate limits and after-stage QA separation remain. Reviewer permission disallows ordinary task comments, so the corrected reference is recorded as this verdict.

### impl-1730 · 2026-11-07T06:34:45.409Z

Exact source-reviewed head bce79b583 preservation completed: A-17400 durable raw index+seven logs, macOS arm64 local Node24.21.0. All seven native producers code0/signal null, clean head before/after. Counts restart11, closure4, runtime-delivery3 incl nested, runtime-bundle3, Claude-remote44, SSHregistry2, survival1 =68pass with nofail/cancel/skip/todo. Sampled one-minute load max5.332; sub250ms bundle peak placeholder explicitly unknown. No Linux/browser/provider/network/real npm; scripted offline dependency seam. Targeted duration checker unexecuted; report-mode manifest unchanged. Configured run d701cf69 pending and after-stage QA separate; not yet ready.

### impl-1730 · 2026-11-07T06:43:18.389Z

Configured verification d701cf69/A-17405 green at unchanged source-clear bce79b583:5407pass,0fail/cancel/skip/todo; Linuxx64 droplet Node24.21.0, T0/allT1/fallbackallT2/changedT3 once/Web, remainingT3 merge-batch/T4unexecuted. A-17400 same-head local preservation68pass retained. Independently streamed top-level named records: closure4,bundle3,Claude44,restart11,delivery2, allpass. NewClaude actualLinux8.430063762s vs Mac5.517891458s gives ceil1.5xactualworst=13s existing allowance; replaces need for Linux1.6 projection in final sizing evidence, no source edit. Awaiting Reviewer final criterion settlement; E-1533 after-stage QA separate.

### rev-35 · 2026-11-07T06:43:44.449Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1730-final-1
commit: bce79b583b0c13ffabafce937bbc48602a79d987
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-17407 final same-head clear. d701cf69/A-17405 exit0,5407/5407; exact head and independently reconstructed execution tree match. C1–C4 named digest/reader, authenticated V2/Claude bridge, pointer-swap, actual install-loss/replay/worker and unchanged closure outcomes all pass. A-17400 exact-head seven-file Mac68/68 with native0/null receipts independently read. Linux Claude8.430063762s fits13s allowance; pointer5.805342406s fits11s, no sizing edit required. T0/T1/allT2/changedT3once/Web completed; remaining T3/full after-stage QA separate, T4 unexecuted. Qualified historic projection/source evidence limits retained.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified.

### coord · 2026-11-07T07:55:23.860Z

Merged 0e32c139d8e159b426526f79dc10b31475231913 onto dev.
