const ENCODING = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const ENCODING_LEN = ENCODING.length;

function encodeTime(now: number, len: number): string {
  let str = "";
  for (let i = len - 1; i >= 0; i--) {
    const mod = now % ENCODING_LEN;
    str = ENCODING[mod] + str;
    now = (now - mod) / ENCODING_LEN;
  }
  return str;
}

function encodeRandom(len: number): string {
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  let str = "";
  for (let i = 0; i < len; i++) {
    str += ENCODING[bytes[i] % ENCODING_LEN];
  }
  return str;
}

export function generateUlid(): string {
  return encodeTime(Date.now(), 10) + encodeRandom(16);
}

export function decodeUlidTimestamp(encoded: string): number {
  let t = 0;
  for (let i = 0; i < encoded.length; i++) {
    t = t * ENCODING_LEN + ENCODING.indexOf(encoded[i]);
  }
  return t;
}
