# hub/test/skills-onboarding.test.ts

The six onboarding configuration/import CLI cases establish an owned Aide
spoke, await its credential-ready round trip, then pass only session ID/name
to the raw CLI. They exercise the real fallback file and must not use the
synthetic session-credential fixture helper. A role assignment plus a name
alone is not a complete shell fixture. Fresh native-launch environment and
pre-spoke first-CLI attribution are covered in cli-session-credential.test.ts.
Retain every config/crew/role/import readback and own-launch-note assertion.
