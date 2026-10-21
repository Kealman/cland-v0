---
id: T-987
kind: task
title: Artifact files under capability URLs
state: closed
status: done
size: S
criterion_seq: 5
labels:
  - ready-for-agent
assignee: null
parent: E-412
blocked_by:
  - T-982
topic: topic-781
branch: t/T-987-artifact-files-under-capability-urls
created: 2026-10-20T16:50:00.648Z
updated: 2026-10-21T06:20:47.704Z
closed: 2026-10-21T06:20:47.704Z
---

## Summary

An artifact's files are served from the web edge under a random capability URL that a client frame mints per artifact. The URL is valid while its cookie session lives and confined to the artifact. HTML carries a sandbox policy, so a page artifact in a sandboxed iframe loads its own files without the cookie.

## What to build

A client frame on the web edge, for example `artifact.url`, mints a capability for one artifact. `/a/<capability>/<file>` serves that artifact's file, or files inside its folder. The content type comes from the extension. An HTML file answers with `Content-Security-Policy: sandbox allow-scripts`. A capability dies with its cookie session.

## Acceptance criteria

- [x] C1. The minting frame on the web edge returns a capability URL, and the URL serves the artifact's file with the type of its extension (test).
  - done: impl-987 · 2026-10-21T03:20:43.016Z
  - verified: rev-23 [reviewer] · run rev-20261021-987-final · 2026-10-21T03:38:47.902Z · commit 20db520237c3cd3e6e2ac95dc3a44595b9114ece
  - verified: rev-23 [reviewer] · run rev-20261021-987-final-2 · 2026-10-21T06:15:25.448Z · commit 4b5407c9861efafc7eb20880b5624683519ec413
- [x] C2. A capability serves only its own artifact's file or folder: another artifact's file, a path outside the folder and a traversal are refused (test).
  - done: impl-987 · 2026-10-21T03:28:15.685Z
  - verified: rev-23 [reviewer] · run rev-20261021-987-final · 2026-10-21T03:38:47.902Z · commit 20db520237c3cd3e6e2ac95dc3a44595b9114ece
  - verified: rev-23 [reviewer] · run rev-20261021-987-final-2 · 2026-10-21T06:15:25.448Z · commit 4b5407c9861efafc7eb20880b5624683519ec413
- [x] C3. An HTML file answers with `Content-Security-Policy: sandbox allow-scripts`, and a folder artifact's page reaches its own stylesheet through a relative URL under the same capability (test).
  - done: impl-987 · 2026-10-21T03:20:43.061Z
  - verified: rev-23 [reviewer] · run rev-20261021-987-final · 2026-10-21T03:38:47.902Z · commit 20db520237c3cd3e6e2ac95dc3a44595b9114ece
  - verified: rev-23 [reviewer] · run rev-20261021-987-final-2 · 2026-10-21T06:15:25.448Z · commit 4b5407c9861efafc7eb20880b5624683519ec413
- [x] C4. A capability stops working when its cookie session is revoked or expires (test).
  - done: impl-987 · 2026-10-21T03:20:43.088Z
  - verified: rev-23 [reviewer] · run rev-20261021-987-final · 2026-10-21T03:38:47.902Z · commit 20db520237c3cd3e6e2ac95dc3a44595b9114ece
  - verified: rev-23 [reviewer] · run rev-20261021-987-final-2 · 2026-10-21T06:15:25.448Z · commit 4b5407c9861efafc7eb20880b5624683519ec413
- [x] C5. `hub/README.md` documents the capability URLs.
  - done: impl-987 · 2026-10-21T03:20:43.122Z
  - verified: rev-23 [reviewer] · run rev-20261021-987-source-2 · 2026-10-21T03:29:46.522Z · commit 20db520237c3cd3e6e2ac95dc3a44595b9114ece
  - verified: rev-23 [reviewer] · run rev-20261021-987-final · 2026-10-21T03:38:47.902Z · commit 20db520237c3cd3e6e2ac95dc3a44595b9114ece
  - verified: rev-23 [reviewer] · run rev-20261021-987-source-3 · 2026-10-21T06:06:24.704Z · commit 4b5407c9861efafc7eb20880b5624683519ec413
  - verified: rev-23 [reviewer] · run rev-20261021-987-final-2 · 2026-10-21T06:15:25.448Z · commit 4b5407c9861efafc7eb20880b5624683519ec413

## Comments

### impl-987 · 2026-10-21T03:15:12.401Z

Implementation started at current origin/dev. Public test seams: authenticated artifact.url frame and cookie-free /a/<capability>/<file> HTTP requests. Stage cover quiet notice currently prevents local test execution; verification will run remotely after source review. QA policy is affected/after-stage, so no per-item QA brief required.

### impl-987 · 2026-10-21T03:20:59.423Z

Source review requested from Reviewer at 0fdc2fb1, branch pushed to origin; A-8128 records scope. Hub typechecking passed locally on macOS. Runtime evidence remains pending: no runtime test run under stage-cover quiet hold. Review assigned to Reviewer; mode-free remote verification follows source clear, then merge waits for Coordinator's go.

### rev-23 · 2026-10-21T03:24:04.538Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-20261021-987-source
commit: 0fdc2fb1402825f74d42262ddc00dfabdf990ad4
scope: full
findings: [{"severity":"high","text":"H1: lstat checks only the final file; moved-file paths through a substituted owning-folder/ancestor symlink are canonicalized outside and accepted as root. Folder parents can also change after realpath but before open; O_NOFOLLOW protects only the leaf. Anchor the authorized root/opened descriptor and cover moved ancestors plus final-open swaps.","file":"hub/src/hub/web-artifacts.ts","line":39}]
finding_counts: {"high":1,"medium":0,"low":0}

Source not clear; full Standards/Spec audit A-8129 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8129-t-987-source-confinement-finding-at-0fdc2fb1.md). H1 violates C2: an outside same-name file can be served through a moved artifact after its owning folder becomes a symlink; final-open ancestor races also evade the leaf-only flag. Structural source finding, no exploit executed. Static child-symlink tests miss these cases. No other findings in token/session persistence, cascade/lifetime, web-only minting, MIME/sandbox or protocol/docs. Runtime evidence is intentionally absent under quiet hold; only local hub compilation reported. Fail C2, require corrected source review before verification; after-stage QA separate.

Criteria: C2 failed (Moved-file ancestor symlinks and parent replacement between check/open can escape the authorized artifact boundary (H1).).

### rev-23 · 2026-10-21T03:29:46.522Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261021-987-source-2
commit: 20db520237c3cd3e6e2ac95dc3a44595b9114ece
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected source clear; audit A-8135 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8135-t-987-corrected-source-clear-at-20db5202.md), supplementing full initial A-8129. H1 resolved: lexical authorization plus Linux descriptor-relative O_DIRECTORY/O_NOFOLLOW walk or macOS whole-path O_NOFOLLOW_ANY, independently checked against installed SDK constant; unsupported/missing procfs fails closed. Public moved-file/ancestor tests and deterministic final-open swap port preserve actual fs behavior and deny outside bytes. Docs match platform semantics. No findings. C5 verified by source; C1–C4 await exact-head configured mode-free runtime. No runtime has run under quiet hold; compile success is not open-behavior or suite proof. Source clear does not lift Coordinator quiet/queue holds. No Reviewer runtime; after-stage QA separate.

Criteria: C5 verified.

### impl-987 · 2026-10-21T03:38:41.007Z

Configured mode-free verification d790c0dc at reviewed head 20db5202 completed auto exit 0 on Linux x64 droplet c-8 lon1 (A-8142). Host T0 check and all T1/T2 fallback passed, 2207 tests passed, including capability storage and all 7 HTTP/open regressions. Budget and lint gates were report-only. Web was NOT RUN because Linux Headless Shell libraries are unavailable, so no Web pass/cache evidence is claimed. T3 remains deferred to periodic/integrated occasions. Droplet lifetime 438s, cost $0.0304. Same-head receipt sent to Reviewer. Merge remains on Coordinator's stage-cover hold; lead T-987 report returned empty because no Coordinator role holder is connected.

### rev-23 · 2026-10-21T03:38:47.902Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261021-987-final
commit: 20db520237c3cd3e6e2ac95dc3a44595b9114ece
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear; audit A-8143 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8143-t-987-final-evidence-review-at-20db5202.md). Same-head d790c0dc/A-8142 completes Linux T1/all-T2 fallback: 2,207 ordinary passes/339 files; capability T1 1/1 and T2 7/7, all eight new identities each 5/5 load passes separately. C1 mint/MIME, C2 static/moved-ancestor/final-open confinement, C3 sandbox header/relative CSS HTTP and C4 persistence/cascade/revoke/expiry pass. H1 remains resolved; C5 docs source-established. Web NOT RUN for missing Linux libraries; no browser rendering, macOS runtime, T3/T4/integrated/QA claim. Host check eaafb512 not repeated remotely; lint/duration/ratchet report-only, four missing baselines. No findings; verify C1–C5. Coordinator merge/quiet holds remain separate.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified.

### rev-23 · 2026-10-21T06:06:24.704Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261021-987-source-3
commit: 4b5407c9861efafc7eb20880b5624683519ec413
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Authorized snapshot merge delta clear; audit A-8152 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8152-t-987-snapshot-merge-delta-clear-at-4b5407c9.md). Coordinator 7967e359 permits this one dev merge. Both capability conformance assertions and all five snapshot assertions retained; authority inventory and protocol/shared-wire surfaces coexist. Capability implementation/tests byte-unchanged from 20db5202, H1 fix intact; auto-merged dispatch retains Web-only mint handler/callback and adds reviewed snapshot behavior. Docs coexist; diff check clear. A-8151 compilation is static only, A-8142 historical. No findings; C5 verified by source, C1–C4 await fresh same-head configured mode-free verification. No Reviewer runtime or QA claim.

Criteria: C5 verified.

### impl-987 · 2026-10-21T06:15:00.217Z

Post-T-983 mode-free verification 1bbbd229 at reviewed head 4b5407c9 completed auto exit 0: Linux x64 droplet, host T0 check plus all-T1/all-T2 fallback, 2219 ordinary passes, no failures/skips. Artifact A-8155. Web NOT RUN (missing Headless Shell OS libraries); no browser/T3/T4/macOS-runtime/QA pass claimed. Lint, budget and T3 ratchet were report-only. Executor lifetime 458s, $0.0318, workers2. Same-head result reached Reviewer; awaiting final evidence verdict, then authorized merge enqueue.

### rev-23 · 2026-10-21T06:15:25.448Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261021-987-final-2
commit: 4b5407c9861efafc7eb20880b5624683519ec413
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Merged-head final clear; audit A-8156 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8156-t-987-merged-head-final-review-at-4b5407c9.md). Exact-head 1bbbd229/A-8155 completes Linux T1/all-T2: 2,219 ordinary passes/341 files and all eight capability identities each 5/5 load passes separately. Capability T1 1/1/T2 7/7; incoming snapshot framing 8/8 and connection 4/4 pass. H1 confinement fix intact; mint/MIME, C2 boundaries, HTTP sandbox/CSS and session lifetime/cascade establish C1–C4, C5 docs remain source-established. Web NOT RUN for missing Linux libraries; no browser/macOS-runtime/T3/T4/integrated/QA claim. Host check e93ca5e6 not repeated remotely; lint/duration/ratchet report-only, six missing baselines. No findings; verify C1–C5.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified.

### impl-987 · 2026-10-21T06:15:50.112Z

Final review at 4b5407c9 is clear/C1-C5 verified (A-8156). Merge enqueue attempted per Coordinator instruction, but hub refused: `cland: forbidden: merge (Implementer may not use merge)`. Stopped action under rule 5; reported to lead T-987 for Coordinator enqueue. No workaround or retry. Clean reviewed/verified head and claim retained pending landing.

### coord · 2026-10-21T06:20:47.704Z

Merged 337af5d9d7ea282d1f0d4ec62b3ac312ac2755b9 onto dev.
