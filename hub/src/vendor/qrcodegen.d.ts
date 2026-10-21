export const qrcodegen: {
  QrSegment: { makeSegments(text: string): unknown[] };
  QrCode: {
    Ecc: { LOW: unknown };
    encodeSegments(segments: unknown[], ecc: unknown, min: number, max: number, mask: number, boost: boolean): { size: number; getModule(x: number, y: number): boolean };
  };
};
