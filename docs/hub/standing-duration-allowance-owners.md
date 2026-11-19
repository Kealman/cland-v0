## Standing duration allowance owners

`npm run test:tiers` and verification/merge manifest admission accept categories
and epics directly under a category as standing owners. They refuse tasks,
release delivery epics and other nonstanding owners, naming the allowance key,
source line when available, and a standing ancestor or E-880 as an example.
Generated allowance stanzas select the nearest admitted standing ancestor through
`isStandingDurationOwner`. With no admitted ancestor they use the manifest's
`budget.legacyOwner` (E-677 when omitted), after validating its tracker facts by
the same policy. Missing or invalid fallback owners produce a diagnostic naming
the standing-container rule. Generated expiry remains seven days even for a
legacy owner whose admission permits a longer span. Existing
E-880 allowances and their legacy-owner budget remain unchanged. This extends
the existing owner refusal; it is independent of the duration budget's report
or enforce mode. Missing manifests and older callers without owner records keep
their existing behavior. No role permission changes are needed.

### Build guard tier inventory (report mode)

`npm run test:static` runs `node hub/test/lint-build-guard-tiers.ts` to report
build/prebuild/postbuild guards with no verify-tier execution path. It follows
npm aliases and eager local value imports from tier entries, including the T1
wrapper for both site guards. Findings and incomplete shell inventory never
change exit status. No commands execute. See
[the guard guide](../agents/tests/hub-test-build-guard-tiers.test.ts.md) for
supported syntax, build implementation findings and manual review boundaries.

