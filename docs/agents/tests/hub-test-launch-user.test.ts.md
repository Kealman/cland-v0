# hub/test/launch-user.test.ts

T2: run `node --test hub/test/launch-user.test.ts`. Uses disposable projectHub,
fake adapters and fixture users; no native harness, provider or credential.

- `Agents start lines name the recorded launching user and accept legacy records`
  checks exact start text with and without attribution.
- `hub restart reads pre-attribution process and journal fixtures without a user`
  seeds the old SQL schema and a journal notice, restarts projectHub and reads
  session.list and Agents history. The fixture predates the new writer.
- `launch attribution follows authenticated humans in single mode` and
  `launch attribution follows authenticated humans in users mode` cover the
  authenticated second web user, local first user, forged frame field, real
  Coordinator spoke, CLI subprocess and persisted attribution after restart.
  session launch has no --as option; the CLI uses the first user.

The users case also stops and fresh-resumes the web session, requiring the same
session id, user id, projected display name and new launch journal entry. Its
web identity snapshot is read through `withFixtureStore`; that helper closes the
Store before the dependent peer exists and registers an idempotent shared
cleanup owner at allocation. `hub/test/fixture-store.test.ts` covers held setup
and early setup rejection, asserting producer completion before Store closure.
The spoke uses its harness-owned shared cleanup, without a standalone after hook.

Stage QA also runs `web/test/sessions.test.ts`, `nvim/test/sessions.test.ts`,
the recorded protocol fixture case in `nvim/test/scenarios/workbench.test.ts`,
and `hub/test/skills-onboarding.test.ts` (sessions page command vocabulary).
Use the native preservation slot for Neovim and CLI files. Web uses only its
isolated Headless Shell. Typecheck includes hub/shared wire conformance.
