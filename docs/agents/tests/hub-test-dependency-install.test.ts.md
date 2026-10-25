# hub/test/dependency-install.test.ts

T-1251: T1 manifest-content comparisons cover all six install fields, scripts/version/metadata-only edits, lockfiles, and conservative missing/malformed reads without a hub or child process. `merge-queue-unit.test.ts` checks candidate preparation and persistence, including an independent dependency update on dev. `merge-queue.test.ts` checks public queue frames and CLI text; `merge-recovery.test.ts` checks landing results, durable comments and Agents notices. No dependency installation runs.
