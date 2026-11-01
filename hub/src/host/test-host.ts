import type { Host } from './host.ts';
import type { LogFn } from '../log.ts';

/** Test-only remote: never runs commands, touches files or signals native PIDs. */
export function testHost(name: string, log: LogFn): Host {
  const record = (operation: string) => log({ event: 'test-host-operation', host: name, operation });
  const refuse = (operation: string): never => {
    record(operation);
    throw new Error(`test host ${name} refuses ${operation}`);
  };
  return {
    name,
    get limitPolls() { record('limitPolls'); return false; },
    async spawn() { return refuse('spawn'); },
    async run() { return refuse('run'); },
    async identity(pid) { record('identity'); return { pid, pidStarted: null, pidIdentity: `linux:test-${name}:${pid}` }; },
    async alive() { record('alive'); return false; },
    async stop() { record('stop'); return false; },
    async processes() { record('processes'); return []; },
    async statDirectory() { return refuse('statDirectory'); },
    async realpath() { return refuse('realpath'); },
    async fileType() { return refuse('fileType'); },
    async readFile() { return refuse('readFile'); },
    async listFolder() { return refuse('listFolder'); },
    async worktreeAdd() { return refuse('worktreeAdd'); },
    async worktreeRemove() { return refuse('worktreeRemove'); },
    async occupants() { return refuse('occupants'); },
  };
}
