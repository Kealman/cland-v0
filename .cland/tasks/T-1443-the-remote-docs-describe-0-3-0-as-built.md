---
id: T-1443
kind: task
title: The remote docs describe 0.3.0 as built
state: closed
status: done
size: S
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-1314
blocked_by: []
topic: topic-1181
branch: t/T-1443-the-remote-docs-describe-0-3-0-as-built
created: 2026-10-29T15:55:47.685Z
updated: 2026-10-29T16:38:27.905Z
closed: 2026-10-29T16:38:27.905Z
---

## Summary

Before the release, the web-and-phone page's section on remotes, the page on `cland remote` and `cland secret`, and the remote sections of `hub/README.md` are checked against the built release and corrected where they differ, as T-1186 did for 0.2.0.

## What to build

Read each page against the build: commands and flags against `--help`, config keys and secret names against the code, setup's remote step and doctor's lines against their tests. Add Discord, voice and attachments wherever the pages still describe Telegram only. Fix only what differs, and claim nothing the build lacks.

## Acceptance criteria

- [x] C1. Every command, flag, config key and secret name on the three pages exists in the build, shown by the remote-docs tests, extended where a page names something new.
  - done: impl-1443 · 2026-10-29T16:00:35.224Z
  - verified: rev-26 [reviewer] · run rev-20261029-1443-evidence-2 · 2026-10-29T16:25:35.965Z · commit 26fc7846f299ff2a3b0d8ab96e791e7ffce95880
- [x] C2. The pages cover both remotes, attachments and voice, setup's remote step and doctor's remote lines as built.
  - done: impl-1443 · 2026-10-29T16:00:35.624Z
  - verified: rev-26 [reviewer] · run rev-20261029-1443-evidence-2 · 2026-10-29T16:25:35.965Z · commit 26fc7846f299ff2a3b0d8ab96e791e7ffce95880

## Comments

### impl-1443 · 2026-10-29T15:57:31.829Z

Audit scope: public Remote control page, web-and-phone Remotes section, and hub/README remote/config/secrets/setup/doctor sections. Existing T1 source/vocabulary and T2 executable Telegram walkthrough seams retained; no runtime/shared contract changes. Findings: web page only describes Telegram; main guide's media/chat/recovery/maintenance mostly Telegram-only; README Remote commands incorrectly says Discord callbacks require injection although built-in client ships. SKILL.md freeze respected; proposed skill guidance: remote-docs guard should include both messenger descriptions, Discord media/history distinctions and README public commands.

### rev-26 · 2026-10-29T16:04:42.980Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261029-1443-source-1
commit: 26fc7846f299ff2a3b0d8ab96e791e7ffce95880
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full current source1 clear, Standards/Spec nofindings afterM1correction. A-13749pinsbase/intermediatemerge/finalheadtree andcomplete5-filecontribution. TypedaskanswersnowTelegram-only; Discordordinarytexttopic.send vsbuttons/modal/mappedvoiceanswers sourcechecked/newguard. Built-inDiscordfactory/REST/gateway, numericlocalpairing/workbench/doctorlocalonly,dualremotevoice/media20MiB10files25MiBoverhead/history500oldestfirst/Telegram150s sourcechecked. GuardaddsREADMEvocabulary/flagsinventednegative+jsonpositive; existingT1wrapper/no renamedidentity/newfiletier/allowance, noproduction/dependency/skillchanges. C1/C2runtimepending; local16/16claimnotremoteproof. Submitunchangedheadconfiguredmodefree/finaloriginal-recordreview; no Reviewerfullrun/workload/releasepublish.

### rev-26 · 2026-10-29T16:11:15.089Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261029-1443-evidence-1
commit: 26fc7846f299ff2a3b0d8ab96e791e7ffce95880
scope: evidence
findings: [{"severity":"medium","text":"Configured run 4e009644/A-13758 stopped on DigitalOcean transport failure after T0; T1/T2/Web execution and criterion runtime evidence are unavailable."}]
finding_counts: {"high":0,"medium":1,"low":0}

Standards: source clearance rev-20261029-1443-source-1/A-13749 retained at unchanged head. Spec: evidence incomplete, not a criterion failure or suite pass. Original T0 host check passed in 54.905 s; remote runtime counts/platform/health unavailable. T3/T4 unexecuted. A-13761 records original-log versus hub-result provenance and excludes projections from measurements. Successor admitted run dbc65bc5 is separate and not assessed here.

### rev-26 · 2026-10-29T16:25:35.965Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261029-1443-evidence-2
commit: 26fc7846f299ff2a3b0d8ab96e791e7ffce95880
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-13791 original A-13789 execution/timing/load independently audited. Standards source A-13749 retained/no findings. Spec C1/C2 verified by15named imported docs cases including5new, each5/5load; base max0.004440682s/load max0.008661332s. Full dedup4155ordinary+75load pass, no nonpass/unfinished. Host typecheck/build/static T0positive31.539s; configured T1/T2/Web pass, explicit hostgate55a6a05b reused. T3/T4 unrun, Web0newfiles/repetitions; report-only timing/lint not enforced passes. Prior A-13758/A-13761 transport failure retained separately. Frozenhead/QA none; no Reviewer workloads or release/publish action.

Criteria: C1 verified, C2 verified.

### coord · 2026-10-29T16:38:27.905Z

Merged 95133bfb086f5d96fc2bc5ed3edd9223f02e0a26 onto dev.
