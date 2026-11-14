# hub/test/skills-onboarding.test.ts

The source-only tour checks require ten numbered stages, one final "Look now"
per stage, remote control ninth and agent hosts tenth. The skill offers ten stages.
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

The remote tour stage names voice notes and the hidden speech key command; the
existing command vocabulary guard validates the command against shipped help.

T-1832: `the onboarding tour has ten stages ending with Look now` covers C1–C3:
ten ordered headings, exactly one final Look now per stage, the unchanged ninth
Remotes ending, and the tenth Hosts ending. It checks both workbenches, the web
hosts view, all three literal waiting-reason templates, Create one?, login add,
setup and manual config guidance, then applies the command check to stage ten.
`onboarding names only shipped commands or explicitly pending release work`
also checks the whole tour against exported CLI usage and configKeys; retain
the command check's negative controls. No real provider or browser is involved.

Run `node --test hub/test/skills-onboarding.test.ts` for this T2 file, or use
`--test-name-pattern='the onboarding tour has ten stages'` before the path for
the source-only case. Existing component cases own disposable roots through
tempProject/projectHub and shared sealed child environments. No native host
fixture or preservation lock is needed. Stage QA should read stage ten against
`hub/src/host/scheduler.ts`, `hub/src/host/login-cards.ts`, CLI usage/login.ts,
both workbenches' Hosts components and docs/hub/cland-setup.md. The three reason
templates preserve the hub's bytes with <harness>/<id> standing for interpolation;
the claude-code example preserves the actual harness spelling. This is source
coverage of teaching text; live Hosts interactions are the epic's stage QA.
E-616 and E-1313 executable replay guidance now uses ten stages and E-1313's
remote-stage read stops before stage ten; their original release criteria and
recorded receipts retain historical wording.
