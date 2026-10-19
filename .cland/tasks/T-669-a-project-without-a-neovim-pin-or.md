---
id: T-669
kind: task
title: A project without a Neovim pin or package-lock.json gets a prepared droplet snapshot
state: open
status: ready
size: S
criterion_seq: 4
labels:
  - v0.1.4
  - verification
assignee: null
parent: E-614
blocked_by: []
topic: topic-560
branch: t/T-669-a-project-without-a-neovim-pin-or
created: 2026-10-16T16:35:25.691Z
updated: 2026-10-19T06:42:37.722Z
---

## Summary

Prefactoring for the droplet's `prepare` (ticket T-670). The snapshot's prepare key no longer requires cland's own pins. Today `prepareKey` throws `invalid Node or Neovim prepare pin` without `nvim/NVIM_VERSION` and `nvim/NVIM_SHA256SUMS`, and fails without `package-lock.json` at the base. After this ticket, a project in another stack can run `cland executor prepare`, and the builder installs Neovim only when the project pins it. For a key shaped like this repository's, the hash is unchanged, so its current snapshot stays current.

## What to build

- **The key** (`hub/src/executor/droplet/prepare.ts`). `PrepareKey.nvim` and `PrepareKey.lock` become optional. `nvim` is present when the base pins Neovim in `nvim/NVIM_VERSION` and `nvim/NVIM_SHA256SUMS`, and it is validated as today when present. `lock` is present when `package-lock.json` exists at the base. `node` and `base` stay required: the runner's platform line and the hub's status probe run `node` on the machine. `keyHash` and `sameKey` handle absent parts. A key with all four parts serializes exactly as today, so its `keyHash` is unchanged. `staleParts` compares absent parts as `none`. `readSnapshot` accepts a record without `nvim`.
- **The builder** (`provision.sh`). The Neovim download, checksum check and link run only when the key pins Neovim, for example behind an empty `__NVIM_VERSION__` guard. Node and the apt packages stay.
- **Delivery** (`run.ts`). The delivery's `package-lock.json` and Neovim checks run only for the parts the snapshot's key holds. A project without them prints neither line. Ticket T-670 replaces this block with `prepare`, so keep the change minimal.
- **Status.** `cland executor status` prints an absent part as `none` in the key and never reports it as stale.

**Keeping cland's own suite intact.** This repository pins Neovim and commits `package-lock.json`, so its key has the same four parts and the same hash, and its snapshot stays current with no re-prepare (C3). Its builder still installs Neovim, and its delivery prints the same lock and pin lines.

## Acceptance criteria

- [x] C1. `cland executor prepare` in a temporary project with neither `nvim/` nor `package-lock.json` builds a snapshot through the fake DigitalOcean API and machine, with a key without `nvim` and `lock` (`executor-prepare.test.ts`).
  - done: impl-669 · 2026-10-19T06:21:59.197Z
  - verified: rev-31 [reviewer] · run rev-20261019-669-final · 2026-10-19T06:42:36.122Z · commit ba8e3a4643569098711dab6515bc82a6747942ab
- [x] C2. That builder's user data installs Node and has no Neovim download, while a project pinning Neovim still gets it (assertions on the fake API's recorded `user_data`).
  - done: impl-669 · 2026-10-19T06:19:33.440Z
  - verified: rev-31 [reviewer] · run rev-20261019-669-final · 2026-10-19T06:42:36.122Z · commit ba8e3a4643569098711dab6515bc82a6747942ab
- [x] C3. `keyHash` of a four-part key equals a recorded golden value, so this repository's existing snapshot reads `current` (unit test).
  - done: impl-669 · 2026-10-19T06:16:28.959Z
  - verified: rev-31 [reviewer] · run rev-20261019-669-final · 2026-10-19T06:42:36.122Z · commit ba8e3a4643569098711dab6515bc82a6747942ab
- [x] C4. A run delivered to the pin-less snapshot prints no lock or Neovim line and verifies on the fake machine, and `cland executor status` shows `none` for the absent parts without `stale`.
  - done: impl-669 · 2026-10-19T06:21:59.571Z
  - verified: rev-31 [reviewer] · run rev-20261019-669-final · 2026-10-19T06:42:36.122Z · commit ba8e3a4643569098711dab6515bc82a6747942ab

## Comments

### impl-669 · 2026-10-19T06:15:06.277Z

Test-first: sameKey on a key without nvim failed with TypeError, and native prepareKey in a pin-less temporary Git project failed ENOENT before implementation. Both now pass through scripted provider/machine and FakeClock, with snapshot reuse, current/none status and delivery guard assertions. Four-part golden hash recorded from original code: 7599b8d463c5.

### rev-31 · 2026-10-19T06:19:04.126Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261019-669-source-1
commit: 53f08efe94441362d9a3dffd7d009a4f25ef106d
scope: full
findings: [{"severity":"medium","text":"Optional Neovim presence/content comes from the working tree rather than the fetched base, so the snapshot key and installed pin can disagree with the archived source.","file":"hub/src/executor/droplet/prepare.ts","line":31},{"severity":"medium","text":"New native Git fixture calls have no timeout, test cancellation or immediate owned-process/close join before fixture removal.","file":"hub/test/executor-prepare.test.ts","line":21},{"severity":"low","text":"Fake provider cleanup is registered after hub startup and skipped if hub.stop rejects, retaining provider stateRoot on those failure paths.","file":"hub/test/executor-prepare.test.ts","line":46}]
finding_counts: {"high":0,"medium":2,"low":1}

# T-669 source review: not clear

Head: 53f08efe94441362d9a3dffd7d009a4f25ef106d
Fixed base: 1e7600b3ea978fa99e767e34710470d7d9cb558f
Scope: full. Eight changed files; one implementation commit.

## Standards

M2 (medium), hub/test/executor-prepare.test.ts:21: the two new native Git/CLI scenarios use promisified execFile Git calls without a deadline, test AbortSignal or immediate process owner/completion join. Normal await covers only normal completion. Cancellation can let an admitted Git writer outlive tempProject's removal boundary, contrary to process cleanup rule 12. Bind cancellation and a finite deadline, own each child immediately and observe its completion before removal. Implementer e0c11f88 confirms the gap and will correct it.

L1 (low), hub/test/executor-prepare.test.ts:46: scripted fakeDigitalOcean allocates its stateRoot before hub startup, but its cleanup is registered only after startup and follows hub.stop without finally. Startup failure or a rejecting stop skips provider cleanup. Scripted mode has no HTTP listener, so this is retained temporary provider state rather than an unowned live server. Register ownership immediately and attempt close even if hub stop fails. Implementer dad47792 confirms the correction.

The new pure key tests fit T1 and pin a recorded four-part golden hash. Native Git/CLI key and delivery contracts stay in the existing T3 file; provider and machine work is scripted with FakeClock. No allowance, duration-baseline change, external provider or literal wait is introduced. Source review makes no claim that the T0–T2 task gate executes these T3 scenarios; targeted host receipts and later batch evidence remain separately attributed.

## Spec

M1 (medium), hub/src/executor/droplet/prepare.ts:31–35: the spec requires Neovim presence and pins from the fetched base, matching the archive installed at key.base. These reads instead inspect the caller's working tree. With origin/dev pinned, local deletion produces a pinless key and skips installation despite pinned archived source; local addition/edit selects a pin absent/different at the archived base. No guard enforces equality. The new malformed-pin cases themselves read uncommitted local inputs. Read and validate both optional files at the fetched base and add base-versus-worktree add/delete/edit controls. Implementer e0c11f88 confirms the conflict and will update the prior local-staleness test to commit/push the base change.

Other requested mechanics are present: optional lock presence uses a successful base tree listing before reading committed bytes; four-part construction retains node/nvim/lock/base property order and unchanged hashing; sameKey handles absent parts; staleParts compares absence as none; snapshots permit missing nvim; provisioning guards the Neovim block; delivery omits absent lock/pin checks; status renders absent parts as none. C3's literal pre-change golden is 7599b8d463c5, and A-5813 reports actual repository old/new hash equality at 4fa9e2604180. Those compatibility checks do not resolve M1's source selection issue.

A-5813 reports host lint/typechecks/shell syntax green and targeted prepare-key 2/2, executor-prepare 5/5, prepare-component 9/9 and prepare-retry green. The existing unconditional npm-ci preparation stage is explicitly retained at the T-670 boundary; this review does not claim a real arbitrary-stack machine build from the permissive scripted transport.

Result: not clear; C1/C2/C4 fail on base-input consistency and fixture ownership. C3 is source-supported but remains unverified in this not-clear pass. No verification at this head. Corrections require a new committed head and fresh source review before one mode-free task verification; no generic dev merge or per-item QA.

Findings: Standards 1 medium, 1 low; Spec 1 medium.

Evidence: A-5815.

Criteria: C1 failed (Pinless/native preparation proof needs cancellation-owned Git and reliable provider cleanup.), C2 failed (Neovim installation inputs must follow fetched base, not local pin additions/deletions/edits.), C4 failed (Snapshot freshness/delivery must use base-consistent pins; fixture ownership remains incomplete.).

### rev-31 · 2026-10-19T06:21:19.983Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261019-669-source-2
commit: f6711ece3d0ded73e845d4d3364cffe11d87ebfc
scope: full
findings: [{"severity":"medium","text":"Git close joins remain unbounded, and native prepareKey/delivery work lacks a fixture drainage owner; cancellation can hang cleanup or race directory removal.","file":"hub/test/executor-prepare.test.ts","line":25}]
finding_counts: {"high":0,"medium":1,"low":0}

# T-669 correction source review: not clear

Head: f6711ece3d0ded73e845d4d3364cffe11d87ebfc
Fixed base: 1e7600b3ea978fa99e767e34710470d7d9cb558f
Correction comparison: 53f08efe to reviewed head. Scope: full; no dev merge.

## Standards

M2 remains (medium), hub/test/executor-prepare.test.ts:25–34. ownedGit now immediately owns its child and connects timeout/cancellation, but both the pre-directory Promise.allSettled(pending) and finally await closed are unbounded. The execFile timeout uses SIGTERM and is not a deadline on close when inherited pipes remain open. The directly awaited native prepareKey and DropletRun.deliver operations also launch internal Git children outside ownedGit and have no outer fixture drainage scope. Normal green execution does not establish safe cancellation/removal.

Use the established bounded native-operation ownership/drainage scope, with named stop/close observations; retain unfinished work/root ownership rather than deleting below a still-running continuation. Implementer 2367e286 confirms these joins are unbounded and will use the repository's caseDeadlines scope for helper close and native prepareKey/delivery work, including SIGKILL for Git timeout/abort. Review that changed head before verification.

L1 is resolved: fake provider cleanup is registered immediately after creation, before hub startup, with a default no-op stop owner and try/finally always attempting api.close. The prior API state-root retention gap is no longer present. Scripted mode remains process-free.

## Spec

M1 is resolved. Optional Neovim paths use successful ls-tree presence checks and show reads at the captured fetched base SHA, matching the snapshot archive. Local-addition control now leaves a pinless base pinless; local edits/deletion leave a pinned base unchanged. Incomplete and invalid pins are committed before rejection checks. Existing pin-staleness proof now commits/pushes the changed base and checks base|nvim staleness, restoring/staging that pin for the next lock commit.

C2/C3 behavior is source-supported: guarded builder block, required Node, optional lock, none/current status, conditional delivery checks, and four-part serialization/hash compatibility remain unchanged. A-5816 reports corrected host validation and the retained T-670 boundary. No actual arbitrary-stack npm-ci build is claimed.

Result: not clear solely on fixture drainage; fail C1/C4. C2/C3 remain unverified in this pass. No verification at this head; fresh source review of the corrected committed head first. No per-item QA or generic dev merge.

Findings: Standards 1 medium; Spec 0 remaining.

Evidence: A-5818.

Criteria: C1 failed (Native preparation fixture still has unbounded close joins and no outer drain for product Git work.), C4 failed (Native delivery continuation needs an owned drainage boundary before fixture removal.).

### rev-31 · 2026-10-19T06:23:14.775Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261019-669-source-3
commit: ba8e3a4643569098711dab6515bc82a6747942ab
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

# T-669 corrected source review: clear

Head: ba8e3a4643569098711dab6515bc82a6747942ab
Fixed base: 1e7600b3ea978fa99e767e34710470d7d9cb558f
Corrections: 53f08efe → f6711ece → reviewed head.
Scope: full. No dev merge after first review.

## Standards

Clear; no remaining findings. The three affected native flows install caseDeadlines before creating fixtures and keep the full native operation, including prepareKey, delivery and startup, owned until it settles. The fixture proxy delays cleanup registration execution behind pending operations. Named bounded Git-close/drain waits retain the underlying work, and helper children are owned immediately with 30 s execFile deadlines, test/cleanup cancellation and SIGKILL. Failed drainage retains fixture ownership for worker recovery rather than treating a timeout as cancellation/completion. This resolves A-5818's remaining M2 without expanding production APIs.

I read the existing case-deadlines implementation and its controlled held-startup/held-teardown tests. Their owner preserves the root until late startup ownership and stop receipts settle; A-5819 reports both controls 2/2 green. This is reuse of that tested boundary, not a new claim that deadline expiry itself stops native work.

Provider cleanup is registered immediately after allocation, before hub startup, and finally attempts api.close after any hub-stop outcome. The earlier low finding is resolved. No new allowance, baseline rewrite or generic resource exemption is added. Pure key comparisons stay T1; native Git/CLI contracts stay in the existing T3 file with a named lifecycle/native-boundary header. Scripted provider/machine work shares FakeClock and product-requested delay admission.

## Spec

Clear; the base-input finding is resolved. Neovim path presence and content now come from successful ls-tree/show calls at the captured fetched base SHA, matching the archived builder source. Local addition cannot introduce pins into a pinless base; local edit/deletion cannot change committed pins. Committed incomplete/malformed pins reject. The prior pinned-snapshot staleness contract now commits/pushes the changed pin and retains replacement/reuse assertions.

C1: optional Neovim and lock fields are omitted from the persisted key when absent at base; Node and base remain required. The native pinless CLI contract drives scripted provider preparation, persisted snapshot reads and reuse.
C2: Node and apt provisioning remain; an empty substituted NVIM_VERSION guards all Neovim download/check/extract/link commands. Pinned user-data assertions retain the existing install path.
C3: four-part construction preserves node/nvim/lock/base serialization order and keyHash's unchanged JSON SHA-256 algorithm. T1 pins the recorded pre-change golden 7599b8d463c5; A-5813's actual clean-repository comparison reports unchanged 4fa9e2604180. sameKey and staleParts cover adding/removing optional parts; readSnapshot accepts absence.
C4: absent snapshot parts omit their delivery check/output blocks; status renders none and current rather than false staleness. The native delivery contract captures the production delivery command, asserts those checks absent, and completes through the scripted executor; the existing pinned path remains covered.

Validation attribution: A-5819 reports executor-prepare 5/5 ordinary cases in 10.23 s, existing case-deadlines 2/2 in 0.36 s, and host typecheck/lint green. A-5813/A-5816 retain pure-key, component/retry, compatibility and red/green base controls. These are host/controlled receipts, not post-source Linux evidence or five whole-file repetitions. The queued task protocol runs T0–T2; native T3 coverage belongs to the later merge batch. No arbitrary-stack real machine/npm-ci build is claimed: the existing unconditional prepare install block remains explicitly for T-670 to replace.

Result: clear source for one configured mode-free exact-head task verification. C1–C4 remain unverified until that receipt is audited with the retained targeted native evidence. No full task suite or per-item QA request. Any head change requires fresh source review.

Findings: Standards 0; Spec 0.

Evidence: A-5822.

### rev-31 · 2026-10-19T06:42:36.122Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261019-669-final
commit: ba8e3a4643569098711dab6515bc82a6747942ab
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

# T-669 final evidence review: clear

Head: ba8e3a4643569098711dab6515bc82a6747942ab, unchanged from source-3 / A-5822.
Run: 42ec3216-1705-41cb-9099-275b7a2b3c86 / A-5834, raw exit 0.
Scope: evidence. Branch tip and task receipt independently match; C1–C4 are claimant-done.

## Standards

Clear; no task-owned finding remains. The two new prepare-key T1 cases positively pass at 0.002500581 s and 0.000468693 s and each passes 5/5 fresh load repetitions. All nine existing executor-prepare-component cases, the prepare-retry case and both controlled case-deadlines ownership cases pass. The latter two also pass 5/5 repetitions. No owned budget overrun, runtime tier mismatch, skip, quarantine or cleanup failure is reported. The three ordinary phase failure arrays are empty; all 389 reported load-gate identities pass 5/5.

External report-only debt remains: budget overages and 52 missing baselines are disclosed in A-5834. Five runtime tier mismatches are outside this change: three known T-803 suite-close-component identities plus two suite-soak-component nightly identities. I reported the latter as Bugs / S for lead/Coordinator deduplication; Implementer 4fdd49bf confirms forwarding. This is not a global zero-debt verdict.

## Spec

Verify C1–C4 with source-3, retained native host evidence A-5813/A-5816/A-5819 and this exact-head task gate:
- C1: the native pinless CLI fixture reports successful scripted-provider snapshot preparation and reuse with absent nvim/lock. Source now derives project pin inputs from the same fetched base it archives.
- C2: recorded user-data assertions retain required Node/apt installation and guarded optional Neovim installation; pinned projects retain their install path.
- C3: exact-head Linux T1 golden and optional-comparison cases pass ordinarily and 5/5. Four-part serialization/hash compatibility is preserved; the retained real-repository comparison is separately attributed to host evidence.
- C4: the native host fixture captures the real delivery command, confirms absent lock/Neovim checks/output, completes the scripted executor run, and observes current/none status. The existing pinned replacement/reuse contract remains green. Fixture drainage and reliable provider cleanup are source-reviewed and supported by the exact-head component drainage controls.

Execution limits: the task protocol ran T0–T2, including Neovim T1/T2. The T3 executor-prepare.test.ts file did not execute in A-5834; A-5819 reports its five ordinary host cases green at the final source. No Linux native-T3 execution or five host file repetitions is claimed. That integration coverage remains for the landing merge batch. The existing unconditional npm-ci preparation stage remains explicitly T-670's replacement work; the permissive scripted transport is not evidence of a real arbitrary-stack machine build.

Ordinary result: 1469 tests, 1469 pass, zero failure/cancellation/skip/TODO (374 whole-T1 phase, 863 hub component phase, 232 Neovim phase). Host check passes. Suite 918.05 s, load-gate extra wall 561.93 s, peak load 7.15. Linux x64 c-8 lon1, workers 2, Node 24.21.0, Neovim 0.12.5; lifetime 1014 s, cost $0.0704. Task report keeps T3 deferred; reported ratchet 2651.501 s equals base, with incomplete timings separately disclosed.

Result: final clear; C1–C4 verified. No additional task verification or per-item QA. Merge-batch integration and T-670 remain separate outstanding work.

Findings: Standards 0; Spec 0.

Evidence: A-5837.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified.
