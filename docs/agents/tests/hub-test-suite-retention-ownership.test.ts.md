# hub/test/suite-retention-ownership.test.ts

The retention-only fixture transfers root deletion to its settlement owner.
The regression rejects a live writer's resource close through the real cleanup
path, attempts independent cleanup, and separately observes retained root bytes,
the blocked owned-root remover, and the installed native guard/filesystem seam.
A later positive writer close permits native root removal and guard restoration.
The shared guard's counted callback/custom/sync/prototype controls stay installed
through the failure and repair. No helper-wide migration or live fixture is used.
