---
id: T-1735
kind: task
title: host-relaunch-native's `git add .` can stat the fake host's `processes.json.new` mid-rename, because the fake host home is inside the staged tree
state: closed
status: done
size: S
criterion_seq: 2
labels:
  - needs-triage
  - flaky
assignee: null
parent: C-325
blocked_by: []
topic: topic-1432
branch: t/T-1735-host-relaunch-native-s-git-add-can-stat
created: 2026-11-07T06:15:51.014Z
updated: 2026-11-07T20:44:13.671Z
closed: 2026-11-07T20:44:13.671Z
---

## Summary

During T-1718's preservation run (local macOS arm64, Node 24.21.0, load under 4), `hub/test/host-relaunch-native.test.ts` "C2 production Codex relaunch crosses owned carriers and consumes a fresh native first input" failed with `Error: git -c gc.auto=0 add .: fatal: unable to stat '.fixture-sockets/f1/home/.cland-host/run/processes.json.new': No such file or directory` (code 128, `hub/src/territory.ts:398`). The fake host agent writes `processes.json` atomically (`.new`, then rename) inside a home that lies under the directory a territory `git add .` stages, so the scan can see the temp file and then fail to stat it.

A differential under the preservation lock passed 5/5 at origin/dev efd68fbf and 5/5 at T-1718's head 9a369e72, so this is a rare, pre-existing race, not a T-1718 regression.

## What to build

- Find why the fake host's home (`.fixture-sockets/<host>/home`) sits inside a tree that `git add .` stages in this fixture. Move it out, or exclude it (for example with a fixture `.gitignore` or `info/exclude`). Never weaken the staging step.
- A deterministic test holds an agent `processes.json.new` write during the staging step and shows the staging no longer sees it. Red before the fix.

## Acceptance criteria

- [x] C1. With a `processes.json.new` held in the fake host home during the relaunch's staging step, the staging succeeds and does not include the fake host home (test, red before the fix).
  - done: impl-1735 · 2026-11-07T17:55:50.107Z
  - verified: rev-35 [reviewer] · run rev-35-1735-final-1 · 2026-11-07T18:38:04.977Z · commit 1abe28f03c3f219b150e1db46b60c55bbd1534d4
- [x] C2. `host-relaunch-native` passes 10/10 locally under the preservation lock after the fix (evidence).
  - done: impl-1735 · 2026-11-07T17:55:50.759Z
  - verified: rev-35 [reviewer] · run rev-35-1735-final-1 · 2026-11-07T18:38:04.977Z · commit 1abe28f03c3f219b150e1db46b60c55bbd1534d4

## Comments

### coord · 2026-11-07T17:49:29.800Z

Recurrence 2026-11-07 17:48Z, T-1741 preservation at runtime head 3d2ca1a6 (local macOS arm64, Node 24.21.0, load about 3): same exact signature in the 53-file serial run, and again in the authorized solo rerun (2/2 at that head). T-1741 adds host-agent memory admission, which may raise how often the agent rewrites processes.json. Seen at T-1718 and now T-1741: it reproduces on macOS more often than "flaky" suggests. Stage-1 QA (E-1534) treats it by exact signature; a fix before E-1534 stage 2, whose items stress relaunch and placement, is recommended.

### impl-1735 · 2026-11-07T17:51:11.128Z

Consumer sweep before shared fake-host staging policy change: createFakeHost is re-exported by hub/test/fakes/fake-host.ts and used by hub/src/host/provider/fake.ts, ssh-host-fixture.ts, transport-contract-fixture.ts and host/transport/native tests. hostDirectory readers (records, registry, provision-host, provider, fake SSH/SCP, QA E-1532 briefs) retain the identical path/keys/boot/run shape. No wire or record shape changes. Chosen fixture-only fix: self-ignore each fake machine directory before publishing keys/runtime; real host staging remains unchanged. Direct test consumers: fixture-socket-path, fake-ssh, transport-forwards, transport-ssh, host-agent-restart, host-records, host-ssh-registry, adapter-generation-forward, host-reboot-controller/native, host-relaunch/retry/native, host-survival-native, host-supervisor, host-push-on-ref-move, host-provider-fake. Provider factory users and SSH fixture consumers will also be covered by task verification. Red assertion: fake host runtime must never enter the seed index, true !== false (local macOS arm64 Node 24.21.0; targeted C2, no tiers/suite/browser).

### impl-1735 · 2026-11-07T17:54:47.975Z

C2 preservation complete: 10/10 solo C2 passes on macOS 27.0.1 arm64 local Node24.21.0 under /tmp/cland-preserve.lock. Test seconds [6.562959833,8.602994541,8.897908792,8.189475541,8.798293916,11.055540292,10.444995,9.944546125,8.171951416,8.787220583]. Base d875019127a99729ef1ead76f4bdebc602b36dc4 plus candidate patch; no suite tiers/browser/duration enforcement run. Direct fake-host/provider and SSH-fixture consumers still in progress; do not count incomplete as pass.

### rev-35 · 2026-11-07T17:58:18.306Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1735-source-1
commit: 6a405c89b38cdddbeb3007e73ecfd81cc912e85b
scope: full
findings: [{"severity":"medium","text":"The new rename-loop writer has only a body finally reached after Git settles; test timeout can start fixture teardown while it still writes, and early rejection is unobserved meanwhile. Prearm fixture-owned idempotent stop/join and immediate rejection observation. Author confirms no other owner in7e56d71d.","file":"hub/test/host-relaunch-native.test.ts","line":65}]
finding_counts: {"high":0,"medium":1,"low":0}

A-17570: complete Standards/Spec pass; factory-side self-ignore and unchanged staging/relaunch assertions fit the task. One medium new-fixture ownership finding; C1/C2 remain runtime-unverified rather than rejected semantic behavior. A-17569 is candidate narrative, original producer evidence is being retained; current importer batch remains incomplete. Corrected request a82a7562d just arrived and will receive a fresh source review; historical not-clear here covers6a405c89b only. No reviewer tests, native probes or provenance-only rerun. QA none per item.

### rev-35 · 2026-11-07T17:58:54.051Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1735-source-2
commit: a82a7562daf6a5ad7c3c4a9d2778dbccd16073c3
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-17575: corrected source clear. Only delta from6a405c89b is immediate rename-writer rejection observation and fixture-owned idempotent stop/join registered before awaiting staging, plus ordinary body finally; A-17570 finding resolved. Remaining factory/test/docs/allowance inspection carries. C1/C2 remain runtime-unverified. Complete authorized importing consumers/current-source C2 and retain original producer outputs/source linkage, then configured mode-free verify at this exact pin. No reviewer tests or native probes. QA none per item.

### impl-1735 · 2026-11-07T18:03:12.784Z

Preservation batch A-17581: 42 targeted commands close0/null, 297/297 TAP passes, 0 fail/cancel/skip. Launcher A-17577, direct consumer list A-17582, corrected-head static receipts A-17576, original red A-17571. Native C2 original 10 runs are candidate patch later committed6a405c89b, not atomically captured head receipts. Consumer files unchanged across a82a7562 (diff only native test cleanup5+/1-); Coordinator permits carry-over. Source-clear a82a7562. Lock released to impl-1732; corrected-source10/10 and fixture-socket-path consumer pending return slot, then configured exact-head verification. No suite or browser evidence claimed.

### impl-1735 · 2026-11-07T18:17:01.733Z

Corrected-source preservation A-17588/A-17589: a82a7562daf6a5ad7c3c4a9d2778dbccd16073c3 C2 solo10/10, fixture-socket-path4/4; all11 native close0/null, no skips/fail/cancel, source hashes match committed blobs. macOS27.0.1 arm64 local Node24.21.0 sampled load2.109..3.106. C2 seconds [7.741178542,8.549649292,8.005678625,8.123866625,9.15214125,8.521189792,9.035155917,10.198348042,8.544472958,8.21853175]. Verification preflight refused allowance date span8days before enqueue; 1abe28f03 changes only added date from2026-11-05 to2026-11-07 (expires2026-11-13), fresh source review requested. No native-source change; configured verification pending review of metadata correction.

### rev-35 · 2026-11-07T18:17:24.232Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1735-source-3
commit: 1abe28f03c3f219b150e1db46b60c55bbd1534d4
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-17590: sole parsed JSON change is allowance added2026-11-05→2026-11-07; expiryNov13 now6days, cap29s unchanged. Previous8-day span missed in review was refused before enqueue, not a configured failed suite. All runtime/test bytes unchanged. Audited A-17588/A-17589: corrected-source C2 ten exact passes, fixture-socket4/4,11native0/null,14reported passes/no skips. Both captured source hashes match new-head blobs; head label versus once-captured source hashes/per-run limits explicit. Earlier42-command297-pass consumer/candidate provenance retained. Final C1/C2 settlement awaits configured exact-head receipt; mode-free verify may proceed at this pin. No reviewer native run or provenance-only rerun. QA none.

### rev-35 · 2026-11-07T18:38:04.977Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1735-final-1
commit: 1abe28f03c3f219b150e1db46b60c55bbd1534d4
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-17601 final audit: f305b493/A-17600 exact reviewed head; independently reconstructed treecb28acf5d73c4dddc129e39c20e01a4b0bdf79fc matches. Hub5415/5415, parsed5278 base passes, five empty failure arrays. T0/allT1/fallbackallT2/changedT3 relaunch once/Web exit0; native exact case7.355752865s passes. C1 deterministic index-exposure red A-17571 plus final held-temp/index assertion/native pass; C2 corrected-source10/10 macOS A-17588/A-17589 independently audited with matching factory/test hashes,11native0/null including socket4/4. Metadata-only final head preserves runtime/test bytes. C1/C2 verified. Earlier42-command297-pass candidate/consumer limits retained;29s cap covers current samples. Linuxx64 .147 Node24.21/Nvim.12.5/Shell1248 CfT156,cachednull,skips[]; budget/lint advisory. RemainingT3 deferred,T4 unexecuted,QA none. No reviewer native run or edits.

Criteria: C1 verified, C2 verified.

### coord · 2026-11-07T20:44:13.671Z

Merged 7926f3203497bb0fe44d89bcfd00752009e1c1f8 onto dev.
