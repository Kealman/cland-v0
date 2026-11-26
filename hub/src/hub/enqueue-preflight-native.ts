import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { prepareMergeBatch, checkoutMergeBatch, removeMergeBatch } from './merge-batch-territory.ts';
import type { BatchCandidate } from './merge-batches.ts';
import type { MergeQueueEntry } from '../protocol.ts';
import type { EnqueuePreflight, EnqueueCheck } from './enqueue-preflight.ts';
import { committedTreeOrThrow } from '../verification-tree.ts';
import { verificationCommands } from '../verification-commands.ts';
import { suiteCommand, SuiteCommandFailure, commandFailure, type SuiteCommandClosure } from '../suite-command.ts';
import { fixtureEnvironment, scratchGitEnvironment } from '../../../test-support/fixture-environment.ts';
import { ProtectedCommandCapture, protectedCommandText } from '../suite-command-output.ts';
import { beginCandidateCommand } from '../batch-candidate-ownership.ts';
import { EnqueueNativeIncomplete, EnqueueFailure, ENQUEUE_CHECK_SKIPPED } from './enqueue-preflight.ts';
import { MergeError } from '../merge.ts';

export type EnqueueCandidate = BatchCandidate & { taskHead: string; baseTree: string };
export type EnqueueBackend = EnqueuePreflight<EnqueueCandidate> & { identity(head: string): Promise<string> };
const services = { prepareMergeBatch, checkoutMergeBatch, removeMergeBatch, committedTreeOrThrow, verificationCommands, suiteCommand, beginCandidateCommand,
  forward: (text: string) => { if (text) process.stderr.write(text + '\n'); } };

/** The checkout and command lifecycle reuse batch ownership and the suite supervisor. */
export function enqueuePreflight(root: string, entry: () => Promise<{ member: MergeQueueEntry; base: string }>, env: NodeJS.ProcessEnv, native = services, now = () => performance.now()): EnqueueBackend {
  return {
    identity: head => native.committedTreeOrThrow(root, head, env),
    async prepare() {
      const { member, base } = await entry();
      const candidate = await native.prepareMergeBatch(root, `enqueue-${randomUUID()}`, [member], env, undefined, base);
      return { ...candidate, taskHead: member.head, baseTree: await native.committedTreeOrThrow(root, base, env) };
    },
    async check(candidate): Promise<EnqueueCheck> {
      await native.checkoutMergeBatch(root, candidate, env);
      const command = (await native.verificationCommands(candidate.cwd, root, env, { requireTest: false, enqueue: true })).check;
      if (!command) return { command: null, code: null, tail: '', skipped: ENQUEUE_CHECK_SKIPPED };
      const capture = new ProtectedCommandCapture();
      if (!candidate.owner) throw new Error('candidate command environment requires checkout ownership');
      // Git removes this candidate-owned metadata only through guarded worktree
      // removal. Account/cache writes never dirty the checkout, and an unclosed
      // command retains its environment together with the candidate.
      const environmentRoot = join(candidate.owner.gitdir, 'enqueue-environment');
      const executionEnv = scratchGitEnvironment(environmentRoot, fixtureEnvironment(environmentRoot, env), { excludesFile: join(environmentRoot, 'gitignore') });
      delete executionEnv.NODE_TEST_CONTEXT;
      delete executionEnv.CLAND_SUITE_LEASE;
      const fence = await native.beginCandidateCommand(candidate);
      const unknown = (): SuiteCommandClosure => ({ state: 'incomplete', pid: null, birth: null, captured: [], unverified: [], nativeClose: null, reason: 'native-tree-unverified', whenClosed: new Promise(() => {}) });
      const retain = async (closure: SuiteCommandClosure, primary: Error): Promise<never> => {
        try { await fence.retain(closure); }
        catch (secondary) { primary = new EnqueueFailure(primary, 'retained command checkpoint failed', [secondary]); }
        const settled = closure.state === 'closed' ? Promise.resolve() : closure.whenClosed.then(receipt => fence.complete(receipt)).then(() => native.removeMergeBatch(root, candidate, env));
        throw new EnqueueNativeIncomplete(candidate.cwd, primary, settled);
      };
      let result;
      const started = now();
      try {
        result = await native.suiteCommand(command, candidate.cwd, executionEnv, undefined, undefined, { forward: false, requireClosure: true, observe: chunk => capture.write(chunk) });
      } catch (error) {
        const closure = error instanceof SuiteCommandFailure ? error.closure : unknown();
        const primary = new EnqueueFailure(error, `${command}: command failed`);
        if (closure.state !== 'closed') return retain(closure, primary);
        try { await fence.complete(closure); }
        catch (secondary) { throw new EnqueueFailure(error, `${command}: command failed; closure checkpoint failed`, [secondary]); }
        throw primary;
      }
      const tail = capture.finish(result.cause);
      const closure = result.closure ?? unknown();
      const facts = commandFailure(result);
      const primary = facts ? new EnqueueFailure(new SuiteCommandFailure(facts.primary, closure, facts.secondary, result.cause), `${command}: exit ${result.code}`)
        : new MergeError('merge-test-lint', `${command}: exit ${result.code}\n${tail}`);
      if (closure.state !== 'closed') return retain(closure, primary);
      try { await fence.complete(closure); }
      catch (secondary) { throw result.code === 0 ? new EnqueueFailure(secondary, `${command}: closure checkpoint failed`)
        : new EnqueueFailure(primary, `${command}: exit ${result.code}; closure checkpoint failed`, [secondary]); }
      try { native.forward(tail); } catch { /* a protected publication failure cannot rewrite the native outcome */ }
      if (facts && result.code !== 0) throw primary;
      return { command, code: result.code, tail, summary: protectedCommandText(`preflight check: ${command}; exit ${result.code}; duration ${(now() - started) / 1000} s`) };
    },
    remove: candidate => native.removeMergeBatch(root, candidate, env),
  };
}
