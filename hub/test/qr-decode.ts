// Independent, test-only ISO/IEC 18004 byte-mode reader for the L/v1–6 vectors.
// Reads the terminal's half blocks, format bits, masks and interleaved data;
// it deliberately imports no encoder code. It does not attempt error correction.
import assert from 'node:assert/strict';
export function decodeTerminalQr(rendered: string): string {
  const lines = rendered.replace(/\x1b\[[0-9;]*m/g, '').replace(/\n$/, '').split('\n');
  const pixels: boolean[][] = [];
  for (const line of lines) {
    const upper: boolean[] = [], lower: boolean[] = [];
    for (const char of line) {
      assert.ok([' ', '█', '▀', '▄'].includes(char));
      upper.push(char === '█' || char === '▀'); lower.push(char === '█' || char === '▄');
    }
    pixels.push(upper, lower);
  }
  const size = pixels[0]!.length - 8;
  const matrix = pixels.slice(4, size + 4).map(row => row.slice(4, size + 4));
  const bit = (x: number, y: number) => matrix[y]![x]!;
  const version = (size - 17) / 4;
  assert.ok(Number.isInteger(version) && version >= 1 && version <= 6);
  let format = 0;
  for (let i = 0; i < 15; i++) {
    const [x, y] = i < 6 ? [8, i] : i === 6 ? [8, 7] : i === 7 ? [8, 8] : i === 8 ? [7, 8] : [14 - i, 8];
    if (bit(x!, y!)) format |= 1 << i;
  }
  const mask = [0x77c4, 0x72f3, 0x7daa, 0x789d, 0x662f, 0x6318, 0x6c41, 0x6976].indexOf(format);
  assert.ok(mask >= 0, 'valid L format word');
  const unmask = (x: number, y: number) => [
    (x + y) % 2 === 0, y % 2 === 0, x % 3 === 0, (x + y) % 3 === 0,
    (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
    x * y % 2 + x * y % 3 === 0,
    (x * y % 2 + x * y % 3) % 2 === 0,
    ((x + y) % 2 + x * y % 3) % 2 === 0,
  ][mask]!;
  const reserved = (x: number, y: number) => x === 6 || y === 6
    || (x <= 8 && y <= 8) || (x >= size - 8 && y <= 8) || (x <= 8 && y >= size - 8)
    || (version > 1 && Math.abs(x - (size - 7)) <= 2 && Math.abs(y - (size - 7)) <= 2);
  const bits: number[] = [];
  let up = true;
  for (let right = size - 1; right > 0; right -= 2) {
    if (right === 6) right--;
    for (let row = 0; row < size; row++) {
      const y = up ? size - 1 - row : row;
      for (const x of [right, right - 1]) if (!reserved(x, y)) bits.push(Number(bit(x, y) !== unmask(x, y)));
    }
    up = !up;
  }
  const bytes: number[] = [];
  for (let i = 0; i + 7 < bits.length; i += 8) bytes.push(bits.slice(i, i + 8).reduce((n, b) => n * 2 + b, 0));
  const dataLength = [19, 34, 55, 80, 108, 136][version - 1]!;
  const blocks = version < 6 ? 1 : 2;
  const data = Array.from({ length: blocks }, (_, block) => bytes.slice(0, dataLength).filter((_, i) => i % blocks === block)).flat();
  const stream = data.flatMap(byte => Array.from({ length: 8 }, (_, i) => (byte >> (7 - i)) & 1));
  let at = 0;
  const take = (count: number) => stream.slice(at, at += count).reduce((n, b) => n * 2 + b, 0);
  assert.equal(take(4), 4, 'byte-mode segment');
  const length = take(8);
  return new TextDecoder().decode(Uint8Array.from({ length }, () => take(8)));
}
