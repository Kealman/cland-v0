---
id: T-1783
kind: task
title: The key store and `cland login add --kind key`
state: closed
status: done
size: M
criterion_seq: 6
labels:
  - ready-for-agent
assignee: null
parent: E-1535
blocked_by:
  - T-1773
topic: topic-1463
branch: t/T-1783-the-key-store-and-cland-login-add-kind
created: 2026-11-09T12:44:10.500Z
updated: 2026-11-10T09:02:06.993Z
closed: 2026-11-10T09:02:06.993Z
---

## Summary

`cland login add <harness> --kind key [--name] [--account]` reads the key from stdin or a hidden prompt, as `cland secret set` does. It stores the key AES-256-GCM in `.cland/auth/<login>.key` under the store key from the `[auth]` section of `.cland/secrets.toml`, which the strict secrets reader and `cland secret` learn. The CLI encrypts the key and never sends it in a frame; the hub records a `key` login row with no volume.

## What to build

The store key and the key files:
- **The store key.** `[auth] key` holds 32 random bytes in base64. The first key login writes it when it is absent. `cland secret list` shows only its fingerprint, and replacing it is refused while key logins exist.
- **A key file.** It holds a version, nonce, ciphertext and tag, authenticated with the project tag and the login name as associated data, at mode 0600 in a 0700 `.cland/auth/` that `.cland/.gitignore` ignores.
- **The row.** The `login.add` frame with `kind: key` carries the name, harness and account, never the key. Before writing the row, the hub decrypts the file in memory and registers the value with the redactor.

The harnesses allowed a key login follow question 4.

## Acceptance criteria

- [x] C1. A sentinel key piped into `cland login add opencode --kind key` is stored in `.cland/auth/<name>.key` as AES-256-GCM ciphertext that decrypts with the `[auth]` key, and the file holds no plaintext byte of it (test).
  - done: impl-1783 · 2026-11-10T07:52:13.028Z
  - verified: rev-36 [reviewer] · run rev-36-1783-final-1 · 2026-11-10T08:16:58.566Z · commit 5689ab7cfd7f6f46ff0ca661071980734a259ebe
- [x] C2. The hub starts with an `[auth]` section in `.cland/secrets.toml`, `cland secret list` shows only the auth key's fingerprint, and an unknown key in `[auth]` is refused (test).
  - done: impl-1783 · 2026-11-10T07:45:01.649Z
  - verified: rev-36 [reviewer] · run rev-36-1783-final-1 · 2026-11-10T08:16:58.566Z · commit 5689ab7cfd7f6f46ff0ca661071980734a259ebe
- [x] C3. The first key login writes an `[auth]` key when none exists, and a second key login reuses it (test).
  - done: impl-1783 · 2026-11-10T07:52:13.185Z
  - verified: rev-36 [reviewer] · run rev-36-1783-final-1 · 2026-11-10T08:16:58.566Z · commit 5689ab7cfd7f6f46ff0ca661071980734a259ebe
- [x] C4. The `login.add` frame, the CLI's argv, the hub log, the journal and `hub.db` hold no byte of the sentinel key (test).
  - done: impl-1783 · 2026-11-10T07:45:03.324Z
  - verified: rev-36 [reviewer] · run rev-36-1783-final-1 · 2026-11-10T08:16:58.566Z · commit 5689ab7cfd7f6f46ff0ca661071980734a259ebe
- [x] C5. A key passed as an argument is refused naming stdin, and a ciphertext altered by one byte fails to decrypt with a refusal that names the login and not the key (test).
  - done: impl-1783 · 2026-11-10T07:45:03.524Z
  - verified: rev-36 [reviewer] · run rev-36-1783-final-1 · 2026-11-10T08:16:58.566Z · commit 5689ab7cfd7f6f46ff0ca661071980734a259ebe
- [x] C6. `.cland/auth/` is ignored by Git, and a key file or `.cland/auth` that is a symlink is refused (test).
  - done: impl-1783 · 2026-11-10T07:45:03.898Z
  - verified: rev-36 [reviewer] · run rev-36-1783-final-1 · 2026-11-10T08:16:58.566Z · commit 5689ab7cfd7f6f46ff0ca661071980734a259ebe

## Blocked by

- T-1773

## Notes

- Hot files: `hub/src/remote/secrets.ts`, `hub/src/cli/secret.ts`, `hub/src/host/login-keys.ts` (new), `hub/src/cli/login.ts` (`add --kind key`), `hub/src/project.ts` (the ignore rule).
- Tests: new `hub/test/login-keys.test.ts` (T1 for the cipher, T2 for the CLI and frame); `hub/test/secrets.test.ts` (T1, new cases). Sentinel values only.
- Serves epic C5.

## Comments

### impl-1783 · 2026-11-10T05:11:20.139Z

Rule-20 pre-change sweep: shared suite transitive importer graph over every tier found 748 reached tests and 13 unknowns (treated reached); explicit searches cover SECRET_NAMES, SecretName, auth.key, readSecretsFile, setSecret/unsetSecret, login.list/login.add in production, shared wire, nvim/web, docs, skills and all test tiers. Consumers needing migration: secrets-resolution environment loop (auth has no env override), remote-docs site vocabulary, project-secrets docs, secret CLI help/list, setup readers (additive auth accepted, otherwise unaffected), gateway validation/redactor (register additional auth value), login-list compatibility unchanged. Full graph list will be attached as artifact. New login.add shape owned by T-1777; existing login.list untouched. TDD red: login-keys test fails ERR_MODULE_NOT_FOUND for new public key-store seam.

### rev-36 · 2026-11-10T05:21:04.519Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1783-source-1
commit: 00c10f61bde26afd36e4b20a52fd0e3518fb8b21
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Early MODULE source clear only; A-18258 records Standards/Spec review at00c10f61. No remaining findings after malformed-unused-auth repair correction. T2 is authorized by Coordinatorf006b8e5. C1–C6 remain unchecked/unverified: parser/help/frame integration belongs to T-1777 and is intentionally absent here, so no command/argv/frame/log/database acceptance claim or final runtime verdict. Follow Coordinatore50ea3f3: T-1777 lands first, then authorized dev merge, single additive key branches and fresh integrated source/delta review before configured verification. Local development tests/checks are author-reported, A-18251 consumer inventory is not execution coverage; no Reviewer test/probe run.

### impl-1783 · 2026-11-10T07:42:43.303Z

Authorized merge of origin/dev completed at 0ed8e6e80 after Coordinator instruction 3286ad1c. Conflict only tiers.json, resolved retaining both sorted test sets. Integration adds a single key branch in CLI and a single key branch in existing locally admitted hub login.add block, with helper imports; existing disk logic unchanged. Key path refuses non-OpenCode naming 0.4.x. Integration TDD red at CLI exit 1 'key login add is not available on this hub'; now connecting full C1-C6 coverage. Existing T-1777 frame shape unchanged, so no new wire schema/fixture generation required.

### rev-36 · 2026-11-10T07:50:29.675Z

verdict: review
result: not clear
by: rev-36 [reviewer]
run: rev-36-1783-delta-source-1
commit: b0597bf59ac53d027d85fea3328ab1ad32c8e846
scope: delta
findings: [{"severity":"low","text":"Introduction still says no network/child process, contradicting the new local Unix socket, CLI and Git integration case. Distinguish module-only cases from the real T2 boundaries.","file":"docs/agents/tests/hub-test-login-keys.test.ts.md","line":3},{"severity":"high","text":"Key helper reads stdin and writes auth.key/ciphertext before askHubFrame attaches the session actor and reaches local-human/users-role authority checks. Denied session commands can mutate credential-store files before refusal. Author confirms no preflight/exception. Authorize before input/storage and retain final add revalidation; add a no-input/no-files denied-preflight control.","file":"hub/src/cli/login.ts","line":22},{"severity":"medium","text":"Default opencode-N allocation checks only .key files, so an existing disk login can own that project name. CLI creates ciphertext then final add rejects duplicate, leaving an avoidable orphan. Author confirms unapproved. Reserve project row names plus retained files, reject known explicit collisions before input/storage and add disk/key coexistence regression.","file":"hub/src/cli/login-key.ts","line":19}]
finding_counts: {"high":1,"medium":1,"low":1}

Consolidated pinned-head review A-18305: Standards1low/Spec2(1high,1medium). Cleared module A-18258 remains unchanged; authorized merge0ed8e6e80 and additive branches reviewed. No wire change, no runtime criteria verified. New local producer reports are candidate/macOS only; configured verification unsubmitted. Correct all three, then fresh exact-head source review before mode-free verify. Newer replacement5689ab7 is a separate request, not covered by this not-clear verdict. Remaining T3/T4/after-stage QA separate.

Criteria: C1 failed (Key CLI writes project credential files before local-human authority refusal; existing disk names can also defeat unnamed key add.), C3 failed (Default names ignore disk login rows, so a later unnamed key login may create an orphan and fail instead of reusing the auth store key successfully.).

### rev-36 · 2026-11-10T07:52:04.317Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1783-delta-source-2
commit: 5689ab7cfd7f6f46ff0ca661071980734a259ebe
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected integrated source clear A-18306; Standards/Spec0 findings. login.list preflight now precedes helper/input/auth writes and supplies occupied project names; retained key files also reserve defaults, explicit known row collision refuses before input/storage; final add revalidates authority/uniqueness. Denied-preflight no-files and disk opencode-1→key opencode-2 controls added; guide process/socket description corrected. A-18258 module remains unchanged. No runtime criteria verified: refresh C1/C3 done after older-head failure, then submit mode-free verify at unchanged5689ab7. Inspect named outcomes/consumer completions and >=3s allowance condition from actual receipt. Local author-reported candidate evidence is not final Linux proof. Full remaining T3/T4/after-stage QA separate; no full task-head T3 run requested.

### rev-36 · 2026-11-10T08:16:58.566Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1783-final-1
commit: 5689ab7cfd7f6f46ff0ca661071980734a259ebe
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final evidence clear A-18317; C1–C6 verified at unchanged source-clear5689ab7. Independently read eight required new identities (six login-keys plus auth startup/list/unknown and malformed repair), each base+5 load passes. Integrated case2.987112217s is max across all new base/load receipts, below binding>=3s condition; 2s advisory remains report-only. A-18314 run5a4d7a33 exit0/5839pass/zero fail-cancel-skip-todo; T0/allT1/fallbackallT2/selectedT3/Web complete. Independently reconciled761 inventory paths:120T1+337T2+52Web+2T3 =511 passing base file finishes,250 remainingT3/T4 deferred. Selected fourT3 files32identities once, no repetitions. Linuxx64 kernel147 Node24.21/Nvim0.12.5, uncached verification treea45493bc, HeadlessShell1248/CfT156, skips[]/missing0 provenance retained. Source A-18306 applies; no new findings. Report-only advisories and earlier failed-head history preserved. Full remaining T3/batch,T4,after-stage QA separate; no further task run requested.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified.

### coord · 2026-11-10T09:02:06.993Z

Merged a6d28fd1e502c2d7a18b15e46721ad85520789fb onto dev.
