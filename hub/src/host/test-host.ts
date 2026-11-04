import { fileOperations } from './agent/files.ts';
import type { Host } from './host.ts';
import type { LogFn } from '../log.ts';

/** Test-only remote: refuses native operations unless a double explicitly delegates local files. */
export function testHost(name: string, log: LogFn): Host {
  const record = (operation: string) => log({ event: 'test-host-operation', host: name, operation });
  const refuse = (operation: string): never => {
    record(operation);
    throw new Error(`test host ${name} refuses ${operation}`);
  };
  return {
    name,
    layout() { return refuse('layout'); },
    async writeFile() { return refuse('writeFile'); },
    async publishFile() { return refuse('publishFile'); },
    async appendFile() { return refuse('appendFile'); },
    async stat(path) {
      // Spread-based recording doubles opt into scratch files by these exact delegates.
      // Never infer local access from a host name or an arbitrary fileType response.
      if (this.fileType !== fileOperations.fileType || this.writeFile !== fileOperations.writeFile || this.removePath !== fileOperations.removePath) return refuse('stat');
      record('stat');
      return fileOperations.stat(path);
    },
    async makeDirectory() { return refuse('makeDirectory'); },
    async removePath() { return refuse('removePath'); },
    async freePort() { return refuse('freePort'); },
    async forward() { return refuse('forward'); },
    async unforward() { return refuse('unforward'); },
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
