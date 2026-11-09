// The private fixture socket controls only its owning holder; receipts never authorize PID signals.
import { statSync } from 'node:fs';
import { connect } from 'node:net';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { until, testWaitMs } from '../until.ts';

export type HolderReceipt = { pid: number; cwd: string; file: string; inode: number };
export const holderSocket = (home: string): string => join(home, 'holder.sock');
export async function holderRequest(home: string, command: 'status' | 'stop' | 'crash'): Promise<HolderReceipt | null> {
  const nonce = randomUUID();
  return new Promise((resolve, reject) => {
    const socket = connect(holderSocket(home));
    let bytes = '';
    const timer = setTimeout(() => socket.destroy(new Error(`holder ${command} incomplete`)), testWaitMs());
    socket.on('connect', () => socket.end(JSON.stringify({ nonce, command }) + '\n'));
    socket.on('data', chunk => { bytes += chunk; });
    socket.on('error', (error: NodeJS.ErrnoException) => {
      clearTimeout(timer);
      if (error.code === 'ENOENT' || error.code === 'ECONNREFUSED') resolve(null);
      else reject(error);
    });
    socket.on('end', () => {
      clearTimeout(timer);
      try {
        const reply = JSON.parse(bytes);
        if (reply.nonce !== nonce || reply.cwd !== home || reply.file !== join(home, 'login-holder.open') || reply.inode !== statSync(reply.file).ino || !Number.isSafeInteger(reply.pid) || reply.pid <= 1 || !Number.isSafeInteger(reply.inode)) throw new Error('invalid live holder proof');
        resolve(reply);
      } catch (error) { reject(error); }
    });
  });
}
export async function stopLoginHolder(home: string): Promise<void> {
  const receipt = await holderRequest(home, 'stop');
  if (!receipt) return;
  await until(() => {
    try { process.kill(receipt.pid, 0); return false; }
    catch (error) { if ((error as NodeJS.ErrnoException).code === 'ESRCH') return true; throw error; }
  }, { what: 'holder OS exit after self-owned shutdown' });
}
