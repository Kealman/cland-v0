import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import type { stageCase } from './stage-case-fixture.ts';
import { fixtureEnvironment } from './fixture-environment.ts';
import { testSetupWaitMs } from './until.ts';
import type { LintExit } from '../src/test-lint-worker-runner.ts';

/** Parent closure alone never permits fixture-root removal. */
export function analysisParent(owner: ReturnType<typeof stageCase>, root: string, held = false) {
  const nested = Promise.withResolvers<LintExit>();
  const ready = Promise.withResolvers<number>();
  const result = Promise.withResolvers<{ files: number; heapSizeLimitBytes: number }>();
  const closeHeld = Promise.withResolvers<void>();
  const closed = Promise.withResolvers<void>();
  let parent: ReturnType<typeof execFile> | undefined;
  let receipt: { files: number; heapSizeLimitBytes: number } | undefined;
  let nestedClosed = false, parentClosed = false, refuseMissing = false, escalations = 0;
  let kill: ReturnType<typeof setTimeout> | undefined;
  let pending = '';
  const stop = () => { if (parent && !parentClosed) parent.kill('SIGTERM'); };
  owner.releaseOnClose(stop);
  owner.requireClose(async () => {
    stop();
    if (refuseMissing && !nestedClosed) throw new Error('nested child close receipt missing; root retained');
    await owner.wait('nested analysis native close receipt', () => nested.promise, testSetupWaitMs() * 2);
    if (!parentClosed) kill = setTimeout(() => { if (!parentClosed) { escalations++; parent?.kill('SIGKILL'); } }, testSetupWaitMs());
    try { await owner.wait('parent native close after nested close', () => closed.promise, testSetupWaitMs() * 2); }
    finally { clearTimeout(kill); }
  });
  parent = execFile(process.execPath, ['--import', fileURLToPath(new URL('./fixtures/lint-analysis-bootstrap.mjs', import.meta.url)),
    fileURLToPath(new URL('./fixtures/lint-analysis-parent.mjs', import.meta.url)), ...(held ? ['--hold-close-receipt'] : [])], {
    cwd: root, env: fixtureEnvironment(root, process.env, { NODE_OPTIONS: '--max-old-space-size=8192' }), maxBuffer: 64 * 1024,
  }, (error, _stdout, stderr) => {
    if (error) result.reject(new Error(`parent native failure: ${stderr}`, { cause: error }));
    else if (!nestedClosed || !receipt) result.reject(new Error('parent incomplete: missing result or nested close receipt'));
    else result.resolve(receipt);
  });
  parent.stdout!.on('data', data => {
    pending += String(data);
    if (pending.length > 64 * 1024) { stop(); return; }
    for (;;) {
      const end = pending.indexOf('\n'); if (end < 0) break;
      const line = pending.slice(0, end); pending = pending.slice(end + 1);
      try {
        const message = JSON.parse(line);
        if (message.type === 'started') ready.resolve(message.pid);
        else if (message.type === 'result') receipt = message;
        else if (message.type === 'close-held') closeHeld.resolve();
        else if (message.type === 'nested-closed') { nestedClosed = true; nested.resolve(message.exit); }
      } catch { result.reject(new Error('invalid parent receipt')); stop(); }
    }
  });
  parent.once('close', () => {
    parentClosed = true; closed.resolve();
    const error = new Error('parent exited before required child receipt');
    ready.reject(error); if (!nestedClosed) nested.reject(error); closeHeld.reject(error);
  });
  for (const promise of [ready.promise, nested.promise, result.promise, closeHeld.promise]) void promise.catch(() => {});
  return { ready: ready.promise, result: result.promise, held: closeHeld.promise, nested: nested.promise,
    release() { refuseMissing = false; if (!parentClosed) parent!.stdin!.end('release\n'); },
    refuseMissing() { refuseMissing = true; },
    state: () => ({ nestedClosed, parentClosed, escalations }) };
}
