import { processIdentities } from '../src/process-identity.ts';

/** Native adapter kept outside the fake-clock observer's T1 import graph. */
export function crashProcess(pid: number) {
  return {
    signalZero: () => { process.kill(pid, 0); },
    exited: () => {
      let exited = false;
      processIdentities([pid], undefined, found => { exited ||= found === pid; });
      return exited;
    },
  };
}
