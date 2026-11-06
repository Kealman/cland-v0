# hub/test/host-prelude.test.ts

T1 tests call `renderPrelude({ hostKey, hostPublicKey, providerSteps })` with fixture keys. They check pinned key installation, the sshd drop-in, provider-contributed DigitalOcean automount removal, helper/sudoers installation and Codex's file credential store. The provider owns its trusted shell steps; the renderer does not select a provider or read hub credentials.

C3 sets sentinel environment values in-process and restores them in `finally`. Its scanner checks both values and assignments, with a planted positive control for every sentinel and name. No rendered script is executed and no provider API or browser is used.

Run `node --test hub/test/host-prelude.test.ts` with supported Node 24 and inherited `CLAND_*` removed. QA can repeat this file on the integrated stage head; no real host or credentials are prerequisites.
