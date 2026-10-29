# hub/test/skills-qa.test.ts

`hub/test/skills-qa.test.ts` is T2: `qa-record.sh` is the CLI subject and the scripted headless fixture supplies native output. Demo regressions return envelopes from scratch files, preserving fake credentials outside argv. They read the exact durable runs.jsonl receipt and copied files, and observe the cleanup acknowledgement after successful publication. Unsafe second captures must leave no partial local files or cleanup acknowledgement. Legacy no-manifest and complete false/zero facts retain PASS.

All shell children run from disposable roots through `fixtureEnvironment` after the last overlay. The build-stamp regression seeds only repository directories and a known ref through filesystem writes; the recorder CLI reads that ref through Git. No native Git setup runs in T2. No real hub process, provider or browser is needed for these demo-policy checks; the existing T3 demo contract retains those responsibilities.

The sidecar regression executes the actual remote envelope script through the fake demo transport and a scripted native CLI. It proves a native case can supply facts without extending the headless wire shape, and that a caught step error in the sidecar blocks PASS. Every nested child rebuilds the sealed environment after its overlay.

Escaped JSON metadata/stderr controls use opaque fake bearer values separated by tab/newline. Each of the five runs (four controls — tab or newline, carried by parsed metadata or by stderr — and the safe positive) is one sealed recorder child on its own disposable root, and all five start together and settle before the assertions run, so the case's wall time fits the 2 s T2 per-test budget (T-1266) while every assertion stays as it was. Each control requires a value-free BLOCKED receipt before any safe capture is copied or cleanup is acknowledged, while safe escaped whitespace still publishes. T2 remains the right tier: `qa-record.sh` is the CLI subject with a scripted headless fixture, so the case runs its five children at once instead of deferring to the 10 s T3 budget. Run this file with the standard tier bootstrap in enforce mode to check the T2 boundary; retain the existing test-docs heading/index guard.

The unsupported-Node regression puts a synthetic `node --version` on PATH in a
sealed disposable root. Both `run` and `note` must refuse with running/required
versions and no durable receipt. The existing supported-runtime note and run
cases remain positive controls. No real alternate Node installation is used.

Copied-skill regressions run the actual `provisionSkills` output with absent,
engine-less and conflicting host manifests. Each checks the provisioned engine
contract against cland's root `engines.node`, supported `run`/`note` PASS receipts
and unsupported-version refusal with no additional receipts. The companion
`node-engines.json` travels as a regular managed skill file in init/update and
release packaging; keep it aligned when cland's engine range changes.
