import { qrcodegen } from './vendor/qrcodegen.js';

/** Dark modules on a light background, with the QR-required four-module quiet zone. */
export function terminalQr(text: string): string {
  const qr = qrcodegen.QrCode.encodeSegments(qrcodegen.QrSegment.makeSegments(text), qrcodegen.QrCode.Ecc.LOW, 1, 40, -1, false);
  const lines: string[] = [];
  for (let y = -4; y < qr.size + 4; y += 2) {
    let line = '';
    for (let x = -4; x < qr.size + 4; x++) {
      const top = qr.getModule(x, y), bottom = qr.getModule(x, y + 1);
      // Explicit colours preserve the light quiet zone on either terminal theme.
      line += top ? (bottom ? '█' : '▀') : (bottom ? '▄' : ' ');
    }
    lines.push(`\x1b[30;47m${line}\x1b[0m`);
  }
  return `${lines.join('\n')}\n`;
}
