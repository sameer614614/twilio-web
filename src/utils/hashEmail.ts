const encoder = typeof globalThis !== 'undefined' && typeof globalThis.TextEncoder !== 'undefined'
  ? new globalThis.TextEncoder()
  : null;

function bufferToHex(buffer) {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

async function sha256(message) {
  if (typeof message !== 'string' || !message) return null;

  try {
    if (typeof globalThis !== 'undefined' && globalThis.crypto?.subtle && encoder) {
      const data = encoder.encode(message);
      const hash = await globalThis.crypto.subtle.digest('SHA-256', data);
      return bufferToHex(hash);
    }
  } catch (error) {
    console.error('Unable to compute SHA-256 hash', error);
  }

  return null;
}

export async function hashEmail(email) {
  if (typeof email !== 'string') return null;
  const normalized = email.trim().toLowerCase();
  if (!normalized) return null;

  const hashed = await sha256(normalized);
  if (hashed) return hashed;

  try {
    if (typeof globalThis !== 'undefined' && typeof globalThis.btoa === 'function') {
      return globalThis.btoa(normalized);
    }
  } catch (error) {
    console.error('Unable to base64 encode email', error);
    return normalized;
  }

  return normalized;
}
