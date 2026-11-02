# hub/test/executor-snapshot-confirmation.test.ts

T2 uses the scripted fake DigitalOcean API, disposable roots and fake clock.
Run `node --test hub/test/executor-snapshot-confirmation.test.ts` after disk/load
preflight. No browser, cloud resources or native transport runs.

Retirement and partial-image cleanup retain durable ownership across repeated
DELETE404/GET200 answers, reload records, hide IDs from catalogues and assert
four DELETE attempts before GET404 forgets ownership. Prepare's real lifecycle
uses scripted machine operations and retains its retirement record and replacement
pointer while the old image is readable. The existing executor-prepare.test.ts
(T3) and executor-prepare-component.test.ts (T2) remain unedited controls.
