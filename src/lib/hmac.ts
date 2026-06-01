const encoder = new TextEncoder();

async function hmacKey(secret: string) {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

async function hmacSign(data: string, secret: string): Promise<string> {
  const key = await hmacKey(secret);
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
  return btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export async function signTicket(
  payload: Record<string, unknown>,
  secret: string,
  ttlSeconds: number
): Promise<string> {
  const body = {
    p: payload,
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
  };
  const json = JSON.stringify(body);
  const bytes = encoder.encode(json);
  const b64 = btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  const sig = await hmacSign(b64, secret);
  return `${b64}.${sig}`;
}

export async function verifyTicket(
  ticket: string,
  secret: string
): Promise<Record<string, unknown>> {
  const [b64, sig] = ticket.split(".");
  if (!b64 || !sig) throw new Error("invalid ticket format");

  const expectedSig = await hmacSign(b64, secret);
  if (sig !== expectedSig) throw new Error("invalid signature");

  const raw = atob(b64.replace(/-/g, "+").replace(/_/g, "/"));
  const bytes = Uint8Array.from(raw, (c) => c.charCodeAt(0));
  const json = new TextDecoder().decode(bytes);
  const body = JSON.parse(json);

  if (body.exp < Math.floor(Date.now() / 1000)) {
    throw new Error("ticket expired");
  }
  return body.p;
}
