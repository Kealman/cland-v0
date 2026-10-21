---
id: T-1042
kind: task
title: Artifact capability reads refuse every file on macOS when the project path has a symlinked ancestor
state: closed
status: done
size: S
criterion_seq: 3
labels:
  - ready-for-agent
  - bug
assignee: null
parent: E-412
blocked_by: []
regression_of: T-987
topic: topic-787
branch: t/T-1042-artifact-capability-reads-refuse-every
created: 2026-10-21T08:10:08.282Z
updated: 2026-10-21T08:33:30.808Z
closed: 2026-10-21T08:33:30.808Z
---

## Summary

T-987 opens artifact files on macOS with `O_NOFOLLOW_ANY`, which refuses a symlink in any component of the absolute path. On Linux it walks from `/` with `O_NOFOLLOW` at every component. A project under a symlinked ancestor therefore gets 404 for every capability URL: `/var` → `/private/var` holds macOS's TMPDIR, and `/tmp` → `/private/tmp`. The macOS stage cover 9f32c6e2 at 7c5e4028 (A-8189) failed five `hub/test/web-artifacts.test.ts` tests with `404 !== 200`. The Linux task runs passed, because their TMPDIR has no symlinked ancestor.

## What to build

The no-follow guard applies only to the untrusted part of the path: the components the hub does not own. Take the trusted prefix once, as the real path of the directory the hub stores artifacts in or of the project root. Do not take it from the artifact's own path, which T-987 deliberately keeps lexical. Open the remainder with no-follow semantics from an anchored descriptor. Keep T-987's guarantees: a substituted ancestor symlink inside the artifact's folder, another artifact's file, traversal and a moved file all stay refused.

## Acceptance criteria

- [x] C1. With the project under a symlinked ancestor (a symlink to a scratch dir, or macOS's system TMPDIR), every T-987 capability test serves 200 for its own artifact files on macOS and Linux (test).
  - done: impl-1042 · 2026-10-21T08:16:07.408Z
  - verified: rev-23 [reviewer] · run rev-20261021-1042-evidence · 2026-10-21T08:27:55.661Z · commit afc2e311f2c1093fc9337112d594a56c7f7f84ef
  - verified: rev-23 [reviewer] · run rev-20261021-1042-final · 2026-10-21T08:28:54.658Z · commit afc2e311f2c1093fc9337112d594a56c7f7f84ef
- [x] C2. T-987's refusals still hold under that symlinked ancestor: another artifact, `../`, encoded traversal, a substituted ancestor symlink inside the folder and a moved file (test).
  - done: impl-1042 · 2026-10-21T08:16:07.423Z
  - verified: rev-23 [reviewer] · run rev-20261021-1042-evidence · 2026-10-21T08:27:55.661Z · commit afc2e311f2c1093fc9337112d594a56c7f7f84ef
  - verified: rev-23 [reviewer] · run rev-20261021-1042-final · 2026-10-21T08:28:54.658Z · commit afc2e311f2c1093fc9337112d594a56c7f7f84ef
- [x] C3. On macOS, `hub/test/web-artifacts.test.ts` passes in a targeted run from the system TMPDIR, and the Linux task run passes it too (local and remote evidence; the macOS stage cover confirms it after landing).
  - done: impl-1042 · 2026-10-21T08:28:00.708Z
  - verified: rev-23 [reviewer] · run rev-20261021-1042-final · 2026-10-21T08:28:54.658Z · commit afc2e311f2c1093fc9337112d594a56c7f7f84ef

## Comments

### impl-1042 · 2026-10-21T08:12:16.514Z

Test-first red: added an explicit scratch symlinked project ancestor to the existing T2 HTTP fixture. On local macOS, sealed disposable-root `node --test hub/test/web-artifacts.test.ts` fails 5/7 cases; actual failure `404 !== 200` (moved file: `Artifact file not found` vs `artifact bytes`). Cover-quiet released by Coordinator at 08:11Z. No passing full-suite/stage claim.

### rev-23 · 2026-10-21T08:18:21.671Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261021-1042-source
commit: afc2e311f2c1093fc9337112d594a56c7f7f84ef
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear, no findings; full audit A-8191. Trusted project prefix alone is realpathed once at edge construction. Artifact suffixes stay lexical; Linux keeps parent-descriptor traversal/no-follow below resolved prefix; Darwin uses atomic O_NOFOLLOW_ANY without incompatible O_NOFOLLOW. Outside-prefix sibling/alias paths keep full-path no-follow fallback per Coordinator60b522c9. Installed SDK confirms constant; no Reviewer open probe. Existing moved-file/nested/final-open race/lifetime/confinement checks retained under explicit scratch symlinked trusted ancestor, with authorized200 checks before refusals; T1 covers outside-prefix real sibling and alias refusal. Docs match, diff check clear. A-8190 final-tree local macOS focused7T2+2T1/typecheck is a scoped summary, not Linux/configured/stage pass. C1/C2 runtime remain unverified pending same-head configured Linux evidence. C3 intentionally remains open for macOS stage-cover evidence per Coordinator6a67d8be; local focused tests cannot satisfy it. Affected after-stage QA separate; no Reviewer runtime.

### rev-23 · 2026-10-21T08:27:55.661Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261021-1042-evidence
commit: afc2e311f2c1093fc9337112d594a56c7f7f84ef
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

C1/C2 evidence clear at unchanged afc2e311; no findings. Audit A-8197. Configured168e87cd/A-8196 actual Linux x64 c-8 lon1 T1/all hub+Neovim T2 exit0:2229 ordinary passes/342 files, plus5 separate load passes for new outside-prefix T1 identity (5/5). Capability T2 7/7 under explicit symlinked project ancestor, unit2/2: authorized reads, traversal/other-artifact/moved/nested/final-open race and outside-prefix refusal pass. Scoped final-tree Mac7T2+2T1 report remains A-8190; not a Mac stage cover. C3 intentionally remains open/unverified per Coordinator6a67d8be until the macOS stage-cover receipt; item is not fully settled. Hostcheckb8dde0ec not repeated remotely; lint/duration/ratchet report-only,7 missing baselines. Browser Web explicitly not run (missing Linux libraries/T-993); HTTP/WS T2 did execute. No browser/T3/T4/integrated/stage/after-stage QA claim; no Reviewer runtime.

Criteria: C1 verified, C2 verified.

### rev-23 · 2026-10-21T08:28:54.658Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261021-1042-final
commit: afc2e311f2c1093fc9337112d594a56c7f7f84ef
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear under current C3; no findings. A-8198 supplements C1/C2 audit A-8197. Coordinator6dfbed9e-bc12-4e5f-b87a-78cb069be388 revised C3 to targeted Mac system-TMPDIR pass plus Linux task pass and explicitly accepts A-8190 local7/7 and A-8196/run168e87cd as that evidence. C3 now verified; prior pending statement applied to old acceptance text. No source/head change. Linux actual T1/all hub+Neovim T2 passes2229 ordinary/342 files plus5 separate outside-prefix load passes; capabilityT2 7/7/unit2/2. Hostcheckb8dde0ec not repeated remotely; lint/duration/ratchet report-only,7 missing baselines. Browser Web not run (missing Linux libraries/T-993); HTTP/WS T2 executed. No browser/T3/T4/integrated/Mac stage/after-stage QA pass claimed. Mac stage confirmation remains after landing under revised criterion; no Reviewer runtime.

Criteria: C1 verified, C2 verified, C3 verified.

### coord · 2026-10-21T08:33:30.808Z

Merged f96a314be1d8d72bac0b0fc6490c8a46cdea4c57 onto dev.
