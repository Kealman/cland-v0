# hub/test/skills-onboarding.test.ts

The source-only tour checks require nine numbered stages, one final "Look now"
per stage, and remote control last. The skill offers the same nine stages.
Command examples use the exported CLI help and config key registry; secret
set/unset operands and standalone `telegram.*`, `discord.*` and `speech.*`
names use the canonical `SECRET_NAMES` registry shared with `cland secret`.
Keep the negative controls for unknown commands, config keys, secret operands
and misspelled standalone secret names. These checks need no platform or token.

The six onboarding configuration/import CLI cases establish an owned Aide
spoke, await its credential-ready round trip, then pass only session ID/name
to the raw CLI. They exercise the real fallback file and must not use the
synthetic session-credential fixture helper. A role assignment plus a name
alone is not a complete shell fixture. Fresh native-launch environment and
pre-spoke first-CLI attribution are covered in cli-session-credential.test.ts.
Retain every config/crew/role/import readback and own-launch-note assertion.
