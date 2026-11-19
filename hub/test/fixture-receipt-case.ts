// Narrow owner for the fake-Claude receipt recovery case and its rejection controls.
import fs from 'node:fs';
import type { TestContext } from 'node:test';
import { fixtureOwnership } from '../../shared/fixture-ownership.ts';
import { tempProject } from './harness.ts';
import { stageCase } from './stage-case-fixture.ts';

type Receipt = ReturnType<typeof fixtureOwnership>;
type Opened = { path: string; fd?: number; closed: boolean; removed: boolean; receipt: boolean; saves: number; owner?: Receipt };

export function fixtureReceiptCase(t: TestContext, sourceCheckout: string) {
  const sequence = stageCase(t);
  const opened: Opened[] = [], byFd = new Map<number, Opened>();
  const acquisitionErrors: unknown[] = [];
  const attempts: Array<{ errors: unknown[]; pending: Opened[] }> = [];
  const faults: { save?: Error; bind?: Error; close?: { fd: number; error: Error }; remove?: { path: string; error: Error } } = {};
  let acquiring = false;
  const open = fs.openSync, close = fs.closeSync, truncate = fs.ftruncateSync, unlink = fs.unlinkSync;

  // Enroll the registry before even acquiring the root or entering a constructor.
  // Each native open is captured before the constructor's first save or bind.
  sequence.requireClose(async () => {
    const errors: unknown[] = [];
    for (const entry of opened) {
      if (!entry.closed && entry.fd !== undefined) {
        try { if (entry.owner) entry.owner.close(); else fs.closeSync(entry.fd); }
        catch (error) { errors.push(error); }
      }
      // A rejected close retains the descriptor's metadata. Other receipts still settle.
      if (!entry.closed || !entry.receipt || entry.removed) continue;
      try {
        if (entry.owner) entry.owner.remove();
        else { try { fs.unlinkSync(entry.path); } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; } }
        try { fs.lstatSync(entry.path); throw new Error('receipt removal unconfirmed'); }
        catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
        entry.removed = true;
      } catch (error) { errors.push(error); }
    }
    const pending = opened.filter(entry => !entry.closed || entry.receipt && !entry.removed).map(entry => ({ ...entry }));
    attempts.push({ errors, pending });
    if (errors.length || pending.length) throw new AggregateError(errors, 'receipt disposal incomplete; root and native guard retained');
  });

  return { close: sequence.close, restore: sequence.restore, nativeBoundary: sequence.nativeBoundary,
    opened, attempts, acquisitionErrors, faults,
    run: (body: (c: {
      root: string;
      step: <T>(name: string, operation: () => Promise<T>) => Promise<T>;
      receipt: (pid: number, birth: number) => Receipt;
    }) => Promise<void>) => sequence.wait('whole receipt case', () => sequence.run(async admit => {
      const step = <T>(name: string, operation: () => Promise<T>) => admit(() => sequence.wait(name, operation));
      const root = await step('receipt root setup', async () => {
        const root = await tempProject(sequence.fixtures);
        sequence.adoptRoot(root);
        return root;
      });
      sequence.patch(fs, 'openSync', (...args: Parameters<typeof fs.openSync>) => {
        if (!acquiring) return open(...args);
        const entry: Opened = { path: String(args[0]), closed: true, removed: false, receipt: false, saves: 0 };
        opened.push(entry); // Cleanup slot exists even when native open rejects.
        const fd = open(...args);
        entry.fd = fd; entry.closed = false; byFd.set(fd, entry);
        return fd;
      });
      sequence.patch(fs, 'closeSync', (fd: number) => {
        const entry = byFd.get(fd);
        if (entry && !entry.closed && faults.close?.fd === fd) throw faults.close.error;
        close(fd);
        if (entry) entry.closed = true; // Positive native close receipt, not merely a settled promise.
      });
      sequence.patch(fs, 'ftruncateSync', (...args: Parameters<typeof fs.ftruncateSync>) => {
        const entry = byFd.get(args[0]);
        if (entry && !entry.closed) {
          entry.receipt = true; entry.saves++;
          if (entry.saves === 1 && faults.save) throw faults.save;
          if (entry.saves === 2 && faults.bind) throw faults.bind;
        }
        return truncate(...args);
      });
      sequence.patch(fs, 'unlinkSync', (path: fs.PathLike) => {
        if (faults.remove?.path === String(path)) throw faults.remove.error;
        unlink(path);
        const entry = opened.find(entry => entry.path === String(path));
        if (entry) entry.removed = true;
      });
      await body({ root, step, receipt: (pid, birth) => {
        acquiring = true;
        try {
          const receipt = fixtureOwnership([root], sourceCheckout);
          const entry = byFd.get(receipt.fd);
          if (!entry) throw new Error('receipt native open was not captured');
          entry.owner = receipt; entry.receipt = true;
          receipt.bind(pid, birth, birth);
          return receipt;
        } catch (error) {
          for (const entry of opened) if (!entry.closed) entry.receipt = true;
          acquisitionErrors.push(error);
          throw error;
        } finally { acquiring = false; }
      } });
    })),
  };
}
