import { join } from 'node:path';
import type { RemoteDiscovery } from '../../../shared/project-discovery.ts';
import { VERSION } from '../version.ts';
import type { AgentClient } from './agent-client.ts';

/** Stable host-local endpoints; no project bearer or hub process identity crosses this boundary. */
export function remoteDiscovery(runDirectory: string, secret: string): RemoteDiscovery {
  return {remote:true, socket:join(runDirectory,'hub.sock'), spoke:`ws+unix:${join(runDirectory,'spoke.sock')}:/`, secret, version:VERSION};
}

/** Reconnect preserves identical bytes; changed credentials publish as complete private bytes. */
export async function publishRemoteDiscovery(client: Pick<AgentClient, 'request'>, file: string, discovery: RemoteDiscovery, signal?: AbortSignal): Promise<void> {
  signal?.throwIfAborted();
  const bytes = Buffer.from(JSON.stringify(discovery,null,2)+'\n');
  let current: Buffer | undefined;
  try { current = Buffer.from(await client.request('readFile',{path:file}) as string,'base64'); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  signal?.throwIfAborted();
  if (current?.equals(bytes)) return;
  try {
    await client.request('publishFile',{path:file,bytes:bytes.toString('base64'),options:{mode:0o600,replace:true}});
  } catch (error) {
    if (/outcome unknown|agent closed/.test(error instanceof Error ? error.message : '')) {
      // A second request on this serial stream is a positive boundary after the
      // admitted write. Stream loss or another timeout cannot release its owner.
      try { await client.request('readFile',{path:file}); }
      catch { await new Promise<never>(() => {}); }
    }
    throw error;
  }
}
