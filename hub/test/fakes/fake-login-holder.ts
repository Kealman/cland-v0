// A detached holder owns its file and shutdown; no caller signals a serialized PID.
import { closeSync, fstatSync, openSync, writeFileSync, unlinkSync, chmodSync } from 'node:fs';
import { createServer } from 'node:net';
import { join } from 'node:path';
import { holderSocket } from './login-holder-client.ts';

const home = process.cwd();
const file = join(home, 'login-holder.open');
const fd = openSync(file, 'w', 0o600);
const receipt = () => ({ pid: process.pid, cwd: home, file, inode: fstatSync(fd).ino });
let committed = false, stopping = false;
const shutdown = () => {
  if (stopping) return;
  stopping = true;
  closeSync(fd);
  try { unlinkSync(join(home, 'login-holder.json')); } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  server.close(() => process.exit(0));
};
const server = createServer({ allowHalfOpen: true }, socket => {
  let bytes = '';
  socket.on('data', chunk => { bytes += chunk; });
  socket.on('end', () => {
    const { nonce, command } = JSON.parse(bytes);
    const proof = { ...receipt(), nonce };
    if (command === 'stop') shutdown();
    socket.end(JSON.stringify(proof));
    // Adversarial self-exit deliberately leaves stale disk metadata and socket.
    if (command === 'crash') socket.once('close', () => process.kill(process.pid, 'SIGKILL'));
  });
});
process.on('message', message => {
  if (message === 'commit') { committed = true; process.send?.('committed'); process.disconnect?.(); }
});
process.on('disconnect', () => { if (!committed) shutdown(); });
process.on('SIGTERM', shutdown);
server.listen(holderSocket(home), () => {
  chmodSync(holderSocket(home), 0o600);
  writeFileSync(join(home, 'login-holder.json'), JSON.stringify(receipt()));
  process.send?.(receipt());
});
