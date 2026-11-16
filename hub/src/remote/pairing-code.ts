export const PAIRING_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const PAIRING_CODE_FORMAT = 'code must be 8 characters from A-H, J-N, P-Z and 2-9';

export function isPairingCode(code: unknown): code is string {
  return typeof code === 'string' && code.length === 8 && [...code].every(c => PAIRING_ALPHABET.includes(c));
}
