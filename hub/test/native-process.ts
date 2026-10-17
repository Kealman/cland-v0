// Native prerequisite for T3 lifecycle tests only; generic T2 fixtures must not import it.
import { processStarted } from '../src/hub/lock.ts';

/**
 * A test option for the tests that need a process's start time, which is how the hub knows a pid is still the
 * process it started before it signals it: `{ skip: NO_PS }`. `ps` is setuid, and a sandbox that refuses setuid
 * binaries (Codex's seatbelt, where a sandboxed session runs this suite) leaves the hub unable to stop anything.
 */
export const NO_PS: string | false = processStarted(process.pid) === null ? 'needs `ps` for pid identity, and this sandbox refuses it' : false;

