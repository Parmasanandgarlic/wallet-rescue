export function normalizePrivateKey(value, name = 'PRIVATE_KEY') {
  const raw = String(value || '').trim();
  const normalized = raw.startsWith('0x') ? raw : `0x${raw}`;
  if (!/^0x[0-9a-fA-F]{64}$/.test(normalized)) {
    throw new Error(`${name} must be supplied at runtime as a 32-byte hex private key.`);
  }
  return normalized;
}

export function requireCompromisedKey() {
  return normalizePrivateKey(process.env.COMPROMISED_PRIVATE_KEY, 'COMPROMISED_PRIVATE_KEY');
}

export function requireRescueKey() {
  return normalizePrivateKey(process.env.RESCUE_PRIVATE_KEY, 'RESCUE_PRIVATE_KEY');
}
