// @ts-check
// A durable owner opens this private gate before execve preserves the PID/birth.
import { closeSync, createReadStream } from 'node:fs';
const gate = createReadStream('', { fd: 3, autoClose: false });
/** @type {Buffer} */
const token = await new Promise((resolve, reject) => {
  gate.once('data', data => resolve(Buffer.isBuffer(data) ? data : Buffer.from(data)));
  gate.once('end', () => reject(new Error('collector owner left before launch')));
  gate.once('error', reject);
});
gate.destroy();
closeSync(3);
if (token.length !== 1 || token[0] !== 1) process.exit(1);
const bin = process.argv[2];
if (!bin) throw new Error('owned Git gate requires an executable');
if (typeof process.execve !== 'function') throw new Error('owned Git maintenance requires POSIX Node execve');
process.execve(bin, [bin, ...process.argv.slice(3)], /** @type {Record<string, string>} */ (process.env));
