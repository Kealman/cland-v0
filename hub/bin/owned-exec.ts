// A private gate keeps Git from running until its detached PID/birth/group are durable.
import { closeSync, createReadStream } from 'node:fs';
const gate = createReadStream('', { fd: 3, autoClose: false });
const token = await new Promise<Buffer>((resolve, reject) => {
  gate.once('data', data => resolve(Buffer.isBuffer(data) ? data : Buffer.from(data)));
  gate.once('end', () => reject(new Error('collector owner left before launch')));
  gate.once('error', reject);
});
gate.destroy();
closeSync(3);
if (token.length !== 1 || token[0] !== 1) process.exit(1);
const bin = process.argv[2]!;
if (typeof process.execve !== 'function') throw new Error('owned Git maintenance requires POSIX Node execve');
process.execve(bin, [bin, ...process.argv.slice(3)], process.env as Record<string, string>);
