# hub/test/roles-snapshot.test.ts


T-1739: RolesFile.fresh observes exact parsed snapshots and roles-loaded pool defaults, preserves last-good identity after both forbidden role edits, and recovers on a valid edit. Run with `node --test hub/test/roles-snapshot.test.ts`; fixtures use disposable roots, no provider calls.

Pool-policy edits replace the file atomically before fresh(): an inode receipt distinguishes equal-size edits even if the filesystem timestamps share a tick. Keep the final error, last-good identity and recovery assertions.
