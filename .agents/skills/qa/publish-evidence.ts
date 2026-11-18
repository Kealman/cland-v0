/** Copied with the QA kit. Resolve the installed package without launching cland. */
import { realpath, access } from 'node:fs/promises';
import { delimiter, dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';

export async function loadEvidencePublisher(searchPath = process.env.PATH ?? ''): Promise<{
  publishSessionEvidence: (args: Parameters<typeof publishSessionEvidence>[0]) => Promise<unknown>;
  publishEvidence: unknown;
}> {
  for (const directory of searchPath.split(delimiter).filter(Boolean)) {
    let entry: string;
    try { entry = await realpath(join(directory, 'cland')); } catch { continue; }
    const candidates = [
      ...(entry.endsWith('/hub/bin/cland.ts') ? [join(dirname(dirname(dirname(entry))), 'hub/src/evidence-publish.ts')] : []),
      // Homebrew write_env_script lives in <prefix>/bin beside <prefix>/libexec.
      // Inspect the installed layout; never parse or execute the shell wrapper.
      join(dirname(entry), '../libexec/hub/src/evidence-publish.ts'),
    ];
    for (const module of candidates) {
      try { await access(module); } catch { continue; }
      return import(pathToFileURL(module).href);
    }
  }
  throw new Error('Evidence helper unavailable: put the installed cland hub/bin/cland.ts entry on PATH and update cland.');
}

/** The installed helper keeps ownership of the scan and session artifact.create. */
export async function publishSessionEvidence(args: {path: string; title: string; kind: string; topic: string; retryKey?: string}): Promise<unknown> {
  const publisher = await loadEvidencePublisher();
  return publisher.publishSessionEvidence(args);
}
